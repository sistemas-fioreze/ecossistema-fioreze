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
  const provider = new PrintProvider({ IMPRESSION_ENABLED: "true" });

  await assert.rejects(
    () => provider.enqueue({ order_id: "ord-test" }),
    /PrintProvider real nao implementado/,
  );
});
