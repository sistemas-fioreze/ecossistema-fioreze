import { apiGet, apiPost } from "../../core/api.js";
import { escapeHtml } from "../../core/errors.js";
import { createCartStore, createOrderAttemptKey } from "./cart.js";
import { filterCatalog, flattenCatalog, formatMoney, getCatalogItemMap, normalizeText } from "./catalog.js";
import { describeServiceStatus, evaluateServiceStatus } from "./service-status.js";
import { applyBranding, sanitizePublicAssetUrl } from "../../core/theme.js";

const MODULE_KEY = "room-service";
let cleanupCurrentRender = () => {};

export async function render(container, context) {
  cleanupCurrentRender();
  await loadCss("/css/modules/room-service/room-service.css");
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
  };

  container.innerHTML = renderStaticShell({ embedded });
  bindStaticActions(container, state);
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
    updateServiceStatus(container, state);
    state.statusTimer = window.setInterval(() => updateServiceStatus(container, state), 60000);
    renderCatalog(container, state);
    renderRoomOptions(container, state);
    renderCart(container, state);
  } catch (error) {
    renderCatalogError(container, error);
  }

  cleanupCurrentRender = () => {
    window.removeEventListener("fioreze:portal-search", headerSearch);
    if (state.statusTimer) window.clearInterval(state.statusTimer);
  };
}

function renderStaticShell({ embedded = false } = {}) {
  return `
    <section class="rs-app${embedded ? " is-portal-page" : ""}" data-rs-app>
      <section class="rs-shell" data-rs-shell>
        <div class="rs-layout">
          <aside class="rs-order-column">
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
                <label class="rs-icon-field rs-textarea-field">
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
              </form>
            </section>
          </aside>

          <section class="rs-menu-column">
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

      <section class="rs-image-viewer" data-image-viewer hidden role="dialog" aria-modal="true" aria-label="Imagem ampliada">
        <div>
          <img data-viewer-image src="" alt="">
          <button type="button" data-image-close aria-label="Fechar imagem"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        </div>
      </section>

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

    const imageButton = event.target.closest("[data-view-image]");
    if (imageButton) {
      openImageViewer(container, imageButton.dataset.viewImage, imageButton.dataset.imageAlt);
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

    if (event.target.closest("[data-image-close]") || event.target === container.querySelector("[data-image-viewer]")) {
      closeImageViewer(container);
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
    if (event.key !== "Escape") return;
    if (!container.querySelector("[data-image-viewer]").hidden) closeImageViewer(container);
    else if (!container.querySelector("[data-modal]").hidden) closeModal(container);
    else toggleCart(container, state, false);
  });
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
    note.textContent = `${description.detail} Você ainda pode consultar o cardápio.`;
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
  const disabled = Boolean(state.isSubmitting || closed);
  const label = state.isSubmitting ? "Enviando pedido..." : closed ? "Room Service fechado" : "Finalizar Pedido";

  button.disabled = disabled;
  const labelTarget = button.querySelector?.("[data-submit-label]");
  if (labelTarget) labelTarget.textContent = label;
  else button.textContent = label;
  button.setAttribute("aria-disabled", String(disabled));
  button.classList.toggle("is-closed", closed && !state.isSubmitting);
  button.classList.toggle("is-submitting", Boolean(state.isSubmitting));

  if (state.isSubmitting) {
    button.setAttribute("aria-label", "Enviando pedido...");
    button.removeAttribute("title");
  } else if (closed) {
    const detail = state.status ? describeServiceStatus(state.status).detail : "Pedidos indisponiveis no momento.";
    button.setAttribute("aria-label", `Room Service fechado. ${detail}`);
    button.setAttribute("title", detail);
  } else {
    button.setAttribute("aria-label", "Finalizar pedido");
    button.removeAttribute("title");
  }
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
  card.classList.toggle("unavailable", item.available === false);

  if (item.image_url) {
    const media = document.createElement("button");
    media.type = "button";
    media.className = "rs-product-media";
    media.dataset.viewImage = item.image_url;
    media.dataset.imageAlt = item.image_alt || item.name;
    media.setAttribute("aria-label", `Ampliar imagem de ${item.name}`);
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

  const description = document.createElement("p");
  description.textContent = item.description || "Item do cardápio.";

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
    item.available === false ? "Indisponível" : "Adicionar"
  }</span>`;
  footer.append(price, button);

  content.append(label, title, description, footer);
  card.append(content);
  return card;
}

function addItem(container, state, itemId) {
  try {
    state.cart.add(itemId);
    renderCart(container, state);
    showToast(container, "Item adicionado ao pedido");
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
    showModal(container, "Campo obrigatório", "Por gentileza, informe seu nome.");
    form.elements.guest_name.focus();
    return;
  }
  if (!roomCode) {
    showModal(container, "Acomodação obrigatória", "Por gentileza, informe sua acomodação.");
    form.elements.room_code.focus();
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
    showModal(container, "Não foi possível enviar", error.message);
  } finally {
    state.isSubmitting = false;
    container.querySelector("[data-submit-overlay]").hidden = true;
    updateServiceStatus(container, state);
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

function openImageViewer(container, source, alt) {
  const safeSource = sanitizeAssetPath(source);
  if (!safeSource) return;
  const viewer = container.querySelector("[data-image-viewer]");
  const image = container.querySelector("[data-viewer-image]");
  image.src = safeSource;
  image.alt = alt || "Imagem do item";
  viewer.hidden = false;
  container.querySelector("[data-image-close]").focus();
}

function closeImageViewer(container) {
  const viewer = container.querySelector("[data-image-viewer]");
  const image = container.querySelector("[data-viewer-image]");
  viewer.hidden = true;
  image.removeAttribute("src");
  image.alt = "";
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
  renderStaticShell,
  sanitizeAssetPath,
  submitOrder,
  syncSubmitButton,
  updateServiceStatus,
  escapeHtml,
};
