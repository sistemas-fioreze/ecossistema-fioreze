import assert from "node:assert/strict";
import test from "node:test";
import { createCartStore, cartStorageKey } from "../public/js/modules/room-service/cart.js";
import { filterCatalog, flattenCatalog, formatMoney, getCatalogItemMap, sanitizeMediaPath } from "../public/js/modules/room-service/catalog.js";
import { evaluateServiceStatus } from "../public/js/modules/room-service/service-status.js";

const CATEGORIES = [
  {
    id: "bebidas",
    name: "Bebidas",
    items: [
      {
        id: "cafe",
        name: "Cafe Demo",
        description: "Bebida ficticia",
        price_cents: 900,
        currency: "BRL",
        available: true,
        image_url: "/assets/hotels/muller-fioreze/logo.png",
      },
      {
        id: "suco",
        name: "Suco Demo",
        description: "Bebida fria",
        price_cents: 1200,
        currency: "BRL",
        available: false,
        availability_label: "Indisponivel",
        image_url: "https://example.invalid/private.png",
      },
    ],
  },
  {
    id: "lanches",
    name: "Lanches",
    items: [
      {
        id: "sanduiche",
        name: "Sanduiche Demo",
        description: "Lanche ficticio",
        price_cents: 2500,
        currency: "BRL",
        available: true,
      },
    ],
  },
];

test("catalogo achata categorias e sanitiza imagens remotas", () => {
  const items = flattenCatalog(CATEGORIES);
  assert.equal(items.length, 3);
  assert.equal(items[0].category_name, "Bebidas");
  assert.equal(items[0].image_url, "/assets/hotels/muller-fioreze/logo.png");
  assert.equal(items[1].image_url, null);
  assert.equal(sanitizeMediaPath("https://example.invalid/a.png"), null);
});

test("catalogo filtra por categoria e busca textual", () => {
  const byCategory = filterCatalog(CATEGORIES, { categoryId: "lanches" });
  assert.deepEqual(byCategory.map((category) => category.id), ["lanches"]);
  assert.deepEqual(byCategory[0].items.map((item) => item.id), ["sanduiche"]);

  const bySearch = filterCatalog(CATEGORIES, { query: "bebida fria" });
  assert.deepEqual(bySearch.flatMap((category) => category.items.map((item) => item.id)), ["suco"]);
});

test("mapa de produtos e dinheiro visual usam dados do catalogo", () => {
  const map = getCatalogItemMap(CATEGORIES);
  assert.equal(map.get("cafe").price_cents, 900);
  assert.equal(formatMoney(900, "BRL").replace(/\s/g, " "), "R$ 9,00");
});

test("carrinho adiciona, incrementa, diminui, remove e calcula total", () => {
  const storage = memoryStorage();
  const cart = createCartStore({ hotelId: "muller-fioreze", storage, catalogItems: flattenCatalog(CATEGORIES) });

  cart.add("cafe");
  cart.add("cafe");
  cart.add("sanduiche");
  let snapshot = cart.snapshot();
  assert.equal(snapshot.total_quantity, 3);
  assert.equal(snapshot.total_cents, 4300);

  cart.change("cafe", -1);
  snapshot = cart.snapshot();
  assert.equal(snapshot.total_quantity, 2);
  assert.equal(snapshot.total_cents, 3400);

  cart.remove("sanduiche");
  snapshot = cart.snapshot();
  assert.deepEqual(snapshot.items.map((item) => item.id), ["cafe"]);
});

test("carrinho persiste por hotel e nao mistura tenants", () => {
  const storage = memoryStorage();
  const muller = createCartStore({ hotelId: "muller-fioreze", storage, catalogItems: flattenCatalog(CATEGORIES) });
  muller.add("cafe");

  const aurora = createCartStore({ hotelId: "aurora-demo", storage, catalogItems: flattenCatalog(CATEGORIES) });
  assert.equal(aurora.snapshot().total_quantity, 0);
  assert.notEqual(cartStorageKey("muller-fioreze"), cartStorageKey("aurora-demo"));
});

test("carrinho remove item ausente quando catalogo muda e atualiza preco", () => {
  const storage = memoryStorage();
  const cart = createCartStore({ hotelId: "muller-fioreze", storage, catalogItems: flattenCatalog(CATEGORIES) });
  cart.add("cafe");
  cart.add("sanduiche");

  const updatedCatalog = [
    {
      id: "bebidas",
      name: "Bebidas",
      items: [{ ...CATEGORIES[0].items[0], price_cents: 1000 }],
    },
  ];

  const snapshot = cart.hydrate(flattenCatalog(updatedCatalog));
  assert.deepEqual(snapshot.items.map((item) => item.id), ["cafe"]);
  assert.equal(snapshot.total_cents, 1000);
});

test("carrinho rejeita produto indisponivel", () => {
  const cart = createCartStore({ hotelId: "muller-fioreze", storage: memoryStorage(), catalogItems: flattenCatalog(CATEGORIES) });
  assert.throws(() => cart.add("suco"), /Indisponivel/);
});

test("service_hours identifica aberto, fechado e proxima abertura", () => {
  const hours = weekHours("16:00", "22:00");
  const open = evaluateServiceStatus({ serviceHours: hours, timezone: "America/Sao_Paulo", now: new Date("2026-07-05T20:00:00.000Z") });
  const closed = evaluateServiceStatus({ serviceHours: hours, timezone: "America/Sao_Paulo", now: new Date("2026-07-05T18:00:00.000Z") });

  assert.equal(open.open, true);
  assert.equal(closed.open, false);
  assert.equal(closed.next_opening.opens_at, "16:00");
});

test("service_hours suporta multiplas faixas no mesmo dia", () => {
  const hours = [...weekHours("16:00", "22:00"), hour(0, "22:30", "23:30")];
  const status = evaluateServiceStatus({ serviceHours: hours, timezone: "America/Sao_Paulo", now: new Date("2026-07-06T01:45:00.000Z") });
  assert.equal(status.open, true);
  assert.equal(status.active_slot.opens_at, "22:30");
});

test("service_hours suporta horario atravessando meia-noite e timezone do hotel", () => {
  const overnight = [hour(0, "22:00", "02:00")];
  const status = evaluateServiceStatus({
    serviceHours: overnight,
    timezone: "America/Sao_Paulo",
    now: new Date("2026-07-06T04:30:00.000Z"),
  });
  assert.equal(status.open, true);

  const timezoneSensitive = [hour(0, "15:00", "16:00")];
  const saoPaulo = evaluateServiceStatus({
    serviceHours: timezoneSensitive,
    timezone: "America/Sao_Paulo",
    now: new Date("2026-07-05T18:30:00.000Z"),
  });
  assert.equal(saoPaulo.open, true);
});

function weekHours(opensAt, closesAt) {
  return Array.from({ length: 7 }, (_, day) => hour(day, opensAt, closesAt));
}

function hour(day, opensAt, closesAt) {
  return { day_of_week: day, opens_at: opensAt, closes_at: closesAt, is_closed: false };
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.get(key) || null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
  };
}
