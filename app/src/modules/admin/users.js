import { all, batch, first, run, statement } from "../../core/database.js";
import { AppError, badRequest, conflict, forbidden, notFoundError } from "../../core/errors.js";
import { createPublicId, isSafeIdentifier } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireArray, requireString } from "../../core/validation.js";
import {
  assertAdminMutationAllowed,
  clearSessionCookieHeaders,
  hashPassword,
  requirePermission,
  verifyPassword,
} from "../../services/admin-auth.js";

export const ADMIN_USERS_READ = "admin.users.read";
export const ADMIN_USERS_CREATE = "admin.users.create";
export const ADMIN_USERS_UPDATE = "admin.users.update";
export const ADMIN_USERS_DISABLE = "admin.users.disable";
export const ADMIN_USERS_PASSWORD_RESET = "admin.users.password_reset";
export const ADMIN_USERS_SESSIONS_REVOKE = "admin.users.sessions_revoke";
export const ADMIN_ROLES_READ = "admin.roles.read";
export const ADMIN_ROLES_CREATE = "admin.roles.create";
export const ADMIN_ROLES_UPDATE = "admin.roles.update";
export const ADMIN_ROLES_PERMISSIONS = "admin.roles.permissions";
export const ADMIN_AUDIT_READ = "admin.audit.read";

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 300;
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const AVATAR_CACHE_CONTROL = "private, max-age=300";
const AVATAR_PREFIX = "admin-avatars";
const AVATAR_TYPES = {
  "image/jpeg": { extension: "jpg" },
  "image/png": { extension: "png" },
  "image/webp": { extension: "webp" },
  "image/avif": { extension: "avif" },
};
const ACTIVE_STATUS = new Set(["active", "disabled"]);
const ROLE_GROUPS = [
  ["room-service.", "Pedidos"],
  ["portals.media.", "Imagens"],
  ["portals.hotels.", "Unidades"],
  ["portals.links.", "Links"],
  ["portals.embed.", "Incorporacao"],
  ["admin.users.", "Usuarios"],
  ["admin.roles.", "Perfis e permissoes"],
  ["admin.audit.", "Auditoria"],
];

export async function listAdminUsers({ env, session, url }) {
  requirePermission(session, ADMIN_USERS_READ);
  const search = optionalString(url.searchParams.get("q"), "q", { max: 120 }).toLowerCase();
  const status = optionalString(url.searchParams.get("status"), "status", { max: 30 });
  const roleId = optionalString(url.searchParams.get("role_id"), "role_id", { max: 120 });
  const hotelId = optionalString(url.searchParams.get("hotel_id"), "hotel_id", { max: 120 });

  if (status && !ACTIVE_STATUS.has(status)) throw badRequest("Status de usuario invalido.");
  if (hotelId && !session.hotel_ids.includes(hotelId)) throw forbidden("Unidade fora do seu acesso administrativo.");

  const rows = await all(
    env,
    `SELECT u.id, u.display_name, u.email, u.status, u.force_password_change,
            u.created_at, u.updated_at,
            GROUP_CONCAT(DISTINCT r.id || ':' || r.name) AS roles_text,
            GROUP_CONCAT(DISTINCT h.id || ':' || h.short_name) AS hotels_text,
            COUNT(DISTINCT s.id) AS active_session_count
       FROM admin_users u
       LEFT JOIN admin_user_roles ur ON ur.user_id = u.id
       LEFT JOIN admin_roles r ON r.id = ur.role_id
       LEFT JOIN admin_hotel_access aha ON aha.user_id = u.id
       LEFT JOIN hotels h ON h.id = aha.hotel_id
       LEFT JOIN admin_sessions s ON s.user_id = u.id
        AND s.revoked_at IS NULL
        AND s.expires_at > ?
      GROUP BY u.id
      ORDER BY u.display_name
      LIMIT 200`,
    [requestNow({ env })],
  );

  const users = rows
    .map(formatUserRow)
    .filter((user) => !search || [user.display_name, user.email].some((value) => value.toLowerCase().includes(search)))
    .filter((user) => !status || user.status === status)
    .filter((user) => !roleId || user.roles.some((role) => role.id === roleId))
    .filter((user) => !hotelId || user.hotels.some((hotel) => hotel.hotel_id === hotelId));

  return { users, total: users.length };
}

