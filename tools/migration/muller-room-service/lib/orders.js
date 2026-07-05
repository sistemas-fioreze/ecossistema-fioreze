import { stableHash } from "./hash.js";
import { normalizeDateToIso, normalizeHeader, normalizeMoneyToCents, normalizeText } from "./normalize.js";
import { analyzeSheet, detectHeader, getColumnMap } from "./spreadsheet.js";

export function normalizeOrders(workbooks, { hotelId = "muller-fioreze", moduleKey = "room-service" } = {}) {
  const orders = [];
  const ignoredRows = [];

  for (const workbook of workbooks) {
    for (const sheet of workbook.sheets) {
      const analysis = analyzeSheet(sheet);
      if (!["pedidos", "itens de pedido", "historico"].includes(analysis.classification)) continue;
      const header = detectHeader(sheet.rows);
      const map = getColumnMap(header.headers);
      const headerText = normalizeHeader(header.headers.join(" "));
      const hasOrderShape = (map.total >= 0 || /pedido|status_pedido|local_de_consumo|status_impressao/.test(headerText)) && (map.date >= 0 || map.room >= 0 || map.guest >= 0);
      if (!hasOrderShape) continue;

      sheet.rows.slice(header.index + 1).forEach((row, rowOffset) => {
        const rowNumber = header.index + rowOffset + 2;
        if (isEmptyRow(row)) return;
        const date = normalizeDateToIso(valueAt(row, map.date));
        const total = normalizeMoneyToCents(valueAt(row, map.total));
        const sourceKey = `${workbook.filePath}|${sheet.name}|${rowNumber}|${valueAt(row, map.date)}|${valueAt(row, map.room)}`;
        if (!date.valid && !total.valid && !valueAt(row, map.room)) {
          ignoredRows.push({ sheet: sheet.name, row: rowNumber, reason: "linha sem estrutura de pedido" });
          return;
        }
        orders.push({
          legacy_ref_hash: stableHash(sourceKey, 16),
          hotel_id: hotelId,
          module_key: moduleKey,
          created_at: date.iso,
          created_at_valid: date.valid,
          room_code_redacted: valueAt(row, map.room) ? "[DADO PESSOAL REDIGIDO]" : null,
          guest_name_redacted: valueAt(row, map.guest) ? "[DADO PESSOAL REDIGIDO]" : null,
          phone_redacted: valueAt(row, map.phone) ? "[DADO PESSOAL REDIGIDO]" : null,
          notes_redacted: valueAt(row, map.notes) ? "[DADO PESSOAL REDIGIDO]" : null,
          status: normalizeText(valueAt(row, map.status)) || null,
          total_cents: total.valid ? total.cents : null,
          total_valid: total.valid,
          source: { file: workbook.filePath, sheet: sheet.name, row: rowNumber },
        });
      });
    }
  }

  return { orders, ignored_rows: ignoredRows };
}

function valueAt(row, index) {
  if (index == null || index < 0) return "";
  return row[index] ?? "";
}

function isEmptyRow(row) {
  return !row || row.every((value) => value == null || String(value).trim() === "");
}
