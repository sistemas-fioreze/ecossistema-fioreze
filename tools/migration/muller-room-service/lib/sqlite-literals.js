const ALLOWED_COLUMNS = {
  catalogs: new Set(["id", "hotel_id", "module_key", "name", "description", "status", "sort_order", "created_at", "updated_at", "archived_at"]),
  categories: new Set(["id", "hotel_id", "catalog_id", "module_key", "name", "description", "status", "sort_order", "created_at", "updated_at"]),
  catalog_items: new Set([
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
  ]),
  catalog_item_availability: new Set(["hotel_id", "catalog_item_id", "is_available", "availability_label", "starts_at", "ends_at", "updated_at"]),
};

export function sqliteLiteral(value) {
  if (value == null) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Numero SQLite invalido.");
    if (!Number.isInteger(value)) throw new Error("A importacao executavel aceita apenas numeros inteiros.");
    return String(value);
  }
  if (typeof value === "object") return sqliteLiteral(JSON.stringify(assertJsonSerializable(value)));

  const text = String(value);
  if (text.includes("\0")) throw new Error("Valor com caractere NUL bloqueado.");
  return `'${text.replaceAll("'", "''")}'`;
}

export function sqliteJsonLiteral(value) {
  if (value == null) return "NULL";
  if (typeof value === "string") {
    JSON.parse(value);
    return sqliteLiteral(value);
  }
  return sqliteLiteral(JSON.stringify(assertJsonSerializable(value)));
}

export function assertAllowedTable(table) {
  if (!Object.hasOwn(ALLOWED_COLUMNS, table)) throw new Error(`Tabela nao permitida para importacao: ${table}`);
  return table;
}

export function assertAllowedColumns(table, columns) {
  const allowed = ALLOWED_COLUMNS[assertAllowedTable(table)];
  for (const column of columns) {
    if (!allowed.has(column)) throw new Error(`Coluna nao permitida para ${table}: ${column}`);
  }
  return columns;
}

export function insertOrUpdateSql(table, columns, values, { conflictColumns, updateColumns }) {
  assertAllowedColumns(table, columns);
  assertAllowedColumns(table, conflictColumns);
  assertAllowedColumns(table, updateColumns);
  if (columns.length !== values.length) throw new Error(`Quantidade de colunas e valores diverge em ${table}.`);

  const serialized = values.map((value, index) => (columns[index] === "metadata_json" ? sqliteJsonLiteral(value) : sqliteLiteral(value)));
  const updateClause = updateColumns.length
    ? `DO UPDATE SET ${updateColumns.map((column) => `${column}=excluded.${column}`).join(", ")}`
    : "DO NOTHING";
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${serialized.join(", ")}) ON CONFLICT (${conflictColumns.join(", ")}) ${updateClause};`;
}

export function updateSql(table, assignments, whereSql) {
  const columns = Object.keys(assignments);
  assertAllowedColumns(table, columns);
  const setSql = columns.map((column) => `${column}=${column === "metadata_json" ? sqliteJsonLiteral(assignments[column]) : sqliteLiteral(assignments[column])}`).join(", ");
  return `UPDATE ${table} SET ${setSql} WHERE ${whereSql};`;
}

export function literalList(values) {
  if (!values.length) return "(NULL)";
  return `(${values.map(sqliteLiteral).join(", ")})`;
}

function assertJsonSerializable(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("JSON invalido para SQLite.");
  if (serialized.includes("\0")) throw new Error("JSON com caractere NUL bloqueado.");
  JSON.parse(serialized);
  return value;
}
