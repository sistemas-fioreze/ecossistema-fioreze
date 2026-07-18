import assert from "node:assert/strict";
import test from "node:test";

import {
  createHotelInformation,
  createPortalEvent,
  createPortalPage,
  createPortalSection,
  getPortalPage,
  listAdminAudit,
  listPortalContent,
  updatePortalPage,
} from "../src/modules/admin/portal-content.js";

const NOW = "2026-07-13T15:00:00.000Z";

function session(hotels = ["muller-fioreze"]) {
  return {
    user: { id: "admin-user-1" },
    hotel_ids: hotels,
    hotels: hotels.map((hotel_id) => ({ hotel_id })),
    permissions: ["portals.hotels.read", "portals.hotels.settings", "admin.audit.read"],
    password_change_required: false,
  };
}

function request(body) {
  return new Request("https://local.test/api/v1/admin/portal", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fioreze-admin-action": "erp-admin",
      "x-fioreze-test-now": NOW,
    },
    body: JSON.stringify(body),
  });
}

test("conteudos administrativos sao isolados por hotel", async () => {
  const env = createEnv();
  const result = await listPortalContent({
    env,
    session: session(),
    url: new URL("https://local.test/api/v1/admin/portal/content?hotel_id=muller-fioreze"),
  });
  assert.equal(result.hotel_id, "muller-fioreze");
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].title, "Boas-vindas");
  assert.equal(result.events.length, 0);
  assert.equal(result.information.length, 1);
  await assert.rejects(
    () => listPortalContent({
      env,
      session: session(),
      url: new URL("https://local.test/api/v1/admin/portal/content?hotel_id=aurora-demo"),
    }),
    (error) => error?.code === "unauthorized",
  );
});

test("pagina e secao sao criadas atomicamente com auditoria", async () => {
  const env = createEnv();
  const created = await createPortalPage({
    request: request({ hotel_id: "muller-fioreze", slug: "servicos", title: "Servicos", summary: "Conheca os servicos", status: "draft", sort_order: 20 }),
    env,
    session: session(),
  });
  assert.equal(created.page.hotel_id, "muller-fioreze");
  const section = await createPortalSection({
    request: request({ section_key: "recepcao", title: "Recepcao", body: "Atendimento em horario informado.", sort_order: 10 }),
    env,
    session: session(),
    pageId: created.page.id,
  });
  assert.equal(section.section.page_id, created.page.id);
  assert.deepEqual(section.section.settings, {});
  const detail = await getPortalPage({ env, session: session(), pageId: created.page.id });
  assert.equal(detail.sections.length, 1);
  assert.equal(env.__data.audit.length, 2);
  assert.deepEqual(env.__data.audit.map((entry) => entry.action), ["portal-page.create", "portal-section.create"]);
});

test("arquivamento de pagina preserva registro e marca archived_at", async () => {
  const env = createEnv();
  const updated = await updatePortalPage({
    request: request({ slug: "boas-vindas", title: "Boas-vindas", summary: "Conteudo institucional", status: "archived", sort_order: 10 }),
    env,
    session: session(),
    pageId: "page-muller",
  });
  assert.equal(updated.page.status, "archived");
  assert.equal(updated.page.archived_at, NOW);
  assert.equal(env.__data.pages.length, 1);
});

test("eventos e informacoes usam datas normalizadas e hotel autorizado", async () => {
  const env = createEnv();
  const event = await createPortalEvent({
    request: request({ hotel_id: "muller-fioreze", title: "Encontro cultural", summary: "Programacao especial", starts_at: "2026-07-20T18:00:00-03:00", ends_at: "2026-07-20T20:00:00-03:00", timezone: "America/Sao_Paulo", status: "published", media_asset_id: "media-event-muller" }),
    env,
    session: session(),
  });
  assert.equal(event.event.starts_at, "2026-07-20T21:00:00.000Z");
  assert.equal(event.event.media_asset_id, "media-event-muller");
  assert.equal(event.event.image_url, "/media/media-event-muller");
  const information = await createHotelInformation({
    request: request({ hotel_id: "muller-fioreze", info_key: "estacionamento", title: "Estacionamento", body: "Consulte a recepcao.", is_public: true, sort_order: 30 }),
    env,
    session: session(),
  });
  assert.equal(information.information.is_public, true);
  assert.equal(env.__data.audit.length, 2);
});

