import { all, batch, first, run, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError, unprocessable } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import { createPrintAgentToken, requirePrintAgent, sha256Hex } from "../../services/print-agent-auth.js";

const MODULE_KEY = "room-service";
const CLAIM_TTL_MS = 90_000;

export async function listPrintAgentEnrollmentHotels(env) {
  const hotels = await all(
    env,
    `SELECT h.id AS hotel_id, h.slug, h.name, h.short_name,
            COALESCE(hb.icon_url, hb.logo_url) AS icon_url
       FROM hotels h
       JOIN hotel_modules hm ON hm.hotel_id = h.id
       LEFT JOIN hotel_branding hb ON hb.hotel_id = h.id
      WHERE h.status = 'active'
        AND h.archived_at IS NULL
        AND hm.module_key = ?
        AND hm.enabled = 1
      ORDER BY h.name`,
    [MODULE_KEY],
  );
  return { hotels };
}

export async function enrollPrintAgent({ request, env }) {
  const payload = await readJson(request);
  const hotelId = requireString(payload.hotel_id, "hotel_id", { max: 80 });
  const activationCode = normalizeEnrollmentCode(payload.activation_code);
  const name = requireString(payload.device_name, "device_name", { max: 100 });
  const platform = optionalString(payload.platform, "platform", { max: 40 }) || "windows";
  const appVersion = optionalString(payload.app_version, "app_version", { max: 40 });
  const printerName = optionalString(payload.printer_name, "printer_name", { max: 180 });
  const now = requestNow({ request, env });
  const codeHash = await sha256Hex(activationCode);
  const code = await first(
    env,
      `SELECT pec.id, pec.hotel_id, pec.module_key, pec.expires_at,
            pt.id AS template_id, h.name AS hotel_name, h.slug AS hotel_slug,
            COALESCE(hb.icon_url, hb.logo_url) AS hotel_icon_url
       FROM printer_enrollment_codes pec
       JOIN hotels h ON h.id = pec.hotel_id
       LEFT JOIN hotel_branding hb ON hb.hotel_id = h.id
       LEFT JOIN printer_templates pt
         ON pt.hotel_id = pec.hotel_id AND pt.module_key = pec.module_key
        AND pt.is_default = 1 AND pt.status = 'active'
      WHERE pec.code_hash = ?
        AND pec.hotel_id = ?
        AND pec.module_key = ?
        AND pec.used_at IS NULL
        AND pec.expires_at > ?
      LIMIT 1`,
    [codeHash, hotelId, MODULE_KEY, now],
  );
  if (!code) throw unprocessable("Codigo de conexao invalido ou expirado.");

  const deviceId = createPublicId("printer");
  const token = createPrintAgentToken();
  const tokenHash = await sha256Hex(token);
  const results = await batch(env, [
    statement(
      env,
      `INSERT INTO printer_devices (
         id, hotel_id, module_key, name, token_hash, platform, app_version,
         printer_name, template_id, status, created_at, updated_at, last_seen_at
       )
       SELECT ?, pec.hotel_id, pec.module_key, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?
         FROM printer_enrollment_codes pec
        WHERE pec.id = ? AND pec.used_at IS NULL AND pec.expires_at > ?
          AND NOT EXISTS (
            SELECT 1
              FROM printer_devices pd
             WHERE pd.hotel_id = pec.hotel_id
               AND pd.module_key = pec.module_key
               AND pd.status IN ('active', 'paused')
          )`,
      [deviceId, name, tokenHash, platform, appVersion, printerName, code.template_id, now, now, now, code.id, now],
    ),
    statement(
      env,
      `UPDATE printer_enrollment_codes
          SET used_by_device_id = ?, used_at = ?
        WHERE id = ? AND used_at IS NULL AND expires_at > ?
          AND EXISTS (
            SELECT 1
              FROM printer_devices pd
             WHERE pd.id = ? AND pd.hotel_id = ? AND pd.module_key = ? AND pd.status = 'active'
          )`,
      [deviceId, now, code.id, now, deviceId, code.hotel_id, MODULE_KEY],
    ),
  ]);
  if (Number(results?.[0]?.meta?.changes || 0) !== 1 || Number(results?.[1]?.meta?.changes || 0) !== 1) {
    throw conflict("Esta unidade ja possui um servidor de impressao vinculado.");
  }
  return {
    device: { id: deviceId, hotel_id: code.hotel_id, name, status: "active", template_id: code.template_id },
    hotel: {
      hotel_id: code.hotel_id,
      slug: code.hotel_slug,
      name: code.hotel_name,
      icon_url: code.hotel_icon_url || null,
    },
    access_token: token,
  };
}

