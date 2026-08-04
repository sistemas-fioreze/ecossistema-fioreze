import { apiGet, apiPost } from "../../core/api.js";
import { escapeHtml } from "../../core/errors.js";
import { createCartStore, createOrderAttemptKey } from "./cart.js";
import { filterCatalog, flattenCatalog, formatMoney, getCatalogItemMap, normalizeText } from "./catalog.js";
import { describeServiceStatus, evaluateServiceStatus } from "./service-status.js";
import { applyBranding, sanitizePublicAssetUrl } from "../../core/theme.js";
import {
  bindCatalogMediaViewer,
  renderCatalogMediaViewer,
  renderZoomableCatalogMedia,
} from "../shared/catalog-media-viewer.js";

const MODULE_KEY = "room-service";
let cleanupCurrentRender = () => {};

export async function render(container, context) {
  cleanupCurrentRender();
  await loadCss("/css/modules/room-service/room-service.css");
  await loadCss("/css/modules/shared/catalog-detail.css");
  const embedded = context.presentation === "portal-page";
  const requestedSlug = context.bootstrap?.slug || context.hotelSlug;

  const state = {
    bootstrap: context.bootstrap || {
      hotel_id: requestedSlug,
      slug: requestedSlug,
      name: "",
      branding: {},
      settings: {},
      service_hours: {},
    },
    slug: requestedSlug,
    catalog: { categories: [] },
    rooms: [],
    itemMap: new Map(),
    cart: null,
    query: "",
    activeCategory: "all",
    status: null,
    orderAttemptKey: null,
    isSubmitting: false,
    cartOpen: false,
    statusTimer: null,
    recentStatusTimer: null,
    selectedProductId: null,
    selectedProductQuantity: 1,
    selectedProductNote: "",
    selectedProductOptions: {},
  };

  container.innerHTML = renderStaticShell({ embedded });
  bindStaticActions(container, state);
  const cleanupStickyCatalog = bindStickyCatalogHeader(container);
  const cleanupMediaViewer = bindCatalogMediaViewer(container);
  const headerSearch = (event) => {
    state.query = event.detail?.query || "";
    const field = container.querySelector("[data-search]");
    if (field) field.value = state.query;
    renderCatalog(container, state);
  };
  window.addEventListener("fioreze:portal-search", headerSearch);
  if (context.bootstrap) renderHotelHeader(container, state);

  try {
    const [bootstrap, products, roomPayload] = await Promise.all([
      context.bootstrap
        ? Promise.resolve(context.bootstrap)
        : apiGet(`/api/v1/public/hotels/${encodeURIComponent(requestedSlug)}/bootstrap`),
      apiGet(`/api/v1/public/hotels/${encodeURIComponent(requestedSlug)}/room-service/products`),
      apiGet(`/api/v1/public/hotels/${encodeURIComponent(requestedSlug)}/room-service/rooms`),
    ]);
    if (!bootstrap.modules?.some((module) => module.module_key === MODULE_KEY)) {
      throw new Error("O Room Service não está disponível nesta unidade.");
    }
    state.bootstrap = bootstrap;
    state.slug = bootstrap.slug;
    applyBranding(bootstrap.branding);
    renderHotelHeader(container, state);
    state.catalog = products;
    state.rooms = roomPayload.rooms || [];
    const items = flattenCatalog(products.categories);
    state.itemMap = getCatalogItemMap(products.categories);
    state.cart = createCartStore({
      hotelId: state.bootstrap.hotel_id,
      moduleKey: MODULE_KEY,
      catalogItems: items,
    });
    state.cart.hydrate(items);
    syncOrderPreferenceFields(container, state);
    updateServiceStatus(container, state);
    state.statusTimer = window.setInterval(() => updateServiceStatus(container, state), 60000);
    renderCatalog(container, state);
    renderRoomOptions(container, state);
    renderCart(container, state);
    await refreshRecentOrders(container, state);
    state.recentStatusTimer = window.setInterval(() => refreshRecentOrders(container, state), 30000);
  } catch (error) {
    renderCatalogError(container, error);
  }

  cleanupCurrentRender = () => {
    cleanupMediaViewer();
    cleanupStickyCatalog();
    document.body.classList.remove("catalog-detail-open");
    window.removeEventListener("fioreze:portal-search", headerSearch);
    if (state.statusTimer) window.clearInterval(state.statusTimer);
    if (state.recentStatusTimer) window.clearInterval(state.recentStatusTimer);
  };
}

