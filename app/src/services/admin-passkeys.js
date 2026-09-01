import { all, first, run } from "../core/database.js";
import { badRequest, conflict, forbidden, unauthorized } from "../core/errors.js";
import { createPublicId } from "../core/identifiers.js";
import { requestNow } from "../core/time.js";
import { optionalString, readJson, requireString } from "../core/validation.js";
import {
  ADMIN_SESSION_COOKIE,
  assertAdminMutationAllowed,
  verifyPassword,
} from "./admin-auth.js";
import {
  createLoginSecurityContext,
  createProtectedAdminSession,
  prepareLoginSecurity,
  recordLoginChallengeFailure,
  recordLoginFailure,
} from "./admin-login-security.js";

const RP_NAME = "Central Administrativa Fioreze";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_TOKEN_BYTES = 32;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_WINDOW_MS = 60 * 1000;
const MAX_ACTIVE_LOGIN_CHALLENGES_PER_IP = 8;
const ES256_ALGORITHM = -7;
const FULL_SESSION_TYPE = "full";
const PASSKEY_NAME_MAX = 80;
const ALLOWED_TRANSPORTS = new Set(["ble", "hybrid", "internal", "nfc", "smart-card", "usb"]);

export async function listOwnAdminPasskeys({ env, session }) {
  const rows = await all(
    env,
    `SELECT id, device_name, transports_json, created_at, last_used_at
       FROM admin_passkeys
      WHERE user_id = ?
        AND revoked_at IS NULL
      ORDER BY created_at DESC`,
    [session.user.id],
  );
  return {
    passkeys: rows.map((row) => ({
      id: row.id,
      device_name: row.device_name,
      transports: parseJsonArray(row.transports_json),
      created_at: row.created_at,
      last_used_at: row.last_used_at || null,
    })),
  };
}

