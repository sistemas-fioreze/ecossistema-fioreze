import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { ADMIN_ORIGIN, AURORA_USER_ID, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const EMBED_PERMISSIONS = ["portals.embed.read", "portals.embed.update"];

test("wrangler mantem /embed/* em run_worker_first", () => {
  const config = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
  assert.ok(config.assets.run_worker_first.includes("/*"));
});

test("bootstrap geral nao publica configuracoes embed privadas", async () => {
  const { json } = createWorkerTestContext();

  const bootstrap = await json("/api/v1/public/hotels/muller-fioreze/bootstrap");

  assert.equal(bootstrap.response.status, 200);
  assert.equal(Object.keys(bootstrap.body.data.settings).some((key) => key.startsWith("embed.")), false);
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

test("embed rejeita admin, hotel inativo, origem nao autorizada e modulo desabilitado", async () => {
  const { json, fetch, env } = createWorkerTestContext();

  const deniedOrigin = await json("/api/v1/public/hotels/muller-fioreze/embed/room-service/config", {
    headers: { origin: "https://unauthorized.invalid" },
  });
  const admin = await fetch("/embed/muller-fioreze/admin/");
  const disabled = await json("/api/v1/public/hotels/muller-fioreze/embed/emporio/config", {
    headers: { origin: "https://example.invalid" },
  });
  env.__data.hotels.find((hotel) => hotel.id === "muller-fioreze").status = "inactive";
  const inactive = await json("/api/v1/public/hotels/muller-fioreze/embed/room-service/config", {
    headers: { origin: "https://example.invalid" },
  });

  assert.equal(deniedOrigin.response.status, 404);
  assert.equal(admin.status, 404);
  assert.equal(disabled.response.status, 404);
  assert.equal(inactive.response.status, 404);
});

test("config publico nao retorna dados administrativos e normaliza parametros permitidos", async () => {
  const { json } = createWorkerTestContext();

  const response = await json(
    "/api/v1/public/hotels/muller-fioreze/embed/room-service/config?theme=dark&background=transparent&header=hidden&compact=true&css=bad",
    { headers: { origin: "https://example.invalid" } },
  );

  assert.equal(response.response.status, 200);
  assert.equal(Object.hasOwn(response.body.data, "hotel_id"), false);
  assert.equal(Object.hasOwn(response.body.data, "embed_id"), false);
  assert.equal(Object.hasOwn(response.body.data, "allowed_origins"), false);
  assert.equal(Object.hasOwn(response.body.data, "allowed_origin_count"), false);
  assert.equal(Object.hasOwn(response.body.data, "allowed_modules"), false);
  assert.equal(response.body.data.module_key, "room-service");
  assert.equal(response.body.data.options.theme, "light");
  assert.equal(response.body.data.options.background, "transparent");
  assert.equal(response.body.data.options.header, "hidden");
  assert.equal(response.body.data.options.compact, true);
  assert.equal(Object.hasOwn(response.body.data.endpoints, "orders"), false);
  assert.equal(Object.hasOwn(response.body.data, "users"), false);
  assert.equal(Object.hasOwn(response.body.data, "permissions"), false);
});

test("allowed_modules vazio ou ausente nao libera modulos implicitamente", async () => {
  const { json, env } = createWorkerTestContext();
  const moduleSetting = env.__data.settings.find(
    (setting) => setting.hotel_id === "muller-fioreze" && setting.setting_key === "embed.allowed_modules",
  );
  moduleSetting.setting_value = "[]";

  const empty = await json("/api/v1/public/hotels/muller-fioreze/embed/room-service/config", {
    headers: { origin: "https://example.invalid" },
  });
  env.__data.settings = env.__data.settings.filter(
    (setting) => !(setting.hotel_id === "muller-fioreze" && setting.setting_key === "embed.allowed_modules"),
  );
  const missing = await json("/api/v1/public/hotels/muller-fioreze/embed/room-service/config", {
    headers: { origin: "https://example.invalid" },
  });

  assert.equal(empty.response.status, 404);
  assert.equal(missing.response.status, 404);
});

test("embed desativado permite lista vazia no admin mas nao responde publicamente", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const updated = await json(
    "/api/v1/admin/hotels/muller-fioreze/embed",
    withCookie(
      cookie,
      adminJson("PATCH", {
        enabled: false,
        allowed_origins: [],
        allowed_modules: [],
        default_theme: "light",
        default_background: "default",
        header: "visible",
        initial_height: 520,
        compact: false,
      }),
    ),
  );
  const publicResponse = await json("/api/v1/public/hotels/muller-fioreze/embed/room-service/config", {
    headers: { origin: "https://example.invalid" },
  });

  assert.equal(updated.response.status, 200);
  assert.deepEqual(updated.body.data.embed.allowed_modules, []);
  assert.equal(publicResponse.response.status, 404);
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

test("host script distingue iframes identicos por source e embed id opcional", async () => {
  const { fetch } = createWorkerTestContext();
  const script = await (await fetch("/embed/fioreze-embed.js")).text();
  const listeners = {};
  const frameA = frame("https://worker.test/embed/muller-fioreze/room-service/", "fioreze-muller-fioreze-room-service");
  const frameB = frame("https://worker.test/embed/muller-fioreze/room-service/", "fioreze-muller-fioreze-room-service");
  const sandbox = {
    URL,
    window: {
      location: { href: "https://host.test/page" },
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
    },
    document: {
      querySelectorAll(selector) {
        assert.equal(selector, "iframe[data-fioreze-embed]");
        return [frameA, frameB];
      },
    },
  };

  vm.runInNewContext(script, sandbox);
  listeners.message({
    data: { type: "fioreze:embed:resize", embed_id: "fioreze-muller-fioreze-room-service", height: 777 },
    origin: "https://worker.test",
    source: frameB.contentWindow,
  });
  listeners.message({
    data: { type: "fioreze:embed:resize", embed_id: "fioreze-muller-fioreze-room-service", height: 888 },
    origin: "https://evil.test",
    source: frameA.contentWindow,
  });

  assert.equal(frameA.style.height, undefined);
  assert.equal(frameB.style.height, "777px");
});

test("admin le e atualiza configuracao de embed com auditoria e validacao de origem", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const read = await json("/api/v1/admin/hotels/muller-fioreze/embed", withCookie(cookie));
  const auditBefore = env.__data.adminAuditLog.length;
  const invalid = await json(
    "/api/v1/admin/hotels/muller-fioreze/embed",
    withCookie(cookie, adminJson("PATCH", { allowed_origins: ["javascript:alert(1)", "https://site.example/path"] })),
  );
  assert.equal(read.response.status, 200);
  assert.equal(invalid.response.status, 400);
  assert.equal(env.__data.adminAuditLog.length, auditBefore);

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

  assert.equal(updated.response.status, 200);
  assert.deepEqual(updated.body.data.embed.allowed_origins, ["https://site.example"]);
  assert.deepEqual(updated.body.data.embed.allowed_modules, ["room-service"]);
  assert.equal(updated.body.data.embed.default_theme, "auto");
  assert.equal(updated.body.data.embed.compact, true);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "hotel.embed.update");
});

test("admin valida payload embed estritamente", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);
  const invalidBodies = [
    { allowed_origins: "https://site.example" },
    { allowed_origins: ["*"] },
    { allowed_origins: ["javascript:alert(1)"] },
    { allowed_origins: ["https://site.example/path"] },
    { allowed_origins: ["https://site.example?x=1"] },
    { allowed_origins: ["https://site.example#x"] },
    { allowed_origins: ["http://site.example"] },
    { allowed_origins: Array.from({ length: 41 }, (_, index) => `https://site${index}.example`) },
    { allowed_modules: "room-service" },
    { allowed_modules: ["admin"] },
    { allowed_modules: ["Modulo Invalido"] },
    { allowed_modules: Array.from({ length: 21 }, (_, index) => `modulo-${index}`) },
    { enabled: "false" },
    { compact: "true" },
    { initial_height: "560" },
    { initial_height: null },
    { initial_height: 239 },
    { initial_height: 2001 },
  ];

  for (const body of invalidBodies) {
    const response = await json("/api/v1/admin/hotels/muller-fioreze/embed", withCookie(cookie, adminJson("PATCH", body)));
    assert.equal(response.response.status, 400, JSON.stringify(body));
  }
});

