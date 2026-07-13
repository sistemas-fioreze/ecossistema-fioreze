import { all, first, run } from "../core/database.js";
import { unauthorized } from "../core/errors.js";
import { createPublicId } from "../core/identifiers.js";
import { requestNow } from "../core/time.js";
import { readJson, requireString } from "../core/validation.js";
import {
  assertAdminMutationAllowed,
  getCurrentAdminSession,
  verifyPassword,
} from "./admin-auth.js";

export const ERP_SESSION_COOKIE = "fioreze_erp_session";
export const ERP_MASTER_PERMISSION = "erp.master";
export const ERP_PERMISSION_DEFINITIONS = Object.freeze([
  { key: "room-service.dashboard.read", label: "Dashboard" },
  { key: "room-service.orders.read", label: "Pedidos" },
  { key: "room-service.orders.write", label: "PDV e status de pedidos" },
  { key: "room-service.guests.read", label: "Hospedes" },
  { key: "room-service.billing.read", label: "Faturamento" },
  { key: "room-service.catalog.read", label: "Cardapio" },
  { key: "room-service.users.manage", label: "Usuarios e configuracoes" },
]);

const MODULE_KEY = "room-service";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_TOKEN_BYTES = 32;
const ALL_ERP_PERMISSIONS = ERP_PERMISSION_DEFINITIONS.map((entry) => entry.key);

export async function listRoomServiceErpLoginHotels(env) {
  const rows = await all(
    env,
    `SELECT h.id AS hotel_id, h.slug, h.name, h.short_name, h.timezone, h.locale, h.currency,
            hb.logo_url, hb.icon_url, hb.primary_color, hb.secondary_color,
            hb.accent_color, hb.background_color, hb.text_color, hb.font_family,
            hb.custom_css_json
       FROM hotels h
       JOIN hotel_modules hm ON hm.hotel_id = h.id
       LEFT JOIN hotel_branding hb ON hb.hotel_id = h.id
      WHERE h.status = 'active'
        AND h.archived_at IS NULL
        AND hm.module_key = ?
        AND hm.enabled = 1
      ORDER BY h.name`,
    [MODULE_KEY],
  );
  return { hotels: rows.map(formatLoginHotel) };
}

