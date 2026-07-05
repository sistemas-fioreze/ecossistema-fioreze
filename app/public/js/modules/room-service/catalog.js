export function flattenCatalog(categories = []) {
  return categories.flatMap((category) =>
    (category.items || []).map((item) => ({
      ...item,
      category_id: category.id,
      category_name: category.name,
      image_url: sanitizeMediaPath(item.image_url),
      image_alt: item.image_alt || item.name || "Item do cardapio",
    })),
  );
}

export function filterCatalog(categories = [], { query = "", categoryId = "all" } = {}) {
  const term = normalizeText(query);
  return categories
    .map((category) => {
      const items = (category.items || [])
        .filter((item) => categoryId === "all" || category.id === categoryId)
        .filter((item) => {
          if (!term) return true;
          return normalizeText([item.name, item.description, category.name].join(" ")).includes(term);
        })
        .map((item) => ({
          ...item,
          image_url: sanitizeMediaPath(item.image_url),
          image_alt: item.image_alt || item.name || "Item do cardapio",
        }));
      return { ...category, items };
    })
    .filter((category) => category.items.length > 0);
}

export function getCatalogItemMap(categories = []) {
  return new Map(flattenCatalog(categories).map((item) => [item.id, item]));
}

export function formatMoney(cents, currency = "BRL", locale = "pt-BR") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format((Number(cents) || 0) / 100);
}

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function sanitizeMediaPath(value) {
  const path = String(value || "").trim();
  if (!path) return null;
  if (path.startsWith("/assets/")) return path;
  return null;
}
