import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ADMIN_ORIGIN, createErpSessionCookie, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));

test("modo manual abre e fecha pedidos sem depender do horario automatico", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const opened = await json(
    "/api/v1/admin/room-service/operations/mode",
    adminJson(cookie, "POST", { hotel_id: "muller-fioreze", mode: "forced_open" }),
  );
  const accepted = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    publicOrder("manual-open-demo"),
  );
  const closed = await json(
    "/api/v1/admin/room-service/operations/mode",
    adminJson(cookie, "POST", { hotel_id: "muller-fioreze", mode: "forced_closed" }),
  );
  const blocked = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    publicOrder("manual-closed-demo"),
  );

  assert.equal(opened.response.status, 200);
  assert.equal(opened.body.data.operation.open, true);
  assert.equal(opened.body.data.operation.source, "manual_override");
  assert.equal(accepted.response.status, 201);
  assert.equal(closed.response.status, 200);
  assert.equal(closed.body.data.operation.open, false);
  assert.equal(blocked.response.status, 422);
  assert.equal(env.__data.printEvents.length, 0);
});

test("agenda semanal substitui faixas antigas e volta ao modo automatico", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  const days = Array.from({ length: 7 }, (_, day) => ({
    day_of_week: day,
    opens_at: "08:00",
    closes_at: "23:00",
    is_closed: false,
  }));

  const updated = await json(
    "/api/v1/admin/room-service/operations/schedule",
    adminJson(cookie, "PATCH", { hotel_id: "muller-fioreze", days }),
  );

  const active = env.__data.serviceHours.filter(
    (entry) => entry.hotel_id === "muller-fioreze" && entry.module_key === "room-service" && entry.status === "active",
  );
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.service_hours.length, 7);
  assert.equal(active.length, 7);
  assert.ok(active.every((entry) => entry.sort_order === 0));
  assert.ok(env.__data.adminAuditLog.some((entry) => entry.action === "room-service.schedule.updated"));
});

test("preferencias de pedido sao configuradas por unidade e publicadas no bootstrap", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  const updated = await json(
    "/api/v1/admin/room-service/operations/preferences",
    adminJson(cookie, "PATCH", {
      hotel_id: "muller-fioreze",
      order_scheduling_enabled: true,
      order_notes_enabled: false,
    }),
  );
  const bootstrap = await json("/api/v1/public/hotels/muller-fioreze/bootstrap");
  const aurora = await json("/api/v1/public/hotels/aurora-demo/bootstrap");

  assert.equal(updated.response.status, 200);
  assert.deepEqual(updated.body.data.preferences, {
    order_scheduling_enabled: true,
    order_notes_enabled: false,
  });
  assert.equal(bootstrap.body.data.settings["room-service.order_scheduling_enabled"], true);
  assert.equal(bootstrap.body.data.settings["room-service.order_notes_enabled"], false);
  assert.equal(aurora.body.data.settings["room-service.order_scheduling_enabled"], undefined);
  assert.ok(env.__data.adminAuditLog.some((entry) => entry.action === "room-service.order_preferences.updated"));
});

test("quartos administrativos controlam as acomodacoes aceitas no portal", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  const created = await json(
    "/api/v1/admin/room-service/rooms",
    adminJson(cookie, "POST", {
      hotel_id: "muller-fioreze",
      code: "D-303",
      label: "Apartamento demo",
      room_type: "suite-demo",
      status: "active",
      sort_order: 30,
    }),
  );
  const publicRooms = await json("/api/v1/public/hotels/muller-fioreze/room-service/rooms");
  const hidden = await json(
    `/api/v1/admin/room-service/rooms/${created.body.data.room.id}`,
    adminJson(cookie, "PATCH", { hotel_id: "muller-fioreze", status: "inactive" }),
  );
  const publicAfter = await json("/api/v1/public/hotels/muller-fioreze/room-service/rooms");

  assert.equal(created.response.status, 201);
  assert.equal(hidden.response.status, 200);
  assert.ok(publicRooms.body.data.rooms.some((room) => room.code === "D-303"));
  assert.ok(publicRooms.body.data.rooms.every((room) => room.hotel_id === "muller-fioreze"));
  assert.ok(publicAfter.body.data.rooms.every((room) => room.code !== "D-303"));
});

