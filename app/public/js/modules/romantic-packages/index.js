import { apiGet } from "../../core/api.js";
import { escapeHtml } from "../../core/errors.js";
import { sanitizePublicAssetUrl } from "../../core/theme.js";
import {
  bindCatalogMediaViewer,
  renderCatalogMediaViewer,
  renderZoomableCatalogMedia,
} from "../shared/catalog-media-viewer.js";

const MODULE_KEY = "romantic-packages";
let cleanupCurrentRender = () => {};

export async function render(container, context) {
  cleanupCurrentRender();
  await loadCss("/css/modules/romantic-packages/romantic-packages.css");
  await loadCss("/css/modules/shared/catalog-detail.css");

  const state = {
    bootstrap: context.bootstrap,
    packages: [],
    selectedPackageId: packageIdFromUrl(),
    isFiorezeCentro: context.bootstrap.hotel_id === "fiorezecentro",
  };

  container.innerHTML = renderShell(context.bootstrap, state.isFiorezeCentro);
  const cleanupMediaViewer = bindCatalogMediaViewer(container);
  bindActions(container, state);

  try {
    const payload = await apiGet(
      `/api/v1/public/hotels/${encodeURIComponent(context.bootstrap.slug)}/romantic-packages/packages`,
    );
    state.packages = payload.packages || [];
    renderPackages(container, state);
    renderPackageDetail(container, state);
  } catch (error) {
    renderError(container, error);
  }

  const popstate = () => {
    state.selectedPackageId = packageIdFromUrl();
    renderPackageDetail(container, state);
  };
  window.addEventListener("popstate", popstate);
  cleanupCurrentRender = () => {
    window.removeEventListener("popstate", popstate);
    cleanupMediaViewer();
  };
}

function renderShell(bootstrap, isFiorezeCentro) {
  const description = String(
    bootstrap.settings?.["portal.module.romantic-packages.description"]
      || "Experiências pensadas para celebrar momentos especiais a dois.",
  ).trim();
  return `
    <section class="romantic-packages-app${isFiorezeCentro ? " is-fioreze-centro" : ""}">
      <header class="romantic-packages-heading">
        ${isFiorezeCentro ? "" : "<p>Experiências especiais</p>"}
        ${isFiorezeCentro
          ? '<h1><span>decorações</span><strong>ESPECIAIS</strong></h1>'
          : "<h1>Decorações especiais</h1>"}
        <span>${escapeHtml(description)}</span>
      </header>
      <section class="romantic-packages-grid" data-romantic-packages-list aria-live="polite">
        <div class="romantic-packages-loading"><span aria-hidden="true"></span><p>Preparando as experiências...</p></div>
      </section>
      <section class="romantic-package-detail catalog-detail-layer" data-romantic-package-detail hidden aria-modal="true" role="dialog" aria-labelledby="romantic-package-title">
        <article class="romantic-package-detail-card catalog-detail-surface" data-romantic-package-detail-card></article>
      </section>
      ${renderCatalogMediaViewer()}
    </section>`;
}

function bindActions(container, state) {
  container.addEventListener("click", (event) => {
    const packageButton = event.target.closest("[data-romantic-package]");
    if (packageButton) {
      state.selectedPackageId = packageButton.dataset.romanticPackage;
      updatePackageUrl(state.bootstrap.slug, state.selectedPackageId);
      renderPackageDetail(container, state);
      return;
    }
    if (event.target.closest("[data-romantic-package-close]")) {
      closePackageDetail(container, state);
      return;
    }
    if (event.target.closest("[data-romantic-packages-retry]")) window.location.reload();
  });
  container.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selectedPackageId && !event.target.closest("[data-catalog-media-viewer]")) {
      closePackageDetail(container, state);
    }
  });
}

function renderPackages(container, state) {
  const list = container.querySelector("[data-romantic-packages-list]");
  if (!state.packages.length) {
    list.innerHTML = `
      <div class="romantic-packages-empty">
        ${icon("sparkle")}
        <strong>Novas decorações em preparação</strong>
        <span>Consulte a recepção para conhecer as opções disponíveis durante a sua estadia.</span>
      </div>`;
    return;
  }
  if (!state.isFiorezeCentro) {
    list.innerHTML = state.packages.map((item) => renderPackageCard(item, false)).join("");
    return;
  }
  const categories = groupPackagesByCategory(state.packages);
  list.innerHTML = `
    <div class="romantic-centro-catalog">
      ${categories.map((category, index) => renderCategorySection(category, index)).join("")}
    </div>`;
}

