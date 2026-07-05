import { apiGet, apiPost } from "../../core/api.js";
import { escapeHtml } from "../../core/errors.js";
import { createCartStore, createOrderAttemptKey } from "./cart.js";
import { filterCatalog, flattenCatalog, formatMoney, getCatalogItemMap } from "./catalog.js";
import { describeServiceStatus, evaluateServiceStatus } from "./service-status.js";

const MODULE_KEY = "room-service";
let cleanupCurrentRender = () => {};

export async function render(container, context) {
  cleanupCurrentRender();
  await loadCss("/css/modules/room-service/room-service.css");

  const state = {
    bootstrap: context.bootstrap,
    slug: context.bootstrap.slug,
    catalog: { categories: [] },
    itemMap: new Map(),
    cart: null,
    query: "",
    activeCategory: "all",
    status: null,
    orderAttemptKey: null,
    isSubmitting: false,
    cartOpen: false,
    statusTimer: null,
    observer: null,
  };

  container.innerHTML = renderStaticShell();
  bindStaticActions(container, state);
  renderHotelHeader(container, state);
  renderLoading(container, "Carregando cardapio...");

  try {
    const products = await apiGet(`/api/v1/public/hotels/${encodeURIComponent(state.slug)}/room-service/products`);
    state.catalog = products;
    const items = flattenCatalog(products.categories);
    state.itemMap = getCatalogItemMap(products.categories);
    state.cart = createCartStore({
      hotelId: state.bootstrap.hotel_id,
      moduleKey: MODULE_KEY,
      catalogItems: items,
    });
    state.cart.hydrate(items);
    updateServiceStatus(container, state);
    state.statusTimer = window.setInterval(() => updateServiceStatus(container, state), 60000);
    renderCatalog(container, state);
    renderCart(container, state);
    setupCategoryObserver(container, state);
  } catch (error) {
    renderCatalogError(container, error);
  }

  cleanupCurrentRender = () => {
    if (state.statusTimer) window.clearInterval(state.statusTimer);
    if (state.observer) state.observer.disconnect();
  };
}

function renderStaticShell() {
  return `
    <section class="rs-app" data-rs-app>
      <section class="rs-loader" data-rs-loader aria-live="polite">
        <div class="rs-logo-loader" data-hotel-logo-shell></div>
        <p class="rs-kicker">Room Service</p>
        <h2>Seja bem-vindo</h2>
        <div class="rs-loader-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      </section>

      <section class="rs-shell" data-rs-shell hidden>
        <header class="rs-hero">
          <div class="rs-brand-block">
            <div class="rs-logo-frame" data-hotel-logo></div>
            <div class="rs-title-block">
              <p class="rs-kicker">Room Service</p>
              <h2 data-hotel-name></h2>
              <p data-hotel-intro></p>
            </div>
          </div>
          <div class="rs-status-card" aria-live="polite">
            <span class="rs-status-pill" data-service-status-pill></span>
            <strong data-service-status-label></strong>
            <span data-service-status-detail></span>
            <small data-service-hours></small>
          </div>
        </header>

        <div class="rs-service-note" data-service-note hidden></div>

        <div class="rs-layout">
          <main class="rs-menu-column">
            <section class="rs-search-panel" aria-label="Busca e categorias do cardapio">
              <label class="rs-search-field">
                <span class="sr-only">Pesquisar no cardapio</span>
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"/></svg>
                <input data-search type="search" autocomplete="off" placeholder="Pesquisar pratos, bebidas ou descricoes">
              </label>
              <nav class="rs-category-nav" data-category-nav aria-label="Categorias do cardapio"></nav>
            </section>

            <section class="rs-catalog" data-catalog aria-live="polite"></section>
          </main>

          <aside class="rs-cart-panel" data-cart-panel aria-label="Resumo do pedido">
            <div class="rs-cart-header">
              <div>
                <p class="rs-kicker">Seu pedido</p>
                <h3>Resumo</h3>
              </div>
              <button class="rs-icon-button rs-cart-close" type="button" data-cart-close aria-label="Fechar pedido">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
              </button>
            </div>

            <div class="rs-cart-items" data-cart-items></div>

            <div class="rs-cart-total">
              <span data-cart-count>0 itens</span>
              <strong data-cart-total>${formatMoney(0, "BRL")}</strong>
            </div>

            <form class="rs-order-form" data-order-form>
              <label class="rs-field">
                <span>Nome</span>
                <input name="guest_name" autocomplete="name" maxlength="120" required>
              </label>
              <label class="rs-field">
                <span>Celular / WhatsApp <em>(opcional)</em></span>
                <input name="guest_phone" autocomplete="tel" inputmode="tel" maxlength="40">
              </label>
              <label class="rs-field">
                <span>Acomodacao</span>
                <input name="room_code" autocomplete="off" maxlength="24" placeholder="Ex: D-101" required>
              </label>
              <label class="rs-field">
                <span>Local de entrega</span>
                <select name="delivery_location">
                  <option value="Acomodacao">Entrega na acomodacao</option>
                  <option value="Recepcao">Consumo na recepcao</option>
                </select>
              </label>
              <label class="rs-field">
                <span>Observacoes</span>
                <textarea name="notes" rows="3" maxlength="500" placeholder="Alguma observacao para a equipe?"></textarea>
              </label>
              <button class="rs-primary-button" type="submit" data-submit-order>Finalizar pedido</button>
              <p class="rs-form-status" data-form-status aria-live="polite" hidden></p>
            </form>
          </aside>
        </div>
      </section>

      <button class="rs-mobile-cart" type="button" data-cart-open>
        <span data-mobile-cart-count>0 itens</span>
        <strong data-mobile-cart-total>${formatMoney(0, "BRL")}</strong>
        <span>Ver pedido</span>
      </button>

      <div class="rs-backdrop" data-cart-backdrop hidden></div>

      <div class="rs-toast" data-toast hidden role="status" aria-live="polite"></div>

      <section class="rs-modal" data-modal hidden role="dialog" aria-modal="true" aria-labelledby="rs-modal-title">
        <div class="rs-modal-card" data-modal-card>
          <div class="rs-success-mark" data-modal-success hidden aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
          </div>
          <h3 id="rs-modal-title" data-modal-title></h3>
          <p data-modal-text></p>
          <button class="rs-primary-button" type="button" data-modal-close>OK</button>
        </div>
      </section>
    </section>
  `;
}