export async function getAdminUser({ env, session, userId }) {
  requirePermission(session, ADMIN_USERS_READ);
  const user = await loadUserDetail(env, userId);
  if (!user) throw notFoundError("Usuario administrativo nao encontrado.");
  return { user };
}

export async function createAdminUser({ request, env, session }) {
  requirePermission(session, ADMIN_USERS_CREATE);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const displayName = requireString(payload.display_name, "nome", { max: 160 });
  const email = normalizeEmail(requireString(payload.email, "email", { max: 180 }));
  const roleIds = sanitizeIdList(payload.role_ids || [], "perfis");
  const hotelIds = sanitizeIdList(payload.hotel_ids || [], "unidades");
  const now = requestNow({ request, env });

  if (!hotelIds.length) throw badRequest("Informe pelo menos uma unidade.");
  ensureHotelsAllowed(session, hotelIds);
  await assertEmailAvailable(env, email);
  await assertRolesExist(env, roleIds);
  await assertHotelsExist(env, hotelIds);

  const tempPassword = createTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);
  const userId = createPublicId("admin_user");
  const statements = [
    statement(
      env,
      `INSERT INTO admin_users (
         id, display_name, email, password_hash, password_strategy, status,
         force_password_change, password_changed_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'pbkdf2', 'active', 1, NULL, ?, ?)`,
      [userId, displayName, email, passwordHash, now, now],
    ),
    auditStatement(env, {
      actorUserId: session.user.id,
      action: "admin-user.create",
      entityType: "admin_user",
      entityId: userId,
      metadata: { fields: ["display_name", "email", "roles", "hotels"] },
      createdAt: now,
    }),
  ];

  for (const roleId of roleIds) {
    statements.push(statement(env, `INSERT OR IGNORE INTO admin_user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)`, [userId, roleId, now]));
  }
  for (const hotelId of hotelIds) {
    statements.push(
      statement(
        env,
        `INSERT OR IGNORE INTO admin_hotel_access (user_id, hotel_id, access_level, created_at, updated_at)
         VALUES (?, ?, 'manager', ?, ?)`,
        [userId, hotelId, now, now],
      ),
    );
  }

  await batch(env, statements);
  const user = await loadUserDetail(env, userId);
  return { user, temporary_password: tempPassword };
}

export async function updateAdminUser({ request, env, session, userId }) {
  requirePermission(session, ADMIN_USERS_UPDATE);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const displayName = requireString(payload.display_name, "nome", { max: 160 });
  const email = normalizeEmail(requireString(payload.email, "email", { max: 180 }));
  const roleIds = sanitizeIdList(payload.role_ids || [], "perfis");
  const hotelIds = sanitizeIdList(payload.hotel_ids || [], "unidades");
  const now = requestNow({ request, env });
  const current = await getUserBase(env, userId);

  if (!current) throw notFoundError("Usuario administrativo nao encontrado.");
  if (!hotelIds.length) throw badRequest("Informe pelo menos uma unidade.");
  ensureHotelsAllowed(session, hotelIds);
  await assertEmailAvailable(env, email, userId);
  await assertRolesExist(env, roleIds);
  await assertHotelsExist(env, hotelIds);
  await assertNoLockoutOnRoleChange(env, userId, roleIds);

  const statements = [
    statement(env, `UPDATE admin_users SET display_name = ?, email = ?, updated_at = ? WHERE id = ?`, [
      displayName,
      email,
      now,
      userId,
    ]),
    statement(env, `DELETE FROM admin_user_roles WHERE user_id = ?`, [userId]),
    statement(env, `DELETE FROM admin_hotel_access WHERE user_id = ?`, [userId]),
    auditStatement(env, {
      actorUserId: session.user.id,
      action: "admin-user.update",
      entityType: "admin_user",
      entityId: userId,
      metadata: { fields: ["display_name", "email", "roles", "hotels"] },
      createdAt: now,
    }),
  ];
  for (const roleId of roleIds) {
    statements.push(statement(env, `INSERT OR IGNORE INTO admin_user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)`, [userId, roleId, now]));
  }
  for (const hotelId of hotelIds) {
    statements.push(
      statement(
        env,
        `INSERT OR IGNORE INTO admin_hotel_access (user_id, hotel_id, access_level, created_at, updated_at)
         VALUES (?, ?, 'manager', ?, ?)`,
        [userId, hotelId, now, now],
      ),
    );
  }
  await batch(env, statements);
  return { user: await loadUserDetail(env, userId) };
}

