import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import initSqlJs from "sql.js";
import { defaultDevelopmentCatalogSnapshot } from "./catalog-import-package.js";
import { sqliteLiteral } from "./sqlite-literals.js";

const require = createRequire(import.meta.url);

export async function validateCatalogImportPackage({
  applySql,
  rollbackSql,
  manifest,
  repoRoot = process.cwd(),
  outputDatabasePath = null,
  baselineSnapshot = defaultDevelopmentCatalogSnapshot({ hotelId: manifest.hotel_id, moduleKey: manifest.module_key }),
} = {}) {
  const SQL = await initSqlJs({ locateFile: (file) => require.resolve(`sql.js/dist/${file}`) });
  const db = new SQL.Database();

  await applyMigrations(db, path.join(repoRoot, "app", "migrations"));
  db.run(buildValidationFixtureSql({ hotelId: manifest.hotel_id, moduleKey: manifest.module_key, baselineSnapshot }));

  const before = snapshot(db, manifest);
  db.run(applySql);
  const afterFirstApply = snapshot(db, manifest);
  const firstCreatedAt = selectCandidateCreatedAt(db, manifest);
  db.run(applySql);
  const afterSecondApply = snapshot(db, manifest);
  const secondCreatedAt = selectCandidateCreatedAt(db, manifest);
  db.run(rollbackSql);
  const afterRollback = snapshot(db, manifest);

  if (outputDatabasePath) {
    await fs.mkdir(path.dirname(outputDatabasePath), { recursive: true });
    await fs.writeFile(outputDatabasePath, Buffer.from(db.export()));
  }
  db.close();

  const expected = manifest.counts;
  const result = {
    generated_at: new Date().toISOString(),
    database: "sqlite-temporario-local",
    migrations_applied: 7,
    before,
    after_first_apply: afterFirstApply,
    after_second_apply: afterSecondApply,
    after_rollback: afterRollback,
    checks: {
      imported_catalog_count_ok: afterFirstApply.active_catalogs === 1,
      imported_category_count_ok: afterFirstApply.imported_categories === expected.categories,
      imported_product_count_ok: afterFirstApply.imported_products === expected.products,
      imported_available_count_ok: afterFirstApply.imported_available_products === expected.available,
      imported_unavailable_count_ok: afterFirstApply.imported_unavailable_products === expected.unavailable,
      missing_items_archived_ok: afterFirstApply.archived_missing_items === expected.records_to_archive,
      aurora_untouched_ok: before.aurora_hash === afterFirstApply.aurora_hash && afterFirstApply.aurora_hash === afterSecondApply.aurora_hash && afterSecondApply.aurora_hash === afterRollback.aurora_hash,
      orders_untouched_ok: before.orders_hash === afterFirstApply.orders_hash && afterFirstApply.orders_hash === afterSecondApply.orders_hash && afterSecondApply.orders_hash === afterRollback.orders_hash,
      order_items_untouched_ok:
        before.order_items_hash === afterFirstApply.order_items_hash &&
        afterFirstApply.order_items_hash === afterSecondApply.order_items_hash &&
        afterSecondApply.order_items_hash === afterRollback.order_items_hash,
      second_apply_same_counts_ok: comparableCounts(afterFirstApply) === comparableCounts(afterSecondApply),
      created_at_preserved_on_second_apply_ok: firstCreatedAt === secondCreatedAt,
      availability_absence_restored_ok: availabilityAbsenceRestoredOk({ before, afterRollback, manifest }),
      rollback_functional_state_ok: rollbackFunctionalStateOk({ before, afterRollback, manifest }),
    },
  };
  result.ok = Object.values(result.checks).every(Boolean);
  return result;
}

