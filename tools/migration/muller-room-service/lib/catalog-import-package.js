import crypto from "node:crypto";
import { stableHash } from "./hash.js";
import { insertOrUpdateSql, literalList, sqliteLiteral, updateSql } from "./sqlite-literals.js";

export const IMPORT_PACKAGE_VERSION = "0.2.2";

export const EXPLICIT_TRANSACTION_STATEMENT_PATTERN = /^\s*(BEGIN(?:\s+TRANSACTION)?|COMMIT|END\s+TRANSACTION|ROLLBACK(?:\s+TO)?|SAVEPOINT|RELEASE)\b/im;

export const AFFECTED_TABLES = ["catalogs", "categories", "catalog_items", "catalog_item_availability"];

export const PROHIBITED_TABLES = [
  "orders",
  "order_items",
  "order_status_history",
  "print_events",
  "admin_users",
  "admin_sessions",
  "admin_audit_log",
  "rooms",
  "hotel_settings",
];

export function hasExplicitTransactionStatements(sql) {
  return EXPLICIT_TRANSACTION_STATEMENT_PATTERN.test(sql);
}

export function buildExecutableCatalogImportPackage({
  catalogData,
  hotelId = "muller-fioreze",
  moduleKey = "room-service",
  inputHashes = [],
  gitHead = null,
  archiveMissing = false,
  generatedAt = new Date().toISOString(),
  baselineSnapshot = defaultDevelopmentCatalogSnapshot({ hotelId, moduleKey }),
  beforeState = null,
} = {}) {
  if (!catalogData?.catalog) throw new Error("Catalogo normalizado obrigatorio.");
  if (moduleKey !== "room-service") throw new Error("Esta ferramenta prepara apenas o modulo room-service.");

  const candidate = buildCandidateRows({ catalogData, hotelId, moduleKey, generatedAt });
  const baseline = normalizeSnapshot(baselineSnapshot);
  const duplicateNameGroups = buildDuplicateNameGroups(candidate.items);
  const realBeforeState = beforeState?.snapshot ? normalizeSnapshot(beforeState.snapshot) : null;
  const archiveBaseline = realBeforeState || baseline;
  const activeBaselineItemIds = new Set(archiveBaseline.items.filter((item) => item.status === "active").map((item) => item.id));
  const candidateItemIds = new Set(candidate.items.map((item) => item.id));
  const itemIdsToArchive = [...activeBaselineItemIds].filter((id) => !candidateItemIds.has(id));

  const applySql = buildApplySql({ candidate, hotelId, moduleKey, generatedAt, archiveMissing });
  const fixtureRollbackSql = buildRollbackSql({ candidate, baseline, hotelId, moduleKey, generatedAt, rollbackKind: "fixture" });
  const remoteRollbackSql = realBeforeState
    ? buildRollbackSql({ candidate, baseline: realBeforeState, hotelId, moduleKey, generatedAt, rollbackKind: "remote" })
    : null;
  const snapshotQuerySql = buildSnapshotQuerySql({ hotelId, moduleKey });
  const validation = buildStaticValidation({ candidate, baseline: archiveBaseline, itemIdsToArchive });
  const beforeExpected = buildBeforeExpected({ baseline: archiveBaseline, hotelId, moduleKey, source: realBeforeState ? "snapshot-real-anterior" : "fixture-ficticia-local" });
  const afterExpected = buildAfterExpected({ candidate, baseline: archiveBaseline, itemIdsToArchive, hotelId, moduleKey });
  const manifest = buildManifest({
    candidate,
    baseline,
    duplicateNameGroups,
    itemIdsToArchive,
    inputHashes,
    generatedAt,
    gitHead,
    applySql,
    fixtureRollbackSql,
    remoteRollbackSql,
    snapshotQuerySql,
    archiveMissing,
    beforeState,
  });

  return {
    applySql,
    fixtureRollbackSql,
    remoteRollbackSql,
    snapshotQuerySql,
    manifest,
    validation,
    beforeExpected,
    afterExpected,
  };
}

