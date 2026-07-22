import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError } from "../../core/errors.js";
import { createPublicId, isSafeIdentifier } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import { assertAdminMutationAllowed, requireAdminHotelAccess, requirePermission } from "../../services/admin-auth.js";
import {
  collectVisualPortalMediaIds,
  createBlankVisualPortalDocument,
  normalizeVisualPortalDocument,
  visualPortalTemplateDocument,
} from "../../services/visual-portal-document.js";
import { visualPortalPublicUrl } from "../visual-portals/shared.js";
import { HOTELS_READ_PERMISSION, HOTELS_SETTINGS_PERMISSION } from "./hotels.js";
import { copyMediaAssetToHotel } from "./media.js";

const PORTAL_STATUSES = new Set(["draft", "published", "archived"]);
const BLOCKED_MODULES = new Set(["admin", "room-service"]);
const RESERVED_PORTAL_SLUGS = new Set(["room-service"]);
const BUILT_IN_TEMPLATES = [
  { id: "builtin-guest-portal-classic", template_key: "guest-portal-classic", name: "Portal do Hóspede Fioreze", description: "Site completo com Início, Serviços, Eventos, Hotel, Blog e Como chegar.", builtin: true },
  { id: "builtin-showcase", template_key: "showcase", name: "Hospitalidade moderna", description: "Capa, experiências e destaques com cartões arredondados.", builtin: true },
  { id: "builtin-digital-store", template_key: "digital-store", name: "Loja digital", description: "Vitrine responsiva para produtos, presentes e experiências.", builtin: true },
  { id: "builtin-campaign", template_key: "campaign", name: "Campanha", description: "Página de conversão com mensagem e chamada principal.", builtin: true },
  { id: "builtin-events", template_key: "events", name: "Agenda e eventos", description: "Programação visual com chamadas para cada experiência.", builtin: true },
  { id: "builtin-service", template_key: "service", name: "Serviço premium", description: "Benefícios e chamada para um serviço ou experiência.", builtin: true },
  { id: "builtin-blank", template_key: "blank", name: "Página em branco", description: "Comece com uma tela totalmente livre.", builtin: true },
];

export async function listAdminVisualPortals({ request, env, session, url }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const hotelId = requireString(url.searchParams.get("hotel_id"), "unidade", { max: 120 });
  requireAdminHotelAccess(session, hotelId);
  const status = optionalString(url.searchParams.get("status"), "status", { max: 20 });
  if (status && !PORTAL_STATUSES.has(status)) throw badRequest("Status do portal invalido.");
  const moduleKey = optionalModuleKey(url.searchParams.get("module_key"));
  const filters = ["vp.hotel_id = ?"];
  const params = [hotelId];
  if (status) {
    filters.push("vp.status = ?");
    params.push(status);
  }
  if (moduleKey) {
    filters.push("vp.module_key = ?");
    params.push(moduleKey);
  }
  const rows = await all(
    env,
    `SELECT vp.id, vp.hotel_id, vp.module_key, vp.slug, vp.name, vp.title,
            vp.status, vp.draft_revision, vp.published_revision, vp.created_at,
            vp.updated_at, vp.published_at, vp.archived_at,
            h.name AS hotel_name, h.slug AS hotel_slug,
            m.name AS module_name
       FROM visual_portals vp
       JOIN hotels h ON h.id = vp.hotel_id
       JOIN modules m ON m.module_key = vp.module_key
      WHERE ${filters.join(" AND ")}
      ORDER BY CASE vp.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
               vp.updated_at DESC, vp.name`,
    params,
  );
  return { portals: rows.map((row) => formatPortal(row, { request, env })) };
}

export async function getAdminVisualPortal({ request, env, session, portalId }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const portal = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  if (!portal) throw notFoundError("Portal visual nao encontrado.");
  return { portal: formatPortal(portal, { request, env, includeDocument: true }) };
}

