import { batch, first, statement } from "../../core/database.js";
import { AppError, badRequest, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, requireString } from "../../core/validation.js";
import { assertAdminMutationAllowed } from "../../services/admin-auth.js";
import { erpActorIds } from "../../services/erp-auth.js";
import {
  formText,
  readMultipartForm,
  requireMediaBucket,
  validateImageFile,
} from "./media.js";

const MODULE_KEY = "room-service";
const SUPPORT_SENDER_ID = "system-erp-support";

export async function createRoomServiceErpFeedback({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  const form = await readMultipartForm(request);
  const description = requireString(formText(form, "description"), "descricao", { min: 10, max: 3000 });
  const sourceRoute = normalizeSourceRoute(optionalString(formText(form, "source_route"), "source_route", { max: 300 }));
  const hotel = session.hotels?.find((entry) => entry.hotel_id === session.hotel_ids?.[0]);
  const hotelId = hotel?.hotel_id;
  if (!hotelId) throw badRequest("Unidade do ERP nao encontrada.");

  const recipient = await first(
    env,
    `SELECT id
       FROM admin_users
      WHERE user_number = 1
        AND status = 'active'
      LIMIT 1`,
  );
  if (!recipient) throw notFoundError("Administrador de suporte indisponivel.");

  const messageId = createPublicId("admin_message");
  const now = requestNow({ request, env });
  const actor = erpActorIds(session);
  const screenshot = form.get("screenshot");
  let attachment = null;
  let bucket = null;

  if (screenshot && typeof screenshot.arrayBuffer === "function" && screenshot.size > 0) {
    bucket = requireMediaBucket(env);
    const validated = await validateImageFile(screenshot);
    const date = new Date(now);
    const objectKey = [
      "support",
      "erp-feedback",
      hotelId,
      String(date.getUTCFullYear()),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      `${messageId}.${validated.extension}`,
    ].join("/");
    try {
      await bucket.put(objectKey, validated.bytes, {
        httpMetadata: { contentType: validated.mimeType, cacheControl: "private, no-store" },
        customMetadata: { message_id: messageId, hotel_id: hotelId, purpose: "erp-feedback" },
      });
    } catch {
      throw new AppError(503, "feedback_storage_unavailable", "Nao foi possivel anexar a captura.");
    }
    attachment = {
      objectKey,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      checksumSha256: validated.checksumSha256,
    };
  }

  const reporter = session.auth_source === "erp"
    ? `${session.user.display_name} (usuario ${Number(session.user.user_code || 0)})`
    : `${session.user.display_name} (administrador mestre)`;
  const subject = `Problema no ERP - ${hotel.short_name || hotel.name || hotelId}`.slice(0, 160);
  const body = [
    `Unidade: ${hotel.name || hotelId}`,
    `Relatado por: ${reporter}`,
    sourceRoute ? `Tela: ${sourceRoute}` : "",
    "",
    description,
  ].filter((line) => line !== "").join("\n");

  try {
    await batch(env, [
      statement(
        env,
        `INSERT INTO admin_messages (
           id, sender_user_id, recipient_user_id, subject, body, created_at,
           source_kind, source_hotel_id, source_erp_user_id,
           attachment_object_key, attachment_mime_type, attachment_size_bytes,
           attachment_checksum_sha256
         ) VALUES (?, ?, ?, ?, ?, ?, 'erp_feedback', ?, ?, ?, ?, ?, ?)`,
        [
          messageId,
          SUPPORT_SENDER_ID,
          recipient.id,
          subject,
          body,
          now,
          hotelId,
          actor.erpUserId,
          attachment?.objectKey || null,
          attachment?.mimeType || null,
          attachment?.sizeBytes || null,
          attachment?.checksumSha256 || null,
        ],
      ),
      statement(
        env,
        `INSERT INTO admin_audit_log (
           id, hotel_id, module_key, actor_user_id, actor_erp_user_id,
           action, entity_type, entity_id, metadata_json, created_at
         ) VALUES (?, ?, ?, ?, ?, 'room-service.erp_feedback.sent', 'admin_message', ?, ?, ?)`,
        [
          createPublicId("audit"),
          hotelId,
          MODULE_KEY,
          actor.adminUserId,
          actor.erpUserId,
          messageId,
          JSON.stringify({ has_screenshot: Boolean(attachment), source_route: sourceRoute || null }),
          now,
        ],
      ),
    ]);
  } catch {
    if (attachment && bucket) await bucket.delete(attachment.objectKey).catch(() => null);
    throw new AppError(500, "feedback_send_failed", "Nao foi possivel enviar o relato.");
  }

  return { message_id: messageId, sent: true, screenshot_attached: Boolean(attachment) };
}

export async function serveErpFeedbackScreenshot({ env, session, messageId }) {
  const message = await first(
    env,
    `SELECT attachment_object_key, attachment_mime_type, attachment_size_bytes
       FROM admin_messages
      WHERE id = ?
        AND recipient_user_id = ?
        AND source_kind = 'erp_feedback'
        AND attachment_object_key IS NOT NULL
      LIMIT 1`,
    [messageId, session.user.id],
  );
  if (!message) throw notFoundError("Captura nao encontrada.");
  const object = await requireMediaBucket(env).get(message.attachment_object_key);
  if (!object) throw notFoundError("Captura nao encontrada.");
  const headers = new Headers();
  headers.set("content-type", message.attachment_mime_type || object.httpMetadata?.contentType || "image/png");
  headers.set("cache-control", "private, no-store");
  headers.set("content-disposition", "inline");
  if (message.attachment_size_bytes) headers.set("content-length", String(message.attachment_size_bytes));
  return new Response(object.body, { status: 200, headers });
}

function normalizeSourceRoute(value) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) throw badRequest("source_route invalida.");
  return value;
}
