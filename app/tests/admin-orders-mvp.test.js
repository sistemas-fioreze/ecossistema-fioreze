import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext, jsonPost } from "./helpers/worker.js";

const ADMIN_EMAIL = "admin-demo@example.invalid";
const ADMIN_PASSWORD = "DemoAdmin!2026";

const MULLER_ORDER = {
  guest_name: "Hospede ERP Demo",
  room_code: "D-101",
  notes: "Local de entrega: Acomodacao\nContato: +55 54 99999-0000\nPedido ficticio do ERP.",
  items: [{ catalog_item_id: "muller-sandwich", quantity: 1 }],
};

const AURORA_ORDER = {
  guest_name: "Hospede Aurora Demo",
  room_code: "A-201",
  notes: "Pedido ficticio de outro hotel.",
  items: [{ catalog_item_id: "aurora-sandwich", quantity: 1 }],
};

test("login administrativo valido cria sessao HttpOnly", async () => {
  const { json, env } = createWorkerTestContext();
  const login = await loginAdmin(json);
  const setCookie = login.response.headers.get("set-cookie") || "";

  assert.equal(login.response.status, 200);
  assert.equal(login.body.data.user.email, ADMIN_EMAIL);
  assert.match(setCookie, /fioreze_admin_session=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.equal(env.__data.adminSessions.length, 1);
});

test("login administrativo invalido retorna 401 sem criar sessao", async () => {
  const { json, env } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/admin/login", adminPost({ email: ADMIN_EMAIL, password: "senha-incorreta" }));

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
  assert.equal(env.__data.adminSessions.length, 0);
});

test("sessao ausente bloqueia APIs administrativas", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/admin/orders");

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
});

test("sessao expirada nao autentica", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = cookieFrom((await loginAdmin(json)).response);
  env.__data.adminSessions[0].expires_at = "2026-01-01T00:00:00.000Z";

  const { response, body } = await json("/api/v1/admin/session", withCookie(cookie));

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
});

test("logout revoga sessao administrativa", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = cookieFrom((await loginAdmin(json)).response);
  const logout = await json("/api/v1/admin/logout", withCookie(cookie, adminPost({})));
  const session = await json("/api/v1/admin/session", withCookie(cookie));

  assert.equal(logout.response.status, 200);
  assert.ok(env.__data.adminSessions[0].revoked_at);
  assert.equal(session.response.status, 401);
});

test("listagem de pedidos respeita hoteis permitidos", async () => {
  const { json } = createWorkerTestContext();
  await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  await createOrder(json, "/api/v1/public/hotels/aurora-demo/room-service/orders", AURORA_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const { response, body } = await json("/api/v1/admin/orders", withCookie(cookie));

  assert.equal(response.status, 200);
  assert.equal(body.data.orders.length, 1);
  assert.equal(body.data.orders[0].hotel_id, "muller-fioreze");
});

test("bloqueia filtro administrativo para outro hotel", async () => {
  const { json } = createWorkerTestContext();
  const cookie = cookieFrom((await loginAdmin(json)).response);
  const { response, body } = await json("/api/v1/admin/orders?hotel_id=aurora-demo", withCookie(cookie));

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
});

test("detalhes do pedido exibem itens, historico e impressao desativada", async () => {
  const { json } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const { response, body } = await json(`/api/v1/admin/orders/${created.body.data.id}`, withCookie(cookie));

  assert.equal(response.status, 200);
  assert.equal(body.data.order.public_id, created.body.data.public_id);
  assert.equal(body.data.order.items.length, 1);
  assert.equal(body.data.order.history.length, 1);
  assert.equal(body.data.order.printing.enabled, false);
  assert.equal(body.data.order.printing.event_count, 0);
});

test("pedido inexistente retorna 404", async () => {
  const { json } = createWorkerTestContext();
  const cookie = cookieFrom((await loginAdmin(json)).response);
  const { response, body } = await json("/api/v1/admin/orders/order-inexistente", withCookie(cookie));

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "not_found");
});

