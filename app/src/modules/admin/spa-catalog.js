import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import {
  assertAdminMutationAllowed,
  requireAdminHotelAccess,
  requirePermission,
} from "../../services/admin-auth.js";
import { HOTELS_READ_PERMISSION, HOTELS_UPDATE_PERMISSION } from "./hotels.js";

const MODULE_KEY = "spa";
const PROFILE_ID = "spa-zena";
const STATUSES = new Set(["active", "inactive", "archived"]);

export async function getAdminSpaCatalog({ env, session }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const [profile, services] = await Promise.all([
    loadSpaProfile(env),
    listSpaServices(env),
  ]);
  if (!profile) throw notFoundError("Perfil compartilhado do Spa nao encontrado.");
  return {
    scope: "shared",
    module_key: MODULE_KEY,
    profile: formatProfile(profile),
    services,
  };
}

export async function updateAdminSpaProfile({ request, env, session }) {
  requirePermission(session, HOTELS_UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadSpaProfile(env);
  if (!current) throw notFoundError("Perfil compartilhado do Spa nao encontrado.");
  const payload = await readJson(request);
  const values = await normalizeProfile(payload, current, env, session);
  const now = requestNow({ request, env });

  await batch(env, [
    statement(
      env,
      `UPDATE spa_shared_profile
          SET title = ?, subtitle = ?, intro_text = ?, about_text = ?,
              booking_title = ?, booking_text = ?, whatsapp_number = ?,
              whatsapp_service_message = ?, whatsapp_general_message = ?,
              hours_text = ?, usage_rules_json = ?, logo_media_asset_id = ?, status = ?,
              updated_at = ?, archived_at = ?
        WHERE id = ?`,
      [
        values.title,
        values.subtitle,
        values.intro_text,
        values.about_text,
        values.booking_title,
        values.booking_text,
        values.whatsapp_number,
        values.whatsapp_service_message,
        values.whatsapp_general_message,
        values.hours_text,
        JSON.stringify(values.usage_rules),
        values.logo_media_asset_id,
        values.status,
        now,
        values.status === "archived" ? now : null,
        PROFILE_ID,
      ],
    ),
    auditStatement(env, session, {
      action: "spa.profile.updated",
      entityType: "spa_shared_profile",
      entityId: PROFILE_ID,
      metadata: { status: values.status, rules_count: values.usage_rules.length },
      createdAt: now,
    }),
  ]);
  return { profile: formatProfile(await loadSpaProfile(env)) };
}

export async function createAdminSpaService({ request, env, session }) {
  requirePermission(session, HOTELS_UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const values = await normalizeService(env, session, payload, null);
  const serviceId = createPublicId("spa-service");
  const now = requestNow({ request, env });

  await batch(env, [
    statement(
      env,
      `INSERT INTO spa_shared_services (
         id, name, description, duration_label, duration_minutes,
         price_cents, currency, media_asset_id, status, sort_order,
         created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serviceId,
        values.name,
        values.description,
        values.duration_label,
        values.duration_minutes,
        values.price_cents,
        values.currency,
        values.media_asset_id,
        values.status,
        values.sort_order,
        now,
        now,
        values.status === "archived" ? now : null,
      ],
    ),
    auditStatement(env, session, {
      action: "spa.service.created",
      entityType: "spa_shared_service",
      entityId: serviceId,
      metadata: { status: values.status, media_asset_id: values.media_asset_id },
      createdAt: now,
    }),
  ]);
  return { service: await requireSpaService(env, serviceId) };
}

export async function updateAdminSpaService({ request, env, session, serviceId }) {
  requirePermission(session, HOTELS_UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await requireSpaService(env, serviceId);
  const payload = await readJson(request);
  const values = await normalizeService(env, session, payload, current);
  const now = requestNow({ request, env });

  await batch(env, [
    statement(
      env,
      `UPDATE spa_shared_services
          SET name = ?, description = ?, duration_label = ?,
              duration_minutes = ?, price_cents = ?, currency = ?,
              media_asset_id = ?, status = ?, sort_order = ?,
              updated_at = ?, archived_at = ?
        WHERE id = ?`,
      [
        values.name,
        values.description,
        values.duration_label,
        values.duration_minutes,
        values.price_cents,
        values.currency,
        values.media_asset_id,
        values.status,
        values.sort_order,
        now,
        values.status === "archived" ? now : null,
        serviceId,
      ],
    ),
    auditStatement(env, session, {
      action: "spa.service.updated",
      entityType: "spa_shared_service",
      entityId: serviceId,
      metadata: { status: values.status, media_asset_id: values.media_asset_id },
      createdAt: now,
    }),
  ]);
  return { service: await requireSpaService(env, serviceId) };
}

function loadSpaProfile(env) {
  return first(
    env,
    `SELECT p.id, p.title, p.subtitle, p.intro_text, p.about_text,
            p.booking_title, p.booking_text, p.whatsapp_number,
            p.whatsapp_service_message, p.whatsapp_general_message,
            p.hours_text, p.usage_rules_json, p.logo_media_asset_id,
            ma.public_url AS logo_url, ma.alt_text AS logo_alt,
            p.status, p.created_at, p.updated_at, p.archived_at
       FROM spa_shared_profile p
       LEFT JOIN media_assets ma ON ma.id = p.logo_media_asset_id
      WHERE p.id = ?
      LIMIT 1`,
    [PROFILE_ID],
  );
}

function listSpaServices(env) {
  return all(
    env,
    `SELECT s.id, s.name, s.description, s.duration_label,
            s.duration_minutes, s.price_cents, s.currency,
            s.media_asset_id, ma.public_url AS image_url,
            ma.alt_text AS image_alt, s.status, s.sort_order,
            s.created_at, s.updated_at, s.archived_at
       FROM spa_shared_services s
       LEFT JOIN media_assets ma ON ma.id = s.media_asset_id
      ORDER BY s.sort_order, s.name`,
  );
}

function requireSpaService(env, serviceIdValue) {
  const serviceId = requireString(serviceIdValue, "service_id", { max: 120 });
  return first(
    env,
    `SELECT s.id, s.name, s.description, s.duration_label,
            s.duration_minutes, s.price_cents, s.currency,
            s.media_asset_id, ma.public_url AS image_url,
            ma.alt_text AS image_alt, s.status, s.sort_order,
            s.created_at, s.updated_at, s.archived_at
       FROM spa_shared_services s
       LEFT JOIN media_assets ma ON ma.id = s.media_asset_id
      WHERE s.id = ?
      LIMIT 1`,
    [serviceId],
  ).then((service) => {
    if (!service) throw notFoundError("Servico do Spa nao encontrado.");
    return service;
  });
}

async function normalizeProfile(payload, current, env, session) {
  const value = (key, max) =>
    Object.hasOwn(payload, key)
      ? requireString(payload[key], key, { max })
      : current[key];
  const status = Object.hasOwn(payload, "status")
    ? requireString(payload.status, "status", { max: 20 })
    : current.status;
  if (!STATUSES.has(status)) throw badRequest("Status do perfil invalido.");
  const whatsappNumber = value("whatsapp_number", 20).replace(/\D/g, "");
  if (whatsappNumber.length < 8 || whatsappNumber.length > 20) {
    throw badRequest("Numero do WhatsApp invalido.");
  }
  const usageRules = Object.hasOwn(payload, "usage_rules")
    ? normalizeRules(payload.usage_rules)
    : parseRules(current.usage_rules_json);
  const logoMediaAssetId = Object.hasOwn(payload, "logo_media_asset_id")
    ? optionalString(payload.logo_media_asset_id, "logo_media_asset_id", { max: 120 }) || null
    : current.logo_media_asset_id || null;
  if (logoMediaAssetId) await requireAccessibleImage(env, session, logoMediaAssetId);
  return {
    title: value("title", 120),
    subtitle: value("subtitle", 240),
    intro_text: value("intro_text", 500),
    about_text: value("about_text", 4000),
    booking_title: value("booking_title", 120),
    booking_text: value("booking_text", 500),
    whatsapp_number: whatsappNumber,
    whatsapp_service_message: value("whatsapp_service_message", 800),
    whatsapp_general_message: value("whatsapp_general_message", 800),
    hours_text: value("hours_text", 120),
    usage_rules: usageRules,
    logo_media_asset_id: logoMediaAssetId,
    status,
  };
}

async function normalizeService(env, session, payload, current) {
  const stringValue = (key, max, required = true) => {
    if (!Object.hasOwn(payload, key)) return current?.[key] ?? null;
    return required
      ? requireString(payload[key], key, { max })
      : optionalString(payload[key], key, { max }) || null;
  };
  const priceCents = Object.hasOwn(payload, "price_cents")
    ? Number(payload.price_cents)
    : Number(current?.price_cents);
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 100000000) {
    throw badRequest("Preco invalido.");
  }
  const durationMinutes = Object.hasOwn(payload, "duration_minutes")
    ? normalizeOptionalInteger(payload.duration_minutes, "duration_minutes", 1, 1440)
    : current?.duration_minutes ?? null;
  const sortOrder = Object.hasOwn(payload, "sort_order")
    ? normalizeOptionalInteger(payload.sort_order, "sort_order", 0, 100000)
    : Number(current?.sort_order ?? 100);
  const status = Object.hasOwn(payload, "status")
    ? requireString(payload.status, "status", { max: 20 })
    : current?.status || "active";
  if (!STATUSES.has(status)) throw badRequest("Status do servico invalido.");
  const mediaAssetId = Object.hasOwn(payload, "media_asset_id")
    ? optionalString(payload.media_asset_id, "media_asset_id", { max: 120 }) || null
    : current?.media_asset_id || null;
  if (mediaAssetId) await requireAccessibleImage(env, session, mediaAssetId);

  return {
    name: stringValue("name", 160),
    description: stringValue("description", 3000),
    duration_label: stringValue("duration_label", 80),
    duration_minutes: durationMinutes,
    price_cents: priceCents,
    currency: stringValue("currency", 3).toUpperCase(),
    media_asset_id: mediaAssetId,
    status,
    sort_order: sortOrder,
  };
}

async function requireAccessibleImage(env, session, assetId) {
  const asset = await first(
    env,
    `SELECT id, hotel_id
       FROM media_assets
      WHERE id = ?
        AND status = 'active'
        AND mime_type LIKE 'image/%'
      LIMIT 1`,
    [assetId],
  );
  if (!asset) throw badRequest("Imagem ativa nao encontrada.");
  if (asset.hotel_id) requireAdminHotelAccess(session, asset.hotel_id);
  return asset;
}

function formatProfile(profile) {
  return {
    ...profile,
    usage_rules: parseRules(profile.usage_rules_json),
    usage_rules_json: undefined,
  };
}

function normalizeRules(value) {
  if (!Array.isArray(value)) throw badRequest("usage_rules deve ser uma lista.");
  const rules = value
    .map((rule) => requireString(rule, "usage_rule", { max: 500 }))
    .slice(0, 30);
  if (!rules.length) throw badRequest("Informe ao menos uma regra de utilizacao.");
  return rules;
}

function parseRules(value) {
  try {
    return normalizeRules(JSON.parse(value || "[]"));
  } catch {
    return [];
  }
}

function normalizeOptionalInteger(value, label, min, max) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw badRequest(`${label} invalido.`);
  }
  return parsed;
}

function auditStatement(env, session, { action, entityType, entityId, metadata, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action,
       entity_type, entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createPublicId("audit"),
      null,
      MODULE_KEY,
      session.user.id,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata || {}),
      createdAt,
    ],
  );
}
