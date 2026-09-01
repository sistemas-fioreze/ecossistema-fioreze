import qrcode from "qrcode-generator";
import { all, batch, first, run, statement } from "../core/database.js";
import { badRequest, conflict, forbidden, unauthorized } from "../core/errors.js";
import { createPublicId } from "../core/identifiers.js";
import { requestNow } from "../core/time.js";
import { readJson, requireString } from "../core/validation.js";
import { assertAdminMutationAllowed, createAdminSessionForVerifiedUser, verifyPassword } from "./admin-auth.js";
import { createLoginSecurityContext, prepareLoginSecurity, recordLoginFailure } from "./admin-login-security.js";

const ISSUER = "Fioreze";
const PERIOD_SECONDS = 30;
const DIGITS = 6;
const SETUP_TTL_MS = 10 * 60 * 1000;
const LOGIN_TTL_MS = 5 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KEY_INFO = "fioreze-admin-totp-aes-gcm-v1";
const KEY_SALT = "fioreze-admin-totp-hkdf-salt-v1";

export async function getOwnAdminTotpStatus({ env, session }) {
  const config = await first(
    env,
    `SELECT enabled_at, updated_at
       FROM admin_totp_config
      WHERE user_id = ?
      LIMIT 1`,
    [session.user.id],
  );
  if (!config) return { enabled: false, enabled_at: null, recovery_codes_remaining: 0 };
  const row = await first(
    env,
    `SELECT COUNT(*) AS recovery_count
       FROM admin_totp_recovery_codes
      WHERE user_id = ?
        AND used_at IS NULL`,
    [session.user.id],
  );
  return {
    enabled: true,
    enabled_at: config.enabled_at,
    updated_at: config.updated_at,
    recovery_codes_remaining: Number(row?.recovery_count || 0),
  };
}

