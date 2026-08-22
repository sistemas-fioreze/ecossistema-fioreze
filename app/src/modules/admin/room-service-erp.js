import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { readJson } from "../../core/validation.js";
import { createRoomServiceOrder } from "../room-service/orders.js";
import { groupProductsByCategory, listRoomServiceProducts } from "../room-service/products.js";
import { listAdminOrders, getAdminOrder, updateAdminOrderStatus } from "./orders.js";
import { assertAdminMutationAllowed, requireAdminHotelAccess, requirePermission } from "../../services/admin-auth.js";
import { ERP_CATALOG_MANAGE_PERMISSION, listRoomServiceCatalogCategories } from "./erp-catalog.js";
import { ERP_SETTINGS_PERMISSION, loadRoomServiceOperationState } from "./erp-operations.js";
import { erpActorIds } from "../../services/erp-auth.js";
import { getRoomServiceOrderPrintingState } from "./erp-printing.js";

const MODULE_KEY = "room-service";
const READ_PERMISSION = "room-service.orders.read";
const WRITE_PERMISSION = "room-service.orders.write";
const DASHBOARD_PERMISSION = "room-service.dashboard.read";
const GUESTS_PERMISSION = "room-service.guests.read";
const BILLING_PERMISSION = "room-service.billing.read";
const CATALOG_PERMISSION = "room-service.catalog.read";
const USERS_PERMISSION = "room-service.users.manage";
const ERP_PERMISSIONS = [
  DASHBOARD_PERMISSION,
  READ_PERMISSION,
  WRITE_PERMISSION,
  GUESTS_PERMISSION,
  BILLING_PERMISSION,
  CATALOG_PERMISSION,
  ERP_CATALOG_MANAGE_PERMISSION,
  ERP_SETTINGS_PERMISSION,
  USERS_PERMISSION,
];

const STATUS_GROUPS = {
  sent: "active",
  printed: "active",
  delivered: "final",
  cancelled: "cancelled",
  archived: "archived",
};

export async function getRoomServiceErpContext({ env, session, url }) {
  requireAnyPermission(session, ERP_PERMISSIONS);
  const hotelId = resolveRequestedHotel(session, url);
  const hotel = requireSessionHotel(session, hotelId);
  const [branding, operation, rooms, printing] = await Promise.all([
    loadBranding(env, hotelId),
    loadRoomServiceOperationState({ env, hotelId, timezone: hotel.timezone }),
    listRooms(env, hotelId),
    getRoomServiceOrderPrintingState({ env, hotelId }),
  ]);

  return {
    module_key: MODULE_KEY,
    selected_hotel_id: hotelId,
    hotel,
    branding,
    service_hours: operation.service_hours,
    operation,
    rooms,
    permissions: {
      can_view_dashboard: hasAnyPermission(session, [DASHBOARD_PERMISSION, READ_PERMISSION]),
      can_read_orders: hasAnyPermission(session, [READ_PERMISSION]),
      can_write_orders: hasAnyPermission(session, [WRITE_PERMISSION]),
      can_create_pdv_order: hasAnyPermission(session, [WRITE_PERMISSION]),
      can_view_guests: hasAnyPermission(session, [GUESTS_PERMISSION, READ_PERMISSION]),
      can_view_billing: hasAnyPermission(session, [BILLING_PERMISSION, READ_PERMISSION]),
      can_view_catalog: hasAnyPermission(session, [CATALOG_PERMISSION, READ_PERMISSION, WRITE_PERMISSION]),
      can_manage_users: hasAnyPermission(session, [USERS_PERMISSION]),
      can_manage_catalog: hasAnyPermission(session, [ERP_CATALOG_MANAGE_PERMISSION]),
      can_manage_settings: hasAnyPermission(session, [ERP_SETTINGS_PERMISSION]),
    },
    printing,
    storage_policy: {
      local_storage: ["theme", "scale", "compact", "preferredHotelId", "route"],
      prohibited: ["orders", "guests", "passwords", "tokens", "personal_data"],
    },
  };
}