export function defaultDevelopmentCatalogSnapshot({ hotelId = "muller-fioreze", moduleKey = "room-service" } = {}) {
  const timestamp = "2026-07-04T00:00:00.000Z";
  return {
    catalogs: [
      {
        id: "cat-muller-room-service",
        hotel_id: hotelId,
        module_key: moduleKey,
        name: "Cardapio Room Service Demo",
        description: "Catalogo ficticio local.",
        status: "active",
        sort_order: 10,
        created_at: timestamp,
        updated_at: timestamp,
        archived_at: null,
      },
    ],
    categories: [
      {
        id: "catg-muller-bebidas",
        hotel_id: hotelId,
        catalog_id: "cat-muller-room-service",
        module_key: moduleKey,
        name: "Bebidas demo",
        description: "Bebidas ficticias.",
        status: "active",
        sort_order: 10,
        created_at: timestamp,
        updated_at: timestamp,
      },
      {
        id: "catg-muller-lanches",
        hotel_id: hotelId,
        catalog_id: "cat-muller-room-service",
        module_key: moduleKey,
        name: "Lanches demo",
        description: "Lanches ficticios.",
        status: "active",
        sort_order: 20,
        created_at: timestamp,
        updated_at: timestamp,
      },
    ],
    items: [
      {
        id: "item-muller-cafe-demo",
        public_id: "pub-muller-cafe-demo",
        hotel_id: hotelId,
        catalog_id: "cat-muller-room-service",
        category_id: "catg-muller-bebidas",
        module_key: moduleKey,
        item_type: "product",
        name: "Cafe demo",
        description: "Bebida ficticia para teste local.",
        price_cents: 900,
        currency: "BRL",
        image_url: null,
        status: "active",
        sort_order: 10,
        metadata_json: null,
        created_at: timestamp,
        updated_at: timestamp,
        archived_at: null,
      },
      {
        id: "item-muller-sanduiche-demo",
        public_id: "pub-muller-sanduiche-demo",
        hotel_id: hotelId,
        catalog_id: "cat-muller-room-service",
        category_id: "catg-muller-lanches",
        module_key: moduleKey,
        item_type: "product",
        name: "Sanduiche demo",
        description: "Lanche ficticio para teste local.",
        price_cents: 2500,
        currency: "BRL",
        image_url: null,
        status: "active",
        sort_order: 20,
        metadata_json: null,
        created_at: timestamp,
        updated_at: timestamp,
        archived_at: null,
      },
      {
        id: "item-muller-indisponivel-demo",
        public_id: "pub-muller-indisponivel-demo",
        hotel_id: hotelId,
        catalog_id: "cat-muller-room-service",
        category_id: "catg-muller-lanches",
        module_key: moduleKey,
        item_type: "product",
        name: "Produto indisponivel demo",
        description: "Item usado em teste de disponibilidade.",
        price_cents: 1800,
        currency: "BRL",
        image_url: null,
        status: "active",
        sort_order: 30,
        metadata_json: null,
        created_at: timestamp,
        updated_at: timestamp,
        archived_at: null,
      },
      {
        id: "item-muller-arquivado-demo",
        public_id: "pub-muller-arquivado-demo",
        hotel_id: hotelId,
        catalog_id: "cat-muller-room-service",
        category_id: "catg-muller-lanches",
        module_key: moduleKey,
        item_type: "product",
        name: "Produto arquivado demo",
        description: "Item usado em teste de arquivamento.",
        price_cents: 1200,
        currency: "BRL",
        image_url: null,
        status: "archived",
        sort_order: 40,
        metadata_json: null,
        created_at: timestamp,
        updated_at: timestamp,
        archived_at: timestamp,
      },
    ],
    availability: [
      { hotel_id: hotelId, catalog_item_id: "item-muller-cafe-demo", is_available: 1, availability_label: null, starts_at: null, ends_at: null, updated_at: timestamp },
      { hotel_id: hotelId, catalog_item_id: "item-muller-sanduiche-demo", is_available: 1, availability_label: null, starts_at: null, ends_at: null, updated_at: timestamp },
      {
        hotel_id: hotelId,
        catalog_item_id: "item-muller-indisponivel-demo",
        is_available: 0,
        availability_label: "Indisponivel no teste local",
        starts_at: null,
        ends_at: null,
        updated_at: timestamp,
      },
      { hotel_id: hotelId, catalog_item_id: "item-muller-arquivado-demo", is_available: 1, availability_label: null, starts_at: null, ends_at: null, updated_at: timestamp },
    ],
  };
}