export async function beginOwnAdminPasskeyRegistration({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  if (session.password_change_required) {
    throw forbidden("Troque a senha temporária antes de cadastrar uma chave de acesso.");
  }

  const payload = await readJson(request);
  const currentPassword = requireString(payload.current_password, "senha atual", { max: 300 });
  const user = await first(
    env,
    `SELECT id, display_name, email, password_hash, status
       FROM admin_users
      WHERE id = ?
      LIMIT 1`,
    [session.user.id],
  );
  if (!user || user.status !== "active" || !(await verifyPassword(currentPassword, user.password_hash))) {
    throw unauthorized("Confirme sua senha atual para cadastrar a chave de acesso.");
  }

  const now = requestNow({ request, env });
  await cleanupChallenges(env, now);
  const binding = relyingPartyBinding(request);
  const challenge = randomBase64Url(32);
  await storeChallenge({
    env,
    challenge,
    purpose: "register",
    userId: user.id,
    rpId: binding.rpId,
    origin: binding.origin,
    ipHash: null,
    now,
  });

  const existing = await all(
    env,
    `SELECT credential_id
       FROM admin_passkeys
      WHERE user_id = ?
        AND revoked_at IS NULL`,
    [user.id],
  );

  return {
    publicKey: {
      challenge,
      rp: { id: binding.rpId, name: RP_NAME },
      user: {
        id: toBase64Url(new TextEncoder().encode(user.id)),
        name: user.email,
        displayName: user.display_name,
      },
      pubKeyCredParams: [{ type: "public-key", alg: ES256_ALGORITHM }],
      timeout: CHALLENGE_TTL_MS,
      attestation: "none",
      authenticatorSelection: {
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      excludeCredentials: existing.map((entry) => ({
        type: "public-key",
        id: entry.credential_id,
      })),
    },
  };
}

export async function finishOwnAdminPasskeyRegistration({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const credential = requireCredential(payload.credential);
  const clientData = parseClientData(credential.response.clientDataJSON);
  const now = requestNow({ request, env });
  const challengeRow = await consumeChallenge({
    env,
    challenge: clientData.challenge,
    purpose: "register",
    now,
  });
  if (challengeRow.user_id !== session.user.id) throw unauthorized("Desafio de chave de acesso inválido.");
  validateClientData(clientData, {
    expectedType: "webauthn.create",
    expectedOrigin: challengeRow.origin,
  });

  const attestation = parseAttestationObject(credential.response.attestationObject);
  const authData = await parseAndValidateAuthenticatorData(attestation.authData, {
    rpId: challengeRow.rp_id,
    requireAttestedCredential: true,
  });
  const credentialId = normalizedCredentialId(credential);
  if (!timingSafeEqual(authData.credentialId, fromBase64Url(credentialId))) {
    throw badRequest("A chave de acesso retornou um identificador inconsistente.");
  }

  const publicKey = coseEc2ToJwk(authData.credentialPublicKey);
  const userHandle = toBase64Url(new TextEncoder().encode(session.user.id));
  const deviceName = optionalString(payload.device_name, "nome do dispositivo", { max: PASSKEY_NAME_MAX }) || "Chave de acesso";
  const transports = sanitizeTransports(credential.response.transports);
  const id = createPublicId("passkey");

  try {
    await run(
      env,
      `INSERT INTO admin_passkeys (
         id, user_id, credential_id, user_handle, public_key_jwk, algorithm,
         sign_count, device_name, transports_json, created_at, last_used_at, revoked_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      [
        id,
        session.user.id,
        credentialId,
        userHandle,
        JSON.stringify(publicKey),
        ES256_ALGORITHM,
        authData.signCount,
        deviceName,
        transports.length ? JSON.stringify(transports) : null,
        now,
      ],
    );
  } catch (error) {
    if (/unique|constraint/i.test(String(error?.message || error))) {
      throw conflict("Esta chave de acesso já está cadastrada.");
    }
    throw error;
  }

  await auditPasskey(env, {
    userId: session.user.id,
    action: "admin-passkey.create",
    passkeyId: id,
    metadata: { device_name: deviceName, transports },
    now,
  });

  return {
    passkey: {
      id,
      device_name: deviceName,
      transports,
      created_at: now,
      last_used_at: null,
    },
  };
}

export async function deleteOwnAdminPasskey({ request, env, session, passkeyId }) {
  assertAdminMutationAllowed({ request });
  const now = requestNow({ request, env });
  const result = await run(
    env,
    `UPDATE admin_passkeys
        SET revoked_at = ?
      WHERE id = ?
        AND user_id = ?
        AND revoked_at IS NULL`,
    [now, passkeyId, session.user.id],
  );
  if (Number(result?.meta?.changes || 0) !== 1) throw badRequest("Chave de acesso não encontrada.");
  await auditPasskey(env, {
    userId: session.user.id,
    action: "admin-passkey.revoke",
    passkeyId,
    metadata: { self_service: true },
    now,
  });
  return { passkey_id: passkeyId, removed: true };
}

export async function beginAdminPasskeyLogin({ request, env }) {
  assertAdminMutationAllowed({ request });
  const now = requestNow({ request, env });
  const context = await createLoginSecurityContext({ request, env, email: "passkey", now });
  await prepareLoginSecurity({ env, context });
  await cleanupChallenges(env, now);
  await assertChallengeIssuanceAllowed(env, context.ipHash, now);

  const binding = relyingPartyBinding(request);
  const challenge = randomBase64Url(32);
  await storeChallenge({
    env,
    challenge,
    purpose: "authenticate",
    userId: null,
    rpId: binding.rpId,
    origin: binding.origin,
    ipHash: context.ipHash,
    now,
  });

  return {
    publicKey: {
      challenge,
      rpId: binding.rpId,
      timeout: CHALLENGE_TTL_MS,
      userVerification: "required",
    },
  };
}

export async function finishAdminPasskeyLogin({ request, env }) {
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const credential = requireCredential(payload.credential);
  const clientData = parseClientData(credential.response.clientDataJSON);
  const now = requestNow({ request, env });
  const challengeRow = await consumeChallenge({
    env,
    challenge: clientData.challenge,
    purpose: "authenticate",
    now,
  });
  validateClientData(clientData, {
    expectedType: "webauthn.get",
    expectedOrigin: challengeRow.origin,
  });

  const authenticatorDataBytes = fromBase64Url(requireString(credential.response.authenticatorData, "authenticatorData", { max: 4096 }));
  const authData = await parseAndValidateAuthenticatorData(authenticatorDataBytes, {
    rpId: challengeRow.rp_id,
    requireAttestedCredential: false,
  });
  const credentialId = normalizedCredentialId(credential);
  const passkey = await first(
    env,
    `SELECT p.id, p.user_id, p.user_handle, p.public_key_jwk, p.algorithm, p.sign_count,
            u.display_name, u.email, u.status, u.force_password_change,
            u.user_number, u.avatar_object_key, u.avatar_mime_type, u.avatar_updated_at
       FROM admin_passkeys p
       JOIN admin_users u ON u.id = p.user_id
      WHERE p.credential_id = ?
        AND p.revoked_at IS NULL
      LIMIT 1`,
    [credentialId],
  );

  if (!passkey || passkey.status !== "active") {
    const genericContext = await createLoginSecurityContext({ request, env, email: "passkey", now });
    return recordLoginChallengeFailure({ env, context: genericContext, reasonCode: "passkey_unknown" });
  }

  const securityContext = await createLoginSecurityContext({ request, env, email: passkey.email, now });
  await prepareLoginSecurity({ env, context: securityContext });

  const returnedUserHandle = credential.response.userHandle
    ? normalizeBase64Url(requireString(credential.response.userHandle, "userHandle", { max: 512 }))
    : null;
  if (returnedUserHandle && returnedUserHandle !== passkey.user_handle) {
    return recordLoginFailure({ env, context: securityContext, reasonCode: "passkey_user_mismatch" });
  }

  const verified = await verifyAssertionSignature({
    publicKeyJwk: passkey.public_key_jwk,
    authenticatorData: authenticatorDataBytes,
    clientDataJSON: fromBase64Url(credential.response.clientDataJSON),
    signature: fromBase64Url(requireString(credential.response.signature, "signature", { max: 4096 })),
  });
  if (!verified) {
    return recordLoginFailure({ env, context: securityContext, reasonCode: "passkey_signature_invalid" });
  }

  const storedCounter = Number(passkey.sign_count || 0);
  if (!authData.backupEligible && storedCounter > 0 && authData.signCount > 0 && authData.signCount <= storedCounter) {
    return recordLoginFailure({ env, context: securityContext, reasonCode: "passkey_counter_invalid" });
  }

  const sessionType = Number(passkey.force_password_change || 0) === 1 ? "password_change_required" : FULL_SESSION_TYPE;
  const token = randomBase64Url(SESSION_TOKEN_BYTES);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.parse(now) + SESSION_TTL_SECONDS * 1000).toISOString();
  const sessionId = createPublicId("sess");
  await createProtectedAdminSession({
    env,
    context: securityContext,
    sessionRecord: {
      id: sessionId,
      userId: passkey.user_id,
      tokenHash,
      userAgentHash: await optionalHeaderHash(request, "user-agent"),
      ipHash: await optionalHeaderHash(request, "cf-connecting-ip"),
      sessionType,
      createdAt: now,
      expiresAt,
    },
  });

  await run(
    env,
    `UPDATE admin_passkeys
        SET sign_count = ?, last_used_at = ?
      WHERE id = ?`,
    [Math.max(storedCounter, authData.signCount), now, passkey.id],
  );
  await auditPasskey(env, {
    userId: passkey.user_id,
    action: "admin-passkey.login",
    passkeyId: passkey.id,
    metadata: { user_verification: true },
    now,
  });

  const session = await buildAdminSession(env, {
    session_id: sessionId,
    user_id: passkey.user_id,
    user_number: passkey.user_number,
    display_name: passkey.display_name,
    email: passkey.email,
    avatar_object_key: passkey.avatar_object_key,
    avatar_mime_type: passkey.avatar_mime_type,
    avatar_updated_at: passkey.avatar_updated_at,
    session_type: sessionType,
    expires_at: expiresAt,
  });

  return {
    session,
    headers: sessionCookieHeaders(token, request, env),
  };
}

async function assertChallengeIssuanceAllowed(env, ipHash, now) {
  const cutoff = new Date(Date.parse(now) - CHALLENGE_WINDOW_MS).toISOString();
  const row = await first(
    env,
    `SELECT COUNT(*) AS challenge_count
       FROM admin_webauthn_challenges
      WHERE purpose = 'authenticate'
        AND ip_hash = ?
        AND created_at > ?
        AND consumed_at IS NULL`,
    [ipHash, cutoff],
  );
  if (Number(row?.challenge_count || 0) >= MAX_ACTIVE_LOGIN_CHALLENGES_PER_IP) {
    throw new (class extends Error {})();
  }
}

async function storeChallenge({ env, challenge, purpose, userId, rpId, origin, ipHash, now }) {
  const challengeHash = await sha256Hex(challenge);
  const expiresAt = new Date(Date.parse(now) + CHALLENGE_TTL_MS).toISOString();
  await run(
    env,
    `INSERT INTO admin_webauthn_challenges (
       challenge_hash, purpose, user_id, rp_id, origin, ip_hash, created_at, expires_at, consumed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [challengeHash, purpose, userId, rpId, origin, ipHash, now, expiresAt],
  );
}

async function consumeChallenge({ env, challenge, purpose, now }) {
  const challengeHash = await sha256Hex(challenge);
  const row = await first(
    env,
    `SELECT challenge_hash, purpose, user_id, rp_id, origin, ip_hash, created_at, expires_at
       FROM admin_webauthn_challenges
      WHERE challenge_hash = ?
        AND purpose = ?
        AND consumed_at IS NULL
        AND expires_at > ?
      LIMIT 1`,
    [challengeHash, purpose, now],
  );
  if (!row) throw unauthorized("Desafio de chave de acesso inválido ou expirado.");
  const result = await run(
    env,
    `UPDATE admin_webauthn_challenges
        SET consumed_at = ?
      WHERE challenge_hash = ?
        AND consumed_at IS NULL
        AND expires_at > ?`,
    [now, challengeHash, now],
  );
  if (Number(result?.meta?.changes || 0) !== 1) throw unauthorized("Desafio de chave de acesso já utilizado.");
  return row;
}

function cleanupChallenges(env, now) {
  return run(env, `DELETE FROM admin_webauthn_challenges WHERE expires_at <= ? OR consumed_at IS NOT NULL`, [now]);
}

function relyingPartyBinding(request) {
  const url = new URL(request.url);
  return { rpId: url.hostname, origin: url.origin };
}

function requireCredential(value) {
  if (!value || typeof value !== "object") throw badRequest("Credencial de chave de acesso ausente.");
  requireString(value.id, "credential.id", { max: 2048 });
  requireString(value.rawId, "credential.rawId", { max: 2048 });
  if (value.type !== "public-key") throw badRequest("Tipo de credencial inválido.");
  if (!value.response || typeof value.response !== "object") throw badRequest("Resposta da credencial ausente.");
  requireString(value.response.clientDataJSON, "clientDataJSON", { max: 8192 });
  return value;
}

function parseClientData(encoded) {
  try {
    const bytes = fromBase64Url(encoded);
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object") throw new Error("invalid");
    return data;
  } catch {
    throw badRequest("Dados WebAuthn inválidos.");
  }
}

function validateClientData(clientData, { expectedType, expectedOrigin }) {
  if (clientData.type !== expectedType) throw unauthorized("Cerimônia WebAuthn inválida.");
  if (clientData.origin !== expectedOrigin) throw unauthorized("Origem WebAuthn inválida.");
  if (typeof clientData.challenge !== "string" || !clientData.challenge) throw unauthorized("Desafio WebAuthn ausente.");
  if (clientData.crossOrigin === true) throw unauthorized("Autenticação WebAuthn cross-origin não permitida.");
}

function parseAttestationObject(encoded) {
  const bytes = fromBase64Url(requireString(encoded, "attestationObject", { max: 16384 }));
  const decoded = decodeCbor(bytes, 0);
  if (!(decoded.value instanceof Map)) throw badRequest("Attestation WebAuthn inválida.");
  const authData = decoded.value.get("authData");
  if (!(authData instanceof Uint8Array)) throw badRequest("Authenticator data ausente.");
  return { authData };
}

async function parseAndValidateAuthenticatorData(bytes, { rpId, requireAttestedCredential }) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 37) throw badRequest("Authenticator data inválida.");
  const expectedRpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId)));
  const rpIdHash = bytes.slice(0, 32);
  if (!timingSafeEqual(rpIdHash, expectedRpIdHash)) throw unauthorized("RP ID da chave de acesso não confere.");
  const flags = bytes[32];
  if ((flags & 0x01) === 0) throw unauthorized("Presença do usuário não confirmada.");
  if ((flags & 0x04) === 0) throw unauthorized("Verificação local do usuário é obrigatória.");
  const signCount = readUint32(bytes, 33);
  const result = {
    flags,
    signCount,
    backupEligible: (flags & 0x08) !== 0,
    credentialId: null,
    credentialPublicKey: null,
  };
  if (!requireAttestedCredential) return result;
  if ((flags & 0x40) === 0 || bytes.length < 55) throw badRequest("Credencial atestada ausente.");
  let offset = 53;
  const credentialIdLength = (bytes[offset] << 8) | bytes[offset + 1];
  offset += 2;
  if (credentialIdLength < 1 || offset + credentialIdLength > bytes.length) throw badRequest("Credential ID inválido.");
  result.credentialId = bytes.slice(offset, offset + credentialIdLength);
  offset += credentialIdLength;
  const cose = decodeCbor(bytes, offset);
  if (!(cose.value instanceof Map)) throw badRequest("Chave pública WebAuthn inválida.");
  result.credentialPublicKey = cose.value;
  return result;
}

