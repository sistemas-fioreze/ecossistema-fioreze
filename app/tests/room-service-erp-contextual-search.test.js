import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ERP_SEARCH_CONTEXTS, getErpSearchContext } from "../public/js/modules/room-service-erp/search-context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), "utf8");
}

test("ERP global search exposes a contextual label for every area", () => {
  assert.deepEqual(Object.keys(ERP_SEARCH_CONTEXTS), [
    "dashboard",
    "vendas",
    "hist",
    "hospedes",
    "faturamento",
    "cardapio",
    "admin",
  ]);
  assert.deepEqual(getErpSearchContext("dashboard"), {
    placeholder: "Pesquisar no sistema...",
    mode: "navigation",
  });
  assert.equal(getErpSearchContext("vendas").placeholder, "Pesquisar no cardápio");
  assert.equal(getErpSearchContext("hist").placeholder, "Pesquisar pedidos");
  assert.equal(getErpSearchContext("hospedes").placeholder, "Pesquisar hóspedes");
  assert.equal(getErpSearchContext("faturamento").placeholder, "Pesquisar faturamento");
  assert.equal(getErpSearchContext("cardapio").placeholder, "Pesquisar no cardápio");
  assert.equal(getErpSearchContext("admin").placeholder, "Pesquisar configurações");
  assert.equal(getErpSearchContext("unknown"), ERP_SEARCH_CONTEXTS.dashboard);
  assert.ok(Object.values(ERP_SEARCH_CONTEXTS).filter((context) => context.mode === "filter").length >= 6);
});

test("ERP removes tab-local searches and routes the title-bar search to active content", () => {
  const app = read("public/js/modules/room-service-erp/legacy-app.js");
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");

  assert.doesNotMatch(app, /id="(?:pdvMenuSearch|guestSearchInput|menuAdminSearch)"/);
  assert.doesNotMatch(app, /byId\("(?:pdvMenuSearch|guestSearchInput|menuAdminSearch)"\)/);
  assert.match(app, /topSearch\?\.addEventListener\("input", handleTopSearchInput\)/);
  assert.match(app, /topSearch\?\.addEventListener\("focus", handleTopSearchFocus\)/);
  assert.match(app, /function syncContextualSearch\(route = state\.route\)/);
  assert.match(app, /state\.searchQueries\[state\.route\] = currentSearchQuery\(\)/);
  assert.match(app, /if \(getErpSearchContext\(state\.route\)\.mode !== "navigation"\) return closeTopSearch\(\)/);
  assert.match(app, /function renderMenu\(\) \{\s*const query = normalize\(currentSearchQuery\(\)\)/);
  assert.match(app, /function renderGuests\(\) \{\s*const query = normalize\(currentSearchQuery\(\)\)/);
  assert.match(app, /function renderCatalog\(\) \{\s*const query = normalize\(currentSearchQuery\(\)\)/);
  assert.match(app, /function renderBilling\(\)[\s\S]*?filteredOrders\(currentSearchQuery\(\)\)\.filter/);
  assert.match(app, /orderDisplayLabel\(order\),[\s\S]*?statusLabel\(order\.status\),[\s\S]*?money\(order\.total_cents, order\.currency\)/);
  assert.match(app, /function renderFilteredSettingsHome\(\)/);
  assert.match(css, /#topSearchWrap\[data-search-mode="filter"\] \.top-search-results/);
});
