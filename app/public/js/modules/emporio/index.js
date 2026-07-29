import { apiGet } from "../../core/api.js";
import { escapeHtml } from "../../core/errors.js";
import { sanitizePublicAssetUrl } from "../../core/theme.js";
import {
  bindCatalogMediaViewer,
  renderCatalogMediaViewer,
  renderZoomableCatalogMedia,
} from "../shared/catalog-media-viewer.js";

const MODULE_KEY = "emporio";
let cleanupCurrentRender = () => {};

export async function render(container, context) {
  cleanupCurrentRender();
  await loadCss("/css/modules/emporio/emporio.css");
  await loadCss("/css/modules/shared/catalog-detail.css");
  const bootstrap = context.bootstrap;
  const state = {
    bootstrap,
    categories: [],
    query: "",
    activeCategory: "all",
    selectedProductId: productIdFromUrl(),
    carouselIndex: 0,
    carouselTimer: null,
  };

  container.innerHTML = renderShell(bootstrap);
  const cleanupMediaViewer = bindCatalogMediaViewer(container);
  bindActions(container, state);
  const headerSearch = (event) => {
    state.query = event.detail?.query || "";
    const field = container.querySelector("[data-emporio-search]");
    if (field) field.value = state.query;
    renderCatalog(container, state);
  };
  window.addEventListener("fioreze:portal-search", headerSearch);
  try {
    const catalog = await apiGet(
      `/api/v1/public/hotels/${encodeURIComponent(bootstrap.slug)}/emporio/items`,
    );
    state.categories = catalog.categories || [];
    renderHeroCarousel(container, state);
    renderCatalog(container, state);
    renderProductDetail(container, state);
  } catch (error) {
    renderCatalogError(container, error);
  }

  const popstate = () => {
    state.selectedProductId = productIdFromUrl();
    renderProductDetail(container, state);
  };
  window.addEventListener("popstate", popstate);
  cleanupCurrentRender = () => {
    window.removeEventListener("popstate", popstate);
    window.removeEventListener("fioreze:portal-search", headerSearch);
    window.clearInterval(state.carouselTimer);
    cleanupMediaViewer();
  };
}

function renderShell(bootstrap) {
  const module = bootstrap.modules?.find((entry) => entry.module_key === MODULE_KEY);
  const cover = sanitizePublicAssetUrl(module?.background_image_url);
  const style = cover ? ` style="--emporio-cover: url('${escapeHtml(cover)}')"` : "";
  return `
    <section class="emporio-app"${style}>
      <section class="emporio-intro">
        <div class="emporio-carousel" data-emporio-carousel aria-live="off">
          ${cover ? `<span class="emporio-carousel-slide is-active" style="--emporio-slide: url('${escapeHtml(cover)}')" aria-hidden="false"></span>` : ""}
        </div>
        <div class="emporio-intro-copy">
          <p data-emporio-carousel-title></p>
        </div>
        <div class="emporio-carousel-dots" data-emporio-carousel-dots aria-label="Destaques do Empório"></div>
      </section>

      <section class="emporio-toolbar" aria-label="Busca e categorias">
        <label class="emporio-search">
          ${icon("search")}
          <input type="search" data-emporio-search autocomplete="off" aria-label="Buscar no Empório" placeholder="Buscar">
        </label>
        <nav class="emporio-categories" data-emporio-categories aria-label="Categorias do Empório"></nav>
      </section>

      <section class="emporio-catalog" data-emporio-catalog aria-live="polite">
        <div class="emporio-loading"><span aria-hidden="true"></span><p>Preparando o catálogo...</p></div>
      </section>

      <section class="emporio-detail catalog-detail-layer" data-emporio-detail hidden aria-modal="true" role="dialog" aria-labelledby="emporio-product-title">
        <button class="emporio-detail-backdrop catalog-detail-backdrop" type="button" data-emporio-close aria-label="Fechar detalhes"></button>
        <article class="emporio-detail-card catalog-detail-surface" data-emporio-detail-card></article>
      </section>
      ${renderCatalogMediaViewer()}
    </section>`;
}

