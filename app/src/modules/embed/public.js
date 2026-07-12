import { all, first } from "../../core/database.js";
import { badRequest, notFoundError } from "../../core/errors.js";
import { isSafeIdentifier } from "../../core/identifiers.js";
import { ok } from "../../core/responses.js";
import { getBootstrap } from "../../core/tenant.js";
import { embedContentSecurityPolicy } from "../../middleware/security-headers.js";
import { groupProductsByCategory, listRoomServiceProducts } from "../room-service/products.js";

export const EMBED_READ_PERMISSION = "portals.embed.read";
export const EMBED_UPDATE_PERMISSION = "portals.embed.update";

const EMBED_KEYS = [
  "embed.enabled",
  "embed.allowed_origins",
  "embed.allowed_modules",
  "embed.default_theme",
  "embed.default_background",
  "embed.header",
  "embed.initial_height",
  "embed.compact",
];
const THEMES = new Set(["light", "auto"]);
const BACKGROUNDS = new Set(["default", "transparent"]);
const HEADERS = new Set(["visible", "hidden"]);
const MIN_HEIGHT = 240;
const MAX_HEIGHT = 2000;

export function registerEmbedRoutes(router) {
  router.get("/api/v1/public/hotels/:hotel_slug/embed/:module_key/config", async ({ request, env, params }) => {
    const { publicConfig } = await loadPublicEmbedConfig({ request, env, hotelSlug: params.hotel_slug, moduleKey: params.module_key });
    return ok(publicConfig, { cacheControl: "no-store" });
  });

  router.get("/embed/fioreze-embed.js", async () => jsResponse(hostScript(), "public, max-age=3600"));

  router.get("/embed/:hotel_slug/:module_key/config", async ({ request, env, params }) => {
    const { publicConfig } = await loadPublicEmbedConfig({ request, env, hotelSlug: params.hotel_slug, moduleKey: params.module_key });
    return ok(publicConfig, { cacheControl: "no-store" });
  });

  router.get("/embed/:hotel_slug/:module_key/embed.js", async ({ request, env, params }) => {
    const { publicConfig } = await loadPublicEmbedConfig({ request, env, hotelSlug: params.hotel_slug, moduleKey: params.module_key });
    return jsResponse(moduleScript(publicConfig), "no-store");
  });

  router.get("/embed/:hotel_slug/:module_key/", async ({ request, env, params }) => {
    const { publicConfig, frameAncestors } = await loadPublicEmbedConfig({
      request,
      env,
      hotelSlug: params.hotel_slug,
      moduleKey: params.module_key,
    });
    return htmlResponse(renderEmbedHtml(publicConfig), frameAncestors);
  });
}

export async function loadPublicEmbedConfig({ request, env, hotelSlug, moduleKey }) {
  if (!isSafeIdentifier(hotelSlug) || !isSafeIdentifier(moduleKey) || moduleKey === "admin") {
    throw notFoundError("Incorporacao indisponivel.");
  }

  const row = await first(
    env,
    `SELECT h.id AS hotel_id, h.slug, h.name, h.short_name, h.timezone, h.locale, h.currency,
            hm.module_key, hm.public_name, hm.navigation_label
       FROM hotels h
       JOIN hotel_modules hm ON hm.hotel_id = h.id
      WHERE h.slug = ?
        AND h.status = 'active'
        AND h.archived_at IS NULL
        AND hm.module_key = ?
        AND hm.enabled = 1
        AND hm.is_public = 1
        AND hm.module_key <> 'admin'
      LIMIT 1`,
    [hotelSlug, moduleKey],
  );
  if (!row) throw notFoundError("Modulo publico indisponivel para incorporacao.");

  const settings = await loadEmbedSettings(env, row.hotel_id);
  if (!settings.enabled) throw notFoundError("Incorporacao desativada para esta unidade.");
  if (!settings.allowed_modules.includes(moduleKey)) throw notFoundError("Modulo nao liberado para incorporacao.");

  const origin = request.headers.get("origin");
  if (origin && !isOriginAllowed(origin, settings.allowed_origins, env)) {
    throw notFoundError("Origem nao autorizada para incorporacao.");
  }

  const url = new URL(request.url);
  const options = resolveEmbedOptions(url.searchParams, settings);
  const bootstrap = await getBootstrap(env, hotelSlug);

  return {
    frameAncestors: buildFrameAncestors(settings.allowed_origins, env),
    publicConfig: {
      hotel_slug: row.slug,
      module_key: moduleKey,
      module_name: row.public_name || row.navigation_label || moduleKey,
      hotel: {
        name: row.name,
        short_name: row.short_name,
        timezone: row.timezone,
        locale: row.locale,
        currency: row.currency,
      },
      branding: bootstrap.branding,
      service_hours: bootstrap.service_hours?.[moduleKey] || [],
      service_status: moduleKey === "room-service" ? bootstrap.service_status?.room_service || "closed" : "unknown",
      options,
      endpoints: {
        config: `/api/v1/public/hotels/${row.slug}/embed/${moduleKey}/config`,
        products: moduleKey === "room-service" ? `/api/v1/public/hotels/${row.slug}/room-service/products` : null,
      },
    },
  };
}

