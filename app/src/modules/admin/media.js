import { all, batch, first, statement } from "../../core/database.js";
import { AppError, badRequest, notFoundError } from "../../core/errors.js";
import { createPublicId, isSafeIdentifier } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import { assertAdminMutationAllowed, requireAdminHotelAccess, requirePermission } from "../../services/admin-auth.js";

const READ_PERMISSION = "portals.media.read";
const UPLOAD_PERMISSION = "portals.media.upload";
const UPDATE_PERMISSION = "portals.media.update";
const ARCHIVE_PERMISSION = "portals.media.archive";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const PUBLIC_CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const FILENAME_EXTENSIONS = {
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "image/png": new Set(["png"]),
  "image/webp": new Set(["webp"]),
  "image/avif": new Set(["avif"]),
};
const VALID_MEDIA_STATUSES = new Set(["active", "inactive", "archived"]);

export async function uploadAdminMedia({ request, env, session }) {
  requirePermission(session, UPLOAD_PERMISSION);
  assertAdminMutationAllowed({ request });
  const bucket = requireMediaBucket(env);
  const form = await readMultipartForm(request);
  const hotelId = requireString(formText(form, "hotel_id"), "hotel_id", { max: 80 });
  requireAdminHotelAccess(session, hotelId);
  const moduleKey = await normalizeModuleKey(env, formText(form, "module_key"));
  const altText = optionalString(formText(form, "alt_text"), "alt_text", { max: 300 }) || null;
  const file = form.get("file");
  const validated = await validateImageFile(file);
  const now = requestNow({ request, env });
  const assetId = createPublicId("media");
  const objectKey = buildObjectKey({
    hotelId,
    moduleKey,
    createdAt: now,
    assetId,
    extension: validated.extension,
  });
  const publicUrl = `/media/${assetId}`;

  let putResult;
  try {
    putResult = await bucket.put(objectKey, validated.bytes, {
      httpMetadata: {
        contentType: validated.mimeType,
        cacheControl: PUBLIC_CACHE_CONTROL,
      },
      customMetadata: {
        asset_id: assetId,
        hotel_id: hotelId,
        module_key: moduleKey || "shared",
      },
    });
  } catch {
    throw new AppError(503, "storage_unavailable", "Armazenamento de midia indisponivel.");
  }

  const etag = putResult?.httpEtag || putResult?.etag || null;
  try {
    await batch(env, [
      statement(
        env,
        `INSERT INTO media_assets (
           id, hotel_id, module_key, storage_provider, object_key, public_url,
           alt_text, mime_type, status, created_at, updated_at, archived_at,
           original_filename, size_bytes, checksum_sha256, storage_etag,
           uploaded_by_user_id, archived_by_user_id
         ) VALUES (?, ?, ?, 'r2', ?, ?, ?, ?, 'active', ?, ?, NULL, ?, ?, ?, ?, ?, NULL)`,
        [
          assetId,
          hotelId,
          moduleKey,
          objectKey,
          publicUrl,
          altText,
          validated.mimeType,
          now,
          now,
          validated.originalFilename,
          validated.sizeBytes,
          validated.checksumSha256,
          etag,
          session.user.id,
        ],
      ),
      auditStatement(env, {
        hotelId,
        moduleKey,
        actorUserId: session.user.id,
        action: "media.upload",
        entityId: assetId,
        metadata: {
          mime_type: validated.mimeType,
          size_bytes: validated.sizeBytes,
        },
        createdAt: now,
      }),
    ]);
  } catch {
    await bucket.delete(objectKey).catch(() => null);
    throw new AppError(500, "media_metadata_failed", "Midia enviada, mas os metadados nao puderam ser salvos.");
  }

  return {
    asset: formatMediaAsset({
      id: assetId,
      hotel_id: hotelId,
      module_key: moduleKey,
      public_url: publicUrl,
      alt_text: altText,
      mime_type: validated.mimeType,
      status: "active",
      created_at: now,
      updated_at: now,
      archived_at: null,
      original_filename: validated.originalFilename,
      size_bytes: validated.sizeBytes,
      checksum_sha256: validated.checksumSha256,
      storage_etag: etag,
      uploaded_by_user_id: session.user.id,
      archived_by_user_id: null,
    }),
  };
}

