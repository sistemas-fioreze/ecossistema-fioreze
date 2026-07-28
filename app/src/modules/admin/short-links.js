import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, conflict, forbidden, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import { assertAdminMutationAllowed, requireAdminHotelAccess, requirePermission } from "../../services/admin-auth.js";
import { createQrCodeSvg } from "../../services/qr-code.js";
import {
  EDITABLE_SHORT_LINK_STATUSES,
  assertDateWindow,
  normalizeOptionalDate,
  normalizeShortLinkSlug,
  shortLinkPublicUrl,
  shortLinkPublicUrlPreviewBase,
  summarizeDestinationUrl,
  validateDestinationUrl,
} from "../short-links/shared.js";

const READ_PERMISSION = "portals.links.read";
const CREATE_PERMISSION = "portals.links.create";
const UPDATE_PERMISSION = "portals.links.update";
const ARCHIVE_PERMISSION = "portals.links.archive";
const DELETE_PERMISSION = "portals.links.delete";
const ANALYTICS_PERMISSION = "portals.links.analytics";
const SORTS = {
  created: "created_at DESC, id DESC",
  updated: "updated_at DESC, id DESC",
  clicks: "total_clicks DESC, updated_at DESC, id DESC",
};

export async function listAdminShortLinks({ request, env, session, url }) {
  requirePermission(session, READ_PERMISSION);
  const hotelId = selectHotelForList(session, url.searchParams.get("hotel_id"));
  requireAdminHotelAccess(session, hotelId);
  const status = optionalString(url.searchParams.get("status"), "status", { max: 40 });
  const search = optionalString(url.searchParams.get("q"), "q", { max: 120 });
  const limit = parseInteger(url.searchParams.get("limit"), { defaultValue: 25, max: 100 });
  const offset = parseInteger(url.searchParams.get("offset"), { defaultValue: 0, max: 10000 });
  const sort = SORTS[url.searchParams.get("sort")] ? url.searchParams.get("sort") : "created";

  const filters = [
    "sl.hotel_id = ?",
    `(sl.created_by_user_id = ? OR EXISTS (
      SELECT 1
        FROM short_link_user_shares sls
       WHERE sls.short_link_id = sl.id
         AND sls.user_id = ?
    ))`,
  ];
  const params = [hotelId, session.user.id, session.user.id];
  if (status) {
    if (!["active", "paused", "archived"].includes(status)) throw badRequest("Status inválido.");
    filters.push("sl.status = ?");
    params.push(status);
  }
  if (search) {
    filters.push("(lower(sl.internal_name) LIKE ? OR lower(sl.slug) LIKE ? OR lower(coalesce(sl.notes, '')) LIKE ?)");
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like, like);
  }
  params.push(limit, offset);

  const rows = await all(
    env,
    `SELECT sl.*, h.name AS hotel_name, h.timezone AS hotel_timezone
       FROM short_links sl
       JOIN hotels h ON h.id = sl.hotel_id
      WHERE ${filters.join(" AND ")}
      ORDER BY ${SORTS[sort]}
      LIMIT ? OFFSET ?`,
    params,
  );

  return {
    links: rows.map((row) => formatShortLink(row, { request, env, session })),
    public_url_base: shortLinkPublicUrlPreviewBase(env, request),
    pagination: { limit, offset, count: rows.length },
  };
}