export async function loadEmbedSettings(env, hotelId) {
  const rows = await all(
    env,
    `SELECT setting_key, setting_value, value_type
       FROM hotel_settings
      WHERE hotel_id = ?
        AND setting_key IN (${EMBED_KEYS.map(() => "?").join(", ")})
      ORDER BY setting_key`,
    [hotelId, ...EMBED_KEYS],
  );
  const settings = Object.fromEntries(rows.map((row) => [row.setting_key, coerceSetting(row)]));
  return {
    enabled: settings["embed.enabled"] === true,
    allowed_origins: normalizeAllowedOrigins(settings["embed.allowed_origins"], env),
    allowed_modules: normalizeModuleList(settings["embed.allowed_modules"]),
    default_theme: THEMES.has(settings["embed.default_theme"]) ? settings["embed.default_theme"] : "light",
    default_background: BACKGROUNDS.has(settings["embed.default_background"]) ? settings["embed.default_background"] : "default",
    header: HEADERS.has(settings["embed.header"]) ? settings["embed.header"] : "visible",
    initial_height: clampHeight(Number(settings["embed.initial_height"] || 520)),
    compact: Boolean(settings["embed.compact"]),
  };
}

export async function getEmbedProducts(env, hotelId, moduleKey) {
  if (moduleKey !== "room-service") return null;
  return { categories: groupProductsByCategory(await listRoomServiceProducts(env, hotelId)) };
}

export function validateEmbedAdminPayload(payload, env = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw badRequest("Payload invalido.");
  const allowed = new Set([
    "enabled",
    "allowed_origins",
    "allowed_modules",
    "default_theme",
    "default_background",
    "header",
    "initial_height",
    "compact",
  ]);
  const unknown = Object.keys(payload).filter((key) => !allowed.has(key));
  if (unknown.length) throw badRequest("Campos nao permitidos.", { fields: unknown });
  const next = {};
  if (Object.hasOwn(payload, "enabled")) next.enabled = requireBoolean(payload.enabled, "enabled");
  if (Object.hasOwn(payload, "allowed_origins")) next.allowed_origins = validateAllowedOrigins(payload.allowed_origins, env);
  if (Object.hasOwn(payload, "allowed_modules")) next.allowed_modules = validateModuleList(payload.allowed_modules);
  if (Object.hasOwn(payload, "default_theme")) {
    if (!THEMES.has(payload.default_theme)) throw badRequest("Tema de incorporacao invalido.");
    next.default_theme = payload.default_theme;
  }
  if (Object.hasOwn(payload, "default_background")) {
    if (!BACKGROUNDS.has(payload.default_background)) throw badRequest("Fundo de incorporacao invalido.");
    next.default_background = payload.default_background;
  }
  if (Object.hasOwn(payload, "header")) {
    if (!HEADERS.has(payload.header)) throw badRequest("Cabecalho de incorporacao invalido.");
    next.header = payload.header;
  }
  if (Object.hasOwn(payload, "initial_height")) next.initial_height = validateInitialHeight(payload.initial_height);
  if (Object.hasOwn(payload, "compact")) next.compact = requireBoolean(payload.compact, "compact");
  return next;
}

