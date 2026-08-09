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
  assert.match(app, /class="erp-page erp-orders-page"/);
  assert.match(app, /document\.body\.dataset\.erpRoute = route/);
  assert.match(app, /setAttribute\("aria-current", active \? "page" : "false"\)/);
  assert.match(app, /button\.dataset\.tooltip = label/);
  assert.match(app, /ordersRefreshButton/);
  assert.match(app, /guestsRefreshButton/);
  assert.match(app, /guestDirectoryMeta/);
  assert.doesNotMatch(app, /classList\.add\("pdv-collapsed"\)/);
  assert.doesNotMatch(app, /class="erp-v4-page/);
});