function bindActions(container, state) {
  container.addEventListener("input", (event) => {
    if (!event.target.matches("[data-emporio-search]")) return;
    state.query = event.target.value;
    renderCatalog(container, state);
  });
  container.addEventListener("click", (event) => {
    const category = event.target.closest("[data-emporio-category]");
    if (category) {
      state.activeCategory = category.dataset.emporioCategory;
      renderCatalog(container, state);
      return;
    }
    const product = event.target.closest("[data-emporio-product]");
    if (product) {
      state.selectedProductId = product.dataset.emporioProduct;
      updateProductUrl(state.bootstrap.slug, state.selectedProductId);
      renderProductDetail(container, state);
      return;
    }
    const slide = event.target.closest("[data-emporio-slide]");
    if (slide?.dataset.emporioProduct) {
      state.selectedProductId = slide.dataset.emporioProduct;
      updateProductUrl(state.bootstrap.slug, state.selectedProductId);
      renderProductDetail(container, state);
      return;
    }
    const dot = event.target.closest("[data-emporio-carousel-dot]");
    if (dot) {
      setCarouselIndex(container, state, Number(dot.dataset.emporioCarouselDot));
      restartCarousel(container, state);
      return;
    }
    if (event.target.closest("[data-emporio-retry]")) {
      window.location.reload();
      return;
    }
    if (event.target.closest("[data-emporio-close]")) closeProductDetail(container, state);
  });
  container.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selectedProductId && !event.target.closest("[data-catalog-media-viewer]")) {
      closeProductDetail(container, state);
    }
  });
}

function renderHeroCarousel(container, state) {
  const module = state.bootstrap.modules?.find((entry) => entry.module_key === MODULE_KEY);
  const moduleCover = sanitizePublicAssetUrl(module?.background_image_url);
  const configuredSlides = normalizeConfiguredSlides(state.bootstrap.settings?.["emporio.carousel_slides"]);
  const productSlides = allItems(state)
    .map((item) => ({
      image: sanitizePublicAssetUrl(item.image_url),
      productId: item.public_id || item.id,
      alt: item.image_alt || item.name,
      title: item.name,
    }))
    .filter((slide) => slide.image);
  const slides = [];
  if (configuredSlides.length) {
    slides.push(...configuredSlides);
  } else {
    if (moduleCover && !productSlides.some((slide) => slide.image === moduleCover)) {
      slides.push({ image: moduleCover, productId: null, alt: "Experiências do Empório", title: "" });
    }
    for (const slide of productSlides) {
      if (!slides.some((entry) => entry.image === slide.image)) slides.push(slide);
      if (slides.length === 7) break;
    }
  }
  if (!slides.length) return;

  state.carouselIndex = 0;
  container.querySelector("[data-emporio-carousel]").innerHTML = slides
    .map(
      (slide, index) => `
        <button
          class="emporio-carousel-slide${index === 0 ? " is-active" : ""}"
          type="button"
          style="--emporio-slide: url('${escapeHtml(slide.image)}')"
          data-emporio-slide
          ${slide.productId ? `data-emporio-product="${escapeHtml(slide.productId)}" aria-label="Ver ${escapeHtml(slide.alt)}"` : `aria-label="${escapeHtml(slide.alt)}"`}
          data-emporio-title="${escapeHtml(slide.title || "")}"
          aria-hidden="${index === 0 ? "false" : "true"}"
          tabindex="${index === 0 && slide.productId ? "0" : "-1"}"
        ></button>`,
    )
    .join("");
  const dots = container.querySelector("[data-emporio-carousel-dots]");
  dots.innerHTML = slides.length > 1
    ? slides.map((_, index) => `<button type="button" data-emporio-carousel-dot="${index}" aria-label="Mostrar destaque ${index + 1}" aria-current="${index === 0 ? "true" : "false"}"></button>`).join("")
    : "";
  restartCarousel(container, state);
  syncCarouselTitle(container, state);
}

function setCarouselIndex(container, state, index) {
  const slides = [...container.querySelectorAll("[data-emporio-slide]")];
  if (!slides.length) return;
  state.carouselIndex = ((index % slides.length) + slides.length) % slides.length;
  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === state.carouselIndex;
    slide.classList.toggle("is-active", active);
    slide.setAttribute("aria-hidden", String(!active));
    slide.tabIndex = active && slide.dataset.emporioProduct ? 0 : -1;
  });
  container.querySelectorAll("[data-emporio-carousel-dot]").forEach((dot, dotIndex) => {
    dot.setAttribute("aria-current", String(dotIndex === state.carouselIndex));
  });
  syncCarouselTitle(container, state);
}

function syncCarouselTitle(container, state) {
  const current = [...container.querySelectorAll("[data-emporio-slide]")][state.carouselIndex];
  const target = container.querySelector("[data-emporio-carousel-title]");
  if (target) target.textContent = current?.dataset.emporioTitle || "";
}

function normalizeConfiguredSlides(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((slide) => {
    const mediaId = String(slide?.media_asset_id || "").trim();
    const image = sanitizePublicAssetUrl(mediaId ? `/media/${mediaId}` : "");
    if (!image) return null;
    const title = String(slide?.title || "").trim().slice(0, 120);
    return {
      image,
      productId: null,
      title,
      alt: title || "Destaque do Empório",
    };
  }).filter(Boolean);
}