test("editor cria categoria e item com imagem R2 da mesma unidade", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  const upload = await uploadCatalogImage(json, cookie);
  const category = await json(
    "/api/v1/admin/room-service/catalog/categories",
    adminJson(cookie, "POST", { hotel_id: "muller-fioreze", name: "Pratos demo", sort_order: 70 }),
  );
  const item = await json(
    "/api/v1/admin/room-service/catalog/items",
    adminJson(cookie, "POST", {
      hotel_id: "muller-fioreze",
      category_id: category.body.data.category.id,
      name: "Prato ficticio com imagem",
      description: "Somente para teste local.",
      tag: "Recomendado",
      price_cents: 4200,
      currency: "BRL",
      status: "active",
      sort_order: 10,
      is_available: true,
      media_asset_id: upload.body.data.asset.id,
    }),
  );
  const updated = await json(
    `/api/v1/admin/room-service/catalog/items/${item.body.data.item.id}`,
    adminJson(cookie, "PATCH", {
      hotel_id: "muller-fioreze",
      tag: "Escolha da casa",
    }),
  );
  const publicCatalog = await json("/api/v1/public/hotels/muller-fioreze/room-service/products");
  const saved = publicCatalog.body.data.categories.flatMap((entry) => entry.items).find((entry) => entry.id === item.body.data.item.id);

  assert.equal(upload.response.status, 201);
  assert.equal(category.response.status, 201);
  assert.equal(item.response.status, 201);
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.item.tag, "Escolha da casa");
  assert.equal(saved.media_asset_id, upload.body.data.asset.id);
  assert.equal(saved.image_url, `/media/${upload.body.data.asset.id}`);
  assert.equal(saved.price_cents, 4200);
  assert.equal(saved.tag, "Escolha da casa");
  assert.equal(env.MEDIA_BUCKET.objects.size, 1);
  assert.ok(env.__data.adminAuditLog.some((entry) => entry.action === "room-service.catalog_item.created"));
});

test("editor rejeita imagem de outro hotel", async () => {
  const { env, json } = createWorkerTestContext();
  env.__data.mediaAssets.push({
    id: "media-aurora-private",
    hotel_id: "aurora-demo",
    module_key: "room-service",
    storage_provider: "r2",
    object_key: "hotels/aurora-demo/room-service/2026/07/media.png",
    public_url: "/media/media-aurora-private",
    alt_text: "Demo",
    mime_type: "image/png",
    status: "active",
    created_at: "2026-07-12T12:00:00.000Z",
    updated_at: "2026-07-12T12:00:00.000Z",
    archived_at: null,
  });
  const cookie = await createSessionCookie(env);
  const result = await json(
    "/api/v1/admin/room-service/catalog/items",
    adminJson(cookie, "POST", {
      hotel_id: "muller-fioreze",
      category_id: "catg-muller-lanches",
      name: "Item isolado",
      price_cents: 1000,
      media_asset_id: "media-aurora-private",
    }),
  );

  assert.equal(result.response.status, 400);
  assert.equal(env.__data.catalogItems.some((entry) => entry.name === "Item isolado"), false);
});

test("editor exclui item do cardapio e preserva o snapshot do pedido", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  env.__data.orderItems.push({
    id: "order-item-history-demo",
    order_id: "order-history-demo",
    hotel_id: "muller-fioreze",
    module_key: "room-service",
    catalog_item_id: "muller-sandwich",
    item_name: "Sanduiche Demo",
    quantity: 2,
    unit_price_cents: 2500,
    line_total_cents: 5000,
  });

  const removed = await json(
    "/api/v1/admin/room-service/catalog/items/muller-sandwich",
    adminJson(cookie, "DELETE", { hotel_id: "muller-fioreze" }),
  );
  const historicalItem = env.__data.orderItems.find((entry) => entry.id === "order-item-history-demo");

  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.data.deleted, true);
  assert.equal(env.__data.catalogItems.some((entry) => entry.id === "muller-sandwich"), false);
  assert.equal(env.__data.availability.some((entry) => entry.catalog_item_id === "muller-sandwich"), false);
  assert.equal(historicalItem.catalog_item_id, null);
  assert.equal(historicalItem.item_name, "Sanduiche Demo");
  assert.equal(historicalItem.line_total_cents, 5000);
  assert.ok(env.__data.adminAuditLog.some((entry) => entry.action === "room-service.catalog_item.deleted"));
});

test("usuario operacional troca avatar e senha com minimo de quatro caracteres", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createErpSessionCookie(env);
  const secondCookie = await createErpSessionCookie(env);
  const avatar = new FormData();
  avatar.set("file", imageFile());
  const uploaded = await json(
    "/api/v1/admin/room-service/me/avatar",
    withCookie(cookie, { method: "POST", headers: mutationHeaders(), body: avatar }),
  );
  const changed = await json(
    "/api/v1/admin/room-service/me/password",
    adminJson(cookie, "POST", { current_password: "DemoAdmin!2026", new_password: "1234" }),
  );
  const session = await json("/api/v1/admin/room-service/session", withCookie(cookie));
  const removed = await json(
    "/api/v1/admin/room-service/me/avatar",
    withCookie(cookie, { method: "DELETE", headers: mutationHeaders() }),
  );

  assert.equal(uploaded.response.status, 200);
  assert.match(session.body.data.user.avatar, /^\/media\/media_/);
  assert.equal(changed.response.status, 200);
  assert.equal(changed.body.data.password_changed, true);
  assert.equal(removed.body.data.avatar_removed, true);
  assert.equal(env.__data.erpSessions.filter((entry) => entry.revoked_at).length, 1);
  assert.ok(env.__data.erpSessions.some((entry) => entry.token_hash && entry.revoked_at == null));
  assert.ok(secondCookie.includes("fioreze_erp_session="));
});

