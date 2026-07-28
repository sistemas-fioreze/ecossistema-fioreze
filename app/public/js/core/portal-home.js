import { apiGet } from "./api.js";
import { trackPortalVisit } from "./analytics.js";
import { escapeHtml } from "./errors.js";
import {
  bindGuestNavigation,
  closeGuestNavigation,
  PORTAL_NAV_ITEMS,
  renderGuestNavigation,
  syncGuestHeader,
} from "./guest-navigation.js";
import { sanitizePublicAssetUrl } from "./theme.js";

const MODULE_DESCRIPTIONS = {
  "room-service": "Refeições e bebidas no conforto da sua acomodação.",
  emporio: "Chocolates, souvenirs e produtos selecionados.",
  spa: "Massagens, tratamentos e momentos de bem-estar.",
  "romantic-packages": "Experiências especiais para celebrar a dois.",
};

const EVENT_PAGE_SIZE = 8;
const MOBILE_SWIPE_MIN_DISTANCE = 56;
const MOBILE_SWIPE_MAX_DURATION = 700;
const MOBILE_SWIPE_AXIS_RATIO = 1.35;
const MOBILE_SWIPE_BLOCKED_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "iframe",
  "[contenteditable='true']",
  "[role='dialog']",
  ".site-header",
  ".portal-detail-view",
].join(",");
let cleanupCurrentRender = () => {};

export function resolvePortalSwipe({ activeTab, startX, startY, endX, endY, durationMs }) {
  const coordinates = [startX, startY, endX, endY, durationMs];
  if (!coordinates.every(Number.isFinite) || durationMs < 0 || durationMs > MOBILE_SWIPE_MAX_DURATION) return null;

  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const horizontalDistance = Math.abs(deltaX);
  if (horizontalDistance < MOBILE_SWIPE_MIN_DISTANCE || horizontalDistance < Math.abs(deltaY) * MOBILE_SWIPE_AXIS_RATIO) return null;

  const activeIndex = PORTAL_NAV_ITEMS.findIndex(([key]) => key === activeTab);
  if (activeIndex < 0) return null;
  const targetIndex = deltaX < 0 ? activeIndex + 1 : activeIndex - 1;
  return PORTAL_NAV_ITEMS[targetIndex]?.[0] || null;
}

export async function render(container, context) {
  cleanupCurrentRender();
  const now = new Date();
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  const initialTab = PORTAL_NAV_ITEMS.some(([key]) => key === requestedTab) ? requestedTab : "inicio";
  const state = {
    bootstrap: context.bootstrap,
    content: { pages: [], events: [], information: [] },
    selectedEventId: null,
    blogPosts: [],
    blogLoading: false,
    blogLoaded: false,
    blogAvailable: true,
    activeTab: initialTab,
    previousTab: initialTab,
    eventMode: "list",
    eventFilter: "todos",
    eventPage: 1,
    calendarTab: "stay",
    calendarYear: now.getFullYear(),
    calendarMonth: now.getMonth() + 1,
    selectedDate: null,
    stayStart: "",
    stayEnd: "",
    tabTransitionTimer: null,
    scrollHandler: null,
    eventDialogKeyHandler: null,
    previewMessageHandler: null,
    swipeGesture: null,
  };

  state.scrollHandler = () => syncHeaderScroll(container);
  state.eventDialogKeyHandler = (event) => {
    if (event.key === "Escape" && state.selectedEventId && isDesktopPortal()) closeEventDetail(container, state);
  };
  state.previewMessageHandler = (event) => {
    if (
      window.parent === window ||
      event.source !== window.parent ||
      event.origin !== window.location.origin ||
      event.data?.type !== "fioreze:guest-portal-preview"
    ) {
      return;
    }
    const preview = event.data.payload || {};
    state.bootstrap = {
      ...state.bootstrap,
      branding: { ...(state.bootstrap.branding || {}), ...(preview.branding || {}) },
      settings: { ...(state.bootstrap.settings || {}), ...(preview.settings || {}) },
      modules: Array.isArray(preview.modules) ? preview.modules : state.bootstrap.modules,
    };
    renderPortal(container, state);
    afterRender(container, state, false);
  };
  renderPortal(container, state);
  bindPortal(container, state);
  bindGuestNavigation(container);
  window.addEventListener("scroll", state.scrollHandler, { passive: true });
  window.addEventListener("keydown", state.eventDialogKeyHandler);
  window.addEventListener("message", state.previewMessageHandler);
  try {
    const slug = encodeURIComponent(context.bootstrap.slug);
    state.content = await apiGet(`/api/v1/public/hotels/${slug}/portal/home`);
    renderPortal(container, state);
    if (state.activeTab === "blog") loadBlog(container, state);
  } catch (error) {
    container.innerHTML = renderLoadError(error);
    container.querySelector("[data-reload]")?.addEventListener("click", () => window.location.reload());
  }

  cleanupCurrentRender = () => {
    if (state.tabTransitionTimer) window.clearTimeout(state.tabTransitionTimer);
    if (state.scrollHandler) window.removeEventListener("scroll", state.scrollHandler);
    if (state.eventDialogKeyHandler) window.removeEventListener("keydown", state.eventDialogKeyHandler);
    if (state.previewMessageHandler) window.removeEventListener("message", state.previewMessageHandler);
    document.body.classList.remove("event-dialog-open");
    document.body.classList.remove("guest-navigation-open");
  };
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
  const portalCover = renderPortalCover(state.bootstrap, state.activeTab);
  const navigation = renderGuestNavigation(state.bootstrap, {
    activeModule: "guest-portal",
    activeTab: state.activeTab,
    hideBrand: Boolean(state.selectedEventId),
  });
  if (state.selectedEventId) {
    if (isDesktopPortal()) {
      container.innerHTML = `${portalCover}${navigation}<div class="desktop-event-context" aria-hidden="true" inert>${renderEventsView(state)}</div><div class="desktop-event-dialog-backdrop" data-event-dialog role="dialog" aria-modal="true" aria-label="Detalhes do evento">${renderEventDetail(state)}</div>`;
      document.body.classList.add("event-dialog-open");
      container.querySelector(".desktop-event-dialog-backdrop .fixed-header-back")?.focus({ preventScroll: true });
    } else {
      document.body.classList.remove("event-dialog-open");
      container.innerHTML = `${portalCover}${navigation}${renderEventDetail(state)}`;
    }
    syncHeaderScroll(container);
    return;
  }

  document.body.classList.remove("event-dialog-open");

  const page = state.activeTab === "inicio"
    ? `<main class="guest-shell" data-guest-content>${renderHomeView(state)}</main>`
    : renderSubpageView(state);

  container.innerHTML = `
    ${portalCover}
    ${navigation}
    ${page}
  `;
  animateTabChange(container, state);
  syncHeaderScroll(container);
}

