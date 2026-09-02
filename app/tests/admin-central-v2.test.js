import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Central V2 unifica sidebar, header e superfícies sem quebrar módulos existentes", async () => {
  const entry = await readFile(new URL("../public/js/modules/admin/admin-totp.js", import.meta.url), "utf8");
  const shell = await readFile(new URL("../public/js/modules/admin/admin-central-v2.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/css/modules/admin/admin-central-v2.css", import.meta.url), "utf8");

  assert.match(entry, /admin-central-v2\.js/);
  assert.match(shell, /data-central-sidebar-context/);
  assert.match(shell, /data-central-sidebar-footer/);
  assert.match(shell, /admin-topbar-actions/);
  assert.match(shell, /MutationObserver/);
  assert.match(shell, /admin-central-v2\.css/);
  assert.match(shell, /if \(user && user\.textContent !== userName\)/);

  assert.match(css, /admin-dashboard\{grid-template-columns:248px minmax\(0,1fr\);grid-template-rows:84px/);
  assert.match(css, /admin-global-sidebar\{[^}]*background:#fbfbfa/);
  assert.match(css, /admin-sidebar-footer/);
  assert.match(css, /admin-topbar-actions/);
  assert.match(css, /admin-command-search label\{[^}]*border-radius:12px/);
  assert.match(css, /admin-account-workspace\{grid-template-columns:minmax\(280px,340px\) minmax\(0,1fr\)/);
  assert.doesNotMatch(css, /@import\s+url/i);
  assert.doesNotMatch(css, /font-size:(?:[0-9]|1[01])px/);
});
