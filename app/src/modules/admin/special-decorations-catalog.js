import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import {
  assertAdminMutationAllowed,
  requireAdminHotelAccess,
  requirePermission,
} from "../../services/admin-auth.js";
import { HOTELS_READ_PERMISSION, HOTELS_UPDATE_PERMISSION } from "./hotels.js";

const MODULE_KEY = "romantic-packages";
const ITEM_STATUSES = new Set(["draft", "active", "inactive", "archived"]);
const CATEGORY_STATUSES = new Set(["draft", "active", "inactive", "archived"]);
const ITEM_TYPES = new Set(["package", "add-on"]);

export async function listAdminSpecialDecorationsCatalog({ env, session, url }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  const hotelId = requestedHotel(session, url.searchParams.get("hotel_id"));
  const [categories, items] = await Promise.all([
    listCategories(env, hotelId),
    listItems(env, hotelId),
  ]);
  return {
    hotel_id: hotelId,
    module_key: MODULE_KEY,
    categories,
    items: items.map(toAdminItem),
  };
}

export async function createAdminSpecialDecorationCategory({ request, env, session }) {
  requirePermission(session, HOTELS_UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const name = requireString(payload.name, "name", { max: 120 });
  const description = optionalString(payload.description, "description", { max: 500 }) || null;
  const categoryKey = normalizeCategoryKey(payload.category_key || name);
  const categoryId = createPublicId("decoration_category");
  const sortOrder = normalizeSortOrder(payload.sort_order, 100);
  const now = requestNow({ request, env });

  try {
    await batch(env, [
      statement(
        env,
        `INSERT INTO decoration_categories (
           id, hotel_id, module_key, category_key, name, description, status,
           sort_order, created_at, updated_at, archived_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL)`,
        [categoryId, hotelId, MODULE_KEY, categoryKey, name, description, sortOrder, now, now],
      ),
      auditStatement(env, session, {
        hotelId,
        action: "special_decorations.category.created",
        entityType: "decoration_category",
        entityId: categoryId,
        metadata: { category_key: categoryKey },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (/unique constraint failed.*decoration_categories/i.test(String(error?.message || ""))) {
      throw conflict("Já existe uma categoria com este identificador.");
    }
    throw error;
  }

  return { category: await requireCategory(env, hotelId, categoryId) };
}

export async function updateAdminSpecialDecorationCategory({ request, env, session, categoryId }) {
  requirePermission(session, HOTELS_UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const current = await requireCategory(env, hotelId, categoryId);
  const name = Object.hasOwn(payload, "name")
    ? requireString(payload.name, "name", { max: 120 })
    : current.name;
  const description = Object.hasOwn(payload, "description")
    ? optionalString(payload.description, "description", { max: 500 }) || null
    : current.description;
  const status = Object.hasOwn(payload, "status")
    ? requireString(payload.status, "status", { max: 20 })
    : current.status;
  if (!CATEGORY_STATUSES.has(status)) throw badRequest("Status de categoria inválido.");
  const sortOrder = Object.hasOwn(payload, "sort_order")
    ? normalizeSortOrder(payload.sort_order, current.sort_order)
    : Number(current.sort_order);
  const now = requestNow({ request, env });

  await batch(env, [
    statement(
      env,
      `UPDATE decoration_categories
          SET name = ?, description = ?, status = ?, sort_order = ?,
              updated_at = ?, archived_at = ?
        WHERE id = ? AND hotel_id = ? AND module_key = ?`,
      [
        name,
        description,
        status,
        sortOrder,
        now,
        status === "archived" ? now : null,
        categoryId,
        hotelId,
        MODULE_KEY,
      ],
    ),
    auditStatement(env, session, {
      hotelId,
      action: "special_decorations.category.updated",
      entityType: "decoration_category",
      entityId: categoryId,
      metadata: { status },
      createdAt: now,
    }),
  ]);

  return { category: await requireCategory(env, hotelId, categoryId) };
}

export async function createAdminSpecialDecorationItem({ request, env, session }) {
  requirePermission(session, HOTELS_UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const category = await requireCategory(env, hotelId, payload.category_id);
  const values = await normalizeItemValues(env, hotelId, payload, null);
  const itemId = createPublicId("decoration");
  const now = requestNow({ request, env });

  await batch(env, [
    statement(
      env,
      `INSERT INTO romantic_packages (
         id, hotel_id, module_key, name, description, included_items_json,
         price_cents, currency, status, sort_order, created_at, updated_at,
         archived_at, media_asset_id, item_type, category_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        hotelId,
        MODULE_KEY,
        values.name,
        values.description,
        JSON.stringify(values.included_items),
        values.price_cents,
        values.currency,
        values.status,
        values.sort_order,
        now,
        now,
        values.status === "archived" ? now : null,
        values.media_asset_id,
        values.item_type,
        category.id,
      ],
    ),
    auditStatement(env, session, {
      hotelId,
      action: "special_decorations.item.created",
      entityType: "romantic_package",
      entityId: itemId,
      metadata: {
        category_id: category.id,
        item_type: values.item_type,
        media_asset_id: values.media_asset_id,
      },
      createdAt: now,
    }),
  ]);

  return { item: toAdminItem(await requireItem(env, hotelId, itemId)) };
}

export async function updateAdminSpecialDecorationItem({ request, env, session, itemId }) {
  requirePermission(session, HOTELS_UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const current = await requireItem(env, hotelId, itemId);
  const categoryId = Object.hasOwn(payload, "category_id")
    ? requireString(payload.category_id, "category_id", { max: 120 })
    : current.category_id;
  const category = await requireCategory(env, hotelId, categoryId);
  const values = await normalizeItemValues(env, hotelId, payload, current);
  const now = requestNow({ request, env });

  await batch(env, [
    statement(
      env,
      `UPDATE romantic_packages
          SET category_id = ?, name = ?, description = ?, included_items_json = ?,
              price_cents = ?, currency = ?, status = ?, sort_order = ?,
              media_asset_id = ?, item_type = ?, updated_at = ?, archived_at = ?
        WHERE id = ? AND hotel_id = ? AND module_key = ?`,
      [
        category.id,
        values.name,
        values.description,
        JSON.stringify(values.included_items),
        values.price_cents,
        values.currency,
        values.status,
        values.sort_order,
        values.media_asset_id,
        values.item_type,
        now,
        values.status === "archived" ? now : null,
        itemId,
        hotelId,
        MODULE_KEY,
      ],
    ),
    auditStatement(env, session, {
      hotelId,
      action: "special_decorations.item.updated",
      entityType: "romantic_package",
      entityId: itemId,
      metadata: {
        category_id: category.id,
        status: values.status,
        item_type: values.item_type,
        media_asset_id: values.media_asset_id,
      },
      createdAt: now,
    }),
  ]);

  return { item: toAdminItem(await requireItem(env, hotelId, itemId)) };
}

async function listCategories(env, hotelId) {
  return all(
    env,
    `SELECT id, hotel_id, module_key, category_key, name, description,
            status, sort_order, created_at, updated_at
       FROM decoration_categories
      WHERE hotel_id = ? AND module_key = ? AND status != 'archived'
      ORDER BY sort_order, name`,
    [hotelId, MODULE_KEY],
  );
}

async function listItems(env, hotelId) {
  return all(
    env,
    `SELECT rp.id, rp.hotel_id, rp.module_key, rp.category_id, rp.name,
            rp.description, rp.included_items_json, rp.price_cents, rp.currency,
            rp.status, rp.sort_order, rp.media_asset_id, rp.item_type,
            ma.public_url AS image_url, ma.alt_text AS image_alt
       FROM romantic_packages rp
       LEFT JOIN media_assets ma
         ON ma.id = rp.media_asset_id
        AND ma.hotel_id = rp.hotel_id
        AND ma.status = 'active'
      WHERE rp.hotel_id = ? AND rp.module_key = ? AND rp.status != 'archived'
      ORDER BY rp.sort_order, rp.name`,
    [hotelId, MODULE_KEY],
  );
}

async function requireCategory(env, hotelId, categoryIdValue) {
  const categoryId = requireString(categoryIdValue, "category_id", { max: 120 });
  const category = await first(
    env,
    `SELECT id, hotel_id, module_key, category_key, name, description,
            status, sort_order, created_at, updated_at
       FROM decoration_categories
      WHERE id = ? AND hotel_id = ? AND module_key = ?
      LIMIT 1`,
    [categoryId, hotelId, MODULE_KEY],
  );
  if (!category) throw notFoundError("Categoria não encontrada.");
  return category;
}

async function requireItem(env, hotelId, itemId) {
  const item = await first(
    env,
    `SELECT rp.id, rp.hotel_id, rp.module_key, rp.category_id, rp.name,
            rp.description, rp.included_items_json, rp.price_cents, rp.currency,
            rp.status, rp.sort_order, rp.media_asset_id, rp.item_type,
            ma.public_url AS image_url, ma.alt_text AS image_alt
       FROM romantic_packages rp
       LEFT JOIN media_assets ma
         ON ma.id = rp.media_asset_id
        AND ma.hotel_id = rp.hotel_id
        AND ma.status = 'active'
      WHERE rp.id = ? AND rp.hotel_id = ? AND rp.module_key = ?
      LIMIT 1`,
    [itemId, hotelId, MODULE_KEY],
  );
  if (!item) throw notFoundError("Item não encontrado.");
  return item;
}

async function normalizeItemValues(env, hotelId, payload, current) {
  const name = Object.hasOwn(payload, "name")
    ? requireString(payload.name, "name", { max: 160 })
    : current?.name;
  if (!name) throw badRequest("name é obrigatório.");
  const description = Object.hasOwn(payload, "description")
    ? optionalString(payload.description, "description", { max: 3000 }) || null
    : current?.description || null;
  const itemType = Object.hasOwn(payload, "item_type")
    ? requireString(payload.item_type, "item_type", { max: 20 })
    : current?.item_type || "package";
  if (!ITEM_TYPES.has(itemType)) throw badRequest("Tipo de item inválido.");
  const priceCents = normalizePrice(payload, current);
  const currency = Object.hasOwn(payload, "currency")
    ? requireString(payload.currency, "currency", { max: 3 }).toUpperCase()
    : current?.currency || "BRL";
  const status = Object.hasOwn(payload, "status")
    ? requireString(payload.status, "status", { max: 20 })
    : current?.status || "active";
  if (!ITEM_STATUSES.has(status)) throw badRequest("Status de item inválido.");
  const sortOrder = Object.hasOwn(payload, "sort_order")
    ? normalizeSortOrder(payload.sort_order, 100)
    : Number(current?.sort_order || 100);
  const includedItems = Object.hasOwn(payload, "included_items")
    ? normalizeIncludedItems(payload.included_items)
    : parseIncludedItems(current?.included_items_json);
  const mediaAssetId = Object.hasOwn(payload, "media_asset_id")
    ? optionalString(payload.media_asset_id, "media_asset_id", { max: 120 }) || null
    : current?.media_asset_id || null;
  if (mediaAssetId) await requireMediaAsset(env, hotelId, mediaAssetId);
  return {
    name,
    description,
    item_type: itemType,
    price_cents: priceCents,
    currency,
    status,
    sort_order: sortOrder,
    included_items: includedItems,
    media_asset_id: mediaAssetId,
  };
}

function normalizePrice(payload, current) {
  if (!Object.hasOwn(payload, "price_cents")) {
    return current?.price_cents == null ? null : Number(current.price_cents);
  }
  if (payload.price_cents == null || payload.price_cents === "") return null;
  const value = Number(payload.price_cents);
  if (!Number.isInteger(value) || value < 0 || value > 100000000) {
    throw badRequest("Preço inválido.");
  }
  return value;
}

function normalizeIncludedItems(value) {
  if (!Array.isArray(value)) throw badRequest("included_items deve ser uma lista.");
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 32)
    .map((item) => item.slice(0, 240));
}

function parseIncludedItems(value) {
  if (!value) return [];
  try {
    return normalizeIncludedItems(JSON.parse(value));
  } catch {
    return [];
  }
}

async function requireMediaAsset(env, hotelId, assetId) {
  const asset = await first(
    env,
    `SELECT id
       FROM media_assets
      WHERE id = ? AND hotel_id = ? AND status = 'active' AND mime_type LIKE 'image/%'
      LIMIT 1`,
    [assetId, hotelId],
  );
  if (!asset) throw badRequest("A imagem não pertence à biblioteca ativa desta unidade.");
  return asset;
}

function toAdminItem(row) {
  return {
    ...row,
    price_cents: row.price_cents == null ? null : Number(row.price_cents),
    sort_order: Number(row.sort_order || 0),
    included_items: parseIncludedItems(row.included_items_json),
  };
}

function auditStatement(env, session, { hotelId, action, entityType, entityId, metadata, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action,
       entity_type, entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createPublicId("audit"),
      hotelId,
      MODULE_KEY,
      session.user.id,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata || {}),
      createdAt,
    ],
  );
}

function requestedHotel(session, value) {
  const hotelId = requireString(value, "hotel_id", { max: 80 });
  requireAdminHotelAccess(session, hotelId);
  return hotelId;
}

function normalizeCategoryKey(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!normalized) throw badRequest("Identificador da categoria inválido.");
  return normalized;
}

function normalizeSortOrder(value, fallback) {
  if (value == null || value === "") return Number(fallback || 100);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000) {
    throw badRequest("Ordem inválida.");
  }
  return parsed;
}

export const specialDecorationsCatalogInternalsForTests = {
  normalizeCategoryKey,
  normalizeIncludedItems,
  normalizePrice,
  parseIncludedItems,
  toAdminItem,
};
