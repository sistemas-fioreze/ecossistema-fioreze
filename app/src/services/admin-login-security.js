import { first, run, statement } from "../core/database.js";
import { AppError, unauthorized } from "../core/errors.js";
import { createPublicId } from "../core/identifiers.js";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "admin_login";
const TURNSTILE_TIMEOUT_MS = 5000;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_RETENTION_MS = 48 * 60 * 60 * 1000;
const EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const LOCK_DURATIONS_MS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
const ACCOUNT_FAILURE_LIMIT = 5;
const IP_FAILURE_LIMIT = 10;
const GENERIC_LOGIN_MESSAGE = "Nao foi possivel concluir o acesso.";

export function getAdminLoginPublicConfig(env) {
  const enabled = isTurnstileEnabled(env);
  return {
    TURNSTILE_ENABLED: enabled,
    TURNSTILE_SITE_KEY: enabled ? String(env.TURNSTILE_SITE_KEY || "") : "",
  };
}

export async function createLoginSecurityContext({ request, env, email, now }) {
  const secret = String(env.LOGIN_RATE_LIMIT_KEY || "");
  if (secret.length < 32) throw securityUnavailable();

  const rawIp = clientIp(request, env);
  const [accountHash, ipHash] = await Promise.all([
    hmacSha256Hex(secret, `account:${String(email).trim().toLowerCase()}`),
    hmacSha256Hex(secret, `ip:${rawIp}`),
  ]);

  return { accountHash, ipHash, rawIp, now };
}

export async function prepareLoginSecurity({ env, context }) {
  try {
    await env.DB.batch([
      statement(env, "DELETE FROM admin_login_attempts WHERE expires_at <= ?", [context.now]),
      statement(env, "DELETE FROM admin_login_security_events WHERE expires_at <= ?", [context.now]),
    ]);
  } catch {
    throw securityUnavailable();
  }
  await assertLoginNotBlocked({ env, context });
}

export async function assertLoginNotBlocked({ env, context }) {
  let blocked;
  try {
    blocked = await first(
      env,
      `SELECT identifier_type, locked_until
         FROM admin_login_attempts
        WHERE ((identifier_type = 'account' AND identifier_hash = ?)
            OR (identifier_type = 'ip' AND identifier_hash = ?))
          AND locked_until > ?
        ORDER BY locked_until DESC
        LIMIT 1`,
      [context.accountHash, context.ipHash, context.now],
    );
  } catch {
    throw securityUnavailable();
  }
  if (blocked) throw rateLimitError(blocked.locked_until, context.now);
}

