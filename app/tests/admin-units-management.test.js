import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_ORIGIN, AURORA_USER_ID, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

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
  assert.equal(valid.body.data.hotel.access_pending, false);
  assert.deepEqual(
    env.__data.adminHotelAccess
      .filter((entry) => entry.hotel_id === "demo-norte")
      .map((entry) => `${entry.user_id}:${entry.access_level}`),
    ["user-demo-admin:manager"],
  );
  assert.equal(env.__data.adminAuditLog.at(-1).action, "hotel.create");
});

test("criador acessa nova unidade imediatamente sem liberar outros usuarios", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const creatorCookie = await createSessionCookie(env);

  const created = await json("/api/v1/admin/hotels", withCookie(creatorCookie, adminJson("POST", unitPayload({ slug: "demo-serra" }))));
  const freshCreatorCookie = await createSessionCookie(env);
  const otherCookie = await createSessionCookie(env, AURORA_USER_ID);
  const list = await json("/api/v1/admin/hotels", withCookie(freshCreatorCookie));
  const detail = await json("/api/v1/admin/hotels/demo-serra", withCookie(freshCreatorCookie));
  const branding = await json(
    "/api/v1/admin/hotels/demo-serra/branding",
    withCookie(freshCreatorCookie, adminJson("PATCH", { primary_color: "#334455" })),
  );
  const settings = await json(
    "/api/v1/admin/hotels/demo-serra/settings",
    withCookie(freshCreatorCookie, adminJson("PATCH", { "contact.city": "Cidade Ficticia" })),
  );
  const modules = await json(
    "/api/v1/admin/hotels/demo-serra/modules",
    withCookie(freshCreatorCookie, adminJson("PATCH", { modules: [{ module_key: "guest-portal", enabled: true }] })),
  );
  const navigation = await json(
    "/api/v1/admin/hotels/demo-serra/navigation",
    withCookie(freshCreatorCookie, adminJson("POST", { module_key: "guest-portal", label: "Inicio", path: "/demo-serra" })),
  );
  const otherDetail = await json("/api/v1/admin/hotels/demo-serra", withCookie(otherCookie));

  assert.equal(created.response.status, 200);
  assert.equal(list.body.data.hotels.some((hotel) => hotel.hotel_id === "demo-serra"), true);
  assert.equal(detail.response.status, 200);
  assert.equal(branding.response.status, 200);
  assert.equal(settings.response.status, 200);
  assert.equal(modules.response.status, 200);
  assert.equal(navigation.response.status, 200);
  assert.equal(otherDetail.response.status, 401);
  assert.equal(env.__data.adminHotelAccess.filter((entry) => entry.hotel_id === "demo-serra").length, 1);
});

test("falha atomica na criacao nao deixa unidade orfa", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);
  env.DB.failNextAdminHotelAccessInsert = true;

  const failed = await json("/api/v1/admin/hotels", withCookie(cookie, adminJson("POST", unitPayload({ slug: "demo-falha" }))));

  assert.equal(failed.response.status, 500);
  assert.equal(env.__data.hotels.some((hotel) => hotel.id === "demo-falha"), false);
  assert.equal(env.__data.branding.some((branding) => branding.hotel_id === "demo-falha"), false);
  assert.equal(env.__data.adminHotelAccess.some((access) => access.hotel_id === "demo-falha"), false);
  assert.equal(env.__data.adminAuditLog.some((entry) => entry.entity_id === "demo-falha"), false);
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

test("branding aceita video somente como capa do portal", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);
  env.__data.mediaAssets.push(
    {
      id: "media-muller-cover-video",
      hotel_id: "muller-fioreze",
      module_key: "guest-portal",
      storage_provider: "r2",
      object_key: "hotels/muller-fioreze/guest-portal/2026/07/capa.mp4",
      public_url: "/media/media-muller-cover-video",
      mime_type: "video/mp4",
      status: "active",
    },
    {
      id: "media-muller-document",
      hotel_id: "muller-fioreze",
      module_key: "guest-portal",
      storage_provider: "r2",
      object_key: "hotels/muller-fioreze/guest-portal/2026/07/arquivo.pdf",
      public_url: "/media/media-muller-document",
      mime_type: "application/pdf",
      status: "active",
    },
  );

  const cover = await json(
    "/api/v1/admin/hotels/muller-fioreze/branding",
    withCookie(cookie, adminJson("PATCH", { cover_image_url: "media-muller-cover-video" })),
  );
  const videoAsLogo = await json(
    "/api/v1/admin/hotels/muller-fioreze/branding",
    withCookie(cookie, adminJson("PATCH", { logo_url: "media-muller-cover-video" })),
  );
  const documentAsCover = await json(
    "/api/v1/admin/hotels/muller-fioreze/branding",
    withCookie(cookie, adminJson("PATCH", { cover_image_url: "media-muller-document" })),
  );

  assert.equal(cover.response.status, 200);
  assert.equal(cover.body.data.branding.cover_image_url, "/media/media-muller-cover-video");
  assert.equal(cover.body.data.branding.cover_media_type, "video");
  assert.equal(videoAsLogo.response.status, 400);
  assert.equal(documentAsCover.response.status, 400);
});

