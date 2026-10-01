import { all, batch, first, run, statement } from "../../core/database.js";
import { badRequest, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";

const statuses = new Set(["idea", "to_produce", "producing", "approval", "ready", "scheduled", "published", "cancelled"]);
const formats = new Set(["photo", "video", "repost", "art", "text", "boomerang", "other"]);
const objectives = new Set(["engagement", "relationship", "conversion", "information", "institutional", "traffic", "promotion"]);
const priorities = new Set(["low", "normal", "high", "urgent"]);
const storyFields = ["hotel_id", "date", "planned_time", "sort_order", "title", "description", "story_text", "category_id", "content_pillar_id", "format", "objective", "status", "priority", "cta", "link", "responsible_user_id", "campaign_id", "media_asset_id", "sequence_group_id", "sequence_position", "notes", "published_at", "published_url"];
const textLimits = { title: 160, description: 4000, story_text: 4000, cta: 300, link: 1000, notes: 4000, published_url: 1000 };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export async function listHotels(env) {
  return all(env, `SELECT hotel_id AS id, display_name AS name, short_name, instagram_username, active, sort_order
    FROM social_planner_hotels WHERE active = 1 ORDER BY sort_order, display_name`);
}

export async function listCategories(env) {
  return all(env, `SELECT id, name, active, sort_order FROM social_categories WHERE active = 1 ORDER BY sort_order, name`);
}

export async function listPillars(env) {
  return all(env, `SELECT id, name, active, sort_order FROM social_content_pillars WHERE active = 1 ORDER BY sort_order, name`);
}

export async function listUsers(env) {
  return all(env, `SELECT id, display_name AS name FROM admin_users WHERE status = 'active' ORDER BY display_name`);
}

export async function listCampaigns(env) {
  return all(env, `SELECT c.*, COUNT(s.id) AS story_count,
    COALESCE(SUM(CASE WHEN s.status = 'published' THEN 1 ELSE 0 END), 0) AS published_count,
    COUNT(DISTINCT s.hotel_id) AS hotel_count
    FROM social_campaigns c LEFT JOIN social_stories s ON s.campaign_id = c.id
    GROUP BY c.id ORDER BY c.start_date DESC, c.name`);
}

export async function saveCampaign(env, input, id = null) {
  const existing = id ? await first(env, "SELECT * FROM social_campaigns WHERE id = ?", [id]) : null;
  if (id && !existing) throw notFoundError("Campanha não encontrada.");
  const name = requiredText(input.name ?? existing?.name, "Nome", 160);
  const description = optionalText(input.description === undefined ? existing?.description : input.description, "Descrição", 4000);
  const start = optionalDate(input.start_date === undefined ? existing?.start_date : input.start_date, "Data inicial");
  const end = optionalDate(input.end_date === undefined ? existing?.end_date : input.end_date, "Data final");
  if (start && end && start > end) throw badRequest("O término deve ser posterior ao início.");
  const status = input.status ?? existing?.status ?? "planned";
  if (!["planned", "active", "completed", "cancelled"].includes(status)) throw badRequest("Status inválido.");
  const now = new Date().toISOString();
  if (id) {
    const result = await run(env, `UPDATE social_campaigns SET name = ?, description = ?, start_date = ?, end_date = ?, status = ?, updated_at = ? WHERE id = ?`, [name, description, start, end, status, now, id]);
    if (!result.meta?.changes) throw notFoundError("Campanha não encontrada.");
  } else {
    id = createPublicId("campaign");
    await run(env, `INSERT INTO social_campaigns (id, name, description, start_date, end_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, name, description, start, end, status, now, now]);
  }
  return first(env, `SELECT * FROM social_campaigns WHERE id = ?`, [id]);
}

export async function listStories(env, query) {
  const start = requiredDate(query.get("start_date"), "Data inicial");
  const end = requiredDate(query.get("end_date"), "Data final");
  if (start > end || (Date.parse(end) - Date.parse(start)) / 86400000 > 92) throw badRequest("Período inválido ou superior a 93 dias.");
  const where = ["s.date BETWEEN ? AND ?"];
  const params = [start, end];
  const filterMap = { hotel_id: "s.hotel_id", status: "s.status", category_id: "s.category_id", responsible_user_id: "s.responsible_user_id", campaign_id: "s.campaign_id" };
  for (const [key, column] of Object.entries(filterMap)) {
    const value = query.get(key);
    if (value && value !== "all") {
      if (value.length > 160) throw badRequest("Filtro inválido.");
      where.push(`${column} = ?`);
      params.push(value);
    }
  }
  return all(env, `${storySelect()} WHERE ${where.join(" AND ")} ORDER BY s.date, s.hotel_id, s.sort_order, s.planned_time, s.created_at LIMIT 5000`, params);
}

export async function getStory(env, id) {
  const row = await first(env, `${storySelect()} WHERE s.id = ?`, [id]);
  if (!row) throw notFoundError("Story não encontrado.");
  return row;
}

export async function saveStory(env, input, id = null) {
  const patch = normalizeStory(input, !id);
  if (patch.hotel_id) await assertExists(env, "social_planner_hotels", "hotel_id", patch.hotel_id, "Hotel");
  if (patch.category_id) await assertExists(env, "social_categories", "id", patch.category_id, "Categoria");
  if (patch.content_pillar_id) await assertExists(env, "social_content_pillars", "id", patch.content_pillar_id, "Pilar");
  if (patch.campaign_id) await assertExists(env, "social_campaigns", "id", patch.campaign_id, "Campanha");
  if (patch.responsible_user_id) await assertExists(env, "admin_users", "id", patch.responsible_user_id, "Responsável");
  if (patch.sequence_group_id) await assertExists(env, "social_story_sequences", "id", patch.sequence_group_id, "Sequência");
  if (patch.media_asset_id) {
    const asset = await first(env, "SELECT id, hotel_id, status FROM media_assets WHERE id = ?", [patch.media_asset_id]);
    const hotelId = patch.hotel_id || (id ? (await getStory(env, id)).hotel_id : null);
    if (!asset || asset.status !== "active" || (asset.hotel_id && asset.hotel_id !== hotelId)) throw badRequest("Mídia indisponível para este hotel.");
  }
  if (id && patch.hotel_id && !Object.hasOwn(patch, "media_asset_id")) {
    const current = await getStory(env, id);
    if (current.media_asset_id) {
      const asset = await first(env, "SELECT hotel_id FROM media_assets WHERE id = ?", [current.media_asset_id]);
      if (asset?.hotel_id && asset.hotel_id !== patch.hotel_id) throw badRequest("Remova a mídia antes de mover o Story para outro hotel.");
    }
  }
  const now = new Date().toISOString();
  if (id) {
    const keys = Object.keys(patch);
    if (!keys.length) return getStory(env, id);
    const result = await run(env, `UPDATE social_stories SET ${keys.map((key) => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, [...keys.map((key) => patch[key]), now, id]);
    if (!result.meta?.changes) throw notFoundError("Story não encontrado.");
  } else {
    id = createPublicId("story");
    const values = { status: "idea", priority: "normal", sort_order: 1000, ...patch };
    const keys = Object.keys(values);
    await run(env, `INSERT INTO social_stories (id, ${keys.join(", ")}, created_at, updated_at) VALUES (?, ${keys.map(() => "?").join(", ")}, ?, ?)`, [id, ...keys.map((key) => values[key]), now, now]);
  }
  return getStory(env, id);
}

export async function deleteStory(env, id) {
  const result = await run(env, "DELETE FROM social_stories WHERE id = ?", [id]);
  if (!result.meta?.changes) throw notFoundError("Story não encontrado.");
  return { deleted: true };
}

export async function createSequence(env, input) {
  const id = createPublicId("sequence");
  const now = new Date().toISOString();
  await run(env, "INSERT INTO social_story_sequences (id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [id, requiredText(input.title, "Título", 160), optionalText(input.description, "Descrição", 4000), now, now]);
  return first(env, "SELECT * FROM social_story_sequences WHERE id = ?", [id]);
}

export async function listSequences(env) {
  return all(env, `SELECT q.*, COUNT(s.id) AS story_count FROM social_story_sequences q LEFT JOIN social_stories s ON s.sequence_group_id = q.id GROUP BY q.id ORDER BY q.created_at DESC`);
}

export async function moveSequence(env, id, input) {
  const date = requiredDate(input.date, "Data");
  const hotelId = requiredText(input.hotel_id, "Hotel", 100);
  await assertExists(env, "social_planner_hotels", "hotel_id", hotelId, "Hotel");
  const sequence = await first(env, "SELECT id FROM social_story_sequences WHERE id = ?", [id]);
  if (!sequence) throw notFoundError("Sequência não encontrada.");
  const incompatible = await first(env, `SELECT COUNT(*) AS count FROM social_stories s
    JOIN media_assets m ON m.id = s.media_asset_id
    WHERE s.sequence_group_id = ? AND m.hotel_id IS NOT NULL AND m.hotel_id <> ?`, [id, hotelId]);
  if (incompatible?.count) throw badRequest("Remova mídias específicas de outro hotel antes de mover a sequência.");
  await run(env, "UPDATE social_stories SET date = ?, hotel_id = ?, updated_at = ? WHERE sequence_group_id = ?", [date, hotelId, new Date().toISOString(), id]);
  return { moved: true };
}

export async function duplicateSequence(env, id) {
  const source = await first(env, "SELECT * FROM social_story_sequences WHERE id = ?", [id]);
  if (!source) throw notFoundError("Sequência não encontrada.");
  const originals = await all(env, "SELECT * FROM social_stories WHERE sequence_group_id = ? ORDER BY sequence_position, sort_order", [id]);
  const newId = createPublicId("sequence");
  const now = new Date().toISOString();
  const statements = [statement(env, "INSERT INTO social_story_sequences (id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [newId, `${source.title} (cópia)`, source.description, now, now])];
  for (const story of originals) {
    const fields = storyFields.filter((field) => field !== "published_at" && field !== "published_url");
    const values = fields.map((field) => field === "sequence_group_id" ? newId : field === "title" ? `${story.title} (cópia)` : field === "status" ? "idea" : story[field]);
    statements.push(statement(env, `INSERT INTO social_stories (id, ${fields.join(", ")}, created_at, updated_at) VALUES (?, ${fields.map(() => "?").join(", ")}, ?, ?)`, [createPublicId("story"), ...values, now, now]));
  }
  await batch(env, statements);
  return { sequence: await first(env, "SELECT * FROM social_story_sequences WHERE id = ?", [newId]), stories: await all(env, `${storySelect()} WHERE s.sequence_group_id = ? ORDER BY s.sequence_position`, [newId]) };
}

function storySelect() {
  return `SELECT s.*, m.public_url AS asset_url, m.mime_type AS asset_type,
    CASE WHEN m.mime_type LIKE 'image/%' THEN m.public_url ELSE NULL END AS thumbnail_url,
    u.display_name AS responsible_name, q.title AS sequence_title
    FROM social_stories s LEFT JOIN media_assets m ON m.id = s.media_asset_id
    LEFT JOIN admin_users u ON u.id = s.responsible_user_id
    LEFT JOIN social_story_sequences q ON q.id = s.sequence_group_id`;
}

function normalizeStory(input, creating) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Dados do Story inválidos.");
  const patch = {};
  for (const key of storyFields) {
    if (!Object.hasOwn(input, key)) continue;
    const value = input[key];
    if (key === "date") patch[key] = requiredDate(value, "Data");
    else if (key === "hotel_id" || key === "title") patch[key] = requiredText(value, key === "title" ? "Título" : "Hotel", 160);
    else if (key === "planned_time") {
      if (value && !timePattern.test(value)) throw badRequest("Horário inválido.");
      patch[key] = value || null;
    } else if (key === "sort_order" || key === "sequence_position") {
      if (value != null && (typeof value !== "number" || !Number.isFinite(value) || value < -1000000 || value > 1000000 || (key === "sequence_position" && !Number.isInteger(value)))) throw badRequest("Ordem inválida.");
      patch[key] = value;
    } else if (key === "status" || key === "format" || key === "objective" || key === "priority") {
      const allowed = { status: statuses, format: formats, objective: objectives, priority: priorities }[key];
      if (value != null && !allowed.has(value)) throw badRequest(`${key} inválido.`);
      patch[key] = value;
    } else if (key === "published_at") {
      if (value && Number.isNaN(Date.parse(value))) throw badRequest("Data de publicação inválida.");
      patch[key] = value || null;
    } else if (Object.hasOwn(textLimits, key)) {
      patch[key] = optionalText(value, key, textLimits[key]);
      if (key.endsWith("url") || key === "link") {
        if (patch[key] && !/^https:\/\//i.test(patch[key])) throw badRequest("Links devem usar HTTPS.");
      }
    } else {
      patch[key] = value == null || value === "" ? null : requiredText(value, key, 160);
    }
  }
  if (creating && (!patch.hotel_id || !patch.date || !patch.title)) throw badRequest("Título, hotel e data são obrigatórios.");
  return patch;
}

function requiredDate(value, label) {
  if (typeof value !== "string" || !datePattern.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw badRequest(`${label} inválida.`);
  return value;
}
function optionalDate(value, label) { return value ? requiredDate(value, label) : null; }
function requiredText(value, label, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw badRequest(`${label} inválido.`);
  return value.trim();
}
function optionalText(value, label, max) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) throw badRequest(`${label} inválido.`);
  return value.trim() || null;
}
async function assertExists(env, table, column, id, label) {
  if (!await first(env, `SELECT ${column} FROM ${table} WHERE ${column} = ?`, [id])) throw badRequest(`${label} inválido.`);
}
