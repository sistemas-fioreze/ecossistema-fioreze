export function removeAccents(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeText(value) {
  return removeAccents(value).trim().replace(/\s+/g, " ");
}

export function normalizeHeader(value) {
  return removeAccents(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function slugify(value, fallback = "item") {
  const slug = normalizeHeader(value).replaceAll("_", "-").replace(/-+/g, "-");
  return slug || fallback;
}

export function normalizeMoneyToCents(value) {
  if (value == null || value === "") return { cents: null, valid: false, reason: "missing" };
  if (typeof value === "number" && Number.isFinite(value)) {
    return { cents: Math.round(value * 100), valid: value >= 0, reason: value >= 0 ? null : "negative" };
  }

  const raw = String(value).trim();
  if (!raw) return { cents: null, valid: false, reason: "missing" };
  const cleaned = raw
    .replace(/[^\d,.\-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return { cents: null, valid: false, reason: "invalid" };
  return { cents: Math.round(parsed * 100), valid: parsed >= 0, reason: parsed >= 0 ? null : "negative" };
}

export function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = normalizeHeader(value);
  if (!text) return null;
  if (["sim", "s", "yes", "y", "true", "verdadeiro", "ativo", "aberto", "disponivel", "1"].includes(text)) return true;
  if (["nao", "n", "no", "false", "falso", "inativo", "fechado", "indisponivel", "0"].includes(text)) return false;
  return null;
}

export function normalizeDateToIso(value) {
  if (value == null || value === "") return { iso: null, valid: false };
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return { iso: value.toISOString(), valid: true };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + Math.round(value * 86400000);
    const date = new Date(ms);
    return { iso: date.toISOString(), valid: true };
  }
  const text = String(value).trim();
  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const year = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    const date = new Date(Date.UTC(year, Number(br[2]) - 1, Number(br[1]), Number(br[4] || 0), Number(br[5] || 0), Number(br[6] || 0)));
    return { iso: date.toISOString(), valid: Number.isFinite(date.getTime()) };
  }
  const parsed = new Date(text);
  return { iso: Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null, valid: Number.isFinite(parsed.getTime()) };
}

export function compactDefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