test("branding faz round-trip por public_url e remove referencias sem excluir midia", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);
  env.__data.mediaAssets.push({
    id: "media-aurora-private",
    hotel_id: "aurora-demo",
    module_key: null,
    storage_provider: "r2",
    object_key: "hotels/aurora-demo/shared/2026/07/private.png",
    public_url: "/media/media-aurora-private",
    alt_text: "Imagem de outro hotel",
    mime_type: "image/png",
    status: "active",
    created_at: "2026-07-04T00:00:00.000Z",
    updated_at: "2026-07-04T00:00:00.000Z",
  });

  const byId = await json(
    "/api/v1/admin/hotels/muller-fioreze/branding",
    withCookie(
      cookie,
      adminJson("PATCH", {
        logo_url: "media-muller-logo",
        icon_url: "media-muller-logo",
        horizontal_logo_url: "media-muller-logo",
        favicon_url: "media-muller-logo",
        cover_image_url: "media-muller-logo",
        social_image_url: "media-muller-logo",
      }),
    ),
  );
  const detailAfterId = await json("/api/v1/admin/hotels/muller-fioreze/branding", withCookie(cookie));
  const byPublicUrl = await json(
    "/api/v1/admin/hotels/muller-fioreze/branding",
    withCookie(cookie, adminJson("PATCH", { logo_url: detailAfterId.body.data.branding.logo_url })),
  );
  const otherHotel = await json(
    "/api/v1/admin/hotels/muller-fioreze/branding",
    withCookie(cookie, adminJson("PATCH", { logo_url: "media-aurora-private" })),
  );
  const arbitraryAssetPath = await json(
    "/api/v1/admin/hotels/muller-fioreze/branding",
    withCookie(cookie, adminJson("PATCH", { logo_url: "/assets/hotels/muller-fioreze/nao-registrado.png" })),
  );
  const removed = await json(
    "/api/v1/admin/hotels/muller-fioreze/branding",
    withCookie(
      cookie,
      adminJson("PATCH", {
        logo_url: "",
        icon_url: "",
        horizontal_logo_url: "",
        favicon_url: "",
        cover_image_url: "",
        social_image_url: "",
      }),
    ),
  );

  assert.equal(byId.response.status, 200);
  assert.equal(detailAfterId.body.data.branding.logo_url, "/assets/hotels/muller-fioreze/logo.png");
  assert.equal(byPublicUrl.response.status, 200);
  assert.equal(otherHotel.response.status, 400);
  assert.equal(arbitraryAssetPath.response.status, 400);
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.data.branding.logo_url, null);
  assert.equal(removed.body.data.branding.icon_url, null);
  assert.equal(removed.body.data.branding.horizontal_logo_url, null);
  assert.equal(removed.body.data.branding.favicon_url, null);
  assert.equal(removed.body.data.branding.cover_image_url, null);
  assert.equal(removed.body.data.branding.cover_media_type, null);
  assert.equal(removed.body.data.branding.social_image_url, null);
  assert.equal(env.__data.mediaAssets.find((asset) => asset.id === "media-muller-logo").status, "active");
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

test("settings aceita varios embeds seguros do Google Maps e rejeita conteudo inseguro", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);
  const maps = [
    "https://www.google.com/maps/embed?pb=ROTA_DEMO_1",
    "https://www.google.com.br/maps/embed?pb=ROTA_DEMO_2",
  ];

  const valid = await json(
    "/api/v1/admin/hotels/muller-fioreze/settings",
    withCookie(cookie, adminJson("PATCH", { "contact.maps_embed_urls": maps })),
  );
  const wrongHost = await json(
    "/api/v1/admin/hotels/muller-fioreze/settings",
    withCookie(cookie, adminJson("PATCH", { "contact.maps_embed_urls": ["https://example.invalid/maps/embed?pb=DEMO"] })),
  );
  const apiKey = await json(
    "/api/v1/admin/hotels/muller-fioreze/settings",
    withCookie(cookie, adminJson("PATCH", { "contact.maps_embed_urls": ["https://www.google.com/maps/embed?key=CHAVE_DEMO"] })),
  );

  assert.equal(valid.response.status, 200);
  assert.deepEqual(valid.body.data.settings["contact.maps_embed_urls"], maps);
  assert.equal(wrongHost.response.status, 400);
  assert.equal(apiKey.response.status, 400);
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

