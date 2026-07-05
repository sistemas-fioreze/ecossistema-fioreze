import { badRequest } from "./errors.js";

export async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw badRequest("Envie o corpo como application/json.");
  }
  try {
    return await request.json();
  } catch {
    throw badRequest("JSON invalido.");
  }
}

export function requireString(value, label, { min = 1, max = 160 } = {}) {
  if (typeof value !== "string") throw badRequest(`${label} deve ser texto.`);
  const normalized = value.trim();
  if (normalized.length < min) throw badRequest(`${label} e obrigatorio.`);
  if (normalized.length > max) throw badRequest(`${label} excede o tamanho permitido.`);
  return normalized;
}

export function optionalString(value, label, { max = 500 } = {}) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") throw badRequest(`${label} deve ser texto.`);
  const normalized = value.trim();
  if (normalized.length > max) throw badRequest(`${label} excede o tamanho permitido.`);
  return normalized;
}

export function requireArray(value, label, { min = 1, max = 50 } = {}) {
  if (!Array.isArray(value)) throw badRequest(`${label} deve ser uma lista.`);
  if (value.length < min) throw badRequest(`${label} precisa ter pelo menos ${min} item.`);
  if (value.length > max) throw badRequest(`${label} excede o limite permitido.`);
  return value;
}

export function requirePositiveInteger(value, label, { min = 1, max = 99 } = {}) {
  if (!Number.isInteger(value)) throw badRequest(`${label} deve ser numero inteiro.`);
  if (value < min || value > max) throw badRequest(`${label} fora do intervalo permitido.`);
  return value;
}
