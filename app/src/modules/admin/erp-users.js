import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { readJson, requireArray, requireString } from "../../core/validation.js";
import { assertAdminMutationAllowed, hashPassword, requireAdminHotelAccess, requirePermission } from "../../services/admin-auth.js";
import { ERP_PERMISSION_DEFINITIONS, erpActorIds } from "../../services/erp-auth.js";

const MODULE_KEY = "room-service";
const MANAGE_PERMISSION = "room-service.users.manage";
const ALLOWED_PERMISSION_KEYS = new Set(ERP_PERMISSION_DEFINITIONS.map((entry) => entry.key));

export function listRoomServiceErpPermissionDefinitions({ session }) {
  requirePermission(session, MANAGE_PERMISSION);
  return { permissions: ERP_PERMISSION_DEFINITIONS };
}

export async function listRoomServiceErpUsers({ env, session, url }) {
  requirePermission(session, MANAGE_PERMISSION);
  const hotelId = requestedHotel(session, url.searchParams.get("hotel_id"));
  const [users, permissions] = await Promise.all([
    all(
      env,
      `SELECT id, hotel_id, user_code, display_name, status, avatar_media_asset_id,
              avatar_updated_at, created_at, updated_at
         FROM erp_users
        WHERE hotel_id = ?
          AND status != 'archived'
        ORDER BY user_code`,
      [hotelId],
    ),
    all(
      env,
      `SELECT user_id, permission_key
         FROM erp_user_permissions
        WHERE hotel_id = ?
        ORDER BY user_id, permission_key`,
      [hotelId],
    ),
  ]);
  const byUser = groupPermissions(permissions);
  return {
    hotel_id: hotelId,
    users: users.map((user) => ({ ...user, user_code: Number(user.user_code), permissions: byUser.get(user.id) || [] })),
  };
}

