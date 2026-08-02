import assert from "node:assert/strict";
import test from "node:test";
import { PrintProvider } from "../src/services/print-provider.js";

test("provedor de impressao local permanece desativado por padrao", async () => {
  const provider = new PrintProvider({ IMPRESSION_ENABLED: "false" });
  const result = await provider.enqueue({ order_id: "ord-test" });

  assert.deepEqual(result, {
    enabled: false,
    queued: false,
    reason: "impression-disabled",
  });
});

test("habilitar impressao sem provedor real configurado falha de forma explicita", async () => {
  const env = createPrintEnv({ setting_value: "false", template_id: "template-test" });
  const provider = new PrintProvider(env);
  const result = await provider.enqueue({ hotelId: "hotel-test", moduleKey: "room-service", orderId: "ord-test", createdAt: "2026-08-02T12:00:00.000Z" });
  assert.deepEqual(result, { enabled: true, queued: false, reason: "unit-printing-disabled" });
  assert.equal(env.statements.length, 0);
});

test("provedor prepara evento idempotente quando ambiente e unidade estao habilitados", async () => {
  const env = createPrintEnv({ setting_value: "true", template_id: "template-test" });
  const provider = new PrintProvider(env);
  const result = await provider.enqueue({ hotelId: "hotel-test", moduleKey: "room-service", orderId: "ord-test", createdAt: "2026-08-02T12:00:00.000Z" });
  assert.deepEqual(result, { enabled: true, queued: true, reason: null });
  assert.equal(env.statements.length, 1);
  assert.match(env.statements[0].sql, /INSERT OR IGNORE INTO print_events/i);
  assert.ok(env.statements[0].params.includes("automatic:ord-test"));
});

function createPrintEnv(config) {
  const env = { IMPRESSION_ENABLED: "true", statements: [] };
  env.DB = {
    prepare(sql) {
      const prepared = {
        sql,
        params: [],
        bind(...params) { this.params = params; return this; },
        async first() { return config; },
        async run() { env.statements.push({ sql: this.sql, params: this.params }); return { meta: { changes: 1 } }; },
      };
      return prepared;
    },
  };
  return env;
}
