import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildInterfaceViewport, ERP_DESKTOP_TITLEBAR_HEIGHT } from "../public/js/modules/room-service-erp/interface-viewport.js";
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
  const baseSidebar = css.match(/body\[data-erp="room-service"\] \.app-sidebar \{([\s\S]*?)\}/)?.[1] || "";

  assert.match(css, /\.erp-catalog-grid \{[\s\S]*grid-template-columns: repeat\(auto-fill, minmax\(290px, 1fr\)\)/);
  assert.match(css, /\.erp-product-card \{[\s\S]*height: auto;[\s\S]*overflow: visible;/);
  assert.match(css, /\.erp-product-body > strong \{[\s\S]*white-space: normal;/);
  assert.match(css, /\.erp-user-modal-card \{[\s\S]*max-height: calc\(100dvh - 32px\)[\s\S]*overflow: hidden/);
  assert.match(css, /\.erp-user-modal-actions \{[\s\S]*position: sticky;[\s\S]*bottom: 0;/);
  assert.match(css, /\.erp-user-permission-grid label \{[\s\S]*min-height: 52px;/);
  assert.match(css, /@media \(max-width: 1100px\) \{[\s\S]*\.app-main \{[\s\S]*flex: 1 1 100% !important;/);
  assert.match(baseSidebar, /border-right: 1px solid var\(--erp-line\) !important;/);
  assert.doesNotMatch(baseSidebar, /border-right: 0 !important;/);
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
  assert.match(app, /buildInterfaceViewport\(factor, \{ isElectron: desktop\.isElectron \}\)/);
  assert.match(app, /setProperty\("width", viewport\.width, "important"\)/);
  assert.match(app, /setProperty\("height", viewport\.height, "important"\)/);
});

test("login mantem composicao coesa durante identificacao e carregamento", () => {
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");
  const app = read("public/js/modules/room-service-erp/legacy-app.js");

  assert.match(app, /function installLoginComposition\(\)/);
  assert.match(app, /className = "erp-login-brand"/);
  assert.match(app, /className = "erp-login-form"/);
  assert.match(app, /className = "erp-login-field"/);
  assert.match(app, /<span>C&oacute;digo do usu&aacute;rio<\/span>/);
  assert.match(app, /<span>Senha<\/span>/);
  assert.match(app, /input\.dataset\.loginCredential = code/);
  assert.match(app, /input\.value = displayName/);
  assert.match(app, /const credential = loginCode\.dataset\.loginCredential \|\| loginCode\.value\.trim\(\)/);
  assert.match(app, /loginCode\.placeholder = "Codigo do usuario"/);
  assert.doesNotMatch(app, /Usuário localizado/);
  assert.match(app, /function renderLoginServiceStatus\(\)/);
  assert.match(app, /status\?\.open \? "Sistema aberto" : "Sistema fechado"/);
  assert.match(app, /classList\.toggle\("is-loading", busy\)/);
  assert.match(css, /\.login-card \{[\s\S]*grid-template-columns: minmax\(280px, 1fr\) minmax\(340px, 380px\)/);
  assert.match(css, /\.erp-login-field \{[\s\S]*display: grid;[\s\S]*font-size: 12px;/);
  assert.match(css, /#loginNameBadge \{[\s\S]*display: none !important;/);
  assert.match(css, /\.login-card\.is-loading > :is\(\.erp-login-brand, \.erp-login-form\)/);
  assert.match(css, /#btnLogin \{[\s\S]*width: 176px !important;[\s\S]*height: 42px !important;[\s\S]*align-self: flex-start;[\s\S]*margin: 1px 0 0 !important;/);
});

test("PDV ancora a comanda e separa cabecalho, lista rolavel e rodape fixo", () => {
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");
  const app = read("public/js/modules/room-service-erp/legacy-app.js");

  assert.match(css, /#vendasContainer\.erp-pdv-workspace \{[\s\S]*padding: 0 !important;[\s\S]*overflow: hidden !important;/);
  assert.match(css, /#vendasContainer \.pdv-panel \{[\s\S]*height: auto !important;[\s\S]*align-self: stretch;[\s\S]*margin: 16px 16px calc\(16px \+ var\(--erp-desktop-bottom-inset, 0px\)\) 0 !important;[\s\S]*border: 1px solid var\(--erp-line\) !important;[\s\S]*border-radius: var\(--erp-radius-lg\) !important;/);
  assert.match(css, /#cartItems\.erp-pdv-cart-list \{[\s\S]*overflow-y: auto !important;/);
  assert.match(css, /\.erp-pdv-checkout \{[\s\S]*position: sticky;[\s\S]*inset: auto 0 0;/);
  assert.match(css, /--erp-desktop-titlebar-height: 44px;/);
  assert.match(css, /data-fioreze-desktop="electron"\] #appShell\.app-shell \{\s*height: calc\(100dvh - var\(--erp-desktop-titlebar-height\)\) !important;/);
  assert.match(css, /\.erp-pdv-list \{[\s\S]*minmax\(300px, 1fr\)/);
  assert.match(css, /#menuContent \.erp-pdv-card-copy p \{[\s\S]*-webkit-line-clamp: 2;/);
  assert.match(css, /#menuContent \.erp-pdv-card-action \{[\s\S]*border-top: 0 !important;/);
  assert.doesNotMatch(app, /Selecione um item para adicionar/);
  assert.doesNotMatch(app, /class="erp-pdv-order-head"/);
  assert.match(app, /class="erp-pdv-total-value"><span id="cartItemCount"/);
  assert.match(app, /bindPdvCheckoutActions\(\{/);
});

test("escala do Electron preserva a barra de titulo e o rodape do PDV", () => {
  assert.equal(ERP_DESKTOP_TITLEBAR_HEIGHT, 44);

  for (const scale of [85, 100, 115]) {
    const factor = scale / 100;
    const viewport = buildInterfaceViewport(factor, { isElectron: true });
    const viewportPercent = Number.parseFloat(viewport.height.match(/calc\(([^d]+)dvh/)?.[1] || "0");
    const titlebarPixels = Number.parseFloat(viewport.height.match(/- ([^p]+)px/)?.[1] || "0");

    assert.ok(Math.abs((viewportPercent * factor) - 100) < 0.0001);
    assert.ok(Math.abs((titlebarPixels * factor) - ERP_DESKTOP_TITLEBAR_HEIGHT) < 0.0001);
  }

  assert.equal(buildInterfaceViewport(1, { isElectron: true }).height, "calc(100dvh - 44px)");
  assert.equal(buildInterfaceViewport(1, { isElectron: false }).height, "100dvh");
});

test("buscas e datas usam uma unica superficie visual", () => {
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");

  assert.match(css, /:is\(\.top-search-box, \.pdv-menu-search, \.tab-search, \.erp-search-field\) > input[\s\S]*border: 0 !important;[\s\S]*background: transparent !important;/);
  assert.match(css, /input\[type="date"\]:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="range"\]\)[\s\S]*border: 0 !important;[\s\S]*box-shadow: none !important;/);
  assert.match(css, /\.erp-billing-filters > label \{[\s\S]*border: 1px solid var\(--erp-line-strong\) !important;/);
  assert.match(css, /:has\(input\[type="date"\]:focus-visible\)/);
});

test("Electron conecta a barra de titulo a lateral sem dividir o cabecalho interno", () => {
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");

  assert.match(css, /\.app-topbar \{\s*border-bottom: 0 !important;/);
  assert.match(css, /\.rs-desktop-titlebar \{\s*border-bottom: 0 !important;/);
  assert.match(css, /\.rs-desktop-titlebar::after \{\s*content: none;/);
  assert.match(css, /data-fioreze-desktop="electron"\] \.app-main \{[\s\S]*border-top: 1px solid var\(--erp-line\) !important;[\s\S]*border-left: 1px solid var\(--erp-line\) !important;[\s\S]*border-top-left-radius: 14px;/);
  assert.match(css, /data-fioreze-desktop="electron"\]\.erp-login \.rs-desktop-titlebar \{\s*background: #fff !important;/);
});

test("busca global mantem sugestoes acima da camada de contexto e clicaveis", () => {
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");

  assert.match(css, /erp-search-open #appShell::after \{[\s\S]*content: none !important;[\s\S]*display: none !important;/);
  assert.match(css, /erp-search-open \.app-topbar \{\s*z-index: 100;/);
  assert.match(css, /erp-search-open \.top-search \{\s*z-index: 110 !important;/);
  assert.match(css, /erp-search-open \.top-search-results \{[\s\S]*z-index: 111 !important;[\s\S]*pointer-events: auto !important;[\s\S]*filter: none !important;/);
});

test("PDV usa acomodacao pesquisavel e busca global sem identificadores internos", () => {
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");
  const app = read("public/js/modules/room-service-erp/legacy-app.js");

  assert.match(app, /id="roomCombobox" class="erp-room-combobox"/);
  assert.match(app, /role="combobox" aria-autocomplete="list"/);
  assert.doesNotMatch(app, /<select id="roomNumber"/);
  assert.match(app, /function renderPdvRoomOptions\(\)/);
  assert.match(app, /function roomFloorLabel\(code\)/);
  assert.match(app, /Selecione uma acomodacao cadastrada/);
  assert.match(css, /\.erp-room-options \{[\s\S]*max-height: 248px;[\s\S]*overflow-y: auto;/);
  assert.match(app, /function searchSuggestionGroup\(kind\)/);
  assert.doesNotMatch(app, /label: order\.public_id/);
  assert.match(css, /\.top-search-group > p/);
});