function bindStaticActions(container, state) {
  container.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-item]");
    if (addButton) {
      addItem(container, state, addButton.dataset.addItem);
      return;
    }

    const quantityButton = event.target.closest("[data-quantity-action]");
    if (quantityButton) {
      state.cart.change(quantityButton.dataset.itemId, Number(quantityButton.dataset.quantityAction));
      renderCart(container, state);
      return;
    }

    const removeButton = event.target.closest("[data-remove-item]");
    if (removeButton) {
      state.cart.remove(removeButton.dataset.removeItem);
      renderCart(container, state);
      return;
    }

    const categoryButton = event.target.closest("[data-category]");
    if (categoryButton) {
      state.activeCategory = categoryButton.dataset.category;
      renderCatalog(container, state);
      scrollCategoryIntoView(container, state.activeCategory);
      return;
    }

    if (event.target.closest("[data-cart-open]")) {
      toggleCart(container, state, true);
      return;
    }

    if (event.target.closest("[data-cart-close]") || event.target.closest("[data-cart-backdrop]")) {
      toggleCart(container, state, false);
      return;
    }

    if (event.target.closest("[data-modal-close]")) {
      closeModal(container);
    }
  });

  container.querySelector("[data-search]").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderCatalog(container, state);
    setupCategoryObserver(container, state);
  });

  container.querySelector("[data-order-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitOrder(container, state, event.currentTarget);
  });

  container.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!container.querySelector("[data-modal]").hidden) closeModal(container);
    else toggleCart(container, state, false);
  });
}

function renderHotelHeader(container, state) {
  const logoUrl = sanitizeAssetPath(state.bootstrap.branding?.logo_url);
  const logoTargets = container.querySelectorAll("[data-hotel-logo], [data-hotel-logo-shell]");
  logoTargets.forEach((target) => {
    target.textContent = "";
    if (logoUrl) {
      const image = document.createElement("img");
      image.src = logoUrl;
      image.alt = "";
      image.loading = "lazy";
      target.append(image);
    } else {
      target.setAttribute("aria-hidden", "true");
    }
  });
  setText(container, "[data-hotel-name]", state.bootstrap.name);
  setText(
    container,
    "[data-hotel-intro]",
    `Utilize este portal para solicitar itens do Room Service com comodidade. Em caso de duvidas, fale com a recepcao.`,
  );
}

