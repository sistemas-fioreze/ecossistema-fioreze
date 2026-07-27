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

test("GET /admin/room-service/ redireciona para a rota oficial do ERP", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/admin/room-service/", { redirect: "manual" });

  assert.equal(response.status, 308);
  assert.equal(new URL(response.headers.get("location")).pathname, "/erp/room-service/");
});

test("GET /erp/room-service/ entrega o ERP Room Service oficial", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/erp/room-service/", { redirect: "manual" });
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(text, /ERP Room Service Fioreze/);
  assert.match(text, /routeOutlet/);
  assert.match(text, /js\/modules\/room-service-erp\/app\.js/);
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

test("rotas do criador descontinuado redirecionam ao editor do Portal do Hospede", async () => {
  const { fetch } = createWorkerTestContext();
  const redirect = await fetch("/admin/creator?portal=portal_demo&page=inicio", { redirect: "manual" });
  const oldContents = await fetch("/admin/portais/conteudos/portal_demo", { redirect: "manual" });
  const shell = await fetch("/admin/portais/portal-hospede/", { redirect: "manual" });

  assert.equal(redirect.status, 308);
  assert.equal(new URL(redirect.headers.get("location")).pathname, "/admin/portais/portal-hospede/");
  assert.equal(oldContents.status, 308);
  assert.equal(new URL(oldContents.headers.get("location")).pathname, "/admin/portais/portal-hospede/");
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /Central de Portais Fioreze/);
  assert.equal(shell.headers.has("location"), false);
});

test("rotas administrativas sem barra final redirecionam para caminho canonico", async () => {
  const { fetch } = createWorkerTestContext();
  const roomService = await fetch("/admin/room-service?x=1", { redirect: "manual" });
  const portals = await fetch("/admin/portais?x=1", { redirect: "manual" });
  const media = await fetch("/admin/portais/media?x=1", { redirect: "manual" });
  const erp = await fetch("/erp/room-service?x=1", { redirect: "manual" });

  assert.equal(roomService.status, 308);
  assert.equal(new URL(roomService.headers.get("location")).pathname, "/erp/room-service/");
  assert.equal(new URL(roomService.headers.get("location")).search, "?x=1");
  assert.equal(portals.status, 308);
  assert.equal(new URL(portals.headers.get("location")).pathname, "/admin/portais/");
  assert.equal(new URL(portals.headers.get("location")).search, "?x=1");
  assert.equal(media.status, 308);
  assert.equal(new URL(media.headers.get("location")).pathname, "/admin/portais/media/");
  assert.equal(new URL(media.headers.get("location")).search, "?x=1");
  assert.equal(erp.status, 308);
  assert.equal(new URL(erp.headers.get("location")).pathname, "/erp/room-service/");
  assert.equal(new URL(erp.headers.get("location")).search, "?x=1");
});

test("subrotas administrativas entregam o shell correto ao atualizar pagina", async () => {
  const { fetch } = createWorkerTestContext();
  const roomService = await fetch("/erp/room-service/pedidos/abc", { redirect: "manual" });
  const oldRoomService = await fetch("/admin/room-service/pedidos/abc", { redirect: "manual" });
  const portals = await fetch("/admin/portais/hoteis", { redirect: "manual" });
  const media = await fetch("/admin/portais/media/asset/demo", { redirect: "manual" });

  assert.equal(oldRoomService.status, 308);
  assert.equal(new URL(oldRoomService.headers.get("location")).pathname, "/erp/room-service/pedidos/abc");
  assert.equal(roomService.status, 200);
  assert.match(await roomService.text(), /ERP Room Service Fioreze/);
  assert.equal(portals.status, 200);
  assert.match(await portals.text(), /Central de Portais Fioreze/);
  assert.equal(media.status, 200);
  assert.match(await media.text(), /Central de Portais Fioreze/);
});

test("configuracoes reune as areas de equipe sem criar outro shell", async () => {
  const { fetch } = createWorkerTestContext();
  const redirect = await fetch("/admin/configuracoes", { redirect: "manual" });
  const shell = await fetch("/admin/configuracoes/", { redirect: "manual" });

  assert.equal(redirect.status, 308);
  assert.equal(new URL(redirect.headers.get("location")).pathname, "/admin/configuracoes/");
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /settingsManager/);
});

test("todos os modulos da Central de Portais entregam o shell funcional", async () => {
  const { fetch } = createWorkerTestContext();
  for (const path of [
    "/admin/portais/eventos/",
    "/admin/portais/portal-hospede/",
    "/admin/portais/areas/",
    "/admin/portais/navegacao/",
    "/admin/portais/auditoria/",
  ]) {
    const response = await fetch(path, { redirect: "manual" });
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /Central de Portais Fioreze/, path);
  }
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
    ["/js/modules/room-service-erp/app.js", /javascript/],
    ["/js/modules/admin/portals.js", /javascript/],
    ["/js/modules/admin/shared/admin-select-picker.js", /javascript/],
    ["/css/modules/admin/admin.css", /text\/css/],
    ["/css/modules/admin/admin-erp-aligned.css", /text\/css/],
    ["/css/modules/room-service-erp/shell.css", /text\/css/],
  ];

  for (const [path, contentType] of assets) {
    const response = await fetch(path, { redirect: "manual" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", contentType);
  }
});
