import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

const ADMIN_ORIGIN = "https://local.test";
const DEMO_USER_ID = "user-demo-admin";
const AURORA_USER_ID = "user-aurora-admin";
const UNIT_PERMISSIONS = [
  "portals.hotels.read",
  "portals.hotels.create",
  "portals.hotels.update",
  "portals.hotels.branding",
  "portals.hotels.settings",
  "portals.hotels.modules",
  "portals.hotels.navigation",
  "portals.media.read",
];

test("unidades exigem sessao administrativa", async () => {
  const { json } = createWorkerTestContext();

  const response = await json("/api/v1/admin/hotels");

  assert.equal(response.response.status, 401);
});

test("usuario sem permissao de unidades nao recebe listagem enriquecida", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const response = await json("/api/v1/admin/hotels", withCookie(cookie));

  assert.equal(response.response.status, 200);
  assert.equal(response.body.data.hotels[0].hotel_id, "muller-fioreze");
  assert.equal(Object.hasOwn(response.body.data.hotels[0], "branding_configured"), false);
});

test("listagem de unidades fica isolada aos hoteis autorizados", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const mullerCookie = await createSessionCookie(env);
  const auroraCookie = await createSessionCookie(env, AURORA_USER_ID);

  const muller = await json("/api/v1/admin/hotels", withCookie(mullerCookie));
  const aurora = await json("/api/v1/admin/hotels", withCookie(auroraCookie));

  assert.equal(muller.response.status, 200);
  assert.deepEqual(muller.body.data.hotels.map((hotel) => hotel.hotel_id), ["muller-fioreze"]);
  assert.deepEqual(aurora.body.data.hotels.map((hotel) => hotel.hotel_id), ["aurora-demo"]);
});

test("criacao de unidade valida slug, ignora hotel_id do cliente e registra auditoria", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const created = await json(
    "/api/v1/admin/hotels",
    withCookie(
      cookie,
      adminJson("POST", {
        hotel_id: "cliente-nao-manda",
        name: "Hotel Demo Sul",
        short_name: "Demo Sul",
        slug: "demo-sul",
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
        currency: "BRL",
      }),
    ),
  );
  const valid = await json(
    "/api/v1/admin/hotels",
    withCookie(
      cookie,
      adminJson("POST", {
        name: "Hotel Demo Norte",
        short_name: "Demo Norte",
        slug: "demo-norte",
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
        currency: "BRL",
      }),
    ),
  );

  assert.equal(created.response.status, 400);
  assert.equal(valid.response.status, 200);
  assert.equal(valid.body.data.hotel.hotel_id, "demo-norte");
  assert.equal(valid.body.data.hotel.status, "inactive");
  assert.equal(env.__data.adminAuditLog.at(-1).action, "hotel.create");
});

test("slug duplicado e slug reservado sao rejeitados", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const duplicate = await json(
    "/api/v1/admin/hotels",
    withCookie(cookie, adminJson("POST", unitPayload({ slug: "muller-fioreze" }))),
  );
  const reserved = await json("/api/v1/admin/hotels", withCookie(cookie, adminJson("POST", unitPayload({ slug: "admin" }))));

  assert.equal(duplicate.response.status, 409);
  assert.equal(reserved.response.status, 400);
});

test("usuario sem acesso ao hotel recebe resposta segura no detalhe", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env, AURORA_USER_ID);

  const detail = await json("/api/v1/admin/hotels/muller-fioreze", withCookie(cookie));

  assert.equal(detail.response.status, 401);
});

test("atualizacao geral rejeita campos desconhecidos e arquiva logicamente", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const unknown = await json(
    "/api/v1/admin/hotels/muller-fioreze",
    withCookie(cookie, adminJson("PATCH", { created_at: "2026-01-01T00:00:00.000Z" })),
  );
  const archived = await json(
    "/api/v1/admin/hotels/muller-fioreze",
    withCookie(cookie, adminJson("PATCH", { status: "archived" })),
  );

  assert.equal(unknown.response.status, 400);
  assert.equal(archived.response.status, 200);
  assert.equal(archived.body.data.hotel.status, "archived");
  assert.ok(env.__data.hotels.find((hotel) => hotel.id === "muller-fioreze").archived_at);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "hotel.update");
});

test("branding valida cores e midia ativa do hotel", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);
  env.__data.mediaAssets.push({
    id: "media-archived-demo",
    hotel_id: "muller-fioreze",
    module_key: null,
    storage_provider: "r2",
    object_key: "demo",
    public_url: "/media/media-archived-demo",
    status: "archived",
    created_at: "2026-07-04T00:00:00.000Z",
    updated_at: "2026-07-04T00:00:00.000Z",
  });

  const invalidColor = await json(
    "/api/v1/admin/hotels/muller-fioreze/branding",
    withCookie(cookie, adminJson("PATCH", { primary_color: "red" })),
  );
  const archivedMedia = await json(
    "/api/v1/admin/hotels/muller-fioreze/branding",
    withCookie(cookie, adminJson("PATCH", { logo_url: "media-archived-demo" })),
  );
  const valid = await json(
    "/api/v1/admin/hotels/muller-fioreze/branding",
    withCookie(cookie, adminJson("PATCH", { primary_color: "#123456", logo_url: "media-muller-logo" })),
  );

  assert.equal(invalidColor.response.status, 400);
  assert.equal(archivedMedia.response.status, 400);
  assert.equal(valid.response.status, 200);
  assert.equal(valid.body.data.branding.primary_color, "#123456");
  assert.equal(valid.body.data.branding.logo_url, "/assets/hotels/muller-fioreze/logo.png");
  assert.equal(env.__data.adminAuditLog.at(-1).action, "hotel.branding.update");
});

