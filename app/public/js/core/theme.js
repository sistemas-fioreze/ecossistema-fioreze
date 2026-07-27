export function applyBranding(branding = {}) {
  const root = document.documentElement;
  const customFontUrl = sanitizePublicAssetUrl(branding.font_asset_url);
  const customFontFormat = branding.font_asset_mime_type === "font/woff" ? "woff" : "woff2";
  syncCustomFont(customFontUrl, customFontFormat);
  const pairs = {
    "--color-primary": branding.primary_color,
    "--color-secondary": branding.secondary_color,
    "--color-accent": branding.accent_color,
    "--color-background": branding.background_color,
    "--color-text": branding.text_color,
    "--font-family": customFontUrl ? "'Fioreze Custom', system-ui, sans-serif" : branding.font_family,
  };
  for (const [property, value] of Object.entries(pairs)) {
    if (value) root.style.setProperty(property, value);
  }
}

function syncCustomFont(url, format) {
  const styleId = "fioreze-custom-font";
  document.getElementById(styleId)?.remove();
  if (!url) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `@font-face{font-family:'Fioreze Custom';src:url('${url}') format('${format}');font-display:swap;font-style:normal;font-weight:100 900;}`;
  document.head.appendChild(style);
}

export function sanitizePublicAssetUrl(value) {
  const path = String(value || "").trim();
  if (/^\/(?:assets|media)\/[A-Za-z0-9._~!$&()*+,;=:@%/-]+$/.test(path)) return path;
  return null;
}
