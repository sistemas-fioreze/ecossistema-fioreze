import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, notFoundError } from "../../core/errors.js";
import { createPublicId, isSafeIdentifier } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import {
  assertAdminMutationAllowed,
  requireAdminHotelAccess,
  requirePermission,
} from "../../services/admin-auth.js";
import { HOTELS_READ_PERMISSION, HOTELS_SETTINGS_PERMISSION } from "./hotels.js";
import { ADMIN_AUDIT_READ } from "./users.js";

const PAGE_STATUSES = new Set(["draft", "published", "archived"]);
const EVENT_STATUSES = new Set(["draft", "published", "cancelled", "archived"]);

export async function listPortalContent({ env, session, url }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const hotelId = requireHotelId(url);
  requireAdminHotelAccess(session, hotelId);

  const [pages, events, information] = await Promise.all([
    all(
      env,
      `SELECT p.id, p.hotel_id, p.module_key, p.slug, p.title, p.summary, p.status,
              p.sort_order, p.created_at, p.updated_at, p.archived_at,
              COUNT(DISTINCT s.id) AS section_count
         FROM portal_pages p
         LEFT JOIN portal_sections s ON s.page_id = p.id AND s.hotel_id = p.hotel_id
        WHERE p.hotel_id = ?
        GROUP BY p.id
        ORDER BY p.sort_order, p.title`,
      [hotelId],
    ),
    all(
      env,
      `SELECT e.id, e.hotel_id, e.title, e.summary, e.content, e.location, e.category,
              e.tags_json, e.starts_at, e.ends_at, e.timezone,
              e.status, e.media_asset_id, e.created_at, e.updated_at,
              ma.public_url AS image_url, ma.alt_text AS image_alt
         FROM events e
         LEFT JOIN media_assets ma
           ON ma.id = e.media_asset_id
          AND ma.hotel_id = e.hotel_id
          AND ma.status = 'active'
        WHERE e.hotel_id = ?
        ORDER BY e.starts_at DESC, e.title`,
      [hotelId],
    ),
    all(
      env,
      `SELECT id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at
         FROM hotel_information
        WHERE hotel_id = ?
        ORDER BY sort_order, title`,
      [hotelId],
    ),
  ]);

  return {
    hotel_id: hotelId,
    pages: pages.map((row) => ({ ...row, section_count: Number(row.section_count || 0) })),
    events: events.map(formatEvent),
    information: information.map((row) => ({ ...row, is_public: Boolean(row.is_public) })),
  };
}

export async function getPortalPage({ env, session, pageId }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const page = await loadPage(env, pageId);
  if (!page) throw notFoundError("Pagina nao encontrada.");
  requireAdminHotelAccess(session, page.hotel_id);
  const sections = await all(
    env,
    `SELECT id, page_id, hotel_id, section_key, title, body, settings_json,
            sort_order, created_at, updated_at
       FROM portal_sections
      WHERE page_id = ? AND hotel_id = ?
      ORDER BY sort_order, title`,
    [pageId, page.hotel_id],
  );
  return { page, sections: sections.map(formatSection) };
}

export async function createPortalPage({ request, env, session }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requireString(payload.hotel_id, "unidade", { max: 120 });
  requireAdminHotelAccess(session, hotelId);
  const data = pagePayload(payload);
  const now = requestNow({ request, env });
  const pageId = createPublicId("portal_page");
  await batch(env, [
    statement(
      env,
      `INSERT INTO portal_pages (
         id, hotel_id, module_key, slug, title, summary, status, sort_order,
         created_at, updated_at, archived_at
       ) VALUES (?, ?, 'guest-portal', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pageId, hotelId, data.slug, data.title, data.summary, data.status, data.sortOrder, now, now, archivedAt(data.status, now)],
    ),
    auditStatement(env, session, {
      hotelId,
      action: "portal-page.create",
      entityType: "portal_page",
      entityId: pageId,
      metadata: { status: data.status, slug: data.slug },
      now,
    }),
  ]);
  return { page: await loadPage(env, pageId) };
}

export async function updatePortalPage({ request, env, session, pageId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadPage(env, pageId);
  if (!current) throw notFoundError("Pagina nao encontrada.");
  requireAdminHotelAccess(session, current.hotel_id);
  const data = pagePayload(await readJson(request));
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE portal_pages
          SET slug = ?, title = ?, summary = ?, status = ?, sort_order = ?,
              updated_at = ?, archived_at = ?
        WHERE id = ? AND hotel_id = ?`,
      [data.slug, data.title, data.summary, data.status, data.sortOrder, now, archivedAt(data.status, now), pageId, current.hotel_id],
    ),
    auditStatement(env, session, {
      hotelId: current.hotel_id,
      action: "portal-page.update",
      entityType: "portal_page",
      entityId: pageId,
      metadata: { status: data.status, slug: data.slug },
      now,
    }),
  ]);
  return { page: await loadPage(env, pageId) };
}

