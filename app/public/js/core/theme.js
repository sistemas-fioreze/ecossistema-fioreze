export function applyBranding(branding = {}) {
  const root = document.documentElement;
  const pairs = {
    "--color-primary": branding.primary_color,
    "--color-secondary": branding.secondary_color,
    "--color-accent": branding.accent_color,
    "--color-background": branding.background_color,
    "--color-text": branding.text_color,
    "--font-family": branding.font_family,
  };
  for (const [property, value] of Object.entries(pairs)) {
    if (value) root.style.setProperty(property, value);
  }
}

export function sanitizePublicAssetUrl(value) {
  const path = String(value || "").trim();
  if (/^\/(?:assets|media)\/[A-Za-z0-9._~!$&()*+,;=:@%/-]+$/.test(path)) return path;
  return null;
}
