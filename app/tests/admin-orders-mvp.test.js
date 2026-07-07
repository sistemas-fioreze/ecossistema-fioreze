import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext, jsonPost } from "./helpers/worker.js";

const ADMIN_EMAIL = "admin-demo@example.invalid";
const ADMIN_PASSWORD = "DemoAdmin!2026";
const ADMIN_ORIGIN = "https://local.test";

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

test("relogio deterministico funciona somente em ambiente test", async () => {
  const { json, env } = createWorkerTestContext();
  const login = await loginAdmin(json, ADMIN_EMAIL, ADMIN_PASSWORD, {
    "x-fioreze-test-now": "2026-07-05T21:30:00.000Z",
  });

  assert.equal(login.response.status, 200);
  assert.equal(env.__data.adminSessions[0].created_at, "2026-07-05T21:30:00.000Z");
  assert.equal(env.__data.adminSessions[0].expires_at, "2026-07-06T05:30:00.000Z");
});

test("development ignora x-fioreze-test-now futuro no login administrativo", async () => {
  const { json, env } = createWorkerTestContext({ ENVIRONMENT: "development" });
  const before = Date.now();
  const login = await loginAdmin(json, ADMIN_EMAIL, ADMIN_PASSWORD, {
    "x-fioreze-test-now": "2099-01-01T00:00:00.000Z",
  });
  const after = Date.now();
  const session = env.__data.adminSessions[0];
  const createdAt = Date.parse(session.created_at);
  const expiresAt = Date.parse(session.expires_at);

  assert.equal(login.response.status, 200);
  assert.ok(createdAt >= before - 1000);
  assert.ok(createdAt <= after + 1000);
  assert.ok(expiresAt >= before + 8 * 60 * 60 * 1000 - 1000);
  assert.ok(expiresAt <= after + 8 * 60 * 60 * 1000 + 1000);
  assert.notEqual(session.created_at, "2099-01-01T00:00:00.000Z");
});

test("login administrativo invalido retorna 401 sem criar sessao", async () => {
  const { json, env } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/admin/login", adminPost({ email: ADMIN_EMAIL, password: "senha-incorreta" }));

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
  assert.equal(env.__data.adminSessions.length, 0);
});

test("force_password_change bloqueia login sem criar sessao", async () => {
  const { json, env } = createWorkerTestContext();
  env.__data.adminUsers[0].force_password_change = 1;

  const { response, body } = await loginAdmin(json);

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "forbidden");
  assert.match(body.error.message, /senha/i);
  assert.doesNotMatch(body.error.message, /hash|salt|pbkdf/i);
  assert.equal(env.__data.adminSessions.length, 0);
});

test("password_strategy incompativel nao autentica nem revela detalhes", async () => {
  const { json, env } = createWorkerTestContext();
  env.__data.adminUsers[0].password_strategy = "legacy";

  const { response, body } = await loginAdmin(json);

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
  assert.doesNotMatch(body.error.message, /hash|salt|pbkdf|legacy/i);
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

test("sessao expirada em development nao e reativada por x-fioreze-test-now", async () => {
  const { json, env } = createWorkerTestContext({ ENVIRONMENT: "development" });
  const cookie = cookieFrom((await loginAdmin(json)).response);
  env.__data.adminSessions[0].expires_at = new Date(Date.now() - 1000).toISOString();

  const { response, body } = await json(
    "/api/v1/admin/session",
    withCookie(cookie, { headers: { "x-fioreze-test-now": "2026-01-01T00:00:00.000Z" } }),
  );

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

test("logout autenticado exige header administrativo customizado", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = cookieFrom((await loginAdmin(json)).response);
  const logout = await json("/api/v1/admin/logout", withCookie(cookie, adminPostUnprotected({})));

  assert.equal(logout.response.status, 403);
  assert.equal(logout.body.error.code, "forbidden");
  assert.equal(env.__data.adminSessions[0].revoked_at, null);
});

test("logout autenticado rejeita origin diferente", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = cookieFrom((await loginAdmin(json)).response);
  const logout = await json("/api/v1/admin/logout", withCookie(cookie, adminPost({}, { origin: "https://admin.evil.invalid" })));

  assert.equal(logout.response.status, 403);
  assert.equal(logout.body.error.code, "forbidden");
  assert.equal(env.__data.adminSessions[0].revoked_at, null);
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

test("parser de entrega aceita formato real com ponto e virgula", async () => {
  const { json } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", {
    ...MULLER_ORDER,
    notes: "Local de entrega: Acomodacao; Contato: [TELEFONE]; teste de integracao",
  });
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const { response, body } = await json(`/api/v1/admin/orders/${created.body.data.id}`, withCookie(cookie));

  assert.equal(response.status, 200);
  assert.equal(body.data.order.notes, "Local de entrega: Acomodacao; Contato: [TELEFONE]; teste de integracao");
  assert.equal(body.data.order.delivery.location, "Acomodacao");
  assert.equal(body.data.order.delivery.room_code, "D-101");
  assert.equal(body.data.order.delivery.contact, "[TELEFONE]");
  assert.equal(body.data.order.delivery.observation, "teste de integracao");
});

test("parser de entrega aceita formato multilinha e campos ausentes", async () => {
  const { json } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", {
    ...MULLER_ORDER,
    notes: "Local de entrega: Acomodacao\nContato: [TELEFONE]\nObservacao livre",
  });
  const createdWithoutContact = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", {
    ...MULLER_ORDER,
    room_code: "D-102",
    notes: "Somente observacao livre",
  });
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const multiline = await json(`/api/v1/admin/orders/${created.body.data.id}`, withCookie(cookie));
  const missingFields = await json(`/api/v1/admin/orders/${createdWithoutContact.body.data.id}`, withCookie(cookie));

  assert.equal(multiline.body.data.order.delivery.location, "Acomodacao");
  assert.equal(multiline.body.data.order.delivery.contact, "[TELEFONE]");
  assert.equal(multiline.body.data.order.delivery.observation, "Observacao livre");
  assert.equal(missingFields.body.data.order.delivery.location, "");
  assert.equal(missingFields.body.data.order.delivery.contact, "");
  assert.equal(missingFields.body.data.order.delivery.room_code, "D-102");
  assert.equal(missingFields.body.data.order.delivery.observation, "Somente observacao livre");
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