function renderStaticShell({ embedded = false } = {}) {
  return `
    <section class="rs-app${embedded ? " is-portal-page" : ""}" data-rs-app>
      <section class="rs-shell" data-rs-shell>
        <div class="rs-layout">
          <aside class="rs-order-column">
            <section class="rs-recent-orders" data-recent-orders hidden aria-live="polite"></section>
            <div class="rs-service-note" data-service-note hidden></div>

            <section class="rs-cart-panel" data-cart-panel aria-label="Resumo do pedido">
              <form class="rs-order-form" data-order-form>
                <label class="rs-icon-field">
                  <span class="sr-only">Nome</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21a7 7 0 0 1 14 0"/></svg>
                  <input name="guest_name" autocomplete="name" maxlength="120" placeholder="Nome" required>
                </label>
                <label class="rs-icon-field">
                  <span class="sr-only">Celular ou WhatsApp opcional</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 5a2 2 0 0 1 2-2h3.28a1 1 0 0 1 .95.68l1.5 4.5a1 1 0 0 1-.5 1.2l-2.26 1.14a11 11 0 0 0 5.51 5.51l1.14-2.26a1 1 0 0 1 1.2-.5l4.5 1.5a1 1 0 0 1 .68.95V19a2 2 0 0 1-2 2h-1C9.72 21 3 14.28 3 6Z"/></svg>
                  <input name="guest_phone" autocomplete="tel" inputmode="tel" maxlength="40" placeholder="Celular / WhatsApp (Opcional)">
                </label>
                <label class="rs-icon-field">
                  <span class="sr-only">Número da acomodação</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/></svg>
                  <input name="room_code" list="rs-room-options" autocomplete="off" maxlength="40" placeholder="Número da acomodação" required>
                  <datalist id="rs-room-options" data-room-options></datalist>
                </label>
                <label class="rs-icon-field rs-textarea-field" data-order-note-field>
                  <span class="sr-only">Observação do pedido</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 8h10M7 12h6M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4Z"/></svg>
                  <textarea name="notes" rows="3" maxlength="500" placeholder="Observação do pedido (opcional)"></textarea>
                </label>
                <label class="rs-icon-field">
                  <span class="sr-only">Local de entrega</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  <select name="delivery_location">
                    <option value="Acomodação">Entrega na Acomodação</option>
                    <option value="Recepção">Consumo na Recepção</option>
                  </select>
                </label>

                <h2 class="rs-order-title">
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4Z"/></svg>
                  Resumo do Pedido
                </h2>

                <div class="rs-cart-items" data-cart-items></div>

                <div class="rs-cart-summary">
                  <div class="rs-cart-total-row">
                    <strong>Total</strong>
                    <span data-cart-count>0 itens</span>
                  </div>
                  <strong class="rs-cart-value" data-cart-total>${formatMoney(0, "BRL")}</strong>
                  <button class="rs-primary-button" type="submit" data-submit-order disabled aria-disabled="true">
                    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>
                    <span data-submit-label>Finalizar Pedido</span>
                  </button>
                  <p class="rs-form-status" data-form-status aria-live="polite" hidden></p>
                </div>
                <section class="rs-order-review" data-order-review hidden></section>
              </form>
            </section>
          </aside>

          <section class="rs-menu-column">
            <span class="rs-category-sentinel" data-category-sentinel aria-hidden="true"></span>
            <section class="rs-search-panel" aria-label="Busca e categorias do cardápio">
              <label class="rs-search-field">
                <span class="sr-only">Pesquisar no cardápio</span>
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"/></svg>
                <input data-search type="search" autocomplete="off" placeholder="Pesquisar pratos, bebidas ou descrições...">
              </label>
              <nav class="rs-category-nav" data-category-nav aria-label="Categorias do cardápio"></nav>
            </section>

            <section class="rs-catalog" data-catalog aria-live="polite"></section>
          </section>
        </div>
      </section>

      <div class="rs-toast" data-toast hidden role="status" aria-live="polite">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>
        <span data-toast-text>Notificação</span>
      </div>

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

      <section class="rs-product-detail catalog-detail-layer" data-rs-product-detail hidden role="dialog" aria-modal="true" aria-labelledby="rs-product-detail-title">
        <article class="rs-product-detail-card catalog-detail-surface" data-rs-product-detail-card></article>
      </section>
      ${renderCatalogMediaViewer()}

      <section class="rs-submit-overlay" data-submit-overlay hidden aria-live="polite">
        <div>
          <span aria-hidden="true"></span>
          <strong>Enviando seu pedido...</strong>
        </div>
      </section>
    </section>
  `;
}

