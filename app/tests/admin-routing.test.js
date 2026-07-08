import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

test("GET /admin redireciona uma unica vez para /admin/", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/admin?origem=erp", { redirect: "manual" });
  const location = response.headers.get("location");

  assert.ok([307, 308].includes(response.status));
  assert.ok(location);

  const redirectUrl = new URL(location);
  assert.equal(redirectUrl.pathname, "/admin/");
  assert.equal(redirectUrl.search, "?origem=erp");
  assert.notEqual(redirectUrl.pathname, "/admin");
});

test("GET /admin/ entrega central de acesso administrativo", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/admin/", { redirect: "manual" });
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(text, /Ecossistema Fioreze/);
  assert.match(text, /systemsList/);
  assert.doesNotMatch(text, /ordersList/);
  assert.equal(response.headers.has("location"), false);
});

test("GET /admin/room-service/ entrega ERP operacional do Room Service", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/admin/room-service/", { redirect: "manual" });
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(text, /Pedidos Room Service/);
  assert.match(text, /ordersList/);
  assert.equal(response.headers.has("location"), false);
});

test("GET /admin/portais/ entrega a Central de Portais", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/admin/portais/", { redirect: "manual" });
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(text, /Central de Portais Fioreze/);
  assert.match(text, /portalsDenied/);
  assert.equal(response.headers.has("location"), false);
});

test("rotas administrativas sem barra final redirecionam para caminho canonico", async () => {
  const { fetch } = createWorkerTestContext();
  const roomService = await fetch("/admin/room-service?x=1", { redirect: "manual" });
  const portals = await fetch("/admin/portais?x=1", { redirect: "manual" });

  assert.equal(roomService.status, 308);
  assert.equal(new URL(roomService.headers.get("location")).pathname, "/admin/room-service/");
  assert.equal(new URL(roomService.headers.get("location")).search, "?x=1");
  assert.equal(portals.status, 308);
  assert.equal(new URL(portals.headers.get("location")).pathname, "/admin/portais/");
  assert.equal(new URL(portals.headers.get("location")).search, "?x=1");
});

test("subrotas administrativas entregam o shell correto ao atualizar pagina", async () => {
  const { fetch } = createWorkerTestContext();
  const roomService = await fetch("/admin/room-service/pedidos/abc", { redirect: "manual" });
  const portals = await fetch("/admin/portais/hoteis", { redirect: "manual" });

  assert.equal(roomService.status, 200);
  assert.match(await roomService.text(), /Pedidos Room Service/);
  assert.equal(portals.status, 200);
  assert.match(await portals.text(), /Central de Portais Fioreze/);
});

test("GET /api/v1/admin/session permanece API protegida em JSON", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/api/v1/admin/session", { redirect: "manual" });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  assert.equal(body.error.code, "unauthorized");
});

test("rota administrativa canonica nao passa de um redirect", async () => {
  const { fetch } = createWorkerTestContext();
  const first = await fetch("/admin", { redirect: "manual" });
  assert.equal(first.status, 308);

  const location = new URL(first.headers.get("location"));
  const second = await fetch(`${location.pathname}${location.search}`, { redirect: "manual" });
  const text = await second.text();

  assert.equal(second.status, 200);
  assert.equal(second.headers.has("location"), false);
  assert.match(text, /Ecossistema Fioreze/);
});

test("assets administrativos carregam fora do roteamento estatico de shells", async () => {
  const { fetch } = createWorkerTestContext();
  const assets = [
    ["/js/modules/admin/admin.js", /javascript/],
    ["/js/modules/admin/room-service.js", /javascript/],
    ["/css/modules/admin/admin.css", /text\/css/],
  ];

  for (const [path, contentType] of assets) {
    const response = await fetch(path, { redirect: "manual" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", contentType);
  }
});