async function applyMigrations(db, migrationsDir) {
  const files = (await fs.readdir(migrationsDir)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  for (const file of files) {
    db.run(await fs.readFile(path.join(migrationsDir, file), "utf8"));
  }
}

function buildValidationFixtureSql({ hotelId, moduleKey, baselineSnapshot }) {
  const timestamp = "2026-07-04T00:00:00.000Z";
  const lines = [
    "PRAGMA foreign_keys = ON;",
    "BEGIN TRANSACTION;",
    `INSERT INTO modules (module_key, name, description, status, created_at, updated_at) VALUES (${sqliteLiteral(moduleKey)}, 'Room Service', 'Modulo ficticio para validacao local.', 'foundation', ${sqliteLiteral(timestamp)}, ${sqliteLiteral(timestamp)});`,
    "INSERT INTO modules (module_key, name, description, status, created_at, updated_at) VALUES ('emporio', 'Emporio', 'Modulo ficticio protegido.', 'planned', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');",
    `INSERT INTO hotels (id, slug, name, short_name, timezone, locale, currency, status, created_at, updated_at) VALUES (${sqliteLiteral(hotelId)}, ${sqliteLiteral(hotelId)}, 'Hotel fixture', 'Fixture', 'America/Sao_Paulo', 'pt-BR', 'BRL', 'active', ${sqliteLiteral(timestamp)}, ${sqliteLiteral(timestamp)});`,
    "INSERT INTO hotels (id, slug, name, short_name, timezone, locale, currency, status, created_at, updated_at) VALUES ('aurora-demo', 'aurora-demo', 'Aurora fixture', 'Aurora', 'America/Sao_Paulo', 'pt-BR', 'BRL', 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');",
  ];

  for (const catalog of baselineSnapshot.catalogs) {
    lines.push(
      `INSERT INTO catalogs (id, hotel_id, module_key, name, description, status, sort_order, created_at, updated_at, archived_at) VALUES (${rowValues([
        catalog.id,
        catalog.hotel_id,
        catalog.module_key,
        catalog.name,
        catalog.description,
        catalog.status,
        catalog.sort_order,
        catalog.created_at,
        catalog.updated_at,
        catalog.archived_at,
      ])});`,
    );
  }
  lines.push(
    "INSERT INTO catalogs (id, hotel_id, module_key, name, description, status, sort_order, created_at, updated_at) VALUES ('cat-muller-emporio-fixture', 'muller-fioreze', 'emporio', 'Emporio protegido', 'Fixture protegida.', 'active', 20, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');",
    "INSERT INTO catalogs (id, hotel_id, module_key, name, description, status, sort_order, created_at, updated_at) VALUES ('cat-aurora-room-service', 'aurora-demo', 'room-service', 'Aurora protegido', 'Fixture protegida.', 'active', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');",
  );

  for (const category of baselineSnapshot.categories) {
    lines.push(
      `INSERT INTO categories (id, hotel_id, catalog_id, module_key, name, description, status, sort_order, created_at, updated_at) VALUES (${rowValues([
        category.id,
        category.hotel_id,
        category.catalog_id,
        category.module_key,
        category.name,
        category.description,
        category.status,
        category.sort_order,
        category.created_at,
        category.updated_at,
      ])});`,
    );
  }
  lines.push(
    "INSERT INTO categories (id, hotel_id, catalog_id, module_key, name, description, status, sort_order, created_at, updated_at) VALUES ('catg-muller-emporio-fixture', 'muller-fioreze', 'cat-muller-emporio-fixture', 'emporio', 'Emporio protegido', 'Fixture protegida.', 'active', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');",
    "INSERT INTO categories (id, hotel_id, catalog_id, module_key, name, description, status, sort_order, created_at, updated_at) VALUES ('catg-aurora-fixture', 'aurora-demo', 'cat-aurora-room-service', 'room-service', 'Aurora protegido', 'Fixture protegida.', 'active', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');",
  );

  for (const item of baselineSnapshot.items) {
    lines.push(
      `INSERT INTO catalog_items (id, public_id, hotel_id, catalog_id, category_id, module_key, item_type, name, description, price_cents, currency, image_url, status, sort_order, metadata_json, created_at, updated_at, archived_at) VALUES (${rowValues([
        item.id,
        item.public_id,
        item.hotel_id,
        item.catalog_id,
        item.category_id,
        item.module_key,
        item.item_type,
        item.name,
        item.description,
        item.price_cents,
        item.currency,
        item.image_url,
        item.status,
        item.sort_order,
        item.metadata_json,
        item.created_at,
        item.updated_at,
        item.archived_at,
      ])});`,
    );
  }
  lines.push(
    "INSERT INTO catalog_items (id, public_id, hotel_id, catalog_id, category_id, module_key, item_type, name, description, price_cents, currency, image_url, status, sort_order, metadata_json, created_at, updated_at) VALUES ('item-muller-emporio-fixture', 'pub-muller-emporio-fixture', 'muller-fioreze', 'cat-muller-emporio-fixture', 'catg-muller-emporio-fixture', 'emporio', 'product', 'Emporio protegido', 'Fixture protegida.', 3300, 'BRL', NULL, 'active', 10, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');",
    "INSERT INTO catalog_items (id, public_id, hotel_id, catalog_id, category_id, module_key, item_type, name, description, price_cents, currency, image_url, status, sort_order, metadata_json, created_at, updated_at) VALUES ('item-aurora-fixture', 'pub-aurora-fixture', 'aurora-demo', 'cat-aurora-room-service', 'catg-aurora-fixture', 'room-service', 'product', 'Aurora protegido', 'Fixture protegida.', 1100, 'BRL', NULL, 'active', 10, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');",
  );

  for (const availability of baselineSnapshot.availability) {
    lines.push(
      `INSERT INTO catalog_item_availability (hotel_id, catalog_item_id, is_available, availability_label, starts_at, ends_at, updated_at) VALUES (${rowValues([
        availability.hotel_id,
        availability.catalog_item_id,
        availability.is_available,
        availability.availability_label,
        availability.starts_at,
        availability.ends_at,
        availability.updated_at,
      ])});`,
    );
  }
  lines.push(
    "INSERT INTO catalog_item_availability (hotel_id, catalog_item_id, is_available, availability_label, updated_at) VALUES ('muller-fioreze', 'item-muller-emporio-fixture', 1, NULL, '2026-07-04T00:00:00.000Z');",
    "INSERT INTO catalog_item_availability (hotel_id, catalog_item_id, is_available, availability_label, updated_at) VALUES ('aurora-demo', 'item-aurora-fixture', 1, NULL, '2026-07-04T00:00:00.000Z');",
    "INSERT INTO orders (id, public_id, hotel_id, module_key, origin, room_id, room_code, guest_name, notes, currency, subtotal_cents, discount_cents, total_cents, status, idempotency_key, created_at, updated_at) VALUES ('order-fixture-muller', 'order_fixture_muller', 'muller-fioreze', 'room-service', 'fixture', NULL, 'D-000', 'Hospede Fixture', 'Pedido ficticio.', 'BRL', 900, 0, 900, 'received', 'fixture-order-muller', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');",
    "INSERT INTO order_items (id, order_id, hotel_id, module_key, catalog_item_id, item_name_snapshot, item_description_snapshot, unit_price_cents, quantity, line_total_cents, selected_options_snapshot, created_at) VALUES ('order-item-fixture-muller', 'order-fixture-muller', 'muller-fioreze', 'room-service', NULL, 'Cafe demo', 'Snapshot ficticio.', 900, 1, 900, NULL, '2026-07-04T00:00:00.000Z');",
    "COMMIT;",
  );
  return `${lines.join("\n")}\n`;
}

function snapshot(db, manifest) {
  const hotelId = manifest.hotel_id;
  const moduleKey = manifest.module_key;
  const candidateIds = manifest.candidate_record_ids.item_ids;
  const candidateCategoryIds = candidateIdsFromCategories(manifest);
  const beforeStateIds = manifest.before_state?.ids || null;
  const newCandidateItemIds = beforeStateIds ? candidateIds.filter((id) => !beforeStateIds.item_ids.includes(id)) : candidateIds;
  const newCandidateCategoryIds = beforeStateIds ? candidateCategoryIds.filter((id) => !beforeStateIds.category_ids.includes(id)) : candidateCategoryIds;
  const newCandidateCatalogIds = beforeStateIds
    ? [manifest.candidate_record_ids.catalog_id].filter((id) => !beforeStateIds.catalog_ids.includes(id))
    : [manifest.candidate_record_ids.catalog_id];
  const baselineIds = ["item-muller-cafe-demo", "item-muller-sanduiche-demo", "item-muller-indisponivel-demo", "item-muller-arquivado-demo"];
  return {
    active_catalogs: count(db, "SELECT COUNT(*) AS n FROM catalogs WHERE hotel_id=? AND module_key=? AND status='active'", [hotelId, moduleKey]),
    imported_categories: countIn(db, "categories", "id", candidateCategoryIds, "hotel_id=? AND module_key=?", [hotelId, moduleKey]),
    imported_products: countIn(db, "catalog_items", "id", candidateIds, "hotel_id=? AND module_key=?", [hotelId, moduleKey]),
    imported_active_products: countIn(db, "catalog_items", "id", candidateIds, "hotel_id=? AND module_key=? AND status='active'", [hotelId, moduleKey]),
    imported_available_products: countIn(
      db,
      "catalog_item_availability",
      "catalog_item_id",
      candidateIds,
      "hotel_id=? AND is_available=1",
      [hotelId],
    ),
    imported_unavailable_products: countIn(
      db,
      "catalog_item_availability",
      "catalog_item_id",
      candidateIds,
      "hotel_id=? AND is_available=0",
      [hotelId],
    ),
    archived_missing_items: count(db, "SELECT COUNT(*) AS n FROM catalog_items WHERE hotel_id=? AND module_key=? AND status='archived' AND id IN ('item-muller-cafe-demo','item-muller-sanduiche-demo','item-muller-indisponivel-demo')", [hotelId, moduleKey]),
    active_baseline_items: countIn(db, "catalog_items", "id", baselineIds, "hotel_id=? AND module_key=? AND status='active'", [hotelId, moduleKey]),
    archived_baseline_items: countIn(db, "catalog_items", "id", baselineIds, "hotel_id=? AND module_key=? AND status='archived'", [hotelId, moduleKey]),
    new_imported_active_catalogs: countIn(db, "catalogs", "id", newCandidateCatalogIds, "hotel_id=? AND module_key=? AND status='active'", [hotelId, moduleKey]),
    new_imported_active_categories: countIn(db, "categories", "id", newCandidateCategoryIds, "hotel_id=? AND module_key=? AND status='active'", [hotelId, moduleKey]),
    new_imported_active_products: countIn(db, "catalog_items", "id", newCandidateItemIds, "hotel_id=? AND module_key=? AND status='active'", [hotelId, moduleKey]),
    before_state_hash: beforeStateIds ? beforeStateHash(db, beforeStateIds) : null,
    before_state_availability_hash: beforeStateIds ? beforeStateAvailabilityHash(db, hotelId, beforeStateIds.item_ids) : null,
    aurora_hash: tableHash(db, "SELECT id, status, price_cents FROM catalog_items WHERE hotel_id='aurora-demo' ORDER BY id"),
    orders_hash: tableHash(db, "SELECT id, status, total_cents, updated_at FROM orders ORDER BY id"),
    order_items_hash: tableHash(db, "SELECT id, catalog_item_id, unit_price_cents, quantity FROM order_items ORDER BY id"),
  };
}

function rollbackFunctionalStateOk({ before, afterRollback, manifest }) {
  if (manifest.before_state?.ids) {
    return (
      afterRollback.before_state_hash === before.before_state_hash &&
      afterRollback.new_imported_active_catalogs === 0 &&
      afterRollback.new_imported_active_categories === 0 &&
      afterRollback.new_imported_active_products === 0 &&
      afterRollback.orders_hash === before.orders_hash &&
      afterRollback.order_items_hash === before.order_items_hash
    );
  }
  return (
    afterRollback.active_baseline_items === before.active_baseline_items &&
    afterRollback.archived_baseline_items === before.archived_baseline_items &&
    afterRollback.imported_active_products === 0 &&
    afterRollback.orders_hash === before.orders_hash &&
    afterRollback.order_items_hash === before.order_items_hash
  );
}

function availabilityAbsenceRestoredOk({ before, afterRollback, manifest }) {
  if (!manifest.before_state?.ids) return true;
  return afterRollback.before_state_availability_hash === before.before_state_availability_hash;
}

function selectCandidateCreatedAt(db, manifest) {
  const ids = manifest.candidate_record_ids.item_ids;
  if (!ids.length) return "";
  return tableHash(db, `SELECT id, created_at FROM catalog_items WHERE id IN ${literalList(ids)} ORDER BY id`);
}

function count(db, sql, params = []) {
  const statement = db.prepare(sql);
  statement.bind(params);
  const value = statement.step() ? statement.getAsObject().n : 0;
  statement.free();
  return value;
}

function countIn(db, table, column, ids, extraWhere, params = []) {
  if (!ids.length) return 0;
  return count(db, `SELECT COUNT(*) AS n FROM ${table} WHERE ${extraWhere} AND ${column} IN ${literalList(ids)}`, params);
}

function tableHash(db, sql) {
  const rows = [];
  const statement = db.prepare(sql);
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return simpleHash(JSON.stringify(rows));
}

function beforeStateHash(db, ids) {
  return combinedTableHash(db, [
    `SELECT 'catalogs' AS table_name, id, hotel_id, module_key, name, description, status, sort_order, created_at, updated_at, archived_at FROM catalogs WHERE id IN ${literalList(ids.catalog_ids)} ORDER BY id`,
    `SELECT 'categories' AS table_name, id, hotel_id, catalog_id, module_key, name, description, status, sort_order, created_at, updated_at FROM categories WHERE id IN ${literalList(ids.category_ids)} ORDER BY id`,
    `SELECT 'catalog_items' AS table_name, id, public_id, hotel_id, catalog_id, category_id, module_key, item_type, name, description, price_cents, currency, image_url, status, sort_order, metadata_json, created_at, updated_at, archived_at FROM catalog_items WHERE id IN ${literalList(ids.item_ids)} ORDER BY id`,
    `SELECT 'catalog_item_availability' AS table_name, hotel_id, catalog_item_id, is_available, availability_label, starts_at, ends_at, updated_at FROM catalog_item_availability WHERE catalog_item_id IN ${literalList(ids.item_ids)} ORDER BY catalog_item_id`,
  ]);
}

function beforeStateAvailabilityHash(db, hotelId, itemIds) {
  return tableHash(
    db,
    `SELECT hotel_id, catalog_item_id, is_available, availability_label, starts_at, ends_at, updated_at FROM catalog_item_availability WHERE hotel_id=${sqliteLiteral(hotelId)} AND catalog_item_id IN ${literalList(itemIds)} ORDER BY catalog_item_id`,
  );
}

function combinedTableHash(db, queries) {
  const rows = [];
  for (const sql of queries) {
    const statement = db.prepare(sql);
    while (statement.step()) rows.push(statement.getAsObject());
    statement.free();
  }
  return simpleHash(JSON.stringify(rows));
}

function comparableCounts(snapshot) {
  return JSON.stringify({
    active_catalogs: snapshot.active_catalogs,
    imported_categories: snapshot.imported_categories,
    imported_products: snapshot.imported_products,
    imported_active_products: snapshot.imported_active_products,
    imported_available_products: snapshot.imported_available_products,
    imported_unavailable_products: snapshot.imported_unavailable_products,
    archived_missing_items: snapshot.archived_missing_items,
  });
}

function candidateIdsFromCategories(manifest) {
  return manifest.candidate_record_ids.category_ids || [];
}

function rowValues(values) {
  return values.map(sqliteLiteral).join(", ");
}

function literalList(values) {
  if (!values.length) return "(NULL)";
  return `(${values.map(sqliteLiteral).join(", ")})`;
}

function simpleHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
