import { normalizeHeader } from "./normalize.js";

const SECRET_PATTERNS = [
  ["private_key", /private[_-]?key/i],
  ["private_key_id", /private[_-]?key[_-]?id/i],
  ["client_email", /client_email/i],
  ["token", /\b(token|bearer|api[_-]?key|secret)\b/i],
  ["password", /\b(password|senha)\b/i],
  ["cookie", /\bcookie\b/i],
  ["apps_script_url", /script\.google\.com\/macros/i],
  ["spreadsheet_url", /docs\.google\.com\/spreadsheets/i],
];

const PERSONAL_HEADER_PATTERNS = [
  ["nome", /\b(nome|hospede|cliente)\b/],
  ["telefone", /\b(telefone|celular|whatsapp|fone)\b/],
  ["email", /\b(email|e_mail)\b/],
  ["acomodacao", /\b(quarto|acomodacao|suite|apartamento)\b/],
  ["observacao", /\b(obs|observacao|observacoes|comentario)\b/],
];

const PERSONAL_VALUE_PATTERNS = [
  ["telefone", /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}/],
  ["email", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ["documento", /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/],
];

export function scanTextForSensitive(text) {
  const categories = new Set();
  const source = String(text ?? "");
  for (const [name, pattern] of SECRET_PATTERNS) {
    if (pattern.test(source)) categories.add(name);
  }
  for (const [name, pattern] of PERSONAL_VALUE_PATTERNS) {
    if (pattern.test(source)) categories.add(`personal:${name}`);
  }
  return [...categories].sort();
}

export function classifyHeaderSensitivity(header) {
  const normalized = normalizeHeader(header);
  return PERSONAL_HEADER_PATTERNS.filter(([, pattern]) => pattern.test(normalized)).map(([name]) => name);
}

export function summarizeSensitiveCells(rows, headers = []) {
  const categories = new Set();
  headers.forEach((header) => classifyHeaderSensitivity(header).forEach((item) => categories.add(`personal_header:${item}`)));
  rows.forEach((row) => row.forEach((cell) => scanTextForSensitive(cell).forEach((item) => categories.add(item))));
  return [...categories].sort();
}

export function redactForDocs(value, header = "") {
  if (classifyHeaderSensitivity(header).length) return "[DADO PESSOAL REDIGIDO]";
  if (scanTextForSensitive(value).some((item) => !item.startsWith("personal:"))) return "[SEGREDO REDIGIDO]";
  if (scanTextForSensitive(value).some((item) => item.startsWith("personal:"))) return "[DADO PESSOAL REDIGIDO]";
  return value;
}
