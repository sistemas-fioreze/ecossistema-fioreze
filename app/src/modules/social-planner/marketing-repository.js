import { all, batch, first, run, statement } from "../../core/database.js";
import { AppError, badRequest, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const visitStatuses = new Set(["planned", "confirmed", "in_progress", "completed", "cancelled"]);
const blogStatuses = new Set(["idea", "briefing", "writing", "review", "ready", "scheduled", "published", "archived"]);
const priorities = new Set(["low", "normal", "high", "urgent"]);
const visitFields = ["hotel_id", "date", "start_time", "end_time", "title", "description", "responsible_user_id", "status", "priority", "campaign_id", "notes", "completed_at"];
const postFields = ["title", "slug", "summary", "briefing", "category_id", "hotel_id", "campaign_id", "author_user_id", "main_keyword", "secondary_keywords", "meta_description", "planned_publish_date", "status", "published_at", "published_url", "notes"];
const articleMimeTypes = new Map([
  ["application/pdf", { extension: "pdf", signature: [0x25, 0x50, 0x44, 0x46, 0x2d] }],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", { extension: "docx", signature: [0x50, 0x4b, 0x03, 0x04] }],
]);
const maxArticleBytes = 15 * 1024 * 1024;
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
function slugBase(value) {
  return String(value || "artigo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "artigo";
}
async function uniquePostSlug(env, title) {
  const base = slugBase(title);
  if (!await first(env, "SELECT id FROM marketing_blog_posts WHERE slug = ?", [base])) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!await first(env, "SELECT id FROM marketing_blog_posts WHERE slug = ?", [candidate])) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
async function saveRow(env, table, fields, input, id, kind) {
  const existing = id ? await first(env, `SELECT * FROM ${table} WHERE id = ?`, [id]) : null;
  if (id && !existing) throw notFoundError(kind === "visit" ? "Visita não encontrada." : "Artigo não encontrado.");
  const patch = normalize(input, fields, kind);
  if (kind === "blog" && !id && !patch.slug && patch.title) patch.slug = await uniquePostSlug(env, patch.title);
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
  (SELECT GROUP_CONCAT(a.planner_user_id, ',') FROM marketing_visit_assignees a
    WHERE a.visit_id = v.id) AS responsible_user_ids_csv,
  (SELECT GROUP_CONCAT(au.display_name, ' · ') FROM marketing_visit_assignees a
    JOIN social_planner_users au ON au.id = a.planner_user_id WHERE a.visit_id = v.id) AS responsible_names,
  (SELECT COUNT(*) FROM marketing_visit_items i WHERE i.visit_id = v.id) AS item_count,
  (SELECT COUNT(*) FROM marketing_visit_items i WHERE i.visit_id = v.id AND i.completed = 1) AS completed_item_count
  FROM marketing_hotel_visits v JOIN social_planner_hotels h ON h.hotel_id = v.hotel_id
  LEFT JOIN social_planner_users u ON u.id = v.responsible_planner_user_id`;
export async function listVisits(env, query) {
  const q = filters(query, { hotel_id: "v.hotel_id", status: "v.status", campaign_id: "v.campaign_id" }, period(query, "v.date"));
  const responsibleUserId = query.get("responsible_user_id");
  if (responsibleUserId && responsibleUserId !== "all") {
    q.where.push("EXISTS (SELECT 1 FROM marketing_visit_assignees va WHERE va.visit_id = v.id AND va.planner_user_id = ?)");
    q.params.push(text(responsibleUserId, "responsible_user_id", 160, true));
  }
  return (await all(env, `${visitSelect} WHERE ${q.where.join(" AND ")} ORDER BY v.date, v.start_time, v.created_at LIMIT 2000`, q.params)).map(normalizeVisitRow);
}
export async function getVisit(env, id) {
  const visit = normalizeVisitRow(await first(env, `${visitSelect} WHERE v.id = ?`, [id]));
  if (!visit) throw notFoundError("Visita não encontrada.");
  visit.assignees = await all(env, `SELECT u.id, u.display_name AS name
    FROM marketing_visit_assignees a JOIN social_planner_users u ON u.id = a.planner_user_id
    WHERE a.visit_id = ? ORDER BY u.display_name`, [id]);
  visit.items = await all(env, "SELECT * FROM marketing_visit_items WHERE visit_id = ? ORDER BY sort_order, created_at", [id]);
  visit.media_assets = await all(env, "SELECT m.id, m.public_url, m.mime_type, m.alt_text FROM marketing_visit_media vm JOIN media_assets m ON m.id = vm.media_asset_id WHERE vm.visit_id = ?", [id]);
  visit.stories = await all(env, "SELECT id, title, date, status FROM social_stories WHERE source_visit_id = ? ORDER BY date, planned_time, sort_order", [id]);
  visit.calendar_events = await all(env, `SELECT m.planner_user_id, u.display_name AS user_name,
      m.sync_status, m.last_synced_at, m.last_error
    FROM marketing_visit_calendar_events m
    JOIN social_planner_users u ON u.id = m.planner_user_id
    WHERE m.visit_id = ? ORDER BY u.display_name`, [id]);
  return visit;
}
export async function saveVisit(env, input, id = null) {
  const hasAssignees = Object.hasOwn(input || {}, "responsible_user_ids");
  const responsibleUserIds = hasAssignees ? normalizeResponsibleUserIds(input.responsible_user_ids) : null;
  if (responsibleUserIds) {
    for (const userId of responsibleUserIds) {
      if (!await first(env, "SELECT id FROM social_planner_users WHERE id = ? AND status = 'active'", [userId])) throw badRequest("Responsável inválido.");
    }
  }
  const baseInput = { ...input };
  delete baseInput.responsible_user_ids;
  if (hasAssignees) baseInput.responsible_user_id = responsibleUserIds[0] || null;
  const saved = await saveRow(env, "marketing_hotel_visits", visitFields, baseInput, id, "visit");
  if (hasAssignees) {
    await batch(env, [
      statement(env, "DELETE FROM marketing_visit_assignees WHERE visit_id = ?", [saved.id]),
      ...responsibleUserIds.map((userId) => statement(env, "INSERT INTO marketing_visit_assignees (visit_id, planner_user_id) VALUES (?, ?)", [saved.id, userId])),
    ]);
  } else if (!id && saved.responsible_user_id) {
    await run(env, "INSERT OR IGNORE INTO marketing_visit_assignees (visit_id, planner_user_id) VALUES (?, ?)", [saved.id, saved.responsible_user_id]);
  }
  return getVisit(env, saved.id);
}
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
  return (await all(env, `${postSelect} ${q.where.length ? `WHERE ${q.where.join(" AND ")}` : ""} ORDER BY p.updated_at DESC LIMIT 1000`, q.params)).map(normalizePostRow);
}
export async function getPost(env, id) { const post = normalizePostRow(await first(env, `${postSelect} WHERE p.id = ?`, [id])); if (!post) throw notFoundError("Artigo não encontrado."); return post; }
export const savePost = (env, input, id = null) => saveRow(env, "marketing_blog_posts", postFields, input, id, "blog");
export async function deletePost(env, id) {
  const post = await first(env, "SELECT article_object_key FROM marketing_blog_posts WHERE id = ?", [id]);
  const result = await run(env, "DELETE FROM marketing_blog_posts WHERE id = ?", [id]);
  if (!result.meta?.changes) throw notFoundError("Artigo não encontrado.");
  if (post?.article_object_key && env.MEDIA_BUCKET?.delete) await env.MEDIA_BUCKET.delete(post.article_object_key).catch(() => null);
  return { deleted: true };
}

export async function uploadPostDocument(env, id, request) {
  const existing = await first(env, "SELECT id, status, article_object_key FROM marketing_blog_posts WHERE id = ?", [id]);
  if (!existing) throw notFoundError("Artigo não encontrado.");
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) throw badRequest("Envie o artigo como multipart/form-data.");
  const announcedSize = Number(request.headers.get("content-length") || 0);
  if (announcedSize > maxArticleBytes + 1024 * 1024) throw new AppError(413, "article_too_large", "O artigo deve ter no máximo 15 MB.");
  const form = await request.formData().catch(() => { throw badRequest("Arquivo do artigo inválido."); });
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") throw badRequest("Selecione um arquivo PDF ou DOCX.");
  const originalName = safeArticleFileName(file.name);
  const extension = originalName.toLowerCase().split(".").at(-1);
  const mimeType = extension === "pdf" ? "application/pdf" : extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "";
  const declaredMime = String(file.type || "").toLowerCase();
  const format = articleMimeTypes.get(mimeType);
  if (!format || (declaredMime && declaredMime !== "application/octet-stream" && declaredMime !== mimeType)) throw badRequest("O artigo deve estar em PDF ou DOCX.");
  if (!file.size || file.size > maxArticleBytes) throw new AppError(413, "article_too_large", "O artigo deve ter no máximo 15 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!format.signature.every((byte, index) => bytes[index] === byte)) throw badRequest("O conteúdo do arquivo não corresponde ao formato informado.");
  const objectKey = `social-planner/blog/${id}/${crypto.randomUUID()}.${format.extension}`;
  const bucket = requireArticleBucket(env);
  await bucket.put(objectKey, bytes, {
    httpMetadata: { contentType: mimeType },
    customMetadata: { postId: id, originalName },
  });
  const now = new Date().toISOString();
  try {
    const nextStatus = ["published", "archived"].includes(existing.status) ? existing.status : "ready";
    await run(env, `UPDATE marketing_blog_posts SET article_file_name = ?, article_mime_type = ?, article_size_bytes = ?,
      article_object_key = ?, article_uploaded_at = ?, status = ?, updated_at = ? WHERE id = ?`,
    [originalName, mimeType, bytes.byteLength, objectKey, now, nextStatus, now, id]);
  } catch (error) {
    await bucket.delete(objectKey).catch(() => null);
    throw error;
  }
  if (existing.article_object_key && existing.article_object_key !== objectKey) await bucket.delete(existing.article_object_key).catch(() => null);
  return getPost(env, id);
}

export async function removePostDocument(env, id) {
  const existing = await first(env, "SELECT status, article_object_key FROM marketing_blog_posts WHERE id = ?", [id]);
  if (!existing) throw notFoundError("Artigo não encontrado.");
  const now = new Date().toISOString();
  const nextStatus = existing.status === "ready" ? "briefing" : existing.status;
  await run(env, `UPDATE marketing_blog_posts SET article_file_name = NULL, article_mime_type = NULL,
    article_size_bytes = NULL, article_object_key = NULL, article_uploaded_at = NULL, status = ?, updated_at = ? WHERE id = ?`, [nextStatus, now, id]);
  if (existing.article_object_key && env.MEDIA_BUCKET?.delete) await env.MEDIA_BUCKET.delete(existing.article_object_key).catch(() => null);
  return getPost(env, id);
}

export async function servePostDocument(env, id) {
  const post = await first(env, `SELECT article_file_name, article_mime_type, article_size_bytes, article_object_key
    FROM marketing_blog_posts WHERE id = ?`, [id]);
  if (!post?.article_object_key) throw notFoundError("Este artigo ainda não possui arquivo.");
  const object = await requireArticleBucket(env).get(post.article_object_key);
  if (!object) throw notFoundError("Arquivo do artigo não encontrado.");
  const headers = new Headers({
    "content-type": post.article_mime_type || object.httpMetadata?.contentType || "application/octet-stream",
    "content-disposition": articleContentDisposition(post.article_file_name || "artigo"),
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
  if (post.article_size_bytes) headers.set("content-length", String(post.article_size_bytes));
  return new Response(object.body, { status: 200, headers });
}

function normalizePostRow(row) {
  if (!row) return null;
  delete row.article_object_key;
  row.article_download_url = row.article_file_name ? `/api/v1/social-planner/blog-posts/${encodeURIComponent(row.id)}/document` : null;
  return row;
}
function requireArticleBucket(env) {
  if (!env?.MEDIA_BUCKET?.put || !env.MEDIA_BUCKET?.get || !env.MEDIA_BUCKET?.delete) throw new AppError(503, "storage_unavailable", "Armazenamento de artigos indisponível.");
  return env.MEDIA_BUCKET;
}
function safeArticleFileName(value) {
  const name = String(value || "artigo").replace(/^.*[\\/]/, "").replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, " ").replace(/\s+/g, " ").trim();
  return name.slice(0, 180) || "artigo";
}
function articleContentDisposition(fileName) {
  const ascii = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function getSettings(env) { const row = await first(env, "SELECT setting_value FROM marketing_planner_settings WHERE setting_key = 'display_name'"); return { display_name: row?.setting_value || "Fioreze Marketing Planner" }; }
export async function saveSettings(env, input) { const name = text(input?.display_name, "Nome", 100, true); await run(env, "UPDATE marketing_planner_settings SET setting_value = ?, updated_at = ? WHERE setting_key = 'display_name'", [name, new Date().toISOString()]); return { display_name: name }; }

function normalizeResponsibleUserIds(value) {
  if (!Array.isArray(value) || value.length > 20) throw badRequest("Responsáveis inválidos.");
  const ids = value.map((entry) => text(entry, "Responsável", 160, true));
  if (new Set(ids).size !== ids.length) throw badRequest("Um responsável foi selecionado mais de uma vez.");
  return ids;
}

function normalizeVisitRow(row) {
  if (!row) return null;
  row.responsible_user_ids = row.responsible_user_ids_csv ? row.responsible_user_ids_csv.split(",") : [];
  delete row.responsible_user_ids_csv;
  return row;
}