function updateServiceStatus(container, state) {
  const hours = state.bootstrap.service_hours?.[MODULE_KEY] || [];
  state.status = evaluateServiceStatus({
    serviceHours: hours,
    timezone: state.bootstrap.timezone,
    now: new Date(),
  });
  const description = describeServiceStatus(state.status);
  const pill = container.querySelector("[data-service-status-pill]");
  pill.textContent = state.status.open ? "Aberto" : "Fechado";
  pill.classList.toggle("closed", !state.status.open);
  setText(container, "[data-service-status-label]", description.label);
  setText(container, "[data-service-status-detail]", description.detail);
  setText(container, "[data-service-hours]", state.status.today_text);
  const note = container.querySelector("[data-service-note]");
  if (state.status.open) {
    note.hidden = true;
    note.textContent = "";
  } else {
    note.hidden = false;
    note.textContent = `${description.detail} Voce ainda pode consultar o cardapio.`;
  }
}

function renderLoading(container, message) {
  setText(container, "[data-rs-loader] h2", "Seja bem-vindo");
  const shell = container.querySelector("[data-rs-shell]");
  const loader = container.querySelector("[data-rs-loader]");
  shell.hidden = true;
  loader.hidden = false;
  const catalog = container.querySelector("[data-catalog]");
  if (catalog) {
    catalog.innerHTML = "";
    const card = document.createElement("div");
    card.className = "rs-state-card";
    card.textContent = message;
    catalog.append(card);
  }
}

function renderCatalogError(container, error) {
  container.querySelector("[data-rs-loader]").hidden = true;
  container.querySelector("[data-rs-shell]").hidden = false;
  const catalog = container.querySelector("[data-catalog]");
  catalog.innerHTML = "";
  const card = document.createElement("div");
  card.className = "rs-state-card error";
  const title = document.createElement("h3");
  title.textContent = "Nao foi possivel carregar o cardapio";
  const text = document.createElement("p");
  text.textContent = error.message || "Tente novamente em instantes.";
  card.append(title, text);
  catalog.append(card);
}

function renderCatalog(container, state) {
  container.querySelector("[data-rs-loader]").hidden = true;
  container.querySelector("[data-rs-shell]").hidden = false;
  renderCategoryNavigation(container, state);

  const catalog = container.querySelector("[data-catalog]");
  catalog.innerHTML = "";
  const categories = filterCatalog(state.catalog.categories, {
    query: state.query,
    categoryId: state.activeCategory,
  });

  if (!categories.length) {
    const card = document.createElement("div");
    card.className = "rs-state-card";
    const title = document.createElement("h3");
    title.textContent = "Nenhum item encontrado";
    const text = document.createElement("p");
    text.textContent = "Tente outra busca ou escolha outra categoria.";
    card.append(title, text);
    catalog.append(card);
    return;
  }

  categories.forEach((category) => {
    const section = document.createElement("section");
    section.className = "rs-category-section";
    section.dataset.categorySection = category.id;

    const heading = document.createElement("h3");
    heading.className = "rs-category-title";
    heading.textContent = category.name;
    section.append(heading);

    const grid = document.createElement("div");
    grid.className = "rs-product-grid";
    category.items.forEach((item) => grid.append(renderProductCard(item, state)));
    section.append(grid);
    catalog.append(section);
  });
}

function renderCategoryNavigation(container, state) {
  const nav = container.querySelector("[data-category-nav]");
  nav.innerHTML = "";
  const buttons = [{ id: "all", name: "Todos" }, ...(state.catalog.categories || [])];
  buttons.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rs-category-button";
    button.dataset.category = category.id;
    button.textContent = category.name;
    button.classList.toggle("active", state.activeCategory === category.id);
    nav.append(button);
  });
}

