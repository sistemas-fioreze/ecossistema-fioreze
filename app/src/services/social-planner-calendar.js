import { all, first, run } from "../core/database.js";
import { badRequest, notFoundError, unauthorized } from "../core/errors.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "openid email https://www.googleapis.com/auth/calendar.events";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export async function getCalendarConnectionStatus({ env, session }) {
  const configured = calendarConfigured(env);
  const row = await first(env, `SELECT account_email, calendar_id, status, connected_at,
      updated_at, last_sync_at, last_error
    FROM social_planner_calendar_connections WHERE planner_user_id = ?`, [plannerUserId(session)]);
  return {
    provider: "google",
    configured,
    connected: Boolean(configured && row?.status === "active"),
    connection: row || null,
  };
}

export async function startGoogleCalendarConnection({ request, env, session }) {
  requireCalendarConfiguration(env);
  const state = randomToken(32);
  const verifier = randomToken(64);
  const challenge = base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/v1/social-planner/calendar/google/callback`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();
  await run(env, "DELETE FROM social_planner_oauth_states WHERE expires_at <= ? OR used_at IS NOT NULL", [createdAt]);
  await run(env, `INSERT INTO social_planner_oauth_states (
      state_hash, planner_user_id, code_verifier_encrypted, redirect_uri, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?)`, [
    await sha256Hex(state), plannerUserId(session), await encryptSecret(env, verifier),
    redirectUri, createdAt, expiresAt,
  ]);
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.GOOGLE_CALENDAR_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { authorization_url: url.toString(), expires_at: expiresAt };
}

export async function completeGoogleCalendarConnection({ request, env, session, fetchImpl = fetch }) {
  requireCalendarConfiguration(env);
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error")) throw unauthorized("A autorização do Google Calendar foi cancelada.");
  if (!state || !code) throw badRequest("Resposta OAuth incompleta.");
  const row = await first(env, `SELECT * FROM social_planner_oauth_states
    WHERE state_hash = ? AND used_at IS NULL AND expires_at > ?`, [await sha256Hex(state), new Date().toISOString()]);
  if (!row || row.planner_user_id !== plannerUserId(session)) throw unauthorized("Autorização do Google Calendar inválida ou expirada.");
  const usedAt = new Date().toISOString();
  const consumed = await run(env, "UPDATE social_planner_oauth_states SET used_at = ? WHERE state_hash = ? AND used_at IS NULL", [usedAt, row.state_hash]);
  if (!consumed.meta?.changes) throw unauthorized("Autorização do Google Calendar já utilizada.");

  const tokens = await googleFormRequest(fetchImpl, GOOGLE_TOKEN_URL, {
    client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
    client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
    code,
    code_verifier: await decryptSecret(env, row.code_verifier_encrypted),
    grant_type: "authorization_code",
    redirect_uri: row.redirect_uri,
  });
  if (!tokens.access_token) throw unauthorized("O Google não retornou um token de acesso válido.");
  const profile = await googleJsonRequest(fetchImpl, GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const existing = await first(env, "SELECT refresh_token_encrypted FROM social_planner_calendar_connections WHERE planner_user_id = ?", [row.planner_user_id]);
  const refreshToken = tokens.refresh_token
    ? await encryptSecret(env, tokens.refresh_token)
    : existing?.refresh_token_encrypted;
  if (!refreshToken) throw unauthorized("O Google não concedeu acesso offline. Conecte novamente e confirme a permissão.");
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
  await run(env, `INSERT INTO social_planner_calendar_connections (
      planner_user_id, provider, provider_account_id, account_email, calendar_id,
      access_token_encrypted, refresh_token_encrypted, access_token_expires_at,
      granted_scope, status, connected_at, updated_at, last_error
    ) VALUES (?, 'google', ?, ?, 'primary', ?, ?, ?, ?, 'active', ?, ?, NULL)
    ON CONFLICT(planner_user_id) DO UPDATE SET
      provider_account_id = excluded.provider_account_id,
      account_email = excluded.account_email,
      access_token_encrypted = excluded.access_token_encrypted,
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      access_token_expires_at = excluded.access_token_expires_at,
      granted_scope = excluded.granted_scope,
      status = 'active', updated_at = excluded.updated_at, last_error = NULL`, [
    row.planner_user_id, profile.sub || null, profile.email || null,
    await encryptSecret(env, tokens.access_token), refreshToken, expiresAt,
    tokens.scope || CALENDAR_SCOPE, usedAt, usedAt,
  ]);
  return { connected: true, account_email: profile.email || null };
}

export async function disconnectGoogleCalendar({ env, session }) {
  await run(env, "DELETE FROM social_planner_calendar_connections WHERE planner_user_id = ?", [plannerUserId(session)]);
  await run(env, "DELETE FROM marketing_visit_calendar_events WHERE planner_user_id = ?", [plannerUserId(session)]);
  return { disconnected: true };
}

export async function syncVisitCalendars({ env, visitId, fetchImpl = fetch }) {
  if (!calendarConfigured(env)) return { configured: false, synced: 0, failed: 0, skipped: 0 };
  const visit = await first(env, `SELECT v.*, h.short_name AS hotel_name, h.display_name AS hotel_display_name
    FROM marketing_hotel_visits v JOIN social_planner_hotels h ON h.hotel_id = v.hotel_id
    WHERE v.id = ?`, [visitId]);
  if (!visit) throw notFoundError("Visita não encontrada.");
  const targets = await all(env, `SELECT u.id AS planner_user_id, c.calendar_id, c.access_token_encrypted,
      c.refresh_token_encrypted, c.access_token_expires_at, c.status, m.provider_event_id,
      CASE WHEN a.planner_user_id IS NULL THEN 0 ELSE 1 END AS assigned
    FROM social_planner_users u
    JOIN social_planner_calendar_connections c ON c.planner_user_id = u.id
    LEFT JOIN marketing_visit_assignees a ON a.planner_user_id = u.id AND a.visit_id = ?
    LEFT JOIN marketing_visit_calendar_events m ON m.planner_user_id = u.id AND m.visit_id = ?
    WHERE c.status <> 'disconnected' AND (a.planner_user_id IS NOT NULL OR m.planner_user_id IS NOT NULL)`, [visitId, visitId]);
  const result = { configured: true, synced: 0, failed: 0, skipped: 0 };
  for (const target of targets) {
    try {
      const token = await validAccessToken(env, target, fetchImpl);
      if (!target.assigned || visit.status === "cancelled") {
        if (target.provider_event_id) await deleteGoogleEvent(fetchImpl, token, target.calendar_id, target.provider_event_id);
        await saveEventMapping(env, visitId, target.planner_user_id, target.calendar_id, null, "removed", null);
        result.synced += 1;
        continue;
      }
      const event = buildCalendarEvent(visit, target.planner_user_id);
      let saved;
      if (target.provider_event_id) {
        const response = await googleFetch(fetchImpl, `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(target.calendar_id)}/events/${encodeURIComponent(target.provider_event_id)}`, {
          method: "PUT", headers: googleHeaders(token), body: JSON.stringify(event),
        }, { allowNotFound: true });
        saved = response?.notFound ? null : response;
      }
      if (!saved) {
        saved = await googleJsonRequest(fetchImpl, `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(target.calendar_id)}/events`, {
          method: "POST", headers: googleHeaders(token), body: JSON.stringify(event),
        });
      }
      await saveEventMapping(env, visitId, target.planner_user_id, target.calendar_id, saved.id, "synced", null);
      await run(env, "UPDATE social_planner_calendar_connections SET last_sync_at = ?, last_error = NULL WHERE planner_user_id = ?", [new Date().toISOString(), target.planner_user_id]);
      result.synced += 1;
    } catch (error) {
      const message = String(error?.message || "Falha ao sincronizar calendário.").slice(0, 500);
      await saveEventMapping(env, visitId, target.planner_user_id, target.calendar_id, target.provider_event_id, "failed", message);
      await run(env, "UPDATE social_planner_calendar_connections SET last_error = ?, updated_at = ? WHERE planner_user_id = ?", [message, new Date().toISOString(), target.planner_user_id]);
      result.failed += 1;
    }
  }
  result.skipped = Math.max(0, (await all(env, "SELECT planner_user_id FROM marketing_visit_assignees WHERE visit_id = ?", [visitId])).length - targets.filter((target) => target.assigned).length);
  return result;
}

export async function removeVisitCalendarEvents({ env, visitId, fetchImpl = fetch }) {
  if (!calendarConfigured(env)) return { configured: false, removed: 0 };
  const mappings = await all(env, `SELECT m.*, c.access_token_encrypted, c.refresh_token_encrypted,
      c.access_token_expires_at, c.status
    FROM marketing_visit_calendar_events m
    JOIN social_planner_calendar_connections c ON c.planner_user_id = m.planner_user_id
    WHERE m.visit_id = ? AND m.provider_event_id IS NOT NULL`, [visitId]);
  let removed = 0;
  for (const mapping of mappings) {
    try {
      const token = await validAccessToken(env, mapping, fetchImpl);
      await deleteGoogleEvent(fetchImpl, token, mapping.calendar_id, mapping.provider_event_id);
      removed += 1;
    } catch {
      // The local visit can still be removed; stale remote events remain visible in sync diagnostics.
    }
  }
  return { configured: true, removed };
}

function plannerUserId(session) {
  const id = session?.user?.planner_user_id;
  if (!id) throw unauthorized("Usuário do Planner não identificado.");
  return id;
}

function calendarConfigured(env) {
  return Boolean(env?.GOOGLE_CALENDAR_CLIENT_ID && env?.GOOGLE_CALENDAR_CLIENT_SECRET && env?.GOOGLE_CALENDAR_TOKEN_KEY);
}

function requireCalendarConfiguration(env) {
  if (!calendarConfigured(env)) throw badRequest("A integração com Google Calendar ainda não foi configurada neste ambiente.");
}

async function validAccessToken(env, connection, fetchImpl) {
  if (connection.status === "reauthorization_required") throw unauthorized("Reconecte o Google Calendar.");
  if (connection.access_token_encrypted && Date.parse(connection.access_token_expires_at || "") > Date.now() + 60_000) {
    return decryptSecret(env, connection.access_token_encrypted);
  }
  if (!connection.refresh_token_encrypted) throw unauthorized("Reconecte o Google Calendar.");
  try {
    const tokens = await googleFormRequest(fetchImpl, GOOGLE_TOKEN_URL, {
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
      refresh_token: await decryptSecret(env, connection.refresh_token_encrypted),
      grant_type: "refresh_token",
    });
    const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
    await run(env, `UPDATE social_planner_calendar_connections
      SET access_token_encrypted = ?, access_token_expires_at = ?, status = 'active', updated_at = ?, last_error = NULL
      WHERE planner_user_id = ?`, [await encryptSecret(env, tokens.access_token), expiresAt, new Date().toISOString(), connection.planner_user_id]);
    return tokens.access_token;
  } catch (error) {
    await run(env, `UPDATE social_planner_calendar_connections
      SET status = 'reauthorization_required', last_error = ?, updated_at = ? WHERE planner_user_id = ?`, [
      String(error?.message || "Token expirado.").slice(0, 500), new Date().toISOString(), connection.planner_user_id,
    ]);
    throw error;
  }
}

function buildCalendarEvent(visit, plannerUserIdValue) {
  const event = {
    summary: `${visit.hotel_name} · ${visit.title}`,
    description: [visit.description, visit.notes, "Visita criada no Fioreze Marketing Planner."].filter(Boolean).join("\n\n"),
    location: visit.hotel_display_name || visit.hotel_name,
    extendedProperties: { private: { fioreze_visit_id: visit.id, fioreze_planner_user_id: plannerUserIdValue } },
  };
  if (!visit.start_time) {
    event.start = { date: visit.date };
    event.end = { date: addDays(visit.date, 1) };
  } else {
    event.start = { dateTime: `${visit.date}T${visit.start_time}:00`, timeZone: "America/Sao_Paulo" };
    const fallback = addMinutes(visit.date, visit.start_time, 60);
    event.end = visit.end_time
      ? { dateTime: `${visit.date}T${visit.end_time}:00`, timeZone: "America/Sao_Paulo" }
      : { dateTime: `${fallback.date}T${fallback.time}:00`, timeZone: "America/Sao_Paulo" };
  }
  return event;
}

async function deleteGoogleEvent(fetchImpl, token, calendarId, eventId) {
  const response = await fetchImpl(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE", headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error(`Google Calendar respondeu ${response.status}.`);
}

async function saveEventMapping(env, visitId, userId, calendarId, eventId, status, error) {
  await run(env, `INSERT INTO marketing_visit_calendar_events (
      visit_id, planner_user_id, calendar_id, provider_event_id, sync_status, last_synced_at, last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(visit_id, planner_user_id) DO UPDATE SET
      calendar_id = excluded.calendar_id, provider_event_id = excluded.provider_event_id,
      sync_status = excluded.sync_status, last_synced_at = excluded.last_synced_at,
      last_error = excluded.last_error`, [visitId, userId, calendarId, eventId || null, status, new Date().toISOString(), error]);
}

async function googleFormRequest(fetchImpl, url, body) {
  return googleJsonRequest(fetchImpl, url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
}

async function googleJsonRequest(fetchImpl, url, init = {}) {
  return googleFetch(fetchImpl, url, init);
}

async function googleFetch(fetchImpl, url, init = {}, options = {}) {
  const response = await fetchImpl(url, { ...init, signal: init.signal || AbortSignal.timeout(10_000) });
  if (options.allowNotFound && response.status === 404) return { notFound: true };
  const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.error?.message || `Google respondeu ${response.status}.`);
  return payload;
}

function googleHeaders(token) {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function encryptSecret(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), new TextEncoder().encode(value));
  return `v1.${base64Url(iv)}.${base64Url(encrypted)}`;
}

async function decryptSecret(env, value) {
  const [version, iv, encrypted] = String(value || "").split(".");
  if (version !== "v1" || !iv || !encrypted) throw unauthorized("Credencial de calendário inválida.");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(iv) }, await encryptionKey(env), fromBase64Url(encrypted));
  return new TextDecoder().decode(plaintext);
}

async function encryptionKey(env) {
  requireCalendarConfiguration(env);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.GOOGLE_CALENDAR_TOKEN_KEY));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function randomToken(size) { return base64Url(crypto.getRandomValues(new Uint8Array(size))); }
async function sha256Hex(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function base64Url(value) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function addDays(date, days) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
function addMinutes(date, time, minutes) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return {
    date: addDays(date, Math.floor(total / 1440)),
    time: `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`,
  };
}
