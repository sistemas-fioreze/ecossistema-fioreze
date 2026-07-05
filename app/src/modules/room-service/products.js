import { all } from "../../core/database.js";

export async function listRoomServiceProducts(env, hotelId) {
  return all(
    env,
    `SELECT ci.id, ci.public_id, ci.name, ci.description, ci.item_type,
            ci.price_cents, ci.currency, ci.image_url, ci.sort_order,
            ca.is_available, ca.availability_label,
            c.id AS category_id, c.name AS category_name
       FROM catalog_items ci
       JOIN catalogs cat ON cat.id = ci.catalog_id
       JOIN categories c ON c.id = ci.category_id
       LEFT JOIN catalog_item_availability ca
              ON ca.catalog_item_id = ci.id AND ca.hotel_id = ci.hotel_id
      WHERE ci.hotel_id = ?
        AND ci.module_key = 'room-service'
        AND cat.module_key = 'room-service'
        AND ci.status = 'active'
      ORDER BY c.sort_order, ci.sort_order, ci.name`,
    [hotelId],
  );
}

export function groupProductsByCategory(rows) {
  const categories = new Map();
  for (const row of rows) {
    if (!categories.has(row.category_id)) {
      categories.set(row.category_id, {
        id: row.category_id,
        name: row.category_name,
        items: [],
      });
    }
    categories.get(row.category_id).items.push({
      id: row.id,
      public_id: row.public_id,
      name: row.name,
      description: row.description,
      item_type: row.item_type,
      price_cents: row.price_cents,
      currency: row.currency,
      image_url: row.image_url,
      available: row.is_available !== 0,
      availability_label: row.availability_label || null,
    });
  }
  return [...categories.values()];
}