export async function listAdminMedia({ env, session, url }) {
  requirePermission(session, READ_PERMISSION);
  const hotelId = selectHotelForList(session, url.searchParams.get("hotel_id"));
  requireAdminHotelAccess(session, hotelId);
  const moduleKey = optionalModuleKeyForQuery(url.searchParams.get("module_key"));
  const status = optionalString(url.searchParams.get("status"), "status", { max: 40 }) || "active";
  const search = optionalString(url.searchParams.get("q"), "q", { max: 120 });
  const limit = parsePaginationInteger(url.searchParams.get("limit"), { defaultValue: 24, max: 60 });
  const offset = parsePaginationInteger(url.searchParams.get("offset"), { defaultValue: 0, max: 10000 });

  if (!VALID_MEDIA_STATUSES.has(status)) throw badRequest("status de midia invalido.");

  const filters = ["hotel_id = ?", "status = ?"];
  const params = [hotelId, status];
  if (moduleKey) {
    filters.push("module_key = ?");
    params.push(moduleKey);
  }
  if (search) {
    filters.push("(lower(coalesce(original_filename, '')) LIKE ? OR lower(coalesce(alt_text, '')) LIKE ?)");
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like);
  }
  params.push(limit, offset);

  const rows = await all(
    env,
    `SELECT id, hotel_id, module_key, public_url, alt_text, mime_type,
            status, created_at, updated_at, archived_at, original_filename,
            size_bytes, checksum_sha256, storage_etag, uploaded_by_user_id,
            archived_by_user_id
       FROM media_assets
      WHERE ${filters.join(" AND ")}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    params,
  );

  return {
    assets: rows.map(formatMediaAsset),
    pagination: {
      limit,
      offset,
      count: rows.length,
    },
  };
}

export async function getAdminMedia({ env, session, assetId }) {
  requirePermission(session, READ_PERMISSION);
  const asset = await loadMediaForSession(env, session, assetId);
  if (!asset) throw notFoundError("Midia nao encontrada.");
  return { asset: formatMediaAsset(asset) };
}

export async function updateAdminMedia({ request, env, session, assetId }) {
  requirePermission(session, UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadMediaForSession(env, session, assetId);
  if (!current) throw notFoundError("Midia nao encontrada.");
  if (current.status === "archived") throw badRequest("Midia arquivada nao pode ser alterada.");

  const payload = await readJson(request);
  const allowedFields = new Set(["alt_text", "module_key"]);
  const unknownFields = Object.keys(payload).filter((key) => !allowedFields.has(key));
  if (unknownFields.length) throw badRequest("Campos de midia nao permitidos.", { fields: unknownFields });

  let nextAltText = current.alt_text || null;
  let nextModuleKey = current.module_key || null;
  const changedFields = [];

  if (Object.hasOwn(payload, "alt_text")) {
    nextAltText = optionalString(payload.alt_text, "alt_text", { max: 300 }) || null;
    if (nextAltText !== (current.alt_text || null)) changedFields.push("alt_text");
  }

  if (Object.hasOwn(payload, "module_key")) {
    nextModuleKey = await normalizeModuleKey(env, payload.module_key);
    if (nextModuleKey !== (current.module_key || null)) changedFields.push("module_key");
  }

  if (!changedFields.length) {
    return { asset: formatMediaAsset(current), changed_fields: [] };
  }

  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE media_assets
          SET alt_text = ?,
              module_key = ?,
              updated_at = ?
        WHERE id = ?
          AND hotel_id = ?
          AND status <> 'archived'`,
      [nextAltText, nextModuleKey, now, current.id, current.hotel_id],
    ),
    auditStatement(env, {
      hotelId: current.hotel_id,
      moduleKey: nextModuleKey,
      actorUserId: session.user.id,
      action: "media.update",
      entityId: current.id,
      metadata: { changed_fields: changedFields },
      createdAt: now,
    }),
  ]);

  const updated = await loadMediaForSession(env, session, assetId);
  return { asset: formatMediaAsset(updated), changed_fields: changedFields };
}

