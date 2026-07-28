import { apiGet } from "../../core/api.js";
import { escapeHtml } from "../../core/errors.js";
import { sanitizePublicAssetUrl } from "../../core/theme.js";

let cleanupCurrentRender = () => {};

export async function render(container, context) {
  cleanupCurrentRender();
  await loadCss("/css/modules/spa/spa.css");
  const state = {
    bootstrap: context.bootstrap,
    profile: defaultProfile(),
    services: [],
    query: "",
    selectedService: null,
  };

  container.innerHTML = renderShell(state);
  bindActions(container, state);

  try {
    const payload = await apiGet(
      `/api/v1/public/hotels/${encodeURIComponent(context.bootstrap.slug)}/spa/services`,
    );
    state.profile = payload.profile || state.profile;
    state.services = Array.isArray(payload.services) ? payload.services : [];
    renderProfile(container, state);
    renderServices(container, state);
  } catch (error) {
    renderError(container, error);
  }

  cleanupCurrentRender = () => {
    document.body.classList.remove("spa-modal-open");
  };
}

function renderShell(state) {
  return `
    <section class="spa-zena" data-spa-root>
      <main class="spa-zena-layout">
        <aside class="spa-zena-aside">
          <div class="spa-zena-brand">
            <span class="spa-zena-monogram" data-spa-logo aria-hidden="true">Z</span>
            <div>
              <p data-spa-title>${escapeHtml(state.profile.title)}</p>
              <h1>${escapeHtml(state.bootstrap.short_name || state.bootstrap.name)}</h1>
            </div>
          </div>

          <div class="spa-zena-introduction">
            <p data-spa-subtitle>${escapeHtml(state.profile.subtitle)}</p>
            <p data-spa-intro>${escapeHtml(state.profile.intro_text)}</p>
            <button type="button" data-spa-about>${icon("info")}<span>Quem Somos</span></button>
          </div>

          <article class="spa-zena-booking">
            <h2>${icon("calendar")}<span data-spa-booking-title>${escapeHtml(state.profile.booking_title)}</span></h2>
            <p data-spa-booking-text>${escapeHtml(state.profile.booking_text)}</p>
            <button class="spa-zena-whatsapp" type="button" data-spa-whatsapp>
              ${icon("whatsapp")}<span>Chamar no WhatsApp</span>
            </button>
            <div class="spa-zena-rules">
              <p>Nossas regras de utilização</p>
              <ul data-spa-rules></ul>
            </div>
          </article>
        </aside>

        <section class="spa-zena-catalog">
          <label class="spa-zena-search">
            ${icon("search")}
            <input type="search" data-spa-search placeholder="Buscar serviços pelo nome..." autocomplete="off" aria-label="Buscar serviços do Spa">
          </label>
          <div class="spa-zena-services" data-spa-services aria-live="polite"></div>
        </section>
      </main>

      <section class="spa-zena-modal" data-spa-detail hidden role="dialog" aria-modal="true" aria-labelledby="spa-detail-title">
        <button class="spa-zena-modal-backdrop" type="button" data-spa-close aria-label="Fechar detalhes"></button>
        <article class="spa-zena-modal-card">
          <button class="spa-zena-modal-close" type="button" data-spa-close aria-label="Fechar detalhes">${icon("close")}</button>
          <div class="spa-zena-modal-media" data-spa-detail-media></div>
          <div class="spa-zena-modal-content">
            <h2 id="spa-detail-title" data-spa-detail-title></h2>
            <strong data-spa-detail-price></strong>
            <div class="spa-zena-modal-duration">${icon("clock")}<span><small>Duração</small><b data-spa-detail-duration></b></span></div>
            <p data-spa-detail-description></p>
            <button class="spa-zena-detail-book" type="button" data-spa-detail-book>${icon("whatsapp")}<span>Agendar Serviço</span></button>
          </div>
        </article>
      </section>

      <section class="spa-zena-modal" data-spa-about-modal hidden role="dialog" aria-modal="true" aria-labelledby="spa-about-title">
        <button class="spa-zena-modal-backdrop" type="button" data-spa-about-close aria-label="Fechar apresentação"></button>
        <article class="spa-zena-about-card">
          <button class="spa-zena-modal-close" type="button" data-spa-about-close aria-label="Fechar apresentação">${icon("close")}</button>
          <h2 id="spa-about-title">Quem Somos</h2>
          <p data-spa-about-text></p>
        </article>
      </section>
    </section>`;
}

function bindActions(container, state) {
  container.addEventListener("input", (event) => {
    if (!event.target.matches("[data-spa-search]")) return;
    state.query = normalizeSearch(event.target.value);
    renderServices(container, state);
  });
  container.addEventListener("click", (event) => {
    const service = event.target.closest("[data-spa-service]");
    if (service) {
      state.selectedService = state.services.find((entry) => entry.id === service.dataset.spaService) || null;
      renderDetail(container, state);
      return;
    }
    if (event.target.closest("[data-spa-about]")) {
      openAbout(container, state);
      return;
    }
    if (event.target.closest("[data-spa-about-close]")) {
      closeModal(container.querySelector("[data-spa-about-modal]"));
      return;
    }
    if (event.target.closest("[data-spa-close]")) {
      state.selectedService = null;
      closeModal(container.querySelector("[data-spa-detail]"));
      return;
    }
    if (event.target.closest("[data-spa-whatsapp]")) {
      openWhatsApp(state);
      return;
    }
    if (event.target.closest("[data-spa-detail-book]")) {
      openWhatsApp(state, state.selectedService);
    }
  });
  container.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    state.selectedService = null;
    closeModal(container.querySelector("[data-spa-detail]"));
    closeModal(container.querySelector("[data-spa-about-modal]"));
  });
}

