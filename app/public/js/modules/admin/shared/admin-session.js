export const ROOM_SERVICE_READ_PERMISSION = "room-service.orders.read";
const PORTALS_PERMISSION_PREFIXES = ["platform.", "portals."];

export function hasPermission(session, permissionKey) {
  return getPermissions(session).includes(permissionKey);
}

export function hasPermissionPrefix(session, prefixes) {
  const values = Array.isArray(prefixes) ? prefixes : [prefixes];
  return getPermissions(session).some((permission) => values.some((prefix) => permission.startsWith(prefix)));
}

export function canAccessRoomService(session) {
  return hasPermission(session, ROOM_SERVICE_READ_PERMISSION);
}

export function canAccessPortals(session) {
  return hasPermissionPrefix(session, PORTALS_PERMISSION_PREFIXES);
}

export function getAuthorizedHotels(session) {
  return Array.isArray(session?.hotels) ? session.hotels : [];
}

export function getPermissions(session) {
  return Array.isArray(session?.permissions) ? session.permissions : [];
}
