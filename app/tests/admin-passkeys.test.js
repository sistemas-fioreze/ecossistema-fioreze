import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { __test } from "../src/services/admin-passkeys.js";

const migration = fs.readFileSync("migrations/0050_admin_passkeys.sql", "utf8");
const worker = fs.readFileSync("src/index.js", "utf8");
const routes = fs.readFileSync("src/modules/admin/passkey-routes.js", "utf8");
const service = fs.readFileSync("src/services/admin-passkeys.js", "utf8");
const html = fs.readFileSync("public/admin/index.html", "utf8");
const client = fs.readFileSync("public/js/modules/admin/admin-passkeys.js", "utf8");
const css = fs.readFileSync("public/css/modules/admin/admin-passkeys.css", "utf8");

test("schema de passkeys guarda somente material público e desafios descartáveis", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_passkeys/);
  assert.match(migration, /public_key_jwk TEXT NOT NULL/);
  assert.match(migration, /credential_id TEXT NOT NULL UNIQUE/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_webauthn_challenges/);
  assert.match(migration, /consumed_at TEXT/);
  assert.doesNotMatch(migration, /private_key/i);
});

test("Worker registra endpoints WebAuthn da Central", () => {
  assert.match(worker, /registerAdminPasskeyRoutes/);
  assert.match(routes, /\/api\/v1\/admin\/passkeys\/login\/options/);
  assert.match(routes, /\/api\/v1\/admin\/passkeys\/login\/verify/);
  assert.match(routes, /\/api\/v1\/admin\/me\/passkeys\/registration\/options/);
  assert.match(routes, /\/api\/v1\/admin\/me\/passkeys\/registration\/verify/);
  assert.match(routes, /router\.delete\("\/api\/v1\/admin\/me\/passkeys\/:id"/);
});

test("cerimônia exige passkey descobrível e verificação local do usuário", () => {
  assert.match(service, /residentKey: "required"/);
  assert.match(service, /requireResidentKey: true/);
  assert.match(service, /userVerification: "required"/);
  assert.match(service, /attestation: "none"/);
  assert.match(service, /const ES256_ALGORITHM = -7/);
  assert.match(service, /passkey_signature_invalid/);
  assert.match(service, /passkey_counter_invalid/);
});

test("interface oferece login sem senha e gerenciamento em Minha conta", () => {
  assert.match(html, /admin-passkeys\.js/);
  assert.match(client, /Entrar com chave de acesso/);
  assert.match(client, /Adicionar chave de acesso/);
  assert.match(client, /navigator\.credentials\.create/);
  assert.match(client, /navigator\.credentials\.get/);
  assert.match(client, /current_password/);
  assert.doesNotMatch(css, /@import\s+url/i);
  const fontSizes = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].map((match) => Number(match[1]));
  assert.ok(fontSizes.every((size) => size >= 12));
});

test("authenticatorData valida RP ID e exige UP + UV", async () => {
  const rpId = "portal.hoteisfioreze.com.br";
  const rpHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId)));
  const authData = new Uint8Array(37);
  authData.set(rpHash, 0);
  authData[32] = 0x05;
  authData[36] = 7;
  const parsed = await __test.parseAndValidateAuthenticatorData(authData, {
    rpId,
    requireAttestedCredential: false,
  });
  assert.equal(parsed.signCount, 7);
  assert.equal(parsed.backupEligible, false);

  const withoutUv = authData.slice();
  withoutUv[32] = 0x01;
  await assert.rejects(
    () => __test.parseAndValidateAuthenticatorData(withoutUv, { rpId, requireAttestedCredential: false }),
    /Verificação local do usuário é obrigatória/,
  );
});

test("verificação ES256 aceita assinatura Web Crypto válida", async () => {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const authenticatorData = crypto.getRandomValues(new Uint8Array(37));
  const clientDataJSON = new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge: "test" }));
  const clientHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataJSON));
  const signed = new Uint8Array(authenticatorData.length + clientHash.length);
  signed.set(authenticatorData, 0);
  signed.set(clientHash, authenticatorData.length);
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, signed),
  );
  const verified = await __test.verifyAssertionSignature({
    publicKeyJwk: JSON.stringify(publicJwk),
    authenticatorData,
    clientDataJSON,
    signature,
  });
  assert.equal(verified, true);
});
