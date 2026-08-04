import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { internalsForTests } from "../public/js/modules/spa/index.js";
import { ADMIN_ORIGIN, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));

test("Spa publico exige modulo habilitado e compartilha o mesmo catalogo entre unidades", async () => {
  const context = createWorkerTestContext();
  const blocked = await context.json("/api/v1/public/hotels/muller-fioreze/spa/services");
  assert.equal(blocked.response.status, 404);

  enableSpa(context.env, "muller-fioreze");
  enableSpa(context.env, "aurora-demo");
  const muller = await context.json("/api/v1/public/hotels/muller-fioreze/spa/services");
  const aurora = await context.json("/api/v1/public/hotels/aurora-demo/spa/services");

  assert.equal(muller.response.status, 200);
  assert.equal(aurora.response.status, 200);
  assert.equal(muller.body.data.hotel_id, "muller-fioreze");
  assert.equal(aurora.body.data.hotel_id, "aurora-demo");
  assert.equal(muller.body.data.profile.title, "Spa Zena");
  assert.match(muller.body.data.profile.location_text, /Müller & Fioreze/);
  assert.equal(muller.body.data.profile.location_text, aurora.body.data.profile.location_text);
  assert.deepEqual(
    muller.body.data.services.map((entry) => entry.id),
    aurora.body.data.services.map((entry) => entry.id),
  );
  assert.equal(muller.body.data.services[0].name, "Massagem Relaxante Ficticia");
});

test("administracao do Spa exige sessao e atualiza perfil global com auditoria", async () => {
  const context = createWorkerTestContext();
  const denied = await context.json("/api/v1/admin/spa/catalog");
  assert.equal(denied.response.status, 401);

  const cookie = await createSessionCookie(context.env);
  const updated = await context.json(
    "/api/v1/admin/spa/profile",
    adminJson(cookie, "PATCH", {
      title: "Spa Compartilhado",
      subtitle: "Bem-estar ficticio.",
      intro_text: "Apresentacao ficticia.",
      about_text: "Texto institucional ficticio.",
      booking_title: "Consulte a agenda",
      booking_text: "Converse com a equipe.",
      whatsapp_number: "5554999999999",
      whatsapp_service_message: "Hotel {hotel_name}, servico {service_name}.",
      whatsapp_general_message: "Hotel {hotel_name}.",
      hours_text: "das 9h as 20h",
      usage_rules: ["Regra ficticia atualizada."],
      logo_media_asset_id: "media-muller-logo",
      status: "active",
    }),
  );

  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.profile.title, "Spa Compartilhado");
  assert.equal(updated.body.data.profile.logo_url, "/assets/hotels/muller-fioreze/logo.png");
  assert.deepEqual(updated.body.data.profile.usage_rules, ["Regra ficticia atualizada."]);
  assert.ok(context.env.__data.adminAuditLog.some((entry) => entry.action === "spa.profile.updated"));
});

test("editor cadastra e arquiva servico compartilhado sem tocar em pedidos ou impressao", async () => {
  const context = createWorkerTestContext();
  const cookie = await createSessionCookie(context.env);
  const orderCount = context.env.__data.orders.length;
  const itemCount = context.env.__data.orderItems.length;
  const printCount = context.env.__data.printEvents.length;

  const created = await context.json(
    "/api/v1/admin/spa/services",
    adminJson(cookie, "POST", {
      name: "Ritual Ficticio",
      description: "Servico usado somente em teste.",
      duration_label: "45 minutos",
      duration_minutes: 45,
      price_cents: 19900,
      currency: "BRL",
      media_asset_id: "media-muller-logo",
      status: "active",
      sort_order: 30,
    }),
  );
  const archived = await context.json(
    `/api/v1/admin/spa/services/${encodeURIComponent(created.body.data.service.id)}`,
    adminJson(cookie, "PATCH", { status: "archived" }),
  );

  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.service.image_url, "/assets/hotels/muller-fioreze/logo.png");
  assert.equal(archived.response.status, 200);
  assert.equal(archived.body.data.service.status, "archived");
  assert.equal(context.env.__data.orders.length, orderCount);
  assert.equal(context.env.__data.orderItems.length, itemCount);
  assert.equal(context.env.__data.printEvents.length, printCount);
  assert.ok(context.env.__data.adminAuditLog.some((entry) => entry.action === "spa.service.created"));
  assert.ok(context.env.__data.adminAuditLog.some((entry) => entry.action === "spa.service.updated"));
});