export async function heartbeatPrintAgent({ request, env }) {
  const device = await requirePrintAgent({ request, env });
  const payload = await readJson(request);
  const appVersion = optionalString(payload.app_version, "app_version", { max: 40 });
  const printerName = optionalString(payload.printer_name, "printer_name", { max: 180 });
  const now = requestNow({ request, env });
  await run(
    env,
    `UPDATE printer_devices
        SET app_version = COALESCE(?, app_version),
            printer_name = COALESCE(?, printer_name),
            last_seen_at = ?, updated_at = ?
      WHERE id = ? AND hotel_id = ?`,
    [appVersion, printerName, now, now, device.id, device.hotel_id],
  );
  return { device_id: device.id, status: device.status, printing_enabled: await isPrintingEnabled(env, device.hotel_id) };
}

export async function getPrintAgentSettings({ request, env }) {
  const device = await requirePrintAgent({ request, env });
  const templates = await all(
    env,
    `SELECT id, template_key, name, description, config_json, is_default
       FROM printer_templates
      WHERE hotel_id = ? AND module_key = ? AND status = 'active'
      ORDER BY is_default DESC, name, id`,
    [device.hotel_id, MODULE_KEY],
  );
  return {
    device: {
      id: device.id,
      hotel_id: device.hotel_id,
      hotel_slug: device.hotel_slug,
      hotel_name: device.hotel_name,
      name: device.name,
      printer_name: device.printer_name || null,
      template_id: device.template_id || null,
      status: device.status,
      printing_enabled: await isPrintingEnabled(env, device.hotel_id),
    },
    templates: templates.map((template) => ({
      id: template.id,
      key: template.template_key,
      name: template.name,
      description: template.description || null,
      is_default: Boolean(template.is_default),
      config: safeJson(template.config_json, {}),
    })),
  };
}

export async function updatePrintAgentSettings({ request, env }) {
  const device = await requirePrintAgent({ request, env });
  if (device.status !== "active") throw conflict("Agente de impressao pausado.");
  const payload = await readJson(request);
  const printerName = Object.hasOwn(payload, "printer_name")
    ? requireString(payload.printer_name, "printer_name", { max: 180 })
    : device.printer_name;
  const templateId = Object.hasOwn(payload, "template_id")
    ? requireString(payload.template_id, "template_id", { max: 100 })
    : device.template_id;
  const template = await first(
    env,
    `SELECT id FROM printer_templates
      WHERE id = ? AND hotel_id = ? AND module_key = ? AND status = 'active' LIMIT 1`,
    [templateId, device.hotel_id, MODULE_KEY],
  );
  if (!template) throw notFoundError("Template de impressao nao encontrado para esta unidade.");
  const now = requestNow({ request, env });
  const result = await run(
    env,
    `UPDATE printer_devices
        SET printer_name = ?, template_id = ?, app_version = COALESCE(?, app_version),
            last_seen_at = ?, updated_at = ?
      WHERE id = ? AND hotel_id = ? AND module_key = ? AND status = 'active'`,
    [printerName, templateId, optionalString(payload.app_version, "app_version", { max: 40 }), now, now, device.id, device.hotel_id, MODULE_KEY],
  );
  if (Number(result?.meta?.changes || 0) !== 1) throw conflict("Configuracao alterada por outro processo.");
  return {
    device: {
      id: device.id,
      hotel_id: device.hotel_id,
      printer_name: printerName,
      template_id: templateId,
      status: "active",
    },
  };
}

