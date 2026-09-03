import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Central Administrativa possui uma camada mobile global carregada por último", async () => {
  const entry = await readFile(new URL("../public/js/modules/admin/admin-totp.js", import.meta.url), "utf8");
  const module = await readFile(new URL("../public/js/modules/admin/admin-mobile-v1.js", import.meta.url), "utf8");

  const shortLinksIndex = entry.indexOf("admin-short-links-v2.js");
  const mobileIndex = entry.indexOf("admin-mobile-v1.js");
  assert.ok(shortLinksIndex >= 0, "o módulo de Links deve continuar carregado");
  assert.ok(mobileIndex > shortLinksIndex, "a camada mobile deve carregar depois dos estilos de features");
  assert.match(entry, /admin-mobile-v1\.js\?v=20260903-3/);

  assert.match(module, /admin-mobile-v1\.css\?v=20260903-1/);
  assert.match(module, /admin-mobile-auth\.css\?v=20260903-1/);
  assert.match(module, /admin-mobile-sections\.css\?v=20260903-1/);
  assert.match(module, /admin-mobile-v2\.css\?v=20260903-1/);
  assert.match(module, /admin-mobile-polish\.css\?v=20260903-1/);
  assert.match(module, /const MOBILE_QUERY = "\(max-width: 980px\)"/);
  assert.match(module, /classList\.remove\("is-menu-open"\)/);
  assert.match(module, /is-admin-mobile-menu-open/);
  assert.match(module, /aria-expanded/);
  assert.match(module, /event\.key === "Escape"/);
});

test("bootstrap compartilhado versiona a autoridade mobile para todas as rotas administrativas", async () => {
  const api = await readFile(new URL("../public/js/modules/admin/shared/admin-api.js", import.meta.url), "utf8");
  assert.match(api, /import\("\.\.\/admin-totp\.js\?v=20260903-4"\)/);
});

test("layout mobile cobre shell, formulários, listas, dialogs e Links", async () => {
  const css = await readFile(new URL("../public/css/modules/admin/admin-mobile-v1.css", import.meta.url), "utf8");

  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /\.admin-global-sidebar[\s\S]*translateX\(-104%\)/);
  assert.match(css, /\.admin-dashboard\.is-menu-open \.admin-global-sidebar/);
  assert.match(css, /\.admin-topbar-actions[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.admin-command-search[\s\S]*width: 100% !important/);
  assert.match(css, /\.admin-management-row/);
  assert.match(css, /\.admin-unit-row/);
  assert.match(css, /\.admin-editor-dialog/);
  assert.match(css, /#shortLinksManager\[data-links-design="v2"\]/);
  assert.match(css, /\.admin-short-link-row\.admin-link-card[\s\S]*grid-template-columns: 42px minmax\(0, 1fr\)/);
  assert.match(css, /font-size: 16px/);
  assert.doesNotMatch(css, /@import\s+url/i);
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|1[01])px/);
  assert.doesNotMatch(css, /font-weight:\s*(?:[1-9][1-9][0-9]|[1-9][0-9][1-9])/);
});

test("mobile complexo cobre Home, Mensagens, Mídia e Editor do Portal", async () => {
  const css = await readFile(new URL("../public/css/modules/admin/admin-mobile-sections.css", import.meta.url), "utf8");

  assert.match(css, /\.admin-home-kpis/);
  assert.match(css, /\.admin-messages-layout[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.admin-messages-manager\.is-reading-message \.admin-message-detail/);
  assert.match(css, /data-active-portal-section="shortLinksManager"[\s\S]*background: #fff !important/);
  assert.match(css, /\.admin-media-drive[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /data-active-portal-section="contentManager"/);
  assert.match(css, /\.guest-portal-editor-body[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.guest-portal-preview-frame[\s\S]*width: 100% !important/);
  assert.doesNotMatch(css, /@import\s+url/i);
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|1[01])px/);
  assert.doesNotMatch(css, /font-weight:\s*(?:[1-9][1-9][0-9]|[1-9][0-9][1-9])/);
});

test("login e MFA mobile ficam dentro da viewport e usam controles tocáveis", async () => {
  const css = await readFile(new URL("../public/css/modules/admin/admin-mobile-auth.css", import.meta.url), "utf8");

  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.admin-access-card[\s\S]*width: 100% !important/);
  assert.match(css, /\.admin-access-card input[\s\S]*font-size: 16px !important/);
  assert.match(css, /\.admin-totp-login-field input[\s\S]*min-height: 56px/);
  assert.match(css, /\.admin-totp-login-actions[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /@import\s+url/i);
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|1[01])px/);
  assert.doesNotMatch(css, /font-weight:\s*(?:[1-9][1-9][0-9]|[1-9][0-9][1-9])/);
});

test("autoridade mobile v2 cobre breakpoints e módulos administrativos críticos", async () => {
  const css = await readFile(new URL("../public/css/modules/admin/admin-mobile-v2.css", import.meta.url), "utf8");

  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /\.admin-command-results[\s\S]*top: calc\(100% \+ 6px\) !important/);
  assert.match(css, /\.admin-management-row[\s\S]*grid-template-columns: auto minmax\(0, 1fr\) !important/);
  assert.match(css, /\.admin-account-security-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(css, /\.admin-totp-pair-grid/);
  assert.match(css, /\.admin-unit-row/);
  assert.match(css, /#shortLinksManager\[data-links-design="v2"\][\s\S]*\.admin-links-overflow-menu/);
  assert.match(css, /\.admin-messages-manager\.is-reading-message \.admin-message-detail/);
  assert.match(css, /\.admin-media-grid[\s\S]*repeat\(auto-fill, minmax\(160px, 1fr\)\)/);
  assert.match(css, /\.guest-portal-editor-tabs[\s\S]*display: flex !important/);
  assert.match(css, /\.guest-portal-preview-frame[\s\S]*max-width: 100% !important/);
  assert.match(css, /font-size: 16px/);
  assert.doesNotMatch(css, /@import\s+url/i);
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|1[01])px/);
  assert.doesNotMatch(css, /font-weight:\s*(?:[1-9][1-9][0-9]|[1-9][0-9][1-9])/);
});

test("polimento mobile mantém header compacto e Links densos sem perder toque", async () => {
  const css = await readFile(new URL("../public/css/modules/admin/admin-mobile-polish.css", import.meta.url), "utf8");

  assert.match(css, /\.admin-topbar-actions[\s\S]*display: contents !important/);
  assert.match(css, /\.admin-mail-button[\s\S]*grid-column: 3/);
  assert.match(css, /\.admin-command-search[\s\S]*grid-row: 2/);
  assert.match(css, /\.admin-short-links-filters[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.admin-short-links-summary[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /min-height: 44px/);
  assert.doesNotMatch(css, /@import\s+url/i);
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|1[01])px/);
  assert.doesNotMatch(css, /font-weight:\s*(?:[1-9][1-9][0-9]|[1-9][0-9][1-9])/);
});
