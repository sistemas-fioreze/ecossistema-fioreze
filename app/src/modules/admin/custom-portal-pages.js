import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError } from "../../core/errors.js";
import { createPublicId, isSafeIdentifier } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import { assertAdminMutationAllowed, requireAdminHotelAccess, requirePermission } from "../../services/admin-auth.js";
import { sanitizeCustomHtml, sha256Hex } from "../../services/custom-html-sanitizer.js";
import { HOTELS_READ_PERMISSION, HOTELS_SETTINGS_PERMISSION } from "./hotels.js";

const PAGE_STATUSES = new Set(["draft", "published"]);

export async function listAdminCustomPortalPages({ request, env, session, url }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const hotelId = requireString(url.searchParams.get("hotel_id"), "unidade", { max: 120 });
  requireAdminHotelAccess(session, hotelId);
  const rows = await all(
    env,
    `SELECT cp.id, cp.hotel_id, cp.slug, cp.title, cp.content_sha256,
            cp.sanitizer_version, cp.status, cp.created_by_user_id,
            cp.updated_by_user_id, cp.archived_by_user_id, cp.created_at,
            cp.updated_at, cp.archived_at, h.name AS hotel_name, h.slug AS hotel_slug
       FROM custom_portal_pages cp
       JOIN hotels h ON h.id = cp.hotel_id
      WHERE cp.hotel_id = ?
      ORDER BY cp.updated_at DESC, cp.title`,
    [hotelId],
  );
  return { pages: rows.map((row) => formatPage(row, { request })) };
}

export async function getAdminCustomPortalPage({ request, env, session, pageId }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const page = await loadPageForSession({ env, session, pageId, includeHtml: true });
  if (!page) throw notFoundError("Pagina HTML nao encontrada.");
  return { page: formatPage(page, { request, includeHtml: true }) };
}

export async function createAdminCustomPortalPage({ request, env, session }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requireString(payload.hotel_id, "unidade", { max: 120 });
  requireAdminHotelAccess(session, hotelId);
  const data = await normalizePayload(payload);

  const duplicate = await first(
    env,
    "SELECT id FROM custom_portal_pages WHERE hotel_id = ? AND lower(slug) = lower(?) LIMIT 1",
    [hotelId, data.slug],
  );
  if (duplicate) throw conflict("Ja existe uma pagina HTML com este endereco na unidade.");

  const pageId = createPublicId("custom_page");
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `INSERT INTO custom_portal_pages (
         id, hotel_id, slug, title, sanitized_html, content_sha256,
         sanitizer_version, status, created_by_user_id, updated_by_user_id,
         archived_by_user_id, created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
      [
        pageId,
        hotelId,
        data.slug,
        data.title,
        data.html,
        data.contentSha256,
        data.sanitizerVersion,
        data.status,
        session.user.id,
        session.user.id,
        now,
        now,
      ],
    ),
    auditStatement(env, {
      hotelId,
      actorUserId: session.user.id,
      action: "custom-portal-page.create",
      entityId: pageId,
      metadata: { slug: data.slug, status: data.status, sanitizer_version: data.sanitizerVersion },
      createdAt: now,
    }),
  ]);

  const created = await loadPageForSession({ env, session, pageId, includeHtml: true });
  return {
    page: formatPage(created, { request, includeHtml: true }),
    sanitization: { changed: data.changed, version: data.sanitizerVersion },
  };
}

export async function updateAdminCustomPortalPage({ request, env, session, pageId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadPageForSession({ env, session, pageId, includeHtml: true });
  if (!current) throw notFoundError("Pagina HTML nao encontrada.");
  if (current.status === "archived") throw badRequest("Pagina arquivada nao pode ser alterada.");
  const payload = await readJson(request);
  if (Object.hasOwn(payload, "hotel_id")) throw badRequest("A unidade da pagina nao pode ser alterada.");
  const data = await normalizePayload(payload);

  const duplicate = await first(
    env,
    "SELECT id FROM custom_portal_pages WHERE hotel_id = ? AND lower(slug) = lower(?) AND id <> ? LIMIT 1",
    [current.hotel_id, data.slug, pageId],
  );
  if (duplicate) throw conflict("Ja existe uma pagina HTML com este endereco na unidade.");

  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE custom_portal_pages
          SET slug = ?, title = ?, sanitized_html = ?, content_sha256 = ?,
              sanitizer_version = ?, status = ?, updated_by_user_id = ?,
              updated_at = ?
        WHERE id = ? AND hotel_id = ? AND status <> 'archived'`,
      [
        data.slug,
        data.title,
        data.html,
        data.contentSha256,
        data.sanitizerVersion,
        data.status,
        session.user.id,
        now,
        pageId,
        current.hotel_id,
      ],
    ),
    auditStatement(env, {
      hotelId: current.hotel_id,
      actorUserId: session.user.id,
      action: "custom-portal-page.update",
      entityId: pageId,
      metadata: { slug: data.slug, status: data.status, sanitizer_version: data.sanitizerVersion },
      createdAt: now,
    }),
  ]);

  const updated = await loadPageForSession({ env, session, pageId, includeHtml: true });
  return {
    page: formatPage(updated, { request, includeHtml: true }),
    sanitization: { changed: data.changed, version: data.sanitizerVersion },
  };
}

