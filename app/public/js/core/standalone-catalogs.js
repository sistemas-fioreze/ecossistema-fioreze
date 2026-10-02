const STANDALONE_CATALOGS = Object.freeze({
  "/spa": Object.freeze({
    key: "spa",
    path: "/spa",
    hotelSlug: "muller",
    moduleKey: "spa",
    documentTitle: "Spa Zena | Catalogo",
  }),
  "/pacotes-centro": Object.freeze({
    key: "pacotes-centro",
    path: "/pacotes-centro",
    hotelSlug: "centro",
    moduleKey: "romantic-packages",
    documentTitle: "Decoracoes especiais | Fioreze Centro",
  }),
  "/pacotes-muller": Object.freeze({
    key: "pacotes-muller",
    path: "/pacotes-muller",
    hotelSlug: "muller",
    moduleKey: "romantic-packages",
    documentTitle: "Decoracoes especiais | Muller & Fioreze",
  }),
});

export function resolveStandaloneCatalog(pathname) {
  const path = normalizeStandaloneCatalogPath(pathname);
  return path ? STANDALONE_CATALOGS[path] || null : null;
}

export function standaloneCatalogs() {
  return Object.values(STANDALONE_CATALOGS);
}

function normalizeStandaloneCatalogPath(pathname) {
  const value = String(pathname || "");
  if (!value.startsWith("/") || value.includes("?") || value.includes("#")) return null;
  if (value === "/") return value;
  return value.replace(/\/+$/, "");
}
