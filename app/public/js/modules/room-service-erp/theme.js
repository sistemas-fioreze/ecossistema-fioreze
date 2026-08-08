const DEFAULT_PRIMARY = "#4b5563";

export function buildBrandTokens(primaryColor, secondaryColor = "") {
  const primary = normalizeHex(primaryColor) || DEFAULT_PRIMARY;
  const secondary = normalizeHex(secondaryColor) || primary;
  const whiteContrast = contrastRatio(primary, "#ffffff");
  const darkContrast = contrastRatio(primary, "#111827");

  return {
    "--brand-primary": primary,
    "--brand-primary-hover": mixHex(primary, "#000000", 0.12),
    "--brand-primary-active": mixHex(primary, "#000000", 0.2),
    "--brand-primary-soft": mixHex(primary, "#ffffff", 0.9),
    "--brand-primary-subtle": mixHex(primary, "#ffffff", 0.96),
    "--brand-primary-border": mixHex(primary, "#ffffff", 0.72),
    "--brand-primary-text": darkContrast >= 4.5 ? primary : mixHex(primary, "#000000", 0.38),
    "--brand-on-primary": whiteContrast >= darkContrast ? "#ffffff" : "#111827",
    "--brand-secondary": secondary,
    "--accent": primary,
    "--accent-strong": mixHex(primary, "#000000", 0.12),
    "--accent-soft": mixHex(primary, "#ffffff", 0.9),
    "--accent-soft-strong": mixHex(primary, "#ffffff", 0.58),
  };
}

export function applyBrandTokens(root, primaryColor, secondaryColor = "") {
  const tokens = buildBrandTokens(primaryColor, secondaryColor);
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
  return tokens;
}

export function normalizeHex(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw.slice(1).split("").map((part) => `${part}${part}`).join("")}`;
  }
  return "";
}

function mixHex(base, target, targetWeight) {
  const from = hexToRgb(base);
  const to = hexToRgb(target);
  const weight = Math.max(0, Math.min(1, Number(targetWeight) || 0));
  return rgbToHex({
    r: Math.round(from.r + (to.r - from.r) * weight),
    g: Math.round(from.g + (to.g - from.g) * weight),
    b: Math.round(from.b + (to.b - from.b) * weight),
  });
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex) || DEFAULT_PRIMARY;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
