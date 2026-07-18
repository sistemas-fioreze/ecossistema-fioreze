import { apiGet } from "./api.js";
import { escapeHtml } from "./errors.js";
import { sanitizePublicAssetUrl } from "./theme.js";

const MODULE_DESCRIPTIONS = {
  "room-service": "Sabores preparados para aproveitar na sua acomodação.",
  emporio: "Produtos selecionados e lembranças da sua estadia.",
  spa: "Momentos de cuidado, equilíbrio e bem-estar.",
  "romantic-packages": "Experiências especiais para celebrar a dois.",
};

const NAV_ITEMS = [
  ["inicio", "Início", "home"],
  ["servicos", "Serviços", "services"],
  ["eventos", "Eventos", "calendar"],
  ["hotel", "Hotel", "hotel"],
  ["blog", "Blog", "blog"],
];

let cleanupCurrentRender = () => {};

export async function render(container, context) {
  cleanupCurrentRender();
  const state = {
    bootstrap: context.bootstrap,
    content: { pages: [], events: [], information: [] },
    weather: { available: false, current: null, forecast: [] },
    weatherOpen: false,
    selectedEventId: null,
    blogPosts: [],
    blogLoading: false,
    blogLoaded: false,
    blogAvailable: true,
    activeTab: "inicio",
    clockTimer: null,
  };

  container.innerHTML = renderLoading(context.bootstrap);
  try {
    const slug = encodeURIComponent(context.bootstrap.slug);
    [state.content, state.weather] = await Promise.all([
      apiGet(`/api/v1/public/hotels/${slug}/portal/home`),
      apiGet(`/api/v1/public/hotels/${slug}/portal/weather`).catch(() => ({ available: false, current: null, forecast: [] })),
    ]);
    renderPortal(container, state);
    bindPortal(container, state);
    updateClock(container, state.bootstrap.timezone);
    state.clockTimer = window.setInterval(() => updateClock(container, state.bootstrap.timezone), 60000);
  } catch (error) {
    container.innerHTML = renderLoadError(error);
    container.querySelector("[data-reload]")?.addEventListener("click", () => window.location.reload());
  }

  cleanupCurrentRender = () => {
    if (state.clockTimer) window.clearInterval(state.clockTimer);
  };
}