test("evento rejeita imagem de outra unidade", async () => {
  const env = createEnv();
  env.__data.mediaAssets.push({ id: "media-event-aurora", hotel_id: "aurora-demo", public_url: "/media/media-event-aurora", mime_type: "image/jpeg", status: "active" });
  await assert.rejects(
    () => createPortalEvent({
      request: request({ hotel_id: "muller-fioreze", title: "Evento ficticio", starts_at: "2026-07-20T18:00:00-03:00", timezone: "America/Sao_Paulo", status: "published", media_asset_id: "media-event-aurora" }),
      env,
      session: session(),
    }),
    (error) => error?.code === "bad_request",
  );
});

test("auditoria retorna somente campos administrativos seguros", async () => {
  const env = createEnv();
  env.__data.audit.push({
    id: "audit-existing",
    hotel_id: "muller-fioreze",
    module_key: "guest-portal",
    actor_user_id: "admin-user-1",
    actor_name: "Gestor Exemplo",
    action: "portal-page.update",
    entity_type: "portal_page",
    entity_id: "page-muller",
    metadata_json: JSON.stringify({ status: "published" }),
    created_at: NOW,
  });
  const result = await listAdminAudit({
    env,
    session: session(),
    url: new URL("https://local.test/api/v1/admin/audit?hotel_id=muller-fioreze"),
  });
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].actor_name, "Gestor Exemplo");
  assert.deepEqual(result.entries[0].metadata, { status: "published" });
  assert.equal("metadata_json" in result.entries[0], true);
  assert.equal(result.entries[0].metadata_json, undefined);
  assert.equal("actor_user_id" in result.entries[0], false);
});

function createEnv() {
  const data = {
    pages: [{ id: "page-muller", hotel_id: "muller-fioreze", module_key: "guest-portal", slug: "boas-vindas", title: "Boas-vindas", summary: "Conteudo institucional", status: "published", sort_order: 10, created_at: NOW, updated_at: NOW, archived_at: null }],
    sections: [],
    events: [],
    mediaAssets: [{ id: "media-event-muller", hotel_id: "muller-fioreze", public_url: "/media/media-event-muller", alt_text: "Programacao cultural", mime_type: "image/jpeg", status: "active" }],
    information: [{ id: "info-muller", hotel_id: "muller-fioreze", info_key: "wifi", title: "Wi-Fi", body: "Consulte a recepcao.", is_public: 1, sort_order: 10, created_at: NOW, updated_at: NOW }],
    audit: [],
  };
  return { DB: new ContentDb(data), ENVIRONMENT: "test", __data: data };
}

class ContentDb {
  constructor(data) {
    this.data = data;
  }

  prepare(sql) {
    return new ContentStatement(this, sql, []);
  }

  async batch(statements) {
    const snapshot = structuredClone(this.data);
    try {
      return statements.map((statement) => statement.execute());
    } catch (error) {
      Object.assign(this.data, snapshot);
      throw error;
    }
  }
}

