import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildBrandTokens, normalizeHex } from "../public/js/modules/room-service-erp/theme.js";

const read = (path) => fs.readFileSync(path, "utf8");

test("ERP carrega somente a nova fundacao visual como ultima camada", () => {
  const html = read("public/erp/room-service/index.html");
  const redesignPosition = html.indexOf("erp-redesign.css");
  const visualSystemPosition = html.indexOf("design-system-v5.css");

  assert.ok(redesignPosition >= 0);
  assert.ok(visualSystemPosition > redesignPosition);
  assert.doesNotMatch(html, /design-system-v4\.css/);
  assert.match(html, /data-erp="room-service"/);
});

test("nova fundacao define tokens, breakpoints e movimento acessivel", () => {
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");

  for (const token of [
    "--brand-primary",
    "--brand-primary-hover",
    "--brand-primary-soft",
    "--brand-on-primary",
    "--erp-canvas",
    "--erp-surface",
    "--erp-text",
    "--erp-motion-fast",
    "--erp-ease-standard",
    "--erp-z-modal",
  ]) {
    assert.match(css, new RegExp(token));
  }

  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /width: calc\(100vw - 32px\) !important/);
  assert.match(css, /#loginOverlay \{\s*padding: 16px !important/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.erp-page/);
  assert.match(css, /\.erp-order-list/);
  assert.match(css, /#vendasContainer\.erp-pdv-workspace/);
  assert.match(css, /\.erp-dashboard-donut/);
  assert.match(css, /#faturamentoContainer \.history-table-wrap/);
  assert.match(css, /\.erp-settings-grid/);
  assert.match(css, /\.erp-page-container/);
  assert.match(css, /\.erp-switch-track/);
  assert.match(css, /\.top-search-box:has\(input:focus-visible\)/);
  assert.match(css, /#orderModal/);
  assert.match(css, /\.sidebar-collapsed/);
  assert.match(css, /attr\(data-tooltip\)/);
  assert.doesNotMatch(css, /#513b2d|#3f2d22/);
  assert.doesNotMatch(css, /transition:\s*all/i);
});

test("branding gera cores derivadas e contraste legivel", () => {
  const light = buildBrandTokens("#f6d85f", "#244d3c");
  const dark = buildBrandTokens("#19362e");

  assert.equal(light["--brand-primary"], "#f6d85f");
  assert.equal(light["--brand-secondary"], "#244d3c");
  assert.equal(light["--brand-on-primary"], "#111827");
  assert.equal(dark["--brand-on-primary"], "#ffffff");
  assert.notEqual(light["--brand-primary-hover"], light["--brand-primary"]);
  assert.notEqual(light["--brand-primary-soft"], light["--brand-primary"]);
  assert.equal(normalizeHex("#abc"), "#aabbcc");
  assert.equal(normalizeHex("cor-invalida"), "");
});

test("ERP aplica branding, contexto de rota e componentes da nova geracao", () => {
  const app = read("public/js/modules/room-service-erp/legacy-app.js");

  assert.match(app, /applyBrandTokens\(root, branding\.primary_color, branding\.secondary_color\)/);
  assert.match(app, /function installOrdersInterface\(\)/);
  assert.match(app, /function installGuestsInterface\(\)/);
  assert.match(app, /function installVisualSystem\(\)/);
  assert.match(app, /classList\.add\("erp-design-system-v5"\)/);
  assert.match(app, /classList\.add\("erp-authenticated"\)/);
  assert.match(app, /classList\.remove\("erp-authenticated"\)/);
  assert.match(app, /class="erp-page erp-orders-page"/);
  assert.match(app, /document\.body\.dataset\.erpRoute = route/);
  assert.match(app, /setAttribute\("aria-current", active \? "page" : "false"\)/);
  assert.match(app, /button\.dataset\.tooltip = label/);
  assert.match(app, /ordersRefreshButton/);
  assert.match(app, /guestsRefreshButton/);
  assert.match(app, /guestDirectoryMeta/);
  assert.match(app, /id="settingsContent" class="erp-settings-content"/);
  assert.match(app, /id="operationScheduleForm" class="erp-schedule-form"/);
  assert.match(app, /class="erp-switch-track"/);
  assert.doesNotMatch(app, /id="settingsContent" class="erp-v3-shell"/);
  assert.doesNotMatch(app, /classList\.add\("pdv-collapsed"\)/);
  assert.doesNotMatch(app, /class="erp-v4-page/);
});

test("editor, modais e layout estreito preservam conteudo e acoes", () => {
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");
  const app = read("public/js/modules/room-service-erp/legacy-app.js");

  assert.match(css, /\.erp-catalog-grid \{[\s\S]*grid-template-columns: repeat\(auto-fill, minmax\(290px, 1fr\)\)/);
  assert.match(css, /\.erp-product-card \{[\s\S]*height: auto;[\s\S]*overflow: visible;/);
  assert.match(css, /\.erp-product-body > strong \{[\s\S]*white-space: normal;/);
  assert.match(css, /\.erp-user-modal-card \{[\s\S]*max-height: calc\(100dvh - 32px\)[\s\S]*overflow: hidden/);
  assert.match(css, /\.erp-user-modal-actions \{[\s\S]*position: sticky;[\s\S]*bottom: 0;/);
  assert.match(css, /\.erp-user-permission-grid label \{[\s\S]*min-height: 52px;/);
  assert.match(css, /@media \(max-width: 1100px\) \{[\s\S]*\.app-main \{[\s\S]*flex: 1 1 100% !important;/);
  assert.match(css, /\.sidebar-footer \{[\s\S]*border-top: 0 !important;/);
  assert.match(css, /#vendasContainer > main\.erp-pdv-catalog[\s\S]*flex: 1 1 0 !important;/);
  assert.match(css, /#menuContent \.erp-pdv-card-copy h3 \{[\s\S]*-webkit-line-clamp: unset;/);
  assert.match(css, /#menuContent \.erp-pdv-card-action \{[\s\S]*grid-column: 1 \/ -1;/);
  assert.match(app, /data-category-scroll="-1"/);
  assert.match(app, /tabs\.scrollBy\(/);
});

test("conta e suporte usam estados visuais controlados", () => {
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");
  const app = read("public/js/modules/room-service-erp/legacy-app.js");

  assert.match(app, /id="accountAvatarFile" class="erp-visually-hidden"/);
  assert.match(app, /id="accountAvatarFileName"/);
  assert.match(app, /class="erp-settings-breadcrumb"/);
  assert.match(app, /class="erp-feedback-empty-state"/);
  assert.match(app, /image\.removeAttribute\("src"\)/);
  assert.match(css, /\.erp-account-settings \{[\s\S]*grid-template-columns: minmax\(300px, \.8fr\) minmax\(420px, 1\.2fr\)/);
  assert.match(css, /\.erp-feedback-preview img\[hidden\]/);
  assert.match(css, /\.top-search-item\.active[\s\S]*background: var\(--brand-primary-soft\)/);
});

test("login, menu rapido e escala usam a estrutura final sem superficies concorrentes", () => {
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");
  const polish = read("public/css/modules/room-service-erp/production-polish.css");
  const app = read("public/js/modules/room-service-erp/legacy-app.js");

  assert.match(css, /ERP workspace refinement/);
  assert.match(css, /\.login-card \{[\s\S]*border: 0 !important;[\s\S]*background: transparent !important;[\s\S]*box-shadow: none !important;/);
  assert.match(css, /\.quick-settings-grid \{[\s\S]*flex-direction: column !important;/);
  assert.match(css, /\.quick-tile\.logout[\s\S]*grid-template-columns: 22px minmax\(0, 1fr\) !important;/);
  assert.match(app, /byId\("quickThemeTile", false\)\?\.remove\(\)/);
  assert.doesNotMatch(app, /function toggleTheme\(/);
  assert.doesNotMatch(app, /function applySavedTheme\(/);
  assert.doesNotMatch(polish, /#appShell \{\s*transform: scale/);
  assert.match(app, /setProperty\("width", `\$\{100 \/ factor\}vw`, "important"\)/);
  assert.match(app, /setProperty\("height", `\$\{100 \/ factor\}dvh`, "important"\)/);
});

test("PDV ancora a comanda e separa cabecalho, lista rolavel e rodape fixo", () => {
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");
  const app = read("public/js/modules/room-service-erp/legacy-app.js");

  assert.match(css, /#vendasContainer\.erp-pdv-workspace \{[\s\S]*padding: 0 !important;[\s\S]*overflow: hidden !important;/);
  assert.match(css, /#vendasContainer \.pdv-panel \{[\s\S]*height: 100% !important;[\s\S]*margin: 0 !important;[\s\S]*border-radius: 0 !important;/);
  assert.match(css, /#cartItems\.erp-pdv-cart-list \{[\s\S]*overflow-y: auto !important;/);
  assert.match(css, /\.erp-pdv-checkout \{[\s\S]*position: sticky;[\s\S]*inset: auto 0 0;/);
  assert.match(css, /\.erp-pdv-list \{[\s\S]*minmax\(300px, 1fr\)/);
  assert.match(css, /#menuContent \.erp-pdv-card-copy p \{[\s\S]*-webkit-line-clamp: 2;/);
  assert.match(css, /#menuContent \.erp-pdv-card-action \{[\s\S]*border-top: 0 !important;/);
  assert.doesNotMatch(app, /Selecione um item para adicionar/);
});
