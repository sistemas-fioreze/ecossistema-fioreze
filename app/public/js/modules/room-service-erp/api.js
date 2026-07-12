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
  return adminApi(`/api/v1/admin/orders?${params.toString()}`);
}

export function getOrder(orderId) {
  return adminApi(`/api/v1/admin/orders/${encodeURIComponent(orderId)}`);
}
