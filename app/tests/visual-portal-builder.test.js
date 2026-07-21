import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  archiveAdminVisualPortal,
  createAdminVisualPortal,
  createAdminVisualPortalTemplate,
  getAdminVisualPortal,
  listAdminVisualPortalVersions,
  publishAdminVisualPortal,
  updateAdminVisualPortal,
} from "../src/modules/admin/visual-portals.js";
import { renderVisualPortalPage, serveVisualPortal } from "../src/modules/visual-portals/public.js";
import {
  collectVisualPortalMediaIds,
  createBlankVisualPortalDocument,
  normalizeVisualPortalDocument,
  visualPortalTemplateDocument,
} from "../src/services/visual-portal-document.js";
import {
  deleteVisualBlock,
  duplicateVisualBlock,
  moveVisualBlock,
  reorderVisualBlock,
} from "../public/js/modules/admin/portal-builder-state.js";

const NOW = "2026-07-21T14:00:00.000Z";
const SESSION = {
  user: { id: "user-admin", display_name: "Administradora ficticia" },
  hotel_ids: ["muller-fioreze"],
  hotels: [{ hotel_id: "muller-fioreze", access_level: "owner" }],
  permissions: ["portals.hotels.read", "portals.hotels.settings"],
  password_change_required: false,
};

test("migration 0025 cria portais, versoes, modelos e indices multi-hotel", () => {
  const source = fs.readFileSync("migrations/0025_visual_portal_builder.sql", "utf8").toLowerCase();
  assert.match(source, /create table if not exists visual_portals/);
  assert.match(source, /create table if not exists visual_portal_versions/);
  assert.match(source, /create table if not exists visual_portal_templates/);
  assert.match(source, /unique \(hotel_id, slug\)/);
  assert.match(source, /check \(json_valid\(draft_document_json\)\)/);
  assert.match(source, /idx_visual_portals_hotel_module_status/);
  assert.match(source, /idx_visual_portal_templates_hotel_module_status/);
  assert.doesNotMatch(source, /insert into visual_portals|insert into visual_portal_templates/);
});

test("documento visual normaliza estilos responsivos e referencias de midia", () => {
  const document = normalizeVisualPortalDocument({
    schema_version: 1,
    settings: { primary_color: "#A8513E", font_family: "Inter, system-ui, sans-serif" },
    blocks: [
      {
        id: "capa-principal",
        type: "hero",
        content: { title: "Portal de teste", media_asset_id: "media_12345678", button_text: "Abrir", button_url: "/servicos" },
        styles: { base: { width: "wide", alignment: "center" }, desktop: { min_height: 620 }, mobile: { min_height: 420 } },
        visibility: { desktop: true, mobile: true },
      },
      {
        id: "galeria-principal",
        type: "gallery",
        content: { media_asset_ids: ["media_12345678", "media_87654321", "media_12345678"] },
        styles: { base: { columns: 3 }, desktop: {}, mobile: { columns: 1 } },
      },
    ],
  });

  assert.equal(document.settings.primary_color, "#a8513e");
  assert.equal(document.blocks[0].styles.desktop.min_height, 620);
  assert.deepEqual(collectVisualPortalMediaIds(document), ["media_12345678", "media_87654321"]);
});

test("documento visual rejeita codigo, links e referencias fora da lista permitida", () => {
  const blank = createBlankVisualPortalDocument();
  const unsafe = structuredClone(blank);
  unsafe.blocks.push({
    id: "botao-inseguro",
    type: "button",
    content: { text: "Executar", url: "javascript:alert(1)" },
    styles: { base: {}, desktop: {}, mobile: {} },
  });
  assert.throws(() => normalizeVisualPortalDocument(unsafe), /endereco de link.*nao e permitido/i);

  const invalidMedia = structuredClone(blank);
  invalidMedia.blocks[0].content.media_asset_id = "arquivo-fora-da-biblioteca";
  assert.throws(() => normalizeVisualPortalDocument(invalidMedia), /referencia de midia invalida/i);
});