export async function createPortalSection({ request, env, session, pageId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const page = await loadPage(env, pageId);
  if (!page) throw notFoundError("Pagina nao encontrada.");
  requireAdminHotelAccess(session, page.hotel_id);
  const data = sectionPayload(await readJson(request));
  const now = requestNow({ request, env });
  const sectionId = createPublicId("portal_section");
  await batch(env, [
    statement(
      env,
      `INSERT INTO portal_sections (
         id, page_id, hotel_id, section_key, title, body, settings_json,
         sort_order, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sectionId, pageId, page.hotel_id, data.sectionKey, data.title, data.body, data.settingsJson, data.sortOrder, now, now],
    ),
    auditStatement(env, session, {
      hotelId: page.hotel_id,
      action: "portal-section.create",
      entityType: "portal_section",
      entityId: sectionId,
      metadata: { page_id: pageId, section_key: data.sectionKey },
      now,
    }),
  ]);
  return { section: formatSection(await loadSection(env, sectionId)) };
}

export async function updatePortalSection({ request, env, session, sectionId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadSection(env, sectionId);
  if (!current) throw notFoundError("Secao nao encontrada.");
  requireAdminHotelAccess(session, current.hotel_id);
  const data = sectionPayload(await readJson(request));
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE portal_sections
          SET section_key = ?, title = ?, body = ?, settings_json = ?, sort_order = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ?`,
      [data.sectionKey, data.title, data.body, data.settingsJson, data.sortOrder, now, sectionId, current.hotel_id],
    ),
    auditStatement(env, session, {
      hotelId: current.hotel_id,
      action: "portal-section.update",
      entityType: "portal_section",
      entityId: sectionId,
      metadata: { page_id: current.page_id, section_key: data.sectionKey },
      now,
    }),
  ]);
  return { section: formatSection(await loadSection(env, sectionId)) };
}

export async function createPortalEvent({ request, env, session }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requireString(payload.hotel_id, "unidade", { max: 120 });
  requireAdminHotelAccess(session, hotelId);
  const data = eventPayload(payload);
  data.mediaAssetId = await validateEventMedia(env, hotelId, payload.media_asset_id);
  const now = requestNow({ request, env });
  const eventId = createPublicId("event");
  await batch(env, [
    statement(
      env,
        `INSERT INTO events (
         id, hotel_id, title, summary, content, location, category, tags_json,
         starts_at, ends_at, timezone, status, media_asset_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventId, hotelId, data.title, data.summary, data.content, data.location, data.category, data.tagsJson, data.startsAt, data.endsAt, data.timezone, data.status, data.mediaAssetId, now, now],
    ),
    auditStatement(env, session, {
      hotelId,
      action: "portal-event.create",
      entityType: "event",
      entityId: eventId,
      metadata: { status: data.status, has_image: Boolean(data.mediaAssetId), tag_count: data.tags.length },
      now,
    }),
  ]);
  return { event: await loadEvent(env, eventId) };
}

export async function updatePortalEvent({ request, env, session, eventId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadEvent(env, eventId);
  if (!current) throw notFoundError("Evento nao encontrado.");
  requireAdminHotelAccess(session, current.hotel_id);
  const payload = await readJson(request);
  const data = eventPayload(payload);
  data.mediaAssetId = await validateEventMedia(env, current.hotel_id, payload.media_asset_id);
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
        `UPDATE events
          SET title = ?, summary = ?, content = ?, location = ?, category = ?, tags_json = ?,
              starts_at = ?, ends_at = ?, timezone = ?, status = ?, media_asset_id = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ?`,
      [data.title, data.summary, data.content, data.location, data.category, data.tagsJson, data.startsAt, data.endsAt, data.timezone, data.status, data.mediaAssetId, now, eventId, current.hotel_id],
    ),
    auditStatement(env, session, {
      hotelId: current.hotel_id,
      action: "portal-event.update",
      entityType: "event",
      entityId: eventId,
      metadata: { status: data.status, has_image: Boolean(data.mediaAssetId), tag_count: data.tags.length },
      now,
    }),
  ]);
  return { event: await loadEvent(env, eventId) };
}

export async function createHotelInformation({ request, env, session }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requireString(payload.hotel_id, "unidade", { max: 120 });
  requireAdminHotelAccess(session, hotelId);
  const data = informationPayload(payload);
  const now = requestNow({ request, env });
  const informationId = createPublicId("hotel_info");
  await batch(env, [
    statement(
      env,
      `INSERT INTO hotel_information (
         id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [informationId, hotelId, data.infoKey, data.title, data.body, data.isPublic, data.sortOrder, now, now],
    ),
    auditStatement(env, session, {
      hotelId,
      action: "hotel-information.create",
      entityType: "hotel_information",
      entityId: informationId,
      metadata: { info_key: data.infoKey, is_public: Boolean(data.isPublic) },
      now,
    }),
  ]);
  return { information: await loadInformation(env, informationId) };
}

export async function updateHotelInformation({ request, env, session, informationId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadInformation(env, informationId);
  if (!current) throw notFoundError("Informacao nao encontrada.");
  requireAdminHotelAccess(session, current.hotel_id);
  const data = informationPayload(await readJson(request));
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE hotel_information
          SET info_key = ?, title = ?, body = ?, is_public = ?, sort_order = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ?`,
      [data.infoKey, data.title, data.body, data.isPublic, data.sortOrder, now, informationId, current.hotel_id],
    ),
    auditStatement(env, session, {
      hotelId: current.hotel_id,
      action: "hotel-information.update",
      entityType: "hotel_information",
      entityId: informationId,
      metadata: { info_key: data.infoKey, is_public: Boolean(data.isPublic) },
      now,
    }),
  ]);
  return { information: formatInformation(await loadInformation(env, informationId)) };
}

export async function listAdminAudit({ env, session, url }) {
  requirePermission(session, ADMIN_AUDIT_READ);
  const hotelId = optionalString(url.searchParams.get("hotel_id"), "unidade", { max: 120 });
  const action = optionalString(url.searchParams.get("action"), "acao", { max: 120 });
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), 200);
  if (hotelId) requireAdminHotelAccess(session, hotelId);

  const allowedHotelIds = session.hotel_ids || [];
  const placeholders = allowedHotelIds.map(() => "?").join(", ");
  const filters = [allowedHotelIds.length ? `(a.hotel_id IS NULL OR a.hotel_id IN (${placeholders}))` : "a.hotel_id IS NULL"];
  const params = [...allowedHotelIds];
  if (hotelId) {
    filters.push("a.hotel_id = ?");
    params.push(hotelId);
  }
  if (action) {
    filters.push("a.action = ?");
    params.push(action);
  }
  params.push(limit);
  const rows = await all(
    env,
    `SELECT a.id, a.hotel_id, a.module_key, a.action, a.entity_type, a.entity_id,
            a.metadata_json, a.created_at, u.display_name AS actor_name
       FROM admin_audit_log a
       LEFT JOIN admin_users u ON u.id = a.actor_user_id
      WHERE ${filters.join(" AND ")}
      ORDER BY a.created_at DESC
      LIMIT ?`,
    params,
  );
  return {
    entries: rows.map((row) => ({
      ...row,
      actor_name: row.actor_name || "Sistema",
      metadata: parseJson(row.metadata_json, {}),
      metadata_json: undefined,
    })),
  };
}

function requireHotelId(url) {
  return requireString(url.searchParams.get("hotel_id"), "unidade", { max: 120 });
}

function pagePayload(payload) {
  const slug = requireString(payload.slug, "endereco", { max: 100 });
  if (!isSafeIdentifier(slug)) throw badRequest("Endereco da pagina invalido.");
  const status = optionalString(payload.status, "status", { max: 20 }) || "draft";
  if (!PAGE_STATUSES.has(status)) throw badRequest("Status da pagina invalido.");
  return {
    slug,
    title: requireString(payload.title, "titulo", { max: 180 }),
    summary: optionalString(payload.summary, "resumo", { max: 1000 }) || null,
    status,
    sortOrder: integer(payload.sort_order, 100),
  };
}

function sectionPayload(payload) {
  const sectionKey = requireString(payload.section_key, "identificador da secao", { max: 100 });
  if (!isSafeIdentifier(sectionKey)) throw badRequest("Identificador da secao invalido.");
  return {
    sectionKey,
    title: optionalString(payload.title, "titulo", { max: 180 }) || null,
    body: optionalString(payload.body, "conteudo", { max: 12000 }) || null,
    settingsJson: JSON.stringify(payload.settings && typeof payload.settings === "object" ? payload.settings : {}),
    sortOrder: integer(payload.sort_order, 100),
  };
}

function eventPayload(payload) {
  const startsAt = isoDate(payload.starts_at, "inicio", true);
  const endsAt = isoDate(payload.ends_at, "termino", false);
  if (endsAt && endsAt < startsAt) throw badRequest("O termino deve ser posterior ao inicio.");
  const status = optionalString(payload.status, "status", { max: 20 }) || "draft";
  if (!EVENT_STATUSES.has(status)) throw badRequest("Status do evento invalido.");
  const tags = eventTags(payload.tags);
  return {
    title: requireString(payload.title, "titulo", { max: 180 }),
    summary: optionalString(payload.summary, "resumo", { max: 2000 }) || null,
    content: optionalString(payload.content, "descricao completa", { max: 12000 }) || null,
    location: optionalString(payload.location, "local", { max: 300 }) || null,
    category: optionalString(payload.category, "categoria", { max: 120 }) || null,
    tags,
    tagsJson: JSON.stringify(tags),
    startsAt,
    endsAt,
    timezone: requireString(payload.timezone || "America/Sao_Paulo", "fuso horario", { max: 80 }),
    status,
  };
}

function eventTags(value) {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) throw badRequest("Etiquetas do evento invalidas.");
  if (value.length > 20) throw badRequest("O evento aceita no maximo 20 etiquetas.");
  const unique = new Map();
  for (const valueItem of value) {
    const tag = requireString(valueItem, "etiqueta", { max: 60 });
    const key = tag.toLocaleLowerCase("pt-BR");
    if (!unique.has(key)) unique.set(key, tag);
  }
  return [...unique.values()];
}

function informationPayload(payload) {
  const infoKey = requireString(payload.info_key, "identificador", { max: 100 });
  if (!isSafeIdentifier(infoKey)) throw badRequest("Identificador da informacao invalido.");
  return {
    infoKey,
    title: requireString(payload.title, "titulo", { max: 180 }),
    body: requireString(payload.body, "conteudo", { max: 12000 }),
    isPublic: payload.is_public === false || payload.is_public === 0 ? 0 : 1,
    sortOrder: integer(payload.sort_order, 100),
  };
}

function integer(value, fallback) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000) throw badRequest("Ordem de exibicao invalida.");
  return parsed;
}

function isoDate(value, field, required) {
  if ((value === null || value === undefined || value === "") && !required) return null;
  const raw = requireString(value, field, { max: 50 });
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw badRequest(`${field} invalido.`);
  return date.toISOString();
}

function archivedAt(status, now) {
  return status === "archived" ? now : null;
}

async function loadPage(env, pageId) {
  return first(
    env,
    `SELECT id, hotel_id, module_key, slug, title, summary, status, sort_order,
            created_at, updated_at, archived_at
       FROM portal_pages WHERE id = ? LIMIT 1`,
    [pageId],
  );
}

async function loadSection(env, sectionId) {
  return first(
    env,
    `SELECT id, page_id, hotel_id, section_key, title, body, settings_json,
            sort_order, created_at, updated_at
       FROM portal_sections WHERE id = ? LIMIT 1`,
    [sectionId],
  );
}

async function loadEvent(env, eventId) {
  return first(
    env,
    `SELECT e.id, e.hotel_id, e.title, e.summary, e.content, e.location, e.category,
            e.tags_json, e.starts_at, e.ends_at, e.timezone,
            e.status, e.media_asset_id, e.created_at, e.updated_at,
            ma.public_url AS image_url, ma.alt_text AS image_alt
       FROM events e
       LEFT JOIN media_assets ma
         ON ma.id = e.media_asset_id
        AND ma.hotel_id = e.hotel_id
        AND ma.status = 'active'
      WHERE e.id = ?
      LIMIT 1`,
    [eventId],
  ).then((row) => row ? formatEvent(row) : null);
}

async function validateEventMedia(env, hotelId, value) {
  const mediaAssetId = optionalString(value, "imagem do evento", { max: 160 }) || null;
  if (!mediaAssetId) return null;
  const media = await first(
    env,
    `SELECT id
       FROM media_assets
      WHERE id = ? AND hotel_id = ? AND status = 'active' AND mime_type LIKE 'image/%'
      LIMIT 1`,
    [mediaAssetId, hotelId],
  );
  if (!media) throw badRequest("Imagem do evento indisponivel para esta unidade.");
  return mediaAssetId;
}

async function loadInformation(env, informationId) {
  const row = await first(
    env,
    `SELECT id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at
       FROM hotel_information WHERE id = ? LIMIT 1`,
    [informationId],
  );
  return row ? formatInformation(row) : null;
}

function formatSection(row) {
  return { ...row, settings: parseJson(row.settings_json, {}), settings_json: undefined };
}

function formatInformation(row) {
  return { ...row, is_public: Boolean(row.is_public) };
}

function formatEvent(row) {
  const tags = parseJson(row.tags_json, []);
  return { ...row, tags: Array.isArray(tags) ? tags : [], tags_json: undefined };
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function auditStatement(env, session, { hotelId, action, entityType, entityId, metadata, now }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     ) VALUES (?, ?, 'guest-portal', ?, ?, ?, ?, ?, ?)`,
    [createPublicId("audit"), hotelId, session.user.id, action, entityType, entityId, JSON.stringify(metadata || {}), now],
  );
}