function renderCategorySection(category, index) {
  const packages = category.items.filter((item) => item.item_type !== "add-on");
  const addOns = category.items.filter((item) => item.item_type === "add-on");
  const titleId = `decoration-category-${index}`;
  return `
    <section class="romantic-centro-experiences" aria-labelledby="${titleId}" data-decoration-category="${escapeHtml(category.key)}">
      <div class="romantic-centro-section-title">
        <span aria-hidden="true"></span>
        <div>
          <h2 id="${titleId}">${escapeHtml(category.name)}</h2>
          ${category.description ? `<p>${escapeHtml(category.description)}</p>` : ""}
        </div>
        <span aria-hidden="true"></span>
      </div>
      ${packages.length
        ? `<div class="romantic-centro-experience-grid">${packages.map((item) => renderPackageCard(item, true)).join("")}</div>`
        : ""}
      ${addOns.length ? renderAddOns(addOns, `${titleId}-addons`) : ""}
    </section>`;
}

function renderPackageCard(item, isFiorezeCentro) {
  const image = sanitizePublicAssetUrl(item.image_url);
  if (isFiorezeCentro) {
    return `
      <article class="romantic-package-card is-centro-experience">
        <button type="button" data-romantic-package="${escapeHtml(item.id)}" aria-label="Ver detalhes de ${escapeHtml(item.name)}">
          <span class="romantic-package-card-media">
            ${image
              ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.image_alt || item.name)}" loading="lazy">`
              : `<span class="romantic-package-placeholder" aria-hidden="true">${icon("heart")}</span>`}
            <small>Foto meramente ilustrativa</small>
          </span>
          <span class="romantic-package-card-copy">
            <strong>${escapeHtml(displayPackageName(item))}</strong>
            <span class="romantic-card-divider">${icon("heart")}</span>
            <p>${escapeHtml(item.description || "")}</p>
            <span class="romantic-package-price">${formatPrice(item)}</span>
            <em>Conhecer a experiência</em>
          </span>
        </button>
      </article>`;
  }
  return `
    <article class="romantic-package-card">
      <button type="button" data-romantic-package="${escapeHtml(item.id)}" aria-label="Ver detalhes de ${escapeHtml(item.name)}">
        <span class="romantic-package-card-media">
          ${image
            ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.image_alt || item.name)}" loading="lazy">`
            : `<span class="romantic-package-placeholder" aria-hidden="true">${icon("heart")}</span>`}
        </span>
        <span class="romantic-package-card-copy">
          <small>Experiência romântica</small>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${formatPrice(item)}</span>
          <em>Ver experiência</em>
        </span>
      </button>
    </article>`;
}

function renderAddOns(items, titleId) {
  return `
    <section class="romantic-centro-addons" aria-labelledby="${escapeHtml(titleId)}">
      <div class="romantic-centro-addons-heading">
        ${icon("sparkle")}
        <div>
          <p>Personalize a experiência</p>
          <h2 id="${escapeHtml(titleId)}">Adicionais</h2>
        </div>
      </div>
      <div class="romantic-centro-addon-list">
        ${items.map((item) => `
          <button type="button" data-romantic-package="${escapeHtml(item.id)}" aria-label="Ver ${escapeHtml(item.name)}">
            <span>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml(item.description || "")}</small>
            </span>
            <em>${formatPrice(item)}</em>
            ${icon("arrow")}
          </button>`).join("")}
      </div>
    </section>`;
}

function renderPackageDetail(container, state) {
  const layer = container.querySelector("[data-romantic-package-detail]");
  if (!state.selectedPackageId) {
    layer.hidden = true;
    document.body.classList.remove("catalog-detail-open");
    return;
  }

  const item = state.packages.find((entry) => entry.id === state.selectedPackageId);
  if (!item) {
    state.selectedPackageId = null;
    updatePackageUrl(state.bootstrap.slug, null);
    layer.hidden = true;
    document.body.classList.remove("catalog-detail-open");
    return;
  }

  const image = sanitizePublicAssetUrl(item.image_url);
  const whatsapp = whatsappAction(state.bootstrap, item);
  const isAddOn = item.item_type === "add-on";
  const card = container.querySelector("[data-romantic-package-detail-card]");
  card.classList.toggle("is-centro-detail", state.isFiorezeCentro);
  card.classList.toggle("is-add-on-detail", isAddOn);
  card.innerHTML = `
    <button class="romantic-package-detail-close catalog-detail-close" type="button" data-romantic-package-close aria-label="Fechar">${icon("close")}</button>
    <div class="romantic-package-detail-media catalog-detail-media">
      ${renderZoomableCatalogMedia({
        image,
        alt: item.image_alt || item.name,
        label: `Ampliar imagem de ${item.name}`,
        placeholder: `<span class="romantic-package-placeholder" aria-hidden="true">${icon("sparkle")}</span>`,
      })}
      ${image && state.isFiorezeCentro ? '<small class="romantic-detail-image-note">Foto meramente ilustrativa</small>' : ""}
    </div>
    <div class="romantic-package-detail-content catalog-detail-content">
      <p class="romantic-package-detail-category">${escapeHtml(item.category_name || "Decorações especiais")}</p>
      <p class="romantic-package-detail-kicker">${isAddOn ? "Adicional" : "Experiência especial"}</p>
      <h2 id="romantic-package-title">${escapeHtml(state.isFiorezeCentro ? displayPackageName(item) : item.name)}</h2>
      <strong class="romantic-package-detail-price">${formatPrice(item)}</strong>
      <p class="romantic-package-detail-description">${escapeHtml(item.description || "Uma experiência especial preparada pela equipe do hotel.")}</p>
      ${renderIncludedItems(item.included_items)}
      ${whatsapp.href
        ? `<a class="romantic-package-action" href="${escapeHtml(whatsapp.href)}" target="_blank" rel="noopener noreferrer nofollow">${icon("whatsapp")}<span>Falar com a recepção</span></a>`
        : `<button class="romantic-package-action" type="button" disabled aria-disabled="true">${icon("phone")}<span>Consulte a recepção</span></button>`}
      <small class="romantic-package-note">Disponibilidade, condições e agendamento são confirmados diretamente com a equipe do hotel.</small>
    </div>`;
  layer.hidden = false;
  document.body.classList.add("catalog-detail-open");
  window.requestAnimationFrame(() => card.querySelector("[data-romantic-package-close]")?.focus({ preventScroll: true }));
}

function renderIncludedItems(items) {
  if (!Array.isArray(items) || !items.length) return "";
  return `
    <section class="romantic-package-inclusions">
      <h3>Esta experiência inclui</h3>
      <ul>${items.map((item) => `<li>${icon("check")}<span>${escapeHtml(item)}</span></li>`).join("")}</ul>
    </section>`;
}

function closePackageDetail(container, state) {
  state.selectedPackageId = null;
  updatePackageUrl(state.bootstrap.slug, null);
  renderPackageDetail(container, state);
}

function renderError(container, error) {
  container.querySelector("[data-romantic-packages-list]").innerHTML = `
    <div class="romantic-packages-empty is-error">
      ${icon("alert")}
      <strong>Não foi possível abrir os pacotes</strong>
      <span>${escapeHtml(error.message || "Tente novamente em instantes.")}</span>
      <button type="button" data-romantic-packages-retry>Tentar novamente</button>
    </div>`;
}

function formatPrice(item) {
  if (item.price_cents == null) return "Consulte a recepção";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: item.currency || "BRL",
  }).format(Number(item.price_cents) / 100);
}

function removeSurprisePrefix(value) {
  return String(value || "").replace(/^surpresa\s+/i, "").trim();
}

function displayPackageName(item) {
  return item.category_key === "romantic-surprises"
    ? removeSurprisePrefix(item.name)
    : String(item.name || "").trim();
}

function groupPackagesByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    const key = String(item.category_key || "featured").trim() || "featured";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: String(item.category_name || "Experiências").trim() || "Experiências",
        description: String(item.category_description || "").trim(),
        sortOrder: Number(item.category_sort_order || 100),
        items: [],
      });
    }
    groups.get(key).items.push(item);
  }
  return [...groups.values()].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "pt-BR"),
  );
}

function whatsappAction(bootstrap, item) {
  const configured = bootstrap.settings?.["contact.whatsapp"] || bootstrap.settings?.["contact.phone"] || "";
  const digits = String(configured).replace(/\D/g, "");
  const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (number.length < 10 || number.length > 15) return { href: null };
  const message = [
    "Olá! Gostaria de mais informações sobre esta decoração especial:",
    item.name,
    bootstrap.short_name || bootstrap.name,
    "Pode confirmar a disponibilidade para mim?",
  ].join("\n");
  return { href: `https://wa.me/${number}?text=${encodeURIComponent(message)}` };
}