export async function setAdminUserStatus({ request, env, session, userId, status }) {
  requirePermission(session, status === "disabled" ? ADMIN_USERS_DISABLE : ADMIN_USERS_UPDATE);
  assertAdminMutationAllowed({ request });
  if (userId === session.user.id && status === "disabled") throw conflict("Voce nao pode desativar a propria conta.");
  const current = await getUserBase(env, userId);
  if (!current) throw notFoundError("Usuario administrativo nao encontrado.");
  if (status === "disabled") await assertNotLastEffectiveAdmin(env, userId);
  const now = requestNow({ request, env });
  await batch(env, [
    statement(env, `UPDATE admin_users SET status = ?, updated_at = ? WHERE id = ?`, [status, now, userId]),
    auditStatement(env, {
      actorUserId: session.user.id,
      action: status === "disabled" ? "admin-user.disable" : "admin-user.activate",
      entityType: "admin_user",
      entityId: userId,
      metadata: { status },
      createdAt: now,
    }),
  ]);
  return { user: await loadUserDetail(env, userId) };
}

export async function resetAdminUserPassword({ request, env, session, userId }) {
  requirePermission(session, ADMIN_USERS_PASSWORD_RESET);
  assertAdminMutationAllowed({ request });
  const current = await getUserBase(env, userId);
  if (!current) throw notFoundError("Usuario administrativo nao encontrado.");
  const now = requestNow({ request, env });
  const tempPassword = createTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);
  await batch(env, [
    statement(
      env,
      `UPDATE admin_users
          SET password_hash = ?, password_strategy = 'pbkdf2',
              force_password_change = 1, password_changed_at = NULL, updated_at = ?
        WHERE id = ?`,
      [passwordHash, now, userId],
    ),
    statement(env, `UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, [now, userId]),
    auditStatement(env, {
      actorUserId: session.user.id,
      action: "admin-user.password-reset",
      entityType: "admin_user",
      entityId: userId,
      metadata: { requires_change: true },
      createdAt: now,
    }),
  ]);
  return { user: await loadUserDetail(env, userId), temporary_password: tempPassword };
}

export async function revokeAdminUserSessions({ request, env, session, userId }) {
  requirePermission(session, ADMIN_USERS_SESSIONS_REVOKE);
  assertAdminMutationAllowed({ request });
  const current = await getUserBase(env, userId);
  if (!current) throw notFoundError("Usuario administrativo nao encontrado.");
  const now = requestNow({ request, env });
  const result = await run(env, `UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, [now, userId]);
  await audit(env, {
    actorUserId: session.user.id,
    action: "admin-user.sessions-revoked",
    entityType: "admin_user",
    entityId: userId,
    metadata: { count: result?.meta?.changes || 0 },
    createdAt: now,
  });
  return { revoked_sessions: result?.meta?.changes || 0 };
}

export async function listAdminRoles({ env, session }) {
  requirePermission(session, ADMIN_ROLES_READ);
  const roles = await all(
    env,
    `SELECT r.id, r.role_key, r.name, r.description,
            COUNT(DISTINCT ur.user_id) AS user_count,
            GROUP_CONCAT(DISTINCT p.permission_key) AS permissions_text
       FROM admin_roles r
       LEFT JOIN admin_user_roles ur ON ur.role_id = r.id
       LEFT JOIN admin_role_permissions rp ON rp.role_id = r.id
       LEFT JOIN admin_permissions p ON p.id = rp.permission_id
      GROUP BY r.id
      ORDER BY r.name`,
    [],
  );
  return { roles: roles.map(formatRoleRow) };
}

export async function getAdminRole({ env, session, roleId }) {
  requirePermission(session, ADMIN_ROLES_READ);
  const roles = (await listAdminRoles({ env, session })).roles;
  const role = roles.find((entry) => entry.id === roleId);
  if (!role) throw notFoundError("Perfil nao encontrado.");
  return { role };
}

export async function createAdminRole({ request, env, session }) {
  requirePermission(session, ADMIN_ROLES_CREATE);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const roleKey = requireString(payload.role_key, "endereco do perfil", { max: 80 });
  if (!isSafeIdentifier(roleKey)) throw badRequest("Endereco do perfil invalido.");
  const name = requireString(payload.name, "nome", { max: 120 });
  const description = optionalString(payload.description, "descricao", { max: 500 }) || null;
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `INSERT INTO admin_roles (id, role_key, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [createPublicId("role"), roleKey, name, description, now, now],
    ),
    auditStatement(env, {
      actorUserId: session.user.id,
      action: "admin-role.create",
      entityType: "admin_role",
      entityId: roleKey,
      metadata: { role_key: roleKey },
      createdAt: now,
    }),
  ]);
  return { created: true };
}

export async function updateAdminRole({ request, env, session, roleId }) {
  requirePermission(session, ADMIN_ROLES_UPDATE);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const name = requireString(payload.name, "nome", { max: 120 });
  const description = optionalString(payload.description, "descricao", { max: 500 }) || null;
  const now = requestNow({ request, env });
  const result = await run(env, `UPDATE admin_roles SET name = ?, description = ?, updated_at = ? WHERE id = ?`, [
    name,
    description,
    now,
    roleId,
  ]);
  if (!result?.meta?.changes) throw notFoundError("Perfil nao encontrado.");
  await audit(env, {
    actorUserId: session.user.id,
    action: "admin-role.update",
    entityType: "admin_role",
    entityId: roleId,
    metadata: { fields: ["name", "description"] },
    createdAt: now,
  });
  return { role: (await getAdminRole({ env, session, roleId })).role };
}

export async function updateAdminRolePermissions({ request, env, session, roleId }) {
  requirePermission(session, ADMIN_ROLES_PERMISSIONS);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const permissionKeys = requireArray(payload.permission_keys || [], "permissoes", { min: 0, max: 200 });
  for (const key of permissionKeys) requireString(key, "permissao", { max: 160 });
  await assertRoleExists(env, roleId);
  await assertPermissionsExist(env, permissionKeys);
  await assertNoLockoutOnRolePermissionChange(env, roleId, permissionKeys);
  const now = requestNow({ request, env });
  const statements = [
    statement(env, `DELETE FROM admin_role_permissions WHERE role_id = ?`, [roleId]),
    auditStatement(env, {
      actorUserId: session.user.id,
      action: "admin-role.permissions-update",
      entityType: "admin_role",
      entityId: roleId,
      metadata: { permission_count: permissionKeys.length },
      createdAt: now,
    }),
  ];
  for (const key of permissionKeys) {
    statements.push(
      statement(
        env,
        `INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id, created_at)
         SELECT ?, id, ? FROM admin_permissions WHERE permission_key = ?`,
        [roleId, now, key],
      ),
    );
  }
  await batch(env, statements);
  return { role: (await getAdminRole({ env, session, roleId })).role };
}

export async function listAdminPermissions({ env, session }) {
  requirePermission(session, ADMIN_ROLES_READ);
  const permissions = await all(
    env,
    `SELECT id, permission_key, module_key, description
       FROM admin_permissions
      ORDER BY permission_key`,
    [],
  );
  return {
    permissions: permissions.map((permission) => ({
      id: permission.id,
      permission_key: permission.permission_key,
      label: humanPermissionLabel(permission.permission_key),
      group: permissionGroup(permission.permission_key),
      description: permission.description,
    })),
  };
}

export async function getAdminMe({ env, session }) {
  return { user: await loadUserDetail(env, session.user.id), session: { expires_at: session.expires_at } };
}

export async function serveAdminUserAvatar({ env, session, userId, head = false }) {
  if (userId !== session.user.id) requirePermission(session, ADMIN_USERS_READ);
  const user = await getUserBase(env, userId);
  if (!user) throw notFoundError("Usuario administrativo nao encontrado.");
  if (!user.avatar_object_key) return fallbackAvatarResponse(user, head);
  const bucket = requireAvatarBucket(env);
  const object = head ? await bucket.head(user.avatar_object_key) : await bucket.get(user.avatar_object_key);
  if (!object) return fallbackAvatarResponse(user, head);
  return new Response(head ? null : object.body, {
    status: 200,
    headers: {
      "content-type": user.avatar_mime_type || object.httpMetadata?.contentType || "application/octet-stream",
      "cache-control": AVATAR_CACHE_CONTROL,
      "content-length": object.size ? String(object.size) : "0",
    },
  });
}

export async function uploadOwnAvatar({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  const bucket = requireAvatarBucket(env);
  const form = await request.formData().catch(() => {
    throw badRequest("Envie a imagem como multipart/form-data.");
  });
  const file = form.get("avatar");
  const validated = await validateAvatarFile(file);
  const current = await getUserBase(env, session.user.id);
  if (!current) throw notFoundError("Usuario administrativo nao encontrado.");

  const now = requestNow({ request, env });
  const objectKey = `${AVATAR_PREFIX}/${session.user.id}/${createPublicId("avatar")}.${validated.extension}`;
  try {
    await bucket.put(objectKey, validated.bytes, {
      httpMetadata: {
        contentType: validated.mimeType,
        cacheControl: AVATAR_CACHE_CONTROL,
      },
      customMetadata: {
        user_id: session.user.id,
        scope: "admin-avatar",
      },
    });
  } catch {
    throw new AppError(503, "storage_unavailable", "Armazenamento de avatar indisponivel.");
  }

  try {
    await batch(env, [
      statement(
        env,
        `UPDATE admin_users
            SET avatar_object_key = ?,
                avatar_mime_type = ?,
                avatar_updated_at = ?,
                updated_at = ?
          WHERE id = ?`,
        [objectKey, validated.mimeType, now, now, session.user.id],
      ),
      auditStatement(env, {
        actorUserId: session.user.id,
        action: "admin-user.avatar-update",
        entityType: "admin_user",
        entityId: session.user.id,
        metadata: { mime_type: validated.mimeType, size_bytes: validated.sizeBytes },
        createdAt: now,
      }),
    ]);
  } catch {
    await bucket.delete(objectKey).catch(() => null);
    throw new AppError(500, "avatar_metadata_failed", "Avatar enviado, mas os metadados nao puderam ser salvos.");
  }

  if (current.avatar_object_key && current.avatar_object_key !== objectKey) {
    await bucket.delete(current.avatar_object_key).catch(() => null);
  }

  return {
    avatar: {
      url: `/api/v1/admin/me/avatar?ts=${encodeURIComponent(now)}`,
      mime_type: validated.mimeType,
      updated_at: now,
    },
  };
}

export async function deleteOwnAvatar({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  const bucket = requireAvatarBucket(env);
  const current = await getUserBase(env, session.user.id);
  if (!current) throw notFoundError("Usuario administrativo nao encontrado.");
  const oldObjectKey = current.avatar_object_key;
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE admin_users
          SET avatar_object_key = NULL,
              avatar_mime_type = NULL,
              avatar_updated_at = NULL,
              updated_at = ?
        WHERE id = ?`,
      [now, session.user.id],
    ),
    auditStatement(env, {
      actorUserId: session.user.id,
      action: "admin-user.avatar-delete",
      entityType: "admin_user",
      entityId: session.user.id,
      metadata: {},
      createdAt: now,
    }),
  ]);
  if (oldObjectKey) await bucket.delete(oldObjectKey).catch(() => null);
  return { avatar_deleted: true };
}