function coseEc2ToJwk(cose) {
  const kty = cose.get(1);
  const alg = cose.get(3);
  const crv = cose.get(-1);
  const x = cose.get(-2);
  const y = cose.get(-3);
  if (kty !== 2 || alg !== ES256_ALGORITHM || crv !== 1 || !(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
    throw badRequest("Este autenticador não oferece o algoritmo de passkey suportado pela Central.");
  }
  if (x.length !== 32 || y.length !== 32) throw badRequest("Chave pública ES256 inválida.");
  return { kty: "EC", crv: "P-256", x: toBase64Url(x), y: toBase64Url(y), ext: true };
}

async function verifyAssertionSignature({ publicKeyJwk, authenticatorData, clientDataJSON, signature }) {
  let jwk;
  try {
    jwk = JSON.parse(publicKeyJwk);
  } catch {
    return false;
  }
  try {
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const clientDataHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataJSON));
    const signed = concatBytes(authenticatorData, clientDataHash);
    const rawSignature = signature.length === 64 ? signature : derEcdsaToRaw(signature, 32);
    return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, rawSignature, signed);
  } catch {
    return false;
  }
}

function derEcdsaToRaw(signature, componentLength) {
  let offset = 0;
  if (signature[offset++] !== 0x30) throw new Error("invalid_ecdsa_signature");
  const sequenceLength = readDerLength(signature, offset);
  offset = sequenceLength.offset;
  if (offset + sequenceLength.length !== signature.length) throw new Error("invalid_ecdsa_signature");
  if (signature[offset++] !== 0x02) throw new Error("invalid_ecdsa_signature");
  const rLength = readDerLength(signature, offset);
  offset = rLength.offset;
  const r = signature.slice(offset, offset + rLength.length);
  offset += rLength.length;
  if (signature[offset++] !== 0x02) throw new Error("invalid_ecdsa_signature");
  const sLength = readDerLength(signature, offset);
  offset = sLength.offset;
  const s = signature.slice(offset, offset + sLength.length);
  const raw = new Uint8Array(componentLength * 2);
  copyDerInteger(r, raw, 0, componentLength);
  copyDerInteger(s, raw, componentLength, componentLength);
  return raw;
}

