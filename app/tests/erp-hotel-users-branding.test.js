import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { ADMIN_ORIGIN, createErpSessionCookie, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const DEMO_PASSWORD = "DemoAdmin!2026";

test("contexto de login do ERP publica branding por unidade sem credenciais", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/admin/room-service/login-context");

  assert.equal(response.status, 200);
  assert.equal(body.data.hotels.length, 2);
  const muller = body.data.hotels.find((hotel) => hotel.hotel_id === "muller-fioreze");
  assert.equal(muller.branding.horizontal_logo_url, "/assets/hotels/muller-fioreze/logo.png");
  assert.equal(muller.branding.icon_url, "/assets/hotels/muller-fioreze/logo-ff.png");
  assert.equal(muller.branding.primary_color, "#17594a");
  assert.equal(muller.branding.font_family, "system-ui");
  assert.equal(JSON.stringify(body).includes("password"), false);
});

test("ERP nao expoe unidade ativa sem responsavel na Central Administrativa", async () => {
  const { env, json } = createWorkerTestContext();
  env.__data.adminHotelAccess = env.__data.adminHotelAccess.filter((entry) => entry.hotel_id !== "aurora-demo");

  const loginContext = await json("/api/v1/admin/room-service/login-context");
  const masterCookie = await createSessionCookie(env);
  const masterSession = await json("/api/v1/admin/room-service/session", withCookie(masterCookie));
  const orphanLogin = await json("/api/v1/admin/room-service/login", jsonRequest("POST", {
    hotel_id: "aurora-demo",
    user_code: 1,
    password: DEMO_PASSWORD,
  }));

  assert.equal(loginContext.response.status, 200);
  assert.deepEqual(loginContext.body.data.hotels.map((hotel) => hotel.hotel_id), ["muller-fioreze"]);
  assert.equal(masterSession.response.status, 200);
  assert.deepEqual(masterSession.body.data.hotels.map((hotel) => hotel.hotel_id), ["muller-fioreze"]);
  assert.equal(orphanLogin.response.status, 401);
});

test("usuario operacional entra com codigo numerico e recebe sessao exclusiva do hotel", async () => {
  const { env, json } = createWorkerTestContext();
  const login = await json("/api/v1/admin/room-service/login", jsonRequest("POST", {
    hotel_id: "muller-fioreze",
    user_code: 1,
    password: DEMO_PASSWORD,
  }));

  assert.equal(login.response.status, 200);
  assert.match(login.response.headers.get("set-cookie"), /fioreze_erp_session=.*HttpOnly.*SameSite=Lax/i);
  assert.equal(login.body.data.auth_source, "erp");
  assert.equal(login.body.data.erp_master, false);
  assert.deepEqual(login.body.data.hotels.map((hotel) => hotel.hotel_id), ["muller-fioreze"]);
  assert.equal(env.__data.erpSessions.length, 1);
  assert.equal(env.__data.adminSessions.length, 0);
});

test("sessao operacional nao acessa outro hotel nem ganha modulos nao concedidos", async () => {
  const { env, json } = createWorkerTestContext();
  env.__data.erpUserPermissions = env.__data.erpUserPermissions.filter((entry) => entry.user_id !== "erp-user-muller-1");
  env.__data.erpUserPermissions.push({
    user_id: "erp-user-muller-1",
    hotel_id: "muller-fioreze",
    permission_key: "room-service.dashboard.read",
    created_at: "2026-07-13T00:00:00.000Z",
  });
  const cookie = await createErpSessionCookie(env);

  const dashboard = await json("/api/v1/admin/room-service/dashboard?hotel_id=muller-fioreze", withCookie(cookie));
  const catalog = await json("/api/v1/admin/room-service/catalog?hotel_id=muller-fioreze", withCookie(cookie));
  const anotherHotel = await json("/api/v1/admin/room-service/context?hotel_id=aurora-demo", withCookie(cookie));

  assert.equal(dashboard.response.status, 200);
  assert.equal(catalog.response.status, 401);
  assert.equal(anotherHotel.response.status, 401);
});