function renderLoading(bootstrap) {
  const logoUrl = getLogoUrl(bootstrap.branding);
  return `
    <section class="guest-loading" aria-live="polite">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="">` : icon("hotel")}
      <span class="guest-loading-spinner" aria-hidden="true"></span>
      <p>Preparando sua experiência</p>
    </section>`;
}

function renderLoadError(error) {
  return `
    <section class="guest-loading guest-loading-error" role="alert">
      ${icon("info")}
      <h1>Não foi possível abrir o portal</h1>
      <p>${escapeHtml(error?.message || "Tente novamente em instantes.")}</p>
      <button type="button" class="guest-retry" data-reload>Carregar novamente</button>
    </section>`;
}

function renderPortal(container, state) {
  container.innerHTML = `
    ${renderHeader(state.bootstrap, state.weather)}
    <main class="guest-shell" data-guest-content>${renderActiveView(state)}</main>
    ${renderBottomNav(state.activeTab)}
    ${state.weatherOpen ? renderWeatherPanel(state) : ""}
    ${state.selectedEventId ? renderEventDetail(state) : ""}
  `;
}

function bindPortal(container, state) {
  container.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-portal-tab]");
    if (tabButton) {
      state.activeTab = tabButton.dataset.portalTab;
      renderPortal(container, state);
      updateClock(container, state.bootstrap.timezone);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (state.activeTab === "blog") loadBlog(container, state);
      return;
    }

    if (event.target.closest("[data-weather-open]")) {
      state.weatherOpen = true;
      renderPortal(container, state);
      return;
    }
    if (event.target.closest("[data-weather-close]")) {
      state.weatherOpen = false;
      renderPortal(container, state);
      updateClock(container, state.bootstrap.timezone);
      return;
    }

    const eventButton = event.target.closest("[data-event-open]");
    if (eventButton) {
      state.selectedEventId = eventButton.dataset.eventOpen;
      renderPortal(container, state);
      return;
    }
    if (event.target.closest("[data-event-close]")) {
      state.selectedEventId = null;
      renderPortal(container, state);
      updateClock(container, state.bootstrap.timezone);
      return;
    }

    if (event.target.closest("[data-reload]")) window.location.reload();
  });
}

async function loadBlog(container, state) {
  if (state.blogLoaded || state.blogLoading) return;
  state.blogLoading = true;
  renderPortal(container, state);
  try {
    const payload = await apiGet(`/api/v1/public/hotels/${encodeURIComponent(state.bootstrap.slug)}/portal/blog`);
    state.blogPosts = payload.posts || [];
    state.blogAvailable = payload.available !== false;
    state.blogLoaded = true;
  } catch {
    state.blogPosts = [];
    state.blogAvailable = false;
    state.blogLoaded = true;
  } finally {
    state.blogLoading = false;
    if (state.activeTab === "blog") renderPortal(container, state);
  }
}

function renderHeader(bootstrap, weather) {
  const logoUrl = getLogoUrl(bootstrap.branding);
  const brand = logoUrl
    ? `<img class="brand-logo-img" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(bootstrap.name)}">`
    : `<strong class="brand-name-text">${escapeHtml(bootstrap.short_name || bootstrap.name)}</strong>`;
  const mapsUrl = sanitizeExternalUrl(bootstrap.settings?.["contact.maps_url"] || bootstrap.settings?.["hotel.maps_url"]);
  const locationControl = mapsUrl
    ? `<a class="header-location-button" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener" aria-label="Abrir localização do hotel">${icon("pin")}</a>`
    : `<button type="button" class="header-location-button" data-portal-tab="hotel" aria-label="Ver informações do hotel">${icon("pin")}</button>`;

  const weatherControl = weather?.available && weather.current
    ? `<button type="button" class="header-weather" data-weather-open aria-label="Abrir previsão do tempo">${icon(weatherIcon(weather.current.weather_code))}<strong>${Number(weather.current.temperature)}°</strong><span>${escapeHtml(weather.current.description)}</span>${icon("chevron")}</button>`
    : `<div class="header-time" aria-label="Horário local do hotel">${icon("clock")}<span data-hotel-clock>--:--</span></div>`;

  return `
    <header class="site-header">
      <div class="guest-brand">
        ${brand}
        <div class="header-actions">
          ${weatherControl}
          ${locationControl}
        </div>
      </div>
    </header>`;
}

function renderWeatherPanel(state) {
  const current = state.weather.current;
  if (!current) return "";
  return `
    <div class="weather-modal-backdrop" role="dialog" aria-modal="true" aria-label="Previsão do tempo">
      <section class="weather-modal-sheet">
        <header class="weather-screen-head">
          <div><p>Clima na unidade</p><h2>Previsão do tempo</h2></div>
          <button type="button" data-weather-close aria-label="Fechar previsão">${icon("close")}</button>
        </header>
        <article class="weather-hero-card">
          <div><strong class="weather-temp">${Number(current.temperature)}°</strong><span>${escapeHtml(current.description)}</span><small>Sensação de ${current.apparent_temperature ?? current.temperature}°</small></div>
          <span class="weather-hero-icon">${icon(weatherIcon(current.weather_code))}</span>
        </article>
        <div class="weather-forecast-grid">
          ${state.weather.forecast.map((day, index) => `<article class="weather-forecast-card"><strong>${escapeHtml(forecastDayLabel(day.date, index))}</strong>${icon(weatherIcon(day.weather_code))}<span>${escapeHtml(day.description)}</span><b>${day.temperature_max ?? "--"}° <small>${day.temperature_min ?? "--"}°</small></b><em>${icon("droplet")}${Number(day.precipitation_probability || 0)}%</em></article>`).join("")}
        </div>
        <aside class="weather-tip-card">${icon("info")}<div><strong>Planeje o seu dia</strong><p>A previsão é atualizada pelo serviço Open-Meteo usando a localização cadastrada para esta unidade.</p></div></aside>
      </section>
      <div class="weather-back-shell"><button type="button" class="weather-back-action" data-weather-close>${icon("chevron-back")}<span>Voltar ao portal</span></button></div>
    </div>`;
}