export async function changeOwnPassword({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const currentPassword = requireString(payload.current_password, "senha atual", { max: PASSWORD_MAX_LENGTH });
  const newPassword = requireString(payload.new_password, "nova senha", { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH });
  const confirmation = requireString(payload.confirm_password, "confirmacao", { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH });
  if (newPassword !== confirmation) throw badRequest("A confirmacao da senha nao confere.");
  const user = await first(
    env,
    `SELECT id, display_name, email, password_hash, password_strategy FROM admin_users WHERE id = ? LIMIT 1`,
    [session.user.id],
  );
  if (!user) throw notFoundError("Usuario administrativo nao encontrado.");
  if (!(await verifyPassword(currentPassword, user.password_hash))) throw unauthorizedPassword();
  if (await verifyPassword(newPassword, user.password_hash)) throw badRequest("A nova senha precisa ser diferente da atual.");
  validatePasswordPolicy(newPassword, user);

  const now = requestNow({ request, env });
  const passwordHash = await hashPassword(newPassword);
  await batch(env, [
    statement(
      env,
      `UPDATE admin_users
          SET password_hash = ?, password_strategy = 'pbkdf2',
              force_password_change = 0, password_changed_at = ?, updated_at = ?
        WHERE id = ?`,
      [passwordHash, now, now, session.user.id],
    ),
    statement(env, `UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, [now, session.user.id]),
    auditStatement(env, {
      actorUserId: session.user.id,
      action: "admin-user.password-change",
      entityType: "admin_user",
      entityId: session.user.id,
      metadata: { self_service: true },
      createdAt: now,
    }),
  ]);
  return {
    data: { password_changed: true, login_required: true },
    headers: clearSessionCookieHeaders(request, env),
  };
}

export async function revokeOwnSessions({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  const now = requestNow({ request, env });
  const result = await run(env, `UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, [
    now,
    session.user.id,
  ]);
  await audit(env, {
    actorUserId: session.user.id,
    action: "admin-user.sessions-revoked",
    entityType: "admin_user",
    entityId: session.user.id,
    metadata: { self_service: true, count: result?.meta?.changes || 0 },
    createdAt: now,
  });
  return {
    data: { revoked_sessions: result?.meta?.changes || 0 },
    headers: clearSessionCookieHeaders(request, env),
  };
}

async function loadUserDetail(env, userId) {
  const base = await getUserBase(env, userId);
  if (!base) return null;
  const roles = await all(
    env,
    `SELECT r.id, r.role_key, r.name
       FROM admin_user_roles ur
       JOIN admin_roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY r.name`,
    [userId],
  );
  const hotels = await all(
    env,
    `SELECT h.id AS hotel_id, h.slug, h.name, h.short_name, aha.access_level
       FROM admin_hotel_access aha
       JOIN hotels h ON h.id = aha.hotel_id
      WHERE aha.user_id = ?
      ORDER BY h.name`,
    [userId],
  );
  const sessions = await all(
    env,
    `SELECT id, created_at, expires_at, revoked_at
       FROM admin_sessions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20`,
    [userId],
  );
  return {
    id: base.id,
    display_name: base.display_name,
    email: base.email,
    status: base.status,
    force_password_change: Number(base.force_password_change || 0) === 1,
    password_changed_at: base.password_changed_at || null,
    avatar: base.avatar_object_key
      ? {
          url: `/api/v1/admin/users/${base.id}/avatar`,
          mime_type: base.avatar_mime_type,
          updated_at: base.avatar_updated_at,
        }
      : null,
    created_at: base.created_at,
    updated_at: base.updated_at,
    roles,
    hotels,
    sessions: sessions.map((session) => ({
      id: session.id,
      created_at: session.created_at,
      expires_at: session.expires_at,
      revoked: Boolean(session.revoked_at),
    })),
  };
}

function getUserBase(env, userId) {
  return first(
    env,
    `SELECT id, display_name, email, password_hash, password_strategy,
            status, force_password_change, password_changed_at,
            avatar_object_key, avatar_mime_type, avatar_updated_at,
            created_at, updated_at
       FROM admin_users
      WHERE id = ?
      LIMIT 1`,
    [userId],
  );
}

function formatUserRow(row) {
  return {
    id: row.id,
    display_name: row.display_name,
    email: row.email,
    status: row.status,
    force_password_change: Number(row.force_password_change || 0) === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    active_session_count: Number(row.active_session_count || 0),
    roles: parsePairList(row.roles_text, "id", "name"),
    hotels: parsePairList(row.hotels_text, "hotel_id", "short_name"),
  };
}

function formatRoleRow(row) {
  const permissionKeys = String(row.permissions_text || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
  return {
    id: row.id,
    role_key: row.role_key,
    name: row.name,
    description: row.description || "",
    user_count: Number(row.user_count || 0),
    permissions: permissionKeys.map((permission_key) => ({
      permission_key,
      label: humanPermissionLabel(permission_key),
      group: permissionGroup(permission_key),
    })),
  };
}

function parsePairList(value, keyName, labelName) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, ...rest] = entry.split(":");
      return { [keyName]: key, [labelName]: rest.join(":") || key };
    });
}

