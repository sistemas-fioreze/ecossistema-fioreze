import { all, first } from "../../core/database.js";
import { badRequest, notFoundError } from "../../core/errors.js";
import { requestNow } from "../../core/time.js";
import { readJson } from "../../core/validation.js";
import { createRoomServiceOrder } from "../room-service/orders.js";
import { groupProductsByCategory, listRoomServiceProducts } from "../room-service/products.js";
import { listAdminOrders, getAdminOrder, updateAdminOrderStatus } from "./orders.js";
import { assertAdminMutationAllowed, requireAdminHotelAccess, requirePermission } from "../../services/admin-auth.js";

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
  USERS_PERMISSION,
];

const STATUS_GROUPS = {
  received: "active",
  preparing: "active",
  ready: "active",
  completed: "final",
  delivered: "final",
  cancelled: "cancelled",
  archived: "archived",
};

export async function getRoomServiceErpContext({ env, session, url }) {
  requireAnyPermission(session, ERP_PERMISSIONS);
  const hotelId = resolveRequestedHotel(session, url);
  const hotel = requireSessionHotel(session, hotelId);
  const [branding, serviceHours, rooms] = await Promise.all([
    loadBranding(env, hotelId),
    loadServiceHours(env, hotelId),
    listRooms(env, hotelId),
  ]);

  return {
    module_key: MODULE_KEY,
    selected_hotel_id: hotelId,
    hotel,
    branding,
    service_hours: serviceHours,
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
      can_manage_catalog: false,
    },
    printing: {
      enabled: false,
      message: "Impressao desativada neste ambiente.",
    },
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
  const rows = await listRoomServiceProducts(env, hotelId);
  return {
    hotel_id: hotelId,
    module_key: MODULE_KEY,
    categories: groupProductsByCategory(rows),
  };
}

export async function listRoomServiceErpGuests({ env, session, url }) {
  requireAnyPermission(session, [GUESTS_PERMISSION, READ_PERMISSION]);
  const hotelId = resolveRequestedHotel(session, url);
  return {
    hotel_id: hotelId,
    module_key: MODULE_KEY,
    rooms: await listRooms(env, hotelId),
    guests: [],
    pms_connected: false,
    message: "Integracao PMS ainda nao conectada. Nenhum hospede real e carregado nesta fase.",
  };
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
  const billable = orders.filter((order) => order.status === "completed");
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
      csv_ready: false,
      xlsx_ready: false,
      message: "Exportacoes serao implementadas sem CDN e respeitando permissoes financeiras.",
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
  const serviceHours = await loadServiceHours(env, hotelId);
  const body = JSON.stringify({ ...payload, origin: "admin_pdv" });
  const adminRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });
  return createRoomServiceOrder({
    request: adminRequest,
    env,
    tenant: {
      ...hotel,
      service_hours: { [MODULE_KEY]: serviceHours },
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
    primary_color: row.primary_color || null,
    secondary_color: row.secondary_color || null,
    accent_color: row.accent_color || null,
    background_color: row.background_color || null,
    text_color: row.text_color || null,
    font_family: row.font_family || null,
    updated_at: row.updated_at || null,
  };
}

async function loadServiceHours(env, hotelId) {
  return all(
    env,
    `SELECT sh.id, sh.hotel_id, sh.module_key, sh.day_of_week,
            sh.opens_at, sh.closes_at, sh.is_closed, sh.sort_order,
            sh.valid_from, sh.valid_until, sh.status
       FROM service_hours sh
      WHERE sh.hotel_id = ?
        AND sh.module_key = ?
        AND sh.status = 'active'
        AND sh.archived_at IS NULL
      ORDER BY sh.day_of_week, sh.sort_order`,
    [hotelId, MODULE_KEY],
  );
}

async function listRooms(env, hotelId) {
  return all(
    env,
    `SELECT id, hotel_id, code, status
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