function buildCandidateRows({ catalogData, hotelId, moduleKey, generatedAt }) {
  const invalidItems = catalogData.items.filter((item) => !item.validation?.price_valid || !item.validation?.has_name || !item.validation?.has_category);
  if (invalidItems.length) throw new Error(`Catalogo contem ${invalidItems.length} item(ns) invalido(s); gere somente apos corrigir a origem.`);

  const catalog = {
    id: catalogData.catalog.id,
    hotel_id: hotelId,
    module_key: moduleKey,
    name: catalogData.catalog.name,
    description: catalogData.catalog.description,
    status: "active",
    sort_order: toInteger(catalogData.catalog.sort_order, 10),
    created_at: generatedAt,
    updated_at: generatedAt,
    archived_at: null,
  };

  const categoryIds = new Set(catalogData.categories.map((category) => category.id));
  const categories = catalogData.categories.map((category, index) => ({
    id: category.id,
    hotel_id: hotelId,
    catalog_id: catalog.id,
    module_key: moduleKey,
    name: category.name,
    description: category.description || null,
    status: category.status || "active",
    sort_order: toInteger(category.sort_order, (index + 1) * 10),
    created_at: generatedAt,
    updated_at: generatedAt,
  }));

  const items = catalogData.items.map((item, index) => {
    if (!categoryIds.has(item.category_id)) throw new Error(`Categoria ausente para item ${item.id}.`);
    const metadata = {
      import_tool: "muller-room-service",
      source_hash: stableHash(`${item.source?.sheet || ""}:${item.source?.row || ""}`, 16),
      source_row: item.source?.row || null,
      source_sheet_hash: item.source?.sheet ? stableHash(item.source.sheet, 16) : null,
      source_image_hash: item.source_image_hash || null,
      source_image_kind: item.source_image_kind || "empty",
    };
    return {
      id: item.id,
      public_id: item.public_id,
      hotel_id: hotelId,
      catalog_id: catalog.id,
      category_id: item.category_id,
      module_key: moduleKey,
      item_type: item.item_type || "product",
      name: item.name,
      description: item.description || null,
      price_cents: toInteger(item.price_cents, 0),
      currency: item.currency || "BRL",
      image_url: item.image_url || null,
      status: item.status || "active",
      sort_order: toInteger(item.sort_order, (index + 1) * 10),
      metadata_json: JSON.stringify(metadata),
      created_at: generatedAt,
      updated_at: generatedAt,
      archived_at: null,
      is_available: item.is_available ? 1 : 0,
      availability_label: item.is_available ? null : item.availability_label || "Indisponivel",
    };
  });

  return {
    hotel_id: hotelId,
    module_key: moduleKey,
    catalog,
    categories,
    items,
    availability: items.map((item) => ({
      hotel_id: hotelId,
      catalog_item_id: item.id,
      is_available: item.is_available,
      availability_label: item.availability_label,
      starts_at: null,
      ends_at: null,
      updated_at: generatedAt,
    })),
  };
}

