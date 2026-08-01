import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { romanticPackagesInternalsForTests } from "../public/js/modules/romantic-packages/index.js";
import { romanticPackagesInternalsForTests as routeInternals } from "../src/modules/romantic-packages/routes.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const FAVICON_URL = "https://portal.hoteisfioreze.com.br/media/media_8621b104-2e1f-478a-8109-c926737a22ad";

test("pacotes romanticos publicos exigem modulo habilitado e preservam isolamento por hotel", async () => {
  const context = createWorkerTestContext();
  const blocked = await context.json("/api/v1/public/hotels/muller-fioreze/romantic-packages/packages");
  assert.equal(blocked.response.status, 404);

  const mullerModule = context.env.__data.hotelModules.find(
    (entry) => entry.hotel_id === "muller-fioreze" && entry.module_key === "romantic-packages",
  );
  mullerModule.enabled = 1;
  context.env.__data.romanticPackages.push(
    {
      id: "romantic-muller-fictitious",
      hotel_id: "muller-fioreze",
      module_key: "romantic-packages",
      name: "Experiencia ficticia",
      description: "Conteudo usado somente no teste.",
      included_items_json: JSON.stringify(["Item ficticio A", "Item ficticio B"]),
      price_cents: 12500,
      currency: "BRL",
      status: "active",
      sort_order: 10,
      media_asset_id: "media-muller-logo",
      category_id: "category-muller-celebrations",
      category_key: "celebrations",
      category_name: "Celebrações",
      category_description: "Momentos fictícios para testes.",
      category_sort_order: 20,
    },
    {
      id: "romantic-aurora-foreign",
      hotel_id: "aurora-demo",
      module_key: "romantic-packages",
      name: "Pacote de outro hotel",
      description: "Nao pode vazar entre unidades.",
      included_items_json: "[]",
      price_cents: 9000,
      currency: "BRL",
      status: "active",
      sort_order: 10,
      media_asset_id: null,
    },
  );

  const result = await context.json("/api/v1/public/hotels/muller-fioreze/romantic-packages/packages");
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.hotel_id, "muller-fioreze");
  assert.equal(result.body.data.module_key, "romantic-packages");
  assert.deepEqual(result.body.data.packages.map((entry) => entry.id), ["romantic-muller-fictitious"]);
  assert.deepEqual(result.body.data.packages[0].included_items, ["Item ficticio A", "Item ficticio B"]);
  assert.equal(result.body.data.packages[0].item_type, "package");
  assert.equal(result.body.data.packages[0].category_key, "celebrations");
  assert.equal(result.body.data.packages[0].category_name, "Celebrações");
  assert.equal(result.body.data.packages[0].image_url, "/assets/hotels/muller-fioreze/logo.png");
});

test("normalizacao publica de pacotes rejeita inclusoes malformadas", () => {
  assert.deepEqual(routeInternals.parseIncludedItems('["Cafe", "", 12]'), ["Cafe", "12"]);
  assert.deepEqual(routeInternals.parseIncludedItems("{invalid"), []);
  assert.deepEqual(routeInternals.parseIncludedItems('{"item":"nao-e-lista"}'), []);
  assert.equal(routeInternals.publicPackage({ item_type: "add-on" }).item_type, "add-on");
  assert.equal(routeInternals.publicPackage({ item_type: "valor-invalido" }).item_type, "package");
  assert.equal(routeInternals.publicPackage({ category_name: "Aniversários" }).category_name, "Aniversários");
  assert.equal(routeInternals.publicPackage({}).category_name, "Experiências");
});

