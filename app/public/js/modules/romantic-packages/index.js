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
  };

  container.innerHTML = renderShell(context.bootstrap);
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

function renderShell(bootstrap) {
  const description = String(
    bootstrap.settings?.["portal.module.romantic-packages.description"]
      || "Experiências pensadas para celebrar momentos especiais a dois.",
  ).trim();
  return `
    <section class="romantic-packages-app">
      <header class="romantic-packages-heading">
        <p>Experiências a dois</p>
        <h2>Pacotes românticos</h2>
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
        ${icon("heart")}
        <strong>Novas experiências em preparação</strong>
        <span>Consulte a recepção para conhecer as opções disponíveis durante a sua estadia.</span>
      </div>`;
    return;
  }
  list.innerHTML = state.packages.map(renderPackageCard).join("");
}

function renderPackageCard(item) {
  const image = sanitizePublicAssetUrl(item.image_url);
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
  const card = container.querySelector("[data-romantic-package-detail-card]");
  card.innerHTML = `
    <button class="romantic-package-detail-close catalog-detail-close" type="button" data-romantic-package-close aria-label="Fechar">${icon("close")}</button>
    <div class="romantic-package-detail-media catalog-detail-media">
      ${renderZoomableCatalogMedia({
        image,
        alt: item.image_alt || item.name,
        label: `Ampliar imagem de ${item.name}`,
        placeholder: `<span class="romantic-package-placeholder" aria-hidden="true">${icon("heart")}</span>`,
      })}
    </div>
    <div class="romantic-package-detail-content catalog-detail-content">
      <p>Experiência romântica</p>
      <h2 id="romantic-package-title">${escapeHtml(item.name)}</h2>
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

function whatsappAction(bootstrap, item) {
  const configured = bootstrap.settings?.["contact.whatsapp"] || bootstrap.settings?.["contact.phone"] || "";
  const digits = String(configured).replace(/\D/g, "");
  const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (number.length < 10 || number.length > 15) return { href: null };
  const message = [
    "Olá! Gostaria de mais informações sobre este pacote romântico:",
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
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.heart}</svg>`;
}

async function loadCss(path) {
  if (document.querySelector(`link[href="${path}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = path;
  document.head.appendChild(link);
}

export const romanticPackagesInternalsForTests = {
  formatPrice,
  whatsappAction,
};