export async function createAdminShortLink({ request, env, session }) {
  requirePermission(session, CREATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const allowed = new Set(["hotel_id", "internal_name", "slug", "destination_url", "status", "starts_at", "expires_at", "notes"]);
  rejectUnknownFields(payload, allowed);

  const hotelId = requireString(payload.hotel_id, "hotel_id", { max: 80 });
  requireAdminHotelAccess(session, hotelId);
  const internalName = requireString(payload.internal_name, "internal_name", { max: 160 });
  const slug = normalizeShortLinkSlug(payload.slug);
  const status = payload.status == null || payload.status === "" ? "active" : requireString(payload.status, "status", { max: 40 });
  if (!EDITABLE_SHORT_LINK_STATUSES.has(status)) throw badRequest("Status inválido para criação.");
  const startsAt = normalizeOptionalDate(payload.starts_at, "starts_at");
  const expiresAt = normalizeOptionalDate(payload.expires_at, "expires_at");
  assertDateWindow(startsAt, expiresAt);
  const destination = validateDestinationUrl(payload.destination_url, { request, env, slug });
  const notes = optionalString(payload.notes, "notes", { max: 1000 }) || null;

  const duplicate = await first(env, "SELECT id FROM short_links WHERE lower(slug) = lower(?) LIMIT 1", [slug]);
  if (duplicate) throw conflict("Slug já cadastrado.");

  const now = requestNow({ request, env });
  const id = createPublicId("link");
  await batch(env, [
    statement(
      env,
      `INSERT INTO short_links (
         id, hotel_id, slug, internal_name, destination_url, destination_scheme, status,
         starts_at, expires_at, notes, total_clicks, last_clicked_at, created_by_user_id,
         updated_by_user_id, archived_by_user_id, created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, NULL, ?, ?, NULL)`,
      [id, hotelId, slug, internalName, destination.url, destination.scheme, status, startsAt, expiresAt, notes, session.user.id, session.user.id, now, now],
    ),
    auditStatement(env, {
      hotelId,
      actorUserId: session.user.id,
      action: "short-link.create",
      entityId: id,
      metadata: { slug, changed_fields: ["created"] },
      createdAt: now,
    }),
  ]);

  const created = await loadShortLinkForSession({ env, session, linkId: id });
  return { link: formatShortLink(created, { request, env, session }), warnings: destination.warnings };
}

export async function getAdminShortLink({ request, env, session, linkId }) {
  requirePermission(session, READ_PERMISSION);
  const link = await loadShortLinkForSession({ env, session, linkId });
  if (!link) throw notFoundError("Link não encontrado.");
  return { link: formatShortLink(link, { request, env, session }) };
}

export async function updateAdminShortLink({ request, env, session, linkId }) {
  requirePermission(session, UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadShortLinkForSession({ env, session, linkId, ownerOnly: true });
  if (!current) throw notFoundError("Link não encontrado.");
  if (current.status === "archived") throw badRequest("Link arquivado não pode ser alterado.");

  const payload = await readJson(request);
  const forbidden = ["id", "hotel_id", "slug", "created_by_user_id", "created_at", "total_clicks", "last_clicked_at"];
  const allowed = new Set(["internal_name", "destination_url", "status", "starts_at", "expires_at", "notes"]);
  const forbiddenFields = forbidden.filter((field) => Object.hasOwn(payload, field));
  if (forbiddenFields.length) throw badRequest("Campos imutáveis não podem ser alterados.", { fields: forbiddenFields });
  rejectUnknownFields(payload, allowed);

  let internalName = current.internal_name;
  let destinationUrl = current.destination_url;
  let destinationScheme = current.destination_scheme;
  let status = current.status;
  let startsAt = current.starts_at || null;
  let expiresAt = current.expires_at || null;
  let notes = current.notes || null;
  const changedFields = [];
  let warnings = [];

  if (Object.hasOwn(payload, "internal_name")) {
    internalName = requireString(payload.internal_name, "internal_name", { max: 160 });
    if (internalName !== current.internal_name) changedFields.push("internal_name");
  }
  if (Object.hasOwn(payload, "destination_url")) {
    const destination = validateDestinationUrl(payload.destination_url, { request, env, slug: current.slug });
    destinationUrl = destination.url;
    destinationScheme = destination.scheme;
    warnings = destination.warnings;
    if (destinationUrl !== current.destination_url) changedFields.push("destination_url");
  }
  if (Object.hasOwn(payload, "status")) {
    status = requireString(payload.status, "status", { max: 40 });
    if (!EDITABLE_SHORT_LINK_STATUSES.has(status)) throw badRequest("Status inválido.");
    if (status !== current.status) changedFields.push("status");
  }
  if (Object.hasOwn(payload, "starts_at")) {
    startsAt = normalizeOptionalDate(payload.starts_at, "starts_at");
    if ((startsAt || null) !== (current.starts_at || null)) changedFields.push("starts_at");
  }
  if (Object.hasOwn(payload, "expires_at")) {
    expiresAt = normalizeOptionalDate(payload.expires_at, "expires_at");
    if ((expiresAt || null) !== (current.expires_at || null)) changedFields.push("expires_at");
  }
  if (Object.hasOwn(payload, "notes")) {
    notes = optionalString(payload.notes, "notes", { max: 1000 }) || null;
    if ((notes || null) !== (current.notes || null)) changedFields.push("notes");
  }
  assertDateWindow(startsAt, expiresAt);

  if (!changedFields.length) {
    return { link: formatShortLink(current, { request, env, session }), changed_fields: [], warnings };
  }

  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE short_links
          SET internal_name = ?,
              destination_url = ?,
              destination_scheme = ?,
              status = ?,
              starts_at = ?,
              expires_at = ?,
              notes = ?,
              updated_by_user_id = ?,
              updated_at = ?
        WHERE id = ?
          AND hotel_id = ?
          AND status <> 'archived'`,
      [internalName, destinationUrl, destinationScheme, status, startsAt, expiresAt, notes, session.user.id, now, current.id, current.hotel_id],
    ),
    auditStatement(env, {
      hotelId: current.hotel_id,
      actorUserId: session.user.id,
      action: "short-link.update",
      entityId: current.id,
      metadata: { slug: current.slug, changed_fields: changedFields },
      createdAt: now,
    }),
  ]);

  const updated = await loadShortLinkForSession({ env, session, linkId });
  return { link: formatShortLink(updated, { request, env, session }), changed_fields: changedFields, warnings };
}

export async function archiveAdminShortLink({ request, env, session, linkId }) {
  requirePermission(session, ARCHIVE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadShortLinkForSession({ env, session, linkId, ownerOnly: true });
  if (!current) throw notFoundError("Link não encontrado.");
  if (current.status === "archived") return { link: formatShortLink(current, { request, env, session }), archived: false };

  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE short_links
          SET status = 'archived',
              archived_at = ?,
              archived_by_user_id = ?,
              updated_by_user_id = ?,
              updated_at = ?
        WHERE id = ?
          AND hotel_id = ?
          AND status <> 'archived'`,
      [now, session.user.id, session.user.id, now, current.id, current.hotel_id],
    ),
    auditStatement(env, {
      hotelId: current.hotel_id,
      actorUserId: session.user.id,
      action: "short-link.archive",
      entityId: current.id,
      metadata: { slug: current.slug, changed_fields: ["status", "archived_at"] },
      createdAt: now,
    }),
  ]);

  const archived = await loadShortLinkForSession({ env, session, linkId });
  return { link: formatShortLink(archived, { request, env, session }), archived: true };
}

