export const ROOM_SERVICE_READ_PERMISSION = "room-service.orders.read";
export const PORTALS_MEDIA_READ_PERMISSION = "portals.media.read";
export const PORTALS_MEDIA_UPLOAD_PERMISSION = "portals.media.upload";
export const PORTALS_MEDIA_UPDATE_PERMISSION = "portals.media.update";
export const PORTALS_MEDIA_ARCHIVE_PERMISSION = "portals.media.archive";
export const PORTALS_LINKS_READ_PERMISSION = "portals.links.read";
export const PORTALS_LINKS_CREATE_PERMISSION = "portals.links.create";
export const PORTALS_LINKS_UPDATE_PERMISSION = "portals.links.update";
export const PORTALS_LINKS_ARCHIVE_PERMISSION = "portals.links.archive";
export const PORTALS_LINKS_ANALYTICS_PERMISSION = "portals.links.analytics";
export const PORTALS_HOTELS_READ_PERMISSION = "portals.hotels.read";
export const PORTALS_HOTELS_CREATE_PERMISSION = "portals.hotels.create";
export const PORTALS_HOTELS_UPDATE_PERMISSION = "portals.hotels.update";
export const PORTALS_HOTELS_BRANDING_PERMISSION = "portals.hotels.branding";
export const PORTALS_HOTELS_SETTINGS_PERMISSION = "portals.hotels.settings";
export const PORTALS_HOTELS_MODULES_PERMISSION = "portals.hotels.modules";
export const PORTALS_HOTELS_NAVIGATION_PERMISSION = "portals.hotels.navigation";
export const PORTALS_EMBED_READ_PERMISSION = "portals.embed.read";
export const PORTALS_EMBED_UPDATE_PERMISSION = "portals.embed.update";
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

export function canAccessMediaLibrary(session) {
  return hasPermission(session, PORTALS_MEDIA_READ_PERMISSION);
}

export function canAccessLinks(session) {
  return hasPermission(session, PORTALS_LINKS_READ_PERMISSION);
}

export function canAccessUnits(session) {
  return hasPermission(session, PORTALS_HOTELS_READ_PERMISSION);
}

export function getAuthorizedHotels(session) {
  return Array.isArray(session?.hotels) ? session.hotels : [];
}

export function getPermissions(session) {
  return Array.isArray(session?.permissions) ? session.permissions : [];
}