export async function claimPrintJob({ request, env }) {
  const device = await requirePrintAgent({ request, env });
  if (device.status !== "active") throw conflict("Agente de impressao pausado.");
  if (!(await isPrintingEnabled(env, device.hotel_id))) {
    return { job: null, printing_enabled: false };
  }
  const now = requestNow({ request, env });
  await run(
    env,
    `UPDATE print_events
        SET status = 'queued', device_id = NULL, claim_token_hash = NULL,
            claimed_at = NULL, claim_expires_at = NULL, updated_at = ?
      WHERE hotel_id = ? AND module_key = ? AND status = 'printing'
        AND claim_expires_at IS NOT NULL AND claim_expires_at <= ?`,
    [now, device.hotel_id, MODULE_KEY, now],
  );
  const candidate = await first(
    env,
    `SELECT pe.id
       FROM print_events pe
       JOIN orders o ON o.id = pe.order_id AND o.hotel_id = pe.hotel_id
      WHERE pe.hotel_id = ? AND pe.module_key = ? AND pe.status = 'queued'
        AND (o.scheduled_for IS NULL OR o.scheduled_for <= ?)
      ORDER BY pe.requested_at, pe.id
      LIMIT 1`,
    [device.hotel_id, MODULE_KEY, now],
  );
  if (!candidate) return { job: null, printing_enabled: true };

  const claimToken = createPrintAgentToken();
  const claimTokenHash = await sha256Hex(claimToken);
  const expiresAt = new Date(Date.parse(now) + CLAIM_TTL_MS).toISOString();
  const claimed = await run(
    env,
    `UPDATE print_events
        SET status = 'printing', device_id = ?, template_id = COALESCE(template_id, ?),
            claim_token_hash = ?, claimed_at = ?, claim_expires_at = ?,
            attempts = attempts + 1, updated_at = ?
      WHERE id = ? AND hotel_id = ? AND module_key = ? AND status = 'queued'`,
    [device.id, device.template_id, claimTokenHash, now, expiresAt, now, candidate.id, device.hotel_id, MODULE_KEY],
  );
  if (Number(claimed?.meta?.changes || 0) !== 1) return { job: null, printing_enabled: true };
  return {
    job: await loadPrintableJob(env, device, candidate.id, claimToken, expiresAt),
    printing_enabled: true,
  };
}

export async function completePrintJob({ request, env, jobId }) {
  const device = await requirePrintAgent({ request, env });
  const payload = await readJson(request);
  const claimToken = requireString(payload.claim_token, "claim_token", { max: 200 });
  const claimHash = await sha256Hex(claimToken);
  const now = requestNow({ request, env });
  const current = await first(
    env,
    `SELECT id, order_id, status, device_id FROM print_events
      WHERE id = ? AND hotel_id = ? AND module_key = ? LIMIT 1`,
    [jobId, device.hotel_id, MODULE_KEY],
  );
  if (!current) throw notFoundError("Trabalho de impressao nao encontrado.");
  if (current.status === "printed" && current.device_id === device.id) return { id: jobId, status: "printed", idempotent: true };

  const historyId = createPublicId("hist");
  const results = await batch(env, [
    statement(
      env,
      `UPDATE print_events
          SET status = 'printed', printed_at = ?, completed_at = ?, updated_at = ?,
              claim_expires_at = NULL, last_error = NULL
        WHERE id = ? AND hotel_id = ? AND module_key = ? AND device_id = ?
          AND status = 'printing' AND claim_token_hash = ? AND claim_expires_at > ?`,
      [now, now, now, jobId, device.hotel_id, MODULE_KEY, device.id, claimHash, now],
    ),
    statement(
      env,
      `UPDATE orders SET status = 'ready', updated_at = ?
        WHERE id = ? AND hotel_id = ? AND module_key = ?
          AND status IN ('received', 'accepted', 'preparing')
          AND EXISTS (
            SELECT 1 FROM print_events pe
             WHERE pe.id = ? AND pe.hotel_id = ? AND pe.module_key = ?
               AND pe.status = 'printed' AND pe.completed_at = ? AND pe.claim_token_hash = ?
          )`,
      [now, current.order_id, device.hotel_id, MODULE_KEY, jobId, device.hotel_id, MODULE_KEY, now, claimHash],
    ),
    statement(
      env,
      `INSERT INTO order_status_history (id, order_id, hotel_id, module_key, status, note, created_at)
       SELECT ?, o.id, o.hotel_id, o.module_key, 'printed', 'Pedido impresso automaticamente.', ?
         FROM orders o
        WHERE o.id = ? AND o.hotel_id = ? AND o.module_key = ?
          AND EXISTS (
            SELECT 1 FROM print_events pe
             WHERE pe.id = ? AND pe.hotel_id = ? AND pe.module_key = ?
               AND pe.status = 'printed' AND pe.completed_at = ? AND pe.claim_token_hash = ?
          )
          AND NOT EXISTS (SELECT 1 FROM order_status_history osh WHERE osh.order_id = o.id AND osh.status = 'printed')`,
      [historyId, now, current.order_id, device.hotel_id, MODULE_KEY, jobId, device.hotel_id, MODULE_KEY, now, claimHash],
    ),
    statement(
      env,
      `UPDATE print_events SET claim_token_hash = NULL
        WHERE id = ? AND hotel_id = ? AND module_key = ?
          AND status = 'printed' AND completed_at = ? AND claim_token_hash = ?`,
      [jobId, device.hotel_id, MODULE_KEY, now, claimHash],
    ),
  ]);
  if (Number(results?.[0]?.meta?.changes || 0) !== 1) throw conflict("Trabalho expirado ou assumido por outro agente.");
  return { id: jobId, order_id: current.order_id, status: "printed", idempotent: false };
}

