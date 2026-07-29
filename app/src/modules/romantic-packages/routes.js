import { all } from "../../core/database.js";
import { ok } from "../../core/responses.js";
import { resolveTenantBySlug } from "../../core/tenant.js";
import { requireEnabledModule } from "../../middleware/require-module.js";

const MODULE_KEY = "romantic-packages";

export function registerRomanticPackageRoutes(router) {
  router.get("/api/v1/public/hotels/:hotel_slug/romantic-packages/packages", async ({ env, params }) => {
    const tenant = await resolveTenantBySlug(env, params.hotel_slug);
    await requireEnabledModule(env, tenant.hotel_id, MODULE_KEY);
    const rows = await all(
      env,
      `SELECT rp.id, rp.name, rp.description, rp.included_items_json, rp.item_type,
              rp.price_cents, rp.currency, rp.sort_order, rp.media_asset_id,
              rp.category_id, dc.category_key, dc.name AS category_name,
              dc.description AS category_description, dc.sort_order AS category_sort_order,
              ma.public_url AS image_url, ma.alt_text AS image_alt
         FROM romantic_packages rp
         LEFT JOIN decoration_categories dc
           ON dc.id = rp.category_id
          AND dc.hotel_id = rp.hotel_id
          AND dc.module_key = rp.module_key
          AND dc.status = 'active'
         LEFT JOIN media_assets ma
           ON ma.id = rp.media_asset_id
          AND ma.hotel_id = rp.hotel_id
          AND ma.status = 'active'
        WHERE rp.hotel_id = ?
          AND rp.module_key = ?
          AND rp.status = 'active'
        ORDER BY COALESCE(dc.sort_order, 100), rp.sort_order, rp.name`,
      [tenant.hotel_id, MODULE_KEY],
    );

    return ok({
      hotel_id: tenant.hotel_id,
      module_key: MODULE_KEY,
      packages: rows.map(publicPackage),
    });
  });
}

function publicPackage(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    item_type: row.item_type === "add-on" ? "add-on" : "package",
    category_id: row.category_id || null,
    category_key: row.category_key || "featured",
    category_name: row.category_name || "Experiências",
    category_description: row.category_description || "",
    category_sort_order: Number(row.category_sort_order || 100),
    included_items: parseIncludedItems(row.included_items_json),
    price_cents: row.price_cents == null ? null : Number(row.price_cents),
    currency: row.currency || "BRL",
    sort_order: Number(row.sort_order || 0),
    media_asset_id: row.media_asset_id || null,
    image_url: row.image_url || null,
    image_alt: row.image_alt || row.name,
  };
}

function parseIncludedItems(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 24)
      : [];
  } catch {
    return [];
  }
}

export const romanticPackagesInternalsForTests = {
  parseIncludedItems,
  publicPackage,
};