test("modelos internos oferecem pagina completa, servico e tela livre", () => {
  const showcase = visualPortalTemplateDocument("showcase", { primary_color: "#17594a", font_family: "system-ui" });
  const service = visualPortalTemplateDocument("service");
  const blank = visualPortalTemplateDocument("blank");
  assert.ok(showcase.blocks.some((block) => block.type === "feature-grid"));
  assert.equal(showcase.blocks[0].styles.mobile.heading_size, 48);
  assert.equal(showcase.blocks.find((block) => block.type === "feature-grid").styles.mobile.columns, 1);
  assert.ok(service.blocks.some((block) => block.type === "button"));
  assert.equal(blank.blocks.length, 0);
});

test("modelos modernos incluem loja digital, campanha e agenda", () => {
  const store = visualPortalTemplateDocument("digital-store");
  const campaign = visualPortalTemplateDocument("campaign");
  const events = visualPortalTemplateDocument("events");
  assert.ok(store.blocks.some((block) => block.id === "vitrine" && block.type === "feature-grid"));
  assert.equal(store.blocks.find((block) => block.id === "vitrine").styles.base.border_radius, 24);
  assert.ok(campaign.blocks.some((block) => block.id === "acao-campanha"));
  assert.ok(events.blocks.some((block) => block.id === "agenda"));
});

test("acoes de bloco movem, duplicam, reordenam e excluem o alvo correto", () => {
  const document = {
    blocks: [
      { id: "primeiro", type: "text", content: { text: "A" } },
      { id: "segundo", type: "text", content: { text: "B" } },
      { id: "terceiro", type: "text", content: { text: "C" } },
    ],
  };
  assert.equal(moveVisualBlock(document, "segundo", -1).changed, true);
  assert.deepEqual(document.blocks.map((block) => block.id), ["segundo", "primeiro", "terceiro"]);
  assert.equal(duplicateVisualBlock(document, "primeiro", "primeiro-copia").selectedId, "primeiro-copia");
  assert.deepEqual(document.blocks.map((block) => block.id), ["segundo", "primeiro", "primeiro-copia", "terceiro"]);
  assert.equal(reorderVisualBlock(document, "terceiro", 0).changed, true);
  assert.deepEqual(document.blocks.map((block) => block.id), ["terceiro", "segundo", "primeiro", "primeiro-copia"]);
  const deleted = deleteVisualBlock(document, "segundo");
  assert.equal(deleted.removed.id, "segundo");
  assert.deepEqual(document.blocks.map((block) => block.id), ["terceiro", "primeiro", "primeiro-copia"]);
});

test("fundo de pagina, posicao responsiva e incorporacao HTTPS sao normalizados", () => {
  const document = createBlankVisualPortalDocument();
  document.settings.background_media_asset_id = "media_background01";
  document.settings.background_overlay = 42;
  document.settings.background_position = "top";
  document.settings.background_fixed = true;
  document.blocks[0].styles.desktop.offset_x = 36;
  document.blocks[0].styles.mobile.offset_y = -24;
  document.blocks.push({
    id: "mapa-incorporado",
    type: "embed",
    content: { title: "Mapa", url: "https://www.google.com/maps/embed?pb=demo", aspect_ratio: "4:3", allow_fullscreen: true },
    styles: { base: { border_radius: 24 }, desktop: {}, mobile: {} },
    visibility: { desktop: true, mobile: true },
  });
  const normalized = normalizeVisualPortalDocument(document);
  assert.deepEqual(collectVisualPortalMediaIds(normalized), ["media_background01"]);
  assert.equal(normalized.blocks[0].styles.desktop.offset_x, 36);
  assert.equal(normalized.blocks[0].styles.mobile.offset_y, -24);
  assert.equal(normalized.blocks[1].content.aspect_ratio, "4:3");

  const media = new Map([["media_background01", { id: "media_background01", public_url: "/media/media_background01", mime_type: "video/mp4", alt_text: "" }]]);
  const html = renderVisualPortalPage({
    portal: { title: "Portal", hotel_name: "Hotel", hotel_slug: "hotel", module_key: "guest-portal", locale: "pt-BR" },
    document: normalized,
    media,
  });
  assert.match(html, /class="page-background is-fixed"/);
  assert.match(html, /<video muted loop autoplay playsinline/);
  assert.match(html, /class="block-inner embed-frame"/);
  assert.match(html, /sandbox="allow-scripts allow-forms allow-popups allow-presentation"/);
  assert.doesNotMatch(html, /allow-presentation allow-same-origin/);
  assert.match(html, /--desktop-offset-x:36px/);
});

