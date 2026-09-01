import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("login TOTP usa etapa compacta e permite alternar para recovery code", async () => {
  const api = await readFile(new URL("../public/js/modules/admin/shared/admin-api.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/css/modules/admin/admin-totp-login.css", import.meta.url), "utf8");

  assert.match(api, /admin-totp-login\.css/);
  assert.match(api, /Etapa 2 de 2/);
  assert.match(api, /admin-totp-login-header/);
  assert.match(api, /admin-totp-login-field-meta/);
  assert.match(api, /Usar código de recuperação/);
  assert.match(api, /input\.inputMode = "text"/);
  assert.match(api, /XXXX-XXXX-XXXX-XXXX/);
  assert.match(api, /input\.inputMode = "numeric"/);
  assert.match(api, /Código de 6 dígitos/);

  assert.match(css, /admin-access-card\.is-totp-step\{[^}]*width:min\(470px,100%\)/);
  assert.match(css, /admin-totp-login-actions\{[^}]*padding:20px 28px 28px/);
  assert.match(css, /admin-totp-login-field input\{[^}]*min-height:56px/);
  assert.match(css, /admin-totp-login-progress/);
  assert.doesNotMatch(css, /@import\s+url/i);
});
