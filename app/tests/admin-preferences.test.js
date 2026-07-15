import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_ORIGIN, AURORA_USER_ID, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

test("preferencia de aparencia usa padrao seguro e persiste por usuario", async () => {
  const { json, env } = createWorkerTestContext();
  const mullerCookie = await createSessionCookie(env);
  const auroraCookie = await createSessionCookie(env, AURORA_USER_ID);

  const initial = await json("/api/v1/admin/me/preferences", withCookie(mullerCookie));
  const updated = await json(
    "/api/v1/admin/me/preferences",
    withCookie(mullerCookie, adminJson("PATCH", { color_palette: "ocean" })),
  );
  const reloaded = await json("/api/v1/admin/me/preferences", withCookie(mullerCookie));
  const auroraInitial = await json("/api/v1/admin/me/preferences", withCookie(auroraCookie));
  await json(
    "/api/v1/admin/me/preferences",
    withCookie(auroraCookie, adminJson("PATCH", { color_palette: "forest" })),
  );
  const aurora = await json("/api/v1/admin/me/preferences", withCookie(auroraCookie));

  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.data.color_palette, "fioreze");
  assert.equal(updated.body.data.color_palette, "ocean");
  assert.equal(reloaded.body.data.color_palette, "ocean");
  assert.equal(auroraInitial.body.data.color_palette, "fioreze");
  assert.equal(aurora.body.data.color_palette, "forest");
  assert.equal(env.__data.adminUserPreferences.length, 2);
});

test("preferencia rejeita paleta invalida, campos extras e mutacao sem protecao", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const invalid = await json(
    "/api/v1/admin/me/preferences",
    withCookie(cookie, adminJson("PATCH", { color_palette: "neon" })),
  );
  const extra = await json(
    "/api/v1/admin/me/preferences",
    withCookie(cookie, adminJson("PATCH", { color_palette: "forest", internal: true })),
  );
  const unprotected = await json("/api/v1/admin/me/preferences", withCookie(cookie, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ color_palette: "forest" }),
  }));

  assert.equal(invalid.response.status, 400);
  assert.equal(extra.response.status, 400);
  assert.equal(unprotected.response.status, 403);
});

test("preferencias administrativas exigem sessao valida", async () => {
  const { json } = createWorkerTestContext();

  const response = await json("/api/v1/admin/me/preferences");

  assert.equal(response.response.status, 401);
});

function adminJson(method, body) {
  return {
    method,
    headers: {
      "content-type": "application/json",
      origin: ADMIN_ORIGIN,
      "x-fioreze-admin-action": "erp-admin",
    },
    body: JSON.stringify(body),
  };
}
