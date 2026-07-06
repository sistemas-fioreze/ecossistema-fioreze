import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { nowIso } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import { requireAdminHotelAccess, requirePermission } from "../../services/admin-auth.js";

const MODULE_KEY = "room-service";
const READ_PERMISSION = "room-service.orders.read";
const WRITE_PERMISSION = "room-service.orders.write";

const PUBLIC_TO_STORAGE_STATUS = {
  received: "received",
  preparing: "preparing",
  ready: "ready",
  completed: "delivered",
  cancelled: "cancelled",
};

const STORAGE_TO_PUBLIC_STATUS = {
  delivered: "completed",
};

const ALLOWED_TRANSITIONS = {
  received: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
};

export async function listAdminHotels({ env, session }) {
  requirePermission(session, READ_PERMISSION);
  return {
    hotels: session.hotels,
  };
}

export async function listAdminOrders({ env, session, url }) {
  requirePermission(session, READ_PERMISSION);
  const hotelId = optionalString(url.searchParams.get("hotel_id"), "hotel_id", { max: 80 });
  const status = optionalString(url.searchParams.get("status"), "status", { max: 40 });
  const search = optionalString(url.searchParams.get("q"), "q", { max: 120 });

  const hotelIds = hotelId ? [hotelId] : session.hotel_ids;
  if (hotelId) requireAdminHotelAccess(session, hotelId);
  if (!hotelIds.length) return { orders: [] };

  const filters = [`o.module_key = ?`];
  const params = [MODULE_KEY];
  filters.push(`o.hotel_id IN (${hotelIds.map(() => "?").join(", ")})`);
  params.push(...hotelIds);

  if (status) {
    const storageStatus = toStorageStatus(status);
    filters.push("o.status = ?");
    params.push(storageStatus);
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
            o.created_at, o.updated_at,
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
  const detail = await loadOrderDetail(env, orderId);
  if (!detail) throw notFoundError("Pedido nao encontrado.");
  requireAdminHotelAccess(session, detail.order.hotel_id);
  return detail;
}

export async function updateAdminOrderStatus({ request, env, session, orderId }) {
  requirePermission(session, WRITE_PERMISSION);
  const payload = await readJson(request);
  const targetPublicStatus = requireString(payload.status, "status", { max: 40 });
  const note = optionalString(payload.note, "note", { max: 500 });
  const current = await first(
    env,
    `SELECT id, public_id, hotel_id, module_key, status
       FROM orders
      WHERE id = ?
        AND module_key = ?
      LIMIT 1`,
    [orderId, MODULE_KEY],
  );

  if (!current) throw notFoundError("Pedido nao encontrado.");
  requireAdminHotelAccess(session, current.hotel_id);

  const currentPublicStatus = toPublicStatus(current.status);
  const targetStorageStatus = toStorageStatus(targetPublicStatus);
  const normalizedTargetPublicStatus = toPublicStatus(targetStorageStatus);

  if (current.status === targetStorageStatus) {
    const detail = await getAdminOrder({ env, session, orderId });
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

  const createdAt = requestNow(request);
  const historyNote = note || defaultStatusNote(normalizedTargetPublicStatus);
  const auditMetadata = {
    public_id: current.public_id,
    previous_status: currentPublicStatus,
    target_status: normalizedTargetPublicStatus,
    storage_status: targetStorageStatus,
  };

  await batch(env, [
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
         id, order_id, hotel_id, module_key, status, note, actor_user_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createPublicId("hist"),
        current.id,
        current.hotel_id,
        MODULE_KEY,
        normalizedTargetPublicStatus,
        historyNote,
        session.user.id,
        createdAt,
      ],
    ),
    statement(
      env,
      `INSERT INTO admin_audit_log (
         id, hotel_id, module_key, actor_user_id, action, entity_type,
         entity_id, metadata_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createPublicId("audit"),
        current.hotel_id,
        MODULE_KEY,
        session.user.id,
        "room-service.order.status_changed",
        "order",
        current.id,
        JSON.stringify(auditMetadata),
        createdAt,
      ],
    ),
  ]);

  const detail = await getAdminOrder({ env, session, orderId });
  return {
    idempotent: false,
    order: detail.order,
  };
}

async function loadOrderDetail(env, orderId) {
  const order = await first(
    env,
    `SELECT o.id, o.public_id, o.hotel_id, h.name AS hotel_name,
            h.timezone, h.locale, o.module_key, o.origin, o.room_code,
            o.guest_name, o.notes, o.currency, o.subtotal_cents,
            o.discount_cents, o.total_cents, o.status, o.created_at,
            o.updated_at, o.cancelled_at
       FROM orders o
       JOIN hotels h ON h.id = o.hotel_id
      WHERE o.id = ?
        AND o.module_key = ?
      LIMIT 1`,
    [orderId, MODULE_KEY],
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
    `SELECT id, status, note, actor_user_id, created_at
       FROM order_status_history
      WHERE order_id = ?
        AND hotel_id = ?
        AND module_key = ?
      ORDER BY created_at, id`,
    [order.id, order.hotel_id, MODULE_KEY],
  );

  const printEvents = await all(
    env,
    `SELECT id, status, attempts, last_error, requested_at, printed_at, created_at
       FROM print_events
      WHERE order_id = ?
        AND hotel_id = ?
        AND module_key = ?
      ORDER BY created_at, id`,
    [order.id, order.hotel_id, MODULE_KEY],
  );

  return {
    order: formatOrderDetail(order, items, history, printEvents),
  };
}

function formatOrderListRow(row) {
  return {
    id: row.id,
    public_id: row.public_id,
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
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: Number(row.item_count || 0),
  };
}

function formatOrderDetail(order, items, history, printEvents) {
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
      created_at: entry.created_at,
    })),
    printing: {
      enabled: false,
      message: "Impressao desativada neste ambiente.",
      event_count: printEvents.length,
      events: printEvents,
    },
  };
}

function parseDelivery(notes, fallbackRoomCode) {
  const lines = String(notes || "").split(/\r?\n/);
  const localLine = lines.find((line) => line.toLowerCase().startsWith("local de entrega:"));
  const contactLine = lines.find((line) => line.toLowerCase().startsWith("contato:"));
  return {
    location: localLine ? localLine.split(":").slice(1).join(":").trim() : "Acomodacao",
    room_code: fallbackRoomCode || "",
    contact: contactLine ? contactLine.split(":").slice(1).join(":").trim() : "",
  };
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
    preparing: "Pedido em preparo.",
    ready: "Pedido pronto.",
    completed: "Pedido concluido.",
    cancelled: "Pedido cancelado.",
  };
  return notes[status] || "Status atualizado.";
}

function requestNow(request) {
  const testNow = request.headers.get("x-fioreze-test-now");
  if (testNow) {
    const date = new Date(testNow);
    if (Number.isNaN(date.getTime())) throw badRequest("x-fioreze-test-now invalido.");
    return date.toISOString();
  }
  return nowIso();
}