export async function deleteAdminShortLink({ request, env, session, linkId }) {
  requirePermission(session, DELETE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadShortLinkForSession({ env, session, linkId, ownerOnly: true });
  if (!current) throw notFoundError("Link não encontrado.");
  if (current.status !== "archived") {
    throw conflict("Arquive o link antes de excluí-lo definitivamente.");
  }

  const now = requestNow({ request, env });
  const results = await batch(env, [
    deleteAuditStatement(env, {
      hotelId: current.hotel_id,
      actorUserId: session.user.id,
      entityId: current.id,
      slug: current.slug,
      createdAt: now,
    }),
    statement(env, "DELETE FROM short_links WHERE id = ? AND hotel_id = ? AND status = 'archived'", [current.id, current.hotel_id]),
  ]);
  if (Number(results[1]?.meta?.changes || 0) !== 1) throw conflict("O link não pode ser excluído no estado atual.");
  return { id: current.id, slug: current.slug, deleted: true };
}

export async function getAdminShortLinkQrCode({ request, env, session, linkId, url }) {
  requirePermission(session, READ_PERMISSION);
  const link = await loadShortLinkForSession({ env, session, linkId });
  if (!link) throw notFoundError("Link não encontrado.");
  const publicUrl = shortLinkPublicUrl({ env, request, slug: link.slug });
  const headers = new Headers({
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "x-content-type-options": "nosniff",
  });
  if (url.searchParams.get("download") === "1") {
    headers.set("content-disposition", `attachment; filename="qr-${link.slug}.svg"`);
  }
  return new Response(createQrCodeSvg(publicUrl), { status: 200, headers });
}

export async function getAdminShortLinkAnalytics({ request, env, session, linkId, url }) {
  requirePermission(session, ANALYTICS_PERMISSION);
  const link = await loadShortLinkForSession({ env, session, linkId });
  if (!link) throw notFoundError("Link não encontrado.");
  const now = requestNow({ request, env });
  const period = analyticsPeriod(url, now);
  const regionSearch = optionalString(url.searchParams.get("region"), "region", { max: 80 }).toLowerCase();
  const regionLike = regionSearch ? `%${regionSearch}%` : null;
  const visitorParams = [link.id, period.from, period.to, regionLike, regionLike];
  const visitorWhere = `short_link_id = ? AND click_date BETWEEN ? AND ?
    AND (? IS NULL OR lower(coalesce(region, '')) LIKE ?)`;
  const [dailyRows, visitorSummary, locationRows, hourlyRows, recentRows] = await Promise.all([
    all(
      env,
      `SELECT click_date,
              COUNT(DISTINCT visitor_hash) AS click_count,
              MIN(first_clicked_at) AS first_clicked_at,
              MAX(last_clicked_at) AS last_clicked_at
         FROM short_link_click_visitors
        WHERE ${visitorWhere}
        GROUP BY click_date
        ORDER BY click_date ASC`,
      visitorParams,
    ),
    first(
      env,
      `SELECT COUNT(DISTINCT visitor_hash) AS unique_visitors,
              coalesce(SUM(click_count), 0) AS total_attempts
         FROM short_link_click_visitors
        WHERE ${visitorWhere}`,
      visitorParams,
    ),
    all(
      env,
      `SELECT coalesce(country_code, 'Nao informado') AS country_code,
              coalesce(region, 'Nao informado') AS region,
              COUNT(DISTINCT visitor_hash) AS unique_clicks,
              SUM(click_count) AS total_attempts,
              MAX(last_clicked_at) AS last_clicked_at
         FROM short_link_click_visitors
        WHERE ${visitorWhere}
        GROUP BY coalesce(country_code, 'Nao informado'), coalesce(region, 'Nao informado')
        ORDER BY unique_clicks DESC, total_attempts DESC, last_clicked_at DESC
        LIMIT 12`,
      visitorParams,
    ),
    all(
      env,
      `SELECT substr(first_clicked_at, 12, 2) AS hour,
              COUNT(DISTINCT visitor_hash) AS unique_clicks,
              SUM(click_count) AS total_attempts
         FROM short_link_click_visitors
        WHERE ${visitorWhere}
        GROUP BY substr(first_clicked_at, 12, 2)
        ORDER BY hour ASC`,
      visitorParams,
    ),
    all(
      env,
      `SELECT click_date, first_clicked_at, last_clicked_at, click_count,
              country_code, region
         FROM short_link_click_visitors
        WHERE ${visitorWhere}
        ORDER BY last_clicked_at DESC
        LIMIT 20`,
      visitorParams,
    ),
  ]);
  const uniqueVisitors = Number(visitorSummary?.unique_visitors || 0);
  const totalAttempts = Number(visitorSummary?.total_attempts || 0);
  return {
    analytics: {
      link_id: link.id,
      hotel_id: link.hotel_id,
      slug: link.slug,
      total_clicks: Number(link.total_clicks || 0),
      unique_clicks: dailyRows.reduce((sum, row) => sum + Number(row.click_count || 0), 0),
      tracked_unique_visitors: uniqueVisitors,
      repeated_opens: Math.max(0, totalAttempts - uniqueVisitors),
      last_clicked_at: link.last_clicked_at || null,
      period,
      last_7_days: sumSince(dailyRows, now, 7),
      last_30_days: sumSince(dailyRows, now, 30),
      daily: dailyRows.map((row) => ({
        date: row.click_date,
        clicks: Number(row.click_count || 0),
        first_clicked_at: row.first_clicked_at,
        last_clicked_at: row.last_clicked_at,
      })),
      locations: locationRows.map((row) => ({
        country_code: row.country_code,
        region: row.region,
        unique_clicks: Number(row.unique_clicks || 0),
        total_attempts: Number(row.total_attempts || 0),
        last_clicked_at: row.last_clicked_at || null,
      })),
      hourly: hourlyRows.map((row) => ({
        hour: row.hour,
        unique_clicks: Number(row.unique_clicks || 0),
        total_attempts: Number(row.total_attempts || 0),
      })),
      recent_visits: recentRows.map((row) => ({
        date: row.click_date,
        first_clicked_at: row.first_clicked_at,
        last_clicked_at: row.last_clicked_at,
        repeat_count: Number(row.click_count || 0),
        country_code: row.country_code || null,
        region: row.region || null,
      })),
    },
  };
}

export async function resetAdminShortLinkAnalytics({ request, env, session, linkId }) {
  requirePermission(session, ANALYTICS_PERMISSION);
  requirePermission(session, UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const link = await loadShortLinkForSession({ env, session, linkId, ownerOnly: true });
  if (!link) throw notFoundError("Link não encontrado.");
  if (link.analytics_reset_at) throw conflict("As métricas deste link já foram zeradas uma vez.");

  const payload = await readJson(request);
  rejectUnknownFields(payload, new Set(["slug"]));
  if (requireString(payload.slug, "slug", { max: 64 }) !== link.slug) {
    throw badRequest("Confirmação do link inválida.");
  }

  const now = requestNow({ request, env });
  const resetNonce = createPublicId("reset");
  const auditId = createPublicId("audit");
  const results = await batch(env, [
    statement(
      env,
      `UPDATE short_links
          SET total_clicks = 0,
              last_clicked_at = NULL,
              analytics_reset_at = ?,
              analytics_reset_by_user_id = ?,
              analytics_reset_nonce = ?,
              updated_by_user_id = ?,
              updated_at = ?
        WHERE id = ?
          AND hotel_id = ?
          AND analytics_reset_at IS NULL`,
      [now, session.user.id, resetNonce, session.user.id, now, link.id, link.hotel_id],
    ),
    statement(
      env,
      `DELETE FROM short_link_clicks_daily
        WHERE short_link_id = ?
          AND EXISTS (SELECT 1 FROM short_links WHERE id = ? AND analytics_reset_nonce = ?)`,
      [link.id, link.id, resetNonce],
    ),
    statement(
      env,
      `DELETE FROM short_link_click_visitors
        WHERE short_link_id = ?
          AND EXISTS (SELECT 1 FROM short_links WHERE id = ? AND analytics_reset_nonce = ?)`,
      [link.id, link.id, resetNonce],
    ),
    statement(
      env,
      `DELETE FROM short_link_unique_visitors
        WHERE short_link_id = ?
          AND EXISTS (SELECT 1 FROM short_links WHERE id = ? AND analytics_reset_nonce = ?)`,
      [link.id, link.id, resetNonce],
    ),
    statement(
      env,
      `INSERT INTO admin_audit_log (
         id, hotel_id, module_key, actor_user_id, action, entity_type,
         entity_id, metadata_json, created_at
       )
       SELECT ?, sl.hotel_id, NULL, ?, 'short-link.analytics-reset', 'short_link',
              sl.id, ?, ?
         FROM short_links sl
        WHERE sl.id = ? AND sl.analytics_reset_nonce = ?`,
      [auditId, session.user.id, JSON.stringify({ slug: link.slug, reset_once: true }), now, link.id, resetNonce],
    ),
  ]);
  if (Number(results[0]?.meta?.changes || 0) !== 1) {
    throw conflict("As métricas deste link já foram zeradas uma vez.");
  }
  const updated = await loadShortLinkForSession({ env, session, linkId });
  return { link: formatShortLink(updated, { request, env, session }), reset: true };
}

export async function listAdminShortLinkShares({ env, session, linkId }) {
  requirePermission(session, UPDATE_PERMISSION);
  const link = await loadShortLinkForSession({ env, session, linkId, ownerOnly: true });
  if (!link) throw notFoundError("Link não encontrado.");

  const users = await all(
    env,
    `SELECT u.id, u.display_name, u.email,
            CASE WHEN sls.user_id IS NULL THEN 0 ELSE 1 END AS shared
       FROM admin_users u
       JOIN admin_hotel_access aha
         ON aha.user_id = u.id
        AND aha.hotel_id = ?
       LEFT JOIN short_link_user_shares sls
         ON sls.short_link_id = ?
        AND sls.user_id = u.id
      WHERE u.status = 'active'
        AND u.id <> ?
      ORDER BY lower(u.display_name), lower(u.email), u.id`,
    [link.hotel_id, link.id, session.user.id],
  );

  return {
    link_id: link.id,
    users: users.map((user) => ({
      id: user.id,
      display_name: user.display_name,
      email: user.email,
      shared: Number(user.shared || 0) === 1,
    })),
  };
}

export async function shareAdminShortLink({ request, env, session, linkId }) {
  requirePermission(session, UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const link = await loadShortLinkForSession({ env, session, linkId, ownerOnly: true });
  if (!link) throw notFoundError("Link não encontrado.");
  const payload = await readJson(request);
  rejectUnknownFields(payload, new Set(["user_id"]));
  const userId = requireString(payload.user_id, "user_id", { max: 120 });
  if (userId === session.user.id) throw badRequest("O proprietário já possui acesso ao link.");

  const target = await first(
    env,
    `SELECT u.id, u.display_name, u.email
       FROM admin_users u
       JOIN admin_hotel_access aha
         ON aha.user_id = u.id
        AND aha.hotel_id = ?
      WHERE u.id = ?
        AND u.status = 'active'
      LIMIT 1`,
    [link.hotel_id, userId],
  );
  if (!target) throw forbidden("O usuário não pertence a esta unidade.");

  const existing = await first(
    env,
    "SELECT user_id FROM short_link_user_shares WHERE short_link_id = ? AND user_id = ? LIMIT 1",
    [link.id, userId],
  );
  if (existing) return { link_id: link.id, user_id: userId, shared: false };

  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `INSERT INTO short_link_user_shares (
         short_link_id, user_id, shared_by_user_id, access_level, created_at
       ) VALUES (?, ?, ?, 'viewer', ?)`,
      [link.id, userId, session.user.id, now],
    ),
    auditStatement(env, {
      hotelId: link.hotel_id,
      actorUserId: session.user.id,
      action: "short-link.share",
      entityId: link.id,
      metadata: { shared_user_id: userId, access_level: "viewer" },
      createdAt: now,
    }),
  ]);
  return { link_id: link.id, user_id: userId, shared: true };
}

