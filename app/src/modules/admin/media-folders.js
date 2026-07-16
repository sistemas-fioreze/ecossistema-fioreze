import { all, batch, first, statement } from "../../core/database.js";
import { AppError, badRequest, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import { assertAdminMutationAllowed, requireAdminHotelAccess, requirePermission } from "../../services/admin-auth.js";

const READ_PERMISSION = "portals.media.read";
const UPDATE_PERMISSION = "portals.media.update";

export async function listAdminMediaFolders({ env, session, url }) {
  requirePermission(session, READ_PERMISSION);
  const hotelId = requireString(url.searchParams.get("hotel_id"), "hotel_id", { max: 80 });
  requireAdminHotelAccess(session, hotelId);
  const parentId = optionalFolderId(url.searchParams.get("parent_id"));
  const includeAll = url.searchParams.get("all") === "1";
  if (parentId) await requireFolderInHotel(env, hotelId, parentId);

  const parentFilter = includeAll ? "1 = 1" : parentId ? "f.parent_id = ?" : "f.parent_id IS NULL";
  const params = includeAll ? [hotelId] : parentId ? [hotelId, parentId] : [hotelId];
  const folders = await all(
    env,
    `SELECT f.id, f.hotel_id, f.parent_id, f.name, f.created_at, f.updated_at,
            (SELECT COUNT(*) FROM media_assets ma
              WHERE ma.folder_id = f.id AND ma.status <> 'archived') AS item_count,
            (SELECT COUNT(*) FROM media_folders child
              WHERE child.parent_id = f.id AND child.archived_at IS NULL) AS child_count
       FROM media_folders f
      WHERE f.hotel_id = ?
        AND ${parentFilter}
        AND f.archived_at IS NULL
      ORDER BY lower(f.name), f.id`,
    params,
  );

  return {
    folders: folders.map(formatFolder),
    breadcrumbs: await buildBreadcrumbs(env, hotelId, parentId),
    current_folder_id: parentId,
  };
}

export async function createAdminMediaFolder({ request, env, session }) {
  requirePermission(session, UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requireString(payload.hotel_id, "hotel_id", { max: 80 });
  const parentId = optionalFolderId(payload.parent_id);
  const name = normalizeFolderName(payload.name);
  requireAdminHotelAccess(session, hotelId);
  if (parentId) await requireFolderInHotel(env, hotelId, parentId);

  const now = requestNow({ request, env });
  const folderId = createPublicId("folder");
  try {
    await batch(env, [
      statement(
        env,
        `INSERT INTO media_folders (
           id, hotel_id, parent_id, name, created_by_user_id, updated_by_user_id,
           created_at, updated_at, archived_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [folderId, hotelId, parentId, name, session.user.id, session.user.id, now, now],
      ),
      folderAuditStatement(env, {
        hotelId,
        actorUserId: session.user.id,
        action: "media-folder.create",
        entityId: folderId,
        metadata: { parent_id: parentId, name },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isUniqueConstraint(error)) throw new AppError(409, "folder_name_conflict", "Ja existe uma pasta com esse nome neste local.");
    throw error;
  }

  return {
    folder: formatFolder({
      id: folderId,
      hotel_id: hotelId,
      parent_id: parentId,
      name,
      created_at: now,
      updated_at: now,
      item_count: 0,
      child_count: 0,
    }),
  };
}

export async function updateAdminMediaFolder({ request, env, session, folderId }) {
  requirePermission(session, UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const folder = await loadFolderForSession(env, session, folderId);
  if (!folder) throw notFoundError("Pasta não encontrada.");
  const payload = await readJson(request);
  const allowedFields = new Set(["name", "parent_id"]);
  const unknownFields = Object.keys(payload).filter((key) => !allowedFields.has(key));
  if (unknownFields.length) throw badRequest("Campos de pasta não permitidos.", { fields: unknownFields });
  const name = Object.hasOwn(payload, "name") ? normalizeFolderName(payload.name) : folder.name;
  const parentId = Object.hasOwn(payload, "parent_id") ? optionalFolderId(payload.parent_id) : folder.parent_id || null;
  if (parentId !== (folder.parent_id || null)) await assertValidFolderParent(env, folder, parentId);
  const changedFields = [];
  if (name !== folder.name) changedFields.push("name");
  if (parentId !== (folder.parent_id || null)) changedFields.push("parent_id");
  if (!changedFields.length) return { folder: formatFolder(folder), changed: false, changed_fields: [] };

  const now = requestNow({ request, env });
  try {
    await batch(env, [
      statement(
        env,
        `UPDATE media_folders
            SET name = ?, parent_id = ?, updated_by_user_id = ?, updated_at = ?
          WHERE id = ? AND hotel_id = ? AND archived_at IS NULL`,
        [name, parentId, session.user.id, now, folder.id, folder.hotel_id],
      ),
      folderAuditStatement(env, {
        hotelId: folder.hotel_id,
        actorUserId: session.user.id,
        action: changedFields.includes("parent_id") ? "media-folder.move" : "media-folder.rename",
        entityId: folder.id,
        metadata: {
          changed_fields: changedFields,
          previous_name: folder.name,
          name,
          previous_parent_id: folder.parent_id || null,
          parent_id: parentId,
        },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (isUniqueConstraint(error)) throw new AppError(409, "folder_name_conflict", "Ja existe uma pasta com esse nome neste local.");
    throw error;
  }

  return {
    folder: formatFolder({ ...folder, name, parent_id: parentId, updated_at: now }),
    changed: true,
    changed_fields: changedFields,
  };
}

export async function archiveAdminMediaFolder({ request, env, session, folderId }) {
  requirePermission(session, UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const folder = await loadFolderForSession(env, session, folderId);
  if (!folder) throw notFoundError("Pasta não encontrada.");

  const usage = await first(
    env,
    `SELECT
       (SELECT COUNT(*) FROM media_assets WHERE folder_id = ? AND status <> 'archived') AS item_count,
       (SELECT COUNT(*) FROM media_folders WHERE parent_id = ? AND archived_at IS NULL) AS child_count`,
    [folder.id, folder.id],
  );
  if (Number(usage?.item_count || 0) > 0 || Number(usage?.child_count || 0) > 0) {
    throw new AppError(409, "folder_not_empty", "Mova os itens e subpastas antes de arquivar esta pasta.");
  }

  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE media_folders
          SET archived_at = ?, updated_by_user_id = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ? AND archived_at IS NULL`,
      [now, session.user.id, now, folder.id, folder.hotel_id],
    ),
    folderAuditStatement(env, {
      hotelId: folder.hotel_id,
      actorUserId: session.user.id,
      action: "media-folder.archive",
      entityId: folder.id,
      metadata: { name: folder.name },
      createdAt: now,
    }),
  ]);
  return { folder: formatFolder({ ...folder, archived_at: now, updated_at: now }), archived: true };
}

export async function requireFolderInHotel(env, hotelId, folderId) {
  const folder = await first(
    env,
    `SELECT id, hotel_id, parent_id, name, created_at, updated_at, archived_at
       FROM media_folders
      WHERE id = ? AND hotel_id = ? AND archived_at IS NULL
      LIMIT 1`,
    [folderId, hotelId],
  );
  if (!folder) throw badRequest("Pasta de destino invalida.");
  return folder;
}

async function loadFolderForSession(env, session, folderId) {
  if (!session.hotel_ids.length) return null;
  const placeholders = session.hotel_ids.map(() => "?").join(", ");
  return first(
    env,
    `SELECT id, hotel_id, parent_id, name, created_at, updated_at, archived_at
       FROM media_folders
      WHERE id = ? AND hotel_id IN (${placeholders}) AND archived_at IS NULL
      LIMIT 1`,
    [folderId, ...session.hotel_ids],
  );
}

async function buildBreadcrumbs(env, hotelId, folderId) {
  const breadcrumbs = [];
  let currentId = folderId;
  const visited = new Set();
  while (currentId && breadcrumbs.length < 20) {
    if (visited.has(currentId)) throw new AppError(500, "folder_cycle", "Estrutura de pastas invalida.");
    visited.add(currentId);
    const folder = await requireFolderInHotel(env, hotelId, currentId);
    breadcrumbs.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id || null;
  }
  return breadcrumbs;
}

async function assertValidFolderParent(env, folder, parentId) {
  if (!parentId) return;
  let currentId = parentId;
  const visited = new Set();
  while (currentId) {
    if (currentId === folder.id) throw badRequest("Uma pasta não pode ser movida para dentro dela mesma.");
    if (visited.has(currentId) || visited.size >= 20) throw badRequest("Estrutura de pastas invalida.");
    visited.add(currentId);
    const parent = await requireFolderInHotel(env, folder.hotel_id, currentId);
    currentId = parent.parent_id || null;
  }
}

function optionalFolderId(value) {
  if (value == null || value === "" || value === "root") return null;
  const folderId = requireString(value, "folder_id", { max: 100 });
  if (!folderId.startsWith("folder_")) throw badRequest("folder_id inválido.");
  return folderId;
}

function normalizeFolderName(value) {
  const name = requireString(value, "name", { max: 80 }).replace(/\s+/g, " ");
  if (/[\\/:*?"<>|]/.test(name) || name === "." || name === "..") {
    throw badRequest("Nome de pasta inválido.");
  }
  return name;
}

function formatFolder(row) {
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    parent_id: row.parent_id || null,
    name: row.name,
    item_count: Number(row.item_count || 0),
    child_count: Number(row.child_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function folderAuditStatement(env, { hotelId, actorUserId, action, entityId, metadata, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     ) VALUES (?, ?, NULL, ?, ?, 'media_folder', ?, ?, ?)`,
    [createPublicId("audit"), hotelId, actorUserId, action, entityId, JSON.stringify(metadata || {}), createdAt],
  );
}

function isUniqueConstraint(error) {
  return String(error?.message || "").toLowerCase().includes("unique");
}