export async function createRoomServiceErpUser({ request, env, session }) {
  requirePermission(session, MANAGE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const displayName = requireString(payload.display_name, "display_name", { min: 2, max: 120 });
  const password = requireString(payload.password, "password", { min: 4, max: 300 });
  const permissionKeys = normalizePermissions(payload.permission_keys);
  const next = await first(
    env,
    `SELECT COALESCE(MAX(user_code), 0) + 1 AS next_code
       FROM erp_users
      WHERE hotel_id = ?`,
    [hotelId],
  );
  const userCode = Number(next?.next_code || 1);
  const userId = createPublicId("erpusr");
  const now = requestNow({ request, env });
  const passwordHash = await hashPassword(password);

  try {
    await batch(env, [
      statement(
        env,
        `INSERT INTO erp_users (
           id, hotel_id, user_code, display_name, password_hash, password_strategy,
           status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'pbkdf2', 'active', ?, ?)`,
        [userId, hotelId, userCode, displayName, passwordHash, now, now],
      ),
      ...permissionKeys.map((permissionKey) => permissionStatement(env, userId, hotelId, permissionKey, now)),
      auditStatement(env, session, {
        hotelId,
        action: "room-service.erp_user.created",
        entityId: userId,
        metadata: { user_code: userCode, permission_keys: permissionKeys },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (/unique constraint failed.*erp_users.*user_code/i.test(String(error?.message || ""))) {
      throw conflict("Outro usuario foi cadastrado ao mesmo tempo. Tente novamente.");
    }
    throw error;
  }

  return { user: await loadUser(env, hotelId, userId) };
}

export async function updateRoomServiceErpUser({ request, env, session, userId }) {
  requirePermission(session, MANAGE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const current = await requireUser(env, hotelId, userId);
  const displayName = requireString(payload.display_name ?? current.display_name, "display_name", { min: 2, max: 120 });
  const status = normalizeStatus(payload.status ?? current.status);
  const permissionKeys = normalizePermissions(payload.permission_keys);
  if (session.auth_source === "erp" && session.user.id === userId && status !== "active") {
    throw badRequest("O usuario da sessao atual nao pode desativar a si proprio.");
  }
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE erp_users
          SET display_name = ?, status = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ?`,
      [displayName, status, now, userId, hotelId],
    ),
    statement(env, "DELETE FROM erp_user_permissions WHERE user_id = ? AND hotel_id = ?", [userId, hotelId]),
    ...permissionKeys.map((permissionKey) => permissionStatement(env, userId, hotelId, permissionKey, now)),
    ...(status === "active"
      ? []
      : [statement(env, "UPDATE erp_sessions SET revoked_at = ? WHERE user_id = ? AND hotel_id = ? AND revoked_at IS NULL", [now, userId, hotelId])]),
    auditStatement(env, session, {
      hotelId,
      action: "room-service.erp_user.updated",
      entityId: userId,
      metadata: { status, permission_keys: permissionKeys },
      createdAt: now,
    }),
  ]);
  return { user: await loadUser(env, hotelId, userId) };
}

export async function resetRoomServiceErpUserPassword({ request, env, session, userId }) {
  requirePermission(session, MANAGE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  await requireUser(env, hotelId, userId);
  const password = requireString(payload.password, "password", { min: 4, max: 300 });
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE erp_users
          SET password_hash = ?, password_strategy = 'pbkdf2', updated_at = ?
        WHERE id = ? AND hotel_id = ?`,
      [await hashPassword(password), now, userId, hotelId],
    ),
    statement(env, "UPDATE erp_sessions SET revoked_at = ? WHERE user_id = ? AND hotel_id = ? AND revoked_at IS NULL", [now, userId, hotelId]),
    auditStatement(env, session, {
      hotelId,
      action: "room-service.erp_user.password_reset",
      entityId: userId,
      metadata: { sessions_revoked: true },
      createdAt: now,
    }),
  ]);
  return { password_reset: true, sessions_revoked: true };
}

function requestedHotel(session, value) {
  const hotelId = requireString(value, "hotel_id", { max: 80 });
  requireAdminHotelAccess(session, hotelId);
  return hotelId;
}

function normalizePermissions(value) {
  const permissionKeys = [...new Set(requireArray(value, "permission_keys", { min: 1, max: ERP_PERMISSION_DEFINITIONS.length }).map((entry) => requireString(entry, "permission_key", { max: 100 })))];
  const invalid = permissionKeys.find((permissionKey) => !ALLOWED_PERMISSION_KEYS.has(permissionKey));
  if (invalid) throw badRequest("Permissao do ERP invalida.");
  if (permissionKeys.includes("room-service.orders.write") && !permissionKeys.includes("room-service.orders.read")) {
    permissionKeys.push("room-service.orders.read");
  }
  return permissionKeys.sort();
}

function normalizeStatus(value) {
  const status = requireString(value, "status", { max: 20 });
  if (!["active", "disabled"].includes(status)) throw badRequest("Status de usuario invalido.");
  return status;
}

async function requireUser(env, hotelId, userId) {
  const user = await first(
    env,
    `SELECT id, hotel_id, user_code, display_name, status, avatar_media_asset_id,
            avatar_updated_at, created_at, updated_at
       FROM erp_users
      WHERE id = ? AND hotel_id = ? AND status != 'archived'
      LIMIT 1`,
    [userId, hotelId],
  );
  if (!user) throw notFoundError("Usuario do ERP nao encontrado.");
  return user;
}

async function loadUser(env, hotelId, userId) {
  const user = await requireUser(env, hotelId, userId);
  const permissions = await all(
    env,
    `SELECT permission_key
       FROM erp_user_permissions
      WHERE user_id = ? AND hotel_id = ?
      ORDER BY permission_key`,
    [userId, hotelId],
  );
  return { ...user, user_code: Number(user.user_code), permissions: permissions.map((entry) => entry.permission_key) };
}

function groupPermissions(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, []);
    grouped.get(row.user_id).push(row.permission_key);
  }
  return grouped;
}

function permissionStatement(env, userId, hotelId, permissionKey, createdAt) {
  return statement(
    env,
    `INSERT INTO erp_user_permissions (user_id, hotel_id, permission_key, created_at)
     VALUES (?, ?, ?, ?)`,
    [userId, hotelId, permissionKey, createdAt],
  );
}

function auditStatement(env, session, { hotelId, action, entityId, metadata, createdAt }) {
  const actor = erpActorIds(session);
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, actor_erp_user_id,
       action, entity_type, entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'erp_user', ?, ?, ?)`,
    [
      createPublicId("audit"),
      hotelId,
      MODULE_KEY,
      actor.adminUserId,
      actor.erpUserId,
      action,
      entityId,
      JSON.stringify(metadata || {}),
      createdAt,
    ],
  );
}