test("Room Service, Emporio e Pacotes Romanticos compartilham detalhe em tela cheia e zoom acessivel", () => {
  const roomService = fs.readFileSync(`${APP_ROOT}/public/js/modules/room-service/index.js`, "utf8");
  const emporio = fs.readFileSync(`${APP_ROOT}/public/js/modules/emporio/index.js`, "utf8");
  const romantic = fs.readFileSync(`${APP_ROOT}/public/js/modules/romantic-packages/index.js`, "utf8");
  const sharedJs = fs.readFileSync(`${APP_ROOT}/public/js/modules/shared/catalog-media-viewer.js`, "utf8");
  const sharedCss = fs.readFileSync(`${APP_ROOT}/public/css/modules/shared/catalog-detail.css`, "utf8");
  const romanticCss = fs.readFileSync(`${APP_ROOT}/public/css/modules/romantic-packages/romantic-packages.css`, "utf8");
  const loader = fs.readFileSync(`${APP_ROOT}/public/js/core/module-loader.js`, "utf8");

  for (const source of [roomService, emporio, romantic]) {
    assert.match(source, /catalog-detail-layer/);
    assert.match(source, /catalog-detail-surface/);
    assert.match(source, /renderZoomableCatalogMedia/);
    assert.match(source, /renderCatalogMediaViewer/);
    assert.match(source, /bindCatalogMediaViewer/);
  }
  assert.match(sharedCss, /\.catalog-detail-surface\s*\{[^}]*height:\s*100dvh/s);
  assert.match(sharedCss, /\.catalog-detail-media-button img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(sharedCss, /\.catalog-media-viewer-stage img/);
  assert.match(sharedJs, /data-catalog-media-action="zoom-in"/);
  assert.match(sharedJs, /data-catalog-media-action="zoom-out"/);
  assert.match(sharedJs, /event\.key === "Escape"/);
  assert.match(sharedJs, /MAX_ZOOM = 3/);
  assert.match(romanticCss, /\.romantic-packages-grid/);
  assert.match(romanticCss, /\.romantic-packages-app\.is-special-decorations/);
  assert.match(romanticCss, /\.romantic-centro-addon-list/);
  assert.match(romantic, /usesEditorialLayout:\s*true/);
  assert.match(romantic, /Foto meramente ilustrativa/);
  assert.match(romantic, /Decorações especiais/);
  assert.doesNotMatch(romantic, /Encante o seu amor|Família Fioreze|<small>Surpresa<\/small>/);
  assert.match(loader, /"romantic-packages": \(\) => import\("\.\.\/modules\/romantic-packages\/index\.js"\)/);
});

test("Pacotes Romanticos usa consulta por hotel e acao da recepcao sem compra online", () => {
  const route = fs.readFileSync(`${APP_ROOT}/src/modules/romantic-packages/routes.js`, "utf8");
  const moduleSource = fs.readFileSync(`${APP_ROOT}/public/js/modules/romantic-packages/index.js`, "utf8");
  const futureRoutes = fs.readFileSync(`${APP_ROOT}/src/modules/future/routes.js`, "utf8");
  const action = romanticPackagesInternalsForTests.whatsappAction(
    { name: "Hotel de teste", settings: { "contact.whatsapp": "(54) 99999-0000" } },
    { name: "Pacote ficticio" },
  );

  assert.match(route, /WHERE rp\.hotel_id = \?/);
  assert.match(route, /rp\.module_key = \?/);
  assert.match(route, /rp\.status = 'active'/);
  assert.match(route, /LEFT JOIN decoration_categories dc/);
  assert.match(route, /dc\.hotel_id = rp\.hotel_id/);
  assert.match(route, /ma\.hotel_id = rp\.hotel_id/);
  assert.match(moduleSource, /Falar com a recepção/);
  assert.doesNotMatch(moduleSource, /comprar agora|checkout|adicionar ao carrinho/i);
  assert.match(action.href, /^https:\/\/wa\.me\/5554999990000\?/);
  assert.doesNotMatch(futureRoutes, /router\.get\([^]*romantic-packages\/packages/);
});

test("catalogo romantico do Fioreze Centro preserva escopo, precos e midias do PDF", () => {
  const migration = fs.readFileSync(`${APP_ROOT}/migrations/0031_fioreze_centro_romantic_catalog.sql`, "utf8");
  const expectedPrices = [
    15700, 28700, 49700, 72700, 12900, 15000, 22000, 11000, 27000,
    14000, 33000, 30000, 67000, 22000, 27000, 18000, 11000,
  ];

  assert.match(migration, /ADD COLUMN item_type TEXT NOT NULL DEFAULT 'package'/);
  assert.match(migration, /CHECK \(item_type IN \('package', 'add-on'\)\)/);
  assert.match(migration, /folder-fiorezecentro-portal-romantico/);
  assert.match(migration, /hotels\/fiorezecentro\/portal\/romantico\/surpresa-amore\.jpg/);
  assert.match(migration, /hotels\/fiorezecentro\/portal\/romantico\/surpresa-cupido\.jpg/);
  assert.match(migration, /hotels\/fiorezecentro\/portal\/romantico\/surpresa-conquistare\.jpg/);
  assert.match(migration, /hotels\/fiorezecentro\/portal\/romantico\/surpresa-perfetta\.jpg/);
  assert.equal((migration.match(/'fiorezecentro'/g) || []).length > 20, true);
  assert.doesNotMatch(migration, /'muller-fioreze'|'aurora-demo'/);
  for (const price of expectedPrices) assert.match(migration, new RegExp(`\\b${price}\\b`));
  assert.equal((migration.match(/'package'\s*\n\s*\)/g) || []).length, 4);
  assert.equal((migration.match(/'add-on'\s*\n\s*\)/g) || []).length, 13);
});