export async function getRoomServiceErpDashboard({ env, session, url }) {
  requireAnyPermission(session, [DASHBOARD_PERMISSION, READ_PERMISSION]);
  const hotelId = resolveRequestedHotel(session, url);
  const orders = (
    await listAdminOrders({
      env,
      session,
      url: urlWithHotel(url, hotelId),
      permissionKey: session.permissions.includes(DASHBOARD_PERMISSION) ? DASHBOARD_PERMISSION : READ_PERMISSION,
    })
  ).orders;
  const today = localDateKey(requestNow({ request: { headers: new Headers() }, env }));
  const activeOrders = orders.filter((order) => STATUS_GROUPS[order.status] === "active");
  const finalOrders = orders.filter((order) => STATUS_GROUPS[order.status] === "final");
  const cancelledOrders = orders.filter((order) => STATUS_GROUPS[order.status] === "cancelled");
  const todaysOrders = orders.filter((order) => localDateKey(order.created_at) === today);
  const revenueCents = finalOrders.reduce((total, order) => total + Number(order.total_cents || 0), 0);
  const topItems = await all(
    env,
    `SELECT oi.catalog_item_id, oi.item_name_snapshot AS name,
            SUM(oi.quantity) AS quantity,
            SUM(oi.line_total_cents) AS revenue_cents
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE oi.hotel_id = ?
        AND oi.module_key = ?
        AND o.status != 'cancelled'
      GROUP BY oi.catalog_item_id, oi.item_name_snapshot
      ORDER BY quantity DESC, name
      LIMIT 8`,
    [hotelId, MODULE_KEY],
  );

  return {
    hotel_id: hotelId,
    module_key: MODULE_KEY,
    generated_at: requestNow({ request: { headers: new Headers() }, env }),
    summary: {
      total_orders: orders.length,
      today_orders: todaysOrders.length,
      active_orders: activeOrders.length,
      completed_orders: finalOrders.length,
      cancelled_orders: cancelledOrders.length,
      revenue_cents: revenueCents,
      average_ticket_cents: finalOrders.length ? Math.round(revenueCents / finalOrders.length) : 0,
    },
    by_status: countBy(orders, "status"),
    by_origin: countBy(orders, "origin"),
    by_hour: countBy(
      orders.map((order) => ({ hour: `${String(order.created_at || "").slice(11, 13) || "00"}:00` })),
      "hour",
    ),
    top_items: topItems.map((item) => ({
      ...item,
      quantity: Number(item.quantity || 0),
      revenue_cents: Number(item.revenue_cents || 0),
    })),
    recent_orders: orders.slice(0, 8),
  };
}

export async function listRoomServiceErpOrders({ env, session, url }) {
  requirePermission(session, READ_PERMISSION);
  const hotelId = resolveRequestedHotel(session, url);
  return listAdminOrders({ env, session, url: urlWithHotel(url, hotelId) });
}

export async function getRoomServiceErpOrder({ env, session, orderId }) {
  return getAdminOrder({ env, session, orderId });
}

export async function updateRoomServiceErpOrderStatus({ request, env, session, orderId }) {
  return updateAdminOrderStatus({ request, env, session, orderId });
}

export async function listRoomServiceErpCatalog({ env, session, url }) {
  requireAnyPermission(session, [CATALOG_PERMISSION, READ_PERMISSION, WRITE_PERMISSION]);
  const hotelId = resolveRequestedHotel(session, url);
  const [rows, categories] = await Promise.all([
    listRoomServiceProducts(env, hotelId),
    listRoomServiceCatalogCategories(env, hotelId),
  ]);
  return {
    hotel_id: hotelId,
    module_key: MODULE_KEY,
    categories: groupProductsByCategory(rows),
    category_options: categories,
  };
}