export async function archiveAdminMedia({ request, env, session, assetId }) {
  requirePermission(session, ARCHIVE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const current = await loadMediaForSession(env, session, assetId);
  if (!current) throw notFoundError("Midia nao encontrada.");
  if (current.status === "archived") return { asset: formatMediaAsset(current), archived: false };

  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE media_assets
          SET status = 'archived',
              archived_at = ?,
              archived_by_user_id = ?,
              updated_at = ?
        WHERE id = ?
          AND hotel_id = ?
          AND status <> 'archived'`,
      [now, session.user.id, now, current.id, current.hotel_id],
    ),
    auditStatement(env, {
      hotelId: current.hotel_id,
      moduleKey: current.module_key || null,
      actorUserId: session.user.id,
      action: "media.archive",
      entityId: current.id,
      metadata: { previous_status: current.status },
      createdAt: now,
    }),
  ]);

  const archived = await loadMediaForSession(env, session, assetId);
  return { asset: formatMediaAsset(archived), archived: true };
}

export async function servePublicMedia({ request, env, params, head = false }) {
  const bucket = requireMediaBucket(env);
  const asset = await first(
    env,
    `SELECT id, storage_provider, object_key, public_url, mime_type,
            size_bytes, storage_etag, status
       FROM media_assets
      WHERE id = ?
        AND storage_provider = 'r2'
        AND status = 'active'
      LIMIT 1`,
    [params.id],
  );
  if (!asset) throw notFoundError("Midia nao encontrada.");

  const object = await bucket.get(asset.object_key);
  if (!object?.body) throw notFoundError("Midia nao encontrada.");

  const headers = new Headers({
    "content-type": object.httpMetadata?.contentType || asset.mime_type || "application/octet-stream",
    "cache-control": object.httpMetadata?.cacheControl || PUBLIC_CACHE_CONTROL,
    "x-content-type-options": "nosniff",
  });
  const size = object.size ?? asset.size_bytes;
  const etag = object.httpEtag || object.etag || asset.storage_etag;
  if (size != null) headers.set("content-length", String(size));
  if (etag) headers.set("etag", etag);

  return new Response(head ? null : object.body, { status: 200, headers });
}

async function loadMediaForSession(env, session, assetId) {
  if (!session.hotel_ids.length) return null;
  const placeholders = session.hotel_ids.map(() => "?").join(", ");
  return first(
    env,
    `SELECT id, hotel_id, module_key, public_url, alt_text, mime_type,
            status, created_at, updated_at, archived_at, original_filename,
            size_bytes, checksum_sha256, storage_etag, uploaded_by_user_id,
            archived_by_user_id
       FROM media_assets
      WHERE id = ?
        AND hotel_id IN (${placeholders})
      LIMIT 1`,
    [assetId, ...session.hotel_ids],
  );
}

async function normalizeModuleKey(env, value) {
  const moduleKey = optionalString(value, "module_key", { max: 80 });
  if (!moduleKey) return null;
  if (!isSafeIdentifier(moduleKey) || moduleKey.includes("..") || moduleKey.includes("/") || moduleKey.includes("\\")) {
    throw badRequest("module_key invalido.");
  }
  const moduleRow = await first(env, "SELECT module_key FROM modules WHERE module_key = ? LIMIT 1", [moduleKey]);
  if (!moduleRow) throw badRequest("module_key invalido.");
  return moduleKey;
}

function optionalModuleKeyForQuery(value) {
  const moduleKey = optionalString(value, "module_key", { max: 80 });
  if (!moduleKey) return "";
  if (!isSafeIdentifier(moduleKey) || moduleKey.includes("..") || moduleKey.includes("/") || moduleKey.includes("\\")) {
    throw badRequest("module_key invalido.");
  }
  return moduleKey;
}

function selectHotelForList(session, requestedHotelId) {
  const hotelId = optionalString(requestedHotelId, "hotel_id", { max: 80 });
  if (hotelId) return hotelId;
  if (session.hotel_ids.length === 1) return session.hotel_ids[0];
  throw badRequest("Informe hotel_id para listar midias.");
}

function parsePaginationInteger(value, { defaultValue, max }) {
  if (value == null || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw badRequest("Paginacao invalida.");
  return Math.min(parsed, max);
}

async function readMultipartForm(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    throw badRequest("Envie a midia como multipart/form-data.");
  }
  try {
    return await request.formData();
  } catch {
    throw badRequest("Formulario de midia invalido.");
  }
}

function formText(form, name) {
  const value = form.get(name);
  if (value == null) return "";
  if (typeof value !== "string") throw badRequest(`${name} deve ser texto.`);
  return value;
}

async function validateImageFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw badRequest("Arquivo de imagem obrigatorio.");
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw badRequest("Formato de imagem nao permitido.");
  }
  if (file.size <= 0) throw badRequest("Arquivo de imagem vazio.");
  if (file.size > MAX_FILE_BYTES) throw badRequest("Arquivo de imagem excede 8MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength <= 0) throw badRequest("Arquivo de imagem vazio.");
  if (bytes.byteLength > MAX_FILE_BYTES) throw badRequest("Arquivo de imagem excede 8MB.");

  const detectedMime = detectMimeType(bytes);
  if (detectedMime !== file.type) {
    throw badRequest("Conteudo da imagem nao corresponde ao tipo informado.");
  }

  const originalFilename = sanitizeFilename(file.name || "imagem");
  validateFilenameExtension(originalFilename, detectedMime);
  return {
    bytes,
    mimeType: detectedMime,
    extension: MIME_EXTENSIONS[detectedMime],
    originalFilename,
    sizeBytes: bytes.byteLength,
    checksumSha256: await sha256Hex(bytes),
  };
}

function detectMimeType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 16 && ascii(bytes, 4, 8) === "ftyp") {
    const brands = ascii(bytes, 8, Math.min(bytes.length, 32));
    if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
  }
  return "";
}

function validateFilenameExtension(filename, mimeType) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) throw badRequest("Extensao do arquivo obrigatoria.");
  if (!FILENAME_EXTENSIONS[mimeType]?.has(match[1])) {
    throw badRequest("Extensao do arquivo nao corresponde ao formato da imagem.");
  }
}

function buildObjectKey({ hotelId, moduleKey, createdAt, assetId, extension }) {
  if (!isSafeIdentifier(hotelId)) throw badRequest("hotel_id invalido.");
  if (moduleKey && !isSafeIdentifier(moduleKey)) throw badRequest("module_key invalido.");
  const date = new Date(createdAt);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const scope = moduleKey || "shared";
  return `hotels/${hotelId}/${scope}/${year}/${month}/${assetId}.${extension}`;
}

function sanitizeFilename(value) {
  return String(value || "imagem")
    .split(/[/\\]/)
    .at(-1)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "imagem";
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function ascii(bytes, start, end) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function requireMediaBucket(env) {
  if (!env?.MEDIA_BUCKET?.put || !env.MEDIA_BUCKET.get || !env.MEDIA_BUCKET.delete) {
    throw new AppError(503, "storage_unavailable", "Armazenamento de midia indisponivel.");
  }
  return env.MEDIA_BUCKET;
}

function auditStatement(env, { hotelId, moduleKey, actorUserId, action, entityId, metadata, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, 'media_asset', ?, ?, ?)`,
    [
      createPublicId("audit"),
      hotelId || null,
      moduleKey || null,
      actorUserId,
      action,
      entityId,
      JSON.stringify(metadata || {}),
      createdAt,
    ],
  );
}

function formatMediaAsset(row) {
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    module_key: row.module_key || null,
    public_url: row.public_url,
    alt_text: row.alt_text || null,
    mime_type: row.mime_type || null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at || null,
    original_filename: row.original_filename || null,
    size_bytes: row.size_bytes == null ? null : Number(row.size_bytes),
    checksum_sha256: row.checksum_sha256 || null,
    storage_etag: row.storage_etag || null,
    uploaded_by_user_id: row.uploaded_by_user_id || null,
    archived_by_user_id: row.archived_by_user_id || null,
  };
}
