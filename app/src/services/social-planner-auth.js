import { all, batch, first, run, statement } from "../core/database.js";
import { badRequest, notFoundError, unauthorized } from "../core/errors.js";
import { createPublicId } from "../core/identifiers.js";
import { requestNow } from "../core/time.js";
import { readJson, requireString } from "../core/validation.js";
import {
  assertAdminMutationAllowed,
  getCurrentAdminSession,
  hashPassword,
  verifyPassword,
} from "./admin-auth.js";

export const SOCIAL_PLANNER_SESSION_COOKIE = "fioreze_social_planner_session";
export const SOCIAL_PLANNER_PERMISSIONS = Object.freeze({
  read: "social-planner.read",
  write: "social-planner.write",
  users: "social-planner.users.manage",
});

const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_TOKEN_BYTES = 32;
const ACCESS_LEVELS = new Set(["viewer", "editor", "admin"]);

export async function loginSocialPlanner({ request, env }) {
  const payload = await readJson(request);
  const email = normalizeEmail(payload.email);
  const password = requireString(payload.password, "password", { max: 300 });
  const user = await first(
    env,
    `SELECT id, display_name, email, password_hash, password_strategy, access_level, status
       FROM social_planner_users
      WHERE lower(email) = lower(?)
        AND admin_user_id IS NULL
      LIMIT 1`,
    [email],
  );
  if (!user || user.status !== "active" || user.password_strategy !== "pbkdf2") {
    throw unauthorized("E-mail ou senha invalidos.");
  }
  if (!(await verifyPassword(password, user.password_hash))) {
    throw unauthorized("E-mail ou senha invalidos.");
  }

  const token = createSessionToken();
  const createdAt = requestNow({ request, env });
  const expiresAt = new Date(Date.parse(createdAt) + SESSION_TTL_SECONDS * 1000).toISOString();
  await run(
    env,
    `INSERT INTO social_planner_sessions (
       id, user_id, token_hash, user_agent_hash, ip_hash, created_at, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      createPublicId("spsess"),
      user.id,
      await sha256Hex(token),
      await optionalHeaderHash(request, "user-agent"),
      await optionalHeaderHash(request, "cf-connecting-ip"),
      createdAt,
      expiresAt,
    ],
  );
  return {
    session: buildPlannerSession({ ...user, expires_at: expiresAt }),
    headers: sessionCookieHeaders(token, request, env),
  };
}

export async function getCurrentSocialPlannerSession({ request, env, required = true }) {
  const adminSession = await getCurrentAdminSession({ request, env, required: false });
  if (adminSession?.user?.is_master) {
    return buildMasterSession(adminSession);
  }

  const token = readCookie(request.headers.get("cookie") || "", SOCIAL_PLANNER_SESSION_COOKIE);
  if (!token) {
    if (required) throw unauthorized("Sessao do Marketing Planner obrigatoria.");
    return null;
  }
  const row = await first(
    env,
    `SELECT s.id AS session_id, s.expires_at,
            u.id, u.display_name, u.email, u.access_level, u.status
       FROM social_planner_sessions s
       JOIN social_planner_users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > ?
        AND u.status = 'active'
        AND u.admin_user_id IS NULL
      LIMIT 1`,
    [await sha256Hex(token), requestNow({ request, env })],
  );
  if (!row) {
    if (required) throw unauthorized("Sessao do Marketing Planner expirada ou invalida.");
    return null;
  }
  return buildPlannerSession(row);
}

export async function logoutSocialPlanner({ request, env }) {
  assertAdminMutationAllowed({ request });
  const token = readCookie(request.headers.get("cookie") || "", SOCIAL_PLANNER_SESSION_COOKIE);
  if (token) {
    await run(
      env,
      `UPDATE social_planner_sessions SET revoked_at = ?
        WHERE token_hash = ? AND revoked_at IS NULL`,
      [requestNow({ request, env }), await sha256Hex(token)],
    );
  }
  return { headers: clearSessionCookieHeaders(request, env) };
}

export function toSocialPlannerSessionPayload(session) {
  return {
    user: session.user,
    permissions: session.permissions,
    access_level: session.access_level,
    auth_source: session.auth_source,
    expires_at: session.expires_at,
  };
}

export function requireSocialPlannerPermission(session, permission) {
  if (!session?.permissions?.includes(permission)) {
    throw unauthorized("Permissao do Marketing Planner insuficiente.");
  }
}

export async function listSocialPlannerUsers({ env, session }) {
  requireSocialPlannerPermission(session, SOCIAL_PLANNER_PERMISSIONS.users);
  const users = await all(
    env,
    `SELECT id, display_name, email, access_level, status,
            CASE WHEN admin_user_id IS NULL THEN 0 ELSE 1 END AS inherited_from_central,
            created_at, updated_at
       FROM social_planner_users
      WHERE status != 'archived'
      ORDER BY inherited_from_central DESC, display_name`,
  );
  return { users };
}

export async function createSocialPlannerUser({ request, env, session }) {
  requireSocialPlannerPermission(session, SOCIAL_PLANNER_PERMISSIONS.users);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const id = createPublicId("spusr");
  const displayName = requireString(payload.display_name, "display_name", { min: 2, max: 120 });
  const email = normalizeEmail(payload.email);
  const password = requireString(payload.password, "password", { min: 8, max: 300 });
  const accessLevel = normalizeAccessLevel(payload.access_level || "editor");
  const now = requestNow({ request, env });
  try {
    await run(
      env,
      `INSERT INTO social_planner_users (
         id, display_name, email, password_hash, password_strategy, access_level,
         status, admin_user_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'pbkdf2', ?, 'active', NULL, ?, ?)`,
      [id, displayName, email, await hashPassword(password), accessLevel, now, now],
    );
  } catch (error) {
    if (/unique constraint failed.*social_planner_users.*email/i.test(String(error?.message || ""))) {
      throw badRequest("Ja existe um usuario do Planner com este e-mail.");
    }
    throw error;
  }
  return { user: await loadPlannerUser(env, id) };
}

export async function updateSocialPlannerUser({ request, env, session, userId }) {
  requireSocialPlannerPermission(session, SOCIAL_PLANNER_PERMISSIONS.users);
  assertAdminMutationAllowed({ request });
  const current = await requireEditablePlannerUser(env, userId);
  const payload = await readJson(request);
  const displayName = requireString(payload.display_name ?? current.display_name, "display_name", { min: 2, max: 120 });
  const email = normalizeEmail(payload.email ?? current.email);
  const accessLevel = normalizeAccessLevel(payload.access_level ?? current.access_level);
  const status = normalizeStatus(payload.status ?? current.status);
  if (session.auth_source === "social-planner" && session.user.id === userId && status !== "active") {
    throw badRequest("O usuario atual nao pode desativar a propria conta.");
  }
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE social_planner_users
          SET display_name = ?, email = ?, access_level = ?, status = ?, updated_at = ?
        WHERE id = ? AND admin_user_id IS NULL`,
      [displayName, email, accessLevel, status, now, userId],
    ),
    ...(status === "active" ? [] : [
      statement(env, "UPDATE social_planner_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", [now, userId]),
    ]),
  ]);
  return { user: await loadPlannerUser(env, userId) };
}

