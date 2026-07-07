import { all, first, run } from "../core/database.js";
import { forbidden, unauthorized } from "../core/errors.js";
import { createPublicId } from "../core/identifiers.js";
import { requestNow } from "../core/time.js";
import { readJson, requireString } from "../core/validation.js";

export const ADMIN_SESSION_COOKIE = "fioreze_admin_session";
export const ADMIN_MUTATION_HEADER = "x-fioreze-admin-action";
export const ADMIN_MUTATION_HEADER_VALUE = "erp-admin";

const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_TOKEN_BYTES = 32;
const PBKDF2_STRATEGY = "pbkdf2";

export async function loginAdmin({ request, env }) {
  const payload = await readJson(request);
  const email = requireString(payload.email, "email", { max: 180 }).toLowerCase();
  const password = requireString(payload.password, "password", { max: 300 });
  const user = await findUserByEmail(env, email);

  if (!user || user.status !== "active") {
    throw unauthorized("Credenciais administrativas invalidas.");
  }

  if (!isSupportedPasswordRecord(user)) {
    throw unauthorized("Credenciais administrativas invalidas.");
  }

  const verified = await verifyPassword(password, user.password_hash);
  if (!verified) {
    throw unauthorized("Credenciais administrativas invalidas.");
  }

  if (Number(user.force_password_change || 0) === 1) {
    throw forbidden("Senha administrativa precisa ser redefinida antes do acesso.");
  }

  const token = createSessionToken();
  const tokenHash = await sha256Hex(token);
  const userAgentHash = await optionalHeaderHash(request, "user-agent");
  const ipHash = await optionalHeaderHash(request, "cf-connecting-ip");
  const createdAt = requestNow({ request, env });
  const expiresAt = new Date(Date.parse(createdAt) + SESSION_TTL_SECONDS * 1000).toISOString();

  await run(
    env,
    `INSERT INTO admin_sessions (
       id, user_id, token_hash, user_agent_hash, ip_hash, created_at, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [createPublicId("sess"), user.id, tokenHash, userAgentHash, ipHash, createdAt, expiresAt],
  );

  const session = await buildAdminSession(env, {
    session_id: null,
    user_id: user.id,
    display_name: user.display_name,
    email: user.email,
    expires_at: expiresAt,
  });

  return {
    session,
    headers: sessionCookieHeaders(token, request, env),
  };
}

export async function logoutAdmin({ request, env }) {
  assertAdminMutationAllowed({ request });
  const token = readCookie(request.headers.get("cookie") || "", ADMIN_SESSION_COOKIE);
  if (token) {
    await run(
      env,
      `UPDATE admin_sessions
          SET revoked_at = ?
        WHERE token_hash = ?
          AND revoked_at IS NULL`,
      [requestNow({ request, env }), await sha256Hex(token)],
    );
  }

  return {
    headers: clearSessionCookieHeaders(request, env),
  };
}

export async function getCurrentAdminSession({ request, env, required = true }) {
  const token = readCookie(request.headers.get("cookie") || "", ADMIN_SESSION_COOKIE);
  if (!token) {
    if (required) throw unauthorized("Sessao administrativa obrigatoria.");
    return null;
  }

  const tokenHash = await sha256Hex(token);
  const sessionRow = await first(
    env,
    `SELECT s.id AS session_id, s.user_id, s.expires_at,
            u.display_name, u.email
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > ?
        AND u.status = 'active'
      LIMIT 1`,
    [tokenHash, requestNow({ request, env })],
  );

  if (!sessionRow) {
    if (required) throw unauthorized("Sessao administrativa expirada ou invalida.");
    return null;
  }

  return buildAdminSession(env, sessionRow);
}

export function requirePermission(session, permissionKey) {
  if (!session.permissions.includes(permissionKey)) {
    throw unauthorized("Permissao administrativa insuficiente.");
  }
}

export function userCanAccessHotel(session, hotelId) {
  return session.hotels.some((hotel) => hotel.hotel_id === hotelId);
}

export function requireAdminHotelAccess(session, hotelId) {
  if (!userCanAccessHotel(session, hotelId)) {
    throw unauthorized("Usuario sem acesso ao hotel solicitado.");
  }
}

export function toSessionPayload(session) {
  return {
    user: session.user,
    hotels: session.hotels,
    permissions: session.permissions,
    expires_at: session.expires_at,
  };
}

export function assertAdminMutationAllowed({ request }) {
  const actionHeader = request.headers.get(ADMIN_MUTATION_HEADER);
  if (actionHeader !== ADMIN_MUTATION_HEADER_VALUE) {
    throw forbidden("Requisicao administrativa sem protecao de mutacao.");
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    throw forbidden("Origem administrativa invalida.");
  }

  const requestOrigin = new URL(request.url).origin;
  if (originUrl.origin !== requestOrigin) {
    throw forbidden("Origem administrativa nao autorizada.");
  }
}

async function findUserByEmail(env, email) {
  return first(
    env,
    `SELECT id, display_name, email, password_hash, password_strategy,
            status, force_password_change
       FROM admin_users
      WHERE lower(email) = lower(?)
      LIMIT 1`,
    [email],
  );
}

async function buildAdminSession(env, row) {
  const hotels = await all(
    env,
    `SELECT h.id AS hotel_id, h.slug, h.name, h.short_name,
            h.timezone, h.locale, h.currency, aha.access_level
       FROM admin_hotel_access aha
       JOIN hotels h ON h.id = aha.hotel_id
      WHERE aha.user_id = ?
        AND h.status = 'active'
        AND h.archived_at IS NULL
      ORDER BY h.name`,
    [row.user_id],
  );

  const permissions = await all(
    env,
    `SELECT DISTINCT p.permission_key
       FROM admin_user_roles ur
       JOIN admin_role_permissions rp ON rp.role_id = ur.role_id
       JOIN admin_permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = ?
      ORDER BY p.permission_key`,
    [row.user_id],
  );

  return {
    session_id: row.session_id,
    user: {
      id: row.user_id,
      display_name: row.display_name,
      email: row.email,
    },
    hotels,
    hotel_ids: hotels.map((hotel) => hotel.hotel_id),
    permissions: permissions.map((permission) => permission.permission_key),
    expires_at: row.expires_at,
  };
}

async function verifyPassword(password, storedHash) {
  const parsed = parsePasswordHash(storedHash);
  if (!parsed) return false;

  const key = await crypto.subtle.importKey("raw", encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: parsed.salt,
      iterations: parsed.iterations,
    },
    key,
    parsed.hash.byteLength * 8,
  );

  return constantTimeEqual(new Uint8Array(derived), parsed.hash);
}

function isSupportedPasswordRecord(user) {
  return user.password_strategy === PBKDF2_STRATEGY && Boolean(parsePasswordHash(user.password_hash));
}

function parsePasswordHash(storedHash) {
  if (typeof storedHash !== "string") return null;
  const [strategy, algorithm, iterationsText, saltText, hashText] = storedHash.split("$");
  const iterations = Number(iterationsText);
  if (strategy !== PBKDF2_STRATEGY || algorithm !== "sha256" || !Number.isInteger(iterations) || iterations < 100000) {
    return null;
  }
  try {
    return {
      iterations,
      salt: fromBase64(saltText),
      hash: fromBase64(hashText),
    };
  } catch {
    return null;
  }
}

function createSessionToken() {
  const bytes = new Uint8Array(SESSION_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

function sessionCookieHeaders(token, request, env) {
  const headers = new Headers();
  headers.append(
    "set-cookie",
    `${ADMIN_SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${secureCookieSuffix(request, env)}`,
  );
  return headers;
}

function clearSessionCookieHeaders(request, env) {
  const headers = new Headers();
  headers.append(
    "set-cookie",
    `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureCookieSuffix(request, env)}`,
  );
  return headers;
}

function secureCookieSuffix(request, env) {
  const url = new URL(request.url);
  if (url.protocol === "https:" && env.ENVIRONMENT !== "test") return "; Secure";
  return "";
}

function readCookie(cookieHeader, name) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function optionalHeaderHash(request, headerName) {
  const value = request.headers.get(headerName);
  return value ? sha256Hex(value) : null;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encode(value) {
  return new TextEncoder().encode(value);
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toBase64Url(bytes) {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function constantTimeEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}
