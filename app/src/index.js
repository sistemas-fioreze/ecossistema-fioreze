import { AppError } from "./core/errors.js";
import { registerModuleRoutes } from "./core/module-registry.js";
import { Router } from "./core/router.js";
import { fail, ok } from "./core/responses.js";
import { getBootstrap, resolveTenantBySlug } from "./core/tenant.js";
import { withSecurityHeaders } from "./middleware/security-headers.js";
import { servePublicMedia } from "./modules/admin/media.js";
import { registerAdminRoutes } from "./modules/admin/routes.js";
import { registerAdminPasskeyRoutes } from "./modules/admin/passkey-routes.js";
import { registerEmbedRoutes } from "./modules/embed/public.js";
import { redirectShortLink } from "./modules/short-links/public.js";
import { extractCustomDomainSlug, isShortLinkCustomDomainRequest } from "./modules/short-links/shared.js";
import { serveCustomPortalPage } from "./modules/portal-pages/public.js";
import { serveDesktopRelease, servePrintAgentRelease } from "./modules/desktop-releases.js";
import { serveInternalDownloadCenter, serveInternalInstaller } from "./modules/internal-downloads.js";
import { archiveExpiredPortalEvents } from "./services/portal-event-lifecycle.js";
import { registerPrintAgentRoutes } from "./modules/print-agent/routes.js";
import {
  isGuestPortalPublicHost,
  isRetiredCustomPortalPath,
} from "./modules/guest-portal/shared.js";

const router = new Router();

router.get("/api/v1/health", async ({ env }) =>
  ok({
    service: "fioreze-portais",
    environment: env.ENVIRONMENT || "development",
    database_binding: "DB",
    impression_enabled: String(env.IMPRESSION_ENABLED || "false").toLowerCase() === "true",
  }),
);

router.get("/api/v1/public/hotels/:hotel_slug/bootstrap", async ({ env, params }) => {
  const bootstrap = await getBootstrap(env, params.hotel_slug);
  return ok({
    hotel_id: bootstrap.hotel_id,
    hotel_slug: bootstrap.hotel_slug,
    hotel_name: bootstrap.hotel_name,
    short_name: bootstrap.short_name,
    timezone: bootstrap.timezone,
    locale: bootstrap.locale,
    currency: bootstrap.currency,
    branding: bootstrap.branding,
    modules: bootstrap.modules,
    navigation: bootstrap.navigation,
    settings: bootstrap.settings,
  });
});

router.get("/api/v1/public/hotels/:hotel_slug/modules", async ({ env, params }) => {
  const tenant = await resolveTenantBySlug(env, params.hotel_slug);
  return ok({
    hotel_id: tenant.hotel_id,
    modules: tenant.modules,
  });
});

registerModuleRoutes(router);
registerAdminRoutes(router);
registerAdminPasskeyRoutes(router);
registerEmbedRoutes(router);
registerPrintAgentRoutes(router);

router.get("/media/:id", async ({ request, env, params }) => servePublicMedia({ request, env, params }));
router.head("/media/:id", async ({ request, env, params }) => servePublicMedia({ request, env, params, head: true }));
router.get("/downloads/erp/:file", async ({ env, params }) => serveDesktopRelease({ env, params }));
router.head("/downloads/erp/:file", async ({ env, params }) => serveDesktopRelease({ env, params, head: true }));
router.get("/downloads/print-agent/:file", async ({ env, params }) => servePrintAgentRelease({ env, params }));
router.head("/downloads/print-agent/:file", async ({ env, params }) => servePrintAgentRelease({ env, params, head: true }));
router.get("/go/:slug", async ({ request, env, ctx, params }) => redirectShortLink({ request, env, ctx, params }));
router.head("/go/:slug", async ({ request, env, params }) => redirectShortLink({ request, env, params, head: true }));
router.get("/portal-content/:hotel_slug/:page_slug", async ({ env, params }) => serveCustomPortalPage({ env, params }));
router.head("/portal-content/:hotel_slug/:page_slug", async ({ env, params }) => serveCustomPortalPage({ env, params, head: true }));

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const officialPortalHost = isGuestPortalPublicHost(request, env);

  if (isRetiredHumanDownloadPath(url.pathname)) {
    return servePublicNotFoundPage(request, env);
  }

  const internalDownloadRoute = parseInternalDownloadRoute(url.pathname);
  if (internalDownloadRoute) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return servePublicNotFoundPage(request, env);
    }
    const head = request.method === "HEAD";
    if (internalDownloadRoute.product) {
      return serveInternalInstaller({ env, product: internalDownloadRoute.product, head });
    }
    return serveInternalDownloadCenter({ env, head });
  }

  if (url.pathname === "/internal" || url.pathname.startsWith("/internal/download/")) {
    return servePublicNotFoundPage(request, env);
  }

  if (isShortLinkCustomDomainRequest(request, env)) {
    return handleShortLinkCustomDomainRequest({ request, env, ctx, url });
  }

  if (url.pathname.startsWith("/portal-content/") && officialPortalHost) {
    return servePublicNotFoundPage(request, env);
  }

  if (officialPortalHost && (url.pathname === "/portal" || url.pathname.startsWith("/portal/"))) {
    return servePublicNotFoundPage(request, env);
  }

  const unitErpRoute = parseUnitErpRoute(url.pathname);
  if (unitErpRoute) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return servePublicNotFoundPage(request, env);
    }
    const tenant = await resolveTenantBySlug(env, unitErpRoute.hotelSlug);
    if (!tenant.modules.some((module) => module.module_key === "room-service" && module.enabled !== false)) {
      return servePublicNotFoundPage(request, env);
    }
    if (unitErpRoute.redirectTo) {
      const canonicalUrl = new URL(request.url);
      canonicalUrl.pathname = unitErpRoute.redirectTo;
      return Response.redirect(canonicalUrl.toString(), 308);
    }
    return serveAsset(request, env, "/erp/room-service/");
  }

  if (isRetiredErpPath(url.pathname)) {
    return servePublicNotFoundPage(request, env);
  }

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/media/") ||
    url.pathname.startsWith("/downloads/erp/") ||
    url.pathname.startsWith("/downloads/print-agent/") ||
    url.pathname.startsWith("/embed/") ||
    url.pathname.startsWith("/go/") ||
    url.pathname.startsWith("/portal-content/")
  ) {
    return router.handle(request, env, ctx);
  }

  const adminAssetPath = resolveAdminAssetPath(url.pathname);
  if (adminAssetPath?.redirectTo) {
    const canonicalUrl = new URL(request.url);
    canonicalUrl.pathname = adminAssetPath.redirectTo;
    return Response.redirect(canonicalUrl.toString(), 308);
  }

  if (adminAssetPath?.assetPath) {
    return serveAsset(request, env, adminAssetPath.assetPath);
  }

  if (isDirectAsset(url.pathname)) {
    return serveAsset(request, env);
  }

  if (officialPortalHost && isRetiredCustomPortalPath(url.pathname)) {
    return servePublicNotFoundPage(request, env);
  }

  return servePublicPortalPage(request, env, url);
}