class ContentStatement {
  constructor(db, sql, params) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.params = params;
  }

  bind(...params) {
    return new ContentStatement(this.db, this.sql, params);
  }

  async all() {
    const data = this.db.data;
    if (this.sql.includes("FROM portal_pages p")) {
      const hotelId = this.params[0];
      return { results: data.pages.filter((row) => row.hotel_id === hotelId).map((row) => ({ ...row, section_count: data.sections.filter((section) => section.page_id === row.id).length })) };
    }
    if (this.sql.includes("FROM events") && (this.sql.includes("WHERE hotel_id = ?") || this.sql.includes("WHERE e.hotel_id = ?"))) {
      return { results: data.events.filter((row) => row.hotel_id === this.params[0]).map((row) => withEventMedia(row, data.mediaAssets)) };
    }
    if (this.sql.includes("FROM hotel_information") && this.sql.includes("WHERE hotel_id = ?")) return { results: data.information.filter((row) => row.hotel_id === this.params[0]) };
    if (this.sql.includes("FROM portal_sections") && this.sql.includes("WHERE page_id = ?")) return { results: data.sections.filter((row) => row.page_id === this.params[0] && row.hotel_id === this.params[1]) };
    if (this.sql.includes("FROM admin_audit_log")) return { results: data.audit.map(({ actor_user_id: _actorUserId, ...row }) => row) };
    throw new Error(`Consulta de teste nao suportada: ${this.sql}`);
  }

  async first() {
    const data = this.db.data;
    if (this.sql.includes("FROM portal_pages WHERE id")) return data.pages.find((row) => row.id === this.params[0]) || null;
    if (this.sql.includes("FROM portal_sections WHERE id")) return data.sections.find((row) => row.id === this.params[0]) || null;
    if (this.sql.includes("FROM events") && (this.sql.includes("WHERE id = ?") || this.sql.includes("WHERE e.id = ?"))) {
      const row = data.events.find((entry) => entry.id === this.params[0]);
      return row ? withEventMedia(row, data.mediaAssets) : null;
    }
    if (this.sql.includes("FROM media_assets") && this.sql.includes("mime_type LIKE 'image/%'")) {
      return data.mediaAssets.find((row) => row.id === this.params[0] && row.hotel_id === this.params[1] && row.status === "active" && row.mime_type.startsWith("image/")) || null;
    }
    if (this.sql.includes("FROM hotel_information WHERE id")) return data.information.find((row) => row.id === this.params[0]) || null;
    throw new Error(`Consulta first de teste nao suportada: ${this.sql}`);
  }

  async run() {
    return this.execute();
  }

  execute() {
    const data = this.db.data;
    const p = this.params;
    if (this.sql.startsWith("INSERT INTO portal_pages")) {
      data.pages.push({ id: p[0], hotel_id: p[1], module_key: "guest-portal", slug: p[2], title: p[3], summary: p[4], status: p[5], sort_order: p[6], created_at: p[7], updated_at: p[8], archived_at: p[9] });
    } else if (this.sql.startsWith("UPDATE portal_pages")) {
      Object.assign(find(data.pages, p[7]), { slug: p[0], title: p[1], summary: p[2], status: p[3], sort_order: p[4], updated_at: p[5], archived_at: p[6] });
    } else if (this.sql.startsWith("INSERT INTO portal_sections")) {
      data.sections.push({ id: p[0], page_id: p[1], hotel_id: p[2], section_key: p[3], title: p[4], body: p[5], settings_json: p[6], sort_order: p[7], created_at: p[8], updated_at: p[9] });
    } else if (this.sql.startsWith("INSERT INTO events")) {
      data.events.push({ id: p[0], hotel_id: p[1], title: p[2], summary: p[3], starts_at: p[4], ends_at: p[5], timezone: p[6], status: p[7], media_asset_id: p[8], created_at: p[9], updated_at: p[10] });
    } else if (this.sql.startsWith("INSERT INTO hotel_information")) {
      data.information.push({ id: p[0], hotel_id: p[1], info_key: p[2], title: p[3], body: p[4], is_public: p[5], sort_order: p[6], created_at: p[7], updated_at: p[8] });
    } else if (this.sql.startsWith("INSERT INTO admin_audit_log")) {
      data.audit.push({ id: p[0], hotel_id: p[1], module_key: "guest-portal", actor_user_id: p[2], action: p[3], entity_type: p[4], entity_id: p[5], metadata_json: p[6], created_at: p[7] });
    } else {
      throw new Error(`Mutacao de teste nao suportada: ${this.sql}`);
    }
    return { success: true, meta: { changes: 1 } };
  }
}

function find(rows, id) {
  const row = rows.find((entry) => entry.id === id);
  if (!row) throw new Error("Registro de teste nao encontrado.");
  return row;
}

function withEventMedia(row, assets) {
  const asset = assets.find((entry) => entry.id === row.media_asset_id);
  return { ...row, image_url: asset?.public_url || null, image_alt: asset?.alt_text || null };
}