test("incorporacao rejeita protocolos e destinos locais", () => {
  for (const url of ["javascript:alert(1)", "http://example.com/frame", "https://localhost/map", "https://192.168.1.10/frame", "https://[::1]/frame", "https://169.254.1.1/frame"]) {
    const document = createBlankVisualPortalDocument();
    document.blocks.push({ id: "embed-invalido", type: "embed", content: { url }, styles: { base: {}, desktop: {}, mobile: {} } });
    assert.throws(() => normalizeVisualPortalDocument(document), /incorporado.*nao e permitido|incorporado e invalido/i);
  }
});

test("tipografia responsiva e limitada e renderizada por dispositivo", () => {
  const document = createBlankVisualPortalDocument();
  document.blocks[0].styles.desktop.heading_size = 92;
  document.blocks[0].styles.desktop.width = "wide";
  document.blocks[0].styles.mobile.heading_size = 44;
  document.blocks[0].styles.mobile.text_size = 15;
  document.blocks[0].styles.mobile.width = "narrow";
  const normalized = normalizeVisualPortalDocument(document);
  const html = renderVisualPortalPage({
    portal: {
      title: "Portal responsivo",
      hotel_name: "Hotel ficticio",
      hotel_slug: "hotel-ficticio",
      module_key: "guest-portal",
      locale: "pt-BR",
    },
    document: normalized,
  });
  assert.match(html, /--desktop-heading-size:92px/);
  assert.match(html, /--desktop-width:1440px/);
  assert.match(html, /--mobile-heading-size:44px/);
  assert.match(html, /--mobile-text-size:15px/);
  assert.match(html, /--mobile-width:720px/);

  const invalid = structuredClone(document);
  invalid.blocks[0].styles.mobile.heading_size = 161;
  assert.throws(() => normalizeVisualPortalDocument(invalid), /valor visual fora do intervalo/i);
});