function handleShortLinkCustomDomainRequest({ request, env, ctx, url }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return servePublicNotFoundPage(request, env);
  }

  const slug = extractCustomDomainSlug(url.pathname);
  if (!slug) return servePublicNotFoundPage(request, env);

  return redirectShortLink({
    request,
    env,
    ctx,
    params: { slug },
    head: request.method === "HEAD",
  });
}

function isDirectAsset(pathname) {
  return (
    pathname.startsWith("/css/") ||
    pathname.startsWith("/js/") ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/assets/") ||
    pathname === "/favicon.ico"
  );
}

function resolveAdminAssetPath(pathname) {
  const routes = [
    { canonical: "/admin/portais/portal-hospede/", assetPath: "/admin/portais/" },
    { canonical: "/admin/portais/unidades/", assetPath: "/admin/portais/" },
    { canonical: "/admin/portais/media/", assetPath: "/admin/portais/" },
    { canonical: "/admin/portais/links/", assetPath: "/admin/portais/" },
    { canonical: "/admin/portais/conteudos/", assetPath: "/admin/portais/" },
    { canonical: "/admin/portais/areas/", assetPath: "/admin/portais/" },
    { canonical: "/admin/portais/navegacao/", assetPath: "/admin/portais/" },
    { canonical: "/admin/portais/auditoria/", assetPath: "/admin/portais/" },
    { canonical: "/admin/portais/", assetPath: "/admin/portais/" },
    { canonical: "/admin/configuracoes/", assetPath: "/admin/" },
    { canonical: "/admin/usuarios/", assetPath: "/admin/" },
    { canonical: "/admin/perfis/", assetPath: "/admin/" },
    { canonical: "/admin/mensagens/", assetPath: "/admin/" },
    { canonical: "/admin/minha-conta/", assetPath: "/admin/" },
    { canonical: "/admin/", assetPath: "/admin/" },
  ];

  if (pathname === "/admin/creator" || pathname.startsWith("/admin/creator/")) {
    return { redirectTo: "/admin/portais/portal-hospede/" };
  }
  if (pathname === "/admin/portais/conteudos" || pathname.startsWith("/admin/portais/conteudos/")) {
    return { redirectTo: "/admin/portais/portal-hospede/" };
  }

  for (const route of routes) {
    const withoutSlash = route.canonical.slice(0, -1);
    if (pathname === withoutSlash) return { redirectTo: route.canonical };
    if (pathname === route.canonical || pathname.startsWith(route.canonical)) {
      return { assetPath: route.assetPath };
    }
  }

  if (pathname.startsWith("/admin/")) return { assetPath: "/admin/index.html" };
  return null;
}

function parseUnitErpRoute(pathname) {
  const match = String(pathname || "").match(
    /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/admin\/erp(\/(?:.*)?)?$/,
  );
  if (!match) return null;
  const hotelSlug = match[1];
  const suffix = match[2] || "";
  return {
    hotelSlug,
    redirectTo: suffix ? null : `/${hotelSlug}/admin/erp/`,
  };
}

