import fs from "node:fs/promises";
import zlib from "node:zlib";

export async function readXlsx(filePath) {
  const buffer = await fs.readFile(filePath);
  const entries = readZipEntries(buffer);
  const workbookXml = getText(entries, "xl/workbook.xml");
  const workbookRels = readRelationships(getText(entries, "xl/_rels/workbook.xml.rels", ""));
  const sharedStrings = readSharedStrings(getText(entries, "xl/sharedStrings.xml", ""));
  const sheets = [];

  for (const sheetMatch of workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const attrs = readAttributes(sheetMatch[1]);
    const relationId = attrs["r:id"] || attrs.id;
    const target = workbookRels.get(relationId);
    if (!target) continue;
    const sheetPath = normalizeWorkbookTarget(target);
    const sheetXml = getText(entries, sheetPath, "");
    if (!sheetXml) continue;
    const relPath = sheetPath.replace("xl/worksheets/", "xl/worksheets/_rels/") + ".rels";
    const sheetRels = readRelationships(getText(entries, relPath, ""));
    sheets.push(parseWorksheet({
      name: decodeXml(attrs.name || `Sheet ${sheets.length + 1}`),
      path: sheetPath,
      xml: sheetXml,
      relationships: sheetRels,
      sharedStrings,
    }));
  }

  return { type: "xlsx", filePath, sheets };
}

function readZipEntries(buffer) {
  const entries = new Map();
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Arquivo XLSX/ZIP invalido: diretorio central ausente.");

  const count = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error("Arquivo XLSX/ZIP invalido: entrada central invalida.");
    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const nameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString("utf8").replaceAll("\\", "/");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = zlib.inflateRawSync(compressed);
    else throw new Error(`Metodo ZIP nao suportado: ${method}`);
    entries.set(name, data);
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function getText(entries, name, fallback = null) {
  const data = entries.get(name);
  if (!data) {
    if (fallback != null) return fallback;
    throw new Error(`Entrada XLSX ausente: ${name}`);
  }
  return data.toString("utf8");
}

function readRelationships(xml) {
  const relationships = new Map();
  for (const rel of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = readAttributes(rel[1]);
    if (attrs.Id && attrs.Target) relationships.set(attrs.Id, attrs.Target);
  }
  return relationships;
}

function normalizeWorkbookTarget(target) {
  if (target.startsWith("/")) return target.slice(1);
  if (target.startsWith("xl/")) return target;
  return `xl/${target}`;
}

function readSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => extractText(match[1]));
}

function parseWorksheet({ name, path, xml, relationships, sharedStrings }) {
  const rows = [];
  const formulas = [];
  const hyperlinks = [];
  const validations = [];

  for (const hyperlink of xml.matchAll(/<hyperlink\b([^>]*)\/?>/g)) {
    const attrs = readAttributes(hyperlink[1]);
    const target = attrs["r:id"] ? relationships.get(attrs["r:id"]) : attrs.location;
    hyperlinks.push({ ref: attrs.ref || "", target: target || "" });
  }

  for (const validation of xml.matchAll(/<dataValidation\b([^>]*)>([\s\S]*?)<\/dataValidation>|<dataValidation\b([^>]*)\/>/g)) {
    const attrs = readAttributes(validation[1] || validation[3] || "");
    validations.push({ sqref: attrs.sqref || "", type: attrs.type || "" });
  }

  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttrs = readAttributes(rowMatch[1]);
    const rowIndex = Number(rowAttrs.r || rows.length + 1) - 1;
    const row = rows[rowIndex] || [];
    let sequentialColumn = 0;
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = readAttributes(cellMatch[1]);
      const inner = cellMatch[2] || "";
      const cellRef = attrs.r || "";
      const columnIndex = cellRef ? columnNameToIndex(cellRef.replace(/\d+/g, "")) : sequentialColumn;
      sequentialColumn = columnIndex + 1;
      const formula = firstXmlValue(inner, "f");
      if (formula != null) formulas.push({ ref: cellRef, formula: decodeXml(formula) });
      row[columnIndex] = readCellValue(attrs, inner, sharedStrings);
    }
    rows[rowIndex] = row;
  }

  return { name, path, rows: compactRows(rows), formulas, hyperlinks, validations };
}

function compactRows(rows) {
  return rows.map((row) => {
    if (!row) return [];
    let end = row.length;
    while (end > 0 && isBlank(row[end - 1])) end -= 1;
    return row.slice(0, end).map((value) => (value == null ? "" : value));
  });
}

function readCellValue(attrs, inner, sharedStrings) {
  if (!inner) return "";
  if (attrs.t === "inlineStr") return extractText(inner);
  const rawValue = firstXmlValue(inner, "v");
  if (rawValue == null) return "";
  const decoded = decodeXml(rawValue);
  if (attrs.t === "s") return sharedStrings[Number(decoded)] || "";
  if (attrs.t === "b") return decoded === "1";
  if (attrs.t === "str") return decoded;
  const number = Number(decoded);
  return Number.isFinite(number) && decoded.trim() !== "" ? number : decoded;
}

function firstXmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1] : null;
}

function extractText(xml) {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join("");
}

function readAttributes(source) {
  const attrs = {};
  for (const match of source.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)) attrs[match[1]] = decodeXml(match[2]);
  return attrs;
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function columnNameToIndex(columnName) {
  return [...columnName.toUpperCase()].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function isBlank(value) {
  return value == null || String(value).trim() === "";
}