test("admin bloqueia habilitacao sem modulo publico ativo", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);
  const empty = await json(
    "/api/v1/admin/hotels/muller-fioreze/embed",
    withCookie(cookie, adminJson("PATCH", { enabled: true, allowed_modules: [] })),
  );
  const disabled = await json(
    "/api/v1/admin/hotels/muller-fioreze/embed",
    withCookie(cookie, adminJson("PATCH", { enabled: true, allowed_modules: ["emporio"] })),
  );
  const unknown = await json(
    "/api/v1/admin/hotels/muller-fioreze/embed",
    withCookie(cookie, adminJson("PATCH", { enabled: true, allowed_modules: ["modulo-inexistente"] })),
  );

  assert.equal(empty.response.status, 400);
  assert.equal(disabled.response.status, 400);
  assert.equal(unknown.response.status, 400);
});

test("admin embed exige sessao, permissao de leitura e escrita, header de mutacao e acesso ao hotel", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env, AURORA_USER_ID);
  const noSession = await json("/api/v1/admin/hotels/muller-fioreze/embed");
  const noPermission = await json("/api/v1/admin/hotels/aurora-demo/embed", withCookie(cookie));
  grantPermissions(env, ["portals.embed.update"]);
  const updateWithoutRead = await json(
    "/api/v1/admin/hotels/aurora-demo/embed",
    withCookie(cookie, adminJson("PATCH", { enabled: false })),
  );
  grantPermissions(env);
  const noHeader = await json(
    "/api/v1/admin/hotels/aurora-demo/embed",
    withCookie(cookie, { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" }),
  );
  const otherHotel = await json("/api/v1/admin/hotels/muller-fioreze/embed", withCookie(cookie));

  assert.equal(noSession.response.status, 401);
  assert.equal(noPermission.response.status, 401);
  assert.equal(updateWithoutRead.response.status, 401);
  assert.equal(noHeader.response.status, 403);
  assert.equal(otherHotel.response.status, 401);
});

test("rotas /admin, /api e paginas publicas mantem protecoes de frame corretas", async () => {
  const { fetch, json } = createWorkerTestContext();
  const admin = await fetch("/admin/", { redirect: "manual" });
  const publicPage = await fetch("/muller-fioreze");
  const health = await json("/api/v1/health");

  assert.equal(admin.status, 200);
  assert.match(await admin.text(), /Ecossistema Fioreze/);
  assert.equal(admin.headers.get("x-frame-options"), "DENY");
  assert.match(admin.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
  assert.equal(publicPage.status, 200);
  assert.match(publicPage.headers.get("content-security-policy") || "", /frame-ancestors 'self'/);
  assert.equal(health.response.status, 200);
  assert.equal(health.body.data.environment, "test");
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

function frame(src, embedId = null) {
  const attributes = new Map([
    ["data-fioreze-embed", ""],
    ["data-fioreze-embed-id", embedId],
  ]);
  return {
    src,
    style: {},
    contentWindow: {},
    getAttribute(name) {
      return attributes.get(name) || null;
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };
}
