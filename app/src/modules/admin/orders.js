import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import { assertAdminMutationAllowed, requireAdminHotelAccess, requirePermission } from "../../services/admin-auth.js";
import { erpActorIds } from "../../services/erp-auth.js";
import { getRoomServiceOrderPrintingState } from "./erp-printing.js";

const MODULE_KEY = "room-service";
const READ_PERMISSION = "room-service.orders.read";
const WRITE_PERMISSION = "room-service.orders.write";

const PUBLIC_TO_STORAGE_STATUS = {
  sent: "received",
  printed: "ready",
  delivered: "delivered",
  cancelled: "cancelled",
};

const STORAGE_TO_PUBLIC_STATUS = {
  received: "sent",
  accepted: "sent",
  preparing: "sent",
  ready: "printed",
  delivered: "delivered",
  completed: "delivered",
};

const ALLOWED_TRANSITIONS = {
  sent: ["printed", "cancelled"],
  printed: ["delivered", "cancelled"],
};

export async function listAdminHotels({ env, session }) {
  requirePermission(session, READ_PERMISSION);
  return {
    hotels: session.hotels,
  };
}

export async function listAdminOrders({ env, session, url, permissionKey = READ_PERMISSION }) {
  requirePermission(session, permissionKey);
  const hotelId = optionalString(url.searchParams.get("hotel_id"), "hotel_id", { max: 80 });
  const status = optionalString(url.searchParams.get("status"), "status", { max: 40 });
  const search = optionalString(url.searchParams.get("q"), "q", { max: 120 });
  const date = validateLocalDate(url.searchParams.get("date"));

  const hotelIds = hotelId ? [hotelId] : session.hotel_ids;
  if (hotelId) requireAdminHotelAccess(session, hotelId);
  if (!hotelIds.length) return { orders: [] };

  const filters = [`o.module_key = ?`];
  const params = [MODULE_KEY];
  filters.push(`o.hotel_id IN (${hotelIds.map(() => "?").join(", ")})`);
  params.push(...hotelIds);

  if (date) {
    if (hotelIds.length !== 1) throw badRequest("hotel_id obrigatorio ao filtrar pedidos por data.");
    const hotel = await first(env, "SELECT timezone FROM hotels WHERE id = ? LIMIT 1", [hotelIds[0]]);
    if (!hotel) throw notFoundError("Unidade administrativa nao encontrada.");
    const range = localDayUtcRange(date, hotel.timezone || "America/Sao_Paulo");
    filters.push("o.created_at >= ? AND o.created_at < ?");
    params.push(range.start, range.end);
  }

  if (status) {
    const publicStatus = toPublicStatus(toStorageStatus(status));
    if (publicStatus === "sent") {
      filters.push("o.status IN ('received', 'accepted', 'preparing')");
    } else {
      filters.push("o.status = ?");
      params.push(toStorageStatus(publicStatus));
    }
  }

  if (search) {
    filters.push("(o.public_id LIKE ? OR o.room_code LIKE ? OR o.guest_name LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const rows = await all(
    env,
    `SELECT o.id, o.public_id, o.hotel_id, h.name AS hotel_name,
            h.timezone, o.module_key, o.origin, o.room_code, o.guest_name,
            o.currency, o.subtotal_cents, o.total_cents, o.status,
            o.preparation_mode, o.scheduled_for, o.created_at, o.updated_at,
            (
              SELECT COUNT(*)
                FROM orders sequence
               WHERE sequence.hotel_id = o.hotel_id
                 AND sequence.module_key = o.module_key
                 AND (
                   sequence.created_at < o.created_at
                   OR (sequence.created_at = o.created_at AND sequence.id <= o.id)
                 )
            ) AS display_number,
            COUNT(oi.id) AS item_count
       FROM orders o
       JOIN hotels h ON h.id = o.hotel_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE ${filters.join(" AND ")}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 100`,
    params,
  );

  return {
    orders: rows.map(formatOrderListRow),
  };
}

export async function getAdminOrder({ env, session, orderId }) {
  requirePermission(session, READ_PERMISSION);
  const detail = await loadOrderDetail(env, orderId, session.hotel_ids);
  if (!detail) throw notFoundError("Pedido nao encontrado.");
  return detail;
}

export async function updateAdminOrderStatus({ request, env, session, orderId }) {
  requirePermission(session, WRITE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const targetPublicStatus = requireString(payload.status, "status", { max: 40 });
  const note = optionalString(payload.note, "note", { max: 500 });

  if (!session.hotel_ids.length) throw notFoundError("Pedido nao encontrado.");

  const hotelPlaceholders = session.hotel_ids.map(() => "?").join(", ");
  const current = await first(
    env,
    `SELECT id, public_id, hotel_id, module_key, status
       FROM orders
      WHERE id = ?
        AND module_key = ?
        AND hotel_id IN (${hotelPlaceholders})
      LIMIT 1`,
    [orderId, MODULE_KEY, ...session.hotel_ids],
  );

  if (!current) throw notFoundError("Pedido nao encontrado.");

  const currentPublicStatus = toPublicStatus(current.status);
  const targetStorageStatus = toStorageStatus(targetPublicStatus);
  const normalizedTargetPublicStatus = toPublicStatus(targetStorageStatus);

  if (currentPublicStatus === normalizedTargetPublicStatus) {
    const detail = await loadOrderDetail(env, orderId, session.hotel_ids);
    return {
      idempotent: true,
      order: detail.order,
    };
  }

  const allowed = ALLOWED_TRANSITIONS[currentPublicStatus] || [];
  if (!allowed.includes(normalizedTargetPublicStatus)) {
    throw conflict("Transicao de status invalida.", {
      current_status: currentPublicStatus,
      target_status: normalizedTargetPublicStatus,
    });
  }

  if (normalizedTargetPublicStatus === "cancelled" && !note) {
    throw badRequest("Cancelamento exige uma nota.");
  }

  const createdAt = requestNow({ request, env });
  const historyId = createPublicId("hist");
  const auditId = createPublicId("audit");
  const historyNote = note || defaultStatusNote(normalizedTargetPublicStatus);
  const auditMetadata = {
    public_id: current.public_id,
    previous_status: currentPublicStatus,
    target_status: normalizedTargetPublicStatus,
    storage_status: targetStorageStatus,
  };
  const actor = erpActorIds(session);

  let batchResults;
  try {
    batchResults = await batch(env, [
      statement(
        env,
        `UPDATE orders
            SET status = ?,
                updated_at = ?,
                cancelled_at = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_at END
          WHERE id = ?
            AND hotel_id = ?
            AND module_key = ?
            AND status = ?`,
        [
          targetStorageStatus,
          createdAt,
          targetStorageStatus,
          createdAt,
          current.id,
          current.hotel_id,
          MODULE_KEY,
          current.status,
        ],
      ),
      statement(
        env,
        `INSERT INTO order_status_history (
           id, order_id, hotel_id, module_key, status, note,
           actor_user_id, actor_erp_user_id, created_at
         )
         SELECT ?, o.id, o.hotel_id, o.module_key, ?, ?, ?, ?, ?
           FROM orders o
          WHERE o.id = ?
            AND o.hotel_id = ?
            AND o.module_key = ?
            AND o.status = ?
            AND o.updated_at = ?
            AND NOT EXISTS (
              SELECT 1
                FROM order_status_history h
               WHERE h.order_id = o.id
                 AND h.status = ?
            )`,
        [
          historyId,
          normalizedTargetPublicStatus,
          historyNote,
          actor.adminUserId,
          actor.erpUserId,
          createdAt,
          current.id,
          current.hotel_id,
          MODULE_KEY,
          targetStorageStatus,
          createdAt,
          normalizedTargetPublicStatus,
        ],
      ),
      statement(
        env,
        `INSERT INTO admin_audit_log (
           id, hotel_id, module_key, actor_user_id, actor_erp_user_id, action, entity_type,
           entity_id, metadata_json, created_at
         )
         SELECT ?, o.hotel_id, o.module_key, ?, ?, ?, ?, o.id, ?, ?
           FROM orders o
          WHERE o.id = ?
            AND o.hotel_id = ?
            AND o.module_key = ?
            AND o.status = ?
            AND o.updated_at = ?
            AND EXISTS (
              SELECT 1
                FROM order_status_history h
               WHERE h.id = ?
                 AND h.order_id = o.id
                 AND h.status = ?
            )`,
        [
          auditId,
          actor.adminUserId,
          actor.erpUserId,
          "room-service.order.status_changed",
          "order",
          JSON.stringify(auditMetadata),
          createdAt,
          current.id,
          current.hotel_id,
          MODULE_KEY,
          targetStorageStatus,
          createdAt,
          historyId,
          normalizedTargetPublicStatus,
        ],
      ),
    ]);
  } catch (error) {
    if (isOrderStatusUniqueConflict(error)) {
      return handleLostStatusRace({
        env,
        orderId,
        hotelIds: session.hotel_ids,
        targetStorageStatus,
        targetPublicStatus: normalizedTargetPublicStatus,
      });
    }
    throw error;
  }

  const updateChanges = changesFromBatchResult(batchResults[0]);
  const historyChanges = changesFromBatchResult(batchResults[1]);
  const auditChanges = changesFromBatchResult(batchResults[2]);

  if (updateChanges !== 1) {
    if (historyChanges !== 0 || auditChanges !== 0) {
      throw new Error("Status update guard failed: dependent inserts ran without a winning update.");
    }
    return handleLostStatusRace({
      env,
      orderId,
      hotelIds: session.hotel_ids,
      targetStorageStatus,
      targetPublicStatus: normalizedTargetPublicStatus,
    });
  }

  if (historyChanges !== 1 || auditChanges !== 1) {
    throw new Error("Status update guard failed: winning update did not create exactly one history and audit record.");
  }

  const detail = await loadOrderDetail(env, orderId, session.hotel_ids);
  return {
    idempotent: false,
    order: detail.order,
  };
}

async function handleLostStatusRace({ env, orderId, hotelIds, targetStorageStatus, targetPublicStatus }) {
  const detail = await loadOrderDetail(env, orderId, hotelIds);
  if (!detail) throw notFoundError("Pedido nao encontrado.");
  if (detail.order.status === targetPublicStatus || detail.order.status === toPublicStatus(targetStorageStatus)) {
    return {
      idempotent: true,
      order: detail.order,
    };
  }
  throw conflict("Pedido ja foi atualizado por outra sessao.", {
    current_status: detail.order.status,
    target_status: targetPublicStatus,
  });
}

function changesFromBatchResult(result) {
  return Number(result?.meta?.changes ?? 0);
}

function isOrderStatusUniqueConflict(error) {
  return /unique constraint failed: order_status_history\.order_id, order_status_history\.status/i.test(String(error?.message || error));
}

async function loadOrderDetail(env, orderId, hotelIds) {
  if (!hotelIds.length) return null;
  const hotelPlaceholders = hotelIds.map(() => "?").join(", ");
  const order = await first(
    env,
    `SELECT o.id, o.public_id, o.hotel_id, h.name AS hotel_name,
            h.timezone, h.locale, o.module_key, o.origin, o.room_code,
            o.guest_name, o.notes, o.currency, o.subtotal_cents,
            o.discount_cents, o.total_cents, o.status, o.created_at,
            o.updated_at, o.cancelled_at, o.preparation_mode, o.scheduled_for,
            (
              SELECT COUNT(*)
                FROM orders sequence
               WHERE sequence.hotel_id = o.hotel_id
                 AND sequence.module_key = o.module_key
                 AND (
                   sequence.created_at < o.created_at
                   OR (sequence.created_at = o.created_at AND sequence.id <= o.id)
                 )
            ) AS display_number
       FROM orders o
       JOIN hotels h ON h.id = o.hotel_id
      WHERE o.id = ?
        AND o.module_key = ?
        AND o.hotel_id IN (${hotelPlaceholders})
      LIMIT 1`,
    [orderId, MODULE_KEY, ...hotelIds],
  );
  if (!order) return null;

  const items = await all(
    env,
    `SELECT id, catalog_item_id, item_name_snapshot,
            item_description_snapshot, unit_price_cents, quantity,
            line_total_cents, selected_options_snapshot, created_at
       FROM order_items
      WHERE order_id = ?
        AND hotel_id = ?
        AND module_key = ?
      ORDER BY created_at, id`,
    [order.id, order.hotel_id, MODULE_KEY],
  );

  const history = await all(
    env,
    `SELECT id, status, note, actor_user_id, actor_erp_user_id, created_at
       FROM order_status_history
      WHERE order_id = ?
        AND hotel_id = ?
        AND module_key = ?
      ORDER BY created_at, id`,
    [order.id, order.hotel_id, MODULE_KEY],
  );

  const printEvents = await all(
    env,
    `SELECT id, status, attempts, last_error, requested_at, printed_at,
            created_at, updated_at, completed_at, job_kind, device_id, template_id
       FROM print_events
      WHERE order_id = ?
        AND hotel_id = ?
        AND module_key = ?
      ORDER BY created_at, id`,
    [order.id, order.hotel_id, MODULE_KEY],
  );
  const printing = await getRoomServiceOrderPrintingState({ env, hotelId: order.hotel_id });

  return {
    order: formatOrderDetail(order, items, history, printEvents, printing),
  };
}

function formatOrderListRow(row) {
  return {
    id: row.id,
    public_id: row.public_id,
    display_number: Number(row.display_number || 0) || null,
    hotel_id: row.hotel_id,
    hotel_name: row.hotel_name,
    timezone: row.timezone,
    module_key: row.module_key,
    origin: row.origin,
    room_code: row.room_code,
    guest_name: row.guest_name,
    currency: row.currency,
    subtotal_cents: row.subtotal_cents,
    total_cents: row.total_cents,
    status: toPublicStatus(row.status),
    preparation_mode: row.preparation_mode || "now",
    scheduled_for: row.scheduled_for || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: Number(row.item_count || 0),
  };
}

function formatOrderDetail(order, items, history, printEvents, printing) {
  return {
    ...formatOrderListRow({ ...order, item_count: items.length }),
    locale: order.locale,
    notes: order.notes,
    delivery: parseDelivery(order.notes, order.room_code),
    discount_cents: order.discount_cents,
    cancelled_at: order.cancelled_at,
    items: items.map((item) => ({
      id: item.id,
      catalog_item_id: item.catalog_item_id,
      name: item.item_name_snapshot,
      description: item.item_description_snapshot,
      unit_price_cents: item.unit_price_cents,
      quantity: item.quantity,
      line_total_cents: item.line_total_cents,
      selected_options: parseJson(item.selected_options_snapshot),
      created_at: item.created_at,
    })),
    history: history.map((entry) => ({
      id: entry.id,
      status: toPublicStatus(entry.status),
      note: entry.note,
      actor_user_id: entry.actor_user_id,
      actor_erp_user_id: entry.actor_erp_user_id,
      created_at: entry.created_at,
    })),
    printing: {
      ...printing,
      event_count: printEvents.length,
      latest_event: printEvents.at(-1) || null,
      events: printEvents,
    },
  };
}

function parseDelivery(notes, fallbackRoomCode) {
  const segments = String(notes || "")
    .split(/[;\r\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const observation = [];
  let location = "";
  let contact = "";

  for (const segment of segments) {
    const normalized = normalizeLabel(segment);
    if (normalized.startsWith("local de entrega:")) {
      location = valueAfterColon(segment);
      continue;
    }
    if (normalized.startsWith("contato:")) {
      contact = valueAfterColon(segment);
      continue;
    }
    if (normalized.startsWith("observacao:")) {
      const value = valueAfterColon(segment);
      if (value) observation.push(value);
      continue;
    }
    observation.push(segment);
  }

  return {
    location,
    room_code: fallbackRoomCode || "",
    contact,
    observation: observation.join(" ").trim(),
  };
}

function normalizeLabel(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function valueAfterColon(value) {
  return String(value).split(":").slice(1).join(":").trim();
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toStorageStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  const mapped = PUBLIC_TO_STORAGE_STATUS[normalized];
  if (!mapped) throw badRequest("Status administrativo invalido.");
  return mapped;
}

function toPublicStatus(status) {
  return STORAGE_TO_PUBLIC_STATUS[status] || status;
}

function defaultStatusNote(status) {
  const notes = {
    printed: "Pedido impresso.",
    delivered: "Pedido entregue.",
    cancelled: "Pedido cancelado.",
  };
  return notes[status] || "Status atualizado.";
}

function validateLocalDate(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) throw badRequest("date deve usar o formato YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw badRequest("date invalida.");
  }
  return normalized;
}

function localDayUtcRange(dateKey, timezone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: zonedMidnightToIso({ year, month, day }, timezone),
    end: zonedMidnightToIso({
      year: nextDate.getUTCFullYear(),
      month: nextDate.getUTCMonth() + 1,
      day: nextDate.getUTCDate(),
    }, timezone),
  };
}

function zonedMidnightToIso(parts, timezone) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const formatted = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).map((entry) => [entry.type, entry.value]),
    );
    const represented = Date.UTC(
      Number(formatted.year),
      Number(formatted.month) - 1,
      Number(formatted.day),
      Number(formatted.hour),
      Number(formatted.minute),
      Number(formatted.second),
    );
    instant += target - represented;
  }

  return new Date(instant).toISOString();
}