function buildApplySql({ candidate, hotelId, moduleKey, generatedAt, archiveMissing }) {
  const itemIds = candidate.items.map((item) => item.id);
  const lines = [
    "-- Catalog import apply SQL generated locally. Review before remote use.",
    "-- Scope: hotel_id=muller-fioreze, module_key=room-service.",
    "PRAGMA foreign_keys = ON;",
    insertOrUpdateSql(
      "catalogs",
      ["id", "hotel_id", "module_key", "name", "description", "status", "sort_order", "created_at", "updated_at", "archived_at"],
      [
        candidate.catalog.id,
        candidate.catalog.hotel_id,
        candidate.catalog.module_key,
        candidate.catalog.name,
        candidate.catalog.description,
        candidate.catalog.status,
        candidate.catalog.sort_order,
        candidate.catalog.created_at,
        candidate.catalog.updated_at,
        candidate.catalog.archived_at,
      ],
      {
        conflictColumns: ["id"],
        updateColumns: ["name", "description", "status", "sort_order", "updated_at", "archived_at"],
      },
    ),
  ];

  for (const category of candidate.categories) {
    lines.push(
      insertOrUpdateSql(
        "categories",
        ["id", "hotel_id", "catalog_id", "module_key", "name", "description", "status", "sort_order", "created_at", "updated_at"],
        [category.id, category.hotel_id, category.catalog_id, category.module_key, category.name, category.description, category.status, category.sort_order, category.created_at, category.updated_at],
        {
          conflictColumns: ["id"],
          updateColumns: ["catalog_id", "name", "description", "status", "sort_order", "updated_at"],
        },
      ),
    );
  }

  for (const item of candidate.items) {
    lines.push(
      insertOrUpdateSql(
        "catalog_items",
        [
          "id",
          "public_id",
          "hotel_id",
          "catalog_id",
          "category_id",
          "module_key",
          "item_type",
          "name",
          "description",
          "price_cents",
          "currency",
          "image_url",
          "status",
          "sort_order",
          "metadata_json",
          "created_at",
          "updated_at",
          "archived_at",
        ],
        [
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
        ],
        {
          conflictColumns: ["id"],
          updateColumns: ["public_id", "catalog_id", "category_id", "item_type", "name", "description", "price_cents", "currency", "image_url", "status", "sort_order", "metadata_json", "updated_at", "archived_at"],
        },
      ),
    );
    const availability = candidate.availability.find((entry) => entry.catalog_item_id === item.id);
    lines.push(
      insertOrUpdateSql(
        "catalog_item_availability",
        ["hotel_id", "catalog_item_id", "is_available", "availability_label", "starts_at", "ends_at", "updated_at"],
        [availability.hotel_id, availability.catalog_item_id, availability.is_available, availability.availability_label, availability.starts_at, availability.ends_at, availability.updated_at],
        {
          conflictColumns: ["hotel_id", "catalog_item_id"],
          updateColumns: ["is_available", "availability_label", "starts_at", "ends_at", "updated_at"],
        },
      ),
    );
  }

  if (archiveMissing) {
    const notIn = literalList(itemIds);
    lines.push(
      `UPDATE catalog_items SET status='archived', archived_at=${sqliteLiteral(generatedAt)}, updated_at=${sqliteLiteral(generatedAt)} WHERE hotel_id=${sqliteLiteral(hotelId)} AND module_key=${sqliteLiteral(moduleKey)} AND status='active' AND id NOT IN ${notIn};`,
      `UPDATE catalog_item_availability SET is_available=0, availability_label='Item removido do catalogo atual', updated_at=${sqliteLiteral(generatedAt)} WHERE hotel_id=${sqliteLiteral(hotelId)} AND catalog_item_id IN (SELECT id FROM catalog_items WHERE hotel_id=${sqliteLiteral(hotelId)} AND module_key=${sqliteLiteral(moduleKey)} AND id NOT IN ${notIn});`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildSnapshotQuerySql({ hotelId, moduleKey }) {
  const hotel = sqliteLiteral(hotelId);
  const module = sqliteLiteral(moduleKey);
  return [
    "-- Snapshot query for future authorized D1 read only.",
    "-- Collect only Muller Room Service catalog state before applying catalog import.",
    "-- Do not execute in this preparation task.",
    `SELECT id, hotel_id, module_key, name, description, status, sort_order, created_at, updated_at, archived_at FROM catalogs WHERE hotel_id=${hotel} AND module_key=${module} ORDER BY id;`,
    `SELECT id, hotel_id, catalog_id, module_key, name, description, status, sort_order, created_at, updated_at FROM categories WHERE hotel_id=${hotel} AND module_key=${module} ORDER BY id;`,
    `SELECT id, public_id, hotel_id, catalog_id, category_id, module_key, item_type, name, description, price_cents, currency, image_url, status, sort_order, metadata_json, created_at, updated_at, archived_at FROM catalog_items WHERE hotel_id=${hotel} AND module_key=${module} ORDER BY id;`,
    `SELECT ca.hotel_id, ca.catalog_item_id, ca.is_available, ca.availability_label, ca.starts_at, ca.ends_at, ca.updated_at FROM catalog_item_availability ca JOIN catalog_items ci ON ci.id=ca.catalog_item_id AND ci.hotel_id=ca.hotel_id WHERE ca.hotel_id=${hotel} AND ci.module_key=${module} ORDER BY ca.catalog_item_id;`,
    "",
  ].join("\n");
}

function buildRollbackSql({ candidate, baseline, hotelId, moduleKey, generatedAt, rollbackKind = "remote" }) {
  const baselineCatalogIds = new Set(baseline.catalogs.map((catalog) => catalog.id));
  const baselineCategoryIds = new Set(baseline.categories.map((category) => category.id));
  const baselineItemIds = new Set(baseline.items.map((item) => item.id));
  const newCatalogIds = baselineCatalogIds.has(candidate.catalog.id) ? [] : [candidate.catalog.id];
  const newCategoryIds = candidate.categories.map((category) => category.id).filter((id) => !baselineCategoryIds.has(id));
  const newItemIds = candidate.items.map((item) => item.id).filter((id) => !baselineItemIds.has(id));
  const baselineAvailabilityItemIds = new Set(baseline.availability.map((entry) => entry.catalog_item_id));
  const baselineItemsWithoutAvailabilityIds = baseline.items.map((item) => item.id).filter((id) => !baselineAvailabilityItemIds.has(id));
  const firstComment = rollbackKind === "fixture"
    ? "-- Fixture undo SQL for temporary SQLite validation only. Do not use on remote D1."
    : "-- Remote undo SQL generated with approved before-state snapshot. Review before remote use.";
  const lines = [
    firstComment,
    "-- Logical undo only; no order or order_items records are deleted.",
    "PRAGMA foreign_keys = ON;",
  ];

  for (const catalog of baseline.catalogs) {
    lines.push(
      insertOrUpdateSql(
        "catalogs",
        ["id", "hotel_id", "module_key", "name", "description", "status", "sort_order", "created_at", "updated_at", "archived_at"],
        [catalog.id, catalog.hotel_id, catalog.module_key, catalog.name, catalog.description, catalog.status, catalog.sort_order, catalog.created_at, catalog.updated_at, catalog.archived_at],
        {
          conflictColumns: ["id"],
          updateColumns: ["name", "description", "status", "sort_order", "updated_at", "archived_at"],
        },
      ),
    );
  }

  for (const category of baseline.categories) {
    lines.push(
      insertOrUpdateSql(
        "categories",
        ["id", "hotel_id", "catalog_id", "module_key", "name", "description", "status", "sort_order", "created_at", "updated_at"],
        [category.id, category.hotel_id, category.catalog_id, category.module_key, category.name, category.description, category.status, category.sort_order, category.created_at, category.updated_at],
        {
          conflictColumns: ["id"],
          updateColumns: ["catalog_id", "name", "description", "status", "sort_order", "updated_at"],
        },
      ),
    );
  }

  for (const item of baseline.items) {
    lines.push(
      insertOrUpdateSql(
        "catalog_items",
        [
          "id",
          "public_id",
          "hotel_id",
          "catalog_id",
          "category_id",
          "module_key",
          "item_type",
          "name",
          "description",
          "price_cents",
          "currency",
          "image_url",
          "status",
          "sort_order",
          "metadata_json",
          "created_at",
          "updated_at",
          "archived_at",
        ],
        [
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
        ],
        {
          conflictColumns: ["id"],
          updateColumns: ["public_id", "catalog_id", "category_id", "item_type", "name", "description", "price_cents", "currency", "image_url", "status", "sort_order", "metadata_json", "updated_at", "archived_at"],
        },
      ),
    );
  }

  for (const availability of baseline.availability) {
    lines.push(
      insertOrUpdateSql(
        "catalog_item_availability",
        ["hotel_id", "catalog_item_id", "is_available", "availability_label", "starts_at", "ends_at", "updated_at"],
        [availability.hotel_id, availability.catalog_item_id, availability.is_available, availability.availability_label, availability.starts_at, availability.ends_at, availability.updated_at],
        {
          conflictColumns: ["hotel_id", "catalog_item_id"],
          updateColumns: ["is_available", "availability_label", "starts_at", "ends_at", "updated_at"],
        },
      ),
    );
  }

  if (rollbackKind === "remote" && baselineItemsWithoutAvailabilityIds.length) {
    const ids = literalList(baselineItemsWithoutAvailabilityIds);
    lines.push(
      `DELETE FROM catalog_item_availability WHERE hotel_id=${sqliteLiteral(hotelId)} AND catalog_item_id IN ${ids} AND catalog_item_id IN (SELECT id FROM catalog_items WHERE hotel_id=${sqliteLiteral(hotelId)} AND module_key=${sqliteLiteral(moduleKey)} AND id IN ${ids});`,
    );
  }

  if (newCategoryIds.length) {
    lines.push(
      updateSql("categories", { status: "archived", updated_at: generatedAt }, `hotel_id=${sqliteLiteral(hotelId)} AND module_key=${sqliteLiteral(moduleKey)} AND id IN ${literalList(newCategoryIds)}`),
    );
  }

  if (newCatalogIds.length) {
    lines.push(
      updateSql(
        "catalogs",
        { status: "archived", archived_at: generatedAt, updated_at: generatedAt },
        `hotel_id=${sqliteLiteral(hotelId)} AND module_key=${sqliteLiteral(moduleKey)} AND id IN ${literalList(newCatalogIds)}`,
      ),
    );
  }

  if (newItemIds.length) {
    lines.push(
      updateSql(
        "catalog_items",
        { status: "archived", archived_at: generatedAt, updated_at: generatedAt },
        `hotel_id=${sqliteLiteral(hotelId)} AND module_key=${sqliteLiteral(moduleKey)} AND id IN ${literalList(newItemIds)}`,
      ),
      updateSql(
        "catalog_item_availability",
        { is_available: 0, availability_label: "Item importado arquivado pela reversao", updated_at: generatedAt },
        `hotel_id=${sqliteLiteral(hotelId)} AND catalog_item_id IN ${literalList(newItemIds)}`,
      ),
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildStaticValidation({ candidate, baseline, itemIdsToArchive }) {
  const itemIds = candidate.items.map((item) => item.id);
  const categoryIds = new Set(candidate.categories.map((category) => category.id));
  const duplicatedItemIds = duplicateCount(itemIds);
  return {
    generated_at: new Date().toISOString(),
    errors: [
      ...candidate.items.filter((item) => !categoryIds.has(item.category_id)).map((item) => ({ code: "missing_category", id: item.id })),
      ...(duplicatedItemIds ? [{ code: "duplicate_item_ids", count: duplicatedItemIds }] : []),
    ],
    warnings: [],
    catalog_count: 1,
    category_count: candidate.categories.length,
    product_count: candidate.items.length,
    available_count: candidate.items.filter((item) => item.is_available === 1).length,
    unavailable_count: candidate.items.filter((item) => item.is_available === 0).length,
    products_without_image: candidate.items.filter((item) => !item.image_url).length,
    external_image_references_redacted: candidate.items.filter((item) => item.metadata_json.includes("external-link-redacted")).length,
    candidate_item_ids: itemIds,
    baseline_items_in_snapshot: baseline.items.length,
    active_baseline_items_to_archive: itemIdsToArchive.length,
  };
}

function buildBeforeExpected({ baseline, hotelId, moduleKey, source = "fixture-ficticia-local" }) {
  return {
    hotel_id: hotelId,
    module_key: moduleKey,
    source,
    catalogs: baseline.catalogs.length,
    active_categories: baseline.categories.filter((category) => category.status === "active").length,
    active_items: baseline.items.filter((item) => item.status === "active").length,
    archived_items: baseline.items.filter((item) => item.status === "archived").length,
    availability_rows: baseline.availability.length,
  };
}

function buildAfterExpected({ candidate, baseline, itemIdsToArchive, hotelId, moduleKey }) {
  return {
    hotel_id: hotelId,
    module_key: moduleKey,
    active_catalogs: 1,
    imported_categories: candidate.categories.length,
    imported_products: candidate.items.length,
    imported_available_products: candidate.items.filter((item) => item.is_available === 1).length,
    imported_unavailable_products: candidate.items.filter((item) => item.is_available === 0).length,
    archived_missing_items: itemIdsToArchive.length,
    orders_expected_to_change: 0,
    order_items_expected_to_change: 0,
    protected_baseline_items: baseline.items.filter((item) => item.status === "archived").length,
  };
}

function buildManifest({
  candidate,
  baseline,
  duplicateNameGroups,
  itemIdsToArchive,
  inputHashes,
  generatedAt,
  gitHead,
  applySql,
  fixtureRollbackSql,
  remoteRollbackSql,
  snapshotQuerySql,
  archiveMissing,
  beforeState,
}) {
  const hasRealBeforeState = Boolean(beforeState?.snapshot);
  const diffBaseline = hasRealBeforeState ? normalizeSnapshot(beforeState.snapshot) : baseline;
  const candidateCategoryIds = new Set(candidate.categories.map((category) => category.id));
  const baselineCategoryIds = new Set(diffBaseline.categories.map((category) => category.id));
  const candidateItemIds = new Set(candidate.items.map((item) => item.id));
  const baselineItemIds = new Set(diffBaseline.items.map((item) => item.id));
  const recordsToInsert =
    candidate.categories.filter((category) => !baselineCategoryIds.has(category.id)).length +
    candidate.items.filter((item) => !baselineItemIds.has(item.id)).length +
    candidate.availability.filter((entry) => !baselineItemIds.has(entry.catalog_item_id)).length;
  const recordsToUpdate =
    1 +
    candidate.categories.filter((category) => baselineCategoryIds.has(category.id)).length +
    candidate.items.filter((item) => baselineItemIds.has(item.id)).length +
    candidate.availability.filter((entry) => baselineItemIds.has(entry.catalog_item_id)).length;
  const explicitTransactionStatementsAbsent = [applySql, fixtureRollbackSql, remoteRollbackSql]
    .filter(Boolean)
    .every((sql) => !hasExplicitTransactionStatements(sql));
  const d1FileCompatible = explicitTransactionStatementsAbsent;

  return {
    hotel_id: candidate.hotel_id,
    module_key: candidate.module_key,
    generated_at: generatedAt,
    tool_version: IMPORT_PACKAGE_VERSION,
    git_head: gitHead,
    remote_apply_ready: false,
    remote_rollback_ready: false,
    rollback_source: hasRealBeforeState ? "real-before-state-snapshot" : "fixture-validation-only",
    review_notes: hasRealBeforeState
      ? [
          "Apply e rollback remoto foram gerados a partir de snapshot anterior validado.",
          "Aplicacao remota permanece bloqueada ate a validacao local completa marcar remote_apply_ready=true e remote_rollback_ready=true.",
          "Revise hashes e contagens antes de qualquer escrita remota futura.",
        ]
      : [
          "Apply foi validado localmente em SQLite temporario.",
          "Rollback remoto ainda nao foi gerado.",
          "Aplicacao remota bloqueada ate existir snapshot real anterior do D1.",
          "catalog.fixture-rollback.sql e apenas para validacao local e nao pode ser usado no D1 remoto.",
        ],
    input_hashes: inputHashes,
    before_state: hasRealBeforeState
      ? {
          sha256: beforeState.sha256,
          counts: beforeState.counts,
          ids: beforeState.ids,
        }
      : null,
    candidate_catalog: {
      id: candidate.catalog.id,
      name_hash: stableHash(candidate.catalog.name, 16),
    },
    counts: {
      categories: candidate.categories.length,
      products: candidate.items.length,
      available: candidate.items.filter((item) => item.is_available === 1).length,
      unavailable: candidate.items.filter((item) => item.is_available === 0).length,
      without_image: candidate.items.filter((item) => !item.image_url).length,
      duplicate_name_groups: duplicateNameGroups.length,
      records_to_insert: recordsToInsert,
      records_to_update: recordsToUpdate,
      records_to_archive: archiveMissing ? itemIdsToArchive.length : 0,
    },
    candidate_record_ids: {
      catalog_id: candidate.catalog.id,
      category_ids: [...candidateCategoryIds],
      item_ids: [...candidateItemIds],
    },
    duplicate_name_groups: duplicateNameGroups,
    archive_missing: {
      enabled: archiveMissing,
      item_ids: archiveMissing ? itemIdsToArchive : [],
      scope: { hotel_id: candidate.hotel_id, module_key: candidate.module_key },
    },
    tables_affected: AFFECTED_TABLES,
    tables_explicitly_prohibited: PROHIBITED_TABLES,
    sql_hashes: {
      apply_sha256: sha256Text(applySql),
      rollback_sha256: remoteRollbackSql ? sha256Text(remoteRollbackSql) : null,
      fixture_rollback_sha256: sha256Text(fixtureRollbackSql),
      snapshot_query_sha256: sha256Text(snapshotQuerySql),
    },
    guarantees: {
      no_delete_from_catalog_items: true,
      orders_untouched: true,
      order_items_untouched: true,
      print_events_untouched: true,
      aurora_demo_untouched: true,
      external_images_redacted: true,
      availability_absence_restored: Boolean(remoteRollbackSql),
      d1_file_compatible: d1FileCompatible,
      explicit_transaction_statements_absent: explicitTransactionStatementsAbsent,
      local_atomic_validation: true,
    },
  };
}

function buildDuplicateNameGroups(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.name.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      name_hash: stableHash(group[0].name, 16),
      item_ids: group.map((item) => item.id),
      category_ids: [...new Set(group.map((item) => item.category_id))],
      price_cents: group.map((item) => item.price_cents),
      reason: "Mantidos separados por origem, linha e ID estavel; nao unir apenas por nome.",
    }));
}

function normalizeSnapshot(snapshot) {
  return {
    catalogs: snapshot.catalogs || [],
    categories: snapshot.categories || [],
    items: snapshot.items || [],
    availability: snapshot.availability || [],
  };
}

function duplicateCount(values) {
  const seen = new Set();
  let count = 0;
  for (const value of values) {
    if (seen.has(value)) count += 1;
    seen.add(value);
  }
  return count;
}

function toInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}