test("CRUD visual salva versoes, valida isolamento e publica renderizacao segura", async () => {
  const env = createSqliteEnv();
  const created = await createAdminVisualPortal({
    request: jsonRequest("POST", {
      hotel_id: "muller-fioreze",
      module_key: "guest-portal",
      slug: "experiencias",
      name: "Portal de experiencias",
      title: "Experiencias Fioreze",
      template_key: "showcase",
    }),
    env,
    session: SESSION,
  });
  assert.equal(created.portal.status, "draft");
  assert.equal(created.portal.draft_revision, 1);
  assert.equal(created.portal.public_url, "https://local.test/portal/muller-fioreze/experiencias");

  const document = structuredClone(created.portal.document);
  document.blocks.push({
    id: "imagem-hotel",
    type: "image",
    content: { media_asset_id: "media_12345678", alt_text: "Imagem ficticia", caption: "", fit: "cover" },
    styles: { base: { width: "wide", border_radius: 8 }, desktop: {}, mobile: {} },
    visibility: { desktop: true, mobile: true },
  });
  const updated = await updateAdminVisualPortal({
    request: jsonRequest("PATCH", { document, expected_revision: 1 }),
    env,
    session: SESSION,
    portalId: created.portal.id,
  });
  assert.equal(updated.portal.draft_revision, 2);
  assert.equal(updated.portal.has_unpublished_changes, true);

  const versions = await listAdminVisualPortalVersions({ env, session: SESSION, portalId: created.portal.id });
  assert.equal(versions.versions.length, 2);

  const published = await publishAdminVisualPortal({
    request: jsonRequest("POST", {}), env, session: SESSION, portalId: created.portal.id,
  });
  assert.equal(published.portal.status, "published");
  assert.equal(published.portal.published_revision, 2);
  assert.equal(published.portal.has_unpublished_changes, false);

  const response = await serveVisualPortal({ env, params: { hotel_slug: "muller-fioreze", portal_slug: "experiencias" } });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy") || "", /script-src 'none'/);
  assert.match(html, /Experiencias Fioreze/);
  assert.match(html, /\/media\/media_12345678/);
  assert.doesNotMatch(html, /<script/i);

  const otherSession = { ...SESSION, hotel_ids: ["aurora-demo"], hotels: [{ hotel_id: "aurora-demo" }] };
  await assert.rejects(
    () => getAdminVisualPortal({ request: jsonRequest("GET"), env, session: otherSession, portalId: created.portal.id }),
    (error) => error.status === 404,
  );

  await assert.rejects(
    () => createAdminVisualPortalTemplate({
      request: jsonRequest("POST", { hotel_id: "muller-fioreze", module_key: "emporio", name: "Modelo cruzado", source_portal_id: created.portal.id }),
      env,
      session: SESSION,
    }),
    (error) => error.status === 404,
  );

  await createAdminVisualPortalTemplate({
    request: jsonRequest("POST", { hotel_id: "muller-fioreze", module_key: "guest-portal", name: "Modelo da equipe", source_portal_id: created.portal.id }),
    env,
    session: SESSION,
  });
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS total FROM visual_portal_templates").get().total, 1);

  await archiveAdminVisualPortal({ request: jsonRequest("DELETE", {}), env, session: SESSION, portalId: created.portal.id });
  await assert.rejects(
    () => serveVisualPortal({ env, params: { hotel_slug: "muller-fioreze", portal_slug: "experiencias" } }),
    (error) => error.status === 404,
  );
});

