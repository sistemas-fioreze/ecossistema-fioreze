import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const account = fs.readFileSync("public/js/modules/admin/admin-account-experience.js", "utf8");
const passkeys = fs.readFileSync("public/js/modules/admin/admin-passkeys.js", "utf8");
const css = fs.readFileSync("public/css/modules/admin/admin-account.css", "utf8");

test("Minha conta organiza perfil e segurança sem formulários sensíveis expostos", () => {
  assert.match(account, /admin-account-profile-card/);
  assert.match(account, /accountSecurityGrid/);
  assert.match(account, /Alterar foto/);
  assert.match(account, /Alterar senha/);
  assert.match(account, /Gerenciar sessões/);
  assert.match(account, /createDialog/);
  assert.match(account, /avatarForm/);
  assert.match(account, /passwordForm/);
  assert.match(passkeys, /createEnrollmentDialog/);
  assert.match(passkeys, /Nova chave de acesso/);
  assert.doesNotMatch(passkeys, /data-passkey-enroll/);
});

test("ações da conta usam dialogs próprios e layout responsivo", () => {
  assert.match(account, /showModal\(\)/);
  assert.match(account, /adminAccountAvatarDialog/);
  assert.match(account, /adminAccountPasswordDialog/);
  assert.match(account, /adminAccountSessionsDialog/);
  assert.match(account, /stopImmediatePropagation/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /admin-account-dialog::backdrop/);
  assert.doesNotMatch(css, /@import\s+url/i);
  const fontSizes = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].map((match) => Number(match[1]));
  assert.ok(fontSizes.every((size) => size >= 12));
});
