import { all, batch, first, run, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import {
  assertAdminMutationAllowed,
  requireAdminHotelAccess,
  requirePermission,
} from "../../services/admin-auth.js";
import { erpActorIds } from "../../services/erp-auth.js";
import { createEnrollmentCode, sha256Hex } from "../../services/print-agent-auth.js";
import { ERP_SETTINGS_PERMISSION } from "./erp-operations.js";

const MODULE_KEY = "room-service";
const PRINTING_SETTING_KEY = "room-service.printing_enabled";
const ENROLLMENT_TTL_MS = 15 * 60 * 1000;
const DEVICE_STATUSES = new Set(["active", "paused", "revoked"]);

export async function getRoomServicePrinting({ request, env, session, url }) {
  requirePermission(session, ERP_SETTINGS_PERMISSION);
  const hotelId = requestedHotel(session, url.searchParams.get("hotel_id"));
  const [setting, templates, devices, summary] = await Promise.all([
    first(env, `SELECT setting_value FROM hotel_settings WHERE hotel_id = ? AND setting_key = ? LIMIT 1`, [hotelId, PRINTING_SETTING_KEY]),
    all(
      env,
      `SELECT id, template_key, name, description, config_json, is_default, status, created_at, updated_at
         FROM printer_templates WHERE hotel_id = ? AND module_key = ? AND status = 'active'
        ORDER BY is_default DESC, name`,
      [hotelId, MODULE_KEY],
    ),
    all(
      env,
      `SELECT pd.id, pd.name, pd.platform, pd.app_version, pd.printer_name,
              pd.template_id, pt.name AS template_name, pd.status,
              pd.created_at, pd.updated_at, pd.last_seen_at, pd.revoked_at
         FROM printer_devices pd
         LEFT JOIN printer_templates pt ON pt.id = pd.template_id AND pt.hotel_id = pd.hotel_id
        WHERE pd.hotel_id = ? AND pd.module_key = ?
        ORDER BY pd.status, pd.name`,
      [hotelId, MODULE_KEY],
    ),
    all(
      env,
      `SELECT status, COUNT(*) AS total FROM print_events
        WHERE hotel_id = ? AND module_key = ? GROUP BY status ORDER BY status`,
      [hotelId, MODULE_KEY],
    ),
  ]);
  const globalEnabled = String(env.IMPRESSION_ENABLED || "false").toLowerCase() === "true";
  const unitEnabled = parseBoolean(setting?.setting_value);
  const now = Date.parse(requestNow({ request, env }));
  return {
    hotel_id: hotelId,
    module_key: MODULE_KEY,
    global_enabled: globalEnabled,
    unit_enabled: unitEnabled,
    effective_enabled: globalEnabled && unitEnabled,
    templates: templates.map((template) => ({ ...template, config: safeJson(template.config_json, {}) })),
    devices: devices.map((device) => ({ ...device, connection_status: deviceConnectionStatus(device, now) })),
    can_create_enrollment: devices.every((device) => device.status === "revoked"),
    summary: Object.fromEntries(summary.map((entry) => [entry.status, Number(entry.total || 0)])),
  };
}

function deviceConnectionStatus(device, now) {
  if (device.status === "revoked") return "revoked";
  if (device.status === "paused") return "paused";
  const seenAt = Date.parse(device.last_seen_at || "");
  return Number.isFinite(seenAt) && now - seenAt <= 120_000 ? "online" : "offline";
}

export async function updateRoomServicePrinting({ request, env, session }) {
  requirePermission(session, ERP_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  if (typeof payload.enabled !== "boolean") throw badRequest("enabled deve ser booleano.");
  const templateId = optionalString(payload.template_id, "template_id", { max: 100 });
  if (templateId) await requireTemplate(env, hotelId, templateId);
  const now = requestNow({ request, env });
  const statements = [
    statement(
      env,
      `INSERT INTO hotel_settings (
         id, hotel_id, setting_key, setting_value, value_type, is_public, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'boolean', 0, ?, ?)
       ON CONFLICT(hotel_id, setting_key) DO UPDATE SET
         setting_value = excluded.setting_value, value_type = 'boolean', is_public = 0,
         updated_at = excluded.updated_at`,
      [createPublicId("setting"), hotelId, PRINTING_SETTING_KEY, String(payload.enabled), now, now],
    ),
  ];
  if (templateId) {
    statements.push(
      statement(env, `UPDATE printer_templates SET is_default = 0, updated_at = ? WHERE hotel_id = ? AND module_key = ? AND is_default = 1`, [now, hotelId, MODULE_KEY]),
      statement(env, `UPDATE printer_templates SET is_default = 1, updated_at = ? WHERE id = ? AND hotel_id = ? AND module_key = ? AND status = 'active'`, [now, templateId, hotelId, MODULE_KEY]),
      statement(env, `UPDATE printer_devices SET template_id = ?, updated_at = ? WHERE hotel_id = ? AND module_key = ? AND template_id IS NULL`, [templateId, now, hotelId, MODULE_KEY]),
    );
  }
  statements.push(auditStatement(env, session, hotelId, "room-service.printing.updated", "hotel_setting", PRINTING_SETTING_KEY, { enabled: payload.enabled, template_id: templateId }, now));
  await batch(env, statements);
  return { hotel_id: hotelId, unit_enabled: payload.enabled, global_enabled: String(env.IMPRESSION_ENABLED || "false").toLowerCase() === "true" };
}

export async function createPrinterEnrollment({ request, env, session }) {
  requirePermission(session, ERP_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const connectedDevice = await first(
    env,
    `SELECT id
       FROM printer_devices
      WHERE hotel_id = ? AND module_key = ? AND status IN ('active', 'paused')
      LIMIT 1`,
    [hotelId, MODULE_KEY],
  );
  if (connectedDevice) {
    throw conflict("Revogue o computador vinculado antes de gerar um novo codigo.");
  }
  const now = requestNow({ request, env });
  const expiresAt = new Date(Date.parse(now) + ENROLLMENT_TTL_MS).toISOString();
  const code = createEnrollmentCode();
  const id = createPublicId("enroll");
  const actor = erpActorIds(session);
  const results = await batch(env, [
    statement(
      env,
      `UPDATE printer_enrollment_codes
          SET expires_at = ?
        WHERE hotel_id = ? AND module_key = ? AND used_at IS NULL AND expires_at > ?`,
      [now, hotelId, MODULE_KEY, now],
    ),
    statement(
      env,
      `INSERT INTO printer_enrollment_codes (
         id, hotel_id, module_key, code_hash, expires_at,
         created_by_admin_user_id, created_by_erp_user_id, created_at
       )
       SELECT ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1
            FROM printer_devices pd
           WHERE pd.hotel_id = ? AND pd.module_key = ? AND pd.status IN ('active', 'paused')
        )`,
      [id, hotelId, MODULE_KEY, await sha256Hex(code), expiresAt, actor.adminUserId, actor.erpUserId, now, hotelId, MODULE_KEY],
    ),
    statement(
      env,
      `INSERT INTO admin_audit_log (
         id, hotel_id, module_key, actor_user_id, actor_erp_user_id,
         action, entity_type, entity_id, metadata_json, created_at
       )
       SELECT ?, pec.hotel_id, pec.module_key, ?, ?,
              'room-service.printer.enrollment.created', 'printer_enrollment_code', pec.id, ?, ?
         FROM printer_enrollment_codes pec
        WHERE pec.id = ? AND pec.hotel_id = ? AND pec.module_key = ?`,
      [
        createPublicId("audit"),
        actor.adminUserId,
        actor.erpUserId,
        JSON.stringify({ expires_at: expiresAt }),
        now,
        id,
        hotelId,
        MODULE_KEY,
      ],
    ),
  ]);
  if (Number(results?.[1]?.meta?.changes || 0) !== 1 || Number(results?.[2]?.meta?.changes || 0) !== 1) {
    throw conflict("Revogue o computador vinculado antes de gerar um novo codigo.");
  }
  return { hotel_id: hotelId, activation_code: code, expires_at: expiresAt };
}

export async function updatePrinterDevice({ request, env, session, deviceId }) {
  requirePermission(session, ERP_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const current = await first(env, `SELECT id, name, status, template_id FROM printer_devices WHERE id = ? AND hotel_id = ? AND module_key = ? LIMIT 1`, [deviceId, hotelId, MODULE_KEY]);
  if (!current) throw notFoundError("Computador de impressao nao encontrado.");
  const status = Object.hasOwn(payload, "status") ? requireString(payload.status, "status", { max: 20 }) : current.status;
  if (!DEVICE_STATUSES.has(status)) throw badRequest("Status do computador invalido.");
  if (current.status === "revoked" && status !== "revoked") {
    throw conflict("Computador revogado nao pode ser reativado.");
  }
  const name = Object.hasOwn(payload, "name") ? requireString(payload.name, "name", { max: 100 }) : current.name;
  const templateId = Object.hasOwn(payload, "template_id") ? optionalString(payload.template_id, "template_id", { max: 100 }) : current.template_id;
  if (templateId) await requireTemplate(env, hotelId, templateId);
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE printer_devices SET name = ?, status = ?, template_id = ?, updated_at = ?,
              revoked_at = CASE WHEN ? = 'revoked' THEN ? ELSE NULL END
        WHERE id = ? AND hotel_id = ? AND module_key = ?`,
      [name, status, templateId, now, status, now, deviceId, hotelId, MODULE_KEY],
    ),
    auditStatement(env, session, hotelId, "room-service.printer.device.updated", "printer_device", deviceId, { status, template_id: templateId }, now),
  ]);
  return { device: { id: deviceId, hotel_id: hotelId, name, status, template_id: templateId } };
}

export async function deletePrinterDevice({ request, env, session, deviceId }) {
  requirePermission(session, ERP_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const current = await first(
    env,
    `SELECT id, name, status
       FROM printer_devices
      WHERE id = ? AND hotel_id = ? AND module_key = ?
      LIMIT 1`,
    [deviceId, hotelId, MODULE_KEY],
  );
  if (!current) throw notFoundError("Computador de impressao nao encontrado.");
  if (current.status !== "revoked") throw conflict("Revogue o computador antes de exclui-lo.");
  const now = requestNow({ request, env });
  const actor = erpActorIds(session);
  const results = await batch(env, [
    statement(
      env,
      `INSERT INTO admin_audit_log (
         id, hotel_id, module_key, actor_user_id, actor_erp_user_id,
         action, entity_type, entity_id, metadata_json, created_at
       )
       SELECT ?, pd.hotel_id, pd.module_key, ?, ?,
              'room-service.printer.device.deleted', 'printer_device', pd.id, ?, ?
         FROM printer_devices pd
        WHERE pd.id = ? AND pd.hotel_id = ? AND pd.module_key = ? AND pd.status = 'revoked'`,
      [
        createPublicId("audit"),
        actor.adminUserId,
        actor.erpUserId,
        JSON.stringify({ name: current.name }),
        now,
        deviceId,
        hotelId,
        MODULE_KEY,
      ],
    ),
    statement(
      env,
      `DELETE FROM printer_devices
        WHERE id = ? AND hotel_id = ? AND module_key = ? AND status = 'revoked'`,
      [deviceId, hotelId, MODULE_KEY],
    ),
  ]);
  if (Number(results?.[0]?.meta?.changes || 0) !== 1 || Number(results?.[1]?.meta?.changes || 0) !== 1) {
    throw conflict("Computador foi alterado por outro usuario.");
  }
  return { deleted: true, device_id: deviceId };
}

async function requireTemplate(env, hotelId, templateId) {
  const template = await first(env, `SELECT id FROM printer_templates WHERE id = ? AND hotel_id = ? AND module_key = ? AND status = 'active' LIMIT 1`, [templateId, hotelId, MODULE_KEY]);
  if (!template) throw notFoundError("Template de impressao nao encontrado.");
  return template;
}

function requestedHotel(session, value) {
  const hotelId = requireString(value, "hotel_id", { max: 80 });
  requireAdminHotelAccess(session, hotelId);
  return hotelId;
}

function auditStatement(env, session, hotelId, action, entityType, entityId, metadata, createdAt) {
  const actor = erpActorIds(session);
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, actor_erp_user_id,
       action, entity_type, entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [createPublicId("audit"), hotelId, MODULE_KEY, actor.adminUserId, actor.erpUserId, action, entityType, entityId, JSON.stringify(metadata || {}), createdAt],
  );
}

function parseBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function safeJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}
