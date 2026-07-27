import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { internalsForTests } from "../public/js/modules/emporio/index.js";
import { ADMIN_ORIGIN, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));

test("Emporio publico exige modulo habilitado e preserva isolamento por hotel", async () => {
  const context = createWorkerTestContext();
  const blocked = await context.json("/api/v1/public/hotels/muller-fioreze/emporio/items");
  assert.equal(blocked.response.status, 404);

  context.env.__data.catalogs.push({
    id: "cat-aurora-emporio",
    hotel_id: "aurora-demo",
    module_key: "emporio",
    status: "active",
  });
  context.env.__data.categories.push({
    id: "catg-aurora-emporio",
    hotel_id: "aurora-demo",
    catalog_id: "cat-aurora-emporio",
    module_key: "emporio",
    name: "Presentes",
    status: "active",
    sort_order: 10,
  });
  context.env.__data.catalogItems.push({
    id: "aurora-emporio-gift",
    public_id: "aurora-emporio-gift",
    hotel_id: "aurora-demo",
    module_key: "emporio",
    catalog_id: "cat-aurora-emporio",
    category_id: "catg-aurora-emporio",
    name: "Presente ficticio",
    description: "Produto usado somente no teste.",
    item_type: "product",
    price_cents: 3500,
    currency: "BRL",
    image_url: null,
    status: "active",
    sort_order: 10,
  });
  context.env.__data.availability.push({
    catalog_item_id: "aurora-emporio-gift",
    hotel_id: "aurora-demo",
    is_available: 1,
    availability_label: null,
  });

  const result = await context.json("/api/v1/public/hotels/aurora-demo/emporio/items");
  const ids = result.body.data.categories.flatMap((category) => category.items.map((item) => item.id));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.hotel_id, "aurora-demo");
  assert.deepEqual(ids, ["aurora-emporio-gift"]);
  assert.equal(ids.includes("muller-emporio-water"), false);
});

test("editor administrativo cadastra categoria, produto e imagem sem criar pedido", async () => {
  const context = createWorkerTestContext();
  const cookie = await createSessionCookie(context.env);
  const orderCount = context.env.__data.orders.length;
  const printCount = context.env.__data.printEvents.length;
  const category = await context.json(
    "/api/v1/admin/emporio/catalog/categories",
    adminJson(cookie, "POST", {
      hotel_id: "muller-fioreze",
      name: "Lembrancas",
      description: "Categoria ficticia.",
      sort_order: 20,
    }),
  );
  const product = await context.json(
    "/api/v1/admin/emporio/catalog/items",
    adminJson(cookie, "POST", {
      hotel_id: "muller-fioreze",
      category_id: category.body.data.category.id,
      name: "Produto ficticio do Emporio",
      description: "Item sem venda online.",
      tag: "Exclusivo",
      price_cents: 4900,
      currency: "BRL",
      status: "active",
      sort_order: 10,
      is_available: true,
      availability_label: "Consulte a recepcao",
      media_asset_id: "media-muller-logo",
    }),
  );
  const updated = await context.json(
    `/api/v1/admin/emporio/catalog/items/${encodeURIComponent(product.body.data.item.id)}`,
    adminJson(cookie, "PATCH", {
      hotel_id: "muller-fioreze",
      is_available: false,
      availability_label: "Temporariamente indisponivel",
    }),
  );
  const catalog = await context.json(
    "/api/v1/admin/emporio/catalog?hotel_id=muller-fioreze",
    withCookie(cookie),
  );
  const saved = catalog.body.data.categories
    .flatMap((entry) => entry.items)
    .find((entry) => entry.id === product.body.data.item.id);

  assert.equal(category.response.status, 201);
  assert.equal(product.response.status, 201);
  assert.equal(product.body.data.item.image_url, "/media/media-muller-logo");
  assert.equal(updated.body.data.item.is_available, false);
  assert.equal(saved.available, false);
  assert.equal(context.env.__data.orders.length, orderCount);
  assert.equal(context.env.__data.printEvents.length, printCount);
  assert.ok(context.env.__data.adminAuditLog.some((entry) => entry.action === "emporio.catalog_item.created"));
});

