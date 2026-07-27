import { isSafeIdentifier } from "../../core/identifiers.js";

const PUBLIC_MODULE_SLUGS = new Set(["room-service", "emporio", "romantic-packages", "spa"]);
const RESERVED_ROOT_SEGMENTS = new Set([
  "admin",
  "api",
  "assets",
  "css",
  "embed",
  "erp",
  "favicon.ico",
  "go",
  "js",
  "media",
  "portal",
  "portal-content",
]);

export function isGuestPortalPublicHost(request, env) {
  const configured = String(env?.GUEST_PORTAL_PUBLIC_ORIGIN || "").trim();
  if (!configured) return false;
  try {
    return new URL(configured).host.toLowerCase() === new URL(request.url).host.toLowerCase();
  } catch {
    return false;
  }
}

export function isRetiredCustomPortalPath(pathname) {
  const parts = safePathParts(pathname);
  if (!parts?.length || RESERVED_ROOT_SEGMENTS.has(parts[0])) return false;
  if (!isSafeIdentifier(parts[0])) return true;
  if (parts.length === 1) return false;
  if (parts.length === 2 && PUBLIC_MODULE_SLUGS.has(parts[1])) return false;
  return true;
}

export function guestPortalPublicUrl({ env, request, hotelSlug }) {
  const configured = String(env?.GUEST_PORTAL_PUBLIC_ORIGIN || "").trim();
  let origin = new URL(request.url).origin;
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (
        parsed.protocol === "https:" &&
        parsed.pathname === "/" &&
        !parsed.search &&
        !parsed.hash &&
        !parsed.username &&
        !parsed.password
      ) {
        origin = parsed.origin;
      }
    } catch {
      // A origem técnica continua válida quando a configuração é inválida.
    }
  }
  return `${origin}/${hotelSlug}`;
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