export async function revokeAdminShortLinkShare({ request, env, session, linkId, userId }) {
  requirePermission(session, UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const link = await loadShortLinkForSession({ env, session, linkId, ownerOnly: true });
  if (!link) throw notFoundError("Link não encontrado.");
  const safeUserId = requireString(userId, "user_id", { max: 120 });
  const existing = await first(
    env,
    "SELECT user_id FROM short_link_user_shares WHERE short_link_id = ? AND user_id = ? LIMIT 1",
    [link.id, safeUserId],
  );
  if (!existing) return { link_id: link.id, user_id: safeUserId, revoked: false };

  const now = requestNow({ request, env });
  const results = await batch(env, [
    statement(env, "DELETE FROM short_link_user_shares WHERE short_link_id = ? AND user_id = ?", [link.id, safeUserId]),
    auditStatement(env, {
      hotelId: link.hotel_id,
      actorUserId: session.user.id,
      action: "short-link.share-revoke",
      entityId: link.id,
      metadata: { shared_user_id: safeUserId },
      createdAt: now,
    }),
  ]);
  return { link_id: link.id, user_id: safeUserId, revoked: Number(results[0]?.meta?.changes || 0) === 1 };
}

async function loadShortLinkForSession({ env, session, linkId, ownerOnly = false }) {
  if (!session.hotel_ids.length) return null;
  const placeholders = session.hotel_ids.map(() => "?").join(", ");
  const accessFilter = ownerOnly
    ? "AND sl.created_by_user_id = ?"
    : `AND (sl.created_by_user_id = ? OR EXISTS (
         SELECT 1
           FROM short_link_user_shares sls
          WHERE sls.short_link_id = sl.id
            AND sls.user_id = ?
       ))`;
  return first(
    env,
    `SELECT sl.*, h.name AS hotel_name, h.timezone AS hotel_timezone
       FROM short_links sl
       JOIN hotels h ON h.id = sl.hotel_id
      WHERE sl.id = ?
        AND sl.hotel_id IN (${placeholders})
        ${accessFilter}
      LIMIT 1`,
    [linkId, ...session.hotel_ids, session.user.id, ...(ownerOnly ? [] : [session.user.id])],
  );
}

function selectHotelForList(session, requestedHotelId) {
  const requested = optionalString(requestedHotelId, "hotel_id", { max: 80 });
  if (requested) return requested;
  const hotel = session.hotel_ids[0];
  if (!hotel) throw notFoundError("Hotel não encontrado.");
  return hotel;
}

function formatShortLink(row, { request, env, session }) {
  const owner = row.created_by_user_id === session.user.id;
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    hotel_name: row.hotel_name || null,
    hotel_timezone: row.hotel_timezone || null,
    slug: row.slug,
    internal_name: row.internal_name,
    public_url: shortLinkPublicUrl({ env, request, slug: row.slug }),
    destination_url: row.destination_url,
    destination_summary: summarizeDestinationUrl(row.destination_url),
    destination_scheme: row.destination_scheme,
    status: row.status,
    starts_at: row.starts_at || null,
    expires_at: row.expires_at || null,
    notes: row.notes || null,
    total_clicks: Number(row.total_clicks || 0),
    last_clicked_at: row.last_clicked_at || null,
    analytics_reset_available: !row.analytics_reset_at,
    analytics_reset_at: row.analytics_reset_at || null,
    created_by_user_id: row.created_by_user_id,
    updated_by_user_id: row.updated_by_user_id,
    archived_by_user_id: row.archived_by_user_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at || null,
    access_level: owner ? "owner" : "viewer",
    can_manage: owner,
  };
}