function bindStaticActions(container, state) {
  container.addEventListener("click", (event) => {
    const detailQuantityButton = event.target.closest("[data-rs-detail-quantity-action]");
    if (detailQuantityButton) {
      state.selectedProductNote = readDetailNote(container);
      state.selectedProductOptions = readDetailOptions(container);
      state.selectedProductQuantity = clampDetailQuantity(
        state.selectedProductQuantity + Number(detailQuantityButton.dataset.rsDetailQuantityAction),
      );
      renderProductDetail(container, state);
      return;
    }

    const detailAddButton = event.target.closest("[data-rs-detail-add]");
    if (detailAddButton) {
      addConfiguredItem(container, state);
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

    const productCard = event.target.closest("[data-rs-product]");
    if (productCard) {
      openProductDetail(container, state, productCard.dataset.rsProduct);
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
      return;
    }

    if (event.target.closest("[data-review-back]")) {
      closeOrderReview(container);
      return;
    }

    const preparationOption = event.target.closest("[data-preparation-option]");
    if (preparationOption) {
      selectPreparationOption(container, preparationOption.dataset.preparationOption);
      return;
    }

    if (event.target.closest("[data-rs-product-detail-close]")) {
      closeProductDetail(container, state);
    }
  });

  container.querySelector("[data-search]").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderCatalog(container, state);
  });

  container.querySelector("[data-order-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitOrder(container, state, event.currentTarget);
  });

  container.addEventListener("keydown", (event) => {
    const productCard = event.target.closest("[data-rs-product]");
    if (productCard && !event.target.closest("button, input, select, textarea, a") && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      openProductDetail(container, state, productCard.dataset.rsProduct);
      return;
    }
    if (event.key !== "Escape") return;
    if (event.target.closest("[data-catalog-media-viewer]")) return;
    if (state.selectedProductId) closeProductDetail(container, state);
    else if (!container.querySelector("[data-modal]").hidden) closeModal(container);
    else toggleCart(container, state, false);
  });
}

function bindStickyCatalogHeader(container) {
  const panel = container.querySelector(".rs-search-panel");
  const sentinel = container.querySelector("[data-category-sentinel]");
  if (!panel || !sentinel) return () => {};
  const sync = () => {
    const mobile = window.matchMedia("(max-width: 959px)").matches;
    const top = container.closest(".public-module-root") ? 72 : 0;
    panel.classList.toggle("is-stuck", mobile && sentinel.getBoundingClientRect().top <= top);
  };
  window.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  sync();
  return () => {
    window.removeEventListener("scroll", sync);
    window.removeEventListener("resize", sync);
  };
}

function renderHotelHeader(container, state) {
  const branding = state.bootstrap.branding || {};
  const logoUrl = sanitizeAssetPath(
    branding.room_service_logo_url || branding.horizontal_logo_url || branding.logo_url,
  );
  const iconUrl = sanitizeAssetPath(branding.icon_url || logoUrl);
  const logoTargets = container.querySelectorAll("[data-hotel-logo], [data-hotel-logo-shell]");
  logoTargets.forEach((target) => {
    renderLogo(target, logoUrl, state.bootstrap.name, "lazy");
  });
  container.querySelectorAll("[data-hotel-icon]").forEach((target) => renderLogo(target, iconUrl, state.bootstrap.name, "eager"));
  setText(container, "[data-hotel-name]", state.bootstrap.name);
  const settings = state.bootstrap.settings || {};
  setText(container, "[data-hotel-welcome]", settings["room-service.welcome_text"] || `Seja bem-vindo ao Room Service digital do ${state.bootstrap.name}.`);
  setText(container, "[data-hotel-guidance]", settings["room-service.guidance_text"] || "Utilize este portal para solicitar suas refeições com comodidade.");
  setText(container, "[data-hotel-support]", settings["room-service.support_text"] || "Em caso de dúvidas, fale com a recepção.");
}

function syncOrderPreferenceFields(container, state) {
  const notesEnabled = orderNotesEnabled(state);
  const field = container.querySelector("[data-order-note-field]");
  if (field) field.hidden = !notesEnabled;
  if (!notesEnabled && field?.querySelector("textarea")) field.querySelector("textarea").value = "";
}

function orderNotesEnabled(state) {
  return state.bootstrap?.settings?.[`${MODULE_KEY}.order_notes_enabled`] !== false;
}

function orderSchedulingEnabled(state) {
  return state.bootstrap?.settings?.[`${MODULE_KEY}.order_scheduling_enabled`] === true;
}

function renderLogo(target, url, hotelName, loading) {
  target.textContent = "";
  if (!url) {
    target.hidden = true;
    return;
  }
  target.hidden = false;
  const image = document.createElement("img");
  image.src = url;
  image.alt = hotelName || "Hotel";
  image.loading = loading;
  image.decoding = "async";
  target.append(image);
}

function updateServiceStatus(container, state, now = new Date()) {
  const hours = state.bootstrap.service_hours?.[MODULE_KEY] || [];
  state.status = evaluateServiceStatus({
    serviceHours: hours,
    timezone: state.bootstrap.timezone,
    operationMode: state.bootstrap.settings?.[`${MODULE_KEY}.operation_mode`] || "automatic",
    now,
  });
  const description = describeServiceStatus(state.status);
  const pill = container.querySelector("[data-service-status-pill]");
  if (pill) {
    pill.textContent = state.status.open ? "Aberto" : "Fechado";
    pill.classList.toggle("closed", !state.status.open);
  }
  setText(container, "[data-service-status-label]", description.label);
  setText(container, "[data-service-status-detail]", description.detail);
  setText(container, "[data-service-hours]", state.status.today_text);
  const note = container.querySelector("[data-service-note]");
  if (state.status.open) {
    note.hidden = true;
    note.textContent = "";
  } else {
    note.hidden = false;
    note.textContent = "Room service fechado no momento";
  }
  syncSubmitButton(container, state);
}

