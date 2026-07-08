import { AppError } from "./core/errors.js";
import { registerModuleRoutes } from "./core/module-registry.js";
import { Router } from "./core/router.js";
import { fail, ok } from "./core/responses.js";
import { getBootstrap, resolveTenantBySlug } from "./core/tenant.js";
import { withSecurityHeaders } from "./middleware/security-headers.js";
import { registerAdminRoutes } from "./modules/admin/routes.js";

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
  return ok(bootstrap, { cacheControl: "no-store" });
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

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
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

  return serveAsset(request, env, "/index.html");
}

function isDirectAsset(pathname) {
  return (
    pathname.startsWith("/css/") ||
    pathname.startsWith("/js/") ||
    pathname.startsWith("/assets/") ||
    pathname === "/favicon.ico"
  );
}

function resolveAdminAssetPath(pathname) {
  const routes = [
    { canonical: "/admin/room-service/", assetPath: "/admin/room-service/" },
    { canonical: "/admin/portais/", assetPath: "/admin/portais/" },
    { canonical: "/admin/", assetPath: "/admin/" },
  ];

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

export default {
  async fetch(request, env, ctx) {
    try {
      const response = await handleRequest(request, env, ctx);
      return withSecurityHeaders(response);
    } catch (error) {
      if (error instanceof AppError) {
        return withSecurityHeaders(fail(error.status, error.code, error.message, error.details));
      }
      return withSecurityHeaders(
        fail(500, "internal_error", "Erro interno local da plataforma.", undefined, {
          requestId: crypto.randomUUID(),
        }),
      );
    }
  },
};