export function embedSettingsToRows(hotelId, values, now) {
  const rows = [];
  const push = (key, value, type) => {
    rows.push({
      id: `set-${hotelId}-${key.replaceAll(".", "-")}`.slice(0, 120),
      hotel_id: hotelId,
      setting_key: key,
      setting_value: type === "json" ? JSON.stringify(value) : String(value),
      value_type: type,
      is_public: 0,
      created_at: now,
      updated_at: now,
    });
  };
  if (Object.hasOwn(values, "enabled")) push("embed.enabled", values.enabled ? "true" : "false", "boolean");
  if (Object.hasOwn(values, "allowed_origins")) push("embed.allowed_origins", values.allowed_origins, "json");
  if (Object.hasOwn(values, "allowed_modules")) push("embed.allowed_modules", values.allowed_modules, "json");
  if (Object.hasOwn(values, "default_theme")) push("embed.default_theme", values.default_theme, "string");
  if (Object.hasOwn(values, "default_background")) push("embed.default_background", values.default_background, "string");
  if (Object.hasOwn(values, "header")) push("embed.header", values.header, "string");
  if (Object.hasOwn(values, "initial_height")) push("embed.initial_height", values.initial_height, "number");
  if (Object.hasOwn(values, "compact")) push("embed.compact", values.compact ? "true" : "false", "boolean");
  return rows;
}

export function normalizeAllowedOrigins(value, env = {}) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[\n,]/);
  const origins = [];
  for (const entry of raw) {
    const origin = normalizeOrigin(entry, env);
    if (origin && !origins.includes(origin)) origins.push(origin);
  }
  return origins.slice(0, 40);
}

export function normalizeModuleList(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[\n,]/);
  return raw
    .map((entry) => String(entry || "").trim())
    .filter((entry, index, list) => isSafeIdentifier(entry) && entry !== "admin" && list.indexOf(entry) === index)
    .slice(0, 20);
}

export function validateAllowedOrigins(value, env = {}) {
  if (!Array.isArray(value)) throw badRequest("allowed_origins deve ser uma lista de origens.");
  if (value.length > 40) throw badRequest("allowed_origins excede o limite permitido.");
  const origins = [];
  for (const entry of value) {
    if (typeof entry !== "string") throw badRequest("allowed_origins aceita somente textos.");
    const origin = normalizeOrigin(entry, env);
    if (!origin) throw badRequest("Origem de incorporacao invalida.");
    if (!origins.includes(origin)) origins.push(origin);
  }
  return origins;
}

export function validateModuleList(value) {
  if (!Array.isArray(value)) throw badRequest("allowed_modules deve ser uma lista de modulos.");
  if (value.length > 20) throw badRequest("allowed_modules excede o limite permitido.");
  const modules = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !isSafeIdentifier(entry)) throw badRequest("Modulo de incorporacao invalido.");
    if (entry === "admin") throw badRequest("Modulo administrativo nao pode ser incorporado.");
    if (!modules.includes(entry)) modules.push(entry);
  }
  return modules;
}

export function normalizeOrigin(value, env = {}) {
  const input = String(value || "").trim();
  if (!input || input.includes("*")) return null;
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
  if (!["https:", "http:"].includes(parsed.protocol)) return null;
  const localhost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  const localEnv = env.ENVIRONMENT === "development" || env.ENVIRONMENT === "test";
  if (localhost && !localEnv) return null;
  if (parsed.protocol === "http:" && !localhost) return null;
  return parsed.origin;
}

export function resolveEmbedOptions(searchParams, settings) {
  return {
    theme: THEMES.has(searchParams.get("theme")) ? searchParams.get("theme") : settings.default_theme,
    background: searchParams.get("background") === "transparent" ? "transparent" : settings.default_background,
    header: searchParams.get("header") === "hidden" ? "hidden" : settings.header,
    compact: searchParams.get("compact") === "true" ? true : settings.compact,
    initial_height: settings.initial_height,
  };
}