test("ambiente test ainda usa x-fioreze-test-now no historico de status", async () => {
  const { json, env } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const changed = await changeStatus(json, cookie, created.body.data.id, "preparing");
  const preparingHistory = env.__data.orderStatusHistory.find(
    (entry) => entry.order_id === created.body.data.id && entry.status === "preparing",
  );

  assert.equal(changed.response.status, 200);
  assert.equal(preparingHistory.created_at, "2026-07-05T21:00:00.000Z");
});

test("development ignora x-fioreze-test-now futuro no historico de status", async () => {
  const { json, env } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  env.ENVIRONMENT = "development";
  const cookie = cookieFrom((await loginAdmin(json)).response);
  const before = Date.now();

  const changed = await changeStatus(json, cookie, created.body.data.id, "preparing", "", {
    "x-fioreze-test-now": "2099-01-01T00:00:00.000Z",
  });
  const after = Date.now();
  const preparingHistory = env.__data.orderStatusHistory.find(
    (entry) => entry.order_id === created.body.data.id && entry.status === "preparing",
  );
  const createdAt = Date.parse(preparingHistory.created_at);

  assert.equal(changed.response.status, 200);
  assert.ok(createdAt >= before - 1000);
  assert.ok(createdAt <= after + 1000);
  assert.notEqual(preparingHistory.created_at, "2099-01-01T00:00:00.000Z");
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

test("mudanca de status concorrente registra uma unica transicao", async () => {
  const { json, env } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);
  env.DB.adminStatusBatchDelayMs = 10;

  const results = await Promise.all([
    changeStatus(json, cookie, created.body.data.id, "preparing"),
    changeStatus(json, cookie, created.body.data.id, "preparing"),
  ]);

  assert.deepEqual(
    results.map((result) => result.response.status).sort(),
    [200, 200],
  );
  assert.deepEqual(
    results.map((result) => result.body.data.idempotent).sort(),
    [false, true],
  );
  assert.equal(env.__data.orders.find((order) => order.id === created.body.data.id).status, "preparing");
  assert.equal(
    env.__data.orderStatusHistory.filter((entry) => entry.order_id === created.body.data.id && entry.status === "preparing").length,
    1,
  );
  assert.equal(env.__data.orderStatusHistory.filter((entry) => entry.order_id === created.body.data.id).length, 2);
  assert.equal(env.__data.adminAuditLog.length, 1);
  assert.equal(env.__data.printEvents.length, 0);
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

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "not_found");
});

test("usuario sem acesso nao altera status de outro hotel", async () => {
  const { json } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/aurora-demo/room-service/orders", AURORA_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const { response, body } = await changeStatus(json, cookie, created.body.data.id, "preparing");

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "not_found");
});

test("mudanca de status autenticada exige header administrativo customizado", async () => {
  const { json, env } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const { response, body } = await json(
    `/api/v1/admin/orders/${created.body.data.id}/status`,
    withCookie(cookie, adminPostUnprotected({ status: "preparing" })),
  );

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "forbidden");
  assert.equal(env.__data.orderStatusHistory.length, 1);
  assert.equal(env.__data.adminAuditLog.length, 0);
});

test("mudanca de status autenticada rejeita origin diferente", async () => {
  const { json, env } = createWorkerTestContext();
  const created = await createOrder(json, "/api/v1/public/hotels/muller-fioreze/room-service/orders", MULLER_ORDER);
  const cookie = cookieFrom((await loginAdmin(json)).response);

  const { response, body } = await changeStatus(json, cookie, created.body.data.id, "preparing", "", {
    origin: "https://admin.evil.invalid",
  });

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "forbidden");
  assert.equal(env.__data.orderStatusHistory.length, 1);
  assert.equal(env.__data.adminAuditLog.length, 0);
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

async function loginAdmin(json, email = ADMIN_EMAIL, password = ADMIN_PASSWORD, headers = {}) {
  return json("/api/v1/admin/login", adminPost({ email, password }, headers));
}

async function createOrder(json, path, payload) {
  return json(path, jsonPost(payload));
}

function changeStatus(json, cookie, orderId, status, note = "", headers = {}) {
  return json(
    `/api/v1/admin/orders/${orderId}/status`,
    withCookie(
      cookie,
      adminPost({ status, note }, { "x-fioreze-test-now": "2026-07-05T21:00:00.000Z", ...headers }),
    ),
  );
}

function adminPost(body, headers = {}) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ADMIN_ORIGIN,
      "x-fioreze-admin-action": "erp-admin",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function adminPostUnprotected(body, headers = {}) {
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