function renderProductCard(item, state) {
  const card = document.createElement("article");
  card.className = "rs-product-card";
  card.classList.toggle("unavailable", item.available === false);

  const media = document.createElement("div");
  media.className = "rs-product-media";
  if (item.image_url) {
    const image = document.createElement("img");
    image.src = item.image_url;
    image.alt = item.image_alt || item.name;
    image.loading = "lazy";
    media.append(image);
  } else {
    media.textContent = (item.name || "R").slice(0, 1).toUpperCase();
  }

  const content = document.createElement("div");
  content.className = "rs-product-content";

  const label = document.createElement("span");
  label.className = "rs-product-label";
  label.textContent = item.available === false ? item.availability_label || "Indisponivel" : item.category_name || "Item";

  const title = document.createElement("h4");
  title.textContent = item.name;

  const description = document.createElement("p");
  description.textContent = item.description || "Item do cardapio.";

  const footer = document.createElement("div");
  footer.className = "rs-product-footer";
  const price = document.createElement("strong");
  price.textContent = formatMoney(item.price_cents, item.currency, state.bootstrap.locale);
  const button = document.createElement("button");
  button.className = "rs-add-button";
  button.type = "button";
  button.dataset.addItem = item.id;
  button.disabled = item.available === false;
  button.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>${
    item.available === false ? "Indisponivel" : "Adicionar"
  }</span>`;
  footer.append(price, button);

  content.append(label, title, description, footer);
  card.append(media, content);
  return card;
}

function addItem(container, state, itemId) {
  try {
    state.cart.add(itemId);
    renderCart(container, state);
    showToast(container, "Item adicionado ao pedido");
    if (window.matchMedia("(max-width: 859px)").matches) toggleCart(container, state, true);
  } catch (error) {
    showModal(container, "Item indisponivel", error.message);
  }
}

function renderCart(container, state) {
  const snapshot = state.cart?.snapshot() || { items: [], total_cents: 0, total_quantity: 0 };
  const list = container.querySelector("[data-cart-items]");
  list.innerHTML = "";

  if (!snapshot.items.length) {
    const empty = document.createElement("div");
    empty.className = "rs-empty-cart";
    empty.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3h2l.5 3M7 13h10l3-7H5.5M7 13l-2 3h13M9 19a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm9 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>`;
    const text = document.createElement("p");
    text.textContent = "Carrinho vazio";
    empty.append(text);
    list.append(empty);
  } else {
    snapshot.items.forEach((item) => list.append(renderCartItem(item, state)));
  }

  const countLabel = `${snapshot.total_quantity} ${snapshot.total_quantity === 1 ? "item" : "itens"}`;
  const totalLabel = formatMoney(snapshot.total_cents, state.bootstrap.currency, state.bootstrap.locale);
  setText(container, "[data-cart-count]", countLabel);
  setText(container, "[data-cart-total]", totalLabel);
  setText(container, "[data-mobile-cart-count]", countLabel);
  setText(container, "[data-mobile-cart-total]", totalLabel);
  container.querySelector("[data-mobile-cart-count]").classList.add("pulse");
  window.setTimeout(() => container.querySelector("[data-mobile-cart-count]")?.classList.remove("pulse"), 350);
}

function renderCartItem(item, state) {
  const row = document.createElement("article");
  row.className = "rs-cart-row";

  const info = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = item.name;
  const price = document.createElement("span");
  price.textContent = formatMoney(item.line_total_cents, item.currency, state.bootstrap.locale);
  info.append(title, price);

  const controls = document.createElement("div");
  controls.className = "rs-qty-controls";
  controls.append(
    quantityButton(item.id, -1, "Diminuir"),
    quantityValue(item.quantity),
    quantityButton(item.id, 1, "Aumentar"),
    removeButton(item.id),
  );

  row.append(info, controls);
  return row;
}

function quantityButton(itemId, delta, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.itemId = itemId;
  button.dataset.quantityAction = String(delta);
  button.setAttribute("aria-label", `${label} quantidade`);
  button.textContent = delta > 0 ? "+" : "-";
  return button;
}

function quantityValue(quantity) {
  const value = document.createElement("span");
  value.className = "rs-qty-value";
  value.textContent = String(quantity);
  return value;
}

function removeButton(itemId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rs-remove-button";
  button.dataset.removeItem = itemId;
  button.setAttribute("aria-label", "Remover item");
  button.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 7h12M9 7V5h6v2m-7 3 1 9h6l1-9"/></svg>`;
  return button;
}

