import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

test("GET /api/v1/health retorna estado local sem impressao", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/health");

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.service, "fioreze-portais");
  assert.equal(body.data.impression_enabled, false);
});

test("bootstrap retorna hotel, branding e somente modulos publicos habilitados", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/public/hotels/muller-fioreze/bootstrap");

  assert.equal(response.status, 200);
  assert.equal(body.data.hotel_id, "muller-fioreze");
  assert.equal(body.data.branding.primary_color, "#17594a");
  assert.deepEqual(
    body.data.modules.map((module) => module.module_key),
    ["guest-portal", "room-service"],
  );
  assert.equal(body.data.settings["internal.note"], undefined);
});

test("hotel inexistente retorna 404 controlado", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/public/hotels/hotel-inexistente/bootstrap");

  assert.equal(response.status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "not_found");
});

test("lista de modulos respeita habilitacao por hotel", async () => {
  const { json } = createWorkerTestContext();
  const { body: muller } = await json("/api/v1/public/hotels/muller-fioreze/modules");
  const { body: aurora } = await json("/api/v1/public/hotels/aurora-demo/modules");

  assert.deepEqual(
    muller.data.modules.map((module) => module.module_key),
    ["guest-portal", "room-service"],
  );
  assert.deepEqual(
    aurora.data.modules.map((module) => module.module_key),
    ["guest-portal", "room-service", "emporio"],
  );
});

test("modulo desabilitado e bloqueado no Worker", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/public/hotels/muller-fioreze/spa/services");

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "not_found");
});

test("modulo planejado habilitado responde como contrato futuro, nao como fluxo ativo", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/public/hotels/aurora-demo/emporio/items");

  assert.equal(response.status, 501);
  assert.equal(body.error.code, "not_implemented");
  assert.equal(body.error.details.module_key, "emporio");
});

test("consulta de produtos e isolada por hotel", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/public/hotels/muller-fioreze/room-service/products");

  assert.equal(response.status, 200);
  assert.equal(body.data.hotel_id, "muller-fioreze");
  assert.equal(body.data.module_key, "room-service");

  const itemIds = body.data.categories.flatMap((category) => category.items.map((item) => item.id));
  assert.ok(itemIds.includes("muller-sandwich"));
  assert.ok(itemIds.includes("muller-soup"));
  assert.equal(itemIds.includes("aurora-sandwich"), false);
  assert.equal(itemIds.includes("muller-emporio-water"), false);
  assert.equal(itemIds.includes("muller-archived"), false);
});

test("shell publico e servido para rotas de hotel sem baixar HTML remoto", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/muller-fioreze/room-service");
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(text, /\/index\.html/);
});

test("rota administrativa sem autenticacao retorna 401", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/admin/hotels/muller-fioreze/orders");

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
});