function readDerLength(bytes, offset) {
  const firstByte = bytes[offset++];
  if (firstByte < 0x80) return { length: firstByte, offset };
  const byteCount = firstByte & 0x7f;
  if (byteCount < 1 || byteCount > 2) throw new Error("invalid_der_length");
  let length = 0;
  for (let index = 0; index < byteCount; index += 1) length = (length << 8) | bytes[offset++];
  return { length, offset };
}

function copyDerInteger(integer, target, targetOffset, length) {
  let value = integer;
  while (value.length > 1 && value[0] === 0) value = value.slice(1);
  if (value.length > length) throw new Error("invalid_der_integer");
  target.set(value, targetOffset + length - value.length);
}

function decodeCbor(bytes, startOffset) {
  let offset = startOffset;
  const initial = bytes[offset++];
  if (initial === undefined) throw badRequest("CBOR WebAuthn truncado.");
  const major = initial >> 5;
  const additional = initial & 0x1f;
  const lengthInfo = readCborLength(bytes, offset, additional);
  offset = lengthInfo.offset;
  const length = lengthInfo.length;

  if (major === 0) return { value: length, offset };
  if (major === 1) return { value: -1 - length, offset };
  if (major === 2) {
    const end = offset + length;
    if (end > bytes.length) throw badRequest("CBOR WebAuthn truncado.");
    return { value: bytes.slice(offset, end), offset: end };
  }
  if (major === 3) {
    const end = offset + length;
    if (end > bytes.length) throw badRequest("CBOR WebAuthn truncado.");
    return { value: new TextDecoder().decode(bytes.slice(offset, end)), offset: end };
  }
  if (major === 4) {
    const value = [];
    for (let index = 0; index < length; index += 1) {
      const item = decodeCbor(bytes, offset);
      value.push(item.value);
      offset = item.offset;
    }
    return { value, offset };
  }
  if (major === 5) {
    const value = new Map();
    for (let index = 0; index < length; index += 1) {
      const key = decodeCbor(bytes, offset);
      offset = key.offset;
      const item = decodeCbor(bytes, offset);
      offset = item.offset;
      value.set(key.value, item.value);
    }
    return { value, offset };
  }
  if (major === 6) return decodeCbor(bytes, offset);
  if (major === 7) {
    if (additional === 20) return { value: false, offset };
    if (additional === 21) return { value: true, offset };
    if (additional === 22) return { value: null, offset };
  }
  throw badRequest("Formato CBOR WebAuthn não suportado.");
}

