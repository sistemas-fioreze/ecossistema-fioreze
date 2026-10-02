import { all, first, run } from "../../core/database.js";
import { badRequest, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const visitStatuses = new Set(["planned", "confirmed", "in_progress", "completed", "cancelled"]);
const blogStatuses = new Set(["idea", "briefing", "writing", "review", "ready", "scheduled", "published", "archived"]);
const priorities = new Set(["low", "normal", "high", "urgent"]);
const visitFields = ["hotel_id", "date", "start_time", "end_time", "title", "description", "responsible_user_id", "status", "priority", "campaign_id", "notes", "completed_at"];
const postFields = ["title", "slug", "summary", "briefing", "category_id", "hotel_id", "campaign_id", "author_user_id", "main_keyword", "secondary_keywords", "meta_description", "planned_publish_date", "status", "published_at", "published_url", "notes"];
const refs = { hotel_id: ["social_planner_hotels", "hotel_id"], responsible_planner_user_id: ["social_planner_users", "id"], author_planner_user_id: ["social_planner_users", "id"], campaign_id: ["social_campaigns", "id"], category_id: ["social_categories", "id"] };

function date(value, label) {
  if (typeof value !== "string" || !datePattern.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw badRequest(`${label} inválida.`);
  return value;
}
function text(value, label, max, required = false) {
  if (value == null || value === "") { if (required) throw badRequest(`${label} obrigatório.`); return null; }
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw badRequest(`${label} inválido.`);
  return value.trim();
}
function period(query, column, maxDays = 93) {
  const start = date(query.get("start_date"), "Data inicial");
  const end = date(query.get("end_date"), "Data final");
  if (start > end || (Date.parse(end) - Date.parse(start)) / 86400000 >= maxDays) throw badRequest("Período inválido ou muito longo.");
  return { where: [`${column} BETWEEN ? AND ?`], params: [start, end] };
}
function filters(query, allowed, result) {
  for (const [key, column] of Object.entries(allowed)) {
    const value = query.get(key);
    if (value && value !== "all") { result.where.push(`${column} = ?`); result.params.push(text(value, key, 160, true)); }
  }
  return result;
}
async function checkRefs(env, patch) {
  for (const [key, [table, column]] of Object.entries(refs)) {
    if (patch[key] && !await first(env, `SELECT ${column} FROM ${table} WHERE ${column} = ?`, [patch[key]])) throw badRequest(`${key} inválido.`);
  }
}
function normalize(input, fields, kind) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Dados inválidos.");
  const patch = {};
  for (const key of fields) {
    if (!Object.hasOwn(input, key)) continue;
    const value = input[key];
    if (["date", "planned_publish_date"].includes(key)) patch[key] = value ? date(value, key) : null;
    else if (["start_time", "end_time"].includes(key)) { if (value && (typeof value !== "string" || !timePattern.test(value))) throw badRequest("Horário inválido."); patch[key] = value || null; }
    else if (key === "completed_at" || key === "published_at") { if (value && (typeof value !== "string" || Number.isNaN(Date.parse(value)))) throw badRequest("Data inválida."); patch[key] = value || null; }
    else if (key === "status") { if (!(kind === "visit" ? visitStatuses : blogStatuses).has(value)) throw badRequest("Status inválido."); patch[key] = value; }
    else if (key === "priority") { if (!priorities.has(value)) throw badRequest("Prioridade inválida."); patch[key] = value; }
    else if (key === "slug") { if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 160) throw badRequest("Slug inválido."); patch[key] = value; }
    else if (key === "published_url") { patch[key] = text(value, key, 1000); if (patch[key] && !/^https:\/\//i.test(patch[key])) throw badRequest("A URL publicada deve usar HTTPS."); }
    else {
      const normalized = text(value, key, ["description", "briefing", "notes"].includes(key) ? 10000 : key === "summary" ? 4000 : 500, key === "title" || (kind === "visit" && key === "hotel_id"));
      if (key === "responsible_user_id") patch.responsible_planner_user_id = normalized;
      else if (key === "author_user_id") patch.author_planner_user_id = normalized;
      else patch[key] = normalized;
    }
  }
  return patch;
}
async function saveRow(env, table, fields, input, id, kind) {
  const existing = id ? await first(env, `SELECT * FROM ${table} WHERE id = ?`, [id]) : null;
  if (id && !existing) throw notFoundError(kind === "visit" ? "Visita não encontrada." : "Artigo não encontrado.");
  const patch = normalize(input, fields, kind);
  if (!id && (!patch.title || (kind === "visit" && (!patch.hotel_id || !patch.date)) || (kind === "blog" && !patch.slug))) throw badRequest(kind === "visit" ? "Título, hotel e data são obrigatórios." : "Título e slug são obrigatórios.");
  const full = { ...existing, ...patch };
  if (!full.title || (kind === "visit" && (!full.hotel_id || !full.date)) || (kind === "blog" && !full.slug)) throw badRequest("Campos obrigatórios ausentes.");
  if (kind === "visit" && full.start_time && full.end_time && full.end_time <= full.start_time) throw badRequest("O término deve ser após o início.");
  if (kind === "visit" && existing && patch.hotel_id && patch.hotel_id !== existing.hotel_id) {
    const linkedStory = await first(env, "SELECT id FROM social_stories WHERE source_visit_id = ? LIMIT 1", [id]);
    const linkedAsset = await first(env, `SELECT m.id FROM marketing_visit_media vm JOIN media_assets m ON m.id = vm.media_asset_id
      WHERE vm.visit_id = ? AND m.hotel_id IS NOT NULL AND m.hotel_id <> ? LIMIT 1`, [id, patch.hotel_id]);
    if (linkedStory || linkedAsset) throw badRequest("Remova os vínculos de Stories e mídias antes de mover a visita para outro hotel.");
  }
  await checkRefs(env, patch);
  if (kind === "visit" && patch.status === "completed" && !Object.hasOwn(patch, "completed_at")) patch.completed_at = new Date().toISOString();
  if (kind === "visit" && patch.status && patch.status !== "completed" && !Object.hasOwn(patch, "completed_at")) patch.completed_at = null;
  if (kind === "blog" && patch.status === "published" && !Object.hasOwn(patch, "published_at")) patch.published_at = new Date().toISOString();
  if (kind === "blog" && patch.status && patch.status !== "published" && !Object.hasOwn(patch, "published_at")) patch.published_at = null;
  if (kind === "blog" && patch.slug) {
    const duplicate = await first(env, "SELECT id FROM marketing_blog_posts WHERE slug = ? AND id <> ?", [patch.slug, id || ""]);
    if (duplicate) throw badRequest("Este slug já está em uso.");
  }
  const now = new Date().toISOString();
  if (id) {
    const keys = Object.keys(patch);
    if (keys.length) await run(env, `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, [...keys.map((key) => patch[key]), now, id]);
  } else {
    id = createPublicId(kind);
    const values = kind === "visit" ? { status: "planned", priority: "normal", ...patch } : { status: "idea", ...patch };
    const keys = Object.keys(values);
    await run(env, `INSERT INTO ${table} (id, ${keys.join(", ")}, created_at, updated_at) VALUES (?, ${keys.map(() => "?").join(", ")}, ?, ?)`, [id, ...keys.map((key) => values[key]), now, now]);
  }
  return kind === "visit" ? getVisit(env, id) : getPost(env, id);
}

const visitSelect = `SELECT v.*, v.responsible_planner_user_id AS responsible_user_id,
  h.short_name AS hotel_name, u.display_name AS responsible_name,
  (SELECT COUNT(*) FROM marketing_visit_items i WHERE i.visit_id = v.id) AS item_count,
  (SELECT COUNT(*) FROM marketing_visit_items i WHERE i.visit_id = v.id AND i.completed = 1) AS completed_item_count
  FROM marketing_hotel_visits v JOIN social_planner_hotels h ON h.hotel_id = v.hotel_id
  LEFT JOIN social_planner_users u ON u.id = v.responsible_planner_user_id`;
export async function listVisits(env, query) {
  const q = filters(query, { hotel_id: "v.hotel_id", status: "v.status", responsible_user_id: "v.responsible_planner_user_id", campaign_id: "v.campaign_id" }, period(query, "v.date"));
  return all(env, `${visitSelect} WHERE ${q.where.join(" AND ")} ORDER BY v.date, v.start_time, v.created_at LIMIT 2000`, q.params);
}
export async function getVisit(env, id) {
  const visit = await first(env, `${visitSelect} WHERE v.id = ?`, [id]);
  if (!visit) throw notFoundError("Visita não encontrada.");
  visit.items = await all(env, "SELECT * FROM marketing_visit_items WHERE visit_id = ? ORDER BY sort_order, created_at", [id]);
  visit.media_assets = await all(env, "SELECT m.id, m.public_url, m.mime_type, m.alt_text FROM marketing_visit_media vm JOIN media_assets m ON m.id = vm.media_asset_id WHERE vm.visit_id = ?", [id]);
  visit.stories = await all(env, "SELECT id, title, date, status FROM social_stories WHERE source_visit_id = ? ORDER BY date, planned_time, sort_order", [id]);
  return visit;
}
export const saveVisit = (env, input, id = null) => saveRow(env, "marketing_hotel_visits", visitFields, input, id, "visit");
export async function deleteVisit(env, id) { const result = await run(env, "DELETE FROM marketing_hotel_visits WHERE id = ?", [id]); if (!result.meta?.changes) throw notFoundError("Visita não encontrada."); return { deleted: true }; }

export async function saveVisitItem(env, visitId, input, id = null) {
  await getVisit(env, visitId);
  const existing = id ? await first(env, "SELECT * FROM marketing_visit_items WHERE id = ? AND visit_id = ?", [id, visitId]) : null;
  if (id && !existing) throw notFoundError("Item não encontrado.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Item inválido.");
  const patch = {};
  for (const key of ["title", "description", "content_type", "category_id", "required", "completed", "sort_order"]) {
    if (!Object.hasOwn(input, key)) continue;
    const value = input[key];
    if (["required", "completed"].includes(key)) { if (![0, 1, false, true].includes(value)) throw badRequest("Valor do checklist inválido."); patch[key] = Number(value); }
    else if (key === "sort_order") { if (!Number.isInteger(value) || value < 0 || value > 1000000) throw badRequest("Ordem inválida."); patch[key] = value; }
    else patch[key] = text(value, key, key === "description" ? 4000 : 160, key === "title");
  }
  if (!id && !patch.title) throw badRequest("Título do item obrigatório.");
  await checkRefs(env, patch);
  const now = new Date().toISOString();
  if (id) { const keys = Object.keys(patch); if (keys.length) await run(env, `UPDATE marketing_visit_items SET ${keys.map((key) => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ? AND visit_id = ?`, [...keys.map((key) => patch[key]), now, id, visitId]); }
  else { id = createPublicId("visit-item"); const values = { required: 1, completed: 0, sort_order: 1000, ...patch }; const keys = Object.keys(values); await run(env, `INSERT INTO marketing_visit_items (id, visit_id, ${keys.join(", ")}, created_at, updated_at) VALUES (?, ?, ${keys.map(() => "?").join(", ")}, ?, ?)`, [id, visitId, ...keys.map((key) => values[key]), now, now]); }
  return first(env, "SELECT * FROM marketing_visit_items WHERE id = ?", [id]);
}
export async function deleteVisitItem(env, visitId, id) { const result = await run(env, "DELETE FROM marketing_visit_items WHERE id = ? AND visit_id = ?", [id, visitId]); if (!result.meta?.changes) throw notFoundError("Item não encontrado."); return { deleted: true }; }
export async function linkVisitMedia(env, visitId, mediaId) {
  const visit = await getVisit(env, visitId);
  const asset = await first(env, "SELECT id, hotel_id, status FROM media_assets WHERE id = ?", [text(mediaId, "Mídia", 160, true)]);
  if (!asset || asset.status !== "active" || (asset.hotel_id && asset.hotel_id !== visit.hotel_id)) throw badRequest("Mídia indisponível para este hotel.");
  await run(env, "INSERT OR IGNORE INTO marketing_visit_media (visit_id, media_asset_id) VALUES (?, ?)", [visitId, mediaId]);
  return getVisit(env, visitId);
}
export async function unlinkVisitMedia(env, visitId, mediaId) { await getVisit(env, visitId); await run(env, "DELETE FROM marketing_visit_media WHERE visit_id = ? AND media_asset_id = ?", [visitId, mediaId]); return { deleted: true }; }

const postSelect = `SELECT p.*, p.author_planner_user_id AS author_user_id,
  h.short_name AS hotel_name, u.display_name AS author_name FROM marketing_blog_posts p
  LEFT JOIN social_planner_hotels h ON h.hotel_id = p.hotel_id LEFT JOIN social_planner_users u ON u.id = p.author_planner_user_id`;
export async function listPosts(env, query) {
  const q = { where: [], params: [] };
  if (query.get("start_date") || query.get("end_date")) Object.assign(q, period(query, "p.planned_publish_date"));
  filters(query, { hotel_id: "p.hotel_id", status: "p.status", category_id: "p.category_id", author_user_id: "p.author_planner_user_id", campaign_id: "p.campaign_id" }, q);
  return all(env, `${postSelect} ${q.where.length ? `WHERE ${q.where.join(" AND ")}` : ""} ORDER BY p.planned_publish_date IS NULL, p.planned_publish_date, p.updated_at DESC LIMIT 1000`, q.params);
}
export async function getPost(env, id) { const post = await first(env, `${postSelect} WHERE p.id = ?`, [id]); if (!post) throw notFoundError("Artigo não encontrado."); return post; }
export const savePost = (env, input, id = null) => saveRow(env, "marketing_blog_posts", postFields, input, id, "blog");
export async function deletePost(env, id) { const result = await run(env, "DELETE FROM marketing_blog_posts WHERE id = ?", [id]); if (!result.meta?.changes) throw notFoundError("Artigo não encontrado."); return { deleted: true }; }

export async function getSettings(env) { const row = await first(env, "SELECT setting_value FROM marketing_planner_settings WHERE setting_key = 'display_name'"); return { display_name: row?.setting_value || "Fioreze Marketing Planner" }; }
export async function saveSettings(env, input) { const name = text(input?.display_name, "Nome", 100, true); await run(env, "UPDATE marketing_planner_settings SET setting_value = ?, updated_at = ? WHERE setting_key = 'display_name'", [name, new Date().toISOString()]); return { display_name: name }; }