async function submitOrder(container, state, form) {
  if (state.isSubmitting) return;
  updateServiceStatus(container, state);
  if (!state.status?.open) {
    showModal(container, "Room Service fechado no momento", describeServiceStatus(state.status).detail);
    return;
  }

  const snapshot = state.cart.snapshot();
  if (!snapshot.items.length) {
    showModal(container, "Resumo vazio", "Adicione itens ao pedido antes de finalizar.");
    return;
  }

  const data = new FormData(form);
  const guestName = String(data.get("guest_name") || "").trim();
  const roomCode = String(data.get("room_code") || "").trim();
  if (!guestName) {
    showModal(container, "Campo obrigatorio", "Por gentileza, informe seu nome.");
    form.elements.guest_name.focus();
    return;
  }
  if (!roomCode) {
    showModal(container, "Acomodacao obrigatoria", "Por gentileza, informe sua acomodacao.");
    form.elements.room_code.focus();
    return;
  }

  const submit = container.querySelector("[data-submit-order]");
  const status = container.querySelector("[data-form-status]");
  state.isSubmitting = true;
  submit.disabled = true;
  status.hidden = false;
  status.classList.remove("error");
  status.textContent = "Enviando seu pedido...";
  state.orderAttemptKey ||= createOrderAttemptKey();

  try {
    const order = await apiPost(
      `/api/v1/public/hotels/${encodeURIComponent(state.slug)}/room-service/orders`,
      {
        guest_name: guestName,
        room_code: roomCode,
        notes: buildNotes(data),
        origin: "public-web",
        subtotal_cents: snapshot.total_cents,
        total_cents: snapshot.total_cents,
        items: snapshot.items.map((item) => ({
          catalog_item_id: item.id,
          quantity: item.quantity,
          unit_price_cents: item.price_cents,
          total_cents: item.line_total_cents,
        })),
      },
      { idempotencyKey: state.orderAttemptKey },
    );
    state.cart.clear();
    state.orderAttemptKey = null;
    form.reset();
    renderCart(container, state);
    toggleCart(container, state, false);
    showModal(
      container,
      "Pedido confirmado!",
      `Recebemos seu pedido ${order.public_id || ""}. Total confirmado: ${formatMoney(order.total_cents, order.currency, state.bootstrap.locale)}.`,
      { success: true },
    );
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
    showModal(container, "Nao foi possivel enviar", error.message);
  } finally {
    state.isSubmitting = false;
    submit.disabled = false;
  }
}

function buildNotes(data) {
  const lines = [];
  const location = String(data.get("delivery_location") || "").trim();
  const phone = String(data.get("guest_phone") || "").trim();
  const notes = String(data.get("notes") || "").trim();
  if (location) lines.push(`Local de entrega: ${location}`);
  if (phone) lines.push(`Contato: ${phone}`);
  if (notes) lines.push(notes);
  return lines.join("\n").slice(0, 500);
}

function toggleCart(container, state, open) {
  state.cartOpen = open;
  container.querySelector("[data-cart-panel]").classList.toggle("open", open);
  container.querySelector("[data-cart-backdrop]").hidden = !open;
  if (open) container.querySelector("[data-order-form] input")?.focus();
}

function showToast(container, message) {
  const toast = container.querySelector("[data-toast]");
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2400);
}

function showModal(container, title, text, { success = false } = {}) {
  const modal = container.querySelector("[data-modal]");
  const card = container.querySelector("[data-modal-card]");
  const successMark = container.querySelector("[data-modal-success]");
  setText(container, "[data-modal-title]", title);
  setText(container, "[data-modal-text]", text);
  card.classList.toggle("success", success);
  successMark.hidden = !success;
  modal.hidden = false;
  container.querySelector("[data-modal-close]").focus();
}

function closeModal(container) {
  container.querySelector("[data-modal]").hidden = true;
}

function setupCategoryObserver(container, state) {
  if (state.observer) state.observer.disconnect();
  if (!("IntersectionObserver" in window)) return;
  const sections = container.querySelectorAll("[data-category-section]");
  state.observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible || state.activeCategory !== "all") return;
      container.querySelectorAll("[data-category]").forEach((button) => {
        button.classList.toggle("active", button.dataset.category === visible.target.dataset.categorySection);
      });
    },
    { rootMargin: "-20% 0px -65% 0px", threshold: [0.1, 0.35, 0.6] },
  );
  sections.forEach((section) => state.observer.observe(section));
}

function scrollCategoryIntoView(container, categoryId) {
  if (categoryId === "all") return;
  const target = container.querySelector(`[data-category-section="${cssEscape(categoryId)}"]`);
  target?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setText(container, selector, value) {
  const target = container.querySelector(selector);
  if (target) target.textContent = value || "";
}

function sanitizeAssetPath(path) {
  const value = String(path || "").trim();
  if (value.startsWith("/assets/")) return value;
  return null;
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

async function loadCss(path) {
  if (document.querySelector(`link[href="${path}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = path;
  document.head.appendChild(link);
}

export const internalsForTests = {
  buildNotes,
  renderStaticShell,
  sanitizeAssetPath,
  escapeHtml,
};