function sanitizeIdList(value, label) {
  return [...new Set(requireArray(value, label, { min: 0, max: 100 }).map((item) => requireString(item, label, { max: 120 })))];
}

function ensureHotelsAllowed(session, hotelIds) {
  const unauthorizedHotel = hotelIds.find((hotelId) => !session.hotel_ids.includes(hotelId));
  if (unauthorizedHotel) throw forbidden("Unidade fora do seu acesso administrativo.");
}

async function assertEmailAvailable(env, email, currentUserId = "") {
  const existing = await first(env, `SELECT id FROM admin_users WHERE lower(email) = lower(?) LIMIT 1`, [email]);
  if (existing && existing.id !== currentUserId) throw conflict("Ja existe um usuario com este e-mail.");
}

async function assertRolesExist(env, roleIds) {
  for (const roleId of roleIds) await assertRoleExists(env, roleId);
}

async function assertRoleExists(env, roleId) {
  const role = await first(env, `SELECT id FROM admin_roles WHERE id = ? LIMIT 1`, [roleId]);
  if (!role) throw badRequest("Perfil informado nao existe.");
}

async function assertPermissionsExist(env, permissionKeys) {
  for (const key of permissionKeys) {
    const permission = await first(env, `SELECT id FROM admin_permissions WHERE permission_key = ? LIMIT 1`, [key]);
    if (!permission) throw badRequest("Permissao informada nao existe.");
  }
}

