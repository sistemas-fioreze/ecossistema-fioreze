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

test("bootstrap retorna service_hours do hotel correto sem campos internos", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/public/hotels/muller-fioreze/bootstrap");

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body.data.service_hours), ["room-service"]);

  const roomServiceHours = body.data.service_hours["room-service"];
  assert.equal(roomServiceHours.length, 8);
  assert.deepEqual(roomServiceHours.slice(0, 2), [
    {
      day_of_week: 0,
      opens_at: "16:00",
      closes_at: "22:00",
      is_closed: false,
    },
    {
      day_of_week: 0,
      opens_at: "22:30",
      closes_at: "23:30",
      is_closed: false,
    },
  ]);
  assert.equal(roomServiceHours.some((entry) => entry.opens_at === "08:00"), false);
  assert.equal(roomServiceHours.some((entry) => "id" in entry || "created_at" in entry || "updated_at" in entry), false);
});

test("bootstrap nao vaza service_hours de outro hotel", async () => {
  const { json } = createWorkerTestContext();
  const { body: muller } = await json("/api/v1/public/hotels/muller-fioreze/bootstrap");
  const { body: aurora } = await json("/api/v1/public/hotels/aurora-demo/bootstrap");

  assert.equal(muller.data.service_hours["room-service"].every((entry) => entry.opens_at !== "15:00"), true);
  assert.equal(aurora.data.service_hours["room-service"].length, 7);
  assert.equal(aurora.data.service_hours["room-service"].every((entry) => entry.opens_at === "15:00"), true);
  assert.equal(aurora.data.service_hours["room-service"].every((entry) => entry.closes_at === "21:00"), true);
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

test("portal publico entrega somente conteudo publicado da unidade solicitada", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/public/hotels/muller-fioreze/portal/home");

  assert.equal(response.status, 200);
  assert.equal(body.data.hotel_id, "muller-fioreze");
  assert.equal(body.data.module_key, "guest-portal");
  assert.deepEqual(body.data.pages.map((page) => page.id), ["page-muller-home", "page-muller-guide"]);
  assert.deepEqual(body.data.events.map((event) => event.id), ["event-muller-welcome"]);
  assert.deepEqual(body.data.events[0].tags, ["Recepcao"]);
  assert.equal(body.data.events[0].location, "Sala Exemplo");
  assert.equal(body.data.events[0].action_text, "Ver programacao");
  assert.equal(body.data.events[0].action_url, "https://example.test/programacao");
  assert.equal("tags_json" in body.data.events[0], false);
  assert.deepEqual(body.data.information.map((item) => item.id), ["info-muller-wifi", "info-muller-breakfast"]);
  assert.equal(JSON.stringify(body.data).includes("aurora"), false);
  assert.equal(JSON.stringify(body.data).includes("info-muller-private"), false);
});

test("paginas e eventos do portal preservam isolamento por hotel", async () => {
  const { json } = createWorkerTestContext();
  const [{ body: pages }, { body: events }] = await Promise.all([
    json("/api/v1/public/hotels/aurora-demo/portal/pages"),
    json("/api/v1/public/hotels/aurora-demo/portal/events"),
  ]);

  assert.deepEqual(pages.data.pages.map((page) => page.id), ["page-aurora-home"]);
  assert.deepEqual(events.data.events.map((event) => event.id), ["event-aurora-welcome"]);
});

test("portal publico e bloqueado quando o modulo nao e publico", async () => {
  const context = createWorkerTestContext();
  const module = context.env.__data.hotelModules.find(
    (entry) => entry.hotel_id === "muller-fioreze" && entry.module_key === "guest-portal",
  );
  module.is_public = 0;

  const { response, body } = await context.json("/api/v1/public/hotels/muller-fioreze/portal/home");
  assert.equal(response.status, 404);
  assert.equal(body.error.code, "not_found");
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
  assert.equal(body.data.categories[0].items.every((item) => typeof item.image_alt === "string"), true);
});

test("shell publico e servido para rotas de hotel sem baixar HTML remoto", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/muller-fioreze/room-service");
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(text, /<body>\/<\/body>/);
});

test("rota administrativa sem autenticacao retorna 401", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/admin/hotels/muller-fioreze/orders");

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
});
