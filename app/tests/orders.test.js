import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext, jsonPost } from "./helpers/worker.js";

const VALID_ORDER = {
  guest_name: "Hospede Ficticio",
  room_code: "D-101",
  notes: "Teste local sem impressao.",
  items: [
    {
      catalog_item_id: "muller-sandwich",
      quantity: 2,
      note: "Sem cebola.",
    },
    {
      catalog_item_id: "muller-juice",
      quantity: 1,
    },
  ],
};

test("cria pedido de Room Service recalculando total pelo banco", async () => {
  const { json, env } = createWorkerTestContext();
  const { response, body } = await json("/api/v1/public/hotels/muller-fioreze/room-service/orders", jsonPost(VALID_ORDER));

  assert.equal(response.status, 201);
  assert.equal(body.data.hotel_id, "muller-fioreze");
  assert.equal(body.data.module_key, "room-service");
  assert.equal(body.data.total_cents, 5900);
  assert.equal(body.data.impression.enabled, false);
  assert.equal(env.__data.orders.length, 1);
  assert.equal(env.__data.orderItems.length, 2);
  assert.equal(body.data.items[0].note, "Sem cebola.");
  assert.deepEqual(JSON.parse(env.__data.orderItems[0].selected_options_snapshot), { note: "Sem cebola." });
  assert.equal(env.__data.orderItems[1].selected_options_snapshot, null);
  assert.equal(env.__data.orderStatusHistory.length, 1);
  assert.equal(env.__data.printEvents.length, 0);
});

test("rejeita observacao de item acima do limite", async () => {
  const { json, env } = createWorkerTestContext();
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      items: [{ catalog_item_id: "muller-sandwich", quantity: 1, note: "x".repeat(181) }],
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "bad_request");
  assert.equal(env.__data.orders.length, 0);
});

test("valida e preserva a opcao selecionada no snapshot do pedido", async () => {
  const { json, env } = createWorkerTestContext();
  const pizza = env.__data.catalogItems.find((item) => item.id === "muller-sandwich");
  pizza.name = "Pizza Artesanal Salgada";
  pizza.metadata_json = JSON.stringify({ options: ["Calabresa", "Marguerita"] });

  const valid = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      items: [{ catalog_item_id: pizza.id, quantity: 1, selected_options: { selection: "Marguerita" } }],
    }),
  );

  assert.equal(valid.response.status, 201);
  assert.deepEqual(valid.body.data.items[0].selected_options, { selection: "Marguerita" });
  assert.deepEqual(JSON.parse(env.__data.orderItems[0].selected_options_snapshot), {
    selections: { selection: "Marguerita" },
  });
});

test("rejeita opcao ausente ou fora do catalogo sem criar pedido", async () => {
  const missingContext = createWorkerTestContext();
  const missingPizza = missingContext.env.__data.catalogItems.find((item) => item.id === "muller-sandwich");
  missingPizza.name = "Pizza Artesanal Salgada";
  missingPizza.metadata_json = JSON.stringify({ options: ["Calabresa", "Marguerita"] });
  const missing = await missingContext.json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({ ...VALID_ORDER, items: [{ catalog_item_id: missingPizza.id, quantity: 1 }] }),
  );

  const invalidContext = createWorkerTestContext();
  const invalidPizza = invalidContext.env.__data.catalogItems.find((item) => item.id === "muller-sandwich");
  invalidPizza.name = "Pizza Artesanal Salgada";
  invalidPizza.metadata_json = JSON.stringify({ options: ["Calabresa", "Marguerita"] });
  const invalid = await invalidContext.json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      items: [{ catalog_item_id: invalidPizza.id, quantity: 1, selected_options: { selection: "Valor adulterado" } }],
    }),
  );

  assert.equal(missing.response.status, 422);
  assert.equal(invalid.response.status, 422);
  assert.equal(missingContext.env.__data.orders.length, 0);
  assert.equal(invalidContext.env.__data.orders.length, 0);
});

test("idempotency-key repetida retorna o pedido existente", async () => {
  const { json, env } = createWorkerTestContext();
  const headers = { "idempotency-key": "same-test-key" };

  const first = await json("/api/v1/public/hotels/muller-fioreze/room-service/orders", jsonPost(VALID_ORDER, headers));
  const second = await json("/api/v1/public/hotels/muller-fioreze/room-service/orders", jsonPost(VALID_ORDER, headers));

  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 200);
  assert.equal(second.body.data.idempotent, true);
  assert.equal(env.__data.orders.length, 1);
});

test("rejeita pedido sem idempotency-key valida", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost(VALID_ORDER, { "idempotency-key": "!" }),
  );

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "bad_request");
});

test("rejeita pedido fora do horario de service_hours", async () => {
  const { json, env } = createWorkerTestContext();
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost(VALID_ORDER, { "x-fioreze-test-now": "2026-07-05T18:00:00.000Z" }),
  );

  assert.equal(response.status, 422);
  assert.equal(body.error.code, "unprocessable_entity");
  assert.equal(body.error.message, "Room Service fechado no momento.");
  assert.equal(env.__data.orders.length, 0);
});

