import { adminApi } from "../admin/shared/admin-api.js";

export function getSession() {
  return adminApi("/api/v1/admin/room-service/session");
}

export function getLoginContext() {
  return adminApi("/api/v1/admin/room-service/login-context");
}

export function getPublicHotelBootstrap(hotelSlug) {
  return adminApi(`/api/v1/public/hotels/${encodeURIComponent(hotelSlug)}/bootstrap`);
}

export function identifyLoginUser({ hotelId, userCode }) {
  const params = new URLSearchParams({ hotel_id: hotelId, user_code: userCode });
  return adminApi(`/api/v1/admin/room-service/login-user?${params.toString()}`);
}

export function login({ hotelId, credential, password }) {
  const centralAdmin = credential.includes("@");
  return adminApi(centralAdmin ? "/api/v1/admin/login" : "/api/v1/admin/room-service/login", {
    method: "POST",
    body: centralAdmin ? { email: credential, password } : { hotel_id: hotelId, user_code: credential, password },
  });
}

export function logout() {
  return adminApi("/api/v1/admin/room-service/logout", { method: "POST", body: {} }).catch(() => null);
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

export function archiveGuest(guestId, { hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/guests/${encodeURIComponent(guestId)}`, {
    method: "DELETE",
    body: { hotel_id: hotelId },
  });
}

export function getBilling({ hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/billing?${hotelParams(hotelId)}`);
}

export function listErpUsers({ hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/users?${hotelParams(hotelId)}`);
}

export function listErpPermissions() {
  return adminApi("/api/v1/admin/room-service/permissions");
}

export function createErpUser(body) {
  return adminApi("/api/v1/admin/room-service/users", { method: "POST", body });
}

export function updateErpUser(userId, body) {
  return adminApi(`/api/v1/admin/room-service/users/${encodeURIComponent(userId)}`, { method: "PATCH", body });
}

export function resetErpUserPassword(userId, body) {
  return adminApi(`/api/v1/admin/room-service/users/${encodeURIComponent(userId)}/password`, { method: "POST", body });
}

export function getOperations({ hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/operations?${hotelParams(hotelId)}`);
}

export function setOperationMode(body) {
  return adminApi("/api/v1/admin/room-service/operations/mode", { method: "POST", body });
}

export function updateSchedule(body) {
  return adminApi("/api/v1/admin/room-service/operations/schedule", { method: "PATCH", body });
}

export function updateOrderPreferences(body) {
  return adminApi("/api/v1/admin/room-service/operations/preferences", { method: "PATCH", body });
}

export function getPrinting({ hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/printing?${hotelParams(hotelId)}`);
}

export function updatePrinting(body) {
  return adminApi("/api/v1/admin/room-service/printing", { method: "PATCH", body });
}

export function createPrinterEnrollment(body) {
  return adminApi("/api/v1/admin/room-service/printing/enrollment-codes", { method: "POST", body });
}

export function updatePrinterDevice(deviceId, body) {
  return adminApi(`/api/v1/admin/room-service/printing/devices/${encodeURIComponent(deviceId)}`, { method: "PATCH", body });
}

export function deletePrinterDevice(deviceId, body) {
  return adminApi(`/api/v1/admin/room-service/printing/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE", body });
}
export function listRooms({ hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/rooms?${hotelParams(hotelId)}`);
}

export function createRoom(body) {
  return adminApi("/api/v1/admin/room-service/rooms", { method: "POST", body });
}

export function updateRoom(roomId, body) {
  return adminApi(`/api/v1/admin/room-service/rooms/${encodeURIComponent(roomId)}`, { method: "PATCH", body });
}

export function createCatalogCategory(body) {
  return adminApi("/api/v1/admin/room-service/catalog/categories", { method: "POST", body });
}

export function updateCatalogCategory(categoryId, body) {
  return adminApi(`/api/v1/admin/room-service/catalog/categories/${encodeURIComponent(categoryId)}`, { method: "PATCH", body });
}

export function createCatalogItem(body) {
  return adminApi("/api/v1/admin/room-service/catalog/items", { method: "POST", body });
}

export function updateCatalogItem(itemId, body) {
  return adminApi(`/api/v1/admin/room-service/catalog/items/${encodeURIComponent(itemId)}`, { method: "PATCH", body });
}

export function deleteCatalogItem(itemId, body) {
  return adminApi(`/api/v1/admin/room-service/catalog/items/${encodeURIComponent(itemId)}`, { method: "DELETE", body });
}

export function listErpMedia({ hotelId } = {}) {
  return adminApi(`/api/v1/admin/room-service/media?${hotelParams(hotelId)}`);
}

export function uploadErpMedia(formData) {
  return adminApi("/api/v1/admin/room-service/media", { method: "POST", body: formData });
}

export function submitErpFeedback(formData) {
  return adminApi("/api/v1/admin/room-service/feedback", { method: "POST", body: formData });
}

export function uploadOwnAvatar(formData) {
  return adminApi("/api/v1/admin/room-service/me/avatar", { method: "POST", body: formData });
}

export function deleteOwnAvatar() {
  return adminApi("/api/v1/admin/room-service/me/avatar", { method: "DELETE" });
}

export function changeOwnErpPassword(body) {
  return adminApi("/api/v1/admin/room-service/me/password", { method: "POST", body });
}

function hotelParams(hotelId) {
  const params = new URLSearchParams();
  if (hotelId) params.set("hotel_id", hotelId);
  return params.toString();
}