test("administrador mestre cria usuario sequencial sem misturar admin_users", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  const centralUsersBefore = env.__data.adminUsers.length;
  const created = await json(
    "/api/v1/admin/room-service/users",
    withCookie(cookie, jsonRequest("POST", {
      hotel_id: "muller-fioreze",
      display_name: "Operador Demo Dois",
      password: "SenhaOperadorDemo2026",
      permission_keys: ["room-service.dashboard.read", "room-service.orders.write"],
    }, true)),
  );

  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.user.user_code, 2);
  assert.deepEqual(created.body.data.user.permissions, [
    "room-service.dashboard.read",
    "room-service.orders.read",
    "room-service.orders.write",
  ]);
  assert.equal(env.__data.adminUsers.length, centralUsersBefore);
  const stored = env.__data.erpUsers.find((user) => user.id === created.body.data.user.id);
  assert.notEqual(stored.password_hash, "SenhaOperadorDemo2026");
  assert.match(stored.password_hash, /^pbkdf2\$sha256\$100000\$/);
  assert.equal(JSON.stringify(created.body).includes("password_hash"), false);
});

test("gestao de usuario atualiza modulos e redefine senha revogando sessoes", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  await createErpSessionCookie(env);

  const updated = await json(
    "/api/v1/admin/room-service/users/erp-user-muller-1",
    withCookie(cookie, jsonRequest("PATCH", {
      hotel_id: "muller-fioreze",
      display_name: "Atendente Atualizado",
      status: "active",
      permission_keys: ["room-service.dashboard.read", "room-service.billing.read"],
    }, true)),
  );
  const reset = await json(
    "/api/v1/admin/room-service/users/erp-user-muller-1/password",
    withCookie(cookie, jsonRequest("POST", {
      hotel_id: "muller-fioreze",
      password: "NovaSenhaOperador2026",
    }, true)),
  );

  assert.equal(updated.response.status, 200);
  assert.deepEqual(updated.body.data.user.permissions, ["room-service.billing.read", "room-service.dashboard.read"]);
  assert.equal(reset.response.status, 200);
  assert.equal(reset.body.data.sessions_revoked, true);
  assert.ok(env.__data.erpSessions.every((session) => session.revoked_at));
  assert.ok(env.__data.adminAuditLog.some((entry) => entry.action === "room-service.erp_user.updated"));
  assert.ok(env.__data.adminAuditLog.some((entry) => entry.action === "room-service.erp_user.password_reset"));
});

test("usuario operacional sem permissao de gestao nao lista equipe", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createErpSessionCookie(env);
  const result = await json("/api/v1/admin/room-service/users?hotel_id=muller-fioreze", withCookie(cookie));
  assert.equal(result.response.status, 401);
});

test("usuario da Central sem erp.master nao entra no ERP", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env, "user-aurora-admin");
  const result = await json("/api/v1/admin/room-service/session", withCookie(cookie));

  assert.equal(result.response.status, 401);
  assert.match(result.body.error.message, /usuarios operacionais da unidade/i);
});