test("navegacao aceita PATCH parcial e audita somente campos alterados", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);
  const item = env.__data.navigation.find((entry) => entry.hotel_id === "muller-fioreze" && entry.module_key === "guest-portal");
  const otherHotelItem = env.__data.navigation.find((entry) => entry.hotel_id === "aurora-demo");

  const label = await json(
    `/api/v1/admin/hotels/muller-fioreze/navigation/${item.id}`,
    withCookie(cookie, adminJson("PATCH", { label: "Boas-vindas" })),
  );
  const path = await json(
    `/api/v1/admin/hotels/muller-fioreze/navigation/${item.id}`,
    withCookie(cookie, adminJson("PATCH", { path: "/muller-fioreze/boas-vindas" })),
  );
  const order = await json(
    `/api/v1/admin/hotels/muller-fioreze/navigation/${item.id}`,
    withCookie(cookie, adminJson("PATCH", { sort_order: 88 })),
  );
  const partial = await json(
    `/api/v1/admin/hotels/muller-fioreze/navigation/${item.id}`,
    withCookie(cookie, adminJson("PATCH", { enabled: false })),
  );
  const unknown = await json(
    `/api/v1/admin/hotels/muller-fioreze/navigation/${item.id}`,
    withCookie(cookie, adminJson("PATCH", { hotel_id: "muller-fioreze" })),
  );
  const missingModule = await json(
    `/api/v1/admin/hotels/muller-fioreze/navigation/${item.id}`,
    withCookie(cookie, adminJson("PATCH", { module_key: "modulo-inexistente" })),
  );
  const unsafe = await json(
    `/api/v1/admin/hotels/muller-fioreze/navigation/${item.id}`,
    withCookie(cookie, adminJson("PATCH", { path: "javascript:alert(1)" })),
  );
  const otherHotel = await json(
    `/api/v1/admin/hotels/muller-fioreze/navigation/${otherHotelItem.id}`,
    withCookie(cookie, adminJson("PATCH", { label: "Nao pode" })),
  );

  assert.equal(label.response.status, 200);
  assert.equal(path.response.status, 200);
  assert.equal(order.response.status, 200);
  assert.equal(partial.response.status, 200);
  assert.equal(partial.body.data.item.enabled, false);
  assert.equal(unknown.response.status, 400);
  assert.equal(missingModule.response.status, 400);
  assert.equal(unsafe.response.status, 400);
  assert.equal(otherHotel.response.status, 404);
  const lastAudit = env.__data.adminAuditLog.at(-1);
  assert.equal(lastAudit.action, "hotel.navigation.update");
  assert.deepEqual(JSON.parse(lastAudit.metadata_json).changed_fields, ["enabled"]);
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

test("rotas da Central carregam shells sem quebrar admin, media e ERP Room Service", async () => {
  const { fetch, json } = createWorkerTestContext();
  const unitsRedirect = await fetch("/admin/portais/unidades", { redirect: "manual" });
  const units = await fetch("/admin/portais/unidades/", { redirect: "manual" });
  const unitsNested = await fetch("/admin/portais/unidades/muller-fioreze/", { redirect: "manual" });
  const media = await fetch("/admin/portais/media/", { redirect: "manual" });
  const roomService = await fetch("/erp/room-service/", { redirect: "manual" });
  const oldRoomService = await fetch("/admin/room-service/", { redirect: "manual" });
  const products = await json("/api/v1/public/hotels/muller-fioreze/room-service/products");

  assert.equal(unitsRedirect.status, 308);
  assert.equal(new URL(unitsRedirect.headers.get("location")).pathname, "/admin/portais/unidades/");
  assert.equal(units.status, 200);
  assert.equal(unitsNested.status, 200);
  assert.match(await units.text(), /unitsManager/);
  assert.equal(media.status, 200);
  assert.equal(oldRoomService.status, 308);
  assert.equal(new URL(oldRoomService.headers.get("location")).pathname, "/erp/room-service/");
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