test("aceita pedido em segunda faixa do mesmo dia", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost(VALID_ORDER, { "x-fioreze-test-now": "2026-07-06T01:45:00.000Z" }),
  );

  assert.equal(response.status, 201);
  assert.equal(body.data.status, "sent");
});

test("aceita pedido em horario que atravessa meia-noite", async () => {
  const { json, env } = createWorkerTestContext();
  env.__data.serviceHours = [
    { hotel_id: "muller-fioreze", module_key: "room-service", day_of_week: 0, opens_at: "22:00", closes_at: "02:00", is_closed: 0, sort_order: 10, status: "active", archived_at: null },
    ...env.__data.serviceHours.filter((entry) => entry.hotel_id !== "muller-fioreze"),
  ];

  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost(VALID_ORDER, { "x-fioreze-test-now": "2026-07-06T04:30:00.000Z" }),
  );

  assert.equal(response.status, 201);
  assert.equal(body.data.status, "sent");
});

test("agenda entrega somente para o mesmo dia e dentro do horario da unidade", async () => {
  const { json, env } = createWorkerTestContext();
  env.__data.settings.push({
    hotel_id: "muller-fioreze",
    setting_key: "room-service.order_scheduling_enabled",
    setting_value: "true",
    value_type: "boolean",
    is_public: 1,
  });
  const scheduledFor = "2026-07-05T21:30:00.000Z";
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost(
      { ...VALID_ORDER, preparation_mode: "scheduled", scheduled_for: scheduledFor },
      { "x-fioreze-test-now": "2026-07-05T20:00:00.000Z" },
    ),
  );

  assert.equal(response.status, 201);
  assert.equal(body.data.preparation_mode, "scheduled");
  assert.equal(body.data.scheduled_for, scheduledFor);
  assert.equal(env.__data.orders[0].scheduled_for, scheduledFor);
});

test("rejeita agendamento fora do horario automatico da unidade", async () => {
  const { json, env } = createWorkerTestContext();
  env.__data.settings.push({
    hotel_id: "muller-fioreze",
    setting_key: "room-service.order_scheduling_enabled",
    setting_value: "true",
    value_type: "boolean",
    is_public: 1,
  });
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost(
      { ...VALID_ORDER, preparation_mode: "scheduled", scheduled_for: "2026-07-06T02:45:00.000Z" },
      { "x-fioreze-test-now": "2026-07-05T20:00:00.000Z" },
    ),
  );

  assert.equal(response.status, 422);
  assert.match(body.error.message, /fora do funcionamento/i);
  assert.equal(env.__data.orders.length, 0);
});

test("rejeita agendamento nos modos manuais aberto e fechado", async () => {
  for (const operationMode of ["forced_open", "forced_closed"]) {
    const { json, env } = createWorkerTestContext();
    env.__data.settings = env.__data.settings.filter(
      (setting) =>
        setting.hotel_id !== "muller-fioreze" ||
        !["room-service.order_scheduling_enabled", "room-service.operation_mode"].includes(setting.setting_key),
    );
    env.__data.settings.push(
      {
        hotel_id: "muller-fioreze",
        setting_key: "room-service.order_scheduling_enabled",
        setting_value: "true",
        value_type: "boolean",
        is_public: 1,
      },
      {
        hotel_id: "muller-fioreze",
        setting_key: "room-service.operation_mode",
        setting_value: operationMode,
        value_type: "string",
        is_public: 1,
      },
    );

    const { response, body } = await json(
      "/api/v1/public/hotels/muller-fioreze/room-service/orders",
      jsonPost(
        { ...VALID_ORDER, preparation_mode: "scheduled", scheduled_for: "2026-07-05T21:30:00.000Z" },
        { "x-fioreze-test-now": "2026-07-05T20:00:00.000Z" },
      ),
    );

    assert.equal(response.status, 422, operationMode);
    assert.match(body.error.message, /somente no modo automatico/i);
    assert.equal(env.__data.orders.length, 0);
  }
});

test("rejeita agendamento para outro dia ou quando a unidade desabilita a opcao", async () => {
  const { json, env } = createWorkerTestContext();
  const disabled = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({ ...VALID_ORDER, preparation_mode: "scheduled", scheduled_for: "2026-07-05T21:30:00.000Z" }),
  );
  env.__data.settings.push({
    hotel_id: "muller-fioreze",
    setting_key: "room-service.order_scheduling_enabled",
    setting_value: "true",
    value_type: "boolean",
    is_public: 1,
  });
  const nextDay = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({ ...VALID_ORDER, preparation_mode: "scheduled", scheduled_for: "2026-07-06T21:30:00.000Z" }),
  );

  assert.equal(disabled.response.status, 422);
  assert.equal(nextDay.response.status, 422);
  assert.equal(env.__data.orders.length, 0);
});

