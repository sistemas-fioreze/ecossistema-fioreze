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
  assert.equal(env.__data.orderStatusHistory.length, 1);
  assert.equal(env.__data.printEvents.length, 0);
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
