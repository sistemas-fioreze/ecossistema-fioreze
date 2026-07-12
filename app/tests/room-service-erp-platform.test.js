import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_ORIGIN, AURORA_USER_ID, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

test("ERP Room Service entrega contexto multi-hotel sem expor outro hotel", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const { response, body } = await json("/api/v1/admin/room-service/context?hotel_id=muller-fioreze", withCookie(cookie));

  assert.equal(response.status, 200);
  assert.equal(body.data.selected_hotel_id, "muller-fioreze");
  assert.equal(body.data.module_key, "room-service");
  assert.equal(body.data.hotel.hotel_id, "muller-fioreze");
  assert.equal(body.data.printing.enabled, false);
  assert.ok(body.data.rooms.every((room) => room.hotel_id === "muller-fioreze"));
  assert.equal(body.data.permissions.can_read_orders, true);
});

test("ERP Room Service bloqueia contexto de unidade nao autorizada", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const { response, body } = await json("/api/v1/admin/room-service/context?hotel_id=aurora-demo", withCookie(cookie));

  assert.equal(response.status, 401);
  assert.match(body.error.message, /hotel solicitado/i);
});

test("ERP Room Service lista catalogo e hospedes somente da unidade autorizada", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const catalog = await json("/api/v1/admin/room-service/catalog?hotel_id=muller-fioreze", withCookie(cookie));
  const guests = await json("/api/v1/admin/room-service/guests?hotel_id=muller-fioreze", withCookie(cookie));

  assert.equal(catalog.response.status, 200);
  assert.equal(guests.response.status, 200);
  assert.equal(catalog.body.data.categories.length, 2);
  assert.ok(catalog.body.data.categories.every((category) => category.items.every((item) => !item.id.includes("aurora"))));
  assert.deepEqual(guests.body.data.guests, []);
  assert.ok(guests.body.data.rooms.every((room) => room.hotel_id === "muller-fioreze"));
});

test("ERP Room Service dashboard e faturamento usam pedidos do hotel autorizado", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  env.__data.orders.push(
    order("order-muller-1", "muller-fioreze", "received", 2500),
    order("order-muller-2", "muller-fioreze", "delivered", 900),
    order("order-aurora-1", "aurora-demo", "delivered", 1900),
  );

  const dashboard = await json("/api/v1/admin/room-service/dashboard?hotel_id=muller-fioreze", withCookie(cookie));
  const billing = await json("/api/v1/admin/room-service/billing?hotel_id=muller-fioreze", withCookie(cookie));

  assert.equal(dashboard.response.status, 200);
  assert.equal(billing.response.status, 200);
  assert.equal(dashboard.body.data.summary.total_orders, 2);
  assert.equal(dashboard.body.data.summary.active_orders, 1);
  assert.equal(dashboard.body.data.summary.revenue_cents, 900);
  assert.equal(billing.body.data.summary.completed_orders, 1);
  assert.equal(billing.body.data.summary.revenue_cents, 900);
});

test("ERP Room Service cria pedido PDV com origem administrativa sem print_event", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const created = await json(
    "/api/v1/admin/room-service/orders",
    withCookie(
      cookie,
      adminJson("POST", {
        hotel_id: "muller-fioreze",
        guest_name: "Hospede Demo",
        room_code: "D-101",
        notes: "Pedido manual de teste.",
        items: [{ catalog_item_id: "muller-sandwich", quantity: 1, unit_price_cents: 2500 }],
      }),
    ),
  );

  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.origin, undefined);
  const order = env.__data.orders.find((entry) => entry.id === created.body.data.id);
  assert.equal(order.origin, "admin_pdv");
  assert.equal(order.hotel_id, "muller-fioreze");
  assert.equal(env.__data.printEvents.length, 0);
});

test("ERP Room Service preserva isolamento para usuario de outro hotel", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env, AURORA_USER_ID);

  const allowed = await json("/api/v1/admin/room-service/context?hotel_id=aurora-demo", withCookie(cookie));
  const denied = await json("/api/v1/admin/room-service/orders?hotel_id=muller-fioreze", withCookie(cookie));

  assert.equal(allowed.response.status, 200);
  assert.equal(allowed.body.data.selected_hotel_id, "aurora-demo");
  assert.equal(denied.response.status, 401);
});

function order(id, hotelId, status, totalCents) {
  return {
    id,
    public_id: id.replace("order-", "RS-"),
    hotel_id: hotelId,
    module_key: "room-service",
    origin: "public-web",
    room_id: null,
    room_code: hotelId === "muller-fioreze" ? "D-101" : "A-201",
    guest_name: "Hospede Demo",
    notes: "",
    currency: "BRL",
    subtotal_cents: totalCents,
    discount_cents: 0,
    total_cents: totalCents,
    status,
    idempotency_key: null,
    created_at: "2026-07-12T12:00:00.000Z",
    updated_at: "2026-07-12T12:00:00.000Z",
    cancelled_at: null,
    archived_at: null,
  };
}

function adminJson(method, body) {
  return {
    method,
    headers: {
      "content-type": "application/json",
      "x-fioreze-admin-action": "erp-admin",
      "idempotency-key": `erp-test-${crypto.randomUUID()}`,
      origin: ADMIN_ORIGIN,
      "x-fioreze-test-now": "2026-07-05T20:00:00.000Z",
    },
    body: JSON.stringify(body),
  };
}