export function isOriginAllowed(origin, allowedOrigins, env = {}) {
  const normalized = normalizeOrigin(origin, env);
  return Boolean(normalized && allowedOrigins.includes(normalized));
}

function buildFrameAncestors(allowedOrigins, env) {
  const ancestors = ["'self'", ...allowedOrigins];
  if (env.ENVIRONMENT === "development" || env.ENVIRONMENT === "test") {
    for (const origin of ["http://localhost:8787", "http://127.0.0.1:8787"]) {
      if (!ancestors.includes(origin)) ancestors.push(origin);
    }
  }
  return ancestors;
}

function renderEmbedHtml(config) {
  const title = `${escapeHtml(config.module_name)} - ${escapeHtml(config.hotel.short_name || config.hotel.name)}`;
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${title}</title>
    <link rel="stylesheet" href="/css/core/embed.css">
  </head>
  <body data-fioreze-embed-page>
    <main id="embedRoot" class="fioreze-embed-root" data-config-url="${escapeAttr(config.endpoints.config)}">
      <section class="embed-loader" role="status" aria-live="polite">Carregando experiencia Fioreze...</section>
    </main>
    <script type="module" src="/embed/${escapeAttr(config.hotel_slug)}/${escapeAttr(config.module_key)}/embed.js"></script>
  </body>
</html>`;
}

function moduleScript(config) {
  return `import { initFiorezeEmbed } from "/js/core/embed-shell.js";
initFiorezeEmbed(${JSON.stringify({
    embed_id: embedIdFor(config.hotel_slug, config.module_key),
    hotel_slug: config.hotel_slug,
    module_key: config.module_key,
    config_url: config.endpoints.config,
    products_url: config.endpoints.products,
  })});`;
}

function embedIdFor(hotelSlug, moduleKey) {
  return `fioreze-${hotelSlug}-${moduleKey}`;
}

function hostScript() {
  return `(function(){
  function frames(){ return Array.prototype.slice.call(document.querySelectorAll("iframe[data-fioreze-embed]")); }
  function trustedOrigin(frame, eventOrigin){
    try { return new URL(frame.src, window.location.href).origin === eventOrigin; } catch { return false; }
  }
  function matchesEmbedId(frame, embedId){
    const expected = frame.getAttribute("data-fioreze-embed-id");
    return !expected || expected === embedId;
  }
  function resize(frame, height){
    const next = Math.max(240, Math.min(2000, Number(height) || 0));
    if (next) frame.style.height = next + "px";
  }
  window.addEventListener("message", function(event){
    if (!event || !event.data || typeof event.data !== "object") return;
    if (!["fioreze:embed:ready","fioreze:embed:resize"].includes(event.data.type)) return;
    const frame = frames().find(function(entry){ return entry.contentWindow === event.source; });
    if (!frame || !trustedOrigin(frame, event.origin) || !matchesEmbedId(frame, event.data.embed_id)) return;
    if (event.data.type === "fioreze:embed:resize") resize(frame, event.data.height);
    if (event.data.type === "fioreze:embed:ready") frame.setAttribute("data-fioreze-ready", "true");
  });
})();`;
}

function htmlResponse(body, frameAncestors) {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": embedContentSecurityPolicy(frameAncestors),
      "x-fioreze-embed": "true",
    },
  });
}

function jsResponse(body, cacheControl) {
  return new Response(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": cacheControl,
    },
  });
}

function coerceSetting(row) {
  if (row.value_type === "boolean") return row.setting_value === "true" || row.setting_value === "1";
  if (row.value_type === "number") return Number(row.setting_value);
  if (row.value_type === "json") {
    try {
      return JSON.parse(row.setting_value);
    } catch {
      return null;
    }
  }
  return row.setting_value;
}

function clampHeight(value) {
  if (!Number.isFinite(value)) return 520;
  return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(value)));
}

function validateInitialHeight(value) {
  if (!Number.isInteger(value) || value < MIN_HEIGHT || value > MAX_HEIGHT) {
    throw badRequest("initial_height deve ser um inteiro entre 240 e 2000.");
  }
  return value;
}

function requireBoolean(value, field) {
  if (value !== true && value !== false) throw badRequest(`${field} deve ser booleano.`);
  return value;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