test("mudanca de status feita no ERP registra o usuario operacional sem imprimir", async () => {
  const { env, json } = createWorkerTestContext();
  env.__data.orders.push({
    id: "order-erp-actor-demo",
    public_id: "RS-ERP-ACTOR-DEMO",
    hotel_id: "muller-fioreze",
    module_key: "room-service",
    origin: "public-web",
    room_id: null,
    room_code: "D-101",
    guest_name: "Hospede Ficticio",
    notes: "Teste local ficticio.",
    currency: "BRL",
    subtotal_cents: 2500,
    discount_cents: 0,
    total_cents: 2500,
    status: "received",
    idempotency_key: null,
    created_at: "2026-07-12T10:00:00.000Z",
    updated_at: "2026-07-12T10:00:00.000Z",
    cancelled_at: null,
    archived_at: null,
  });
  const cookie = await createErpSessionCookie(env);
  const result = await json(
    "/api/v1/admin/room-service/orders/order-erp-actor-demo/status",
    withCookie(cookie, jsonRequest("POST", { status: "preparing" }, true)),
  );

  assert.equal(result.response.status, 200);
  assert.equal(env.__data.orders.find((order) => order.id === "order-erp-actor-demo").status, "preparing");
  const history = env.__data.orderStatusHistory.find(
    (entry) => entry.order_id === "order-erp-actor-demo" && entry.status === "preparing",
  );
  const audit = env.__data.adminAuditLog.find(
    (entry) => entry.entity_id === "order-erp-actor-demo" && entry.action === "room-service.order.status_changed",
  );
  assert.equal(history.actor_user_id, null);
  assert.equal(history.actor_erp_user_id, "erp-user-muller-1");
  assert.equal(audit.actor_user_id, null);
  assert.equal(audit.actor_erp_user_id, "erp-user-muller-1");
  assert.equal(env.__data.printEvents.length, 0);
});

test("migration separa usuarios ERP e registra ator operacional", () => {
  const bootstrap = fs.readFileSync("migrations/0011a_admin_module_bootstrap.sql", "utf8");
  const sql = fs.readFileSync("migrations/0014_erp_hotel_users.sql", "utf8");
  assert.match(bootstrap, /INSERT OR IGNORE INTO modules/);
  assert.match(bootstrap, /'admin'/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS erp_users/);
  assert.match(sql, /UNIQUE \(hotel_id, user_code\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS erp_user_permissions/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS erp_sessions/);
  assert.match(sql, /actor_erp_user_id/);
  assert.match(sql, /erp\.master/);
  assert.doesNotMatch(sql, /password_hash\s*VALUES/i);
});

test("frontend aplica logos, fonte, titulo e cor primaria do contexto", () => {
  const html = fs.readFileSync("public/erp/room-service/index.html", "utf8");
  const app = fs.readFileSync("public/js/modules/room-service-erp/legacy-app.js", "utf8");
  assert.match(html, /<img alt="Unidade Fioreze" class="login-logo [^"]*" hidden>/);
  assert.match(html, /<img alt="Unidade Fioreze" class="side-brand-logo" hidden>/);
  assert.match(html, /<img alt="Unidade Fioreze" class="side-brand-logo-seal" hidden>/);
  assert.match(app, /horizontal_logo_url/);
  assert.match(app, /branding\.icon_url/);
  assert.match(app, /--hotel-font/);
  assert.match(app, /--accent/);
  assert.match(app, /document\.title/);
  assert.match(app, /Codigo do usuario ou e-mail mestre/);
  assert.match(app, /localStorage\.setItem\("fioreze-rs-hotel", hotelId\)/);
  assert.match(app, /matchMedia\("\(max-width: 900px\)"\)/);
  assert.match(app, /classList\.toggle\("sidebar-open"\)/);
  assert.match(app, /classList\.toggle\("sidebar-collapsed"\)/);
  assert.match(app, /classList\.remove\("sidebar-open"\)/);
  const css = fs.readFileSync("public/css/modules/room-service-erp/legacy-adapter.css", "utf8");
  assert.match(css, /\.side-brand-logo\[hidden\]/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.app-sidebar[\s\S]*position: fixed !important/);
  assert.match(css, /\.app-main[\s\S]*width: 100% !important/);
});

function jsonRequest(method, body, protectedMutation = false) {
  return {
    method,
    headers: {
      "content-type": "application/json",
      "x-fioreze-test-now": "2026-07-12T12:00:00.000Z",
      ...(protectedMutation ? { "x-fioreze-admin-action": "erp-admin", origin: ADMIN_ORIGIN } : {}),
    },
    body: JSON.stringify(body),
  };
}