function renderRoomOptions(container, state) {
  const list = container.querySelector("[data-room-options]");
  if (!list) return;
  list.replaceChildren();
  for (const room of state.rooms) {
    const option = document.createElement("option");
    option.value = room.code;
    option.label = room.label ? `${room.code} - ${room.label}` : room.code;
    list.append(option);
  }
}

function syncSubmitButton(container, state) {
  const button = container.querySelector("[data-submit-order]");
  if (!button) return;

  const closed = !state.status?.open;
  const schedulingAvailable = canScheduleToday(state);
  const disabled = Boolean(state.isSubmitting || (closed && !schedulingAvailable));
  const label = state.isSubmitting
    ? "Enviando pedido..."
    : closed && schedulingAvailable
    ? "Programar pedido"
    : closed
    ? "Room Service fechado"
    : "Finalizar Pedido";

  button.disabled = disabled;
  const labelTarget = button.querySelector?.("[data-submit-label]");
  if (labelTarget) labelTarget.textContent = label;
  else button.textContent = label;
  button.setAttribute("aria-disabled", String(disabled));
  button.classList.toggle("is-closed", closed && !schedulingAvailable && !state.isSubmitting);
  button.classList.toggle("is-submitting", Boolean(state.isSubmitting));

  if (state.isSubmitting) {
    button.setAttribute("aria-label", "Enviando pedido...");
    button.removeAttribute("title");
  } else if (closed && !schedulingAvailable) {
    const detail = state.status ? describeServiceStatus(state.status).detail : "Pedidos indisponiveis no momento.";
    button.setAttribute("aria-label", `Room Service fechado. ${detail}`);
    button.setAttribute("title", detail);
  } else {
    button.setAttribute("aria-label", closed ? "Programar pedido para hoje" : "Finalizar pedido");
    button.removeAttribute("title");
  }
}

function canScheduleToday(state) {
  if (!orderSchedulingEnabled(state) || !state.status || state.status.mode === "forced_closed") return false;
  const nowMinutes = state.status.local.hour * 60 + state.status.local.minute;
  return (state.status.today_slots || []).some((slot) => {
    const [hour, minute] = String(slot.closes_at || "00:00").split(":").map(Number);
    return hour * 60 + minute > nowMinutes;
  });
}

function renderCatalogError(container, error) {
  const catalog = container.querySelector("[data-catalog]");
  catalog.innerHTML = "";
  const card = document.createElement("div");
  card.className = "rs-state-card error";
  const title = document.createElement("h3");
  title.textContent = "Não foi possível carregar o cardápio";
  const text = document.createElement("p");
  text.textContent = error.message || "Tente novamente em instantes.";
  card.append(title, text);
  catalog.append(card);
  const button = container.querySelector("[data-submit-order]");
  if (button) {
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("aria-label", "Pedidos indisponíveis");
    setText(container, "[data-submit-label]", "Pedidos indisponíveis");
  }
}