export async function archiveAdminCustomPortalPage({ request, env, session, pageId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadPageForSession({ env, session, pageId });
  if (!current) throw notFoundError("Pagina HTML nao encontrada.");
  if (current.status === "archived") return { page: formatPage(current, { request }), archived: false };

  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE custom_portal_pages
          SET status = 'archived', archived_by_user_id = ?, archived_at = ?,
              updated_by_user_id = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ? AND status <> 'archived'`,
      [session.user.id, now, session.user.id, now, pageId, current.hotel_id],
    ),
    auditStatement(env, {
      hotelId: current.hotel_id,
      actorUserId: session.user.id,
      action: "custom-portal-page.archive",
      entityId: pageId,
      metadata: { slug: current.slug },
      createdAt: now,
    }),
  ]);
  const archived = await loadPageForSession({ env, session, pageId });
  return { page: formatPage(archived, { request }), archived: true };
}

async function normalizePayload(payload) {
  const allowed = new Set(["hotel_id", "slug", "title", "html", "status"]);
  const unknown = Object.keys(payload).filter((field) => !allowed.has(field));
  if (unknown.length) throw badRequest("Campos de pagina HTML nao permitidos.", { fields: unknown });
  const slug = requireString(payload.slug, "endereco", { min: 2, max: 100 });
  if (!isSafeIdentifier(slug)) throw badRequest("Endereco da pagina invalido.");
  const status = optionalString(payload.status, "status", { max: 20 }) || "draft";
  if (!PAGE_STATUSES.has(status)) throw badRequest("Status da pagina HTML invalido.");
  const sanitized = sanitizeCustomHtml(payload.html);
  return {
    slug,
    title: requireString(payload.title, "titulo", { max: 180 }),
    status,
    html: sanitized.html,
    changed: sanitized.changed,
    sanitizerVersion: sanitized.sanitizer_version,
    contentSha256: await sha256Hex(sanitized.html),
  };
}

async function loadPageForSession({ env, session, pageId, includeHtml = false }) {
  if (!session.hotel_ids.length) return null;
  const placeholders = session.hotel_ids.map(() => "?").join(", ");
  const htmlColumn = includeHtml ? ", cp.sanitized_html" : "";
  return first(
    env,
    `SELECT cp.id, cp.hotel_id, cp.slug, cp.title, cp.content_sha256,
            cp.sanitizer_version, cp.status, cp.created_by_user_id,
            cp.updated_by_user_id, cp.archived_by_user_id, cp.created_at,
            cp.updated_at, cp.archived_at, h.name AS hotel_name,
            h.slug AS hotel_slug${htmlColumn}
       FROM custom_portal_pages cp
       JOIN hotels h ON h.id = cp.hotel_id
      WHERE cp.id = ? AND cp.hotel_id IN (${placeholders})
      LIMIT 1`,
    [pageId, ...session.hotel_ids],
  );
}

function formatPage(row, { request, includeHtml = false }) {
  const output = {
    id: row.id,
    hotel_id: row.hotel_id,
    hotel_name: row.hotel_name,
    hotel_slug: row.hotel_slug,
    slug: row.slug,
    title: row.title,
    public_url: customPortalPagePublicUrl(request, row.hotel_slug, row.slug),
    status: row.status,
    content_sha256: row.content_sha256,
    sanitizer_version: row.sanitizer_version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at || null,
  };
  if (includeHtml) output.html = row.sanitized_html;
  return output;
}

export function customPortalPagePublicUrl(request, hotelSlug, pageSlug) {
  return `${new URL(request.url).origin}/portal-content/${hotelSlug}/${pageSlug}`;
}

function auditStatement(env, { hotelId, actorUserId, action, entityId, metadata, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     ) VALUES (?, ?, 'guest-portal', ?, ?, 'custom_portal_page', ?, ?, ?)`,
    [createPublicId("audit"), hotelId, actorUserId, action, entityId, JSON.stringify(metadata), createdAt],
  );
}