test("decoracoes especiais agrupam pacotes por categorias ordenadas", () => {
  const groups = romanticPackagesInternalsForTests.groupPackagesByCategory([
    {
      id: "package-celebration",
      name: "Celebração",
      category_key: "celebrations",
      category_name: "Celebrações",
      category_sort_order: 20,
    },
    {
      id: "package-romantic",
      name: "Surpresa Amore",
      category_key: "romantic-surprises",
      category_name: "Surpresas Românticas",
      category_sort_order: 10,
    },
    {
      id: "addon-romantic",
      name: "Pétalas",
      item_type: "add-on",
      category_key: "romantic-surprises",
      category_name: "Surpresas Românticas",
      category_sort_order: 10,
    },
  ]);

  assert.deepEqual(groups.map((group) => group.key), ["romantic-surprises", "celebrations"]);
  assert.deepEqual(groups[0].items.map((item) => item.id), ["package-romantic", "addon-romantic"]);
  assert.equal(romanticPackagesInternalsForTests.displayPackageName(groups[0].items[0]), "Amore");
  assert.equal(romanticPackagesInternalsForTests.displayPackageName(groups[1].items[0]), "Celebração");
});

test("migration transforma o portal em Decoracoes Especiais com categorias extensíveis", () => {
  const migration = fs.readFileSync(`${APP_ROOT}/migrations/0032_special_decoration_categories.sql`, "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS decoration_categories/);
  assert.match(migration, /UNIQUE \(hotel_id, module_key, category_key\)/);
  assert.match(migration, /ADD COLUMN category_id TEXT REFERENCES decoration_categories\(id\)/);
  assert.match(migration, /name = 'Decorações Especiais'/);
  assert.match(migration, /public_name = 'Decorações Especiais'/);
  assert.match(migration, /'romantic-surprises'/);
  assert.match(migration, /'Surpresas Românticas'/);
  assert.match(migration, /WHERE hotel_id = 'fiorezecentro'/);
  assert.doesNotMatch(migration, /'muller-fioreze'|'aurora-demo'/);
});

test("todos os shells da Central Administrativa usam o favicon oficial", () => {
  const adminHtmlFiles = [
    "public/admin/index.html",
    "public/admin/portais/index.html",
    "public/admin/room-service/index.html",
  ];
  for (const relativePath of adminHtmlFiles) {
    const html = fs.readFileSync(`${APP_ROOT}/${relativePath}`, "utf8");
    assert.match(html, new RegExp(`<link rel="icon" type="image/png" href="${escapeRegExp(FAVICON_URL)}">`));
  }
});

test("migration de pacotes adiciona somente referencia de midia e indice multi-hotel", () => {
  const migration = fs.readFileSync(`${APP_ROOT}/migrations/0029_romantic_packages_media.sql`, "utf8");
  assert.match(migration, /ALTER TABLE romantic_packages/);
  assert.match(migration, /media_asset_id TEXT REFERENCES media_assets\(id\) ON DELETE SET NULL/);
  assert.match(migration, /ON romantic_packages\(hotel_id, media_asset_id\)/);
  assert.doesNotMatch(migration, /^\s*(?:INSERT|UPDATE|DELETE)\b/im);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