async function assertHotelsExist(env, hotelIds) {
  for (const hotelId of hotelIds) {
    const hotel = await first(env, `SELECT id FROM hotels WHERE id = ? AND archived_at IS NULL LIMIT 1`, [hotelId]);
    if (!hotel) throw badRequest("Unidade informada nao existe.");
  }
}

async function assertNoLockoutOnRoleChange(env, userId, roleIds) {
  const current = await getUserBase(env, userId);
  if (current?.status !== "active") return;
  const rolePermissions = await permissionsForRoles(env, roleIds);
  if (hasAdminManagementCapability(rolePermissions)) return;
  const remaining = await countEffectiveAdmins(env, { excludeUserId: userId });
  if (remaining < 1) throw conflict("E preciso manter pelo menos um administrador com acesso a usuarios e perfis.");
}

async function assertNoLockoutOnRolePermissionChange(env, roleId, permissionKeys) {
  if (hasAdminManagementCapability(permissionKeys)) return;
  const users = await all(env, `SELECT user_id FROM admin_user_roles WHERE role_id = ?`, [roleId]);
  for (const user of users) {
    const otherRoles = await all(env, `SELECT role_id FROM admin_user_roles WHERE user_id = ? AND role_id <> ?`, [
      user.user_id,
      roleId,
    ]);
    const permissions = await permissionsForRoles(env, otherRoles.map((row) => row.role_id));
    if (!hasAdminManagementCapability(permissions)) {
      const remaining = await countEffectiveAdmins(env, { excludeUserId: user.user_id });
      if (remaining < 1) throw conflict("Esta alteracao removeria o ultimo administrador efetivo.");
    }
  }
}