export async function failPrintJob({ request, env, jobId }) {
  const device = await requirePrintAgent({ request, env });
  const payload = await readJson(request);
  const claimToken = requireString(payload.claim_token, "claim_token", { max: 200 });
  const message = optionalString(payload.message, "message", { max: 300 }) || "Falha de impressao informada pelo agente.";
  const now = requestNow({ request, env });
  const result = await run(
    env,
    `UPDATE print_events
        SET status = CASE WHEN attempts < 3 THEN 'queued' ELSE 'failed' END,
            last_error = ?,
            completed_at = CASE WHEN attempts < 3 THEN NULL ELSE ? END,
            updated_at = ?, claim_token_hash = NULL, claim_expires_at = NULL,
            device_id = CASE WHEN attempts < 3 THEN NULL ELSE device_id END,
            claimed_at = CASE WHEN attempts < 3 THEN NULL ELSE claimed_at END
      WHERE id = ? AND hotel_id = ? AND module_key = ? AND device_id = ?
        AND status = 'printing' AND claim_token_hash = ?`,
    [message, now, now, jobId, device.hotel_id, MODULE_KEY, device.id, await sha256Hex(claimToken)],
  );
  if (Number(result?.meta?.changes || 0) !== 1) throw conflict("Trabalho expirado ou assumido por outro agente.");
  const updated = await first(
    env,
    `SELECT status, attempts FROM print_events WHERE id = ? AND hotel_id = ? AND module_key = ? LIMIT 1`,
    [jobId, device.hotel_id, MODULE_KEY],
  );
  return { id: jobId, status: updated?.status || "failed", attempts: Number(updated?.attempts || 0) };
}

async function isPrintingEnabled(env, hotelId) {
  if (String(env.IMPRESSION_ENABLED || "false").toLowerCase() !== "true") return false;
  const row = await first(
    env,
    `SELECT setting_value FROM hotel_settings WHERE hotel_id = ? AND setting_key = 'room-service.printing_enabled' LIMIT 1`,
    [hotelId],
  );
  return row?.setting_value === "true" || row?.setting_value === "1";
}

async function loadPrintableJob(env, device, jobId, claimToken, claimExpiresAt) {
  const order = await first(
    env,
    `SELECT pe.id AS print_event_id, pe.job_kind, pe.attempts, pe.template_id,
            o.id AS order_id, o.public_id, o.origin, o.room_code, o.guest_name,
            o.notes, o.currency, o.subtotal_cents, o.total_cents, o.preparation_mode,
            o.scheduled_for, o.created_at, h.name AS hotel_name, h.short_name AS hotel_short_name,
            h.timezone, hb.logo_url
       FROM print_events pe
       JOIN orders o ON o.id = pe.order_id AND o.hotel_id = pe.hotel_id
       JOIN hotels h ON h.id = pe.hotel_id
       LEFT JOIN hotel_branding hb ON hb.hotel_id = h.id
      WHERE pe.id = ? AND pe.hotel_id = ? AND pe.module_key = ?
        AND pe.device_id = ? AND pe.status = 'printing'
      LIMIT 1`,
    [jobId, device.hotel_id, MODULE_KEY, device.id],
  );
  if (!order) throw conflict("Trabalho de impressao indisponivel.");
  const [items, template] = await Promise.all([
    all(
      env,
      `SELECT item_name_snapshot AS name, item_description_snapshot AS description,
              unit_price_cents, quantity, line_total_cents, selected_options_snapshot
         FROM order_items
        WHERE order_id = ? AND hotel_id = ? AND module_key = ?
        ORDER BY created_at, id`,
      [order.order_id, device.hotel_id, MODULE_KEY],
    ),
    first(
      env,
      `SELECT id, template_key, name, config_json FROM printer_templates
        WHERE id = COALESCE(?, ?) AND hotel_id = ? AND module_key = ? AND status = 'active' LIMIT 1`,
      [order.template_id, device.template_id, device.hotel_id, MODULE_KEY],
    ),
  ]);
  if (!template) throw conflict("Template de impressao indisponivel.");
  return {
    id: order.print_event_id,
    claim_token: claimToken,
    claim_expires_at: claimExpiresAt,
    template: { id: template.id, key: template.template_key, name: template.name, config: JSON.parse(template.config_json) },
    order: { ...order, items },
  };
}

function normalizeEnrollmentCode(value) {
  const code = requireString(value, "activation_code", { max: 32 }).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 10) throw badRequest("Codigo de conexao invalido.");
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
