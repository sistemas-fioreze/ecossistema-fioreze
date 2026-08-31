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
  assert.equal(body.data.branding.favicon_url, "/assets/hotels/muller-fioreze/logo-ff.png");
  assert.equal(body.data.branding.header_logo_scale, 1);
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
  const { response, body } = await json("/api/v1/public/hotels/muller-fioreze/portal/home", {
    headers: { "x-fioreze-test-now": "2026-08-09T12:00:00.000Z" },
  });

  assert.equal(response.status, 200);
  assert.equal(body.data.hotel_id, "muller-fioreze");
  assert.equal(body.data.module_key, "guest-portal");
  assert.deepEqual(body.data.pages.map((page) => page.id), ["page-muller-home", "page-muller-guide"]);
  assert.deepEqual(body.data.events.map((event) => event.id), ["event-muller-welcome"]);
  assert.deepEqual(body.data.events[0].tags, ["Recepcao"]);
  assert.equal(body.data.events[0].location, "Sala Exemplo");
  assert.equal(body.data.events[0].action_text, "Ver programacao");
  assert.equal(body.data.events[0].action_url, "https://example.test/programacao");
  assert.deepEqual(body.data.events[0].occurrences.map((occurrence) => occurrence.id), ["occurrence-muller-welcome"]);
  assert.equal("tags_json" in body.data.events[0], false);
  assert.deepEqual(body.data.information.map((item) => item.id), ["info-muller-wifi", "info-muller-breakfast"]);
  assert.equal(JSON.stringify(body.data).includes("aurora"), false);
  assert.equal(JSON.stringify(body.data).includes("info-muller-private"), false);
});

test("evento recorrente retorna um único card com todas as ocorrências", async () => {
  const context = createWorkerTestContext();
  const event = context.env.__data.events.find((entry) => entry.id === "event-muller-welcome");
  event.ends_at = "2026-08-24T22:00:00.000Z";
  context.env.__data.eventOccurrences.push({
    id: "occurrence-muller-welcome-second",
    event_id: event.id,
    hotel_id: event.hotel_id,
    starts_at: "2026-08-24T20:00:00.000Z",
    ends_at: "2026-08-24T22:00:00.000Z",
    timezone: event.timezone,
  });

  const { body } = await context.json(
    "/api/v1/public/hotels/muller-fioreze/portal/events",
    { headers: { "x-fioreze-test-now": "2026-08-09T12:00:00.000Z" } },
  );
  const matches = body.data.events.filter((entry) => entry.id === event.id);
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].occurrences.map((occurrence) => occurrence.id), [
    "occurrence-muller-welcome",
    "occurrence-muller-welcome-second",
  ]);
});

test("paginas e eventos do portal preservam isolamento por hotel", async () => {
  const { json } = createWorkerTestContext();
  const [{ body: pages }, { body: events }] = await Promise.all([
    json("/api/v1/public/hotels/aurora-demo/portal/pages", {
      headers: { "x-fioreze-test-now": "2026-08-09T12:00:00.000Z" },
    }),
    json("/api/v1/public/hotels/aurora-demo/portal/events", {
      headers: { "x-fioreze-test-now": "2026-08-09T12:00:00.000Z" },
    }),
  ]);

  assert.deepEqual(pages.data.pages.map((page) => page.id), ["page-aurora-home"]);
  assert.deepEqual(events.data.events.map((event) => event.id), ["event-aurora-welcome"]);
});

test("evento nao permanente deixa de ser retornado no instante inicial", async () => {
  const context = createWorkerTestContext();
  context.env.__data.events.push({
    id: "event-expired",
    hotel_id: "muller-fioreze",
    title: "Evento encerrado",
    starts_at: "2026-07-12T20:00:00.000Z",
    ends_at: "2026-07-13T15:00:00.000Z",
    timezone: "America/Sao_Paulo",
    status: "published",
    is_permanent: 0,
    tags_json: "[]",
  });
  const { response, body } = await context.json(
    "/api/v1/public/hotels/muller-fioreze/portal/events",
    { headers: { "x-fioreze-test-now": "2026-07-13T15:00:00.000Z" } },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.data.events.some((event) => event.id === "event-expired"), false);
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

test("Emporio habilitado responde como catalogo publico funcional", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/public/hotels/aurora-demo/emporio/items");

  assert.equal(response.status, 200);
  assert.equal(body.data.module_key, "emporio");
  assert.deepEqual(body.data.categories, []);
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

test("catalogo publico normaliza opcoes legadas sem expor metadata interna", async () => {
  const { json, env } = createWorkerTestContext();
  const pizza = env.__data.catalogItems.find((item) => item.id === "muller-sandwich");
  pizza.name = "Pizza Artesanal Salgada";
  pizza.metadata_json = JSON.stringify({ legacy_meta: "Dado interno", options: ["Calabresa", "Marguerita"] });

  const { response, body } = await json("/api/v1/public/hotels/muller-fioreze/room-service/products");
  const item = body.data.categories.flatMap((category) => category.items).find((entry) => entry.id === pizza.id);

  assert.equal(response.status, 200);
  assert.deepEqual(item.options, [{
    key: "selection",
    label: "Escolha o sabor",
    required: true,
    values: ["Calabresa", "Marguerita"],
  }]);
  assert.equal("metadata_json" in item, false);
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
