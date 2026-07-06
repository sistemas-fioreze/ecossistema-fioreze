import fs from "node:fs/promises";
import { fileSha256 } from "./hash.js";
import { ALLOWED_COLUMNS } from "./sqlite-literals.js";

export const BEFORE_STATE_FORMAT_VERSION = "muller-catalog-before-state/v1";

const REQUIRED_TABLES = ["catalogs", "categories", "catalog_items", "catalog_item_availability"];
const FORBIDDEN_TABLES = new Set(["orders", "order_items", "order_status_history", "print_events", "admin_users", "admin_sessions", "admin_audit_log", "rooms"]);

export async function readBeforeStateSnapshot(filePath, { hotelId = "muller-fioreze", moduleKey = "room-service" } = {}) {
  const content = await fs.readFile(filePath, "utf8");
  const sha256 = await fileSha256(filePath);
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`before-state invalido: JSON malformado (${error.message}).`);
  }
  return validateBeforeStateSnapshot(parsed, { hotelId, moduleKey, sha256 });
}

export function validateBeforeStateSnapshot(snapshot, { hotelId = "muller-fioreze", moduleKey = "room-service", sha256 = null } = {}) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("before-state invalido: objeto JSON esperado.");
  if (snapshot.format_version !== BEFORE_STATE_FORMAT_VERSION) throw new Error("before-state invalido: versao de formato ausente ou incorreta.");
  if (snapshot.hotel_id !== hotelId) throw new Error("before-state invalido: hotel_id diferente do escopo autorizado.");
  if (snapshot.module_key !== moduleKey) throw new Error("before-state invalido: module_key diferente do escopo autorizado.");
  if (!snapshot.tables || typeof snapshot.tables !== "object" || Array.isArray(snapshot.tables)) throw new Error("before-state invalido: tables obrigatorio.");

  const tableNames = Object.keys(snapshot.tables);
  for (const table of tableNames) {
    if (FORBIDDEN_TABLES.has(table)) throw new Error(`before-state invalido: tabela proibida presente (${table}).`);
    if (!REQUIRED_TABLES.includes(table)) throw new Error(`before-state invalido: tabela nao permitida (${table}).`);
  }
  for (const table of REQUIRED_TABLES) {
    if (!Array.isArray(snapshot.tables[table])) throw new Error(`before-state invalido: tabela obrigatoria ausente ou invalida (${table}).`);
  }

  assertNoSensitiveContent(snapshot);
  assertRows("catalogs", snapshot.tables.catalogs, { hotelId, moduleKey });
  assertRows("categories", snapshot.tables.categories, { hotelId, moduleKey });
  assertRows("catalog_items", snapshot.tables.catalog_items, { hotelId, moduleKey });
  assertRows("catalog_item_availability", snapshot.tables.catalog_item_availability, { hotelId, moduleKey });

  assertUnique(snapshot.tables.catalogs.map((row) => row.id), "catalogs.id");
  assertUnique(snapshot.tables.categories.map((row) => row.id), "categories.id");
  assertUnique(snapshot.tables.catalog_items.map((row) => row.id), "catalog_items.id");
  assertUnique(snapshot.tables.catalog_item_availability.map((row) => `${row.hotel_id}:${row.catalog_item_id}`), "catalog_item_availability hotel/item");

  const catalogIds = new Set(snapshot.tables.catalogs.map((row) => row.id));
  const categoryIds = new Set(snapshot.tables.categories.map((row) => row.id));
  const itemIds = new Set(snapshot.tables.catalog_items.map((row) => row.id));
  for (const category of snapshot.tables.categories) {
    if (!catalogIds.has(category.catalog_id)) throw new Error("before-state invalido: categoria referencia catalogo ausente.");
  }
  for (const item of snapshot.tables.catalog_items) {
    if (!catalogIds.has(item.catalog_id)) throw new Error("before-state invalido: produto referencia catalogo ausente.");
    if (!categoryIds.has(item.category_id)) throw new Error("before-state invalido: produto referencia categoria ausente.");
  }
  for (const availability of snapshot.tables.catalog_item_availability) {
    if (!itemIds.has(availability.catalog_item_id)) throw new Error("before-state invalido: disponibilidade referencia produto ausente.");
  }

  return {
    sha256,
    snapshot: {
      catalogs: snapshot.tables.catalogs.map((row) => normalizeRow("catalogs", row)),
      categories: snapshot.tables.categories.map((row) => normalizeRow("categories", row)),
      items: snapshot.tables.catalog_items.map((row) => normalizeRow("catalog_items", row)),
      availability: snapshot.tables.catalog_item_availability.map((row) => normalizeRow("catalog_item_availability", row)),
    },
    counts: {
      catalogs: snapshot.tables.catalogs.length,
      categories: snapshot.tables.categories.length,
      catalog_items: snapshot.tables.catalog_items.length,
      catalog_item_availability: snapshot.tables.catalog_item_availability.length,
    },
    ids: {
      catalog_ids: snapshot.tables.catalogs.map((row) => row.id),
      category_ids: snapshot.tables.categories.map((row) => row.id),
      item_ids: snapshot.tables.catalog_items.map((row) => row.id),
      availability_item_ids: snapshot.tables.catalog_item_availability.map((row) => row.catalog_item_id),
    },
  };
}

