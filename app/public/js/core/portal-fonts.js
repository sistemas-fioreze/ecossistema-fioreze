export const PORTAL_FONT_OPTIONS = Object.freeze([
  {
    label: "Sistema moderno",
    value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    label: "Clássica editorial",
    value: "Georgia, 'Times New Roman', serif",
  },
  {
    label: "Elegante",
    value: "Garamond, Georgia, 'Times New Roman', serif",
  },
  {
    label: "Humana",
    value: "'Trebuchet MS', Arial, sans-serif",
  },
  {
    label: "Geométrica",
    value: "Arial, Helvetica, sans-serif",
  },
]);

export const CUSTOM_PORTAL_FONT_FAMILY = "'Fioreze Custom', system-ui, sans-serif";

export function portalFontOptions(currentValue) {
  const current = String(currentValue || "");
  const options = [...PORTAL_FONT_OPTIONS];
  if (current && !options.some((option) => option.value === current) && current !== CUSTOM_PORTAL_FONT_FAMILY) {
    options.unshift({ label: "Fonte atualmente configurada", value: current });
  }
  return options;
}