export async function loginRoomServiceErp({ request, env }) {
  const payload = await readJson(request);
  const hotelId = requireString(payload.hotel_id, "hotel_id", { max: 80 });
  const userCode = normalizeUserCode(payload.user_code);
  const password = requireString(payload.password, "password", { max: 300 });
  const user = await first(
    env,
    `SELECT id, hotel_id, user_code, display_name, password_hash, password_strategy, status
       FROM erp_users
      WHERE hotel_id = ?
        AND user_code = ?
      LIMIT 1`,
    [hotelId, userCode],
  );

  if (!user || user.status !== "active" || user.password_strategy !== "pbkdf2") {
    throw unauthorized("Codigo ou senha invalidos.");
  }
  if (!(await verifyPassword(password, user.password_hash))) {
    throw unauthorized("Codigo ou senha invalidos.");
  }

  const hotel = await loadHotel(env, hotelId);
  if (!hotel) throw unauthorized("Unidade indisponivel para o ERP.");

  const token = createSessionToken();
  const createdAt = requestNow({ request, env });
  const expiresAt = new Date(Date.parse(createdAt) + SESSION_TTL_SECONDS * 1000).toISOString();
  await run(
    env,
    `INSERT INTO erp_sessions (
       id, user_id, hotel_id, token_hash, user_agent_hash, ip_hash, created_at, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createPublicId("erpsess"),
      user.id,
      hotelId,
      await sha256Hex(token),
      await optionalHeaderHash(request, "user-agent"),
      await optionalHeaderHash(request, "cf-connecting-ip"),
      createdAt,
      expiresAt,
    ],
  );

  const session = await buildErpUserSession(env, { ...user, expires_at: expiresAt }, hotel);
  return { session, headers: sessionCookieHeaders(token, request, env) };
}

export async function getCurrentRoomServiceErpSession({ request, env, required = true }) {
  const adminSession = await getCurrentAdminSession({ request, env, required: false });
  if (adminSession) return buildCentralErpSession(env, adminSession);

  const token = readCookie(request.headers.get("cookie") || "", ERP_SESSION_COOKIE);
  if (!token) {
    if (required) throw unauthorized("Sessao do ERP obrigatoria.");
    return null;
  }

  const row = await first(
    env,
    `SELECT s.id AS session_id, s.expires_at,
            u.id, u.hotel_id, u.user_code, u.display_name, u.status
       FROM erp_sessions s
       JOIN erp_users u ON u.id = s.user_id AND u.hotel_id = s.hotel_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > ?
        AND u.status = 'active'
      LIMIT 1`,
    [await sha256Hex(token), requestNow({ request, env })],
  );

  if (!row) {
    if (required) throw unauthorized("Sessao do ERP expirada ou invalida.");
    return null;
  }
  const hotel = await loadHotel(env, row.hotel_id);
  if (!hotel) throw unauthorized("Unidade indisponivel para o ERP.");
  return buildErpUserSession(env, row, hotel);
}

export async function logoutRoomServiceErp({ request, env }) {
  assertAdminMutationAllowed({ request });
  const token = readCookie(request.headers.get("cookie") || "", ERP_SESSION_COOKIE);
  if (token) {
    await run(
      env,
      `UPDATE erp_sessions
          SET revoked_at = ?
        WHERE token_hash = ?
          AND revoked_at IS NULL`,
      [requestNow({ request, env }), await sha256Hex(token)],
    );
  }
  return { headers: clearErpSessionCookieHeaders(request, env) };
}

export function toRoomServiceErpSessionPayload(session) {
  return {
    user: session.user,
    hotels: session.hotels,
    permissions: session.permissions,
    expires_at: session.expires_at,
    auth_source: session.auth_source,
    erp_master: Boolean(session.erp_master),
  };
}

export function erpActorIds(session) {
  return {
    adminUserId: session.auth_source !== "erp" ? session.user.id : null,
    erpUserId: session.auth_source === "erp" ? session.user.id : null,
  };
}

async function buildCentralErpSession(env, session) {
  const master = session.permissions.includes(ERP_MASTER_PERMISSION);
  if (!master) throw unauthorized("Acesso ao ERP reservado aos usuarios operacionais da unidade.");
  const hotels = await loadAllHotels(env);
  return {
    ...session,
    auth_source: "admin",
    erp_master: true,
    hotels,
    hotel_ids: hotels.map((hotel) => hotel.hotel_id),
    permissions: [...new Set([...session.permissions, ...ALL_ERP_PERMISSIONS])],
  };
}

async function buildErpUserSession(env, row, hotel) {
  const permissions = await all(
    env,
    `SELECT permission_key
       FROM erp_user_permissions
      WHERE user_id = ?
        AND hotel_id = ?
      ORDER BY permission_key`,
    [row.id, row.hotel_id],
  );
  return {
    session_id: row.session_id || null,
    user: {
      id: row.id,
      hotel_id: row.hotel_id,
      user_code: Number(row.user_code),
      display_name: row.display_name,
      email: null,
      avatar: null,
    },
    hotels: [hotel],
    hotel_ids: [hotel.hotel_id],
    permissions: permissions.map((entry) => entry.permission_key),
    expires_at: row.expires_at,
    auth_source: "erp",
    erp_master: false,
    password_change_required: false,
  };
}

async function loadAllHotels(env) {
  return all(
    env,
    `SELECT h.id AS hotel_id, h.slug, h.name, h.short_name,
            h.timezone, h.locale, h.currency, 'owner' AS access_level
       FROM hotels h
       JOIN hotel_modules hm ON hm.hotel_id = h.id
      WHERE h.status = 'active'
        AND h.archived_at IS NULL
        AND hm.module_key = ?
        AND hm.enabled = 1
      ORDER BY h.name`,
    [MODULE_KEY],
  );
}

async function loadHotel(env, hotelId) {
  return first(
    env,
    `SELECT h.id AS hotel_id, h.slug, h.name, h.short_name,
            h.timezone, h.locale, h.currency, 'operator' AS access_level
       FROM hotels h
       JOIN hotel_modules hm ON hm.hotel_id = h.id
      WHERE h.id = ?
        AND h.status = 'active'
        AND h.archived_at IS NULL
        AND hm.module_key = ?
        AND hm.enabled = 1
      LIMIT 1`,
    [hotelId, MODULE_KEY],
  );
}

function formatLoginHotel(row) {
  const custom = parseJson(row.custom_css_json);
  return {
    hotel_id: row.hotel_id,
    slug: row.slug,
    name: row.name,
    short_name: row.short_name,
    branding: {
      logo_url: row.logo_url || null,
      horizontal_logo_url: custom.horizontal_logo_url || null,
      icon_url: row.icon_url || null,
      primary_color: row.primary_color || "#513b2d",
      secondary_color: row.secondary_color || "#f4f1ef",
      accent_color: row.accent_color || "#c1a94c",
      background_color: row.background_color || "#fbf8f4",
      text_color: row.text_color || "#202124",
      font_family: row.font_family || "Inter, system-ui, sans-serif",
    },
  };
}

function normalizeUserCode(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,9}$/.test(text) || Number(text) < 1) throw unauthorized("Codigo ou senha invalidos.");
  return Number(text);
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
    `${ERP_SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${secureCookieSuffix(request, env)}`,
  );
  return headers;
}

export function clearErpSessionCookieHeaders(request, env) {
  const headers = new Headers();
  headers.append(
    "set-cookie",
    `${ERP_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureCookieSuffix(request, env)}`,
  );
  return headers;
}

function secureCookieSuffix(request, env) {
  const url = new URL(request.url);
  return url.protocol === "https:" && env.ENVIRONMENT !== "test" ? "; Secure" : "";
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
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function parseJson(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
