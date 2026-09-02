import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Central V3 refina shell, conta e segurança sem quebrar a fundação existente", async () => {
  const entry = await readFile(new URL("../public/js/modules/admin/admin-totp.js", import.meta.url), "utf8");
  const shell = await readFile(new URL("../public/js/modules/admin/admin-central-v2.js", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../public/css/modules/admin/admin-central-v2.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../public/css/modules/admin/admin-central-v3.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../public/css/modules/admin/admin-shell-unified.css", import.meta.url), "utf8");
  const openCornerJs = await readFile(new URL("../public/js/modules/admin/admin-shell-open-corner.js", import.meta.url), "utf8");
  const openCornerCss = await readFile(new URL("../public/css/modules/admin/admin-shell-open-corner.css", import.meta.url), "utf8");

  assert.match(entry, /admin-central-v2\.js\?v=20260902-3/);
  assert.match(entry, /admin-shell-open-corner\.js\?v=20260902-1/);
  assert.match(shell, /admin-shell-unified\.css\?v=20260902-2/);
  assert.match(shell, /data-central-sidebar-footer/);
  assert.match(shell, /sidebar\.querySelector\("\[data-central-sidebar-context\]"\)\?\.remove\(\)/);
  assert.match(shell, /dataset\.centralSidebarSession/);
  assert.match(shell, /footer\.replaceChildren\(sessionBox\)/);
  assert.match(shell, /href = "\/admin\/minha-conta\/"/);
  assert.match(shell, /admin-topbar-actions/);
  assert.doesNotMatch(shell, /topbar\.querySelector\(":scope > \.admin-session-box"\)/);
  assert.match(shell, /data-central-breadcrumbs/);
  assert.match(shell, /Configurações/);
  assert.match(shell, /if \(kicker\) kicker\.hidden = false/);
  assert.match(shell, /data-central-profile-summary/);
  assert.match(shell, /dataset\.centralPasskeyManage/);
  assert.match(shell, /dataset\.centralPasskeyDialog/);
  assert.match(shell, /Códigos de recuperação/);
  assert.match(shell, /MutationObserver/);
  assert.match(shell, /admin-central-v2\.css/);
  assert.match(shell, /admin-central-v3\.css/);
  assert.match(shell, /admin-shell-unified\.css/);

  assert.match(baseCss, /admin-dashboard\{grid-template-columns:248px minmax\(0,1fr\);grid-template-rows:84px/);
  assert.match(polishCss, /grid-template-columns:\s*238px minmax\(0, 1fr\)/);
  assert.match(polishCss, /admin-central-breadcrumbs/);
  assert.match(polishCss, /admin-account-section\s*\{/);
  assert.match(polishCss, /admin-account-security-grid/);
  assert.match(polishCss, /admin-central-passkey-dialog/);
  assert.match(polishCss, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(shellCss, /admin-global-sidebar[\s\S]*background: #ffffff !important/);
  assert.match(shellCss, /--central-shell-contour:\s*#dde1e3/);
  assert.match(shellCss, /border-bottom:\s*1px solid var\(--central-shell-contour\) !important/);
  assert.match(shellCss, /--central-shell-canvas:\s*#f5f6f5/);
  assert.match(shellCss, /admin-sidebar-footer \.admin-session-trigger/);
  assert.match(shellCss, /img\.admin-avatar/);
  assert.match(shellCss, /border:\s*1px solid rgba\(194, 169, 75, \.52\)/);
  assert.match(shellCss, /box-shadow:\s*0 0 0 2px #ffffff/);
  assert.match(shellCss, /admin-sidebar-footer \.admin-session-menu/);

  assert.match(openCornerJs, /admin-shell-open-corner\.css\?v=20260902-1/);
  assert.match(openCornerCss, /--central-shell-header-height:\s*84px/);
  assert.match(openCornerCss, /border-right:\s*0 !important/);
  assert.match(openCornerCss, /admin-global-sidebar::after/);
  assert.match(openCornerCss, /top:\s*var\(--central-shell-header-height\)/);
  assert.match(openCornerCss, /background:\s*var\(--central-shell-contour\)/);

  assert.doesNotMatch(`${polishCss}\n${shellCss}\n${openCornerCss}`, /@import\s+url/i);
  assert.doesNotMatch(`${polishCss}\n${shellCss}\n${openCornerCss}`, /font-size:\s*(?:[0-9]|1[01])px/);
  assert.doesNotMatch(`${polishCss}\n${shellCss}\n${openCornerCss}`, /font-weight:\s*(?:[1-9][1-9][0-9]|[1-9][0-9][1-9])/);
});
