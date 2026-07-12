import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

const ADMIN_ORIGIN = "https://local.test";
const DEMO_USER_ID = "user-demo-admin";
const EMBED_PERMISSIONS = ["portals.embed.read", "portals.embed.update"];

test("wrangler mantem /embed/* em run_worker_first", () => {
  const config = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
  assert.ok(config.assets.run_worker_first.includes("/embed/*"));
});

test("embed room-service passa pelo Worker, usa CSP por allowlist e remove X-Frame-Options", async () => {
  const { fetch } = createWorkerTestContext();

  const response = await fetch("/embed/muller-fioreze/room-service/?background=transparent&header=hidden&compact=true", {
    headers: { origin: "https://example.invalid" },
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.equal(response.headers.get("x-frame-options"), null);
  assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'self' https:\/\/example\.invalid/);
  assert.match(html, /fioreze-embed-root/);
  assert.match(html, /\/embed\/muller-fioreze\/room-service\/embed\.js/);
});

test("embed rejeita admin, origem nao autorizada e modulo desabilitado", async () => {
  const { json, fetch } = createWorkerTestContext();

  const deniedOrigin = await json("/api/v1/public/hotels/muller-fioreze/embed/room-service/config", {
    headers: { origin: "https://unauthorized.invalid" },
  });
  const admin = await fetch("/embed/muller-fioreze/admin/");
  const disabled = await json("/api/v1/public/hotels/muller-fioreze/embed/emporio/config", {
    headers: { origin: "https://example.invalid" },
  });

  assert.equal(deniedOrigin.response.status, 404);
  assert.equal(admin.status, 404);
  assert.equal(disabled.response.status, 404);
});

test("config publico nao retorna dados administrativos e normaliza parametros permitidos", async () => {
  const { json } = createWorkerTestContext();

  const response = await json(
    "/api/v1/public/hotels/muller-fioreze/embed/room-service/config?theme=dark&background=transparent&header=hidden&compact=true&css=bad",
    { headers: { origin: "https://example.invalid" } },
  );

  assert.equal(response.response.status, 200);
  assert.equal(response.body.data.hotel_id, "muller-fioreze");
  assert.equal(response.body.data.module_key, "room-service");
  assert.equal(response.body.data.options.theme, "light");
  assert.equal(response.body.data.options.background, "transparent");
  assert.equal(response.body.data.options.header, "hidden");
  assert.equal(response.body.data.options.compact, true);
  assert.equal(Object.hasOwn(response.body.data, "users"), false);
  assert.equal(Object.hasOwn(response.body.data, "permissions"), false);
});

test("scripts de embed sao JS do Worker e nao fallback HTML do SPA", async () => {
  const { fetch } = createWorkerTestContext();

  const host = await fetch("/embed/fioreze-embed.js");
  const module = await fetch("/embed/muller-fioreze/room-service/embed.js", {
    headers: { origin: "https://example.invalid" },
  });

  assert.equal(host.status, 200);
  assert.match(host.headers.get("content-type") || "", /javascript/);
  assert.match(await host.text(), /fioreze:embed:resize/);
  assert.equal(module.status, 200);
  assert.match(module.headers.get("content-type") || "", /javascript/);
  assert.match(await module.text(), /initFiorezeEmbed/);
});

test("admin le e atualiza configuracao de embed com auditoria e validacao de origem", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const read = await json("/api/v1/admin/hotels/muller-fioreze/embed", withCookie(cookie));
  const invalid = await json(
    "/api/v1/admin/hotels/muller-fioreze/embed",
    withCookie(cookie, adminJson("PATCH", { allowed_origins: ["javascript:alert(1)", "https://site.example/path"] })),
  );
  const updated = await json(
    "/api/v1/admin/hotels/muller-fioreze/embed",
    withCookie(
      cookie,
      adminJson("PATCH", {
        enabled: true,
        allowed_origins: ["https://site.example", "https://site.example"],
        allowed_modules: ["room-service"],
        default_theme: "auto",
        default_background: "transparent",
        header: "hidden",
        initial_height: 640,
        compact: true,
      }),
    ),
  );

  assert.equal(read.response.status, 200);
  assert.equal(invalid.response.status, 200);
  assert.deepEqual(invalid.body.data.embed.allowed_origins, []);
  assert.equal(updated.response.status, 200);
  assert.deepEqual(updated.body.data.embed.allowed_origins, ["https://site.example"]);
  assert.deepEqual(updated.body.data.embed.allowed_modules, ["room-service"]);
  assert.equal(updated.body.data.embed.default_theme, "auto");
  assert.equal(updated.body.data.embed.compact, true);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "hotel.embed.update");
});

test("admin embed exige sessao, permissao, header de mutacao e acesso ao hotel", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  const noSession = await json("/api/v1/admin/hotels/muller-fioreze/embed");
  const noPermission = await json("/api/v1/admin/hotels/muller-fioreze/embed", withCookie(cookie));
  grantPermissions(env);
  const noHeader = await json(
    "/api/v1/admin/hotels/muller-fioreze/embed",
    withCookie(cookie, { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" }),
  );
  const otherHotel = await json("/api/v1/admin/hotels/aurora-demo/embed", withCookie(cookie));

  assert.equal(noSession.response.status, 401);
  assert.equal(noPermission.response.status, 401);
  assert.equal(noHeader.response.status, 403);
  assert.equal(otherHotel.response.status, 401);
});

test("rotas /admin e /api continuam processadas pelo Worker", async () => {
  const { fetch, json } = createWorkerTestContext();
  const admin = await fetch("/admin/", { redirect: "manual" });
  const health = await json("/api/v1/health");

  assert.equal(admin.status, 200);
  assert.match(await admin.text(), /Ecossistema Fioreze/);
  assert.equal(health.response.status, 200);
  assert.equal(health.body.data.environment, "test");
  assert.equal(admin.headers.get("x-frame-options"), "DENY");
});

function adminJson(method, body) {
  return {
    method,
    headers: {
      "content-type": "application/json",
      origin: ADMIN_ORIGIN,
      "x-fioreze-admin-action": "erp-admin",
      "x-fioreze-test-now": "2026-07-12T12:00:00.000Z",
    },
    body: JSON.stringify(body),
  };
}

function withCookie(cookie, init = {}) {
  return {
    ...init,
    headers: {
      ...(init.headers || {}),
      cookie,
    },
  };
}

function grantPermissions(env, permissions = EMBED_PERMISSIONS) {
  for (const permissionKey of permissions) {
    const permission = env.__data.adminPermissions.find((entry) => entry.permission_key === permissionKey);
    if (!permission) continue;
    const exists = env.__data.adminRolePermissions.some(
      (entry) => entry.role_id === "role-demo-manager" && entry.permission_id === permission.id,
    );
    if (!exists) env.__data.adminRolePermissions.push({ role_id: "role-demo-manager", permission_id: permission.id });
  }
}

async function createSessionCookie(env, userId = DEMO_USER_ID) {
  const token = `test-session-${crypto.randomUUID()}`;
  env.__data.adminSessions.push({
    id: `sess-${crypto.randomUUID()}`,
    user_id: userId,
    token_hash: await sha256Hex(token),
    user_agent_hash: null,
    ip_hash: null,
    created_at: "2026-07-12T11:00:00.000Z",
    expires_at: "2026-07-12T13:00:00.000Z",
    revoked_at: null,
  });
  return `fioreze_admin_session=${token}`;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