async function assertNotLastEffectiveAdmin(env, userId) {
  const userRoles = await all(env, `SELECT role_id FROM admin_user_roles WHERE user_id = ?`, [userId]);
  const permissions = await permissionsForRoles(env, userRoles.map((row) => row.role_id));
  if (!hasAdminManagementCapability(permissions)) return;
  const remaining = await countEffectiveAdmins(env, { excludeUserId: userId });
  if (remaining < 1) throw conflict("E preciso manter pelo menos um administrador ativo.");
}

async function permissionsForRoles(env, roleIds) {
  if (!roleIds.length) return [];
  const rows = await all(
    env,
    `SELECT DISTINCT p.permission_key
       FROM admin_role_permissions rp
       JOIN admin_permissions p ON p.id = rp.permission_id
      WHERE rp.role_id IN (${roleIds.map(() => "?").join(", ")})`,
    roleIds,
  );
  return rows.map((row) => row.permission_key);
}

async function countEffectiveAdmins(env, { excludeUserId = "" } = {}) {
  const rows = await all(
    env,
    `SELECT u.id
       FROM admin_users u
       JOIN admin_user_roles ur ON ur.user_id = u.id
       JOIN admin_role_permissions rp ON rp.role_id = ur.role_id
       JOIN admin_permissions p ON p.id = rp.permission_id
      WHERE u.status = 'active'
        AND u.id <> ?
        AND p.permission_key IN ('admin.users.update', 'admin.roles.permissions')
      GROUP BY u.id`,
    [excludeUserId],
  );
  return rows.length;
}

