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
  requirePermission(session, READ_PERMISSION);
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
      can_read_orders: session.permissions.includes(READ_PERMISSION),
      can_write_orders: session.permissions.includes(WRITE_PERMISSION),
      can_create_pdv_order: session.permissions.includes(WRITE_PERMISSION),
      can_manage_catalog: false,
      can_view_billing: session.permissions.includes(READ_PERMISSION),
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
  requirePermission(session, READ_PERMISSION);
  const hotelId = resolveRequestedHotel(session, url);
  const orders = (await listAdminOrders({ env, session, url: urlWithHotel(url, hotelId) })).orders;
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
  requirePermission(session, READ_PERMISSION);
  const hotelId = resolveRequestedHotel(session, url);
  const rows = await listRoomServiceProducts(env, hotelId);
  return {
    hotel_id: hotelId,
    module_key: MODULE_KEY,
    categories: groupProductsByCategory(rows),
  };
}

export async function listRoomServiceErpGuests({ env, session, url }) {
  requirePermission(session, READ_PERMISSION);
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
  requirePermission(session, READ_PERMISSION);
  const hotelId = resolveRequestedHotel(session, url);
  const orders = (await listAdminOrders({ env, session, url: urlWithHotel(url, hotelId) })).orders;
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
  return (
    (await first(
      env,
      `SELECT hotel_id, logo_url, primary_color, secondary_color,
              accent_color, font_family, updated_at
         FROM hotel_branding
        WHERE hotel_id = ?
        LIMIT 1`,
      [hotelId],
    )) || {
      hotel_id: hotelId,
      logo_url: null,
      primary_color: null,
      secondary_color: null,
      accent_color: null,
      font_family: null,
      updated_at: null,
    }
  );
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
