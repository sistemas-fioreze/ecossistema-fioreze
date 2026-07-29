import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { specialDecorationsCatalogInternalsForTests } from "../src/modules/admin/special-decorations-catalog.js";
import { ADMIN_ORIGIN, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));

test("normalização administrativa preserva categorias, inclusões e preço opcional", () => {
  const internals = specialDecorationsCatalogInternalsForTests;
  assert.equal(internals.normalizeCategoryKey("Surpresas Românticas"), "surpresas-romanticas");
  assert.deepEqual(internals.normalizeIncludedItems([" Buquê de rosas ", "", "Fondue"]), [
    "Buquê de rosas",
    "Fondue",
  ]);
  assert.equal(internals.normalizePrice({ price_cents: null }, null), null);
  assert.equal(internals.normalizePrice({ price_cents: 55000 }, null), 55000);
  assert.throws(() => internals.normalizePrice({ price_cents: -1 }, null), /Preço inválido/);
});

test("migration Müller cadastra sete fotos, sete experiências e oito adicionais sem binários", () => {
  const migration = fs.readFileSync(
    `${APP_ROOT}/migrations/0033_muller_special_decorations_catalog.sql`,
    "utf8",
  );
  const mediaIds = new Set(migration.match(/media-muller-special-[a-z-]+/g));
  const itemIds = new Set(migration.match(/romantic-muller-fioreze-[a-z-]+/g));
  const packageTypes = [...migration.matchAll(/\n\s*'package',\n\s*'decoration-category-muller/g)];
  const addOnTypes = [...migration.matchAll(/\n\s*'add-on',\n\s*'decoration-category-muller/g)];

  assert.equal(mediaIds.size, 7);
  assert.equal(itemIds.size, 15);
  assert.equal(packageTypes.length, 7);
  assert.equal(addOnTypes.length, 8);
  assert.match(migration, /'Fabulosa'[\s\S]*55000/);
  assert.match(migration, /'Sublime'[\s\S]*98000/);
  assert.match(migration, /'Monte seu Pacote Romântico'[\s\S]*NULL/);
  assert.doesNotMatch(migration, /base64|data:image/i);
});

test("editor de Decorações Especiais usa modal amplo, CRUD protegido e upload por unidade", () => {
  const html = fs.readFileSync(`${APP_ROOT}/public/admin/portais/index.html`, "utf8");
  const editor = fs.readFileSync(
    `${APP_ROOT}/public/js/modules/admin/special-decorations-editor.js`,
    "utf8",
  );
  const css = fs.readFileSync(
    `${APP_ROOT}/public/css/modules/admin/special-decorations-editor.css`,
    "utf8",
  );
  const routes = fs.readFileSync(`${APP_ROOT}/src/modules/admin/routes.js`, "utf8");
  const service = fs.readFileSync(
    `${APP_ROOT}/src/modules/admin/special-decorations-catalog.js`,
    "utf8",
  );

  assert.match(html, /specialDecorationsDialog/);
  assert.match(html, /data-guest-editor-tab="decorations"/);
  assert.match(editor, /dialog\.showModal\(\)/);
  assert.match(editor, /data-special-media-upload/);
  assert.match(editor, /module_key", MODULE_KEY/);
  assert.match(editor, /included_items/);
  assert.match(css, /width:\s*min\(1500px/);
  assert.match(css, /height:\s*min\(940px/);
  assert.match(routes, /\/api\/v1\/admin\/special-decorations\/catalog/);
  assert.match(service, /requireAdminHotelAccess\(session, hotelId\)/);
  assert.match(service, /media_assets[\s\S]*hotel_id = \?[\s\S]*mime_type LIKE 'image\/%'/);
  assert.match(service, /admin_audit_log/);
});

test("layout editorial de Decorações Especiais é compartilhado por todas as unidades", () => {
  const moduleSource = fs.readFileSync(
    `${APP_ROOT}/public/js/modules/romantic-packages/index.js`,
    "utf8",
  );
  const css = fs.readFileSync(
    `${APP_ROOT}/public/css/modules/romantic-packages/romantic-packages.css`,
    "utf8",
  );

  assert.match(moduleSource, /usesEditorialLayout:\s*true/);
  assert.match(moduleSource, /groupPackagesByCategory/);
  assert.match(css, /\.romantic-packages-app\.is-special-decorations/);
  assert.match(css, /--centro-gold:\s*var\(--color-accent/);
  assert.match(css, /--centro-gold-deep:\s*var\(--color-primary/);
});

test("CRUD administrativo mantém catálogo, mídia e auditoria isolados por unidade", async () => {
  const context = createWorkerTestContext();
  const cookie = await createSessionCookie(context.env);
  const ordersBefore = context.env.__data.orders.length;
  const printEventsBefore = context.env.__data.printEvents.length;
  const category = await context.json(
    "/api/v1/admin/special-decorations/catalog/categories",
    adminJson(cookie, "POST", {
      hotel_id: "muller-fioreze",
      name: "Celebrações",
      description: "Categoria fictícia para testes.",
      sort_order: 10,
    }),
  );
  const item = await context.json(
    "/api/v1/admin/special-decorations/catalog/items",
    adminJson(cookie, "POST", {
      hotel_id: "muller-fioreze",
      category_id: category.body.data.category.id,
      item_type: "package",
      name: "Experiência fictícia",
      description: "Conteúdo usado somente nos testes.",
      included_items: ["Item fictício A", "Item fictício B"],
      price_cents: 12500,
      currency: "BRL",
      status: "active",
      sort_order: 10,
      media_asset_id: "media-muller-logo",
    }),
  );
  const catalog = await context.json(
    "/api/v1/admin/special-decorations/catalog?hotel_id=muller-fioreze",
    withCookie(cookie),
  );

  assert.equal(category.response.status, 201);
  assert.equal(item.response.status, 201);
  assert.equal(
    item.body.data.item.image_url,
    context.env.__data.mediaAssets.find((asset) => asset.id === "media-muller-logo").public_url,
  );
  assert.deepEqual(item.body.data.item.included_items, ["Item fictício A", "Item fictício B"]);
  assert.equal(catalog.body.data.categories.length, 1);
  assert.equal(catalog.body.data.items.length, 1);
  assert.equal(context.env.__data.orders.length, ordersBefore);
  assert.equal(context.env.__data.printEvents.length, printEventsBefore);
  assert.ok(context.env.__data.adminAuditLog.some((entry) => entry.action === "special_decorations.item.created"));
});

test("CRUD de Decorações Especiais rejeita foto pertencente a outro hotel", async () => {
  const context = createWorkerTestContext();
  const cookie = await createSessionCookie(context.env);
  const category = await context.json(
    "/api/v1/admin/special-decorations/catalog/categories",
    adminJson(cookie, "POST", {
      hotel_id: "muller-fioreze",
      name: "Ocasiões",
    }),
  );
  const result = await context.json(
    "/api/v1/admin/special-decorations/catalog/items",
    adminJson(cookie, "POST", {
      hotel_id: "muller-fioreze",
      category_id: category.body.data.category.id,
      item_type: "package",
      name: "Item bloqueado",
      included_items: [],
      price_cents: 1000,
      status: "active",
      media_asset_id: "media-aurora-private",
    }),
  );

  assert.equal(result.response.status, 400);
  assert.match(result.body.error.message, /imagem não pertence/i);
  assert.equal(context.env.__data.romanticPackages.length, 0);
});

function adminJson(cookie, method, body) {
  return withCookie(cookie, {
    method,
    headers: {
      origin: ADMIN_ORIGIN,
      "content-type": "application/json",
      "x-fioreze-admin-action": "erp-admin",
      "x-fioreze-test-now": "2026-07-12T12:00:00.000Z",
    },
    body: JSON.stringify(body),
  });
}