test("frontend do Spa replica o layout legado sem loader ou Apps Script", () => {
  const source = fs.readFileSync(`${APP_ROOT}/public/js/modules/spa/index.js`, "utf8");
  const css = fs.readFileSync(`${APP_ROOT}/public/css/modules/spa/spa.css`, "utf8");
  const loader = fs.readFileSync(`${APP_ROOT}/public/js/core/module-loader.js`, "utf8");
  const shell = fs.readFileSync(`${APP_ROOT}/public/js/core/app.js`, "utf8");
  const editor = fs.readFileSync(`${APP_ROOT}/public/js/modules/admin/guest-portal-editor.js`, "utf8");

  assert.match(loader, /spa: \(\) => import\("\.\.\/modules\/spa\/index\.js"\)/);
  assert.match(source, /class="spa-zena-layout"/);
  assert.match(source, /class="spa-zena-booking"/);
  assert.match(source, /data-spa-search/);
  assert.match(source, /data-spa-detail/);
  assert.match(source, /data-spa-about-modal/);
  assert.match(source, /data-spa-about-logo/);
  assert.doesNotMatch(source, /class="spa-zena-brand"/);
  assert.doesNotMatch(source, /data-spa-logo/);
  assert.match(source, /data-spa-location/);
  assert.match(source, /https:\/\/wa\.me\//);
  assert.doesNotMatch(source, /script\.google\.com|Apps Script|data-spa-loading|Preparando o catalogo/i);
  assert.match(css, /font-family: "EB Garamond"/);
  assert.match(css, /grid-template-columns: 340px minmax\(0, 1fr\)/);
  assert.match(css, /\.spa-zena-service-media img/);
  assert.match(css, /\.spa-zena-about-logo\s*\{[\s\S]*?margin:\s*0 auto 24px;/);
  assert.doesNotMatch(css, /\.spa-zena-monogram\s*\{/);
  assert.match(css, /\.spa-zena-location/);
  assert.match(css, /@media \(max-width: 959px\)/);
  assert.match(shell, /spa:\s*"spa"/);
  assert.match(shell, /class="app-top-title"/);
  assert.match(editor, /data-guest-editor-tab="spa"|activeTab === "spa"/);
  assert.match(editor, /\/api\/v1\/admin\/spa\/catalog/);
  assert.match(editor, /data-spa-action="delete-service"/);
  assert.match(editor, /archiveSpaService/);
});

test("migration do Spa cria conteudo compartilhado e registra 13 servicos sem endpoint legado", () => {
  const migration = fs.readFileSync(`${APP_ROOT}/migrations/0030_spa_zena_shared_catalog.sql`, "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS spa_shared_profile/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS spa_shared_services/);
  assert.match(migration, /hotel_id, module_key, storage_provider/);
  assert.match(migration, /'spa-zena-spa-day-revigorante'/);
  assert.match(migration, /'media-spa-zena-logo'/);
  assert.doesNotMatch(migration, /script\.google\.com|apps script/i);
  assert.equal((migration.match(/'spa-zena-[a-z-]+',\n    '/g) || []).length, 13);
});

test("normalizacao visual do Spa preserva busca sem acentos e preco brasileiro", () => {
  assert.equal(internalsForTests.normalizeSearch("Terapia com Pedras Quentes"), "terapia com pedras quentes");
  assert.equal(internalsForTests.normalizeSearch("Esfoliação"), "esfoliacao");
  assert.match(internalsForTests.formatCardTitle("Massagem Relaxante"), /Massagem[\s\S]*Relaxante/);
  assert.match(internalsForTests.formatPrice(26500, "BRL"), /265,00/);
});

function enableSpa(env, hotelId) {
  const module = env.__data.hotelModules.find(
    (entry) => entry.hotel_id === hotelId && entry.module_key === "spa",
  );
  module.enabled = 1;
  module.is_public = 1;
}

function adminJson(cookie, method, body) {
  return withCookie(cookie, {
    method,
    headers: {
      origin: ADMIN_ORIGIN,
      "content-type": "application/json",
      "x-fioreze-admin-action": "erp-admin",
      "x-fioreze-test-now": "2026-07-12T12:00:00.000Z",
    },
    body: JSON.stringify(body),
  });
}