function renderActiveView(state) {
  if (state.activeTab === "servicos") return renderServicesView(state);
  if (state.activeTab === "eventos") return renderEventsView(state);
  if (state.activeTab === "hotel") return renderHotelView(state);
  if (state.activeTab === "blog") return renderPagesView(state);
  return renderHomeView(state);
}

function renderHomeView(state) {
  const { bootstrap } = state;
  const greeting = getGreeting(bootstrap.timezone);
  const subtitle =
    bootstrap.settings?.["portal.welcome_text"] ||
    bootstrap.settings?.["hosting.welcome_text"] ||
    bootstrap.settings?.["general.short_description"] ||
    "Serviços, experiências e informações para acompanhar a sua estadia.";

  return `
    <section class="home-hero-copy">
      <p class="guest-kicker">Olá, ${greeting}!</p>
      <h1 class="guest-title">Bem-vindo ao ${escapeHtml(bootstrap.short_name || bootstrap.name)}</h1>
      <p class="guest-subtitle">${escapeHtml(subtitle)}</p>
    </section>
    ${renderServicesSection(state)}
    ${renderFeaturedSection(state)}
    ${renderInformationSection(state)}`;
}

function renderServicesSection(state) {
  const services = getServiceModules(state.bootstrap);
  return `
    <section class="home-services-section guest-section">
      <div class="guest-section-heading">
        <h2 class="guest-section-title">Serviços</h2>
        <button type="button" data-portal-tab="servicos">Ver todos</button>
      </div>
      ${services.length
        ? `<div class="quick-grid amenities-grid">${services.slice(0, 3).map((service) => renderQuickCard(service, state.bootstrap)).join("")}</div>`
        : renderEmptyState("Nenhum serviço disponível no momento.")}
    </section>`;
}

function renderQuickCard(module, bootstrap) {
  const href = getModulePath(bootstrap, module.module_key);
  const imageUrl = sanitizePublicAssetUrl(module.background_image_url);
  return `
    <a class="quick-card${imageUrl ? " has-image" : ""}" href="${escapeHtml(href)}">
      ${imageUrl ? `<img class="quick-card-media" src="${escapeHtml(imageUrl)}" alt="" loading="lazy">` : ""}
      ${icon(moduleIcon(module.module_key))}
      <span class="quick-card-copy"><strong>${escapeHtml(module.navigation_label || module.name)}</strong><small>${escapeHtml(getModuleDescription(module, bootstrap))}</small></span>
    </a>`;
}

function renderFeaturedSection(state) {
  const event = getFeaturedEvent(state.content.events);
  const coverUrl = sanitizePublicAssetUrl(event?.image_url || state.bootstrap.branding?.cover_image_url);
  const title = event?.title || `Viva o melhor do ${state.bootstrap.short_name || state.bootstrap.name}`;
  const summary = event?.summary || "Descubra experiências e informações preparadas para tornar sua estadia ainda mais especial.";
  const date = event ? formatEventDate(event, state.bootstrap) : null;

  return `
    <section class="home-feature-section guest-section">
      <article class="featured-home-card${coverUrl ? " has-image" : ""}">
        ${coverUrl ? `<img class="featured-home-image" src="${escapeHtml(coverUrl)}" alt="" loading="lazy">` : ""}
        <div class="featured-home-inner">
          <span class="guest-pill">${event ? "Evento em destaque" : "Sua estadia"}</span>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(summary)}</p>
          ${date ? `<div class="feature-meta"><span>${icon("calendar")}${escapeHtml(date)}</span></div>` : ""}
        </div>
      </article>
    </section>`;
}

function renderInformationSection(state) {
  const items = state.content.information.slice(0, 3);
  return `
    <section class="home-info-section guest-section">
      <div class="guest-section-heading">
        <h2 class="guest-section-title">Informações do hotel</h2>
        <button type="button" data-portal-tab="hotel">Ver todas</button>
      </div>
      ${items.length
        ? `<div class="info-list">${items.map(renderInfoRow).join("")}</div>`
        : renderEmptyState("As informações da unidade estarão disponíveis aqui.")}
    </section>`;
}

function renderServicesView(state) {
  const services = getServiceModules(state.bootstrap);
  return renderSubpage(
    "Serviços",
    "Tudo o que está disponível durante a sua estadia.",
    services.length
      ? `<div class="guest-landscape-list">${services.map((module) => renderServiceLandscape(module, state.bootstrap)).join("")}</div>`
      : renderEmptyState("Nenhum serviço disponível no momento."),
    "services",
  );
}

