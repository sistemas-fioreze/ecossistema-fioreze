export function applyBranding(branding = {}) {
  const root = document.documentElement;
  const customFontUrl = sanitizePublicAssetUrl(branding.font_asset_url);
  const customFontFormat = branding.font_asset_mime_type === "font/woff" ? "woff" : "woff2";
  syncCustomFont(customFontUrl, customFontFormat);
  syncFavicon(
    sanitizePublicAssetUrl(branding.favicon_url)
      || sanitizePublicAssetUrl(branding.icon_url)
      || sanitizePublicAssetUrl(branding.logo_url),
  );
  const pairs = {
    "--color-primary": branding.primary_color,
    "--color-secondary": branding.secondary_color,
    "--color-accent": branding.accent_color,
    "--color-background": branding.background_color,
    "--color-text": branding.text_color,
    "--font-family": customFontUrl ? "'Fioreze Custom', system-ui, sans-serif" : branding.font_family,
    "--header-logo-scale": normalizeLogoScale(branding.header_logo_scale),
  };
  for (const [property, value] of Object.entries(pairs)) {
    if (value) root.style.setProperty(property, value);
  }
}

function syncFavicon(url) {
  if (!url) return;
  for (const rel of ["icon", "apple-touch-icon"]) {
    let link = document.head.querySelector(`link[data-hotel-favicon][rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      link.dataset.hotelFavicon = "";
      document.head.append(link);
    }
    link.href = url;
  }
}

function normalizeLogoScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale >= 0.5 && scale <= 3 ? String(scale) : "1";
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