function parseInternalDownloadRoute(pathname) {
  if (pathname === "/internal/download" || pathname === "/internal/download/") {
    return { product: null };
  }
  const match = String(pathname || "").match(/^\/internal\/download\/(erp|suite)\/?$/);
  return match ? { product: match[1] } : null;
}

function isRetiredHumanDownloadPath(pathname) {
  return new Set([
    "/downloads/erp/download",
    "/downloads/erp/installer",
    "/downloads/print-agent/download",
    "/downloads/print-agent/installer",
  ]).has(pathname);
}

function isRetiredErpPath(pathname) {
  return (
    pathname === "/erp"
    || pathname.startsWith("/erp/")
    || pathname === "/admin/room-service"
    || pathname.startsWith("/admin/room-service/")
  );
}

async function serveAsset(request, env, overridePath = null) {
  if (!env.ASSETS?.fetch) {
    return new Response("Static assets binding unavailable in this environment.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (!overridePath) return env.ASSETS.fetch(request);

  const url = new URL(request.url);
  url.pathname = overridePath;
  return env.ASSETS.fetch(new Request(url, request));
}

async function servePublicPortalPage(request, env, url) {
  const parts = safePublicPathParts(url.pathname);
  if (!parts || parts.length < 1 || parts.length > 2) {
    return servePublicNotFoundPage(request, env);
  }

  let tenant;
  try {
    tenant = await resolveTenantBySlug(env, parts[0]);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      return servePublicNotFoundPage(request, env);
    }
    throw error;
  }

  const moduleKey = parts[1] || "guest-portal";
  if (!tenant.modules.some((module) => module.module_key === moduleKey && module.enabled !== false)) {
    return servePublicNotFoundPage(request, env);
  }

  // Pages canonicaliza /index.html para /. Usar a rota canonica evita que o
  // redirect volte ao _worker.js e repita indefinidamente o fallback SPA.
  return serveAsset(request, env, "/");
}

function safePublicPathParts(pathname) {
  try {
    return String(pathname || "")
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
  } catch {
    return null;
  }
}

async function servePublicNotFoundPage(request, env) {
  const assetRequest = new Request(request.url, {
    method: "GET",
    headers: request.headers,
  });
  const asset = await serveAsset(assetRequest, env, "/not-found/");
  const headers = new Headers(asset.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.delete("content-length");

  if (request.method === "HEAD") {
    return new Response(null, { status: 404, headers });
  }

  const logoUrl = publicNotFoundLogoUrl(request, env);
  const body = (await asset.text()).replaceAll(
    "/assets/shared/fioreze-central-logo.jpg",
    logoUrl,
  );
  return new Response(body, { status: 404, headers });
}

function publicNotFoundLogoUrl(request, env) {
  const configured = String(env.GUEST_PORTAL_PUBLIC_ORIGIN || "").trim();
  try {
    if (configured) {
      return new URL("/assets/shared/fioreze-central-logo.jpg", configured).toString();
    }
  } catch {
    // A origem da requisição continua sendo um fallback seguro.
  }
  return new URL("/assets/shared/fioreze-central-logo.jpg", request.url).toString();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const shortLinkHost = isShortLinkCustomDomainRequest(request, env);
    try {
      const response = await handleRequest(request, env, ctx);
      return withSecurityHeaders(response, {
        embed: pathname.startsWith("/embed/"),
        admin: isAdminRequestPath(pathname),
        shortLinkHost,
      });
    } catch (error) {
      if (error instanceof AppError) {
        const response =
          error.status === 404 && isPublicHtmlNotFound(pathname, shortLinkHost)
            ? await servePublicNotFoundPage(request, env)
            : fail(error.status, error.code, error.message, error.details, { headers: error.headers });
        return withSecurityHeaders(response, {
          embed: pathname.startsWith("/embed/"),
          admin: isAdminRequestPath(pathname),
          shortLinkHost,
        });
      }
      return withSecurityHeaders(
        fail(500, "internal_error", "Erro interno local da plataforma.", undefined, {
          requestId: crypto.randomUUID(),
        }),
        {
          embed: pathname.startsWith("/embed/"),
          admin: isAdminRequestPath(pathname),
          shortLinkHost,
        },
      );
    }
  },
  async scheduled(controller, env, ctx) {
    const now = new Date(controller?.scheduledTime || Date.now()).toISOString();
    ctx.waitUntil(archiveExpiredPortalEvents(env, { now }));
  },
};

function isPublicHtmlNotFound(pathname, shortLinkHost) {
  return (
    shortLinkHost ||
    pathname.startsWith("/go/") ||
    pathname.startsWith("/portal-content/") ||
    Boolean(parseUnitErpRoute(pathname)) ||
    isRetiredErpPath(pathname)
  );
}

function isAdminRequestPath(pathname) {
  return (
    pathname.startsWith("/admin/")
    || pathname.startsWith("/erp/")
    || Boolean(parseUnitErpRoute(pathname))
  );
}