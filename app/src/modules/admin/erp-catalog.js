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
import { erpActorIds } from "../../services/erp-auth.js";

export const ERP_CATALOG_MANAGE_PERMISSION = "room-service.catalog.manage";
const MODULE_KEY = "room-service";
const ITEM_STATUSES = new Set(["active", "inactive", "archived"]);
const CATEGORY_STATUSES = new Set(["active", "inactive", "archived"]);

export async function createRoomServiceCategory({ request, env, session }) {
  requirePermission(session, ERP_CATALOG_MANAGE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const catalog = await requireCatalog(env, hotelId);
  const name = requireString(payload.name, "name", { max: 120 });
  const description = optionalString(payload.description, "description", { max: 500 }) || null;
  const sortOrder = normalizeSortOrder(payload.sort_order, 100);
  const categoryId = createPublicId("category");
  const now = requestNow({ request, env });
  try {
    await batch(env, [
      statement(
        env,
        `INSERT INTO categories (
           id, hotel_id, catalog_id, module_key, name, description,
           status, sort_order, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        [categoryId, hotelId, catalog.id, MODULE_KEY, name, description, sortOrder, now, now],
      ),
      catalogAuditStatement(env, session, {
        hotelId,
        action: "room-service.category.created",
        entityType: "category",
        entityId: categoryId,
        metadata: { name },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (/unique constraint failed.*categories/i.test(String(error?.message || ""))) {
      throw conflict("Ja existe uma categoria com esse nome.");
    }
    throw error;
  }
  return { category: await requireCategory(env, hotelId, categoryId) };
}

export async function updateRoomServiceCategory({ request, env, session, categoryId }) {
  requirePermission(session, ERP_CATALOG_MANAGE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const current = await requireCategory(env, hotelId, categoryId);
  const name = Object.hasOwn(payload, "name") ? requireString(payload.name, "name", { max: 120 }) : current.name;
  const description = Object.hasOwn(payload, "description") ? optionalString(payload.description, "description", { max: 500 }) || null : current.description;
  const status = Object.hasOwn(payload, "status") ? requireString(payload.status, "status", { max: 20 }) : current.status;
  if (!CATEGORY_STATUSES.has(status)) throw badRequest("Status de categoria invalido.");
  const sortOrder = Object.hasOwn(payload, "sort_order") ? normalizeSortOrder(payload.sort_order, current.sort_order) : Number(current.sort_order);
  const now = requestNow({ request, env });
  try {
    await batch(env, [
      statement(
        env,
        `UPDATE categories
            SET name = ?, description = ?, status = ?, sort_order = ?, updated_at = ?
          WHERE id = ? AND hotel_id = ? AND module_key = ?`,
        [name, description, status, sortOrder, now, categoryId, hotelId, MODULE_KEY],
      ),
      catalogAuditStatement(env, session, {
        hotelId,
        action: "room-service.category.updated",
        entityType: "category",
        entityId: categoryId,
        metadata: { name, status },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (/unique constraint failed.*categories/i.test(String(error?.message || ""))) {
      throw conflict("Ja existe uma categoria com esse nome.");
    }
    throw error;
  }
  return { category: await requireCategory(env, hotelId, categoryId) };
}

export async function createRoomServiceCatalogItem({ request, env, session }) {
  requirePermission(session, ERP_CATALOG_MANAGE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const catalog = await requireCatalog(env, hotelId);
  const category = await requireCategory(env, hotelId, payload.category_id);
  if (category.catalog_id !== catalog.id) throw badRequest("Categoria nao pertence ao cardapio da unidade.");
  const values = await normalizeItemValues(env, hotelId, payload, null);
  const itemId = createPublicId("item");
  const publicId = createPublicId("product");
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `INSERT INTO catalog_items (
         id, public_id, hotel_id, catalog_id, category_id, module_key,
         item_type, name, description, tag, price_cents, currency, image_url,
         status, sort_order, metadata_json, created_at, updated_at, archived_at,
         media_asset_id
       ) VALUES (?, ?, ?, ?, ?, ?, 'product', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      [
        itemId,
        publicId,
        hotelId,
        catalog.id,
        category.id,
        MODULE_KEY,
        values.name,
        values.description,
        values.tag,
        values.price_cents,
        values.currency,
        values.image_url,
        values.status,
        values.sort_order,
        now,
        now,
        values.status === "archived" ? now : null,
        values.media_asset_id,
      ],
    ),
    availabilityStatement(env, hotelId, itemId, values.is_available, values.availability_label, now),
    catalogAuditStatement(env, session, {
      hotelId,
      action: "room-service.catalog_item.created",
      entityType: "catalog_item",
      entityId: itemId,
      metadata: { category_id: category.id, media_asset_id: values.media_asset_id },
      createdAt: now,
    }),
  ]);
  return { item: await requireCatalogItem(env, hotelId, itemId) };
}

export async function updateRoomServiceCatalogItem({ request, env, session, itemId }) {
  requirePermission(session, ERP_CATALOG_MANAGE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const current = await requireCatalogItem(env, hotelId, itemId);
  const categoryId = Object.hasOwn(payload, "category_id") ? requireString(payload.category_id, "category_id", { max: 100 }) : current.category_id;
  const category = await requireCategory(env, hotelId, categoryId);
  if (category.catalog_id !== current.catalog_id) throw badRequest("Categoria nao pertence ao cardapio do item.");
  const values = await normalizeItemValues(env, hotelId, payload, current);
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE catalog_items
          SET category_id = ?, name = ?, description = ?, tag = ?, price_cents = ?,
              currency = ?, image_url = ?, status = ?, sort_order = ?,
              media_asset_id = ?, updated_at = ?, archived_at = ?
        WHERE id = ? AND hotel_id = ? AND module_key = ?`,
      [
        category.id,
        values.name,
        values.description,
        values.tag,
        values.price_cents,
        values.currency,
        values.image_url,
        values.status,
        values.sort_order,
        values.media_asset_id,
        now,
        values.status === "archived" ? now : null,
        itemId,
        hotelId,
        MODULE_KEY,
      ],
    ),
    availabilityStatement(env, hotelId, itemId, values.is_available, values.availability_label, now),
    catalogAuditStatement(env, session, {
      hotelId,
      action: "room-service.catalog_item.updated",
      entityType: "catalog_item",
      entityId: itemId,
      metadata: { category_id: category.id, status: values.status, media_asset_id: values.media_asset_id },
      createdAt: now,
    }),
  ]);
  return { item: await requireCatalogItem(env, hotelId, itemId) };
}

export async function deleteRoomServiceCatalogItem({ request, env, session, itemId }) {
  requirePermission(session, ERP_CATALOG_MANAGE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const current = await requireCatalogItem(env, hotelId, itemId);
  const now = requestNow({ request, env });
  const actor = erpActorIds(session);
  const results = await batch(env, [
    statement(
      env,
      `INSERT INTO admin_audit_log (
         id, hotel_id, module_key, actor_user_id, actor_erp_user_id,
         action, entity_type, entity_id, metadata_json, created_at
       )
       SELECT ?, ci.hotel_id, ci.module_key, ?, ?,
              'room-service.catalog_item.deleted', 'catalog_item', ci.id, ?, ?
         FROM catalog_items ci
        WHERE ci.id = ? AND ci.hotel_id = ? AND ci.module_key = ?`,
      [
        createPublicId("audit"),
        actor.adminUserId,
        actor.erpUserId,
        JSON.stringify({ name: current.name, category_id: current.category_id, public_id: current.public_id }),
        now,
        itemId,
        hotelId,
        MODULE_KEY,
      ],
    ),
    statement(
      env,
      `DELETE FROM catalog_items
        WHERE id = ? AND hotel_id = ? AND module_key = ?`,
      [itemId, hotelId, MODULE_KEY],
    ),
  ]);
  if (Number(results?.[0]?.meta?.changes || 0) !== 1 || Number(results?.[1]?.meta?.changes || 0) !== 1) {
    throw conflict("Item do cardapio foi alterado por outro usuario.");
  }
  return { deleted: true, item_id: itemId };
}

export async function listRoomServiceCatalogCategories(env, hotelId) {
  return all(
    env,
    `SELECT id, hotel_id, catalog_id, module_key, name, description, status, sort_order
       FROM categories
      WHERE hotel_id = ?
        AND module_key = ?
        AND status != 'archived'
      ORDER BY sort_order, name`,
    [hotelId, MODULE_KEY],
  );
}

async function normalizeItemValues(env, hotelId, payload, current) {
  const name = Object.hasOwn(payload, "name") ? requireString(payload.name, "name", { max: 160 }) : current?.name;
  if (!name) throw badRequest("name e obrigatorio.");
  const description = Object.hasOwn(payload, "description")
    ? optionalString(payload.description, "description", { max: 1000 }) || null
    : current?.description || null;
  const tag = Object.hasOwn(payload, "tag")
    ? optionalString(payload.tag, "tag", { max: 60 }) || null
    : current?.tag || null;
  const priceCents = Object.hasOwn(payload, "price_cents") ? Number(payload.price_cents) : Number(current?.price_cents);
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 100000000) throw badRequest("Preco invalido.");
  const currency = Object.hasOwn(payload, "currency") ? requireString(payload.currency, "currency", { max: 3 }).toUpperCase() : current?.currency || "BRL";
  const status = Object.hasOwn(payload, "status") ? requireString(payload.status, "status", { max: 20 }) : current?.status || "active";
  if (!ITEM_STATUSES.has(status)) throw badRequest("Status de item invalido.");
  const sortOrder = Object.hasOwn(payload, "sort_order") ? normalizeSortOrder(payload.sort_order, 100) : Number(current?.sort_order || 100);
  const isAvailable = Object.hasOwn(payload, "is_available") ? normalizeBoolean(payload.is_available, "is_available") : current?.is_available !== 0;
  const availabilityLabel = Object.hasOwn(payload, "availability_label")
    ? optionalString(payload.availability_label, "availability_label", { max: 120 }) || null
    : current?.availability_label || null;
  const mediaAssetId = Object.hasOwn(payload, "media_asset_id")
    ? optionalString(payload.media_asset_id, "media_asset_id", { max: 120 }) || null
    : current?.media_asset_id || null;
  if (mediaAssetId) await requireMediaAsset(env, hotelId, mediaAssetId);
  return {
    name,
    description,
    tag,
    price_cents: priceCents,
    currency,
    status,
    sort_order: sortOrder,
    is_available: isAvailable,
    availability_label: availabilityLabel,
    media_asset_id: mediaAssetId,
    image_url: mediaAssetId ? `/media/${mediaAssetId}` : null,
  };
}

async function requireCatalog(env, hotelId) {
  const catalog = await first(
    env,
    `SELECT c.id, c.hotel_id, c.module_key, h.currency, c.status
       FROM catalogs c
       JOIN hotels h ON h.id = c.hotel_id
      WHERE c.hotel_id = ? AND c.module_key = ? AND c.status = 'active'
      ORDER BY c.sort_order
      LIMIT 1`,
    [hotelId, MODULE_KEY],
  );
  if (!catalog) throw notFoundError("Cardapio ativo nao encontrado para a unidade.");
  return catalog;
}

async function requireCategory(env, hotelId, categoryIdValue) {
  const categoryId = requireString(categoryIdValue, "category_id", { max: 120 });
  const category = await first(
    env,
    `SELECT id, hotel_id, catalog_id, module_key, name, description, status, sort_order
       FROM categories
      WHERE id = ? AND hotel_id = ? AND module_key = ?
      LIMIT 1`,
    [categoryId, hotelId, MODULE_KEY],
  );
  if (!category) throw notFoundError("Categoria nao encontrada.");
  return category;
}

async function requireCatalogItem(env, hotelId, itemId) {
  const item = await first(
    env,
    `SELECT ci.id, ci.public_id, ci.hotel_id, ci.catalog_id, ci.category_id,
            ci.module_key, ci.item_type, ci.name, ci.description, ci.tag, ci.price_cents,
            ci.currency, ci.image_url, ci.status, ci.sort_order, ci.media_asset_id,
            ca.is_available, ca.availability_label
       FROM catalog_items ci
       LEFT JOIN catalog_item_availability ca
              ON ca.catalog_item_id = ci.id AND ca.hotel_id = ci.hotel_id
      WHERE ci.id = ? AND ci.hotel_id = ? AND ci.module_key = ?
      LIMIT 1`,
    [itemId, hotelId, MODULE_KEY],
  );
  if (!item) throw notFoundError("Item do cardapio nao encontrado.");
  return { ...item, is_available: item.is_available !== 0 };
}

async function requireMediaAsset(env, hotelId, assetId) {
  const asset = await first(
    env,
    `SELECT id
       FROM media_assets
      WHERE id = ?
        AND hotel_id = ?
        AND (module_key = ? OR module_key IS NULL)
        AND status = 'active'
      LIMIT 1`,
    [assetId, hotelId, MODULE_KEY],
  );
  if (!asset) throw badRequest("Imagem nao pertence a biblioteca ativa desta unidade.");
  return asset;
}

function availabilityStatement(env, hotelId, itemId, isAvailable, label, now) {
  return statement(
    env,
    `INSERT INTO catalog_item_availability (
       hotel_id, catalog_item_id, is_available, availability_label, starts_at, ends_at, updated_at
     ) VALUES (?, ?, ?, ?, NULL, NULL, ?)
     ON CONFLICT(hotel_id, catalog_item_id) DO UPDATE SET
       is_available = excluded.is_available,
       availability_label = excluded.availability_label,
       starts_at = NULL,
       ends_at = NULL,
       updated_at = excluded.updated_at`,
    [hotelId, itemId, isAvailable ? 1 : 0, label, now],
  );
}

function catalogAuditStatement(env, session, { hotelId, action, entityType, entityId, metadata, createdAt }) {
  const actor = erpActorIds(session);
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, actor_erp_user_id,
       action, entity_type, entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createPublicId("audit"),
      hotelId,
      MODULE_KEY,
      actor.adminUserId,
      actor.erpUserId,
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

function normalizeSortOrder(value, fallback) {
  if (value == null || value === "") return Number(fallback || 100);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000) throw badRequest("Ordem invalida.");
  return parsed;
}

function normalizeBoolean(value, label) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  throw badRequest(`${label} deve ser booleano.`);
}