test("renderer escapa textos e nunca transforma conteudo em script", () => {
  const document = createBlankVisualPortalDocument();
  document.blocks[0].content.title = '<img src=x onerror="alert(1)">';
  document.blocks[0].content.text = "<script>segredo()</script>";
  const html = renderVisualPortalPage({
    portal: {
      title: "Portal seguro",
      hotel_name: "Hotel ficticio",
      hotel_short_name: "Hotel",
      hotel_slug: "hotel-ficticio",
      module_key: "guest-portal",
      locale: "pt-BR",
      logo_url: "",
    },
    document,
    media: new Map(),
  });
  assert.doesNotMatch(html, /<script|<img src=x/i);
  assert.doesNotMatch(html, /onerror="/i);
  assert.match(html, /&lt;script&gt;segredo\(\)&lt;\/script&gt;/);
});

test("Central integra construtor visual e Worker-first preserva a rota publica", () => {
  const html = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const portals = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");
  const builder = fs.readFileSync("public/js/modules/admin/portal-builder.js", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/portal-builder.css", "utf8");
  const wrangler = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
  assert.match(html, /id="contentManager"/);
  assert.doesNotMatch(html, /data-content-type="(?:pages|custom_pages|events|information)"/);
  assert.doesNotMatch(html, /data-unit-tab="(?:modules|navigation)"/);
  assert.match(html, /portal-builder\.css/);
  assert.match(portals, /createVisualPortalBuilder/);
  assert.match(builder, /application\/x-fioreze-block-type/);
  assert.match(builder, /data-viewport="desktop"/);
  assert.match(builder, /data-viewport="mobile"/);
  assert.match(builder, /closest\("button\[data-viewport\]"\)/);
  assert.match(builder, /data-preview-viewport="desktop"/);
  assert.match(builder, /data-preview-viewport="mobile"/);
  assert.match(builder, /data-media-target="page"/);
  assert.match(builder, /data-reset-position/);
  assert.match(builder, /type === "embed"/);
  assert.match(builder, /visual-portal-templates/);
  assert.match(builder, /fitCanvas\(true\)/);
  assert.match(css, /grid-template-columns:\s*286px minmax\(0, 1fr\) 318px/);
  assert.match(css, /\.vp-live-preview\[data-viewport="mobile"\]/);
  assert.doesNotMatch(portals, /\["modulos", "Áreas"/);
  assert.doesNotMatch(portals, /\["navegacao", "Navegação"/);
  assert.match(portals, /module_key: "guest-portal"/);
  assert.ok(wrangler.assets.run_worker_first.includes("/portal/*"));
});

function createSqliteEnv() {
  const raw = new DatabaseSync(":memory:");
  raw.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE hotels (id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT, short_name TEXT, timezone TEXT, locale TEXT, status TEXT, archived_at TEXT);
    CREATE TABLE modules (module_key TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE hotel_modules (hotel_id TEXT, module_key TEXT, enabled INTEGER, is_public INTEGER, PRIMARY KEY (hotel_id, module_key));
    CREATE TABLE hotel_branding (hotel_id TEXT PRIMARY KEY, logo_url TEXT, icon_url TEXT, primary_color TEXT, secondary_color TEXT, accent_color TEXT, background_color TEXT, text_color TEXT, font_family TEXT);
    CREATE TABLE admin_users (id TEXT PRIMARY KEY, display_name TEXT);
    CREATE TABLE admin_audit_log (id TEXT PRIMARY KEY, hotel_id TEXT, module_key TEXT, actor_user_id TEXT, action TEXT, entity_type TEXT, entity_id TEXT, metadata_json TEXT, created_at TEXT);
    CREATE TABLE media_assets (id TEXT PRIMARY KEY, hotel_id TEXT, public_url TEXT, alt_text TEXT, mime_type TEXT, status TEXT);
    INSERT INTO hotels VALUES ('muller-fioreze','muller-fioreze','Muller ficticio','Muller','America/Sao_Paulo','pt-BR','active',NULL);
    INSERT INTO hotels VALUES ('aurora-demo','aurora-demo','Aurora ficticio','Aurora','America/Sao_Paulo','pt-BR','active',NULL);
    INSERT INTO modules VALUES ('guest-portal','Portal do Hospede'), ('emporio','Emporio'), ('room-service','Room Service'), ('admin','Admin');
    INSERT INTO hotel_modules VALUES ('muller-fioreze','guest-portal',1,1), ('muller-fioreze','emporio',1,1), ('muller-fioreze','room-service',1,1), ('muller-fioreze','admin',1,0);
    INSERT INTO hotel_branding VALUES ('muller-fioreze','/assets/hotels/muller-fioreze/logo.png',NULL,'#17594a','#f2b84b','#8c3d2f','#f7f4ee','#202124','system-ui');
    INSERT INTO admin_users VALUES ('user-admin','Administradora ficticia');
    INSERT INTO media_assets VALUES ('media_12345678','muller-fioreze','/media/media_12345678','Imagem ficticia','image/webp','active');
  `);
  raw.exec(fs.readFileSync("migrations/0025_visual_portal_builder.sql", "utf8"));
  return { DB: new SqliteD1(raw), ENVIRONMENT: "test" };
}

class SqliteD1 {
  constructor(raw) {
    this.raw = raw;
  }

  prepare(sql) {
    return new SqliteD1Statement(this.raw, sql);
  }

  async batch(statements) {
    this.raw.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.raw.exec("COMMIT");
      return results;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }
}

class SqliteD1Statement {
  constructor(raw, sql, params = []) {
    this.raw = raw;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new SqliteD1Statement(this.raw, this.sql, params);
  }

  async first() {
    return this.raw.prepare(this.sql).get(...this.params) || null;
  }

  async all() {
    return { results: this.raw.prepare(this.sql).all(...this.params) };
  }

  async run() {
    const result = this.raw.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(result.changes || 0) } };
  }
}

function jsonRequest(method, body = undefined) {
  return new Request("https://local.test/api/v1/admin/visual-portals", {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      origin: "https://local.test",
      "x-fioreze-admin-action": "erp-admin",
      "x-fioreze-test-now": NOW,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
