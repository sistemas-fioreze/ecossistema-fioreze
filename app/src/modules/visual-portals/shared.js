import { isSafeIdentifier } from "../../core/identifiers.js";

const TECHNICAL_PRODUCT_SLUGS = new Set(["room-service"]);
const RESERVED_ROOT_SEGMENTS = new Set([
  "admin",
  "api",
  "assets",
  "css",
  "embed",
  "erp",
  "go",
  "js",
  "media",
  "portal",
  "portal-content",
]);

export function resolveVisualPortalPublicOrigin(env, request) {
  const configured = String(env?.VISUAL_PORTAL_PUBLIC_ORIGIN || "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password) {
        return url.origin;
      }
    } catch {
      // Configuracao invalida nunca deve produzir um endereco publico quebrado.
    }
  }
  return new URL(request.url).origin;
}

export function visualPortalPublicUrl({ env, request, hotelSlug, portalSlug }) {
  return `${resolveVisualPortalPublicOrigin(env, request)}/${hotelSlug}/${portalSlug}`;
}

export function isVisualPortalPublicHost(request, env) {
  const configured = String(env?.VISUAL_PORTAL_PUBLIC_ORIGIN || "").trim();
  if (!configured) return false;
  try {
    return new URL(configured).host.toLowerCase() === new URL(request.url).host.toLowerCase();
  } catch {
    return false;
  }
}

export function matchVisualPortalPublicPath(pathname) {
  const parts = safePathParts(pathname);
  if (!parts || parts.length !== 2) return null;
  const [hotelSlug, portalSlug] = parts;
  if (RESERVED_ROOT_SEGMENTS.has(hotelSlug) || TECHNICAL_PRODUCT_SLUGS.has(portalSlug)) return null;
  if (!isSafeIdentifier(hotelSlug) || !isSafeIdentifier(portalSlug)) return null;
  return { hotel_slug: hotelSlug, portal_slug: portalSlug };
}

export function matchLegacyVisualPortalPath(pathname) {
  const parts = safePathParts(pathname);
  if (!parts || parts.length !== 3 || parts[0] !== "portal") return null;
  const [, hotelSlug, portalSlug] = parts;
  if (!isSafeIdentifier(hotelSlug) || !isSafeIdentifier(portalSlug)) return null;
  return { hotel_slug: hotelSlug, portal_slug: portalSlug };
}

export function isLegacyGuestPortalPath(pathname) {
  const parts = safePathParts(pathname);
  return Boolean(parts?.length === 1 && isSafeIdentifier(parts[0]) && !RESERVED_ROOT_SEGMENTS.has(parts[0]));
}

function safePathParts(pathname) {
  try {
    return String(pathname || "")
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
  } catch {
    return null;
  }
}
