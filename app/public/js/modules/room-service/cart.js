const MAX_QUANTITY = 20;

export function cartStorageKey(hotelId, moduleKey = "room-service") {
  return `fioreze-cart:${hotelId}:${moduleKey}`;
}

export function createCartStore({ hotelId, moduleKey = "room-service", storage = safeSessionStorage(), catalogItems = [] }) {
  let catalog = new Map(catalogItems.map((item) => [item.id, item]));
  let rows = readRows(storage, cartStorageKey(hotelId, moduleKey));

  function persist() {
    writeRows(storage, cartStorageKey(hotelId, moduleKey), rows);
  }

  function hydrate(nextCatalogItems = []) {
    catalog = new Map(nextCatalogItems.map((item) => [item.id, item]));
    rows = rows
      .filter((row) => catalog.has(row.id))
      .map((row) => ({ id: row.id, quantity: clampQuantity(row.quantity) }));
    persist();
    return snapshot();
  }

  function add(itemId) {
    const item = catalog.get(itemId);
    if (!item || item.available === false) {
      throw new Error(item?.availability_label || "Item indisponivel.");
    }
    const existing = rows.find((row) => row.id === itemId);
    if (existing) existing.quantity = clampQuantity(existing.quantity + 1);
    else rows.push({ id: itemId, quantity: 1 });
    persist();
    return snapshot();
  }

  function change(itemId, delta) {
    rows = rows
      .map((row) => (row.id === itemId ? { ...row, quantity: row.quantity + delta } : row))
      .filter((row) => row.quantity > 0)
      .map((row) => ({ ...row, quantity: clampQuantity(row.quantity) }));
    persist();
    return snapshot();
  }

  function remove(itemId) {
    rows = rows.filter((row) => row.id !== itemId);
    persist();
    return snapshot();
  }

  function clear() {
    rows = [];
    persist();
    return snapshot();
  }

  function snapshot() {
    const items = rows
      .map((row) => {
        const item = catalog.get(row.id);
        if (!item) return null;
        const lineTotalCents = item.price_cents * row.quantity;
        return {
          ...item,
          quantity: row.quantity,
          line_total_cents: lineTotalCents,
        };
      })
      .filter(Boolean);
    const totalCents = items.reduce((sum, item) => sum + item.line_total_cents, 0);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    return { items, total_cents: totalCents, total_quantity: totalQuantity };
  }

  return { hydrate, add, change, remove, clear, snapshot };
}

export function createOrderAttemptKey() {
  return `room-service:${crypto.randomUUID()}`;
}

function clampQuantity(value) {
  return Math.max(1, Math.min(MAX_QUANTITY, Number.parseInt(value, 10) || 1));
}

function readRows(storage, key) {
  try {
    const raw = storage?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => typeof row?.id === "string")
      .map((row) => ({ id: row.id, quantity: clampQuantity(row.quantity) }));
  } catch {
    return [];
  }
}

function writeRows(storage, key, rows) {
  try {
    storage?.setItem(key, JSON.stringify(rows));
  } catch {
    // Session persistence is a convenience. The in-memory cart remains authoritative for the current page.
  }
}

function safeSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
