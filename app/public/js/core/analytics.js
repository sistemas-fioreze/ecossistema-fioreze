export function portalPageKey(moduleKey) {
  if (moduleKey !== "guest-portal") return moduleKey;
  const tab = new URLSearchParams(window.location.search).get("tab");
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tab || "") ? tab : "inicio";
}

export function trackPortalVisit(slug, pageKey) {
  if (!slug || !pageKey) return;
  void fetch(`/api/v1/public/hotels/${encodeURIComponent(slug)}/portal/analytics/visit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ page_key: pageKey }),
    keepalive: true,
    credentials: "omit",
  }).catch(() => {});
}