function hasAdminManagementCapability(permissionKeys) {
  return permissionKeys.includes(ADMIN_USERS_UPDATE) && permissionKeys.includes(ADMIN_ROLES_PERMISSIONS);
}

function validatePasswordPolicy(password, user) {
  const lower = password.toLowerCase();
  const emailUser = String(user.email || "").split("@")[0].toLowerCase();
  const namePart = String(user.display_name || "").split(/\s+/)[0]?.toLowerCase() || "";
  if (emailUser && lower === emailUser) throw badRequest("A senha nao pode ser baseada apenas no e-mail.");
  if (namePart && lower === namePart) throw badRequest("A senha nao pode ser baseada apenas no nome.");
}

function requireAvatarBucket(env) {
  if (!env.MEDIA_BUCKET) throw new AppError(503, "storage_unavailable", "Armazenamento de avatar indisponivel.");
  return env.MEDIA_BUCKET;
}

async function validateAvatarFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") throw badRequest("Arquivo de avatar obrigatorio.");
  const mimeType = String(file.type || "").toLowerCase();
  const config = AVATAR_TYPES[mimeType];
  if (!config) throw badRequest("Formato de avatar nao permitido.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bytes.byteLength) throw badRequest("Arquivo de avatar vazio.");
  if (bytes.byteLength > MAX_AVATAR_BYTES) throw badRequest("Avatar excede 3 MB.");
  if (!hasAvatarMagicBytes(bytes, mimeType)) throw badRequest("Conteudo do avatar nao corresponde ao formato informado.");
  return {
    bytes,
    mimeType,
    extension: config.extension,
    sizeBytes: bytes.byteLength,
  };
}

function hasAvatarMagicBytes(bytes, mimeType) {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mimeType === "image/webp") return text(bytes.slice(0, 4)) === "RIFF" && text(bytes.slice(8, 12)) === "WEBP";
  if (mimeType === "image/avif") return text(bytes.slice(4, 8)) === "ftyp" && ["avif", "avis"].includes(text(bytes.slice(8, 12)));
  return false;
}

function fallbackAvatarResponse(user, head) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="#f4f1e8"/><text x="48" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="#5b4b2b">${escapeSvg(initials(user.display_name))}</text></svg>`;
  return new Response(head ? null : svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": AVATAR_CACHE_CONTROL,
      "content-length": head ? "0" : String(new TextEncoder().encode(svg).byteLength),
    },
  });
}

function initials(name) {
  return String(name || "Usuario")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function escapeSvg(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function text(bytes) {
  return String.fromCharCode(...bytes);
}

function normalizeEmail(email) {
  const normalized = email.toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw badRequest("E-mail invalido.");
  return normalized;
}

function createTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function unauthorizedPassword() {
  return forbidden("Senha atual incorreta.");
}

function humanPermissionLabel(permissionKey) {
  const labels = {
    "admin.users.read": "Ver usuarios",
    "admin.users.create": "Criar usuarios",
    "admin.users.update": "Editar usuarios",
    "admin.users.disable": "Ativar ou desativar usuarios",
    "admin.users.password_reset": "Redefinir senhas",
    "admin.users.sessions_revoke": "Encerrar sessoes",
    "admin.roles.read": "Ver perfis",
    "admin.roles.create": "Criar perfis",
    "admin.roles.update": "Editar perfis",
    "admin.roles.permissions": "Alterar permissoes",
    "admin.audit.read": "Ver auditoria",
  };
  return labels[permissionKey] || permissionKey;
}

function permissionGroup(permissionKey) {
  return ROLE_GROUPS.find(([prefix]) => permissionKey.startsWith(prefix))?.[1] || "Configuracoes";
}

function auditStatement(env, { actorUserId, action, entityType, entityId, metadata, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
    [createPublicId("audit"), actorUserId, action, entityType, entityId, JSON.stringify(metadata || {}), createdAt],
  );
}

async function audit(env, options) {
  await run(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
    [
      createPublicId("audit"),
      options.actorUserId,
      options.action,
      options.entityType,
      options.entityId,
      JSON.stringify(options.metadata || {}),
      options.createdAt,
    ],
  );
}
