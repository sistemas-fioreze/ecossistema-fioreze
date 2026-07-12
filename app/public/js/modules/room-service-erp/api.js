import { adminApi } from "../admin/shared/admin-api.js";

export function getSession() {
  return adminApi("/api/v1/admin/session");
}

export function login({ email, password }) {
  return adminApi("/api/v1/admin/login", {
    method: "POST",
    body: { email, password },
  });
}

export function logout() {
  return adminApi("/api/v1/admin/logout", { method: "POST", body: {} }).catch(() => null);
}

export function listOrders({ hotelId, status, q } = {}) {
  const params = new URLSearchParams();
  if (hotelId) params.set("hotel_id", hotelId);
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  return adminApi(`/api/v1/admin/room-service/orders?${params.toString()}`);
}

export function getOrder(orderId) {
  return adminApi(`/api/v1/admin/room-service/orders/${encodeURIComponent(orderId)}`);
}

export function updateOrderStatus(orderId, body) {
  return adminApi(`/api/v1/admin/room-service/orders/${encodeURIComponent(orderId)}/status`, {
    method: "POST",
    body,
  });
}

export function createPdvOrder(body, idempotencyKey) {
  return adminApi("/api/v1/admin/room-service/orders", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body,
  });
}

export function getContext({ hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/context?${hotelParams(hotelId)}`);
}

export function getDashboard({ hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/dashboard?${hotelParams(hotelId)}`);
}

export function getCatalog({ hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/catalog?${hotelParams(hotelId)}`);
}

export function getGuests({ hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/guests?${hotelParams(hotelId)}`);
}

export function getBilling({ hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/billing?${hotelParams(hotelId)}`);
}

function hotelParams(hotelId) {
  const params = new URLSearchParams();
  if (hotelId) params.set("hotel_id", hotelId);
  return params.toString();
}