export async function listRoomServiceErpGuests({ env, session, url }) {
  requireAnyPermission(session, [GUESTS_PERMISSION, READ_PERMISSION]);
  const hotelId = resolveRequestedHotel(session, url);
  const [rooms, guests] = await Promise.all([
    listRooms(env, hotelId),
    all(
      env,
      `SELECT gd.id, gd.hotel_id, gd.module_key, gd.room_id, gd.room_code,
              gd.guest_name, gd.phone, gd.source, gd.status, gd.first_seen_at,
              gd.last_seen_at, gd.last_order_id, r.label AS room_label,
              r.room_type, o.public_id AS last_order_public_id
         FROM room_service_guest_directory gd
         LEFT JOIN rooms r ON r.id = gd.room_id AND r.hotel_id = gd.hotel_id
         LEFT JOIN orders o ON o.id = gd.last_order_id AND o.hotel_id = gd.hotel_id
        WHERE gd.hotel_id = ?
          AND gd.module_key = ?
          AND gd.status = 'active'
        ORDER BY gd.guest_name COLLATE NOCASE, gd.room_code`,
      [hotelId, MODULE_KEY],
    ),
  ]);
  return {
    hotel_id: hotelId,
    module_key: MODULE_KEY,
    rooms,
    guests,
    pms_connected: false,
    directory_ready: true,
    message: "Diretorio atualizado automaticamente pelos pedidos confirmados do Room Service.",
  };
}

export async function archiveRoomServiceErpGuest({ request, env, session, guestId }) {
  requirePermission(session, WRITE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = String(payload.hotel_id || "").trim();
  if (!hotelId) throw badRequest("hotel_id obrigatorio.");
  requireAdminHotelAccess(session, hotelId);
  const createdAt = requestNow({ request, env });
  const { adminUserId, erpUserId } = erpActorIds(session);
  const results = await batch(env, [
    statement(
      env,
      `UPDATE room_service_guest_directory
          SET status = 'archived', archived_at = ?,
              archived_by_admin_user_id = ?, archived_by_erp_user_id = ?,
              updated_at = ?
        WHERE id = ? AND hotel_id = ? AND module_key = ? AND status = 'active'`,
      [createdAt, adminUserId, erpUserId, createdAt, guestId, hotelId, MODULE_KEY],
    ),
    statement(
      env,
      `INSERT INTO admin_audit_log (
         id, hotel_id, module_key, actor_user_id, actor_erp_user_id,
         action, entity_type, entity_id, metadata_json, created_at
       )
       SELECT ?, gd.hotel_id, gd.module_key, ?, ?,
              'room-service.guest.stay_ended', 'room_service_guest', gd.id,
              json_object('room_code', gd.room_code), ?
         FROM room_service_guest_directory gd
        WHERE gd.id = ? AND gd.hotel_id = ? AND gd.module_key = ?
          AND gd.status = 'archived' AND gd.updated_at = ?`,
      [createPublicId("audit"), adminUserId, erpUserId, createdAt, guestId, hotelId, MODULE_KEY, createdAt],
    ),
  ]);
  if (Number(results?.[0]?.meta?.changes || 0) !== 1) {
    const existing = await first(
      env,
      `SELECT id, status FROM room_service_guest_directory
        WHERE id = ? AND hotel_id = ? AND module_key = ? LIMIT 1`,
      [guestId, hotelId, MODULE_KEY],
    );
    if (existing?.status === "archived") return { guest_id: guestId, archived: true, idempotent: true };
    throw notFoundError("Hospede nao encontrado neste hotel.");
  }
  return { guest_id: guestId, archived: true, idempotent: false };
}

export async function getRoomServiceErpBilling({ env, session, url }) {
  requireAnyPermission(session, [BILLING_PERMISSION, READ_PERMISSION]);
  const hotelId = resolveRequestedHotel(session, url);
  const orders = (
    await listAdminOrders({
      env,
      session,
      url: urlWithHotel(url, hotelId),
      permissionKey: session.permissions.includes(BILLING_PERMISSION) ? BILLING_PERMISSION : READ_PERMISSION,
    })
  ).orders;
  const billable = orders.filter((order) => order.status === "delivered");
  const totalCents = billable.reduce((total, order) => total + Number(order.total_cents || 0), 0);
  return {
    hotel_id: hotelId,
    module_key: MODULE_KEY,
    summary: {
      completed_orders: billable.length,
      revenue_cents: totalCents,
      average_ticket_cents: billable.length ? Math.round(totalCents / billable.length) : 0,
    },
    exports: {
      csv_ready: true,
      xlsx_ready: false,
      message: "A exportacao CSV esta disponivel no ERP. O formato XLSX permanece fora deste escopo.",
    },
  };
}

export async function createRoomServiceErpOrder({ request, env, session }) {
  requirePermission(session, WRITE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = String(payload.hotel_id || "").trim();
  if (!hotelId) throw badRequest("hotel_id obrigatorio para pedido administrativo.");
  requireAdminHotelAccess(session, hotelId);
  const hotel = requireSessionHotel(session, hotelId);
  const operation = await loadRoomServiceOperationState({ env, hotelId, timezone: hotel.timezone });
  const body = JSON.stringify({ ...payload, origin: "admin_pdv" });
  const adminRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });
  return createRoomServiceOrder({
    request: adminRequest,
    env,
    administrative: true,
    tenant: {
      ...hotel,
      settings: { [`${MODULE_KEY}.operation_mode`]: operation.mode },
      service_hours: { [MODULE_KEY]: operation.service_hours },
    },
  });
}