function renderServiceLandscape(module, bootstrap) {
  const imageUrl = sanitizePublicAssetUrl(module.background_image_url);
  return `
    <a class="guest-landscape-card${imageUrl ? " has-image" : ""}" href="${escapeHtml(getModulePath(bootstrap, module.module_key))}">
      ${imageUrl ? `<img class="guest-landscape-media" src="${escapeHtml(imageUrl)}" alt="" loading="lazy">` : ""}
      <span class="guest-landscape-icon">${icon(moduleIcon(module.module_key))}</span>
      <span class="guest-landscape-copy">
        <strong>${escapeHtml(module.navigation_label || module.name)}</strong>
        <small>${escapeHtml(getModuleDescription(module, bootstrap))}</small>
      </span>
      ${icon("chevron")}
    </a>`;
}

function renderEventsView(state) {
  const events = state.content.events;
  const content = events.length
    ? `<div class="guest-content-grid">${events.map((event) => renderEventCard(event, state.bootstrap)).join("")}</div>`
    : renderEmptyState("Não há eventos publicados para este período.");
  return renderSubpage("Eventos", "Experiências e novidades durante a sua estadia.", content, "calendar");
}

function renderEventCard(event, bootstrap) {
  const imageUrl = sanitizePublicAssetUrl(event.image_url);
  return `
    <button type="button" class="guest-event-card" data-event-open="${escapeHtml(event.id)}">
      <div class="guest-event-media">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(event.image_alt || "")}" loading="lazy">` : icon("calendar")}</div>
      <div class="guest-event-copy">
        <small class="guest-content-pill">Evento · ${escapeHtml(formatEventDate(event, bootstrap))}</small>
        <h2>${escapeHtml(event.title)}</h2>
        ${event.summary ? `<p>${escapeHtml(event.summary)}</p>` : ""}
        <div class="guest-card-foot"><span>${escapeHtml(event.timezone || bootstrap.timezone)}</span><b>Ver detalhes</b></div>
      </div>
    </button>`;
}

function renderEventDetail(state) {
  const event = state.content.events.find((item) => item.id === state.selectedEventId);
  if (!event) return "";
  const imageUrl = sanitizePublicAssetUrl(event.image_url);
  return `
    <div class="event-detail-backdrop" role="dialog" aria-modal="true" aria-label="Detalhes do evento">
      <article class="event-detail-sheet">
        <button type="button" class="event-detail-close" data-event-close aria-label="Fechar detalhes">${icon("close")}</button>
        <div class="event-detail-media">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(event.image_alt || "")}">` : icon("calendar")}</div>
        <div class="event-detail-copy">
          <small class="guest-content-pill">${icon("calendar")} ${escapeHtml(formatEventDate(event, state.bootstrap))}</small>
          <h2>${escapeHtml(event.title)}</h2>
          ${event.summary ? `<p>${escapeHtml(event.summary)}</p>` : ""}
          <span>${icon("pin")}${escapeHtml(state.bootstrap.short_name || state.bootstrap.name)}</span>
        </div>
      </article>
    </div>`;
}

function renderHotelView(state) {
  const information = state.content.information;
  const content = information.length
    ? `<div class="info-list info-list-full">${information.map(renderInfoRow).join("")}</div>`
    : renderEmptyState("As informações da unidade estarão disponíveis aqui.");
  return renderSubpage("Hotel", "Horários, serviços e informações úteis para a sua estadia.", content, "hotel");
}

function renderPagesView(state) {
  if (state.blogLoading) return renderSubpage("Blog", "Conteúdos e novidades dos Hotéis Fioreze.", renderInlineLoading("Carregando blog..."), "blog");
  if (!state.blogAvailable) return renderSubpage("Blog", "Conteúdos e novidades dos Hotéis Fioreze.", renderEmptyState("Blog indisponível no momento."), "blog");
  if (!state.blogPosts.length) return renderSubpage("Blog", "Conteúdos e novidades dos Hotéis Fioreze.", renderInlineLoading("Preparando o blog..."), "blog");
  const [featured, ...posts] = state.blogPosts;
  return renderSubpage(
    "Blog",
    "Conteúdos e novidades dos Hotéis Fioreze.",
    `<div class="guest-blog-shell">${renderBlogCard(featured, true)}<div class="guest-blog-grid">${posts.map((post) => renderBlogCard(post)).join("")}</div></div>`,
    "blog",
  );
}

function renderBlogCard(post, featured = false) {
  const link = sanitizeExternalUrl(post.link);
  const image = sanitizeExternalUrl(post.image_url);
  if (!link) return "";
  return `
    <a class="guest-blog-card${featured ? " is-featured" : ""}" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">
      <div class="guest-blog-media">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : icon("blog")}</div>
      <div class="guest-blog-copy">
        <small class="guest-content-pill">${featured ? `${icon("blog")} Blog Fioreze` : escapeHtml(formatBlogDate(post.published_at))}</small>
        <h2>${escapeHtml(post.title)}</h2>
        ${post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ""}
        <div class="guest-card-foot"><span>${featured ? escapeHtml(formatBlogDate(post.published_at)) : ""}</span><b>Ler artigo</b></div>
      </div>
    </a>`;
}

function renderSubpage(title, subtitle, content, iconName) {
  return `
    <section class="guest-subpage-head">
      <span>${icon(iconName)}</span>
      <p>Portal do Hóspede</p>
      <h1>${escapeHtml(title)}</h1>
      <div>${escapeHtml(subtitle)}</div>
    </section>
    <section class="guest-subpage-content">${content}</section>`;
}

function renderInfoRow(item) {
  return `
    <article class="info-row">
      ${icon(infoIcon(item.info_key))}
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.body)}</span>
      </div>
      ${icon("chevron")}
    </article>`;
}

function renderEmptyState(message) {
  return `<div class="guest-empty">${icon("info")}<p>${escapeHtml(message)}</p></div>`;
}

function renderInlineLoading(message) {
  return `<div class="guest-inline-loading" role="status"><span class="guest-loading-spinner" aria-hidden="true"></span><strong>${escapeHtml(message)}</strong></div>`;
}

function renderBottomNav(activeTab) {
  const activeIndex = Math.max(0, NAV_ITEMS.findIndex(([key]) => key === activeTab));
  return `
    <div class="bottom-nav-shell">
      <nav class="bottom-nav" aria-label="Navegação do Portal do Hóspede" style="--nav-index:${activeIndex}">
        <span class="nav-slider" aria-hidden="true"></span>
        ${NAV_ITEMS.map(([key, label, iconName]) => `
          <button type="button" class="${key === activeTab ? "active" : ""}" data-portal-tab="${key}"${key === activeTab ? ' aria-current="page"' : ""}>
            ${icon(iconName)}
            <span>${label}</span>
          </button>`).join("")}
      </nav>
    </div>`;
}

function getServiceModules(bootstrap) {
  return bootstrap.modules.filter((module) => !["guest-portal", "admin"].includes(module.module_key));
}

function getModulePath(bootstrap, moduleKey) {
  const navigation = bootstrap.navigation.find((item) => item.module_key === moduleKey);
  return sanitizeInternalPath(navigation?.path) || `/${encodeURIComponent(bootstrap.slug)}/${encodeURIComponent(moduleKey)}`;
}

function getModuleDescription(module, bootstrap) {
  return (
    bootstrap.settings?.[`portal.module.${module.module_key}.description`] ||
    MODULE_DESCRIPTIONS[module.module_key] ||
    `Conheça ${module.navigation_label || module.name}.`
  );
}

function getLogoUrl(branding = {}) {
  return sanitizePublicAssetUrl(branding.horizontal_logo_url || branding.logo_url || branding.icon_url);
}

function getFeaturedEvent(events = []) {
  if (!events.length) return null;
  const now = Date.now();
  return events.find((event) => Date.parse(event.ends_at || event.starts_at) >= now) || events.at(-1);
}

function getGreeting(timezone) {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: timezone }).format(new Date()));
  if (hour < 12) return "bom dia";
  if (hour < 18) return "boa tarde";
  return "boa noite";
}

function updateClock(container, timezone) {
  const target = container.querySelector("[data-hotel-clock]");
  if (!target) return;
  target.textContent = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date());
}

function formatEventDate(event, bootstrap) {
  const start = new Date(event.starts_at);
  if (Number.isNaN(start.getTime())) return "Data a confirmar";
  const formatter = new Intl.DateTimeFormat(bootstrap.locale || "pt-BR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: event.timezone || bootstrap.timezone,
  });
  return formatter.format(start);
}

function formatBlogDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Post recente";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date).replace(".", "");
}

function forecastDayLabel(value, index) {
  if (index === 0) return "Hoje";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return `Dia ${index + 1}`;
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "");
}

function sanitizeInternalPath(value) {
  const path = String(value || "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

function sanitizeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function moduleIcon(moduleKey) {
  if (moduleKey === "room-service") return "room-service";
  if (moduleKey === "emporio") return "bag";
  if (moduleKey === "spa") return "spa";
  if (moduleKey === "romantic-packages") return "heart";
  return "sparkle";
}

function weatherIcon(code) {
  if (code === 0) return "sun";
  if ([1, 2, 3, 45, 48].includes(Number(code))) return "cloud";
  if ([95, 96, 99].includes(Number(code))) return "storm";
  return "rain";
}

function infoIcon(key = "") {
  const normalized = String(key).toLowerCase();
  if (normalized.includes("wifi")) return "wifi";
  if (normalized.includes("breakfast") || normalized.includes("cafe")) return "coffee";
  if (normalized.includes("check")) return "clock";
  if (normalized.includes("location") || normalized.includes("endereco")) return "pin";
  if (normalized.includes("phone") || normalized.includes("contact")) return "phone";
  return "info";
}

function icon(name) {
  const paths = {
    home: '<path d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z"/>',
    services: '<path d="M5 14h14M7 14a5 5 0 0 1 10 0M12 7V5M4 18h16M9 18v2M15 18v2"/><path d="M10 5h4"/>',
    calendar: '<path d="M5 4v3M19 4v3M4 9h16M5 6h14a1 1 0 0 1 1 1v13H4V7a1 1 0 0 1 1-1Z"/><path d="M8 13h3M13 13h3M8 17h3"/>',
    hotel: '<path d="M4 20V7M4 14h16M20 20v-8a3 3 0 0 0-3-3H9a5 5 0 0 0-5 5"/><path d="M7 11h4a2 2 0 0 1 2 2v1H7v-3ZM4 17h16v3H4v-3Z"/>',
    blog: '<path d="M5 4h10a4 4 0 0 1 4 4v12H8a3 3 0 0 1-3-3V4Z"/><path d="M8 8h7M8 12h8M8 16h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    "room-service": '<path d="M5 14h14M7 14a5 5 0 0 1 10 0M12 7V5M4 18h16"/><path d="M10 5h4"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
    spa: '<path d="M12 21c-4-2-6-5-6-9 3 0 5 1 6 3 1-2 3-3 6-3 0 4-2 7-6 9Z"/><path d="M12 15c-2-2-3-5 0-9 3 4 2 7 0 9Z"/>',
    heart: '<path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',
    sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 3v4M21 5h-4"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    wifi: '<path d="M4 9a12 12 0 0 1 16 0M7 12a8 8 0 0 1 10 0M10 15a3 3 0 0 1 4 0"/><circle cx="12" cy="19" r="1"/>',
    coffee: '<path d="M5 8h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2M8 4v2M12 4v2"/>',
    phone: '<path d="M7 3h3l1 5-2 1a15 15 0 0 0 6 6l1-2 5 1v3c0 2-2 4-4 4A16 16 0 0 1 3 7c0-2 2-4 4-4Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 9.2 4.5 4.5 0 0 0 7 18Z"/>',
    rain: '<path d="M7 15h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 6.2 4.5 4.5 0 0 0 7 15Z"/><path d="m8 19-1 2M13 19l-1 2M18 19l-1 2"/>',
    storm: '<path d="M7 14h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 5.2 4.5 4.5 0 0 0 7 14Z"/><path d="m13 15-3 4h3l-2 3"/>',
    droplet: '<path d="M12 3s5 5.5 5 10a5 5 0 0 1-10 0c0-4.5 5-10 5-10Z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    "chevron-back": '<path d="m15 5-7 7 7 7"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.info}</svg>`;
}