export async function resetSocialPlannerUserPassword({ request, env, session, userId }) {
  requireSocialPlannerPermission(session, SOCIAL_PLANNER_PERMISSIONS.users);
  assertAdminMutationAllowed({ request });
  await requireEditablePlannerUser(env, userId);
  const payload = await readJson(request);
  const password = requireString(payload.password, "password", { min: 8, max: 300 });
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE social_planner_users
          SET password_hash = ?, password_strategy = 'pbkdf2', updated_at = ?
        WHERE id = ? AND admin_user_id IS NULL`,
      [await hashPassword(password), now, userId],
    ),
    statement(env, "UPDATE social_planner_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", [now, userId]),
  ]);
  return { password_reset: true, sessions_revoked: true };
}

function buildMasterSession(adminSession) {
  return {
    user: { ...adminSession.user, planner_user_id: "spusr-master" },
    permissions: Object.values(SOCIAL_PLANNER_PERMISSIONS),
    access_level: "admin",
    auth_source: "admin-master",
    expires_at: adminSession.expires_at,
  };
}

function buildPlannerSession(row) {
  const permissions = [SOCIAL_PLANNER_PERMISSIONS.read];
  if (row.access_level === "editor" || row.access_level === "admin") permissions.push(SOCIAL_PLANNER_PERMISSIONS.write);
  if (row.access_level === "admin") permissions.push(SOCIAL_PLANNER_PERMISSIONS.users);
  return {
    session_id: row.session_id || null,
    user: { id: row.id, planner_user_id: row.id, display_name: row.display_name, email: row.email },
    permissions,
    access_level: row.access_level,
    auth_source: "social-planner",
    expires_at: row.expires_at,
  };
}

async function requireEditablePlannerUser(env, userId) {
  const user = await first(
    env,
    `SELECT id, display_name, email, access_level, status
       FROM social_planner_users
      WHERE id = ? AND admin_user_id IS NULL AND status != 'archived'
      LIMIT 1`,
    [userId],
  );
  if (!user) throw notFoundError("Usuario local do Planner nao encontrado.");
  return user;
}

async function loadPlannerUser(env, userId) {
  return first(
    env,
    `SELECT id, display_name, email, access_level, status, 0 AS inherited_from_central, created_at, updated_at
       FROM social_planner_users WHERE id = ? LIMIT 1`,
    [userId],
  );
}

function normalizeEmail(value) {
  const email = requireString(value, "email", { min: 5, max: 180 }).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest("E-mail invalido.");
  return email;
}

function normalizeAccessLevel(value) {
  const accessLevel = requireString(value, "access_level", { max: 20 });
  if (!ACCESS_LEVELS.has(accessLevel)) throw badRequest("Nivel de acesso invalido.");
  return accessLevel;
}

function normalizeStatus(value) {
  const status = requireString(value, "status", { max: 20 });
  if (!new Set(["active", "disabled"]).has(status)) throw badRequest("Status de usuario invalido.");
  return status;
}

function createSessionToken() {
  const bytes = new Uint8Array(SESSION_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

function sessionCookieHeaders(token, request, env) {
  const headers = new Headers();
  headers.append("set-cookie", `${SOCIAL_PLANNER_SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${secureCookieSuffix(request, env)}`);
  return headers;
}

function clearSessionCookieHeaders(request, env) {
  const headers = new Headers();
  headers.append("set-cookie", `${SOCIAL_PLANNER_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureCookieSuffix(request, env)}`);
  return headers;
}

function secureCookieSuffix(request, env) {
  return new URL(request.url).protocol === "https:" && env.ENVIRONMENT !== "test" ? "; Secure" : "";
}

function readCookie(cookieHeader, name) {
  return cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function optionalHeaderHash(request, headerName) {
  const value = request.headers.get(headerName);
  return value ? sha256Hex(value) : null;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