function resolveRequestedHotel(session, url) {
  const hotelId = String(url.searchParams.get("hotel_id") || session.hotel_ids[0] || "").trim();
  if (!hotelId) throw notFoundError("Unidade administrativa nao encontrada.");
  requireAdminHotelAccess(session, hotelId);
  return hotelId;
}

function requireSessionHotel(session, hotelId) {
  const hotel = session.hotels.find((entry) => entry.hotel_id === hotelId);
  if (!hotel) throw notFoundError("Unidade administrativa nao encontrada.");
  return hotel;
}

async function loadBranding(env, hotelId) {
  const row = await first(
      env,
      `SELECT hotel_id, logo_url, icon_url, primary_color, secondary_color,
              accent_color, background_color, text_color, font_family,
              custom_css_json, updated_at
         FROM hotel_branding
        WHERE hotel_id = ?
        LIMIT 1`,
      [hotelId],
    );
  if (!row) {
    return {
      hotel_id: hotelId,
      logo_url: null,
      horizontal_logo_url: null,
      icon_url: null,
      favicon_url: null,
      header_logo_scale: 1,
      primary_color: null,
      secondary_color: null,
      accent_color: null,
      background_color: null,
      text_color: null,
      font_family: null,
      updated_at: null,
    };
  }
  const custom = parseJson(row.custom_css_json);
  return {
    hotel_id: row.hotel_id,
    logo_url: row.logo_url || null,
    horizontal_logo_url: custom.horizontal_logo_url || null,
    icon_url: row.icon_url || null,
    favicon_url: custom.favicon_url || row.icon_url || row.logo_url || null,
    header_logo_scale: normalizeLogoScale(custom.header_logo_scale),
    primary_color: row.primary_color || null,
    secondary_color: row.secondary_color || null,
    accent_color: row.accent_color || null,
    background_color: row.background_color || null,
    text_color: row.text_color || null,
    font_family: row.font_family || null,
    updated_at: row.updated_at || null,
  };
}

function normalizeLogoScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale >= 0.65 && scale <= 1.35 ? scale : 1;
}

async function listRooms(env, hotelId) {
  return all(
    env,
    `SELECT id, hotel_id, code, label, room_type, status, sort_order
       FROM rooms
      WHERE hotel_id = ?
        AND status = 'active'
      ORDER BY code`,
    [hotelId],
  );
}

function urlWithHotel(url, hotelId) {
  const scoped = new URL(url.toString());
  scoped.searchParams.set("hotel_id", hotelId);
  return scoped;
}

function countBy(rows, field) {
  return rows.reduce((accumulator, row) => {
    const key = row[field] || "unknown";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function localDateKey(value) {
  return String(value || "").slice(0, 10);
}

function hasAnyPermission(session, permissionKeys) {
  return permissionKeys.some((permissionKey) => session.permissions.includes(permissionKey));
}

function requireAnyPermission(session, permissionKeys) {
  const permission = permissionKeys.find((permissionKey) => session.permissions.includes(permissionKey));
  requirePermission(session, permission || permissionKeys[0]);
}

function parseJson(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
