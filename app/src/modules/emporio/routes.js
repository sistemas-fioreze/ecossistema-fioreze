import { ok } from "../../core/responses.js";
import { resolveTenantBySlug } from "../../core/tenant.js";
import { requireEnabledModule } from "../../middleware/require-module.js";
import { groupProductsByCategory, listCatalogProducts } from "../room-service/products.js";

const MODULE_KEY = "emporio";

export function registerEmporioRoutes(router) {
  router.get("/api/v1/public/hotels/:hotel_slug/emporio/items", async ({ env, params }) => {
    const tenant = await resolveTenantBySlug(env, params.hotel_slug);
    await requireEnabledModule(env, tenant.hotel_id, MODULE_KEY);
    const rows = await listCatalogProducts(env, tenant.hotel_id, MODULE_KEY);
    return ok({
      hotel_id: tenant.hotel_id,
      module_key: MODULE_KEY,
      categories: groupProductsByCategory(rows),
    });
  });
}
