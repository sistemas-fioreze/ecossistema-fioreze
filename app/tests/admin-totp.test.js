import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { __test } from "../src/services/admin-totp.js";

const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("TOTP usa HOTP SHA-1 compatível com RFC 4226", async () => {
  assert.equal(await __test.hotp(RFC_SECRET, 0), "755224");
  assert.equal(await __test.hotp(RFC_SECRET, 1), "287082");
  assert.equal(await __test.hotp(RFC_SECRET, 2), "359152");
});

test("TOTP aceita a janela atual e rejeita replay do mesmo passo", async () => {
  const now = "1970-01-01T00:00:30.000Z";
  assert.deepEqual(await __test.verifyTotp(RFC_SECRET, "287082", now, null), { step: 1 });
  assert.equal(await __test.verifyTotp(RFC_SECRET, "287082", now, 1), null);
});

test("segredo Base32 faz round-trip e URI segue padrão otpauth", () => {
  const bytes = new TextEncoder().encode("12345678901234567890");
  assert.equal(__test.base32Encode(bytes), RFC_SECRET);
  assert.deepEqual([...__test.base32Decode(RFC_SECRET)], [...bytes]);
  const uri = __test.createOtpAuthUri({ label: "marketing@fioreze.com", secret: RFC_SECRET });
  assert.match(uri, /^otpauth:\/\/totp\/Fioreze:/);
  assert.match(uri, /issuer=Fioreze/);
  assert.match(uri, /algorithm=SHA1/);
  assert.match(uri, /digits=6/);
  assert.match(uri, /period=30/);
});

test("códigos de recuperação são únicos e não triviais", () => {
  const codes = __test.generateRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test("login por senha só cria sessão após TOTP quando MFA está ativo", async () => {
  const auth = await readFile(new URL("../src/services/admin-auth.js", import.meta.url), "utf8");
  const totp = await readFile(new URL("../src/services/admin-totp.js", import.meta.url), "utf8");
  const routes = await readFile(new URL("../src/modules/admin/totp-routes.js", import.meta.url), "utf8");
  const api = await readFile(new URL("../public/js/modules/admin/shared/admin-api.js", import.meta.url), "utf8");

  assert.match(auth, /ensureAdminTotpSchema/);
  assert.match(auth, /beginAdminTotpLoginChallengeIfEnabled/);
  assert.match(auth, /if \(challenge\) return \{ session: challenge, headers: new Headers\(\) \}/);
  assert.match(auth, /if \(session\?\.mfa_required\) return session/);
  assert.match(totp, /mfa_required: true/);
  assert.match(totp, /admin_totp_login_challenges/);
  assert.match(totp, /attempt_count = attempt_count \+ 1/);
  assert.match(routes, /\/api\/v1\/admin\/login\/totp/);
  assert.match(api, /completeTotpLogin/);
  assert.match(api, /\/api\/v1\/admin\/login\/totp/);
});

test("UI do autenticador mantém configuração sensível dentro de dialogs", async () => {
  const ui = await readFile(new URL("../public/js/modules/admin/admin-totp.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/css/modules/admin/admin-totp.css", import.meta.url), "utf8");

  assert.match(ui, /Aplicativo autenticador/);
  assert.match(ui, /Configurar autenticador/);
  assert.match(ui, /data-totp-setup-password/);
  assert.match(ui, /data-totp-qr/);
  assert.match(ui, /recovery_codes/);
  assert.match(ui, /Desativar autenticador/);
  assert.match(css, /admin-totp-pair-grid/);
  assert.doesNotMatch(css, /@import\s+url/i);
});