export async function verifyAdminTurnstile({ request, env, token, context }) {
  if (!isTurnstileEnabled(env)) return { enabled: false };

  const siteKey = String(env.TURNSTILE_SITE_KEY || "").trim();
  const secret = String(env.TURNSTILE_SECRET_KEY || "").trim();
  const allowedHostnames = parseAllowedHostnames(env.TURNSTILE_ALLOWED_HOSTNAMES);
  if (!siteKey || !secret || !allowedHostnames.size) {
    await recordChallengeUnavailable({ env, context, reasonCode: "configuration_unavailable" });
    throw securityUnavailable();
  }

  if (typeof token !== "string" || !token.trim()) {
    return { enabled: true, valid: false, reasonCode: "token_missing" };
  }
  if (token.trim().length > 2048) {
    return { enabled: true, valid: false, reasonCode: "token_invalid" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
  try {
    const body = new URLSearchParams({
      secret,
      response: token.trim(),
      idempotency_key: crypto.randomUUID(),
    });
    if (context.rawIp !== "unavailable-client" && context.rawIp !== "test-client") {
      body.set("remoteip", context.rawIp);
    }
    const fetchImpl = env.ENVIRONMENT === "test" && env.__testTurnstileFetch ? env.__testTurnstileFetch : globalThis.fetch;
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("turnstile_http_error");
    const result = await response.json();
    if (!result?.success) {
      return {
        enabled: true,
        valid: false,
        reasonCode: classifyTurnstileFailure(result?.["error-codes"]),
      };
    }
    if (result.action !== TURNSTILE_ACTION) {
      return { enabled: true, valid: false, reasonCode: "action_mismatch" };
    }
    if (!allowedHostnames.has(String(result.hostname || "").trim().toLowerCase())) {
      return { enabled: true, valid: false, reasonCode: "hostname_mismatch" };
    }
    return { enabled: true, valid: true };
  } catch {
    await recordChallengeUnavailable({ env, context, reasonCode: "verification_unavailable" });
    throw securityUnavailable();
  } finally {
    clearTimeout(timeout);
  }
}

export async function recordLoginFailure({ env, context, reasonCode }) {
  const accountStatement = failureUpsertStatement(env, {
    identifierType: "account",
    identifierHash: context.accountHash,
    threshold: ACCOUNT_FAILURE_LIMIT,
    now: context.now,
  });
  const ipStatement = failureUpsertStatement(env, {
    identifierType: "ip",
    identifierHash: context.ipHash,
    threshold: IP_FAILURE_LIMIT,
    now: context.now,
  });
  const eventStatement = securityEventStatement(env, {
    eventType: "login_failure",
    reasonCode,
    context,
  });

  let results;
  try {
    results = await env.DB.batch([accountStatement, ipStatement, eventStatement]);
  } catch {
    throw securityUnavailable();
  }

  const lockRows = results
    .slice(0, 2)
    .flatMap((result) => result.results || [])
    .filter((row) => row.locked_until && row.locked_until > context.now)
    .sort((left, right) => right.locked_until.localeCompare(left.locked_until));
  if (lockRows[0]) {
    try {
      await securityEventStatement(env, {
        eventType: "login_blocked",
        reasonCode: "failure_limit_reached",
        context,
      }).run();
    } catch {
      // O bloqueio permanece valido mesmo se a telemetria nao puder ser registrada.
    }
    throw rateLimitError(lockRows[0].locked_until, context.now);
  }
  throw unauthorized(GENERIC_LOGIN_MESSAGE);
}

export async function createProtectedAdminSession({ env, context, sessionRecord }) {
  const sessionInsert = statement(
    env,
    `INSERT INTO admin_sessions (
       id, user_id, token_hash, user_agent_hash, ip_hash, session_type, created_at, expires_at
     )
     SELECT ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1
          FROM admin_login_attempts
         WHERE ((identifier_type = 'account' AND identifier_hash = ?)
             OR (identifier_type = 'ip' AND identifier_hash = ?))
           AND locked_until > ?
      )`,
    [
      sessionRecord.id,
      sessionRecord.userId,
      sessionRecord.tokenHash,
      sessionRecord.userAgentHash,
      sessionRecord.ipHash,
      sessionRecord.sessionType,
      sessionRecord.createdAt,
      sessionRecord.expiresAt,
      context.accountHash,
      context.ipHash,
      context.now,
    ],
  );
  const resetAccount = statement(
    env,
    `DELETE FROM admin_login_attempts
      WHERE identifier_type = 'account'
        AND identifier_hash = ?
        AND EXISTS (SELECT 1 FROM admin_sessions WHERE id = ?)`,
    [context.accountHash, sessionRecord.id],
  );
  const successEvent = statement(
    env,
    `INSERT INTO admin_login_security_events (
       id, event_type, account_hash, ip_hash, reason_code, metadata_json, created_at, expires_at
     )
     SELECT ?, 'login_success', ?, ?, 'credentials_valid', NULL, ?, ?
      WHERE EXISTS (SELECT 1 FROM admin_sessions WHERE id = ?)`,
    [
      createPublicId("security"),
      context.accountHash,
      context.ipHash,
      context.now,
      isoOffset(context.now, EVENT_RETENTION_MS),
      sessionRecord.id,
    ],
  );

  let results;
  try {
    results = await env.DB.batch([sessionInsert, resetAccount, successEvent]);
  } catch {
    throw securityUnavailable();
  }
  if (Number(results[0]?.meta?.changes || 0) !== 1) {
    await assertLoginNotBlocked({ env, context });
    throw securityUnavailable();
  }
}

function failureUpsertStatement(env, { identifierType, identifierHash, threshold, now }) {
  const cutoff = isoOffset(now, -FAILURE_WINDOW_MS);
  const expiresAt = isoOffset(now, ATTEMPT_RETENTION_MS);
  const lockUntil = LOCK_DURATIONS_MS.map((duration) => isoOffset(now, duration));
  return statement(
    env,
    `INSERT INTO admin_login_attempts (
       identifier_type, identifier_hash, failure_count, lock_level,
       window_started_at, last_failed_at, locked_until, expires_at, created_at, updated_at
     ) VALUES (?, ?, 1, 0, ?, ?, NULL, ?, ?, ?)
     ON CONFLICT(identifier_type, identifier_hash) DO UPDATE SET
       failure_count = CASE
         WHEN admin_login_attempts.locked_until > excluded.last_failed_at THEN admin_login_attempts.failure_count
         WHEN admin_login_attempts.window_started_at <= ? THEN 1
         WHEN admin_login_attempts.failure_count + 1 >= ? THEN 0
         ELSE admin_login_attempts.failure_count + 1
       END,
       lock_level = CASE
         WHEN admin_login_attempts.locked_until > excluded.last_failed_at THEN admin_login_attempts.lock_level
         WHEN admin_login_attempts.window_started_at > ? AND admin_login_attempts.failure_count + 1 >= ?
           THEN MIN(admin_login_attempts.lock_level + 1, 4)
         ELSE admin_login_attempts.lock_level
       END,
       window_started_at = CASE
         WHEN admin_login_attempts.locked_until > excluded.last_failed_at THEN admin_login_attempts.window_started_at
         WHEN admin_login_attempts.window_started_at <= ?
           OR (admin_login_attempts.window_started_at > ? AND admin_login_attempts.failure_count + 1 >= ?)
           THEN excluded.last_failed_at
         ELSE admin_login_attempts.window_started_at
       END,
       locked_until = CASE
         WHEN admin_login_attempts.locked_until > excluded.last_failed_at THEN admin_login_attempts.locked_until
         WHEN admin_login_attempts.window_started_at > ? AND admin_login_attempts.failure_count + 1 >= ?
           THEN CASE MIN(admin_login_attempts.lock_level + 1, 4)
             WHEN 1 THEN ? WHEN 2 THEN ? WHEN 3 THEN ? ELSE ? END
         WHEN admin_login_attempts.locked_until <= excluded.last_failed_at THEN NULL
         ELSE admin_login_attempts.locked_until
       END,
       last_failed_at = CASE
         WHEN admin_login_attempts.locked_until > excluded.last_failed_at THEN admin_login_attempts.last_failed_at
         ELSE excluded.last_failed_at
       END,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at
     RETURNING identifier_type, failure_count, lock_level, locked_until`,
    [
      identifierType,
      identifierHash,
      now,
      now,
      expiresAt,
      now,
      now,
      cutoff,
      threshold,
      cutoff,
      threshold,
      cutoff,
      cutoff,
      threshold,
      cutoff,
      threshold,
      ...lockUntil,
    ],
  );
}

function securityEventStatement(env, { eventType, reasonCode, context }) {
  return statement(
    env,
    `INSERT INTO admin_login_security_events (
       id, event_type, account_hash, ip_hash, reason_code, metadata_json, created_at, expires_at
     ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      createPublicId("security"),
      eventType,
      context.accountHash,
      context.ipHash,
      reasonCode,
      context.now,
      isoOffset(context.now, EVENT_RETENTION_MS),
    ],
  );
}

async function recordChallengeUnavailable({ env, context, reasonCode }) {
  try {
    await run(
      env,
      `INSERT INTO admin_login_security_events (
         id, event_type, account_hash, ip_hash, reason_code, metadata_json, created_at, expires_at
       ) VALUES (?, 'challenge_unavailable', ?, ?, ?, NULL, ?, ?)`,
      [
        createPublicId("security"),
        context.accountHash,
        context.ipHash,
        reasonCode,
        context.now,
        isoOffset(context.now, EVENT_RETENTION_MS),
      ],
    );
  } catch {
    // A resposta permanece fechada mesmo quando o registro de seguranca falha.
  }
}

function isTurnstileEnabled(env) {
  return String(env.TURNSTILE_ENABLED || "false").trim().toLowerCase() === "true";
}

function parseAllowedHostnames(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function clientIp(request, env) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedIp) return forwardedIp;
  return env.ENVIRONMENT === "test" ? "test-client" : "unavailable-client";
}

function classifyTurnstileFailure(errorCodes) {
  const codes = Array.isArray(errorCodes) ? errorCodes : [];
  if (codes.includes("timeout-or-duplicate")) return "token_expired_or_reused";
  if (codes.includes("missing-input-response")) return "token_missing";
  return "token_invalid";
}

function rateLimitError(lockedUntil, now) {
  const seconds = Math.max(1, Math.ceil((Date.parse(lockedUntil) - Date.parse(now)) / 1000));
  return new AppError(429, "too_many_attempts", "Muitas tentativas. Tente novamente mais tarde.", undefined, {
    headers: { "retry-after": String(seconds) },
  });
}

function securityUnavailable() {
  return new AppError(503, "login_security_unavailable", "Nao foi possivel validar o acesso neste momento.");
}

async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isoOffset(now, milliseconds) {
  return new Date(Date.parse(now) + milliseconds).toISOString();
}