export async function createAdminVisualPortal({ request, env, session }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  assertAllowedFields(payload, ["hotel_id", "module_key", "slug", "name", "title", "template_key", "template_id", "document"]);
  const hotelId = requireString(payload.hotel_id, "unidade", { max: 120 });
  requireAdminHotelAccess(session, hotelId);
  const moduleKey = await requireBuilderModule(env, hotelId, payload.module_key);
  const slug = requirePortalSlug(payload.slug);
  await assertUniqueSlug(env, hotelId, slug);
  const branding = await loadHotelBranding(env, hotelId);
  const document = await resolveInitialDocument({ env, session, hotelId, moduleKey, payload, branding });
  await assertDocumentMediaOwnership(env, hotelId, document);

  const portalId = createPublicId("visual_portal");
  const versionId = createPublicId("portal_version");
  const now = requestNow({ request, env });
  const documentJson = JSON.stringify(document);
  const name = requireString(payload.name, "nome", { min: 2, max: 160 });
  const title = requireString(payload.title || payload.name, "titulo", { min: 2, max: 180 });
  await batch(env, [
    statement(
      env,
      `INSERT INTO visual_portals (
         id, hotel_id, module_key, slug, name, title, status,
         draft_document_json, published_document_json, draft_revision,
         published_revision, created_by_user_id, updated_by_user_id,
         published_by_user_id, archived_by_user_id, created_at, updated_at,
         published_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, NULL, 1, NULL, ?, ?, NULL, NULL, ?, ?, NULL, NULL)`,
      [portalId, hotelId, moduleKey, slug, name, title, documentJson, session.user.id, session.user.id, now, now],
    ),
    statement(
      env,
      `INSERT INTO visual_portal_versions (
         id, portal_id, hotel_id, revision, version_type, document_json,
         created_by_user_id, created_at
       ) VALUES (?, ?, ?, 1, 'draft', ?, ?, ?)`,
      [versionId, portalId, hotelId, documentJson, session.user.id, now],
    ),
    auditStatement(env, {
      hotelId,
      moduleKey,
      actorUserId: session.user.id,
      action: "visual-portal.create",
      entityId: portalId,
      metadata: { slug, revision: 1 },
      createdAt: now,
    }),
  ]);
  const created = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  return { portal: formatPortal(created, { request, env, includeDocument: true }) };
}

