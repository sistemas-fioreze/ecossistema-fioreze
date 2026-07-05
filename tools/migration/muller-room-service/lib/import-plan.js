import { stableHash } from "./hash.js";

export function buildImportPlan({ catalogData, hotelId = "muller-fioreze", moduleKey = "room-service", inputHashes = [] }) {
  const statements = [];
  const parameters = [];
  const now = new Date().toISOString();
  const catalog = catalogData.catalog;

  pushStatement(
    statements,
    parameters,
    "catalogs",
    ["id", "hotel_id", "module_key", "name", "description", "status", "sort_order", "created_at", "updated_at"],
    [catalog.id, hotelId, moduleKey, catalog.name, catalog.description, catalog.status, catalog.sort_order, now, now],
  );

  for (const category of catalogData.categories) {
    pushStatement(
      statements,
      parameters,
      "categories",
      ["id", "hotel_id", "catalog_id", "module_key", "name", "description", "status", "sort_order", "created_at", "updated_at"],
      [category.id, hotelId, catalog.id, moduleKey, category.name, category.description, category.status, category.sort_order, now, now],
    );
  }

  for (const item of catalogData.items) {
    if (!item.validation.price_valid || !item.validation.has_name || !item.validation.has_category) continue;
    pushStatement(
      statements,
      parameters,
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
      ],
      [
        item.id,
        item.public_id,
        hotelId,
        catalog.id,
        item.category_id,
        moduleKey,
        item.item_type,
        item.name,
        item.description || null,
        item.price_cents,
        item.currency || "BRL",
        item.image_url || null,
        item.status,
        item.sort_order,
        JSON.stringify({ source_hash: stableHash(`${item.source.sheet}:${item.source.row}`) }),
        now,
        now,
      ],
    );
    pushStatement(
      statements,
      parameters,
      "catalog_item_availability",
      ["hotel_id", "catalog_item_id", "is_available", "availability_label", "starts_at", "ends_at", "updated_at"],
      [hotelId, item.id, item.is_available ? 1 : 0, item.availability_label, null, null, now],
    );
  }

  return {
    generated_at: now,
    mode: "dry-run",
    hotel_id: hotelId,
    module_key: moduleKey,
    input_hashes: inputHashes,
    summary: {
      catalogs: 1,
      categories: catalogData.categories.length,
      candidate_items: catalogData.items.length,
      insertable_items: catalogData.items.filter((item) => item.validation.price_valid && item.validation.has_name && item.validation.has_category).length,
      ignored_rows: catalogData.ignored_rows.length,
      statements: statements.length,
    },
    sql_preview: [
      "-- Dry-run parametrizado. Nao executar em D1 remoto nesta fase.",
      "-- Valores reais ficam em import-preview.parameters.json dentro de local-output/muller.",
      ...statements,
    ].join("\n"),
    parameters,
  };
}

function pushStatement(statements, parameters, table, columns, values) {
  const placeholders = columns.map(() => "?").join(", ");
  const conflictTargets = {
    catalogs: ["id"],
    categories: ["id"],
    catalog_items: ["id"],
    catalog_item_availability: ["hotel_id", "catalog_item_id"],
  };
  const conflictTarget = conflictTargets[table] || ["id"];
  const updateColumns = columns.filter((column) => !["id", "hotel_id", "catalog_item_id"].includes(column));
  const updateClause = updateColumns.length
    ? ` ON CONFLICT (${conflictTarget.join(", ")}) DO UPDATE SET ${updateColumns.map((column) => `${column}=excluded.${column}`).join(", ")}`
    : ` ON CONFLICT (${conflictTarget.join(", ")}) DO NOTHING`;
  statements.push(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})${updateClause};`);
  parameters.push({ table, columns, values });
}