function renderPortalCover(bootstrap, activeTab) {
  const coverUrl = sanitizePublicAssetUrl(bootstrap.branding?.cover_image_url);
  if (!coverUrl) return "";
  const isDesktop = isDesktopPortal();
  const isMobileHome = !isDesktop && activeTab === "inicio";
  if (!isDesktop && !isMobileHome) return "";
  const isVideo = bootstrap.branding?.cover_media_type === "video";
  const classes = `desktop-unit-cover${isVideo ? " is-video" : ""}${isMobileHome ? " is-mobile-home" : ""}`;
  if (isVideo) {
    const autoplay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "" : " autoplay";
    return `<div class="${classes}" aria-hidden="true"><video src="${escapeHtml(coverUrl)}" muted loop playsinline preload="metadata"${autoplay}></video></div>`;
  }
  return `<div class="${classes}" aria-hidden="true"><img src="${escapeHtml(coverUrl)}" alt="" loading="eager" fetchpriority="high" decoding="async"></div>`;
}

function bindPortal(container, state) {
  container.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-portal-tab]");
    if (tabButton) {
      const focusMaps = tabButton.hasAttribute("data-portal-map-open");
      activatePortalTab(container, state, tabButton.dataset.portalTab, { scroll: !focusMaps });
      if (focusMaps) {
        window.requestAnimationFrame(() => {
          container.querySelector("[data-maps-section]")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return;
    }

    const eventButton = event.target.closest("[data-event-open]");
    if (eventButton) {
      state.selectedEventId = eventButton.dataset.eventOpen;
      renderPortal(container, state);
      if (!isDesktopPortal()) window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (event.target.closest("[data-event-close]") || event.target.matches("[data-event-dialog]")) {
      closeEventDetail(container, state);
      return;
    }

    const eventMode = event.target.closest("[data-event-mode]");
    if (eventMode) {
      state.eventMode = eventMode.dataset.eventMode;
      renderPortal(container, state);
      afterRender(container, state, false);
      return;
    }

    const eventFilter = event.target.closest("[data-event-filter]");
    if (eventFilter) {
      state.eventFilter = eventFilter.dataset.eventFilter;
      state.eventPage = 1;
      renderPortal(container, state);
      afterRender(container, state, false);
      return;
    }

    const eventPage = event.target.closest("[data-event-page]");
    if (eventPage && !eventPage.disabled) {
      state.eventPage = Number(eventPage.dataset.eventPage);
      renderPortal(container, state);
      scrollEventsIntoView(container);
      return;
    }

    const calendarTab = event.target.closest("[data-calendar-tab]");
    if (calendarTab) {
      state.calendarTab = calendarTab.dataset.calendarTab;
      renderPortal(container, state);
      afterRender(container, state, false);
      return;
    }

    const calendarMonth = event.target.closest("[data-calendar-month]");
    if (calendarMonth) {
      changeCalendarMonth(state, Number(calendarMonth.dataset.calendarMonth));
      renderPortal(container, state);
      afterRender(container, state, false);
      return;
    }

    const calendarDay = event.target.closest("[data-calendar-day]");
    if (calendarDay) {
      state.selectedDate = calendarDay.dataset.calendarDay;
      renderPortal(container, state);
      afterRender(container, state, false);
      return;
    }

    if (event.target.closest("[data-stay-apply]")) {
      state.stayStart = container.querySelector("[data-stay-start]")?.value || "";
      state.stayEnd = container.querySelector("[data-stay-end]")?.value || "";
      renderPortal(container, state);
      afterRender(container, state, false);
      return;
    }
    if (event.target.closest("[data-stay-clear]")) {
      state.stayStart = "";
      state.stayEnd = "";
      renderPortal(container, state);
      afterRender(container, state, false);
      return;
    }

    if (event.target.closest("[data-reload]")) window.location.reload();
  });

  container.addEventListener("touchstart", (event) => {
    state.swipeGesture = null;
    if (isDesktopPortal() || state.selectedEventId || event.touches.length !== 1) return;
    if (event.target.closest?.(MOBILE_SWIPE_BLOCKED_SELECTOR)) return;
    const touch = event.touches[0];
    state.swipeGesture = {
      startX: touch.clientX,
      startY: touch.clientY,
      startedAt: Date.now(),
    };
  }, { passive: true });

  container.addEventListener("touchend", (event) => {
    const gesture = state.swipeGesture;
    state.swipeGesture = null;
    if (!gesture || isDesktopPortal() || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const nextTab = resolvePortalSwipe({
      activeTab: state.activeTab,
      startX: gesture.startX,
      startY: gesture.startY,
      endX: touch.clientX,
      endY: touch.clientY,
      durationMs: Date.now() - gesture.startedAt,
    });
    if (nextTab) activatePortalTab(container, state, nextTab);
  }, { passive: true });

  container.addEventListener("touchcancel", () => {
    state.swipeGesture = null;
  }, { passive: true });
}

function activatePortalTab(container, state, nextTab, { scroll = true } = {}) {
  if (!PORTAL_NAV_ITEMS.some(([key]) => key === nextTab)) return;
  closeGuestNavigation(container);
  const changed = state.activeTab !== nextTab;
  state.previousTab = state.activeTab;
  state.activeTab = nextTab;
  state.selectedEventId = null;
  state.eventPage = 1;
  renderPortal(container, state);
  const url = new URL(window.location.href);
  if (nextTab === "inicio") url.searchParams.delete("tab");
  else url.searchParams.set("tab", nextTab);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  afterRender(container, state, scroll);
  if (state.activeTab === "blog") loadBlog(container, state);
  if (changed) trackPortalVisit(state.bootstrap.slug, nextTab);
}

function closeEventDetail(container, state) {
  const eventId = state.selectedEventId;
  state.selectedEventId = null;
  state.activeTab = "eventos";
  renderPortal(container, state);
  afterRender(container, state, false);
  window.requestAnimationFrame(() => {
    const trigger = [...container.querySelectorAll("[data-event-open]")].find((element) => element.dataset.eventOpen === eventId);
    trigger?.focus({ preventScroll: true });
  });
}

function isDesktopPortal() {
  return window.matchMedia("(min-width: 960px)").matches;
}

function afterRender(container, state, scroll = true) {
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  syncHeaderScroll(container);
}

function syncHeaderScroll(container) {
  syncGuestHeader(container);
}

function animateTabChange(container, state) {
  const changed = state.previousTab !== state.activeTab;
  if (changed) {
    container.classList.remove("portal-tab-transition");
    void container.offsetWidth;
    container.classList.add("portal-tab-transition");
    if (state.tabTransitionTimer) window.clearTimeout(state.tabTransitionTimer);
    state.tabTransitionTimer = window.setTimeout(() => {
      container.classList.remove("portal-tab-transition");
      state.tabTransitionTimer = null;
    }, 480);
  }
  state.previousTab = state.activeTab;
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

function renderSubpageView(state) {
  if (state.activeTab === "servicos") return renderServicesView(state);
  if (state.activeTab === "eventos") return renderEventsView(state);
  if (state.activeTab === "hotel") return renderHotelView(state);
  return renderBlogView(state);
}

function renderAppTop(state, title, subtitle, iconName, controls = "") {
  return `
    <section class="portal-app-top${controls ? " has-event-controls" : ""}">
      <div class="app-top-card">
        <h1 class="app-top-title">${icon(iconName)}<span>${escapeHtml(title)}</span></h1>
        <p>${escapeHtml(subtitle)}</p>
        ${controls}
      </div>
    </section>`;
}

function renderHomeView(state) {
  const { bootstrap } = state;
  const subtitle = bootstrap.settings?.["portal.welcome_text"] || bootstrap.settings?.["hosting.welcome_text"] || bootstrap.settings?.["general.short_description"] || "Aqui você encontra tudo o que precisa para aproveitar sua estadia com conforto e praticidade.";
  return `
    <section class="home-hero-copy">
      <p class="guest-kicker">Olá, ${getGreeting(bootstrap.timezone)}!</p>
      <h1 class="guest-title"><span class="guest-title-welcome">Bem-vindo ao</span> <span class="guest-title-unit">${escapeHtml(bootstrap.short_name || bootstrap.name)}</span></h1>
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
      <h2 class="guest-section-title">Serviços</h2>
      ${services.length ? `<div class="quick-grid amenities-grid">${services.slice(0, 3).map((service) => renderQuickCard(service, state.bootstrap)).join("")}</div>` : renderEmptyState("Nenhum serviço disponível no momento.")}
    </section>`;
}

function renderQuickCard(module, bootstrap) {
  const imageUrl = sanitizePublicAssetUrl(module.background_image_url);
  return `
    <a class="quick-card${imageUrl ? " has-desktop-image" : ""}" href="${escapeHtml(getModulePath(bootstrap, module.module_key))}">
      ${imageUrl ? `<img class="quick-card-media" src="${escapeHtml(imageUrl)}" alt="" loading="lazy">` : ""}
      ${icon(moduleIcon(module.module_key))}
      <strong>${escapeHtml(module.navigation_label || module.name)}</strong>
      <span>${escapeHtml(getModuleDescription(module, bootstrap))}</span>
    </a>`;
}

function renderFeaturedSection(state) {
  const event = getFeaturedEvent(state.content.events);
  const brandingCover = state.bootstrap.branding?.cover_media_type === "video" ? null : state.bootstrap.branding?.cover_image_url;
  const coverUrl = sanitizePublicAssetUrl(event?.image_url || brandingCover);
  const title = event?.title || `Viva o melhor do ${state.bootstrap.short_name || state.bootstrap.name}`;
  const summary = event?.summary || "Descubra experiências preparadas para tornar sua estadia ainda mais especial.";
  const date = event ? formatEventDay(event, state.bootstrap) : "";
  const time = event ? formatEventTime(event, state.bootstrap) : "";
  return `
    <section class="home-feature-section guest-section">
      <button type="button" class="featured-home-card${coverUrl ? " has-image" : ""}"${event ? ` data-event-open="${escapeHtml(event.id)}"` : ` data-portal-tab="eventos"`}>
        ${coverUrl ? `<img class="featured-home-image" src="${escapeHtml(coverUrl)}" alt="" loading="lazy">` : ""}
        <div class="featured-home-inner">
          <span class="guest-pill">${event ? "Evento em destaque" : "Experiência em destaque"}</span>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(summary)}</p>
          ${(date || time) ? `<div class="feature-meta">${date ? `<span>${icon("calendar")}${escapeHtml(date)}</span>` : ""}${time ? `<span>${icon("clock")}${escapeHtml(time)}</span>` : ""}</div>` : ""}
        </div>
      </button>
    </section>`;
}

function renderInformationSection(state) {
  const items = state.content.information.slice(0, 3);
  return `
    <section class="home-info-section guest-section">
      <div class="guest-section-heading"><h2 class="guest-section-title">Informações do hotel</h2><button type="button" data-portal-tab="hotel">Ver todas</button></div>
      ${items.length ? `<div class="info-list">${items.map(renderInfoRow).join("")}</div>` : renderEmptyState("As informações da unidade estarão disponíveis aqui.")}
    </section>`;
}

function renderServicesView(state) {
  const services = getServiceModules(state.bootstrap);
  return `${renderAppTop(state, "Serviços", "Room Service, Empório, Spa e experiências em uma área dedicada.", "services")}
    <main class="embed-shell portal-content-shell">
      ${services.length ? `<div class="home-landscape-list">${services.map((module) => renderServiceLandscape(module, state.bootstrap)).join("")}</div>` : renderEmptyState("Nenhum serviço disponível no momento.")}
    </main>`;
}

function renderServiceLandscape(module, bootstrap) {
  const imageUrl = sanitizePublicAssetUrl(module.background_image_url);
  return `
    <a class="home-landscape-card${imageUrl ? "" : " no-image"}" href="${escapeHtml(getModulePath(bootstrap, module.module_key))}">
      ${imageUrl ? `<img class="home-landscape-media" src="${escapeHtml(imageUrl)}" alt="" loading="lazy">` : ""}
      <span class="home-landscape-overlay"></span>
      <span class="home-landscape-copy"><h3>${escapeHtml(module.navigation_label || module.name)}</h3><p>${escapeHtml(getModuleDescription(module, bootstrap))}</p></span>
      ${icon("chevron")}
    </a>`;
}

function renderEventsView(state) {
  const controls = renderEventControls(state);
  const body = state.eventMode === "calendar" ? renderCalendarView(state) : renderEventList(state);
  return `${renderAppTop(state, "Eventos", "Experiências, avisos e novidades durante a sua estadia.", "calendar", controls)}${body}`;
}

function renderEventControls(state) {
  return `
    <div class="event-title-controls">
      <div class="event-mode-row">
        <button type="button" class="event-mode-toggle${state.eventMode === "list" ? " active" : ""}" data-event-mode="list">${icon("list")}<span>Lista</span></button>
        <button type="button" class="event-mode-toggle${state.eventMode === "calendar" ? " active" : ""}" data-event-mode="calendar">${icon("calendar")}<span>Calendário</span></button>
      </div>
      <div class="event-filter-row">
        ${eventFilterOptions(state.content.events).map((filter) => `<button type="button" class="event-filter-pill${state.eventFilter === filter.key ? " active" : ""}" data-event-filter="${escapeHtml(filter.key)}">${escapeHtml(filter.label)}</button>`).join("")}
      </div>
    </div>`;
}

function renderEventList(state) {
  const events = filteredEvents(state);
  const totalPages = Math.max(1, Math.ceil(events.length / EVENT_PAGE_SIZE));
  state.eventPage = Math.min(state.eventPage, totalPages);
  const pageItems = events.slice((state.eventPage - 1) * EVENT_PAGE_SIZE, state.eventPage * EVENT_PAGE_SIZE);
  return `
    <main class="embed-shell event-blog-grid" data-events-anchor>
      ${pageItems.length ? `<div class="event-card-grid">${pageItems.map((event) => renderEventCard(event, state.bootstrap)).join("")}</div>` : renderEmptyState("Nenhum evento encontrado para este filtro.")}
      ${renderPagination(state.eventPage, totalPages)}
    </main>`;
}

function renderEventCard(event, bootstrap) {
  const imageUrl = sanitizePublicAssetUrl(event.image_url);
  const category = event.category || "Evento";
  return `
    <button type="button" class="event-blog-card" data-event-open="${escapeHtml(event.id)}">
      <span class="event-card-media">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(event.image_alt || "")}" loading="lazy">` : icon("calendar")}</span>
      <span class="event-card-copy">
        <small class="event-card-pill">EVENTO · ${escapeHtml(formatEventDay(event, bootstrap))}</small>
        <strong>${escapeHtml(event.title)}</strong>
        ${event.summary ? `<span class="event-card-summary">${escapeHtml(event.summary)}</span>` : ""}
        <span class="event-card-foot"><b>${escapeHtml(category)}${formatEventTime(event, bootstrap) ? ` · ${escapeHtml(formatEventTime(event, bootstrap))}` : ""}</b><em>Abrir</em></span>
      </span>
    </button>`;
}

function renderPagination(page, totalPages) {
  if (totalPages <= 1) return "";
  return `<nav class="event-pagination" aria-label="Páginas de eventos">
    <button type="button" data-event-page="${page - 1}"${page <= 1 ? " disabled" : ""}>Anterior</button>
    ${Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => `<button type="button" class="${item === page ? "active" : ""}" data-event-page="${item}">${item}</button>`).join("")}
    <button type="button" data-event-page="${page + 1}"${page >= totalPages ? " disabled" : ""}>Próximo</button>
  </nav>`;
}

function renderCalendarView(state) {
  return `
    <main class="embed-shell calendar-shell">
      <div class="calendar-tabs">
        <button type="button" class="${state.calendarTab === "stay" ? "active" : ""}" data-calendar-tab="stay">${icon("calendar")}<span>Por período</span></button>
        <button type="button" class="${state.calendarTab === "month" ? "active" : ""}" data-calendar-tab="month">${icon("calendar")}<span>Mês a mês</span></button>
      </div>
      ${state.calendarTab === "stay" ? renderStayCalendar(state) : renderMonthCalendar(state)}
    </main>`;
}

function renderStayCalendar(state) {
  const active = state.stayStart && state.stayEnd;
  const events = active ? filteredEvents(state).filter((event) => {
    const key = eventDateKey(event, state.bootstrap);
    return key && key >= state.stayStart && key <= state.stayEnd;
  }) : [];
  return `
    <section class="stay-filter-card">
      <p>${icon("calendar")}<strong>Veja os eventos conforme sua estadia</strong></p>
      <div class="stay-filter-grid">
        <label><span>Check-in</span><input type="date" data-stay-start value="${escapeHtml(state.stayStart)}"></label>
        <label><span>Check-out</span><input type="date" data-stay-end value="${escapeHtml(state.stayEnd)}"></label>
      </div>
      <div class="stay-filter-actions"><button type="button" class="primary" data-stay-apply>Filtrar período</button>${active ? `<button type="button" data-stay-clear>Limpar datas</button>` : ""}</div>
    </section>
    <section class="calendar-results">
      ${active ? (events.length ? `<div class="event-card-grid">${events.map((event) => renderEventCard(event, state.bootstrap)).join("")}</div>` : renderEmptyState("Nenhum evento encontrado neste período.")) : renderEmptyState("Informe as datas de check-in e check-out para visualizar os eventos da sua estadia.")}
    </section>`;
}

function renderMonthCalendar(state) {
  const first = new Date(state.calendarYear, state.calendarMonth - 1, 1);
  const totalDays = new Date(state.calendarYear, state.calendarMonth, 0).getDate();
  const eventDates = new Set(filteredEvents(state).map((event) => eventDateKey(event, state.bootstrap)).filter(Boolean));
  const days = [];
  for (let index = 0; index < first.getDay(); index += 1) days.push('<span class="calendar-blank"></span>');
  for (let day = 1; day <= totalDays; day += 1) {
    const key = `${state.calendarYear}-${String(state.calendarMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push(`<button type="button" class="calendar-day${state.selectedDate === key ? " selected" : ""}${eventDates.has(key) ? " has-events" : ""}" data-calendar-day="${key}">${day}</button>`);
  }
  const selectedEvents = state.selectedDate ? filteredEvents(state).filter((event) => eventDateKey(event, state.bootstrap) === state.selectedDate) : [];
  return `
    <section class="month-calendar-card">
      <header><button type="button" data-calendar-month="-1" aria-label="Mês anterior">${icon("chevron-back")}</button><h2>${escapeHtml(monthName(state.calendarMonth))} ${state.calendarYear}</h2><button type="button" data-calendar-month="1" aria-label="Próximo mês">${icon("chevron")}</button></header>
      <div class="calendar-weekdays">${["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((day) => `<span>${day}</span>`).join("")}</div>
      <div class="calendar-days">${days.join("")}</div>
      <footer><span><i></i>Eventos no dia</span><span><i></i>Dia selecionado</span></footer>
    </section>
    <section class="calendar-results">${state.selectedDate ? (selectedEvents.length ? `<div class="event-card-grid">${selectedEvents.map((event) => renderEventCard(event, state.bootstrap)).join("")}</div>` : renderEmptyState(`Nenhum evento em ${formatDateKey(state.selectedDate)}.`)) : renderEmptyState("Selecione um dia no calendário para ver os eventos.")}</section>`;
}

function renderEventDetail(state) {
  const event = state.content.events.find((item) => item.id === state.selectedEventId);
  if (!event) return "";
  const imageUrl = sanitizePublicAssetUrl(event.image_url);
  const category = event.category || "Evento";
  const location = event.location || state.bootstrap.short_name || state.bootstrap.name;
  const tags = Array.isArray(event.tags) ? event.tags : [];
  const body = event.content || "";
  const actionUrl = sanitizeExternalUrl(event.action_url);
  const actionText = actionUrl ? String(event.action_text || "").trim() : "";
  return `
    <div class="portal-detail-view">
      <button type="button" class="fixed-header-back" data-event-close aria-label="Voltar">${icon("chevron-back")}<span>Voltar</span></button>
      <main class="event-detail-page">
        <div class="event-detail-layout">
          <section class="event-detail-main">
            <div class="detail-hero-media">
              ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(event.image_alt || "")}">` : `<span>${icon("calendar")}</span>`}
              <i></i><h1>${escapeHtml(event.title)}</h1>
            </div>
            <p class="event-detail-date">${escapeHtml(formatEventDay(event, state.bootstrap).toUpperCase())}${formatEventTime(event, state.bootstrap) ? ` · ${escapeHtml(formatEventTime(event, state.bootstrap).toUpperCase())}` : ""}</p>
            ${event.summary ? `<p class="event-detail-summary">${escapeHtml(event.summary)}</p>` : ""}
            ${body ? `<div class="event-detail-body">${String(body).split(/\n+/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div>` : ""}
            ${actionText ? `<a class="detail-action-button" href="${escapeHtml(actionUrl)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(actionText)}</span>${icon("external-link")}</a>` : ""}
            ${tags.length ? `<div class="event-detail-tags">${tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
          </section>
          <aside class="event-detail-aside">
            <h2>DETALHES</h2>
            <dl>
              <div><dt>LOCAL DO EVENTO</dt><dd>${escapeHtml(location)}</dd></div>
              <div><dt>TIPO / CATEGORIA</dt><dd>Evento · ${escapeHtml(category)}</dd></div>
              <div><dt>DATA E HORA DO EVENTO</dt><dd>${escapeHtml([formatEventDay(event, state.bootstrap), formatEventTime(event, state.bootstrap)].filter(Boolean).join(" · "))}</dd></div>
            </dl>
          </aside>
        </div>
      </main>
    </div>`;
}

function renderHotelView(state) {
  const maps = renderMapsSection(state);
  return `${renderAppTop(state, "Hotel", "Horários, serviços, localização e informações úteis para a sua estadia.", "hotel")}
    <main class="embed-shell portal-content-shell hotel-info-shell">
      ${maps}
      ${state.content.information.length ? `<div class="hotel-info-grid">${state.content.information.map(renderHotelInfoCard).join("")}</div>` : renderEmptyState("As informações da unidade estarão disponíveis aqui.")}
    </main>`;
}

function renderMapsSection(state) {
  const urls = getMapsEmbedUrls(state.bootstrap);
  if (!urls.length) return "";
  return `
    <section class="hotel-maps-section" data-maps-section>
      <div class="hotel-maps-heading">${icon("pin")}<div><small>LOCALIZAÇÃO</small><h2>Como chegar</h2><p>Consulte os acessos e pontos de referência da unidade.</p></div></div>
      <div class="hotel-maps-grid">
        ${urls.map((url, index) => `<article class="hotel-map-card"><iframe src="${escapeHtml(url)}" title="Mapa ${index + 1} de ${escapeHtml(state.bootstrap.short_name || state.bootstrap.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-popups" allowfullscreen></iframe><span>Rota ${index + 1}</span></article>`).join("")}
      </div>
    </section>`;
}

function renderHotelInfoCard(item) {
  return `<article class="hotel-info-card">${icon(infoIcon(item.info_key))}<div><small>INFORMAÇÃO DO HOTEL</small><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.body)}</p></div></article>`;
}

function renderBlogView(state) {
  const top = renderAppTop(state, "Blog", "Novidades, dicas e conteúdos dos Hotéis Fioreze.", "blog");
  if (state.blogLoading) return `${top}<main class="embed-shell portal-content-shell" aria-busy="true"></main>`;
  if (!state.blogAvailable) return `${top}<main class="embed-shell portal-content-shell">${renderEmptyState("Blog indisponível no momento.")}</main>`;
  if (!state.blogPosts.length) return `${top}<main class="embed-shell portal-content-shell">${renderEmptyState("Nenhuma notícia publicada no momento.")}</main>`;
  const [featured, ...posts] = state.blogPosts;
  return `${top}<main class="embed-shell blog-shell">${renderBlogCard(featured, true)}<div class="guest-blog-grid">${posts.map((post) => renderBlogCard(post)).join("")}</div></main>`;
}

function renderBlogCard(post, featured = false) {
  const link = sanitizeExternalUrl(post.link);
  const image = sanitizeExternalUrl(post.image_url);
  if (!link) return "";
  return `<a class="guest-blog-card${featured ? " is-featured" : ""}" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">
    <div class="guest-blog-media">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : icon("blog")}</div>
    <div class="guest-blog-copy"><small class="guest-content-pill">${featured ? `${icon("blog")} Blog Fioreze` : escapeHtml(formatBlogDate(post.published_at))}</small><h2>${escapeHtml(post.title)}</h2>${post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ""}<div class="guest-card-foot"><span>${featured ? escapeHtml(formatBlogDate(post.published_at)) : ""}</span><b>Ler artigo</b></div></div>
  </a>`;
}

function renderInfoRow(item) {
  return `<article class="info-row">${icon(infoIcon(item.info_key))}<div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.body)}</span></div>${icon("chevron")}</article>`;
}

function renderEmptyState(message) {
  return `<div class="guest-empty">${icon("info")}<p>${escapeHtml(message)}</p></div>`;
}

function getServiceModules(bootstrap) {
  return bootstrap.modules.filter((module) => !["guest-portal", "admin"].includes(module.module_key));
}

function getModulePath(bootstrap, moduleKey) {
  const navigation = bootstrap.navigation.find((item) => item.module_key === moduleKey);
  return sanitizeInternalPath(navigation?.path) || `/${encodeURIComponent(bootstrap.slug)}/${encodeURIComponent(moduleKey)}`;
}

function getModuleDescription(module, bootstrap) {
  return bootstrap.settings?.[`portal.module.${module.module_key}.description`] || MODULE_DESCRIPTIONS[module.module_key] || `Conheça ${module.navigation_label || module.name}.`;
}

function getFeaturedEvent(events = []) {
  if (!events.length) return null;
  const now = Date.now();
  return events.find((event) => Date.parse(event.ends_at || event.starts_at) >= now) || events.at(-1);
}

function filteredEvents(state) {
  const filter = normalizeFilter(state.eventFilter);
  if (filter === "todos" || filter === "evento") return state.content.events;
  return state.content.events.filter((event) => {
    const values = [event.category, ...(Array.isArray(event.tags) ? event.tags : [])].map(normalizeFilter);
    return values.includes(filter);
  });
}

function eventFilterOptions(events) {
  const values = new Map([["todos", "Todos"], ["evento", "Evento"]]);
  for (const event of events) {
    for (const value of [event.category, ...(Array.isArray(event.tags) ? event.tags : [])]) {
      const label = String(value || "").trim();
      const key = normalizeFilter(label);
      if (label && key && !values.has(key)) values.set(key, label);
    }
  }
  return [...values].map(([key, label]) => ({ key, label }));
}

function normalizeFilter(value) {
  return String(value || "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getGreeting(timezone) {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: timezone }).format(new Date()));
  if (hour < 12) return "bom dia";
  if (hour < 18) return "boa tarde";
  return "boa noite";
}

function formatEventDay(event, bootstrap) {
  const start = new Date(event.starts_at);
  if (Number.isNaN(start.getTime())) return "Data a confirmar";
  return new Intl.DateTimeFormat(bootstrap.locale || "pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: event.timezone || bootstrap.timezone }).format(start);
}

function formatEventTime(event, bootstrap) {
  const start = new Date(event.starts_at);
  if (Number.isNaN(start.getTime())) return "";
  const timezone = event.timezone || bootstrap.timezone;
  const from = new Intl.DateTimeFormat(bootstrap.locale || "pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(start);
  const end = new Date(event.ends_at || "");
  if (Number.isNaN(end.getTime())) return `Às ${from}`;
  const to = new Intl.DateTimeFormat(bootstrap.locale || "pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(end);
  return `Das ${from} às ${to}`;
}

function eventDateKey(event, bootstrap) {
  const date = new Date(event.starts_at);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: event.timezone || bootstrap.timezone }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function changeCalendarMonth(state, direction) {
  const date = new Date(state.calendarYear, state.calendarMonth - 1 + direction, 1);
  state.calendarYear = date.getFullYear();
  state.calendarMonth = date.getMonth() + 1;
  state.selectedDate = null;
}

function monthName(month) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2020, month - 1, 1)).replace(/^./, (letter) => letter.toUpperCase());
}

function formatDateKey(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR").format(date);
}

function scrollEventsIntoView(container) {
  container.querySelector("[data-events-anchor]")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatBlogDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Post recente";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date).replace(".", "");
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

function getMapsEmbedUrls(bootstrap) {
  const configured = bootstrap.settings?.["contact.maps_embed_urls"];
  if (!Array.isArray(configured)) return [];
  return configured.map(sanitizeGoogleMapsEmbedUrl).filter(Boolean).slice(0, 6);
}

function sanitizeGoogleMapsEmbedUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const allowedHosts = new Set(["www.google.com", "maps.google.com", "www.google.com.br", "maps.google.com.br"]);
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || url.username || url.password) return null;
    if (!url.pathname.startsWith("/maps/embed") || url.searchParams.has("key")) return null;
    return url.toString();
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

function infoIcon(key = "") {
  const normalized = String(key).toLowerCase();
  if (normalized.includes("wifi")) return "wifi";
  if (normalized.includes("breakfast") || normalized.includes("cafe")) return "coffee";
  if (normalized.includes("check") || normalized.includes("hour")) return "clock";
  if (normalized.includes("location") || normalized.includes("endereco") || normalized.includes("map")) return "map";
  if (normalized.includes("phone") || normalized.includes("contact")) return "phone";
  if (normalized.includes("rule") || normalized.includes("regra")) return "file";
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
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
    file: '<path d="M7 3h7l5 5v13H7V3Z"/><path d="M14 3v6h5M9 13h6M9 17h6"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
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
    "chevron-back": '<path d="m15 5-7 7 7 7"/>',
    "external-link": '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.info}</svg>`;
}