export async function beginOwnAdminTotpSetup({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  if (session.password_change_required) throw forbidden("Troque a senha temporária antes de configurar o autenticador.");
  const payload = await readJson(request);
  await requireCurrentPassword({ env, userId: session.user.id, password: payload.current_password });
  const existing = await first(env, `SELECT user_id FROM admin_totp_config WHERE user_id = ? LIMIT 1`, [session.user.id]);
  if (existing) throw conflict("O aplicativo autenticador já está configurado para esta conta.");

  const now = requestNow({ request, env });
  await cleanupExpiredChallenges(env, now);
  const secret = randomBase32Secret();
  const encrypted = await encryptSecret(env, secret);
  const setupToken = randomBase64Url(32);
  const tokenHash = await sha256Hex(setupToken);
  const expiresAt = new Date(Date.parse(now) + SETUP_TTL_MS).toISOString();
  await run(
    env,
    `INSERT INTO admin_totp_setup_challenges (
       token_hash, user_id, secret_ciphertext, secret_iv, created_at, expires_at, consumed_at
     ) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    [tokenHash, session.user.id, encrypted.ciphertext, encrypted.iv, now, expiresAt],
  );

  const label = session.user.email || session.user.display_name || "Administrador";
  const uri = createOtpAuthUri({ label, secret });
  return {
    setup_token: setupToken,
    expires_at: expiresAt,
    secret,
    otpauth_uri: uri,
    qr_svg: createQrSvg(uri),
    issuer: ISSUER,
    account_name: label,
    period: PERIOD_SECONDS,
    digits: DIGITS,
    algorithm: "SHA1",
  };
}

export async function finishOwnAdminTotpSetup({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const setupToken = requireString(payload.setup_token, "setup_token", { max: 256 });
  const code = normalizeTotpCode(payload.code);
  const now = requestNow({ request, env });
  const tokenHash = await sha256Hex(setupToken);
  const challenge = await first(
    env,
    `SELECT token_hash, user_id, secret_ciphertext, secret_iv, expires_at
       FROM admin_totp_setup_challenges
      WHERE token_hash = ?
        AND user_id = ?
        AND consumed_at IS NULL
        AND expires_at > ?
      LIMIT 1`,
    [tokenHash, session.user.id, now],
  );
  if (!challenge) throw unauthorized("Configuração do autenticador inválida ou expirada.");
  const secret = await decryptSecret(env, challenge.secret_ciphertext, challenge.secret_iv);
  const match = await verifyTotp(secret, code, now, null);
  if (!match) throw unauthorized("Código do autenticador inválido.");

  const recoveryCodes = generateRecoveryCodes();
  const recoveryRows = await Promise.all(
    recoveryCodes.map(async (codeValue) => ({ id: createPublicId("recovery"), hash: await sha256Hex(normalizeRecoveryCode(codeValue)) })),
  );
  const encrypted = await encryptSecret(env, secret);
  const statements = [
    statement(
      env,
      `UPDATE admin_totp_setup_challenges SET consumed_at = ?
        WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?`,
      [now, tokenHash, now],
    ),
    statement(
      env,
      `INSERT INTO admin_totp_config (
         user_id, secret_ciphertext, secret_iv, enabled_at, created_at, updated_at, last_used_step
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [session.user.id, encrypted.ciphertext, encrypted.iv, now, now, now, match.step],
    ),
    ...recoveryRows.map((row) =>
      statement(
        env,
        `INSERT INTO admin_totp_recovery_codes (id, user_id, code_hash, created_at, used_at)
         VALUES (?, ?, ?, ?, NULL)`,
        [row.id, session.user.id, row.hash, now],
      ),
    ),
  ];
  try {
    await batch(env, statements);
  } catch (error) {
    if (/unique|constraint/i.test(String(error?.message || error))) throw conflict("O autenticador já está configurado.");
    throw error;
  }
  await auditTotp(env, session.user.id, "admin-totp.enable", { recovery_codes: recoveryCodes.length }, now);
  return { enabled: true, enabled_at: now, recovery_codes: recoveryCodes };
}

export async function regenerateOwnAdminTotpRecoveryCodes({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  await requireCurrentPassword({ env, userId: session.user.id, password: payload.current_password });
  const now = requestNow({ request, env });
  const factor = await verifyOwnSecondFactor({ env, userId: session.user.id, code: payload.code, now });
  const recoveryCodes = generateRecoveryCodes();
  const recoveryRows = await Promise.all(
    recoveryCodes.map(async (codeValue) => ({ id: createPublicId("recovery"), hash: await sha256Hex(normalizeRecoveryCode(codeValue)) })),
  );
  const statements = [
    statement(env, `DELETE FROM admin_totp_recovery_codes WHERE user_id = ?`, [session.user.id]),
    ...recoveryRows.map((row) =>
      statement(
        env,
        `INSERT INTO admin_totp_recovery_codes (id, user_id, code_hash, created_at, used_at)
         VALUES (?, ?, ?, ?, NULL)`,
        [row.id, session.user.id, row.hash, now],
      ),
    ),
  ];
  await batch(env, statements);
  await auditTotp(env, session.user.id, "admin-totp.recovery-regenerate", { verified_with: factor.method }, now);
  return { recovery_codes: recoveryCodes, recovery_codes_remaining: recoveryCodes.length };
}

export async function disableOwnAdminTotp({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  await requireCurrentPassword({ env, userId: session.user.id, password: payload.current_password });
  const now = requestNow({ request, env });
  const factor = await verifyOwnSecondFactor({ env, userId: session.user.id, code: payload.code, now });
  await batch(env, [
    statement(env, `DELETE FROM admin_totp_recovery_codes WHERE user_id = ?`, [session.user.id]),
    statement(env, `DELETE FROM admin_totp_config WHERE user_id = ?`, [session.user.id]),
    statement(env, `DELETE FROM admin_totp_login_challenges WHERE user_id = ?`, [session.user.id]),
  ]);
  await auditTotp(env, session.user.id, "admin-totp.disable", { verified_with: factor.method }, now);
  return { enabled: false };
}

export async function beginAdminTotpLoginChallengeIfEnabled({ env, user, securityContext, createdAt, sessionType }) {
  if (!Number(user.totp_enabled || 0)) return null;
  const token = randomBase64Url(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.parse(createdAt) + LOGIN_TTL_MS).toISOString();
  await run(
    env,
    `INSERT INTO admin_totp_login_challenges (
       token_hash, user_id, account_hash, ip_hash, session_type, attempt_count, created_at, expires_at, consumed_at
     ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
    [tokenHash, user.id, securityContext.accountHash, securityContext.ipHash, sessionType, createdAt, expiresAt],
  );
  return {
    mfa_required: true,
    mfa_method: "totp",
    challenge_token: token,
    expires_at: expiresAt,
  };
}

export async function finishAdminTotpLogin({ request, env }) {
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const challengeToken = requireString(payload.challenge_token, "challenge_token", { max: 256 });
  const rawCode = requireString(payload.code, "código", { max: 64 });
  const now = requestNow({ request, env });
  const tokenHash = await sha256Hex(challengeToken);
  const row = await first(
    env,
    `SELECT c.token_hash, c.user_id, c.account_hash, c.ip_hash, c.session_type, c.attempt_count, c.expires_at,
            u.user_number, u.display_name, u.email, u.status, u.force_password_change,
            u.avatar_object_key, u.avatar_mime_type, u.avatar_updated_at,
            t.secret_ciphertext, t.secret_iv, t.last_used_step
       FROM admin_totp_login_challenges c
       JOIN admin_users u ON u.id = c.user_id
       JOIN admin_totp_config t ON t.user_id = c.user_id
      WHERE c.token_hash = ?
        AND c.consumed_at IS NULL
        AND c.expires_at > ?
      LIMIT 1`,
    [tokenHash, now],
  );
  if (!row || row.status !== "active") throw unauthorized("Desafio de autenticação inválido ou expirado.");
  if (Number(row.attempt_count || 0) >= MAX_LOGIN_ATTEMPTS) throw unauthorized("Desafio de autenticação expirado.");

  const securityContext = await createLoginSecurityContext({ request, env, email: row.email, now });
  await prepareLoginSecurity({ env, context: securityContext });
  if (securityContext.accountHash !== row.account_hash || securityContext.ipHash !== row.ip_hash) {
    throw unauthorized("Desafio de autenticação não pertence a esta conexão.");
  }

  let factor;
  const numeric = String(rawCode).replace(/\D/g, "");
  if (numeric.length === DIGITS) {
    const secret = await decryptSecret(env, row.secret_ciphertext, row.secret_iv);
    const match = await verifyTotp(secret, numeric, now, row.last_used_step == null ? null : Number(row.last_used_step));
    if (match) factor = { method: "totp", step: match.step };
  }
  if (!factor) {
    const recovery = normalizeRecoveryCode(rawCode);
    if (recovery.length >= 12) {
      const codeHash = await sha256Hex(recovery);
      const recoveryRow = await first(
        env,
        `SELECT id FROM admin_totp_recovery_codes
          WHERE user_id = ? AND code_hash = ? AND used_at IS NULL
          LIMIT 1`,
        [row.user_id, codeHash],
      );
      if (recoveryRow) factor = { method: "recovery", recoveryId: recoveryRow.id };
    }
  }

  if (!factor) {
    await run(
      env,
      `UPDATE admin_totp_login_challenges
          SET attempt_count = attempt_count + 1
        WHERE token_hash = ? AND consumed_at IS NULL`,
      [tokenHash],
    );
    return recordLoginFailure({ env, context: securityContext, reasonCode: "totp_invalid" });
  }

  const consumed = await run(
    env,
    `UPDATE admin_totp_login_challenges
        SET consumed_at = ?
      WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?`,
    [now, tokenHash, now],
  );
  if (Number(consumed?.meta?.changes || 0) !== 1) throw unauthorized("Desafio de autenticação já utilizado.");
  if (factor.method === "totp") {
    await run(
      env,
      `UPDATE admin_totp_config SET last_used_step = ?, updated_at = ? WHERE user_id = ?`,
      [factor.step, now, row.user_id],
    );
  } else {
    await run(
      env,
      `UPDATE admin_totp_recovery_codes SET used_at = ? WHERE id = ? AND user_id = ? AND used_at IS NULL`,
      [now, factor.recoveryId, row.user_id],
    );
  }

  const loginResult = await createAdminSessionForVerifiedUser({
    request,
    env,
    user: row,
    securityContext,
    createdAt: now,
    sessionType: row.session_type,
  });
  await auditTotp(env, row.user_id, "admin-totp.login", { method: factor.method }, now);
  return loginResult;
}

async function verifyOwnSecondFactor({ env, userId, code, now }) {
  const config = await first(
    env,
    `SELECT secret_ciphertext, secret_iv, last_used_step FROM admin_totp_config WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  if (!config) throw badRequest("O aplicativo autenticador não está configurado.");
  const numeric = String(code || "").replace(/\D/g, "");
  if (numeric.length === DIGITS) {
    const secret = await decryptSecret(env, config.secret_ciphertext, config.secret_iv);
    const match = await verifyTotp(secret, numeric, now, config.last_used_step == null ? null : Number(config.last_used_step));
    if (match) {
      await run(env, `UPDATE admin_totp_config SET last_used_step = ?, updated_at = ? WHERE user_id = ?`, [match.step, now, userId]);
      return { method: "totp" };
    }
  }
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length >= 12) {
    const hash = await sha256Hex(normalized);
    const recovery = await first(
      env,
      `SELECT id FROM admin_totp_recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1`,
      [userId, hash],
    );
    if (recovery) {
      await run(env, `UPDATE admin_totp_recovery_codes SET used_at = ? WHERE id = ? AND used_at IS NULL`, [now, recovery.id]);
      return { method: "recovery" };
    }
  }
  throw unauthorized("Código de verificação inválido.");
}

async function requireCurrentPassword({ env, userId, password }) {
  const currentPassword = requireString(password, "senha atual", { max: 300 });
  const user = await first(
    env,
    `SELECT id, password_hash, status FROM admin_users WHERE id = ? LIMIT 1`,
    [userId],
  );
  if (!user || user.status !== "active" || !(await verifyPassword(currentPassword, user.password_hash))) {
    throw unauthorized("Confirme sua senha atual para continuar.");
  }
  return user;
}

async function cleanupExpiredChallenges(env, now) {
  await batch(env, [
    statement(env, `DELETE FROM admin_totp_setup_challenges WHERE expires_at <= ? OR consumed_at IS NOT NULL`, [now]),
    statement(env, `DELETE FROM admin_totp_login_challenges WHERE expires_at <= ? OR consumed_at IS NOT NULL`, [now]),
  ]);
}

function createOtpAuthUri({ label, secret }) {
  const encodedIssuer = encodeURIComponent(ISSUER);
  const encodedLabel = encodeURIComponent(`${ISSUER}:${label}`);
  return `otpauth://totp/${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD_SECONDS}`;
}

function createQrSvg(value) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  const size = count + quiet * 2;
  let path = "";
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR Code do autenticador"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#111"/></svg>`;
}

async function verifyTotp(secret, code, now, lastUsedStep) {
  const unixSeconds = Math.floor(Date.parse(now) / 1000);
  const currentStep = Math.floor(unixSeconds / PERIOD_SECONDS);
  for (const offset of [-1, 0, 1]) {
    const step = currentStep + offset;
    if (lastUsedStep != null && step <= lastUsedStep) continue;
    const expected = await hotp(secret, step);
    if (constantTimeStringEqual(expected, code)) return { step };
  }
  return null;
}

async function hotp(secret, counter) {
  const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const bytes = new Uint8Array(8);
  let value = BigInt(counter);
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = Number(value & 0xffn);
    value >>= 8n;
  }
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

async function encryptSecret(env, secret) {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret)));
  return { ciphertext: toBase64Url(ciphertext), iv: toBase64Url(iv) };
}

async function decryptSecret(env, ciphertext, iv) {
  try {
    const key = await encryptionKey(env);
    const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(iv) }, key, fromBase64Url(ciphertext));
    return new TextDecoder().decode(clear);
  } catch {
    throw forbidden("Não foi possível acessar a configuração do autenticador.");
  }
}

async function encryptionKey(env) {
  const material = String(env.TOTP_ENCRYPTION_KEY || env.LOGIN_RATE_LIMIT_KEY || "");
  if (material.length < 32) throw forbidden("A proteção criptográfica do autenticador não está configurada.");
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(material), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(KEY_SALT),
      info: new TextEncoder().encode(KEY_INFO),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function randomBase32Secret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

function generateRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    let value = "";
    for (let index = 0; index < 16; index += 1) value += RECOVERY_ALPHABET[bytes[index] % RECOVERY_ALPHABET.length];
    return value.match(/.{1,4}/g).join("-");
  });
}

function normalizeTotpCode(value) {
  const normalized = requireString(value, "código", { max: 32 }).replace(/\D/g, "");
  if (normalized.length !== DIGITS) throw badRequest("Digite o código de 6 dígitos do autenticador.");
  return normalized;
}

function normalizeRecoveryCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z2-9]/g, "");
}

function base32Encode(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(value || "").toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw badRequest("Segredo TOTP inválido.");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

function randomBase64Url(byteLength) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value) {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(normalized + padding), (char) => char.charCodeAt(0));
}

function constantTimeStringEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

async function auditTotp(env, userId, action, metadata, now) {
  await run(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
     ) VALUES (?, NULL, NULL, ?, ?, 'admin_totp', ?, ?, ?)`,
    [createPublicId("audit"), userId, action, userId, JSON.stringify(metadata || {}), now],
  );
}

export const __test = {
  base32Decode,
  base32Encode,
  createOtpAuthUri,
  generateRecoveryCodes,
  hotp,
  verifyTotp,
};
