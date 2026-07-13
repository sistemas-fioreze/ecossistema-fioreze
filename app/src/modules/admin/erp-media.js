import { all, batch, statement } from "../../core/database.js";
import { AppError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, requireString } from "../../core/validation.js";
import {
  assertAdminMutationAllowed,
  requireAdminHotelAccess,
  requirePermission,
} from "../../services/admin-auth.js";
import { erpActorIds } from "../../services/erp-auth.js";
import {
  PUBLIC_CACHE_CONTROL,
  buildObjectKey,
  formText,
  formatMediaAsset,
  readMultipartForm,
  requireMediaBucket,
  validateImageFile,
} from "./media.js";
import { ERP_CATALOG_MANAGE_PERMISSION } from "./erp-catalog.js";

const MODULE_KEY = "room-service";

export async function listRoomServiceErpMedia({ env, session, url }) {
  requirePermission(session, ERP_CATALOG_MANAGE_PERMISSION);
  const hotelId = requireString(url.searchParams.get("hotel_id"), "hotel_id", { max: 80 });
  requireAdminHotelAccess(session, hotelId);
  const rows = await all(
    env,
    `SELECT id, hotel_id, module_key, public_url, alt_text, mime_type,
            status, created_at, updated_at, archived_at, original_filename,
            size_bytes, checksum_sha256, storage_etag, uploaded_by_user_id,
            uploaded_by_erp_user_id, archived_by_user_id
       FROM media_assets
      WHERE hotel_id = ?
        AND (module_key = ? OR module_key IS NULL)
        AND status = 'active'
      ORDER BY created_at DESC, id DESC
      LIMIT 100`,
    [hotelId, MODULE_KEY],
  );
  return { hotel_id: hotelId, assets: rows.map(formatMediaAsset) };
}

export async function uploadRoomServiceErpMedia({ request, env, session }) {
  requirePermission(session, ERP_CATALOG_MANAGE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const form = await readMultipartForm(request);
  const hotelId = requireString(formText(form, "hotel_id"), "hotel_id", { max: 80 });
  requireAdminHotelAccess(session, hotelId);
  const altText = optionalString(formText(form, "alt_text"), "alt_text", { max: 300 }) || null;
  return storeErpImage({ request, env, session, hotelId, file: form.get("file"), altText });
}

export async function storeErpImage({ request, env, session, hotelId, file, altText, avatarUserId = null }) {
  const bucket = requireMediaBucket(env);
  const validated = await validateImageFile(file);
  const now = requestNow({ request, env });
  const assetId = createPublicId("media");
  const objectKey = buildObjectKey({
    hotelId,
    moduleKey: MODULE_KEY,
    createdAt: now,
    assetId,
    extension: validated.extension,
  });
  const publicUrl = `/media/${assetId}`;
  let putResult;
  try {
    putResult = await bucket.put(objectKey, validated.bytes, {
      httpMetadata: { contentType: validated.mimeType, cacheControl: PUBLIC_CACHE_CONTROL },
      customMetadata: {
        asset_id: assetId,
        hotel_id: hotelId,
        module_key: MODULE_KEY,
        purpose: avatarUserId ? "erp-avatar" : "catalog",
      },
    });
  } catch {
    throw new AppError(503, "storage_unavailable", "Armazenamento de midia indisponivel.");
  }

  const actor = erpActorIds(session);
  const etag = putResult?.httpEtag || putResult?.etag || null;
  const statements = [
    statement(
      env,
      `INSERT INTO media_assets (
         id, hotel_id, module_key, storage_provider, object_key, public_url,
         alt_text, mime_type, status, created_at, updated_at, archived_at,
         original_filename, size_bytes, checksum_sha256, storage_etag,
         uploaded_by_user_id, uploaded_by_erp_user_id, archived_by_user_id
       ) VALUES (?, ?, ?, 'r2', ?, ?, ?, ?, 'active', ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        assetId,
        hotelId,
        MODULE_KEY,
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
        actor.adminUserId,
        actor.erpUserId,
      ],
    ),
  ];
  if (avatarUserId) {
    statements.push(
      statement(
        env,
        `UPDATE erp_users
            SET avatar_media_asset_id = ?, avatar_updated_at = ?, updated_at = ?
          WHERE id = ? AND hotel_id = ?`,
        [assetId, now, now, avatarUserId, hotelId],
      ),
    );
  }
  statements.push(
    mediaAuditStatement(env, actor, {
      hotelId,
      action: avatarUserId ? "room-service.erp_profile.avatar_updated" : "room-service.catalog_media.uploaded",
      entityId: assetId,
      metadata: { mime_type: validated.mimeType, size_bytes: validated.sizeBytes, avatar_user_id: avatarUserId },
      createdAt: now,
    }),
  );

  try {
    await batch(env, statements);
  } catch {
    await bucket.delete(objectKey).catch(() => null);
    throw new AppError(500, "media_metadata_failed", "Imagem enviada, mas os metadados nao puderam ser salvos.");
  }

  return {
    asset: formatMediaAsset({
      id: assetId,
      hotel_id: hotelId,
      module_key: MODULE_KEY,
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
      uploaded_by_user_id: actor.adminUserId,
      uploaded_by_erp_user_id: actor.erpUserId,
      archived_by_user_id: null,
    }),
  };
}

function mediaAuditStatement(env, actor, { hotelId, action, entityId, metadata, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, actor_erp_user_id,
       action, entity_type, entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'media_asset', ?, ?, ?)`,
    [
      createPublicId("audit"),
      hotelId,
      MODULE_KEY,
      actor.adminUserId,
      actor.erpUserId,
      action,
      entityId,
      JSON.stringify(metadata || {}),
      createdAt,
    ],
  );
}
