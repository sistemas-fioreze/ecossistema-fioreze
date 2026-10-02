import { all } from "../../core/database.js";
import { ok } from "../../core/responses.js";
import { resolvePublicModuleTenant } from "../../core/tenant.js";

const MODULE_KEY = "romantic-packages";

export function registerRomanticPackageRoutes(router) {
  router.get("/api/v1/public/hotels/:hotel_slug/romantic-packages/packages", async ({ env, params }) => {
    const tenant = await resolvePublicModuleTenant(env, params.hotel_slug, MODULE_KEY);
    const rows = await all(
      env,
      `SELECT rp.id, rp.name, rp.description, rp.included_items_json, rp.item_type,
              rp.price_cents, rp.currency, rp.sort_order, rp.media_asset_id,
              rp.category_id, dc.category_key, dc.name AS category_name,
              dc.description AS category_description, dc.sort_order AS category_sort_order,
              ma.public_url AS image_url, ma.alt_text AS image_alt,
              (
                SELECT json_group_array(json_object(
                  'media_asset_id', rpm.media_asset_id,
                  'image_url', gallery_media.public_url,
                  'image_alt', gallery_media.alt_text,
                  'sort_order', rpm.sort_order
                ))
                  FROM romantic_package_media rpm
                  JOIN media_assets gallery_media
                    ON gallery_media.id = rpm.media_asset_id
                   AND gallery_media.hotel_id = rpm.hotel_id
                   AND gallery_media.status = 'active'
                 WHERE rpm.package_id = rp.id
                   AND rpm.hotel_id = rp.hotel_id
                   AND rpm.module_key = rp.module_key
                   AND rpm.status = 'active'
              ) AS gallery_json
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
        ORDER BY COALESCE(dc.sort_order, 100), rp.sort_order, rp.name
        LIMIT 200`,
      [tenant.hotel_id, MODULE_KEY],
    );

    return ok({
      hotel_id: tenant.hotel_id,
      module_key: MODULE_KEY,
      packages: rows.map(publicPackage),
    }, { cacheControl: "public, max-age=60, stale-while-revalidate=300" });
  });
}

function publicPackage(row) {
  const images = packageImages(row);
  const primaryImage = images[0] || null;
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
    media_asset_id: primaryImage?.media_asset_id || row.media_asset_id || null,
    image_url: primaryImage?.image_url || null,
    image_alt: primaryImage?.image_alt || row.image_alt || row.name,
    images,
  };
}

function packageImages(row) {
  const images = [];
  if (row.image_url) {
    images.push({
      media_asset_id: row.media_asset_id || null,
      image_url: row.image_url,
      image_alt: row.image_alt || row.name || "Imagem do pacote",
      sort_order: 10,
    });
  }
  for (const image of parseGallery(row.gallery_json)) {
    if (images.some((entry) => (image.media_asset_id && entry.media_asset_id === image.media_asset_id) || entry.image_url === image.image_url)) continue;
    images.push(image);
  }
  return images.slice(0, 20);
}

function parseGallery(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((image) => image && typeof image === "object" && image.image_url)
      .map((image) => ({
        media_asset_id: image.media_asset_id || null,
        image_url: String(image.image_url),
        image_alt: String(image.image_alt || "Imagem do pacote"),
        sort_order: Number(image.sort_order || 100),
      }))
      .sort((left, right) => left.sort_order - right.sort_order)
      .slice(0, 19);
  } catch {
    return [];
  }
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
  parseGallery,
  packageImages,
  publicPackage,
};