test("transicoes validas chegam a completed sem acionar impressao", async () => {
  const { json, env } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const preparing = await changeStatus(json, cookie, created.body.data.id, "preparing");
  const ready = await changeStatus(json, cookie, created.body.data.id, "ready");
  const completed = await changeStatus(json, cookie, created.body.data.id, "completed");

  assert.equal(preparing.body.data.order.status, "preparing");
  assert.equal(ready.body.data.order.status, "ready");
  assert.equal(completed.body.data.order.status, "completed");
  assert.equal(env.__data.orders[0].status, "delivered");
  assert.equal(env.__data.printEvents.length, 0);
});

test("transicao invalida retorna erro claro", async () => {
  const { json } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const { response, body } = await changeStatus(json, cookie, created.body.data.id, "ready");

  assert.equal(response.status, 409);
  assert.equal(body.error.code, "conflict");
});

test("cancelamento sem motivo e bloqueado", async () => {
  const { json } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const { response, body } = await changeStatus(json, cookie, created.body.data.id, "cancelled");

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "bad_request");
});

test("mudanca de status idempotente nao duplica historico", async () => {
  const { json, env } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const first = await changeStatus(json, cookie, created.body.data.id, "preparing");
  const second = await changeStatus(json, cookie, created.body.data.id, "preparing");

  assert.equal(first.body.data.idempotent, false);
  assert.equal(second.body.data.idempotent, true);
  assert.equal(env.__data.orderStatusHistory.length, 2);
});

test("mudanca de status registra auditoria administrativa", async () => {
  const { json, env } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  await changeStatus(json, cookie, created.body.data.id, "preparing");

  assert.equal(env.__data.adminAuditLog.length, 1);
  assert.equal(env.__data.adminAuditLog[0].action, "room-service.order.status_changed");
  assert.equal(env.__data.adminAuditLog[0].actor_user_id, "user-demo-admin");
});

test("usuario sem acesso nao abre detalhes de outro hotel", async () => {
  const { json } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/aurora-demo/room-service/orders", AURORA_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const { response, body } = await json(`/api/v1/admin/orders/${created.body.data.id}`, withCookie(cookie));

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
});

test("rotas /admin e subrotas continuam entregando shell sem loop", async () => {
  const { fetch } = createWorkerTestContext();
  const redirect = await fetch("/admin", { redirect: "manual" });
  const admin = await fetch("/admin/", { redirect: "manual" });
  const nested = await fetch("/admin/pedidos/abc", { redirect: "manual" });

  assert.equal(redirect.status, 308);
  assert.equal(new URL(redirect.headers.get("location")).pathname, "/admin/");
  assert.equal(admin.status, 200);
  assert.equal(nested.status, 200);
  assert.equal(admin.headers.has("location"), false);
  assert.equal(nested.headers.has("location"), false);
});

test("interface administrativa carrega login e area de pedidos", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/admin/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /ERP Fioreze/);
  assert.match(html, /loginForm/);
  assert.match(html, /ordersList/);
});

async function loginAdmin(json, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  return json("/api/v1/admin/login", adminPost({ email, password }));
}

async function createOrder(json, path, payload) {
  return json(path, jsonPost(payload));
}

function changeStatus(json, cookie, orderId, status, note = "") {
  return json(
    `/api/v1/admin/orders/${orderId}/status`,
    withCookie(cookie, adminPost({ status, note }, { "x-fioreze-test-now": "2026-07-05T21:00:00.000Z" })),
  );
}

function adminPost(body, headers = {}) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function withCookie(cookie, init = {}) {
  return {
    ...init,
    headers: {
      ...(init.headers || {}),
      cookie,
    },
  };
}

function cookieFrom(response) {
  return (response.headers.get("set-cookie") || "").split(";")[0];
}
