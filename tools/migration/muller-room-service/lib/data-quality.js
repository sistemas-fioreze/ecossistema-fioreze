import { normalizeHeader, normalizeMoneyToCents } from "./normalize.js";
import { scanTextForSensitive } from "./privacy.js";

export function auditData({ workbooks = [], catalogData, orderData, textFiles = [] }) {
  const items = catalogData?.items || [];
  const categories = catalogData?.categories || [];
  const orders = orderData?.orders || [];
  const itemNames = items.map((item) => normalizeHeader(item.name)).filter(Boolean);
  const itemIds = items.map((item) => item.id).filter(Boolean);

  const workbookSheetSummaries = workbooks.flatMap((workbook) =>
    workbook.sheets.map((sheet) => ({
      file: workbook.filePath,
      sheet: sheet.name,
      rows: sheet.rows.length,
      formulas: sheet.formulas?.length || 0,
      links: (sheet.hyperlinks?.length || 0) + sheet.rows.flat().filter((value) => /^https?:\/\//i.test(String(value))).length,
      sensitive_categories: [...new Set(sheet.rows.flat().flatMap((value) => scanTextForSensitive(value)))].sort(),
    })),
  );

  return {
    generated_at: new Date().toISOString(),
    products_found: items.length,
    categories_found: categories.length,
    products_without_category: items.filter((item) => !item.validation?.has_category).length,
    products_without_name: items.filter((item) => !item.validation?.has_name).length,
    products_without_price: items.filter((item) => item.validation?.price_reason === "missing").length,
    invalid_prices: items.filter((item) => item.validation?.price_valid === false && item.validation?.price_reason !== "missing").length,
    negative_prices: items.filter((item) => {
      const money = normalizeMoneyToCents(item.price_cents == null ? null : item.price_cents / 100);
      return money.cents != null && money.cents < 0;
    }).length,
    currencies: [...new Set(items.map((item) => item.currency).filter(Boolean))].sort(),
    duplicate_ids: duplicateCount(itemIds),
    duplicate_names: duplicateCount(itemNames),
    archived_products: items.filter((item) => item.status === "archived").length,
    unavailable_products: items.filter((item) => item.is_available === false).length,
    invalid_image_links: items.filter((item) => item.image_url && !isAllowedImageReference(item.image_url)).length,
    orders_found: orders.length,
    invalid_dates: orders.filter((order) => order.created_at && !order.created_at_valid).length,
    orders_without_items: null,
    duplicated_orders: duplicateCount(orders.map((order) => order.legacy_ref_hash).filter(Boolean)),
    unknown_statuses: countUnknownStatuses(orders.map((order) => order.status)),
    incomplete_rows: (catalogData?.ignored_rows?.length || 0) + (orderData?.ignored_rows?.length || 0),
    workbook_sheets: workbookSheetSummaries,
    text_file_sensitive_categories: textFiles.map((file) => ({
      file: file.path,
      categories: scanTextForSensitive(file.content),
    })),
  };
}

function duplicateCount(values) {
  const seen = new Set();
  let count = 0;
  values.forEach((value) => {
    if (seen.has(value)) count += 1;
    seen.add(value);
  });
  return count;
}

function countUnknownStatuses(statuses) {
  const known = new Set(["received", "accepted", "preparing", "ready", "delivered", "cancelled", "archived", ""]);
  return statuses.filter((status) => status && !known.has(normalizeHeader(status))).length;
}

function isAllowedImageReference(value) {
  return /^https?:\/\//i.test(value) || /^\/assets\//.test(value) || /^[\w./-]+\.(png|jpe?g|webp|gif)$/i.test(value);
}