function restartCarousel(container, state) {
  window.clearInterval(state.carouselTimer);
  const slideCount = container.querySelectorAll("[data-emporio-slide]").length;
  if (slideCount < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  state.carouselTimer = window.setInterval(() => {
    setCarouselIndex(container, state, state.carouselIndex + 1);
  }, 5000);
}

function renderCatalog(container, state) {
  renderCategories(container, state);
  const items = filteredItems(state);
  const catalog = container.querySelector("[data-emporio-catalog]");
  if (!items.length) {
    catalog.innerHTML = `
      <div class="emporio-empty">
        ${icon("search")}
        <strong>Nenhum produto encontrado</strong>
        <span>Tente outra busca ou escolha uma categoria diferente.</span>
      </div>`;
    return;
  }
  catalog.innerHTML = `
    <header class="emporio-section-heading">
      <div>
        <p>${state.activeCategory === "all" ? "Escolhas para você" : "Categoria selecionada"}</p>
        <h2>${escapeHtml(activeCategoryName(state))}</h2>
      </div>
      <span>${items.length} ${items.length === 1 ? "produto" : "produtos"}</span>
    </header>
    <div class="emporio-product-grid">${items.map(renderProductCard).join("")}</div>`;
}

function renderCategories(container, state) {
  const categories = container.querySelector("[data-emporio-categories]");
  const options = [
    { id: "all", name: "Todos" },
    ...state.categories.map((category) => ({ id: category.id, name: category.name })),
  ];
  categories.innerHTML = options
    .map(
      (category) => `
        <button type="button" data-emporio-category="${escapeHtml(category.id)}" class="${state.activeCategory === category.id ? "is-active" : ""}" aria-pressed="${state.activeCategory === category.id}">
          ${escapeHtml(category.name)}
        </button>`,
    )
    .join("");
}

function renderProductCard(item) {
  const image = sanitizePublicAssetUrl(item.image_url);
  return `
    <article class="emporio-product-card${item.available ? "" : " is-unavailable"}">
      <button class="emporio-product-open" type="button" data-emporio-product="${escapeHtml(item.public_id || item.id)}" aria-label="Ver detalhes de ${escapeHtml(item.name)}">
        <span class="emporio-product-media">
          ${image
            ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.image_alt || item.name)}" loading="lazy">`
            : `<span class="emporio-product-placeholder" aria-hidden="true">${icon("gift")}</span>`}
          ${item.tag ? `<small>${escapeHtml(item.tag)}</small>` : ""}
        </span>
        <span class="emporio-product-copy">
          <span class="emporio-product-category">${escapeHtml(item.category_name || "Empório")}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <span class="emporio-product-price">${formatMoney(item.price_cents, item.currency)}</span>
          <span class="emporio-product-status">${item.available ? "Consultar disponibilidade" : escapeHtml(item.availability_label || "Indisponível no momento")}</span>
        </span>
      </button>
    </article>`;
}

function renderProductDetail(container, state) {
  const layer = container.querySelector("[data-emporio-detail]");
  if (!state.selectedProductId) {
    layer.hidden = true;
    document.body.classList.remove("emporio-detail-open");
    document.body.classList.remove("catalog-detail-open");
    return;
  }
  const item = allItems(state).find(
    (entry) => (entry.public_id || entry.id) === state.selectedProductId,
  );
  if (!item) {
    state.selectedProductId = null;
    updateProductUrl(state.bootstrap.slug, null);
    layer.hidden = true;
    return;
  }
  const image = sanitizePublicAssetUrl(item.image_url);
  const whatsapp = whatsappAction(state.bootstrap, item);
  const card = container.querySelector("[data-emporio-detail-card]");
  card.innerHTML = `
    <button class="emporio-detail-close catalog-detail-close" type="button" data-emporio-close aria-label="Fechar">${icon("close")}</button>
    <div class="emporio-detail-media catalog-detail-media">
      ${renderZoomableCatalogMedia({
        image,
        alt: item.image_alt || item.name,
        label: `Ampliar imagem de ${item.name}`,
        placeholder: `<span class="emporio-product-placeholder" aria-hidden="true">${icon("gift")}</span>`,
      })}
    </div>
    <div class="emporio-detail-content catalog-detail-content">
      <p>${escapeHtml(item.category_name || "Empório")}</p>
      <h2 id="emporio-product-title">${escapeHtml(item.name)}</h2>
      ${item.tag ? `<span class="emporio-detail-tag">${escapeHtml(item.tag)}</span>` : ""}
      <strong class="emporio-detail-price">${formatMoney(item.price_cents, item.currency)}</strong>
      <p class="emporio-detail-description">${escapeHtml(item.description || "Produto selecionado pelo Empório da unidade.")}</p>
      <div class="emporio-detail-availability" data-available="${String(Boolean(item.available))}">
        <span aria-hidden="true"></span>
        <div><strong>${item.available ? "Disponibilidade sob consulta" : "Indisponível no momento"}</strong><small>${escapeHtml(item.availability_label || (item.available ? "Confirme com a recepção antes de retirar." : "Consulte a equipe para outras opções."))}</small></div>
      </div>
      ${whatsapp.href
        ? `<a class="emporio-whatsapp-button" href="${escapeHtml(whatsapp.href)}" target="_blank" rel="noopener noreferrer nofollow">${icon("whatsapp")}<span>Falar com a recepção</span></a>`
        : `<button class="emporio-whatsapp-button" type="button" disabled aria-disabled="true">${icon("phone")}<span>Consulte a recepção</span></button>`}
      <small class="emporio-purchase-note">Catálogo para consulta. A disponibilidade e a retirada são confirmadas diretamente com a equipe do hotel.</small>
    </div>`;
  layer.hidden = false;
  document.body.classList.add("emporio-detail-open");
  document.body.classList.add("catalog-detail-open");
  window.requestAnimationFrame(() => card.querySelector("[data-emporio-close]")?.focus({ preventScroll: true }));
}

function closeProductDetail(container, state) {
  state.selectedProductId = null;
  updateProductUrl(state.bootstrap.slug, null);
  renderProductDetail(container, state);
}

function renderCatalogError(container, error) {
  container.querySelector("[data-emporio-catalog]").innerHTML = `
    <div class="emporio-empty is-error">
      ${icon("alert")}
      <strong>Não foi possível abrir o Empório</strong>
      <span>${escapeHtml(error.message || "Tente novamente em instantes.")}</span>
      <button type="button" data-emporio-retry>Tentar novamente</button>
    </div>`;
}

function filteredItems(state) {
  const query = normalizeText(state.query);
  return allItems(state).filter((item) => {
    const categoryMatch = state.activeCategory === "all" || item.category_id === state.activeCategory;
    const text = normalizeText(`${item.name} ${item.description || ""} ${item.tag || ""} ${item.category_name || ""}`);
    return categoryMatch && (!query || text.includes(query));
  });
}

function allItems(state) {
  return state.categories.flatMap((category) =>
    (category.items || []).map((item) => ({
      ...item,
      category_id: category.id,
      category_name: category.name,
    })),
  );
}

function activeCategoryName(state) {
  if (state.activeCategory === "all") return "Produtos em destaque";
  return state.categories.find((category) => category.id === state.activeCategory)?.name || "Produtos";
}

function whatsappAction(bootstrap, item) {
  const configured = bootstrap.settings?.["contact.whatsapp"] || bootstrap.settings?.["contact.phone"] || "";
  const digits = String(configured).replace(/\D/g, "");
  const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (number.length < 10 || number.length > 15) return { href: null };
  const message = [
    "Olá! Gostaria de mais informações sobre este produto:",
    item.name,
    `Empório ${bootstrap.short_name || bootstrap.name}`,
    "Pode confirmar a disponibilidade para mim?",
  ].join("\n");
  return { href: `https://wa.me/${number}?text=${encodeURIComponent(message)}` };
}

