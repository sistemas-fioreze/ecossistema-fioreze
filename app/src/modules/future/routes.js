import { notImplemented } from "../../core/errors.js";
import { resolveTenantBySlug } from "../../core/tenant.js";
import { requireEnabledModule } from "../../middleware/require-module.js";

function plannedEndpoint(moduleKey, resourceKey) {
  return async ({ env, params }) => {
    const tenant = await resolveTenantBySlug(env, params.hotel_slug);
    await requireEnabledModule(env, tenant.hotel_id, moduleKey);
    throw notImplemented("Modulo preparado para evolucao futura.", {
      hotel_id: tenant.hotel_id,
      module_key: moduleKey,
      resource: resourceKey,
    });
  };
}

export function registerFutureModuleRoutes(router) {
  router.post("/api/v1/public/hotels/:hotel_slug/emporio/orders", plannedEndpoint("emporio", "orders"));
  router.get("/api/v1/public/hotels/:hotel_slug/spa/services", plannedEndpoint("spa", "services"));
  router.post("/api/v1/public/hotels/:hotel_slug/spa/requests", plannedEndpoint("spa", "requests"));
  router.get(
    "/api/v1/public/hotels/:hotel_slug/romantic-packages/packages",
    plannedEndpoint("romantic-packages", "packages"),
  );
  router.post(
    "/api/v1/public/hotels/:hotel_slug/romantic-packages/requests",
    plannedEndpoint("romantic-packages", "requests"),
  );
}