function readCborLength(bytes, offset, additional) {
  if (additional < 24) return { length: additional, offset };
  if (additional === 24) return { length: bytes[offset], offset: offset + 1 };
  if (additional === 25) return { length: (bytes[offset] << 8) | bytes[offset + 1], offset: offset + 2 };
  if (additional === 26) return { length: readUint32(bytes, offset), offset: offset + 4 };
  throw badRequest("Comprimento CBOR WebAuthn não suportado.");
}

function normalizedCredentialId(credential) {
  const rawId = normalizeBase64Url(requireString(credential.rawId, "credential.rawId", { max: 2048 }));
  const id = normalizeBase64Url(requireString(credential.id, "credential.id", { max: 2048 }));
  if (rawId !== id) throw badRequest("Identificador da credencial WebAuthn inconsistente.");
  return rawId;
}

function sanitizeTransports(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item)).filter((item) => ALLOWED_TRANSPORTS.has(item)))].sort();
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function auditPasskey(env, { userId, action, passkeyId, metadata, now }) {
  await run(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
     ) VALUES (?, NULL, NULL, ?, ?, 'admin_passkey', ?, ?, ?)`,
    [createPublicId("audit"), userId, action, passkeyId, JSON.stringify(metadata || {}), now],
  );
}

async function buildAdminSession(env, row) {
  const isMaster = Number(row.user_number || 0) === 1;
  const hotels = isMaster
    ? await all(
        env,
        `SELECT h.id AS hotel_id, h.slug, h.name, h.short_name,
                h.timezone, h.locale, h.currency, 'owner' AS access_level
           FROM hotels h
          WHERE h.archived_at IS NULL
            AND h.status <> 'archived'
          ORDER BY h.name`,
        [],
      )
    : await all(
        env,
        `SELECT h.id AS hotel_id, h.slug, h.name, h.short_name,
                h.timezone, h.locale, h.currency, aha.access_level
           FROM admin_hotel_access aha
           JOIN hotels h ON h.id = aha.hotel_id
          WHERE aha.user_id = ?
            AND h.archived_at IS NULL
          ORDER BY h.name`,
        [row.user_id],
      );
  const permissions = isMaster
    ? await all(env, `SELECT permission_key FROM admin_permissions ORDER BY permission_key`, [])
    : await all(
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
      number: Number(row.user_number || 0) || null,
      is_master: isMaster,
      display_name: row.display_name,
      email: row.email,
      avatar: row.avatar_object_key
        ? { url: "/api/v1/admin/me/avatar", mime_type: row.avatar_mime_type, updated_at: row.avatar_updated_at }
        : null,
    },
    hotels,
    hotel_ids: hotels.map((hotel) => hotel.hotel_id),
    permissions: permissions.map((permission) => permission.permission_key),
    expires_at: row.expires_at,
    session_type: row.session_type || FULL_SESSION_TYPE,
    password_change_required: row.session_type === "password_change_required",
  };
}

function sessionCookieHeaders(token, request, env) {
  const headers = new Headers();
  const url = new URL(request.url);
  const secure = url.protocol === "https:" && env.ENVIRONMENT !== "test" ? "; Secure" : "";
  headers.append(
    "set-cookie",
    `${ADMIN_SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
  );
  return headers;
}

function randomBase64Url(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function optionalHeaderHash(request, headerName) {
  const value = request.headers.get(headerName);
  return value ? sha256Hex(value) : null;
}

async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readUint32(bytes, offset) {
  if (offset + 4 > bytes.length) throw badRequest("Dados binários WebAuthn truncados.");
  return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function concatBytes(left, right) {
  const output = new Uint8Array(left.length + right.length);
  output.set(left, 0);
  output.set(right, left.length);
  return output;
}

function timingSafeEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function normalizeBase64Url(value) {
  return toBase64Url(fromBase64Url(value));
}

function fromBase64Url(value) {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    return Uint8Array.from(atob(normalized + padding), (char) => char.charCodeAt(0));
  } catch {
    throw badRequest("Valor base64url WebAuthn inválido.");
  }
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export const __test = {
  decodeCbor,
  derEcdsaToRaw,
  fromBase64Url,
  parseAndValidateAuthenticatorData,
  toBase64Url,
  verifyAssertionSignature,
};