function updateProductUrl(slug, productId) {
  const url = new URL(window.location.href);
  url.pathname = `/${encodeURIComponent(slug)}/emporio`;
  if (productId) url.searchParams.set("produto", productId);
  else url.searchParams.delete("produto");
  window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function productIdFromUrl() {
  return new URL(window.location.href).searchParams.get("produto") || null;
}

function formatMoney(cents, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(Number(cents || 0) / 100);
}

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function icon(name) {
  const paths = {
    bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    gift: '<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M12 9v12M3 9h18v4H3z"/><path d="M12 9H8.5a2.5 2.5 0 1 1 2.2-3.7L12 9Zm0 0h3.5a2.5 2.5 0 1 0-2.2-3.7L12 9Z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    whatsapp: '<path d="M20 11.5a8 8 0 0 1-11.7 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 3 2 4.5 5 5l1-1.5 2 .7v2c0 1-1 2-2 2-5 0-9-4-9-9 0-1 1-2 2-2h2l.7 2-1.7 1Z"/>',
    phone: '<path d="M4 5a2 2 0 0 1 2-2h3l1.4 4.2-2 1.2a12 12 0 0 0 7.2 7.2l1.2-2L21 15v3a2 2 0 0 1-2 2C10.7 20 4 13.3 4 5Z"/>',
    alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.gift}</svg>`;
}

async function loadCss(path) {
  if (document.querySelector(`link[href="${path}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = path;
  document.head.appendChild(link);
}

export const internalsForTests = {
  formatMoney,
  normalizeText,
  whatsappAction,
};