function updatePackageUrl(slug, packageId) {
  const url = new URL(window.location.href);
  url.pathname = `/${encodeURIComponent(slug)}/romantic-packages`;
  if (packageId) url.searchParams.set("pacote", packageId);
  else url.searchParams.delete("pacote");
  window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function packageIdFromUrl() {
  return new URL(window.location.href).searchParams.get("pacote") || null;
}

function icon(name) {
  const paths = {
    heart: '<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    whatsapp: '<path d="M20 11.5a8 8 0 0 1-11.7 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 3 2 4.5 5 5l1-1.5 2 .7v2c0 1-1 2-2 2-5 0-9-4-9-9 0-1 1-2 2-2h2l.7 2-1.7 1Z"/>',
    phone: '<path d="M4 5a2 2 0 0 1 2-2h3l1.4 4.2-2 1.2a12 12 0 0 0 7.2 7.2l1.2-2L21 15v3a2 2 0 0 1-2 2C10.7 20 4 13.3 4 5Z"/>',
    alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/>',
    arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
    sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.sparkle}</svg>`;
}

async function loadCss(path) {
  if (document.querySelector(`link[href="${path}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = path;
  document.head.appendChild(link);
}

export const romanticPackagesInternalsForTests = {
  displayPackageName,
  formatPrice,
  groupPackagesByCategory,
  whatsappAction,
};