function assertRows(table, rows, { hotelId, moduleKey }) {
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`before-state invalido: linha invalida em ${table}.`);
    const expectedColumns = ALLOWED_COLUMNS[table];
    for (const column of Object.keys(row)) {
      if (!expectedColumns.has(column)) throw new Error(`before-state invalido: coluna inesperada em ${table}.${column}.`);
    }
    for (const column of requiredColumns(table)) {
      if (!Object.hasOwn(row, column)) throw new Error(`before-state invalido: coluna obrigatoria ausente em ${table}.${column}.`);
    }
    if (row.hotel_id !== hotelId) throw new Error(`before-state invalido: registro de outro hotel em ${table}.`);
    if (table !== "catalog_item_availability" && row.module_key !== moduleKey) throw new Error(`before-state invalido: registro de outro modulo em ${table}.`);
  }
}

function normalizeRow(table, row) {
  const normalized = {};
  for (const column of ALLOWED_COLUMNS[table]) {
    if (Object.hasOwn(row, column)) normalized[column] = row[column] ?? null;
  }
  return normalized;
}

function requiredColumns(table) {
  return {
    catalogs: ["id", "hotel_id", "module_key", "name", "status", "sort_order", "created_at", "updated_at"],
    categories: ["id", "hotel_id", "catalog_id", "module_key", "name", "status", "sort_order", "created_at", "updated_at"],
    catalog_items: [
      "id",
      "public_id",
      "hotel_id",
      "catalog_id",
      "category_id",
      "module_key",
      "item_type",
      "name",
      "price_cents",
      "currency",
      "status",
      "sort_order",
      "created_at",
      "updated_at",
    ],
    catalog_item_availability: ["hotel_id", "catalog_item_id", "is_available", "updated_at"],
  }[table];
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (!value) throw new Error(`before-state invalido: ID vazio em ${label}.`);
    if (seen.has(value)) throw new Error(`before-state invalido: ID duplicado em ${label}.`);
    seen.add(value);
  }
}

function assertNoSensitiveContent(snapshot) {
  const text = JSON.stringify(snapshot);
  const privateKeyPattern = new RegExp(`${["private", "key"].join("_")}|${["private", "key", "id"].join("_")}|BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY`, "i");
  const serviceAccountPattern = new RegExp(`${["client", "email"].join("_")}|${["client", "id"].join("_")}`, "i");
  const checks = [
    [privateKeyPattern, "chave privada"],
    [serviceAccountPattern, "credencial"],
    [/script\.google\.com\/macros/i, "Apps Script"],
    [/spreadsheets\/d\//i, "ID de planilha"],
    [/\b(password|senha|token|api[_-]?key|secret)\b/i, "segredo"],
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, "email"],
    [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, "CPF"],
    [/(?<!\d)(?:\+55\s*)?(?:\(?\d{2}\)?\s*)?9\d{4}[-\s]?\d{4}(?!\d)/, "telefone"],
    [/https?:\/\//i, "URL externa"],
  ];
  for (const [pattern, label] of checks) {
    if (pattern.test(text)) throw new Error(`before-state invalido: contem ${label}.`);
  }
}
