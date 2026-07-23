import assert from "node:assert/strict";
import test from "node:test";
import { createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

test("sessao administrativa fixa autentica com relogio deterministico do teste", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const session = await json("/api/v1/admin/session", withCookie(cookie));

  assert.equal(session.response.status, 200);
  assert.equal(env.__data.adminSessions[0].created_at, "2026-07-12T11:00:00.000Z");
  assert.equal(env.__data.adminSessions[0].expires_at, "2026-07-12T13:00:00.000Z");
});

test("sessao administrativa expirada antes do relogio deterministico retorna 401", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env, undefined, { expires_at: "2026-07-12T11:59:59.000Z" });

  const session = await json("/api/v1/admin/session", withCookie(cookie));

  assert.equal(session.response.status, 401);
});

test("GET administrativo autenticado usa x-fioreze-test-now do helper", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermission(env, "portals.hotels.read");
  const cookie = await createSessionCookie(env);

  const response = await json("/api/v1/admin/hotels", withCookie(cookie));

  assert.equal(response.response.status, 200);
  assert.equal(response.body.data.hotels[0].hotel_id, "muller-fioreze");
});

test("PATCH autenticado sem header de mutacao retorna 403, nao expiracao acidental", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermission(env, "portals.embed.read");
  grantPermission(env, "portals.embed.update");
  const cookie = await createSessionCookie(env);

  const response = await json(
    "/api/v1/admin/hotels/muller-fioreze/embed",
    withCookie(cookie, { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" }),
  );

  assert.equal(response.response.status, 403);
});

test("usuario sem permissao preserva comportamento da rota com sessao valida", async () => {
  const { json, env } = createWorkerTestContext();
  env.__data.adminUsers.find((user) => user.id === "user-demo-admin").user_number = 99;
  const cookie = await createSessionCookie(env);

  const response = await json("/api/v1/admin/hotels", withCookie(cookie));

  assert.equal(response.response.status, 200);
  assert.equal(response.body.data.hotels[0].hotel_id, "muller-fioreze");
  assert.equal(Object.hasOwn(response.body.data.hotels[0], "branding_configured"), false);
});

test("helper permite sobrescrever x-fioreze-test-now explicitamente", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const response = await json(
    "/api/v1/admin/session",
    withCookie(cookie, { headers: { "x-fioreze-test-now": "2026-07-12T14:00:00.000Z" } }),
  );

  assert.equal(response.response.status, 401);
});

function grantPermission(env, permissionKey) {
  const permission = env.__data.adminPermissions.find((entry) => entry.permission_key === permissionKey);
  if (!permission) return;
  const exists = env.__data.adminRolePermissions.some(
    (entry) => entry.role_id === "role-demo-manager" && entry.permission_id === permission.id,
  );
  if (!exists) env.__data.adminRolePermissions.push({ role_id: "role-demo-manager", permission_id: permission.id });
}