export async function updateAdminVisualPortal({ request, env, session, portalId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  if (!current) throw notFoundError("Portal visual nao encontrado.");
  if (current.status === "archived") throw badRequest("Portal arquivado nao pode ser alterado.");
  const payload = await readJson(request);
  assertAllowedFields(payload, ["slug", "name", "title", "module_key", "document", "expected_revision"]);
  if (Object.hasOwn(payload, "expected_revision") && Number(payload.expected_revision) !== Number(current.draft_revision)) {
    throw conflict("Este portal foi atualizado em outra sessao. Recarregue antes de salvar.", { current_revision: Number(current.draft_revision) });
  }
  const slug = Object.hasOwn(payload, "slug") ? requirePortalSlug(payload.slug) : current.slug;
  if (slug !== current.slug) await assertUniqueSlug(env, current.hotel_id, slug, portalId);
  const moduleKey = Object.hasOwn(payload, "module_key")
    ? await requireBuilderModule(env, current.hotel_id, payload.module_key)
    : current.module_key;
  const document = Object.hasOwn(payload, "document")
    ? normalizeVisualPortalDocument(payload.document)
    : JSON.parse(current.draft_document_json);
  await assertDocumentMediaOwnership(env, current.hotel_id, document);

  const revision = Number(current.draft_revision) + 1;
  const now = requestNow({ request, env });
  const documentJson = JSON.stringify(document);
  const name = Object.hasOwn(payload, "name") ? requireString(payload.name, "nome", { min: 2, max: 160 }) : current.name;
  const title = Object.hasOwn(payload, "title") ? requireString(payload.title, "titulo", { min: 2, max: 180 }) : current.title;
  const results = await batch(env, [
    statement(
      env,
      `UPDATE visual_portals
          SET module_key = ?, slug = ?, name = ?, title = ?,
              draft_document_json = ?, draft_revision = ?,
              updated_by_user_id = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ? AND draft_revision = ? AND status <> 'archived'`,
      [moduleKey, slug, name, title, documentJson, revision, session.user.id, now, portalId, current.hotel_id, current.draft_revision],
    ),
    statement(
      env,
      `INSERT INTO visual_portal_versions (
         id, portal_id, hotel_id, revision, version_type, document_json,
         created_by_user_id, created_at
       )
       SELECT ?, id, hotel_id, ?, 'draft', ?, ?, ?
         FROM visual_portals
        WHERE id = ? AND hotel_id = ? AND draft_revision = ?`,
      [createPublicId("portal_version"), revision, documentJson, session.user.id, now, portalId, current.hotel_id, revision],
    ),
    conditionalRevisionAuditStatement(env, {
      hotelId: current.hotel_id,
      moduleKey,
      actorUserId: session.user.id,
      action: "visual-portal.update",
      entityId: portalId,
      metadata: { slug, revision },
      createdAt: now,
      revision,
    }),
  ]);
  if (Number(results?.[0]?.meta?.changes || 0) !== 1) {
    throw conflict("O portal recebeu outra atualizacao. Recarregue e tente novamente.");
  }
  const updated = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  if (Number(updated?.draft_revision) !== revision) throw conflict("O portal recebeu outra atualizacao. Recarregue e tente novamente.");
  return { portal: formatPortal(updated, { request, env, includeDocument: true }) };
}

export async function publishAdminVisualPortal({ request, env, session, portalId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  if (!current) throw notFoundError("Portal visual nao encontrado.");
  if (current.status === "archived") throw badRequest("Portal arquivado nao pode ser publicado.");
  const document = normalizeVisualPortalDocument(JSON.parse(current.draft_document_json));
  await assertDocumentMediaOwnership(env, current.hotel_id, document);
  if (current.status === "published" && Number(current.published_revision) === Number(current.draft_revision)) {
    return { portal: formatPortal(current, { request, env, includeDocument: true }), published: false };
  }
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE visual_portals
          SET status = 'published', published_document_json = draft_document_json,
              published_revision = draft_revision, published_by_user_id = ?,
              published_at = ?, updated_by_user_id = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ? AND status <> 'archived'`,
      [session.user.id, now, session.user.id, now, portalId, current.hotel_id],
    ),
    statement(
      env,
      `INSERT OR IGNORE INTO visual_portal_versions (
         id, portal_id, hotel_id, revision, version_type, document_json,
         created_by_user_id, created_at
       ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?)`,
      [createPublicId("portal_version"), portalId, current.hotel_id, current.draft_revision, current.draft_document_json, session.user.id, now],
    ),
    auditStatement(env, {
      hotelId: current.hotel_id,
      moduleKey: current.module_key,
      actorUserId: session.user.id,
      action: "visual-portal.publish",
      entityId: portalId,
      metadata: { slug: current.slug, revision: Number(current.draft_revision) },
      createdAt: now,
    }),
  ]);
  const published = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  return { portal: formatPortal(published, { request, env, includeDocument: true }), published: true };
}

export async function duplicateAdminVisualPortal({ request, env, session, portalId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const source = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  if (!source) throw notFoundError("Portal visual nao encontrado.");
  const payload = await readJson(request);
  assertAllowedFields(payload, ["hotel_id", "module_key", "slug", "name", "title"]);
  const targetHotelId = Object.hasOwn(payload, "hotel_id")
    ? requireString(payload.hotel_id, "unidade", { max: 120 })
    : source.hotel_id;
  requireAdminHotelAccess(session, targetHotelId);
  const targetModuleKey = await requireBuilderModule(env, targetHotelId, payload.module_key || source.module_key);
  const slug = requirePortalSlug(payload.slug);
  await assertUniqueSlug(env, targetHotelId, slug);
  let document = normalizeVisualPortalDocument(JSON.parse(source.draft_document_json));
  if (targetHotelId !== source.hotel_id) {
    const mediaMap = new Map();
    for (const mediaId of collectVisualPortalMediaIds(document)) {
      const copied = await copyMediaAssetToHotel({
        request,
        env,
        session,
        assetId: mediaId,
        targetHotelId,
        moduleKey: targetModuleKey,
        folderId: null,
      });
      mediaMap.set(mediaId, copied.asset.id);
    }
    document = remapVisualPortalMedia(document, mediaMap);
  }
  const duplicateRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({
      hotel_id: targetHotelId,
      module_key: targetModuleKey,
      slug,
      name: payload.name || `${source.name} - copia`,
      title: payload.title || source.title,
      document,
    }),
  });
  return createAdminVisualPortal({ request: duplicateRequest, env, session });
}

function remapVisualPortalMedia(value, mediaMap, key = "") {
  if (Array.isArray(value)) {
    if (key === "media_asset_ids") return value.map((item) => mediaMap.get(item) || item);
    return value.map((item) => remapVisualPortalMedia(item, mediaMap));
  }
  if (!value || typeof value !== "object") {
    if (key.endsWith("media_asset_id") && typeof value === "string") return mediaMap.get(value) || value;
    return value;
  }
  return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
    entryKey,
    remapVisualPortalMedia(entryValue, mediaMap, entryKey),
  ]));
}

export async function archiveAdminVisualPortal({ request, env, session, portalId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  if (!current) throw notFoundError("Portal visual nao encontrado.");
  if (current.status === "archived") return { portal: formatPortal(current, { request, env, includeDocument: true }), archived: false };
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE visual_portals
          SET status = 'archived', archived_by_user_id = ?, archived_at = ?,
              updated_by_user_id = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ? AND status <> 'archived'`,
      [session.user.id, now, session.user.id, now, portalId, current.hotel_id],
    ),
    auditStatement(env, {
      hotelId: current.hotel_id,
      moduleKey: current.module_key,
      actorUserId: session.user.id,
      action: "visual-portal.archive",
      entityId: portalId,
      metadata: { slug: current.slug },
      createdAt: now,
    }),
  ]);
  const archived = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  return { portal: formatPortal(archived, { request, env, includeDocument: true }), archived: true };
}

