import { badRequest } from "../../core/errors.js";

export const SHORT_LINK_STATUSES = new Set(["active", "paused", "archived"]);
export const EDITABLE_SHORT_LINK_STATUSES = new Set(["active", "paused"]);
export const RESERVED_SHORT_LINK_SLUGS = new Set([
  "admin",
  "api",
  "assets",
  "embed",
  "media",
  "login",
  "logout",
  "health",
  "go",
  "cdn-cgi",
  "favicon",
  "robots",
  "sitemap",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const ALLOWED_DESTINATION_SCHEMES = new Set(["https", "http", "mailto", "tel"]);

export function normalizeShortLinkSlug(value, { publicLookup = false } = {}) {
  if (typeof value !== "string") {
    if (publicLookup) return "";
    throw badRequest("slug deve ser texto.");
  }
  const slug = value.trim().toLowerCase();
  if (slug.length < 2 || slug.length > 64 || !SLUG_PATTERN.test(slug) || slug.includes("--")) {
    if (publicLookup) return "";
    throw badRequest("slug invalido.");
  }
  if (RESERVED_SHORT_LINK_SLUGS.has(slug)) {
    if (publicLookup) return "";
    throw badRequest("slug reservado.");
  }
  return slug;
}

export function validateDestinationUrl(value, { request, slug } = {}) {
  if (typeof value !== "string") throw badRequest("destination_url deve ser texto.");
  const raw = value.trim();
  if (!raw) throw badRequest("destination_url e obrigatorio.");
  if (raw.length > 4096) throw badRequest("destination_url excede o tamanho permitido.");
  if (CONTROL_CHARS.test(raw)) throw badRequest("destination_url contem caracteres invalidos.");

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw badRequest("destination_url deve ser uma URL absoluta.");
  }

  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (!ALLOWED_DESTINATION_SCHEMES.has(scheme)) {
    throw badRequest("destination_url usa esquema nao permitido.");
  }

  if ((scheme === "http" || scheme === "https") && (parsed.username || parsed.password)) {
    throw badRequest("destination_url nao pode conter credenciais.");
  }

  if (request && slug && (scheme === "http" || scheme === "https")) {
    const origin = new URL(request.url).origin;
    const targetPath = parsed.pathname.replace(/\/+$/, "");
    if (parsed.origin === origin && targetPath === `/go/${slug}`) {
      throw badRequest("destination_url nao pode apontar para o proprio link curto.");
    }
  }

  return {
    url: parsed.href,
    scheme,
    warnings: scheme === "http" ? ["http_destination"] : [],
  };
}

export function normalizeOptionalDate(value, label) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw badRequest(`${label} deve ser data ISO-8601.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${label} deve ser data ISO-8601 valida.`);
  return date.toISOString();
}

export function assertDateWindow(startsAt, expiresAt) {
  if (startsAt && expiresAt && expiresAt <= startsAt) {
    throw badRequest("expires_at deve ser posterior a starts_at.");
  }
}

export function isShortLinkAvailable(link, nowIso) {
  return (
    link &&
    link.status === "active" &&
    !link.archived_at &&
    (!link.starts_at || link.starts_at <= nowIso) &&
    (!link.expires_at || link.expires_at > nowIso)
  );
}

export function shortLinkPublicUrl({ env, request, slug }) {
  const configured = typeof env?.SHORT_LINK_PUBLIC_ORIGIN === "string" ? env.SHORT_LINK_PUBLIC_ORIGIN.trim() : "";
  if (configured) {
    try {
      const origin = new URL(configured);
      if ((origin.protocol === "https:" || origin.protocol === "http:") && !origin.pathname.replace("/", "") && !origin.search && !origin.hash && !origin.username && !origin.password) {
        return `${origin.origin}/go/${slug}`;
      }
    } catch {
      // Ignora configuracao local invalida e usa a origem da requisicao.
    }
  }
  return `${new URL(request.url).origin}/go/${slug}`;
}

export function summarizeDestinationUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "mailto:" || url.protocol === "tel:") return `${url.protocol}${url.pathname}`;
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "";
  }
}
