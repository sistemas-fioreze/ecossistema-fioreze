import { batch, first, statement } from "../../core/database.js";
import { badRequest, notFoundError, unauthorized } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { readJson, requireString } from "../../core/validation.js";
import { assertAdminMutationAllowed, hashPassword, verifyPassword } from "../../services/admin-auth.js";
import { erpActorIds } from "../../services/erp-auth.js";
import { readMultipartForm } from "./media.js";
import { storeErpImage } from "./erp-media.js";

const MODULE_KEY = "room-service";

export async function uploadOwnRoomServiceErpAvatar({ request, env, session }) {
  assertOperationalSession(session);
  assertAdminMutationAllowed({ request });
  const form = await readMultipartForm(request);
  return storeErpImage({
    request,
    env,
    session,
    hotelId: session.user.hotel_id,
    file: form.get("file"),
    altText: "Foto de perfil do ERP",
    avatarUserId: session.user.id,
  });
}

export async function deleteOwnRoomServiceErpAvatar({ request, env, session }) {
  assertOperationalSession(session);
  assertAdminMutationAllowed({ request });
  const now = requestNow({ request, env });
  const current = await first(
    env,
    `SELECT avatar_media_asset_id
       FROM erp_users
      WHERE id = ? AND hotel_id = ?
      LIMIT 1`,
    [session.user.id, session.user.hotel_id],
  );
  if (!current) throw notFoundError("Usuario do ERP nao encontrado.");
  if (!current.avatar_media_asset_id) return { avatar_removed: false };
  await batch(env, [
    statement(
      env,
      `UPDATE erp_users
          SET avatar_media_asset_id = NULL, avatar_updated_at = NULL, updated_at = ?
        WHERE id = ? AND hotel_id = ?`,
      [now, session.user.id, session.user.hotel_id],
    ),
    profileAuditStatement(env, session, {
      action: "room-service.erp_profile.avatar_removed",
      metadata: { previous_media_asset_id: current.avatar_media_asset_id },
      createdAt: now,
    }),
  ]);
  return { avatar_removed: true };
}

export async function changeOwnRoomServiceErpPassword({ request, env, session }) {
  assertOperationalSession(session);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const currentPassword = requireString(payload.current_password, "current_password", { max: 300 });
  const newPassword = requireString(payload.new_password, "new_password", { min: 4, max: 300 });
  if (newPassword.length < 4) throw badRequest("A nova senha deve ter ao menos 4 caracteres.");
  const user = await first(
    env,
    `SELECT id, hotel_id, password_hash, password_strategy
       FROM erp_users
      WHERE id = ? AND hotel_id = ? AND status = 'active'
      LIMIT 1`,
    [session.user.id, session.user.hotel_id],
  );
  if (!user || user.password_strategy !== "pbkdf2" || !(await verifyPassword(currentPassword, user.password_hash))) {
    throw unauthorized("Senha atual invalida.");
  }
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE erp_users
          SET password_hash = ?, password_strategy = 'pbkdf2', updated_at = ?
        WHERE id = ? AND hotel_id = ?`,
      [await hashPassword(newPassword), now, session.user.id, session.user.hotel_id],
    ),
    statement(
      env,
      `UPDATE erp_sessions
          SET revoked_at = ?
        WHERE user_id = ? AND hotel_id = ? AND id <> ? AND revoked_at IS NULL`,
      [now, session.user.id, session.user.hotel_id, session.session_id],
    ),
    profileAuditStatement(env, session, {
      action: "room-service.erp_profile.password_changed",
      metadata: { other_sessions_revoked: true },
      createdAt: now,
    }),
  ]);
  return { password_changed: true, other_sessions_revoked: true };
}

function assertOperationalSession(session) {
  if (session.auth_source !== "erp") {
    throw badRequest("O administrador mestre deve gerenciar sua conta pela Central Administrativa.");
  }
}

function profileAuditStatement(env, session, { action, metadata, createdAt }) {
  const actor = erpActorIds(session);
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, actor_erp_user_id,
       action, entity_type, entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'erp_user', ?, ?, ?)`,
    [
      createPublicId("audit"),
      session.user.hotel_id,
      MODULE_KEY,
      actor.adminUserId,
      actor.erpUserId,
      action,
      session.user.id,
      JSON.stringify(metadata || {}),
      createdAt,
    ],
  );
}