test("cadastro administrativo aceita quatro caracteres e rejeita tres", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  const accepted = await json(
    "/api/v1/admin/room-service/users",
    adminJson(cookie, "POST", {
      hotel_id: "muller-fioreze",
      display_name: "Operador quatro",
      password: "4321",
      permission_keys: ["room-service.dashboard.read"],
    }),
  );
  const rejected = await json(
    "/api/v1/admin/room-service/users",
    adminJson(cookie, "POST", {
      hotel_id: "muller-fioreze",
      display_name: "Operador tres",
      password: "321",
      permission_keys: ["room-service.dashboard.read"],
    }),
  );

  assert.equal(accepted.response.status, 201);
  assert.equal(rejected.response.status, 400);
  assert.equal(env.__data.erpUsers.some((entry) => entry.display_name === "Operador tres"), false);
});

test("acabamento visual preserva dashboard legado e ativa recursos operacionais", () => {
  const script = fs.readFileSync(`${APP_ROOT}/public/js/modules/room-service-erp/legacy-app.js`, "utf8");
  const css = fs.readFileSync(`${APP_ROOT}/public/css/modules/room-service-erp/operations.css`, "utf8");
  const polishCss = fs.readFileSync(`${APP_ROOT}/public/css/modules/room-service-erp/production-polish.css`, "utf8");
  const html = fs.readFileSync(`${APP_ROOT}/public/erp/room-service/index.html`, "utf8");
  const profilesMigration = fs.readFileSync(`${APP_ROOT}/migrations/0015_erp_operations_catalog_profiles.sql`, "utf8");
  const tagsMigration = fs.readFileSync(`${APP_ROOT}/migrations/0016_catalog_item_tags.sql`, "utf8");

  assert.match(script, /function renderDashboard\(\)/);
  assert.match(script, /dashTopItemsList/);
  assert.match(script, /renderTopSearchResults/);
  assert.match(script, /applyInterfaceScale/);
  assert.match(script, /playNotificationSound/);
  assert.match(script, /data-schedule-layout-option="same"/);
  assert.match(script, /catalogItemTag/);
  assert.match(script, /exportBillingCsv/);
  assert.match(script, /installStoreQuickPanel/);
  assert.match(script, /function installPdvInterface\(\)/);
  assert.doesNotMatch(script, /classList\.add\("pdv-collapsed"\)/);
  assert.match(script, /renderCatalogImagePicker/);
  assert.match(script, /deleteCatalogItemButton/);
  assert.match(script, /data-delete-printer-device/);
  assert.match(script, /can_create_enrollment/);
  assert.match(script, /renderOperationSettings/);
  assert.match(script, /renderRoomSettings/);
  assert.match(script, /byId\("dashDate", false\)\?\.addEventListener/);
  assert.match(script, /notif-badge.*classList\.toggle\("hidden"/s);
  assert.match(css, /\.notif-badge\.hidden/);
  assert.match(css, /\.erp-settings-grid/);
  assert.doesNotMatch(polishCss, /#appShell\s*\{[^}]*transform: scale/s);
  assert.match(script, /shell\.style\.setProperty\("width", viewport\.width, "important"\)/);
  assert.match(script, /shell\.style\.setProperty\("height", viewport\.height, "important"\)/);
  assert.match(polishCss, /\.sidebar-collapsed \.side-nav-btn/);
  assert.match(polishCss, /\.erp-store-quick/);
  assert.match(polishCss, /\.erp-pdv-thumb/);
  assert.match(html, /production-polish\.css/);
  assert.match(profilesMigration, /media_asset_id TEXT REFERENCES media_assets\(id\)/);
  assert.match(profilesMigration, /avatar_media_asset_id TEXT REFERENCES media_assets\(id\)/);
  assert.match(tagsMigration, /ALTER TABLE catalog_items ADD COLUMN tag TEXT/);
});

function adminJson(cookie, method, body) {
  return withCookie(cookie, {
    method,
    headers: {
      "content-type": "application/json",
      ...mutationHeaders(),
    },
    body: JSON.stringify(body),
  });
}

function mutationHeaders() {
  return {
    "x-fioreze-admin-action": "erp-admin",
    origin: ADMIN_ORIGIN,
    "x-fioreze-test-now": "2026-07-12T12:00:00.000Z",
  };
}

function publicOrder(key) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": key,
      "x-fioreze-test-now": "2026-07-12T12:00:00.000Z",
    },
    body: JSON.stringify({
      guest_name: "Hospede ficticio",
      room_code: "D-101",
      notes: "Pedido local de teste.",
      items: [{ catalog_item_id: "muller-sandwich", quantity: 1, unit_price_cents: 2500 }],
    }),
  };
}

function uploadCatalogImage(json, cookie) {
  const form = new FormData();
  form.set("hotel_id", "muller-fioreze");
  form.set("alt_text", "Prato ficticio");
  form.set("file", imageFile());
  return json(
    "/api/v1/admin/room-service/media",
    withCookie(cookie, { method: "POST", headers: mutationHeaders(), body: form }),
  );
}

function imageFile() {
  return new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])],
    "prato-demo.png",
    { type: "image/png" },
  );
}
