export function toCents(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function formatCents(cents, currency = "BRL", locale = "pt-BR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format((cents || 0) / 100);
}

export function multiplyCents(unitPriceCents, quantity) {
  return Number(unitPriceCents) * Number(quantity);
}
