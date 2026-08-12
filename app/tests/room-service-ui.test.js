import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createCartStore, cartStorageKey } from "../public/js/modules/room-service/cart.js";
import { filterCatalog, flattenCatalog, formatMoney, getCatalogItemMap, sanitizeMediaPath } from "../public/js/modules/room-service/catalog.js";
import { internalsForTests } from "../public/js/modules/room-service/index.js";
import { evaluateServiceStatus } from "../public/js/modules/room-service/service-status.js";

const {
  buildNotes,
  canScheduleToday,
  clampDetailQuantity,
  hotelLocalTimeToIso,
  isScheduledTimeAllowed,
  renderStaticShell,
  renderProductOptions,
  splitProductDescription,
  submitOrder,
  syncSubmitButton,
  updateServiceStatus,
} = internalsForTests;

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
  assert.equal(sanitizeMediaPath("/media/media_demo-123"), "/media/media_demo-123");
  assert.equal(sanitizeMediaPath("https://example.invalid/a.png"), null);
});

test("shell do Room Service preserva a hierarquia do cardapio sob o header compartilhado", () => {
  const shell = renderStaticShell();
  const css = fs.readFileSync(new URL("../public/css/modules/room-service/room-service.css", import.meta.url), "utf8");
  const script = fs.readFileSync(new URL("../public/js/modules/room-service/index.js", import.meta.url), "utf8");

  assert.ok(shell.indexOf("rs-order-column") < shell.indexOf("rs-menu-column"));
  assert.doesNotMatch(shell, /data-rs-loader|data-hotel-logo-shell/);
  assert.doesNotMatch(shell, /class="rs-mobile-header"|data-hotel-icon|Carregando cardápio/);
  assert.match(shell, /Resumo do Pedido/);
  assert.match(shell, /data-rs-product-detail/);
  assert.match(shell, /data-category-sentinel/);
  assert.match(shell, /data-catalog-media-viewer/);
  assert.match(shell, /data-submit-overlay/);
  assert.doesNotMatch(shell, /data-mobile-cart|script\.google|cdn\.tailwindcss|postimg/i);
  assert.match(css, /grid-template-columns:\s*380px minmax\(0, 1fr\)/);
  assert.match(css, /\.rs-product-card\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 112px/);
  assert.match(css, /\.rs-product-card\s*\{[\s\S]*?border-bottom:\s*1px solid/);
  assert.match(css, /\.rs-product-card\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.rs-product-media\s*\{[\s\S]*?grid-column:\s*2/);
  assert.match(css, /\.rs-product-media\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none/);
  assert.match(css, /\.rs-product-card:has\(\.rs-product-media\) \.rs-product-content\s*\{\s*padding-right:\s*0/);
  assert.match(css, /\.rs-product-card:has\(\.rs-product-media\) \.rs-product-label,[\s\S]*?max-width:\s*100%/);
  assert.match(css, /@media \(max-width: 959px\)[\s\S]*?\.rs-search-panel\.is-stuck[\s\S]*?backdrop-filter:\s*blur\(18px\)/);
  assert.doesNotMatch(css, /\.rs-search-panel\.is-stuck \.rs-search-field\s*\{\s*display:\s*block/);
  assert.match(css, /@media \(max-width: 959px\)[\s\S]*?\.rs-search-field\s*\{\s*display:\s*none/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /\.public-module-root \.rs-search-panel\s*\{\s*top:\s*calc\(64px \+ env\(safe-area-inset-top\)\)/);
  assert.match(css, /@media \(max-width: 959px\)[\s\S]*?\.rs-category-button\.active[\s\S]*?background:\s*var\(--rs-primary\)/);
  assert.match(css, /max\(18px, env\(safe-area-inset-left\)\)/);
  assert.match(script, /classList\.toggle\("active", state\.activeCategory === category\.id\)/);
  assert.match(script, /data-rs-product/);
  assert.match(script, /data-rs-item-note/);
  assert.match(script, /data-rs-detail-quantity-action/);
  assert.match(script, /data-rs-detail-add/);
  assert.doesNotMatch(script, /data-add-item/);
  assert.match(script, /catalog-detail-layer/);
  assert.match(script, /renderZoomableCatalogMedia/);
  assert.doesNotMatch(script, /renderLoading|Carregando cardápio/);
  assert.doesNotMatch(script, /IntersectionObserver/);
});

test("card do Room Service separa quantidade da descricao e abre detalhe compartilhado", () => {
  assert.deepEqual(splitProductDescription("450g • Serve até 2 pessoas. Escolha o recheio."), {
    meta: "450g",
    description: "Serve até 2 pessoas. Escolha o recheio.",
  });
  assert.deepEqual(splitProductDescription("Serve até 2 pessoas."), {
    meta: "",
    description: "Serve até 2 pessoas.",
  });
  assert.equal(clampDetailQuantity(-1), 1);
  assert.equal(clampDetailQuantity(4), 4);
  assert.equal(clampDetailQuantity(99), 20);
});

test("detalhe renderiza sabores antes da observacao e sem selo de disponibilidade", () => {
  const html = renderProductOptions({
    options: [{ key: "selection", label: "Escolha o sabor", required: true, values: ["Calabresa", "Marguerita"] }],
  }, { selection: "Marguerita" });
  const script = fs.readFileSync(new URL("../public/js/modules/room-service/index.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../public/css/modules/room-service/room-service.css", import.meta.url), "utf8");

  assert.match(html, /Escolha o sabor/);
  assert.match(html, /value="Marguerita" selected/);
  assert.match(script, /renderProductOptions\(item, state\.selectedProductOptions\)[\s\S]*?orderNotesEnabled\(state\)/);
  assert.doesNotMatch(script, /Disponível para pedir/);
  assert.match(css, /\.rs-product-detail-actions\s*\{[\s\S]*?margin-bottom:\s*max\(18px, env\(safe-area-inset-bottom\)\)/);
});

test("aviso fechado usa mensagem curta e mantém respiro do formulário", () => {
  const css = fs.readFileSync(new URL("../public/css/modules/room-service/room-service.css", import.meta.url), "utf8");
  const script = fs.readFileSync(new URL("../public/js/modules/room-service/index.js", import.meta.url), "utf8");

  assert.match(script, /note\.textContent = "Room service fechado no momento"/);
  assert.match(css, /\.rs-service-note\s*\{[\s\S]*?margin:\s*0 0 14px/);
});

test("Room Service incorporado usa o cabecalho do portal e abre sem tela de carregamento", () => {
  const shell = renderStaticShell({ embedded: true });
  assert.match(shell, /class="rs-app is-portal-page"/);
  assert.doesNotMatch(shell, /rs-mobile-header|rs-loader|data-rs-loader/);
  assert.match(shell, /data-catalog/);
  assert.match(shell, /Resumo do Pedido/);
});

test("fluxo visual inclui revisao, preparo e acompanhamento recente sem exibir ID tecnico", () => {
  const shell = renderStaticShell();
  const script = fs.readFileSync(new URL("../public/js/modules/room-service/index.js", import.meta.url), "utf8");

  assert.match(shell, /data-order-review/);
  assert.match(shell, /data-recent-orders/);
  assert.match(script, /Revise antes de enviar/);
  assert.match(script, /Agendar entrega/);
  assert.match(script, /Pedido enviado com sucesso/);
  assert.doesNotMatch(script, /Recebemos seu pedido \$\{order\.public_id/);
});

test("agendamento visual fica limitado ao restante do mesmo dia", () => {
  const state = {
    bootstrap: { settings: { "room-service.order_scheduling_enabled": true } },
    status: {
      mode: "automatic",
      local: { hour: 17, minute: 0 },
      today_slots: [{ opens_at: "16:00", closes_at: "22:00" }],
    },
  };

  assert.equal(canScheduleToday(state), true);
  assert.equal(isScheduledTimeAllowed(state, "17:00"), false);
  assert.equal(isScheduledTimeAllowed(state, "17:15"), true);
  assert.equal(isScheduledTimeAllowed(state, "21:45"), true);
  assert.equal(isScheduledTimeAllowed(state, "22:00"), false);
  assert.equal(isScheduledTimeAllowed(state, "23:00"), false);
  state.status.local = { hour: 22, minute: 0 };
  assert.equal(canScheduleToday(state), false);
  assert.equal(
    hotelLocalTimeToIso("19:30", "America/Sao_Paulo", new Date("2026-07-05T20:00:00.000Z")),
    "2026-07-05T22:30:00.000Z",
  );
});

test("agendamento visual fica indisponivel em qualquer modo manual", () => {
  const state = {
    bootstrap: { settings: { "room-service.order_scheduling_enabled": true } },
    status: {
      open: true,
      mode: "forced_open",
      local: { hour: 17, minute: 0 },
      today_slots: [{ opens_at: "16:00", closes_at: "22:00" }],
    },
  };

  assert.equal(canScheduleToday(state), false);
  assert.equal(isScheduledTimeAllowed(state, "18:00"), false);
  state.status.open = false;
  state.status.mode = "forced_closed";
  assert.equal(canScheduleToday(state), false);
  assert.equal(isScheduledTimeAllowed(state, "18:00"), false);
});

test("observacao desabilitada nao entra no texto persistido do pedido", () => {
  const data = new FormData();
  data.set("delivery_location", "Acomodação");
  data.set("guest_phone", "[TELEFONE FICTICIO]");
  data.set("notes", "Observação que não deve ser enviada");

  const notes = buildNotes(data, { notesEnabled: false });
  assert.match(notes, /Local de entrega/);
  assert.match(notes, /Contato/);
  assert.doesNotMatch(notes, /não deve ser enviada/);
});

test("botao oferece programacao quando a loja esta fechada mas ainda abre hoje", () => {
  const { button, container } = submitButtonFixture();
  const state = {
    bootstrap: { settings: { "room-service.order_scheduling_enabled": true } },
    status: {
      open: false,
      mode: "automatic",
      local: { hour: 14, minute: 0 },
      today_slots: [{ opens_at: "16:00", closes_at: "22:00" }],
    },
    isSubmitting: false,
  };

  syncSubmitButton(container, state);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Programar pedido");
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

test("carrinho configura quantidade e observacao do item sem perder dados na hidratacao", () => {
  const storage = memoryStorage();
  const catalog = flattenCatalog(CATEGORIES);
  const cart = createCartStore({ hotelId: "muller-fioreze", storage, catalogItems: catalog });

  cart.set("cafe", 3, "Sem açúcar");
  let snapshot = cart.snapshot();
  assert.equal(snapshot.items[0].quantity, 3);
  assert.equal(snapshot.items[0].note, "Sem açúcar");
  assert.equal(snapshot.total_cents, 2700);

  snapshot = cart.hydrate(catalog);
  assert.equal(snapshot.items[0].note, "Sem açúcar");
});

test("carrinho preserva a opcao selecionada por item", () => {
  const storage = memoryStorage();
  const catalog = flattenCatalog(CATEGORIES);
  const cart = createCartStore({ hotelId: "muller-fioreze", storage, catalogItems: catalog });

  cart.set("cafe", 2, "", { selection: "Sem açúcar" });
  assert.deepEqual(cart.snapshot().items[0].selected_options, { selection: "Sem açúcar" });
  assert.deepEqual(cart.hydrate(catalog).items[0].selected_options, { selection: "Sem açúcar" });
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

test("botao de pedido fica habilitado quando o servico esta aberto", () => {
  const { button, container } = submitButtonFixture();

  syncSubmitButton(container, { status: { open: true }, isSubmitting: false });

  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Finalizar Pedido");
  assert.equal(button.getAttribute("aria-disabled"), "false");
  assert.equal(button.classList.contains("is-closed"), false);
});

test("botao de pedido fica desabilitado quando o servico esta fechado", () => {
  const { button, container } = submitButtonFixture();

  syncSubmitButton(container, { status: { open: false, next_opening: null }, isSubmitting: false });

  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "Room Service fechado");
  assert.equal(button.getAttribute("aria-disabled"), "true");
  assert.equal(button.classList.contains("is-closed"), true);
  assert.match(button.getAttribute("aria-label"), /Room Service fechado/);
});

test("botao de pedido mostra envio em andamento", () => {
  const { button, container } = submitButtonFixture();

  syncSubmitButton(container, { status: { open: true }, isSubmitting: true });

  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "Enviando pedido...");
  assert.equal(button.getAttribute("aria-disabled"), "true");
  assert.equal(button.classList.contains("is-submitting"), true);
});

test("botao de pedido volta habilitado quando envio termina com servico aberto", () => {
  const { button, container } = submitButtonFixture();
  const state = { status: { open: true }, isSubmitting: true };
  syncSubmitButton(container, state);

  state.isSubmitting = false;
  syncSubmitButton(container, state);

  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Finalizar Pedido");
  assert.equal(button.classList.contains("is-submitting"), false);
});

test("botao de pedido permanece desabilitado se o servico fecha durante envio", () => {
  const { button, container } = submitButtonFixture();
  const state = { status: { open: true }, isSubmitting: true };
  syncSubmitButton(container, state);

  state.status = { open: false, next_opening: null };
  state.isSubmitting = false;
  syncSubmitButton(container, state);

  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "Room Service fechado");
  assert.equal(button.classList.contains("is-closed"), true);
});

test("botao de pedido acompanha atualizacao de horario aberto e fechado", () => {
  const { button, container } = roomServiceContainerFixture();
  const state = {
    bootstrap: {
      service_hours: { "room-service": weekHours("16:00", "22:00") },
      timezone: "America/Sao_Paulo",
    },
    isSubmitting: false,
  };

  updateServiceStatus(container, state, new Date("2026-07-05T20:00:00.000Z"));
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Finalizar Pedido");

  updateServiceStatus(container, state, new Date("2026-07-05T18:00:00.000Z"));
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "Room Service fechado");

  updateServiceStatus(container, state, new Date("2026-07-06T20:00:00.000Z"));
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Finalizar Pedido");
});

test("submitOrder bloqueia antes do POST quando o servico esta fechado", async () => {
  const { button, container, modal, modalTitle } = roomServiceContainerFixture();
  const state = {
    bootstrap: {
      service_hours: { "room-service": [] },
      timezone: "America/Sao_Paulo",
    },
    isSubmitting: false,
    status: { open: true },
    cart: {
      snapshot() {
        throw new Error("Fluxo de envio nao deveria acessar o carrinho quando fechado.");
      },
    },
  };

  await submitOrder(container, state, {});

  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "Room Service fechado");
  assert.equal(modal.hidden, false);
  assert.equal(modalTitle.textContent, "Room Service fechado no momento");
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

function submitButtonFixture() {
  const button = fakeElement();
  return {
    button,
    container: {
      querySelector(selector) {
        if (selector === "[data-submit-order]") return button;
        return null;
      },
    },
  };
}

function roomServiceContainerFixture() {
  const button = fakeElement();
  const modal = fakeElement({ hidden: true });
  const modalTitle = fakeElement();
  const elements = new Map([
    ["[data-submit-order]", button],
    ["[data-service-status-pill]", fakeElement()],
    ["[data-service-status-label]", fakeElement()],
    ["[data-service-status-detail]", fakeElement()],
    ["[data-service-hours]", fakeElement()],
    ["[data-service-note]", fakeElement({ hidden: true })],
    ["[data-modal]", modal],
    ["[data-modal-card]", fakeElement()],
    ["[data-modal-success]", fakeElement({ hidden: true })],
    ["[data-modal-title]", modalTitle],
    ["[data-modal-text]", fakeElement()],
    ["[data-modal-close]", fakeElement({ focus() {} })],
  ]);
  return {
    button,
    modal,
    modalTitle,
    container: {
      querySelector(selector) {
        if (!elements.has(selector)) throw new Error(`Seletor inesperado no teste: ${selector}`);
        return elements.get(selector);
      },
    },
  };
}

function fakeElement(overrides = {}) {
  const attributes = new Map();
  const classes = new Set();
  return {
    disabled: false,
    hidden: false,
    textContent: "",
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    ...overrides,
  };
}
