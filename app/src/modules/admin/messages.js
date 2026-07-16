import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, forbidden, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import { assertAdminMutationAllowed } from "../../services/admin-auth.js";

const BOXES = new Set(["inbox", "sent"]);

export async function listAdminMessageRecipients({ env, session }) {
  const users = await all(
    env,
    `SELECT DISTINCT u.id, u.user_number, u.display_name, u.email
       FROM admin_users u
       LEFT JOIN admin_hotel_access recipient_access ON recipient_access.user_id = u.id
      WHERE u.status = 'active'
        AND u.id <> ?
        AND (
          recipient_access.hotel_id IN (
            SELECT hotel_id FROM admin_hotel_access WHERE user_id = ?
          )
          OR EXISTS (
            SELECT 1 FROM admin_hotel_access WHERE user_id = ?
          ) = 0
        )
      ORDER BY u.display_name, u.id
      LIMIT 250`,
    [session.user.id, session.user.id, session.user.id],
  );
  return { recipients: users.map(formatRecipient) };
}

export async function listAdminMessages({ env, session, url }) {
  const box = optionalString(url.searchParams.get("box"), "box", { max: 20 }) || "inbox";
  if (!BOXES.has(box)) throw badRequest("Caixa de mensagens inválida.");
  const ownerColumn = box === "sent" ? "m.sender_user_id" : "m.recipient_user_id";
  const archivedColumn = box === "sent" ? "m.archived_by_sender_at" : "m.archived_by_recipient_at";
  const counterpartJoin = box === "sent" ? "recipient.id = m.recipient_user_id" : "sender.id = m.sender_user_id";
  const counterpartNumber = box === "sent" ? "recipient.user_number" : "sender.user_number";
  const counterpartName = box === "sent" ? "recipient.display_name" : "sender.display_name";
  const counterpartEmail = box === "sent" ? "recipient.email" : "sender.email";
  const rows = await all(
    env,
    `SELECT m.id, m.subject, m.body, m.created_at, m.read_at,
            ${counterpartNumber} AS counterpart_number,
            ${counterpartName} AS counterpart_name,
            ${counterpartEmail} AS counterpart_email
       FROM admin_messages m
       JOIN admin_users sender ON sender.id = m.sender_user_id
       JOIN admin_users recipient ON recipient.id = m.recipient_user_id
      WHERE ${ownerColumn} = ?
        AND ${archivedColumn} IS NULL
        AND ${counterpartJoin}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 200`,
    [session.user.id],
  );
  return { box, messages: rows.map((row) => formatMessage(row, box)) };
}

export async function createAdminMessage({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const recipientUserId = requireString(payload.recipient_user_id, "destinatário", { max: 120 });
  const subject = requireString(payload.subject, "assunto", { max: 160 });
  const body = requireString(payload.body, "mensagem", { max: 5000 });
  if (recipientUserId === session.user.id) throw badRequest("Escolha outro usuário como destinatário.");
  await assertRecipientAllowed(env, session.user.id, recipientUserId);

  const id = createPublicId("admin_message");
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `INSERT INTO admin_messages (
         id, sender_user_id, recipient_user_id, subject, body, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, session.user.id, recipientUserId, subject, body, now],
    ),
    auditStatement(env, {
      actorUserId: session.user.id,
      action: "admin-message.send",
      entityId: id,
      metadata: { recipient_user_id: recipientUserId },
      createdAt: now,
    }),
  ]);
  return { message: { id, subject, created_at: now } };
}

export async function markAdminMessageRead({ request, env, session, messageId }) {
  assertAdminMutationAllowed({ request });
  const message = await first(
    env,
    `SELECT id, recipient_user_id, read_at FROM admin_messages WHERE id = ? LIMIT 1`,
    [messageId],
  );
  if (!message) throw notFoundError("Mensagem não encontrada.");
  if (message.recipient_user_id !== session.user.id) throw forbidden("Esta mensagem não pertence à sua caixa de entrada.");
  if (message.read_at) return { message_id: messageId, read_at: message.read_at, changed: false };
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE admin_messages
          SET read_at = ?
        WHERE id = ? AND recipient_user_id = ? AND read_at IS NULL`,
      [now, messageId, session.user.id],
    ),
    auditStatement(env, {
      actorUserId: session.user.id,
      action: "admin-message.read",
      entityId: messageId,
      metadata: {},
      createdAt: now,
    }),
  ]);
  return { message_id: messageId, read_at: now, changed: true };
}

async function assertRecipientAllowed(env, senderUserId, recipientUserId) {
  const recipient = await first(
    env,
    `SELECT u.id
       FROM admin_users u
      WHERE u.id = ?
        AND u.status = 'active'
        AND (
          EXISTS (
            SELECT 1
              FROM admin_hotel_access sender_access
              JOIN admin_hotel_access recipient_access
                ON recipient_access.hotel_id = sender_access.hotel_id
             WHERE sender_access.user_id = ?
               AND recipient_access.user_id = u.id
          )
          OR EXISTS (
            SELECT 1 FROM admin_hotel_access WHERE user_id = ?
          ) = 0
        )
      LIMIT 1`,
    [recipientUserId, senderUserId, senderUserId],
  );
  if (!recipient) throw notFoundError("Destinatário não encontrado entre os usuários disponíveis.");
}

function formatRecipient(row) {
  return {
    id: row.id,
    number: Number(row.user_number || 0) || null,
    display_name: row.display_name,
    email: row.email,
  };
}

function formatMessage(row, box) {
  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    created_at: row.created_at,
    read_at: row.read_at || null,
    box,
    counterpart: {
      number: Number(row.counterpart_number || 0) || null,
      display_name: row.counterpart_name,
      email: row.counterpart_email,
    },
  };
}

function auditStatement(env, { actorUserId, action, entityId, metadata, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     ) VALUES (?, NULL, NULL, ?, ?, 'admin_message', ?, ?, ?)`,
    [createPublicId("audit"), actorUserId, action, entityId, JSON.stringify(metadata || {}), createdAt],
  );
}
