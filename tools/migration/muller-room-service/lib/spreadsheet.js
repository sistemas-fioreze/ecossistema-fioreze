import fs from "node:fs/promises";
import path from "node:path";
import { parseCsv, detectDelimiter } from "./csv.js";
import { normalizeHeader } from "./normalize.js";
import { summarizeSensitiveCells } from "./privacy.js";
import { readXlsx } from "./xlsx-reader.js";

export async function readTabularFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".xlsx" || ext === ".xlsm") return readXlsx(filePath);
  if (ext === ".csv" || ext === ".tsv") {
    const text = await fs.readFile(filePath, "utf8");
    return {
      type: ext.slice(1),
      filePath,
      sheets: [{ name: path.basename(filePath), path: filePath, rows: parseCsv(text, ext === ".tsv" ? "\t" : detectDelimiter(text)), formulas: [], hyperlinks: [], validations: [] }],
    };
  }
  if (ext === ".json") {
    const data = JSON.parse(await fs.readFile(filePath, "utf8"));
    const rows = jsonToRows(data);
    return { type: "json", filePath, sheets: [{ name: path.basename(filePath), path: filePath, rows, formulas: [], hyperlinks: [], validations: [] }] };
  }
  throw new Error(`Formato tabular nao suportado: ${ext}`);
}

export function analyzeWorkbook(workbook) {
  return {
    type: workbook.type,
    filePath: workbook.filePath,
    sheets: workbook.sheets.map((sheet) => analyzeSheet(sheet)),
  };
}

export function analyzeSheet(sheet) {
  const headerInfo = detectHeader(sheet.rows);
  const rowsAfterHeader = sheet.rows.slice(headerInfo.index + 1);
  const nonEmptyRows = sheet.rows.filter((row) => row.some((value) => !isBlank(value)));
  const headers = headerInfo.headers;
  const columnTypes = {};
  headers.forEach((header, index) => {
    columnTypes[header || `coluna_${index + 1}`] = observedTypes(rowsAfterHeader.map((row) => row[index]));
  });
  return {
    name: sheet.name,
    classification: classifySheet(sheet.name, headers),
    row_count: sheet.rows.length,
    non_empty_row_count: nonEmptyRows.length,
    data_row_count: Math.max(0, nonEmptyRows.length - (headers.length ? 1 : 0)),
    column_count: Math.max(0, ...sheet.rows.map((row) => row.length)),
    header_row: headerInfo.index + 1,
    headers,
    column_types: columnTypes,
    formula_count: sheet.formulas?.length || 0,
    validation_count: sheet.validations?.length || 0,
    link_count: countLinks(sheet),
    empty_row_count: sheet.rows.length - nonEmptyRows.length,
    duplicate_header_count: duplicateCount(headers.map(normalizeHeader).filter(Boolean)),
    sensitive_categories: summarizeSensitiveCells(sheet.rows, headers),
    required_columns_guess: requiredColumns(headers),
    optional_columns_guess: optionalColumns(headers),
    key_columns_guess: keyColumns(headers),
  };
}

export function detectHeader(rows) {
  let fallbackIndex = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const filled = row.filter((value) => !isBlank(value)).length;
    if (filled >= 2 && fallbackIndex === 0) fallbackIndex = index;
    const normalized = row.map(normalizeHeader);
    const score = normalized.filter((header) => HEADER_HINTS.some((hint) => header.includes(hint))).length;
    if (filled >= 2 && score >= 1) return { index, headers: row.map((value) => String(value ?? "").trim()) };
  }
  const headers = rows[fallbackIndex] || [];
  return { index: fallbackIndex, headers: headers.map((value) => String(value ?? "").trim()) };
}