function renderCatalog(container, state) {
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
    text.textContent = "Tente outra busca ou troque o filtro selecionado.";
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
    grid.classList.toggle("is-drinks", normalizeText(category.name).includes("bebida"));
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
  card.dataset.rsProduct = item.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Ver detalhes de ${item.name}`);
  card.classList.toggle("unavailable", item.available === false);

  if (item.image_url) {
    const media = document.createElement("span");
    media.className = "rs-product-media";
    const image = document.createElement("img");
    image.src = item.image_url;
    image.alt = item.image_alt || item.name;
    image.loading = "lazy";
    media.append(image);
    card.append(media);
  }

  const content = document.createElement("div");
  content.className = "rs-product-content";

  const label = document.createElement("span");
  label.className = "rs-product-label";
  label.textContent = item.available === false ? item.availability_label || "Indisponível" : item.tag || item.category_name || "Item";

  const title = document.createElement("h4");
  title.textContent = item.name;

  const descriptionParts = splitProductDescription(item.description);
  const meta = document.createElement("p");
  meta.className = "rs-product-meta";
  meta.textContent = descriptionParts.meta;
  meta.hidden = !descriptionParts.meta;

  const description = document.createElement("p");
  description.className = "rs-product-description";
  description.textContent = descriptionParts.description || "Item do cardápio.";

  const footer = document.createElement("div");
  footer.className = "rs-product-footer";
  const price = document.createElement("strong");
  price.textContent = formatMoney(item.price_cents, item.currency, state.bootstrap.locale);
  footer.append(price);

  content.append(label, title, meta, description, footer);
  card.append(content);
  return card;
}

function openProductDetail(container, state, itemId) {
  const existing = state.cart?.snapshot().items.find((item) => item.id === itemId);
  state.selectedProductId = itemId;
  state.selectedProductQuantity = existing?.quantity || 1;
  state.selectedProductNote = existing?.note || "";
  state.selectedProductOptions = { ...(existing?.selected_options || {}) };
  renderProductDetail(container, state);
}

function renderProductDetail(container, state) {
  const layer = container.querySelector("[data-rs-product-detail]");
  if (!state.selectedProductId) {
    layer.hidden = true;
    document.body.classList.remove("catalog-detail-open");
    return;
  }
  const item = state.itemMap.get(state.selectedProductId);
  if (!item) {
    state.selectedProductId = null;
    layer.hidden = true;
    document.body.classList.remove("catalog-detail-open");
    return;
  }
  const image = sanitizePublicAssetUrl(item.image_url);
  const descriptionParts = splitProductDescription(item.description);
  const card = container.querySelector("[data-rs-product-detail-card]");
  card.innerHTML = `
    <button class="rs-product-detail-close catalog-detail-close" type="button" data-rs-product-detail-close aria-label="Fechar detalhes">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
    <div class="rs-product-detail-media catalog-detail-media">
      ${renderZoomableCatalogMedia({
        image,
        alt: item.image_alt || item.name,
        label: `Ampliar imagem de ${item.name}`,
        placeholder: '<span class="rs-product-detail-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 16l5-5 4 4 2-2 5 5M15 8h.01"/></svg></span>',
      })}
    </div>
    <div class="rs-product-detail-content catalog-detail-content">
      <p class="rs-product-detail-category">${escapeHtml(item.category_name || "Room Service")}</p>
      <h2 id="rs-product-detail-title">${escapeHtml(item.name)}</h2>
      ${item.tag ? `<span class="rs-product-detail-tag">${escapeHtml(item.tag)}</span>` : ""}
      <strong class="rs-product-detail-price">${escapeHtml(formatMoney(item.price_cents, item.currency, state.bootstrap.locale))}</strong>
      ${descriptionParts.meta ? `<p class="rs-product-detail-meta">${escapeHtml(descriptionParts.meta)}</p>` : ""}
      <p class="rs-product-detail-description">${escapeHtml(descriptionParts.description || "Item do cardápio.")}</p>
      ${renderProductOptions(item, state.selectedProductOptions)}
      ${orderNotesEnabled(state) ? `<label class="rs-product-detail-note">
        <span>Observação do item</span>
        <textarea data-rs-item-note maxlength="180" rows="3" placeholder="Ex.: sem cebola, ponto da carne ou outra preferência">${escapeHtml(state.selectedProductNote)}</textarea>
      </label>` : ""}
      ${item.available === false ? `<div class="rs-product-detail-availability" data-available="false">
        <span aria-hidden="true"></span>
        <strong>${escapeHtml(item.availability_label || "Indisponível no momento")}</strong>
      </div>` : ""}
      <div class="rs-product-detail-actions">
        <div class="rs-product-detail-quantity" aria-label="Quantidade do item">
          <button type="button" data-rs-detail-quantity-action="-1" aria-label="Diminuir quantidade" ${state.selectedProductQuantity <= 1 ? "disabled" : ""}>−</button>
          <strong data-rs-detail-quantity>${state.selectedProductQuantity}</strong>
          <button type="button" data-rs-detail-quantity-action="1" aria-label="Aumentar quantidade" ${state.selectedProductQuantity >= 20 ? "disabled" : ""}>+</button>
        </div>
        <button class="rs-add-button rs-product-detail-add" type="button" data-rs-detail-add ${item.available === false ? "disabled" : ""}>
          <span>${item.available === false ? "Indisponível" : `Adicionar · ${escapeHtml(formatMoney(item.price_cents * state.selectedProductQuantity, item.currency, state.bootstrap.locale))}`}</span>
        </button>
      </div>
    </div>`;
  layer.hidden = false;
  document.body.classList.add("catalog-detail-open");
  window.requestAnimationFrame(() => card.querySelector("[data-rs-product-detail-close]")?.focus({ preventScroll: true }));
}

function closeProductDetail(container, state) {
  state.selectedProductId = null;
  state.selectedProductQuantity = 1;
  state.selectedProductNote = "";
  state.selectedProductOptions = {};
  renderProductDetail(container, state);
}

function readDetailNote(container) {
  return String(container.querySelector("[data-rs-item-note]")?.value || "").trim().slice(0, 180);
}

function readDetailOptions(container) {
  return Object.fromEntries([...container.querySelectorAll("[data-rs-item-option]")]
    .map((field) => [field.dataset.rsItemOption, String(field.value || "").trim()])
    .filter(([, value]) => value));
}

function renderProductOptions(item, selectedOptions = {}) {
  return (item.options || []).map((option) => `
    <label class="rs-product-detail-option">
      <span>${escapeHtml(option.label)}</span>
      <select data-rs-item-option="${escapeHtml(option.key)}" ${option.required ? "required" : ""}>
        <option value="">Selecione</option>
        ${(option.values || []).map((value) => `<option value="${escapeHtml(value)}" ${selectedOptions[option.key] === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
      </select>
    </label>`).join("");
}

function clampDetailQuantity(value) {
  return Math.max(1, Math.min(20, Number.parseInt(value, 10) || 1));
}

function splitProductDescription(value) {
  const description = String(value || "").trim();
  if (!description) return { meta: "", description: "" };
  const lines = description.split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
  if (lines.length > 1) return { meta: lines[0], description: lines.slice(1).join(" ") };
  const parts = description.split(/\s*[•·]\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return { meta: parts[0], description: parts.slice(1).join(" • ") };
  return { meta: "", description };
}

function addConfiguredItem(container, state) {
  try {
    state.selectedProductNote = orderNotesEnabled(state) ? readDetailNote(container) : "";
    state.selectedProductOptions = readDetailOptions(container);
    const item = state.itemMap.get(state.selectedProductId);
    const missingOption = (item.options || []).find((option) => option.required && !state.selectedProductOptions[option.key]);
    if (missingOption) throw new Error(`${missingOption.label} é obrigatória.`);
    state.cart.set(state.selectedProductId, state.selectedProductQuantity, state.selectedProductNote, state.selectedProductOptions);
    renderCart(container, state);
    showToast(container, "Item adicionado ao pedido");
    closeProductDetail(container, state);
  } catch (error) {
    showModal(container, "Item indisponível", error.message);
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
  syncSubmitButton(container, state);
  const count = container.querySelector("[data-cart-count]");
  count?.classList.remove("pulse");
  window.requestAnimationFrame(() => count?.classList.add("pulse"));
  window.setTimeout(() => count?.classList.remove("pulse"), 350);
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
  if (item.note) {
    const note = document.createElement("small");
    note.className = "rs-cart-item-note";
    note.textContent = item.note;
    info.append(note);
  }
  Object.values(item.selected_options || {}).forEach((value) => {
    const option = document.createElement("small");
    option.className = "rs-cart-item-option";
    option.textContent = value;
    info.append(option);
  });

  const controls = document.createElement("div");
  controls.className = "rs-qty-controls";
  controls.append(
    quantityButton(item.id, -1, "Diminuir"),
    quantityValue(item.quantity),
    quantityButton(item.id, 1, "Aumentar"),
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

async function submitOrder(container, state, form) {
  if (state.isSubmitting) return;
  updateServiceStatus(container, state);
  if (!state.status?.open && !canScheduleToday(state)) {
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
    showModal(container, "Campo obrigatório", "Por gentileza, informe seu nome.");
    form.elements.guest_name.focus();
    return;
  }
  if (!roomCode) {
    showModal(container, "Acomodação obrigatória", "Por gentileza, informe sua acomodação.");
    form.elements.room_code.focus();
    return;
  }

  if (form.dataset.reviewing !== "true") {
    renderOrderReview(container, state, form, snapshot, data);
    return;
  }

  const preparationMode = form.querySelector("[name='preparation_mode']:checked")?.value || "now";
  let scheduledFor = null;
  if (preparationMode === "scheduled") {
    const scheduledTime = form.querySelector("[name='scheduled_time']")?.value || "";
    if (!scheduledTime) {
      showModal(container, "Escolha um horário", "Selecione o horário de entrega para hoje.");
      return;
    }
    scheduledFor = hotelLocalTimeToIso(scheduledTime, state.bootstrap.timezone);
  } else if (!state.status?.open) {
    showModal(container, "Escolha um horário", "O Room Service está fechado agora. Programe a entrega para hoje.");
    return;
  }

  const status = container.querySelector("[data-form-status]");
  state.isSubmitting = true;
  syncSubmitButton(container, state);
  container.querySelector("[data-submit-overlay]").hidden = false;
  status.hidden = false;
  status.classList.remove("error");
  status.textContent = "Enviando seu pedido...";
  state.orderAttemptKey ||= createOrderAttemptKey();

  try {
    const trackingKey = state.orderAttemptKey;
    const order = await apiPost(
      `/api/v1/public/hotels/${encodeURIComponent(state.slug)}/room-service/orders`,
      {
        guest_name: guestName,
        room_code: roomCode,
        notes: buildNotes(data, { notesEnabled: orderNotesEnabled(state) }),
        order_note: orderNotesEnabled(state) ? String(data.get("notes") || "").trim() : "",
        preparation_mode: preparationMode,
        scheduled_for: scheduledFor,
        origin: "public-web",
        subtotal_cents: snapshot.total_cents,
        total_cents: snapshot.total_cents,
        items: snapshot.items.map((item) => ({
          catalog_item_id: item.id,
          quantity: item.quantity,
          note: orderNotesEnabled(state) ? item.note : "",
          selected_options: item.selected_options || {},
          unit_price_cents: item.price_cents,
          total_cents: item.line_total_cents,
        })),
      },
      { idempotencyKey: state.orderAttemptKey },
    );
    rememberRecentOrder(state, order, trackingKey);
    state.cart.clear();
    state.orderAttemptKey = null;
    form.reset();
    closeOrderReview(container);
    renderCart(container, state);
    toggleCart(container, state, false);
    await refreshRecentOrders(container, state, { justSent: true });
    showToast(container, "Pedido enviado com sucesso");
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
    showModal(container, "Não foi possível enviar", error.message);
  } finally {
    state.isSubmitting = false;
    container.querySelector("[data-submit-overlay]").hidden = true;
    updateServiceStatus(container, state);
  }
}

function renderOrderReview(container, state, form, snapshot, data) {
  const review = container.querySelector("[data-order-review]");
  const schedulingAvailable = canScheduleToday(state);
  const nowAvailable = Boolean(state.status?.open);
  const defaultMode = nowAvailable ? "now" : "scheduled";
  const scheduledTime = getDefaultScheduledTime(state);
  const guestName = String(data.get("guest_name") || "").trim();
  const roomCode = String(data.get("room_code") || "").trim();
  const location = String(data.get("delivery_location") || "Acomodação").trim();
  const note = orderNotesEnabled(state) ? String(data.get("notes") || "").trim() : "";
  review.innerHTML = `
    <header class="rs-review-header">
      <button type="button" data-review-back aria-label="Voltar para editar o pedido">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div><span>Revise antes de enviar</span><h2>Seu pedido</h2></div>
    </header>
    <div class="rs-review-customer">
      <strong>${escapeHtml(guestName)}</strong>
      <span>${escapeHtml(location)} · ${escapeHtml(roomCode)}</span>
      ${note ? `<small>${escapeHtml(note)}</small>` : ""}
    </div>
    <div class="rs-review-items">
      ${snapshot.items.map((item) => `
        <div><span><b>${item.quantity}×</b> ${escapeHtml(item.name)}${Object.values(item.selected_options || {}).map((value) => `<small>${escapeHtml(value)}</small>`).join("")}</span><strong>${escapeHtml(formatMoney(item.line_total_cents, item.currency, state.bootstrap.locale))}</strong></div>
      `).join("")}
    </div>
    <div class="rs-review-total"><span>Total</span><strong>${escapeHtml(formatMoney(snapshot.total_cents, state.bootstrap.currency, state.bootstrap.locale))}</strong></div>
    <fieldset class="rs-preparation-options">
      <legend>Quando deseja receber?</legend>
      ${nowAvailable ? renderPreparationOption("now", "Agora", "Preparar assim que o pedido for enviado", defaultMode === "now") : ""}
      ${schedulingAvailable ? renderPreparationOption("scheduled", "Agendar entrega", "Escolha um horário ainda hoje", defaultMode === "scheduled") : ""}
      ${schedulingAvailable ? `<label class="rs-scheduled-time" data-scheduled-time ${defaultMode === "scheduled" ? "" : "hidden"}>
        <span>Horário de entrega</span>
        <input type="time" name="scheduled_time" value="${escapeHtml(scheduledTime)}" ${defaultMode === "scheduled" ? "required" : "disabled"}>
      </label>` : ""}
    </fieldset>
    <button class="rs-primary-button" type="submit">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>
      Enviar pedido
    </button>`;
  form.dataset.reviewing = "true";
  review.hidden = false;
  review.querySelector("[name='preparation_mode']:checked")?.focus({ preventScroll: true });
}

function renderPreparationOption(value, title, description, checked) {
  return `<label class="rs-preparation-option" data-preparation-option="${value}">
    <input type="radio" name="preparation_mode" value="${value}" ${checked ? "checked" : ""}>
    <span><strong>${title}</strong><small>${description}</small></span>
    <i aria-hidden="true"></i>
  </label>`;
}

function selectPreparationOption(container, mode) {
  const radio = container.querySelector(`[name='preparation_mode'][value='${cssEscape(mode)}']`);
  if (radio) radio.checked = true;
  const time = container.querySelector("[data-scheduled-time]");
  if (time) {
    const input = time.querySelector("input");
    const scheduled = mode === "scheduled";
    time.hidden = !scheduled;
    if (input) {
      input.disabled = !scheduled;
      input.required = scheduled;
    }
  }
}

function closeOrderReview(container) {
  const form = container.querySelector("[data-order-form]");
  const review = container.querySelector("[data-order-review]");
  if (form) delete form.dataset.reviewing;
  if (review) {
    review.hidden = true;
    review.innerHTML = "";
  }
}

function getDefaultScheduledTime(state) {
  if (!state.status) return "";
  const current = state.status.local.hour * 60 + state.status.local.minute;
  const rounded = Math.ceil((current + 15) / 15) * 15;
  for (const slot of state.status.today_slots || []) {
    const start = clockValueToMinutes(slot.opens_at);
    const end = clockValueToMinutes(slot.closes_at);
    const candidate = Math.max(start, rounded);
    if (candidate < end) return minutesToClock(candidate);
  }
  return "";
}

function clockValueToMinutes(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToClock(value) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function hotelLocalTimeToIso(time, timezone = "America/Sao_Paulo", now = new Date()) {
  const dateParts = getHotelDateParts(now, timezone);
  const [hour, minute] = String(time).split(":").map(Number);
  const desired = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hour, minute, 0, 0);
  let instant = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = getHotelDateParts(new Date(instant), timezone);
    const observedValue = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, 0, 0);
    instant += desired - observedValue;
  }
  return new Date(instant).toISOString();
}

function getHotelDateParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function buildNotes(data, { notesEnabled = true } = {}) {
  const lines = [];
  const location = String(data.get("delivery_location") || "").trim();
  const phone = String(data.get("guest_phone") || "").trim();
  const notes = notesEnabled ? String(data.get("notes") || "").trim() : "";
  if (location) lines.push(`Local de entrega: ${location}`);
  if (phone) lines.push(`Contato: ${phone}`);
  if (notes) lines.push(notes);
  return lines.join("\n").slice(0, 500);
}

function recentOrdersStorageKey(state) {
  return `fioreze:room-service:recent:${state.bootstrap.hotel_id}`;
}

function readRecentOrders(state) {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(recentOrdersStorageKey(state)) || "[]");
    return Array.isArray(value) ? value.slice(0, 3) : [];
  } catch {
    return [];
  }
}

function writeRecentOrders(state, orders) {
  try {
    window.sessionStorage.setItem(recentOrdersStorageKey(state), JSON.stringify(orders.slice(0, 3)));
  } catch {
    // O acompanhamento e apenas uma conveniencia local; o pedido ja foi persistido no servidor.
  }
}

function rememberRecentOrder(state, order, trackingKey) {
  const current = readRecentOrders(state).filter((entry) => entry.public_id !== order.public_id);
  writeRecentOrders(state, [{
    public_id: order.public_id,
    tracking_key: trackingKey,
    status: "sent",
    preparation_mode: order.preparation_mode || "now",
    scheduled_for: order.scheduled_for || null,
    created_at: order.created_at || new Date().toISOString(),
  }, ...current]);
}

async function refreshRecentOrders(container, state, { justSent = false } = {}) {
  const stored = readRecentOrders(state);
  if (!stored.length) {
    renderRecentOrders(container, state, [], { justSent });
    return;
  }
  const refreshed = (await Promise.all(stored.map(async (entry) => {
    try {
      const response = await fetch(
        `/api/v1/public/hotels/${encodeURIComponent(state.slug)}/room-service/orders/${encodeURIComponent(entry.public_id)}/status`,
        { headers: { accept: "application/json", "X-Order-Tracking-Key": entry.tracking_key } },
      );
      if (response.status === 404) return null;
      const payload = await response.json();
      return response.ok && payload?.ok ? { ...entry, ...payload.data } : entry;
    } catch {
      return entry;
    }
  }))).filter(Boolean);
  writeRecentOrders(state, refreshed);
  renderRecentOrders(container, state, refreshed, { justSent });
}

function renderRecentOrders(container, state, orders, { justSent = false } = {}) {
  const section = container.querySelector("[data-recent-orders]");
  if (!section) return;
  section.hidden = !orders.length;
  if (!orders.length) {
    section.innerHTML = "";
    return;
  }
  section.innerHTML = `
    ${justSent ? `<div class="rs-order-sent"><strong>Pedido enviado</strong><span>A unidade já recebeu sua solicitação.</span></div>` : ""}
    <header><span>Pedidos recentes</span><small>Neste dispositivo</small></header>
    <div>${orders.map((order) => {
      const status = ["sent", "printed", "delivered"].includes(order.status) ? order.status : "sent";
      const statusLabel = { sent: "Enviado", printed: "Impresso", delivered: "Entregue" }[status];
      const created = formatLocalTime(order.created_at, state.bootstrap.locale, state.bootstrap.timezone);
      const scheduled = order.preparation_mode === "scheduled" && order.scheduled_for
        ? ` · entrega ${formatLocalTime(order.scheduled_for, state.bootstrap.locale, state.bootstrap.timezone)}`
        : "";
      return `<article><span><strong>Pedido das ${escapeHtml(created)}</strong><small>${escapeHtml(scheduled.replace(/^ · /, ""))}</small></span><b data-status="${status}">${statusLabel}</b></article>`;
    }).join("")}</div>`;
}

function formatLocalTime(value, locale = "pt-BR", timezone = "America/Sao_Paulo") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat(locale || "pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(date);
}

function toggleCart(container, state, open) {
  state.cartOpen = false;
  container.querySelector("[data-cart-panel]")?.classList.remove("open");
  const backdrop = container.querySelector("[data-cart-backdrop]");
  if (backdrop) backdrop.hidden = true;
}

function showToast(container, message) {
  const toast = container.querySelector("[data-toast]");
  setText(container, "[data-toast-text]", message);
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
  return sanitizePublicAssetUrl(path);
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
  canScheduleToday,
  hotelLocalTimeToIso,
  renderStaticShell,
  sanitizeAssetPath,
  splitProductDescription,
  clampDetailQuantity,
  renderProductOptions,
  submitOrder,
  syncSubmitButton,
  updateServiceStatus,
  escapeHtml,
};