function rejectUnknownFields(payload, allowed) {
  const unknownFields = Object.keys(payload).filter((key) => !allowed.has(key));
  if (unknownFields.length) throw badRequest("Campos de link não permitidos.", { fields: unknownFields });
}

function parseInteger(value, { defaultValue, max }) {
  if (value == null || value === "") return defaultValue;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > max) throw badRequest("Paginação inválida.");
  return number;
}

function analyticsPeriod(url, nowIso) {
  const to = parseAnalyticsDate(url.searchParams.get("to"), "to") || nowIso.slice(0, 10);
  const fromDefault = new Date(`${to}T00:00:00.000Z`);
  fromDefault.setUTCDate(fromDefault.getUTCDate() - 29);
  const from = parseAnalyticsDate(url.searchParams.get("from"), "from") || fromDefault.toISOString().slice(0, 10);
  if (from > to) throw badRequest("O início do período deve ser anterior ao fim.");
  const days = Math.floor((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000);
  if (days > 365) throw badRequest("O período máximo para consulta é de 366 dias.");
  return { from, to };
}

function parseAnalyticsDate(value, label) {
  if (value == null || value === "") return "";
  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00.000Z`))) {
    throw badRequest(`${label} deve ser uma data válida.`);
  }
  return normalized;
}

function sumSince(rows, nowIso, days) {
  const start = new Date(nowIso);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startDay = start.toISOString().slice(0, 10);
  return rows.filter((row) => row.click_date >= startDay).reduce((sum, row) => sum + Number(row.click_count || 0), 0);
}

function auditStatement(env, { hotelId, actorUserId, action, entityId, metadata, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     ) VALUES (?, ?, NULL, ?, ?, 'short_link', ?, ?, ?)`,
    [createPublicId("audit"), hotelId, actorUserId, action, entityId, JSON.stringify(metadata), createdAt],
  );
}

function deleteAuditStatement(env, { hotelId, actorUserId, entityId, slug, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     )
     SELECT ?, sl.hotel_id, NULL, ?, 'short-link.delete', 'short_link',
            sl.id, ?, ?
       FROM short_links sl
      WHERE sl.id = ? AND sl.hotel_id = ? AND sl.status = 'archived'`,
    [
      createPublicId("audit"),
      actorUserId,
      JSON.stringify({ slug, deleted: true }),
      createdAt,
      entityId,
      hotelId,
    ],
  );
}