export async function deleteAdminVisualPortal({ request, env, session, portalId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  if (!current) throw notFoundError("Portal visual nao encontrado.");
  if (current.status !== "archived") throw badRequest("Arquive o portal antes de exclui-lo definitivamente.");
  const now = requestNow({ request, env });
  const results = await batch(env, [
    conditionalPortalStatusAuditStatement(env, {
      hotelId: current.hotel_id,
      moduleKey: current.module_key,
      actorUserId: session.user.id,
      action: "visual-portal.delete",
      entityId: portalId,
      metadata: { slug: current.slug, permanent: true },
      createdAt: now,
      status: "archived",
    }),
    statement(
      env,
      `DELETE FROM visual_portals
        WHERE id = ? AND hotel_id = ? AND status = 'archived'`,
      [portalId, current.hotel_id],
    ),
  ]);
  if (Number(results?.[1]?.meta?.changes || 0) !== 1) {
    throw conflict("O portal foi alterado antes da exclusao. Recarregue e tente novamente.");
  }
  return { id: portalId, deleted: true };
}

export async function listAdminVisualPortalVersions({ env, session, portalId }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const portal = await loadPortalForSession({ env, session, portalId });
  if (!portal) throw notFoundError("Portal visual nao encontrado.");
  const versions = await all(
    env,
    `SELECT v.id, v.portal_id, v.revision, v.version_type, v.created_at,
            u.display_name AS created_by_name
       FROM visual_portal_versions v
       JOIN admin_users u ON u.id = v.created_by_user_id
      WHERE v.portal_id = ? AND v.hotel_id = ?
      ORDER BY v.created_at DESC, v.revision DESC
      LIMIT 80`,
    [portalId, portal.hotel_id],
  );
  return { versions };
}

export async function getAdminVisualPortalVersion({ env, session, portalId, versionId }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const portal = await loadPortalForSession({ env, session, portalId });
  if (!portal) throw notFoundError("Portal visual não encontrado.");
  const version = await first(
    env,
    `SELECT v.id, v.portal_id, v.revision, v.version_type, v.document_json,
            v.created_at, u.display_name AS created_by_name
       FROM visual_portal_versions v
       JOIN admin_users u ON u.id = v.created_by_user_id
      WHERE v.id = ? AND v.portal_id = ? AND v.hotel_id = ?
      LIMIT 1`,
    [versionId, portalId, portal.hotel_id],
  );
  if (!version) throw notFoundError("Versão do portal não encontrada.");
  return {
    version: {
      id: version.id,
      portal_id: version.portal_id,
      revision: Number(version.revision),
      version_type: version.version_type,
      created_at: version.created_at,
      created_by_name: version.created_by_name,
      document: normalizeVisualPortalDocument(JSON.parse(version.document_json)),
    },
  };
}

export async function restoreAdminVisualPortalVersion({ request, env, session, portalId, versionId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  if (!current) throw notFoundError("Portal visual nao encontrado.");
  if (current.status === "archived") throw badRequest("Portal arquivado nao pode ser restaurado.");
  const source = await first(
    env,
    `SELECT id, document_json, revision
       FROM visual_portal_versions
      WHERE id = ? AND portal_id = ? AND hotel_id = ?
      LIMIT 1`,
    [versionId, portalId, current.hotel_id],
  );
  if (!source) throw notFoundError("Versao do portal nao encontrada.");
  const document = normalizeVisualPortalDocument(JSON.parse(source.document_json));
  await assertDocumentMediaOwnership(env, current.hotel_id, document);
  const revision = Number(current.draft_revision) + 1;
  const now = requestNow({ request, env });
  const documentJson = JSON.stringify(document);
  await batch(env, [
    statement(
      env,
      `UPDATE visual_portals
          SET draft_document_json = ?, draft_revision = ?,
              updated_by_user_id = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ? AND status <> 'archived'`,
      [documentJson, revision, session.user.id, now, portalId, current.hotel_id],
    ),
    statement(
      env,
      `INSERT INTO visual_portal_versions (
         id, portal_id, hotel_id, revision, version_type, document_json,
         created_by_user_id, created_at
       ) VALUES (?, ?, ?, ?, 'restored', ?, ?, ?)`,
      [createPublicId("portal_version"), portalId, current.hotel_id, revision, documentJson, session.user.id, now],
    ),
    auditStatement(env, {
      hotelId: current.hotel_id,
      moduleKey: current.module_key,
      actorUserId: session.user.id,
      action: "visual-portal.restore",
      entityId: portalId,
      metadata: { source_revision: Number(source.revision), revision },
      createdAt: now,
    }),
  ]);
  const restored = await loadPortalForSession({ env, session, portalId, includeDocument: true });
  return { portal: formatPortal(restored, { request, env, includeDocument: true }) };
}

export async function listAdminVisualPortalTemplates({ env, session, url }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const hotelId = requireString(url.searchParams.get("hotel_id"), "unidade", { max: 120 });
  requireAdminHotelAccess(session, hotelId);
  const moduleKey = optionalModuleKey(url.searchParams.get("module_key"));
  const filters = ["hotel_id = ?", "status = 'active'"];
  const params = [hotelId];
  if (moduleKey) {
    filters.push("module_key = ?");
    params.push(moduleKey);
  }
  const templates = await all(
    env,
    `SELECT id, hotel_id, module_key, name, description, status,
            created_at, updated_at
       FROM visual_portal_templates
      WHERE ${filters.join(" AND ")}
      ORDER BY updated_at DESC, name`,
    params,
  );
  return { templates: [...BUILT_IN_TEMPLATES, ...templates.map((template) => ({ ...template, builtin: false }))] };
}

export async function getAdminVisualPortalTemplate({ env, session, templateId, url }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const hotelId = requireString(url.searchParams.get("hotel_id"), "unidade", { max: 120 });
  requireAdminHotelAccess(session, hotelId);
  const moduleKey = await requireBuilderModule(env, hotelId, url.searchParams.get("module_key"));
  const builtin = BUILT_IN_TEMPLATES.find((template) => template.id === templateId);
  if (builtin) {
    const branding = await loadHotelBranding(env, hotelId);
    return { template: { ...builtin, hotel_id: hotelId, module_key: moduleKey, document: visualPortalTemplateDocument(builtin.template_key, branding) } };
  }
  const template = await loadTemplateForSession({ env, session, templateId, includeDocument: true });
  if (!template || template.hotel_id !== hotelId || template.module_key !== moduleKey || template.status !== "active") {
    throw notFoundError("Modelo visual nao encontrado.");
  }
  return { template: { ...template, builtin: false, document: normalizeVisualPortalDocument(JSON.parse(template.document_json)) } };
}

export async function createAdminVisualPortalTemplate({ request, env, session }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  assertAllowedFields(payload, ["hotel_id", "module_key", "name", "description", "document", "source_portal_id"]);
  const hotelId = requireString(payload.hotel_id, "unidade", { max: 120 });
  requireAdminHotelAccess(session, hotelId);
  const moduleKey = await requireBuilderModule(env, hotelId, payload.module_key);
  let document;
  if (payload.source_portal_id) {
    const source = await loadPortalForSession({ env, session, portalId: payload.source_portal_id, includeDocument: true });
    if (!source || source.hotel_id !== hotelId || source.module_key !== moduleKey) throw notFoundError("Portal de origem nao encontrado.");
    document = normalizeVisualPortalDocument(JSON.parse(source.draft_document_json));
  } else {
    document = normalizeVisualPortalDocument(payload.document);
  }
  await assertDocumentMediaOwnership(env, hotelId, document);
  const templateId = createPublicId("portal_template");
  const now = requestNow({ request, env });
  const name = requireString(payload.name, "nome do modelo", { min: 2, max: 120 });
  const description = optionalString(payload.description, "descricao", { max: 500 }) || null;
  await batch(env, [
    statement(
      env,
      `INSERT INTO visual_portal_templates (
         id, hotel_id, module_key, name, description, document_json, status,
         created_by_user_id, updated_by_user_id, archived_by_user_id,
         created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL, ?, ?, NULL)`,
      [templateId, hotelId, moduleKey, name, description, JSON.stringify(document), session.user.id, session.user.id, now, now],
    ),
    auditStatement(env, {
      hotelId,
      moduleKey,
      actorUserId: session.user.id,
      action: "visual-portal-template.create",
      entityId: templateId,
      metadata: { name },
      createdAt: now,
      entityType: "visual_portal_template",
    }),
  ]);
  return { template: { id: templateId, hotel_id: hotelId, module_key: moduleKey, name, description, status: "active", builtin: false, created_at: now, updated_at: now } };
}

export async function archiveAdminVisualPortalTemplate({ request, env, session, templateId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const template = await loadTemplateForSession({ env, session, templateId });
  if (!template) throw notFoundError("Modelo visual nao encontrado.");
  if (template.status === "archived") return { template, archived: false };
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE visual_portal_templates
          SET status = 'archived', archived_by_user_id = ?, archived_at = ?,
              updated_by_user_id = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ? AND status = 'active'`,
      [session.user.id, now, session.user.id, now, templateId, template.hotel_id],
    ),
    auditStatement(env, {
      hotelId: template.hotel_id,
      moduleKey: template.module_key,
      actorUserId: session.user.id,
      action: "visual-portal-template.archive",
      entityId: templateId,
      metadata: { name: template.name },
      createdAt: now,
      entityType: "visual_portal_template",
    }),
  ]);
  return { template: { ...template, status: "archived", archived_at: now }, archived: true };
}

async function resolveInitialDocument({ env, session, hotelId, moduleKey, payload, branding }) {
  if (Object.hasOwn(payload, "document")) return normalizeVisualPortalDocument(payload.document);
  if (payload.template_id) {
    const template = await loadTemplateForSession({ env, session, templateId: payload.template_id, includeDocument: true });
    if (!template || template.hotel_id !== hotelId || template.module_key !== moduleKey || template.status !== "active") throw notFoundError("Modelo visual nao encontrado.");
    return normalizeVisualPortalDocument(JSON.parse(template.document_json));
  }
  if (payload.template_key) return visualPortalTemplateDocument(payload.template_key, branding);
  return createBlankVisualPortalDocument(branding);
}

async function requireBuilderModule(env, hotelId, value) {
  const moduleKey = requireString(value, "area", { max: 80 }).toLowerCase();
  if (!isSafeIdentifier(moduleKey) || BLOCKED_MODULES.has(moduleKey)) {
    throw badRequest("Esta area nao pode usar o construtor de portais.");
  }
  const module = await first(
    env,
    `SELECT m.module_key
       FROM modules m
       JOIN hotel_modules hm ON hm.module_key = m.module_key
      WHERE m.module_key = ? AND hm.hotel_id = ?
      LIMIT 1`,
    [moduleKey, hotelId],
  );
  if (!module) throw badRequest("A area selecionada nao pertence a esta unidade.");
  return moduleKey;
}

function optionalModuleKey(value) {
  if (value == null || value === "") return "";
  const moduleKey = String(value).trim().toLowerCase();
  if (!isSafeIdentifier(moduleKey) || BLOCKED_MODULES.has(moduleKey)) throw badRequest("Area do portal invalida.");
  return moduleKey;
}

function requirePortalSlug(value) {
  const slug = requireString(value, "endereco", { min: 2, max: 100 }).toLowerCase();
  if (!isSafeIdentifier(slug) || RESERVED_PORTAL_SLUGS.has(slug)) throw badRequest("Endereco do portal invalido.");
  return slug;
}

async function assertUniqueSlug(env, hotelId, slug, exceptId = "") {
  const duplicate = await first(
    env,
    `SELECT id FROM visual_portals
      WHERE hotel_id = ? AND lower(slug) = lower(?) AND id <> ?
      LIMIT 1`,
    [hotelId, slug, exceptId],
  );
  if (duplicate) throw conflict("Ja existe um portal visual com este endereco na unidade.");
}

async function assertDocumentMediaOwnership(env, hotelId, document) {
  const mediaIds = collectVisualPortalMediaIds(document);
  if (!mediaIds.length) return;
  const placeholders = mediaIds.map(() => "?").join(", ");
  const rows = await all(
    env,
    `SELECT id FROM media_assets
      WHERE hotel_id = ? AND status = 'active' AND id IN (${placeholders})`,
    [hotelId, ...mediaIds],
  );
  const found = new Set(rows.map((row) => row.id));
  const missing = mediaIds.filter((id) => !found.has(id));
  if (missing.length) throw badRequest("O portal referencia midias indisponiveis ou de outra unidade.", { count: missing.length });
}

function loadHotelBranding(env, hotelId) {
  return first(
    env,
    `SELECT primary_color, font_family
       FROM hotel_branding
      WHERE hotel_id = ?
      LIMIT 1`,
    [hotelId],
  );
}

function loadPortalForSession({ env, session, portalId, includeDocument = false }) {
  if (!session.hotel_ids.length) return null;
  const placeholders = session.hotel_ids.map(() => "?").join(", ");
  const documentColumns = includeDocument ? ", vp.draft_document_json, vp.published_document_json" : "";
  return first(
    env,
    `SELECT vp.id, vp.hotel_id, vp.module_key, vp.slug, vp.name, vp.title,
            vp.status, vp.draft_revision, vp.published_revision, vp.created_at,
            vp.updated_at, vp.published_at, vp.archived_at,
            h.name AS hotel_name, h.slug AS hotel_slug,
            m.name AS module_name${documentColumns}
       FROM visual_portals vp
       JOIN hotels h ON h.id = vp.hotel_id
       JOIN modules m ON m.module_key = vp.module_key
      WHERE vp.id = ? AND vp.hotel_id IN (${placeholders})
      LIMIT 1`,
    [portalId, ...session.hotel_ids],
  );
}

function loadTemplateForSession({ env, session, templateId, includeDocument = false }) {
  if (!session.hotel_ids.length) return null;
  const placeholders = session.hotel_ids.map(() => "?").join(", ");
  const documentColumn = includeDocument ? ", document_json" : "";
  return first(
    env,
    `SELECT id, hotel_id, module_key, name, description, status,
            created_at, updated_at, archived_at${documentColumn}
       FROM visual_portal_templates
      WHERE id = ? AND hotel_id IN (${placeholders})
      LIMIT 1`,
    [templateId, ...session.hotel_ids],
  );
}

function formatPortal(row, { request, env, includeDocument = false }) {
  const portal = {
    id: row.id,
    hotel_id: row.hotel_id,
    hotel_name: row.hotel_name,
    hotel_slug: row.hotel_slug,
    module_key: row.module_key,
    module_name: row.module_name,
    slug: row.slug,
    name: row.name,
    title: row.title,
    status: row.status,
    public_url: visualPortalPublicUrl({ env, request, hotelSlug: row.hotel_slug, portalSlug: row.slug }),
    draft_revision: Number(row.draft_revision),
    published_revision: row.published_revision == null ? null : Number(row.published_revision),
    has_unpublished_changes: row.published_revision == null || Number(row.published_revision) !== Number(row.draft_revision),
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at || null,
    archived_at: row.archived_at || null,
  };
  if (includeDocument) {
    portal.document = normalizeVisualPortalDocument(JSON.parse(row.draft_document_json));
    portal.published_document = row.published_document_json
      ? normalizeVisualPortalDocument(JSON.parse(row.published_document_json))
      : null;
  }
  return portal;
}

function assertAllowedFields(payload, fields) {
  const allowed = new Set(fields);
  const unknown = Object.keys(payload).filter((field) => !allowed.has(field));
  if (unknown.length) throw badRequest("Campos de portal visual nao permitidos.", { fields: unknown });
}

function auditStatement(env, { hotelId, moduleKey, actorUserId, action, entityId, metadata, createdAt, entityType = "visual_portal" }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [createPublicId("audit"), hotelId, moduleKey, actorUserId, action, entityType, entityId, JSON.stringify(metadata), createdAt],
  );
}

function conditionalPortalStatusAuditStatement(env, { hotelId, moduleKey, actorUserId, action, entityId, metadata, createdAt, status }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     )
     SELECT ?, ?, ?, ?, ?, 'visual_portal', ?, ?, ?
       FROM visual_portals
      WHERE id = ? AND hotel_id = ? AND status = ?`,
    [
      createPublicId("audit"), hotelId, moduleKey, actorUserId, action,
      entityId, JSON.stringify(metadata), createdAt, entityId, hotelId, status,
    ],
  );
}

function conditionalRevisionAuditStatement(env, { hotelId, moduleKey, actorUserId, action, entityId, metadata, createdAt, revision }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     )
     SELECT ?, ?, ?, ?, ?, 'visual_portal', ?, ?, ?
       FROM visual_portals
      WHERE id = ? AND hotel_id = ? AND draft_revision = ?`,
    [
      createPublicId("audit"), hotelId, moduleKey, actorUserId, action,
      entityId, JSON.stringify(metadata), createdAt, entityId, hotelId, revision,
    ],
  );
}