test("settings valida texto seguro, horarios, email e URLs", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const unsafe = await json(
    "/api/v1/admin/hotels/muller-fioreze/settings",
    withCookie(cookie, adminJson("PATCH", { "hosting.welcome_text": "<b>ola</b>" })),
  );
  const valid = await json(
    "/api/v1/admin/hotels/muller-fioreze/settings",
    withCookie(
      cookie,
      adminJson("PATCH", {
        "contact.city": "Gramado",
        "contact.email": "hotel@example.invalid",
        "contact.website": "https://example.invalid",
        "hosting.check_in": "14:00",
      }),
    ),
  );

  assert.equal(unsafe.response.status, 400);
  assert.equal(valid.response.status, 200);
  assert.equal(valid.body.data.settings["contact.city"], "Gramado");
  assert.equal(env.__data.adminAuditLog.at(-1).action, "hotel.settings.update");
});

test("modulos sao atualizados de forma idempotente sem excluir registros", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const updated = await json(
    "/api/v1/admin/hotels/muller-fioreze/modules",
    withCookie(
      cookie,
      adminJson("PATCH", {
        modules: [{ module_key: "spa", enabled: true, is_public: true, public_name: "Spa", navigation_label: "Spa", sort_order: 70 }],
      }),
    ),
  );

  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.modules.find((entry) => entry.module_key === "spa").enabled, true);
  assert.equal(env.__data.hotelModules.find((entry) => entry.hotel_id === "muller-fioreze" && entry.module_key === "spa").enabled, 1);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "hotel.modules.update");
});

test("navegacao cria, ordena e bloqueia URL insegura", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const unsafe = await json(
    "/api/v1/admin/hotels/muller-fioreze/navigation",
    withCookie(cookie, adminJson("POST", { module_key: "guest-portal", label: "X", path: "javascript:alert(1)" })),
  );
  const created = await json(
    "/api/v1/admin/hotels/muller-fioreze/navigation",
    withCookie(
      cookie,
      adminJson("POST", {
        module_key: "guest-portal",
        label: "Eventos",
        path: "/muller-fioreze/eventos",
        icon_key: "calendar",
        sort_order: 15,
        enabled: true,
        is_public: true,
      }),
    ),
  );
  const list = await json("/api/v1/admin/hotels/muller-fioreze/navigation", withCookie(cookie));

  assert.equal(unsafe.response.status, 400);
  assert.equal(created.response.status, 200);
  assert.equal(list.body.data.navigation.some((entry) => entry.label === "Eventos"), true);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "hotel.navigation.create");
});

test("arquivamento de navegacao desabilita sem apagar", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);
  const item = env.__data.navigation.find((entry) => entry.hotel_id === "muller-fioreze");

  const archived = await json(
    `/api/v1/admin/hotels/muller-fioreze/navigation/${item.id}`,
    withCookie(cookie, adminJson("DELETE", {})),
  );

  assert.equal(archived.response.status, 200);
  assert.equal(env.__data.navigation.find((entry) => entry.id === item.id).enabled, 0);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "hotel.navigation.archive");
});

test("rotas da Central carregam shells sem quebrar admin, media e room-service", async () => {
  const { fetch, json } = createWorkerTestContext();
  const unitsRedirect = await fetch("/admin/portais/unidades", { redirect: "manual" });
  const units = await fetch("/admin/portais/unidades/", { redirect: "manual" });
  const unitsNested = await fetch("/admin/portais/unidades/muller-fioreze/", { redirect: "manual" });
  const media = await fetch("/admin/portais/media/", { redirect: "manual" });
  const roomService = await fetch("/admin/room-service/", { redirect: "manual" });
  const products = await json("/api/v1/public/hotels/muller-fioreze/room-service/products");

  assert.equal(unitsRedirect.status, 308);
  assert.equal(new URL(unitsRedirect.headers.get("location")).pathname, "/admin/portais/unidades/");
  assert.equal(units.status, 200);
  assert.equal(unitsNested.status, 200);
  assert.match(await units.text(), /unitsManager/);
  assert.equal(media.status, 200);
  assert.equal(roomService.status, 200);
  assert.equal(products.response.status, 200);
});

function unitPayload(overrides = {}) {
  return {
    name: "Hotel Demo",
    short_name: "Demo",
    slug: "hotel-demo",
    timezone: "America/Sao_Paulo",
    locale: "pt-BR",
    currency: "BRL",
    ...overrides,
  };
}

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

function grantPermissions(env, permissions = UNIT_PERMISSIONS) {
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