function renderProfile(container, state) {
  setText(container, "[data-spa-title]", state.profile.title);
  setText(container, "[data-spa-subtitle]", state.profile.subtitle);
  setText(container, "[data-spa-intro]", state.profile.intro_text);
  setText(container, "[data-spa-booking-title]", state.profile.booking_title);
  setText(container, "[data-spa-booking-text]", state.profile.booking_text);
  const logo = sanitizePublicAssetUrl(state.profile.logo_url);
  container.querySelector("[data-spa-logo]").innerHTML = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(state.profile.logo_alt || state.profile.title)}">`
    : "Z";
  const rules = Array.isArray(state.profile.usage_rules) ? state.profile.usage_rules : [];
  container.querySelector("[data-spa-rules]").innerHTML = rules
    .map((rule) => `<li>${escapeHtml(rule)}</li>`)
    .join("");
}

function renderServices(container, state) {
  const target = container.querySelector("[data-spa-services]");
  const services = state.services.filter((service) => {
    const haystack = normalizeSearch(`${service.name} ${service.description} ${service.duration_label}`);
    return !state.query || haystack.includes(state.query);
  });
  if (!services.length) {
    target.innerHTML = `
      <div class="spa-zena-empty">
        <strong>Nenhum serviço encontrado</strong>
        <span>Tente buscar por outro termo.</span>
      </div>`;
    return;
  }
  target.innerHTML = services.map(renderServiceCard).join("");
}

function renderServiceCard(service) {
  const imageUrl = sanitizePublicAssetUrl(service.image_url);
  return `
    <article class="spa-zena-service">
      <div class="spa-zena-service-media">
        ${imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(service.image_alt || service.name)}" loading="lazy">`
          : '<span aria-hidden="true">Spa Zena</span>'}
      </div>
      <div class="spa-zena-service-copy">
        <h2>${formatCardTitle(service.name)}</h2>
        <p>${escapeHtml(service.description)}</p>
        <footer>
          <div>
            <span>${icon("clock")}${escapeHtml(service.duration_label || "—")}</span>
            <strong>${icon("price")}${escapeHtml(formatPrice(service.price_cents, service.currency))}</strong>
          </div>
          <button type="button" data-spa-service="${escapeHtml(service.id)}">+ Detalhes</button>
        </footer>
      </div>
    </article>`;
}

function renderDetail(container, state) {
  const service = state.selectedService;
  if (!service) return;
  const imageUrl = sanitizePublicAssetUrl(service.image_url);
  container.querySelector("[data-spa-detail-media]").innerHTML = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(service.image_alt || service.name)}">`
    : "";
  setText(container, "[data-spa-detail-title]", service.name);
  setText(container, "[data-spa-detail-price]", formatPrice(service.price_cents, service.currency));
  setText(container, "[data-spa-detail-duration]", service.duration_label || "—");
  setText(container, "[data-spa-detail-description]", service.description);
  openModal(container.querySelector("[data-spa-detail]"));
}

function openAbout(container, state) {
  setText(container, "[data-spa-about-text]", state.profile.about_text);
  openModal(container.querySelector("[data-spa-about-modal]"));
}

function openModal(modal) {
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("spa-modal-open");
  modal.querySelector("button")?.focus();
}

function closeModal(modal) {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  if (![...document.querySelectorAll(".spa-zena-modal")].some((entry) => !entry.hidden)) {
    document.body.classList.remove("spa-modal-open");
  }
}

function openWhatsApp(state, service = null) {
  const number = String(state.profile.whatsapp_number || "").replace(/\D/g, "");
  if (!number) return;
  const template = service
    ? state.profile.whatsapp_service_message
    : state.profile.whatsapp_general_message;
  const message = String(template || "")
    .replaceAll("{hotel_name}", state.bootstrap.name || state.bootstrap.short_name || "hotel")
    .replaceAll("{service_name}", service?.name || "");
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

function renderError(container, error) {
  container.querySelector("[data-spa-services]").innerHTML = `
    <div class="spa-zena-empty" role="alert">
      <strong>O catálogo está temporariamente indisponível</strong>
      <span>${escapeHtml(error?.message || "Tente novamente em instantes.")}</span>
    </div>`;
}

function setText(container, selector, value) {
  const target = container.querySelector(selector);
  if (target) target.textContent = String(value || "");
}

function formatCardTitle(value) {
  const [first = "", ...rest] = String(value || "").trim().split(/\s+/);
  return `<span>${escapeHtml(first)}</span>${rest.length ? `<b>${escapeHtml(rest.join(" "))}</b>` : ""}`;
}

function formatPrice(cents, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(Number(cents || 0) / 100);
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function defaultProfile() {
  return {
    title: "Spa Zena",
    subtitle: "Cuidar de você é a nossa essência.",
    intro_text: "Conheça nossos serviços de relaxamento e bem-estar.",
    about_text: "",
    booking_title: "Agende seu horário",
    booking_text: "Selecione a terapia desejada e consulte a disponibilidade.",
    usage_rules: [],
  };
}

function icon(name) {
  const paths = {
    info: '<path d="M12 16v-4m0-4h.01"/><circle cx="12" cy="12" r="9"/>',
    calendar: '<path d="M8 3v4m8-4v4M5 10h14M5 5h14v16H5z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    price: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2c-1.3 0-2.4-.5-3-1.5M12 6v12"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    whatsapp: '<path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2 2 3.5 4 4l1-1c.2-.2.5-.3.8-.1l2 1"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ""}</svg>`;
}

async function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  await new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = resolve;
    link.onerror = reject;
    document.head.append(link);
  });
}

export const internalsForTests = {
  formatCardTitle,
  normalizeSearch,
  formatPrice,
};