export function classifySheet(name, headers = []) {
  const text = normalizeHeader([name, ...headers].join(" "));
  if (/(^|_)(usuarios?|senha|permissao|nivel|login|codigo_site|codigo_pdv)($|_)/.test(text)) return "configuracao";
  if (/(parametro|abertura|fechamento|funcionamento)/.test(text)) return "horario";
  if (/(hospede|cpf|e_mail|celular|ultimo_apto)/.test(text) && !/(pedido|total|produto|quantidade)/.test(text)) return "historico";
  if (/(chat|mensagem|remetente)/.test(text)) return "historico";
  if (/(pedido|order|historico|hist_rico)/.test(text) && /(item|produto|quantidade|qtd)/.test(text)) return "itens de pedido";
  if (/(pedido|order|hospede|telefone|whatsapp|total|status)/.test(text)) return "pedidos";
  if (/(produto|cardapio|preco|valor|categoria|imagem|disponivel)/.test(text)) return "produto";
  if (/(categoria|grupo|secao)/.test(text)) return "categoria";
  if (/(disponibilidade|estoque|indisponivel)/.test(text)) return "disponibilidade";
  if (/(config|parametro|setting)/.test(text)) return "configuracao";
  if (/(horario|abre|fecha|funcionamento|service_hours)/.test(text)) return "horario";
  if (/(quarto|acomodacao|suite|apartamento|room)/.test(text)) return "quartos";
  if (/(impress|printer|print)/.test(text)) return "impressao";
  if (/(relatorio|dashboard|resumo|report)/.test(text)) return "relatorio";
  return "desconhecida";
}

export function getColumnMap(headers) {
  const normalized = headers.map(normalizeHeader);
  const pick = (hints) => normalized.findIndex((header) => hints.some((hint) => header.includes(hint)));
  return {
    id: pick(["id", "codigo", "sku"]),
    category: pick(["categoria", "grupo", "secao", "tipo"]),
    name: pick(["produto", "item", "nome", "titulo", "descricao_item"]),
    description: pick(["descricao", "detalhe", "observacao"]),
    price: pick(["preco", "valor", "price"]),
    currency: pick(["moeda", "currency"]),
    status: pick(["status", "situacao", "ativo", "arquivado"]),
    available: pick(["disponivel", "indisponivel", "estoque", "available"]),
    image: pick(["imagem", "foto", "image", "url", "link"]),
    order: pick(["ordem", "posicao", "sort"]),
    room: pick(["quarto", "acomodacao", "suite", "room"]),
    date: pick(["data", "date", "created", "hora"]),
    total: pick(["total"]),
    quantity: pick(["quantidade", "qtd"]),
    phone: pick(["telefone", "celular", "whatsapp"]),
    guest: pick(["hospede", "cliente", "nome"]),
    notes: pick(["observacao", "observacoes", "obs", "comentario"]),
  };
}

function jsonToRows(data) {
  if (Array.isArray(data)) {
    const headers = [...new Set(data.flatMap((row) => Object.keys(row || {})))];
    return [headers, ...data.map((row) => headers.map((header) => row?.[header] ?? ""))];
  }
  if (data && typeof data === "object") return Object.entries(data).map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : value]);
  return [["value"], [data]];
}

function observedTypes(values) {
  const types = new Set();
  values.filter((value) => !isBlank(value)).slice(0, 200).forEach((value) => {
    if (typeof value === "number") types.add("numero");
    else if (typeof value === "boolean") types.add("booleano");
    else if (/^https?:\/\//i.test(String(value))) types.add("link");
    else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(String(value))) types.add("data");
    else if (/R\$|^\s*-?\d+[,.]\d{2}\s*$/.test(String(value))) types.add("moeda");
    else types.add("texto");
  });
  return [...types].sort();
}

function countLinks(sheet) {
  const valueLinks = sheet.rows.flat().filter((value) => /^https?:\/\//i.test(String(value))).length;
  return valueLinks + (sheet.hyperlinks?.length || 0);
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

function requiredColumns(headers) {
  const map = getColumnMap(headers);
  return Object.entries(map)
    .filter(([name, index]) => index >= 0 && ["name", "price", "room", "date", "total"].includes(name))
    .map(([name]) => name);
}

function optionalColumns(headers) {
  const map = getColumnMap(headers);
  return Object.entries(map)
    .filter(([name, index]) => index >= 0 && !["name", "price", "room", "date", "total"].includes(name))
    .map(([name]) => name);
}

function keyColumns(headers) {
  const map = getColumnMap(headers);
  return Object.entries(map)
    .filter(([name, index]) => index >= 0 && ["id", "room", "date"].includes(name))
    .map(([name]) => name);
}

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

const HEADER_HINTS = [
  "produto",
  "item",
  "preco",
  "valor",
  "categoria",
  "pedido",
  "quarto",
  "acomodacao",
  "hospede",
  "status",
  "data",
  "quantidade",
  "imagem",
];