test("editor do Emporio bloqueia imagem e hotel fora do acesso administrativo", async () => {
  const context = createWorkerTestContext();
  context.env.__data.mediaAssets.push({
    id: "media-aurora-private",
    hotel_id: "aurora-demo",
    module_key: "emporio",
    public_url: "/media/media-aurora-private",
    mime_type: "image/webp",
    status: "active",
  });
  const cookie = await createSessionCookie(context.env, "user-aurora-admin");
  const foreignHotel = await context.json(
    "/api/v1/admin/emporio/catalog?hotel_id=muller-fioreze",
    withCookie(cookie),
  );
  const foreignImage = await context.json(
    "/api/v1/admin/emporio/catalog/items",
    adminJson(await createSessionCookie(context.env), "POST", {
      hotel_id: "muller-fioreze",
      category_id: "catg-muller-emporio",
      name: "Produto isolado",
      price_cents: 1000,
      media_asset_id: "media-aurora-private",
    }),
  );

  assert.equal(foreignHotel.response.status, 401);
  assert.equal(foreignImage.response.status, 400);
  assert.equal(context.env.__data.catalogItems.some((entry) => entry.name === "Produto isolado"), false);
});

test("acao do Emporio usa o WhatsApp configurado pela unidade sem expor numero fixo", () => {
  const action = internalsForTests.whatsappAction(
    { name: "Hotel de teste", settings: { "contact.whatsapp": "(54) 99999-0000" } },
    { name: "Produto ficticio" },
  );
  const fallback = internalsForTests.whatsappAction({ settings: {} }, { name: "Produto ficticio" });

  assert.match(action.href, /^https:\/\/wa\.me\/5554999990000\?/);
  assert.match(decodeURIComponent(action.href), /Produto ficticio/);
  assert.equal(fallback.href, null);
});

test("frontend do Emporio oferece catalogo e WhatsApp sem carrinho ou checkout", () => {
  const moduleSource = fs.readFileSync(`${APP_ROOT}/public/js/modules/emporio/index.js`, "utf8");
  const moduleCss = fs.readFileSync(`${APP_ROOT}/public/css/modules/emporio/emporio.css`, "utf8");
  const loader = fs.readFileSync(`${APP_ROOT}/public/js/core/module-loader.js`, "utf8");
  const editor = fs.readFileSync(`${APP_ROOT}/public/js/modules/admin/guest-portal-editor.js`, "utf8");
  const navigation = fs.readFileSync(`${APP_ROOT}/public/js/core/guest-navigation.js`, "utf8");

  assert.match(loader, /emporio: \(\) => import\("\.\.\/modules\/emporio\/index\.js"\)/);
  assert.match(moduleSource, /contact\.whatsapp/);
  assert.match(moduleSource, /https:\/\/wa\.me\//);
  assert.match(moduleSource, /Falar com a recepção/);
  assert.match(moduleSource, /Catálogo para consulta/);
  assert.match(moduleSource, /<h1>Empório<\/h1>/);
  assert.match(moduleSource, /data-emporio-carousel/);
  assert.match(moduleSource, /window\.setInterval/);
  assert.match(moduleSource, /prefers-reduced-motion/);
  assert.match(moduleSource, /aria-label="Buscar no Empório"/);
  assert.doesNotMatch(moduleSource, />Pesquisar produtos</);
  assert.doesNotMatch(moduleSource, /\bcarrinho\b|\bcheckout\b|adicionar ao carrinho/i);
  assert.match(moduleCss, /\.emporio-product-grid/);
  assert.match(moduleCss, /\.emporio-carousel-slide\.is-active/);
  assert.match(moduleCss, /\.emporio-detail-card/);
  assert.match(moduleCss, /\.emporio-detail\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(editor, /data-guest-editor-tab="emporio"|activeTab === "emporio"/);
  assert.match(editor, /\/api\/v1\/admin\/emporio\/catalog/);
  assert.doesNotMatch(navigation, /guest-drawer-brand[^]*bootstrap\.short_name/);
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
