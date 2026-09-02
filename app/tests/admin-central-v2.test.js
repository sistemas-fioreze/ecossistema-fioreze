import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Central V3 refina shell, conta e segurança sem quebrar a fundação existente", async () => {
  const entry = await readFile(new URL("../public/js/modules/admin/admin-totp.js", import.meta.url), "utf8");
  const shell = await readFile(new URL("../public/js/modules/admin/admin-central-v2.js", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../public/css/modules/admin/admin-central-v2.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../public/css/modules/admin/admin-central-v3.css", import.meta.url), "utf8");

  assert.match(entry, /admin-central-v2\.js/);
  assert.match(shell, /data-central-sidebar-footer/);
  assert.match(shell, /sidebar\.querySelector\("\[data-central-sidebar-context\]"\)\?\.remove\(\)/);
  assert.match(shell, /admin-topbar-actions/);
  assert.match(shell, /data-central-breadcrumbs/);
  assert.match(shell, /Configurações/);
  assert.match(shell, /if \(kicker\) kicker\.hidden = false/);
  assert.match(shell, /data-central-profile-summary/);
  assert.match(shell, /data-central-passkey-manage/);
  assert.match(shell, /data-central-passkey-dialog/);
  assert.match(shell, /Códigos de recuperação/);
  assert.match(shell, /MutationObserver/);
  assert.match(shell, /admin-central-v2\.css/);
  assert.match(shell, /admin-central-v3\.css/);
  assert.match(shell, /if \(user && user\.textContent !== userName\)/);

  assert.match(baseCss, /admin-dashboard\{grid-template-columns:248px minmax\(0,1fr\);grid-template-rows:84px/);
  assert.match(polishCss, /grid-template-columns:\s*238px minmax\(0, 1fr\)/);
  assert.match(polishCss, /admin-central-breadcrumbs/);
  assert.match(polishCss, /admin-account-section\s*\{/);
  assert.match(polishCss, /admin-account-security-grid/);
  assert.match(polishCss, /admin-central-passkey-dialog/);
  assert.match(polishCss, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(polishCss, /@import\s+url/i);
  assert.doesNotMatch(polishCss, /font-size:\s*(?:[0-9]|1[01])px/);
  assert.doesNotMatch(polishCss, /font-weight:\s*(?:[1-9][1-9][0-9]|[1-9][0-9][1-9])/);
});
