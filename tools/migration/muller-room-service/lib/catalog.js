import { stableHash } from "./hash.js";
import { normalizeBoolean, normalizeHeader, normalizeMoneyToCents, normalizeText, slugify } from "./normalize.js";
import { analyzeSheet, detectHeader, getColumnMap } from "./spreadsheet.js";

export function normalizeCatalog(workbooks, { hotelId = "muller-fioreze", moduleKey = "room-service" } = {}) {
  const categories = new Map();
  const items = [];
  const ignoredRows = [];
  const catalogId = `catalog-${slugify(hotelId)}-${slugify(moduleKey)}`;

  for (const workbook of workbooks) {
    for (const sheet of workbook.sheets) {
      const analysis = analyzeSheet(sheet);
      if (!["produto", "categoria", "disponibilidade"].includes(analysis.classification)) continue;
      const header = detectHeader(sheet.rows);
      const map = getColumnMap(header.headers);
      const hasProductShape = map.name >= 0 || map.price >= 0;
      if (!hasProductShape) continue;

      sheet.rows.slice(header.index + 1).forEach((row, rowOffset) => {
        const rowNumber = header.index + rowOffset + 2;
        if (isEmptyRow(row)) return;
        const name = valueAt(row, map.name);
        const price = valueAt(row, map.price);
        const categoryName = normalizeText(valueAt(row, map.category) || sheet.name || "Sem categoria");
        if (!name && !price) {
          ignoredRows.push({ sheet: sheet.name, row: rowNumber, reason: "linha sem produto e sem preco" });
          return;
        }

        const categoryId = `cat-${slugify(hotelId)}-${slugify(moduleKey)}-${slugify(categoryName)}`;
        if (!categories.has(categoryId)) {
          categories.set(categoryId, {
            id: categoryId,
            hotel_id: hotelId,
            catalog_id: catalogId,
            module_key: moduleKey,
            name: categoryName || "Sem categoria",
            description: null,
            status: "active",
            sort_order: categories.size * 10 + 10,
          });
        }

        const money = normalizeMoneyToCents(price);
        const statusText = normalizeHeader(valueAt(row, map.status));
        const availableValue = valueAt(row, map.available);
        const available = availableValue === "" || availableValue == null ? statusText !== "indisponivel" : normalizeBoolean(availableValue);
        const status = statusText.includes("arquiv") ? "archived" : statusText.includes("inativ") ? "inactive" : "active";
        const sourceKey = `${hotelId}|${moduleKey}|${sheet.name}|${rowNumber}|${name}`;
        items.push({
          id: `item-${slugify(hotelId)}-${slugify(moduleKey)}-${slugify(name || "sem-nome")}-${stableHash(sourceKey, 8)}`,
          public_id: `pub-${stableHash(sourceKey, 14)}`,
          hotel_id: hotelId,
          catalog_id: catalogId,
          category_id: categoryId,
          module_key: moduleKey,
          item_type: "product",
          name: normalizeText(name),
          description: normalizeText(valueAt(row, map.description)),
          price_cents: money.cents,
          currency: normalizeText(valueAt(row, map.currency)) || "BRL",
          image_url: normalizeText(valueAt(row, map.image)) || null,
          status,
          sort_order: Number(valueAt(row, map.order)) || items.length * 10 + 10,
          is_available: available !== false && status === "active",
          availability_label: available === false ? "Indisponivel" : null,
          source: { file: workbook.filePath, sheet: sheet.name, row: rowNumber },
          validation: {
            price_valid: money.valid,
            price_reason: money.reason,
            has_category: Boolean(categoryName),
            has_name: Boolean(normalizeText(name)),
          },
        });
      });
    }
  }

  return {
    catalog: {
      id: catalogId,
      hotel_id: hotelId,
      module_key: moduleKey,
      name: "Room Service Muller",
      description: "Catalogo normalizado a partir da planilha legada.",
      status: "active",
      sort_order: 10,
    },
    categories: [...categories.values()],
    items,
    ignored_rows: ignoredRows,
  };
}

function valueAt(row, index) {
  if (index == null || index < 0) return "";
  return row[index] ?? "";
}

function isEmptyRow(row) {
  return !row || row.every((value) => value == null || String(value).trim() === "");
}
