import assert from "node:assert/strict";
import test from "node:test";
import { Router } from "../src/core/router.js";

test("rota especifica vence fallback wildcard mesmo quando registrada depois", async () => {
  const router = new Router();

  router.all("/api/v1/admin/*", async () => new Response("fallback", { status: 404 }));
  router.post("/api/v1/admin/me/passkeys/registration/options", async () =>
    new Response("passkey", { status: 200 }),
  );

  const response = await router.handle(
    new Request("https://portal.hoteisfioreze.com.br/api/v1/admin/me/passkeys/registration/options", {
      method: "POST",
    }),
    {},
    {},
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "passkey");
});

test("metodo incorreto de rota especifica responde 405 antes do fallback wildcard", async () => {
  const router = new Router();

  router.all("/api/v1/admin/*", async () => new Response("fallback", { status: 404 }));
  router.post("/api/v1/admin/me/passkeys/registration/options", async () =>
    new Response("passkey", { status: 200 }),
  );

  const response = await router.handle(
    new Request("https://portal.hoteisfioreze.com.br/api/v1/admin/me/passkeys/registration/options"),
    {},
    {},
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});