test("desabilitar observacoes bloqueia notas gerais e por item", async () => {
  const { json, env } = createWorkerTestContext();
  env.__data.settings.push({
    hotel_id: "muller-fioreze",
    setting_key: "room-service.order_notes_enabled",
    setting_value: "false",
    value_type: "boolean",
    is_public: 1,
  });
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({ ...VALID_ORDER, order_note: "Observacao que deve ser bloqueada." }),
  );

  assert.equal(response.status, 422);
  assert.match(body.error.message, /Observacoes estao desativadas/);
  assert.equal(env.__data.orders.length, 0);
});

test("acompanhamento recente exige a chave do proprio pedido e preserva isolamento", async () => {
  const { json } = createWorkerTestContext();
  const trackingKey = "tracking-order-demo";
  const created = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost(VALID_ORDER, { "idempotency-key": trackingKey }),
  );
  const publicId = created.body.data.public_id;
  const tracked = await json(
    `/api/v1/public/hotels/muller-fioreze/room-service/orders/${publicId}/status`,
    { headers: { "X-Order-Tracking-Key": trackingKey } },
  );
  const wrongKey = await json(
    `/api/v1/public/hotels/muller-fioreze/room-service/orders/${publicId}/status`,
    { headers: { "X-Order-Tracking-Key": "tracking-order-wrong" } },
  );
  const otherHotel = await json(
    `/api/v1/public/hotels/aurora-demo/room-service/orders/${publicId}/status`,
    { headers: { "X-Order-Tracking-Key": trackingKey } },
  );

  assert.equal(tracked.response.status, 200);
  assert.equal(tracked.body.data.status, "sent");
  assert.equal(wrongKey.response.status, 404);
  assert.equal(otherHotel.response.status, 404);
});

test("rejeita produto inexistente", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      items: [{ catalog_item_id: "nao-existe", quantity: 1 }],
    }),
  );

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "not_found");
});

test("rejeita produto indisponivel", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      items: [{ catalog_item_id: "muller-soup", quantity: 1 }],
    }),
  );

  assert.equal(response.status, 422);
  assert.equal(body.error.code, "unprocessable_entity");
});

test("rejeita produto arquivado", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      items: [{ catalog_item_id: "muller-archived", quantity: 1 }],
    }),
  );

  assert.equal(response.status, 422);
  assert.equal(body.error.code, "unprocessable_entity");
});

test("rejeita preco adulterado pelo navegador", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      items: [{ catalog_item_id: "muller-sandwich", quantity: 1, unit_price_cents: 1 }],
    }),
  );

  assert.equal(response.status, 409);
  assert.equal(body.error.code, "conflict");
});

test("rejeita subtotal e total adulterados", async () => {
  const { json } = createWorkerTestContext();

  const subtotal = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      subtotal_cents: 1,
    }),
  );
  const total = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      total_cents: 1,
    }),
  );

  assert.equal(subtotal.response.status, 409);
  assert.equal(total.response.status, 409);
});

test("rejeita item de outro hotel", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      items: [{ catalog_item_id: "aurora-sandwich", quantity: 1 }],
    }),
  );

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "not_found");
});

test("rejeita item de outro modulo", async () => {
  const { json } = createWorkerTestContext();
  const { response, body } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      items: [{ catalog_item_id: "muller-emporio-water", quantity: 1 }],
    }),
  );

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "not_found");
});

test("rejeita mistura de itens de hoteis diferentes sem gravar pedido", async () => {
  const { json, env } = createWorkerTestContext();
  const { response } = await json(
    "/api/v1/public/hotels/muller-fioreze/room-service/orders",
    jsonPost({
      ...VALID_ORDER,
      items: [
        { catalog_item_id: "muller-sandwich", quantity: 1 },
        { catalog_item_id: "aurora-sandwich", quantity: 1 },
      ],
    }),
  );

  assert.equal(response.status, 404);
  assert.equal(env.__data.orders.length, 0);
});

test("pedido de um hotel nao aparece nem usa dados de outro hotel", async () => {
  const { json, env } = createWorkerTestContext();
  const { response, body } = await json(
    "/api/v1/public/hotels/aurora-demo/room-service/orders",
    jsonPost({
      guest_name: "Hospede Ficticio",
      room_code: "A-201",
      items: [{ catalog_item_id: "aurora-sandwich", quantity: 1 }],
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(body.data.hotel_id, "aurora-demo");
  assert.equal(body.data.total_cents, 1900);
  assert.equal(env.__data.orders.every((order) => order.hotel_id === "aurora-demo"), true);
});

test("falha atomica de batch nao deixa pedido parcial", async () => {
  const { json, env } = createWorkerTestContext();
  env.DB.failNextBatch = true;

  const { response, body } = await json("/api/v1/public/hotels/muller-fioreze/room-service/orders", jsonPost(VALID_ORDER));

  assert.equal(response.status, 500);
  assert.equal(body.error.code, "internal_error");
  assert.equal(env.__data.orders.length, 0);
  assert.equal(env.__data.orderItems.length, 0);
  assert.equal(env.__data.orderStatusHistory.length, 0);
});
