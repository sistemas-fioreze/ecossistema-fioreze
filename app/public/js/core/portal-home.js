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
import { formatRoomServiceHours } from "./service-hours.js";

const MODULE_DESCRIPTIONS = {
  "room-service": "RefeiÃ§Ãµes e bebidas no conforto da sua acomodaÃ§Ã£o.",
  emporio: "Chocolates, souvenirs e produtos selecionados.",
  spa: "Massagens, tratamentos e momentos de bem-estar.",
  "romantic-packages": "DecoraÃ§Ãµes e experiÃªncias para momentos especiais.",
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
      <h1>NÃ£o foi possÃ­vel abrir o portal</h1>
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
  if (sç­u¶‰ËkºwµçY½Éµ…ÑI½½µM•ÉÙ¥•!½ÕÉÌ¡ÍÑ…Ñ”¹‰½½ÑÍÑÉ…À¹Í•ÉÙ¥•}¡½ÕÉÌü¹l‰É½½´µÍ•ÉÙ¥”‰t¤ô(€€€€è¥Ñ•´¤ì(€É•ÑÕÉ¸€‘íÉ•¹‘•ÉÁÁQ½À¡ÍÑ…Ñ”°€‰!½Ñ•°ˆ°€‰!½Ë…É¥½Ì°Í•ÉÙ§½Ì°±½…±¥é‡Ÿ¼”¥¹™½Éµ‡ŸÕ•ÌƒéÑ•¥ÌÁ…É„„ÍÕ„•ÍÑ…‘¥„¸ˆ°€‰¡½Ñ•°ˆ¥ô(€€€€ñµ…¥¸±…ÍÌô‰•µ‰•µÍ¡•±°Á½ÉÑ…°µ½¹Ñ•¹ĞµÍ¡•±°¡½Ñ•°µ¥¹™¼µÍ¡•±°‘íÕ¥‘•1…å½ÕĞ€ü€ˆ¥ÌµÕ•ÍĞµÕ¥‘”ˆ€è€ˆ‰ôˆø(€€€€€€‘íµ…ÁÍô(€€€€€€‘í¥¹™½Éµ…Ñ¥½¸¹±•¹Ñ €ü€ñ‘¥Ø±…ÍÌô‰¡½Ñ•°µ¥¹™¼µÉ¥ˆø‘í¥¹™½Éµ…Ñ¥½¸¹µ…À ¡¥Ñ•´¤€ôøÉ•¹‘•É!½Ñ•±%¹™½…É¡¥Ñ•´°Õ¥‘•1…å½ÕĞ¤¤¹©½¥¸ ˆˆ¥ôğ½‘¥Øù€€èÉ•¹‘•ÉµÁÑåMÑ…Ñ” ‰Ì¥¹™½Éµ‡ŸÕ•Ì‘„Õ¹¥‘…‘”•ÍÑ…Ë¼‘¥ÍÁ½»µÙ•¥Ì…ÅÕ¤¸ˆ¥ô(€€€€ğ½µ…¥¸ù€ì)ô()™Õ¹Ñ¥½¸…ÉÉ…¹•Õ¥‘•%¹™½Éµ…Ñ¥½¸¡¥¹™½Éµ…Ñ¥½¸€ômt¤ì(€½¹ÍĞİ¥™¥%¹‘•à€ô¥¹™½Éµ…Ñ¥½¸¹™¥¹‘%¹‘•à ¡¥Ñ•´¤€ôø¥Ñ•´¹¥¹™½}­•ä€ôôô€‰İ¥™¤ˆ¤ì(€½¹ÍĞ‰…‰å%¹‘•à€ô¥¹™½Éµ…Ñ¥½¸¹™¥¹‘%¹‘•à ¡¥Ñ•´¤€ôø¥Ñ•´¹¥¹™½}­•ä€ôôô€‰‰…‰äµ­¥Ñ¡•¸ˆ¤ì(€¥˜€¡İ¥™¥%¹‘•à€ğ€Àñğ‰…‰å%¹‘•à€ğ€À¤É•ÑÕÉ¸¥¹™½Éµ…Ñ¥½¸ì(€½¹ÍĞÁ…¥É%¹‘•à€ô5…Ñ ¹µ¥¸¡İ¥™¥%¹‘•à°‰…‰å%¹‘•à¤ì(€½¹ÍĞÉ•µ…¥¹¥¹œ€ô¥¹™½Éµ…Ñ¥½¸¹™¥±Ñ•È ¡¥Ñ•´¤€ôø€…l‰İ¥™¤ˆ°€‰‰…‰äµ­¥Ñ¡•¸‰t¹¥¹±Õ‘•Ì¡¥Ñ•´¹¥¹™½}­•ä¤¤ì(€É•µ…¥¹¥¹œ¹ÍÁ±¥”¡Á…¥É%¹‘•à°€À°(€€€¥¹™½Éµ…Ñ¥½¹mİ¥™¥%¹‘•át°(€€€¥¹™½Éµ…Ñ¥½¹m‰…‰å%¹‘•át°(€€¤ì(€É•ÑÕÉ¸É•µ…¥¹¥¹œì)ô()™Õ¹Ñ¥½¸É•¹‘•É5…ÁÍM•Ñ¥½¸¡ÍÑ…Ñ”¤ì(€½¹ÍĞÕÉ±Ì€ô•Ñ5…ÁÍµ‰•‘UÉ±Ì¡ÍÑ…Ñ”¹‰½½ÑÍÑÉ…À¤ì(€¥˜€ …ÕÉ±Ì¹±•¹Ñ ¤É•ÑÕÉ¸€ˆˆì(€É•ÑÕÉ¸€(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰¡½Ñ•°µµ…ÁÌµÍ•Ñ¥½¸ˆ‘…Ñ„µµ…ÁÌµÍ•Ñ¥½¸ø(€€€€€€ñ‘¥Ø±…ÍÌô‰¡½Ñ•°µµ…ÁÌµ¡•…‘¥¹œˆø‘í¥½¸ ‰Á¥¸ˆ¥ôñ‘¥ØøñÍµ…±°ù1=1%i<ğ½Íµ…±°øñ Èù½µ¼¡•…Èğ½ ÈøñÀù½¹ÍÕ±Ñ”½Ì…•ÍÍ½Ì”Á½¹Ñ½Ì‘”É•™•Ë©¹¥„‘„Õ¹¥‘…‘”¸ğ½Àøğ½‘¥Øøğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÌô‰¡½Ñ•°µµ…ÁÌµÉ¥ˆø(€€€€€€€€‘íÕÉ±Ì¹µ…À ¡ÕÉ°°¥¹‘•à¤€ôø€ñ…ÉÑ¥±”±…ÍÌô‰¡½Ñ•°µµ…Àµ…Éˆøñ¥™É…µ”ÍÉŒôˆ‘í•Í…Á•!Ñµ°¡ÕÉ°¥ôˆÑ¥Ñ±”ô‰5…Á„€‘í¥¹‘•à€¬€Åô‘”€‘í•Í…Á•!Ñµ°¡ÍÑ…Ñ”¹‰½½ÑÍÑÉ…À¹Í¡½ÉÑ}¹…µ”ñğÍÑ…Ñ”¹‰½½ÑÍÑÉ…À¹¹…µ”¥ôˆ±½…‘¥¹œô‰±…éäˆÉ•™•ÉÉ•ÉÁ½±¥äô‰¹¼µÉ•™•ÉÉ•Èµİ¡•¸µ‘½İ¹É…‘”ˆÍ…¹‘‰½àô‰…±±½ÜµÍÉ¥ÁÑÌ…±±½ÜµÍ…µ”µ½É¥¥¸…±±½ÜµÁ½ÁÕÁÌˆ…±±½İ™Õ±±ÍÉ••¸øğ½¥™É…µ”øñÍÁ…¸ùI½Ñ„€‘í¥¹‘•à€¬€Åôğ½ÍÁ…¸øğ½…ÉÑ¥±”ù€¤¹©½¥¸ ˆˆ¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½Í•Ñ¥½¸ù€ì)ô()™Õ¹Ñ¥½¸É•¹‘•É!½Ñ•±%¹™½…É¡¥Ñ•´°Õ¥‘•1…å½ÕĞ€ô™…±Í”¤ì(€½¹ÍĞ­•å±…ÍÌ€ôMÑÉ¥¹œ¡¥Ñ•´¹¥¹™½}­•äñğ€‰¥¹™½Éµ…Ñ¥½¸ˆ¤¹Ñ½1½İ•É…Í” ¤¹É•Á±…” ½my„µèÀ´äµt¬½œ°€ˆ´ˆ¤ì(€É•ÑÕÉ¸€ñ…ÉÑ¥±”±…ÍÌô‰¡½Ñ•°µ¥¹™¼µ…É¥¹™¼µ­•ä´‘í•Í…Á•!Ñµ°¡­•å±…ÍÌ¥ôˆø‘í¥½¸¡¥¹™½%½¸¡¥Ñ•´¹¥¹™½}­•ä¤¥ôñ‘¥Øø‘íÕ¥‘•1…å½ÕĞ€ü€ˆˆ€è€ˆñÍµ…±°ù%9=I5<<!=Q0ğ½Íµ…±°ø‰ôñ Èø‘í•Í…Á•!Ñµ°¡¥Ñ•´¹Ñ¥Ñ±”¥ôğ½ ÈøñÀø‘í•Í…Á•!Ñµ°¡¥Ñ•´¹‰½‘ä¥ôğ½Àøğ½‘¥Øøğ½…ÉÑ¥±”ù€ì)ô()™Õ¹Ñ¥½¸É•¹‘•É	±½Y¥•Ü¡ÍÑ…Ñ”¤ì(€½¹ÍĞÑ½À€ôÉ•¹‘•ÉÁÁQ½À¡ÍÑ…Ñ”°€‰	±½œˆ°€‰9½Ù¥‘…‘•Ì°‘¥…Ì”½¹Ñ—é‘½Ì‘½Ì!½Ó¥¥Ì¥½É•é”¸ˆ°€‰‰±½œˆ¤ì(€¥˜€¡ÍÑ…Ñ”¹‰±½1½…‘¥¹œ¤É•ÑÕÉ¸€‘íÑ½Áôñµ…¥¸±…ÍÌô‰•µ‰•µÍ¡•±°Á½ÉÑ…°µ½¹Ñ•¹ĞµÍ¡•±°ˆ…É¥„µ‰ÕÍäô‰ÑÉÕ”ˆøğ½µ…¥¸ù€ì(€¥˜€ …ÍÑ…Ñ”¹‰±½Ù…¥±…‰±”¤É•ÑÕÉ¸€‘íÑ½Áôñµ…¥¸±…ÍÌô‰•µ‰•µÍ¡•±°Á½ÉÑ…°µ½¹Ñ•¹ĞµÍ¡•±°ˆø‘íÉ•¹‘•ÉµÁÑåMÑ…Ñ” ‰	±½œ¥¹‘¥ÍÁ½»µÙ•°¹¼µ½µ•¹Ñ¼¸ˆ¥ôğ½µ…¥¸ù€ì(€¥˜€ …ÍÑ…Ñ”¹‰±½A½ÍÑÌ¹±•¹Ñ ¤É•ÑÕÉ¸€‘íÑ½Áôñµ…¥¸±…ÍÌô‰•µ‰•µÍ¡•±°Á½ÉÑ…°µ½¹Ñ•¹ĞµÍ¡•±°ˆø‘íÉ•¹‘•ÉµÁÑåMÑ…Ñ” ‰9•¹¡Õµ„¹½Óµ¥„ÁÕ‰±¥…‘„¹¼µ½µ•¹Ñ¼¸ˆ¥ôğ½µ…¥¸ù€ì(€½¹ÍĞm™•…ÑÕÉ•°€¸¸¹Á½ÍÑÍt€ôÍÑ…Ñ”¹‰±½A½ÍÑÌì(€É•ÑÕÉ¸€‘íÑ½Áôñµ…¥¸±…ÍÌô‰•µ‰•µÍ¡•±°‰±½œµÍ¡•±°ˆø‘íÉ•¹‘•É	±½…É¡™•…ÑÕÉ•°ÑÉÕ”¥ôñ‘¥Ø±…ÍÌô‰Õ•ÍĞµ‰±½œµÉ¥ˆø‘íÁ½ÍÑÌ¹µ…À ¡Á½ÍĞ¤€ôøÉ•¹‘•É	±½…É¡Á½ÍĞ¤¤¹©½¥¸ ˆˆ¥ôğ½‘¥Øøğ½µ…¥¸ù€ì)ô()™Õ¹Ñ¥½¸É•¹‘•É	±½…É¡Á½ÍĞ°™•…ÑÕÉ•€ô™…±Í”¤ì(€½¹ÍĞ±¥¹¬€ôÍ…¹¥Ñ¥é•áÑ•É¹…±UÉ°¡Á½ÍĞ¹±¥¹¬¤ì(€½¹ÍĞ¥µ…”€ôÍ…¹¥Ñ¥é•áÑ•É¹…±UÉ°¡Á½ÍĞ¹¥µ…•}ÕÉ°¤ì(€¥˜€ …±¥¹¬¤É•ÑÕÉ¸€ˆˆì(€É•ÑÕÉ¸€ñ„±…ÍÌô‰Õ•ÍĞµ‰±½œµ…É‘í™•…ÑÕÉ•€ü€ˆ¥Ìµ™•…ÑÕÉ•ˆ€è€ˆ‰ôˆ¡É•˜ôˆ‘í•Í…Á•!Ñµ°¡±¥¹¬¥ôˆÑ…É•Ğô‰}‰±…¹¬ˆÉ•°ô‰¹½½Á•¹•È¹½É•™•ÉÉ•Èˆø(€€€€ñ‘¥Ø±…ÍÌô‰Õ•ÍĞµ‰±½œµµ•‘¥„ˆø‘í¥µ…”€ü€ñ¥µœÍÉŒôˆ‘í•Í…Á•!Ñµ°¡¥µ…”¥ôˆ…±Ğôˆˆ±½…‘¥¹œô‰±…éäˆù€€è¥½¸ ‰‰±½œˆ¥ôğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÌô‰Õ•ÍĞµ‰±½œµ½ÁäˆøñÍµ…±°±…ÍÌô‰Õ•ÍĞµ½¹Ñ•¹ĞµÁ¥±°ˆø‘í™•…ÑÕÉ•€ü€‘í¥½¸ ‰‰±½œˆ¥ô	±½œ¥½É•é•€€è•Í…Á•!Ñµ°¡™½Éµ…Ñ	±½…Ñ”¡Á½ÍĞ¹ÁÕ‰±¥Í¡•‘}…Ğ¤¥ôğ½Íµ…±°øñ Èø‘í•Í…Á•!Ñµ°¡Á½ÍĞ¹Ñ¥Ñ±”¥ôğ½ Èø‘íÁ½ÍĞ¹•á•ÉÁĞ€ü€ñÀø‘í•Í…Á•!Ñµ°¡Á½ÍĞ¹•á•ÉÁĞ¥ôğ½Àù€€è€ˆ‰ôñ‘¥Ø±…ÍÌô‰Õ•ÍĞµ…Éµ™½½ĞˆøñÍÁ…¸ø‘í™•…ÑÕÉ•€ü•Í…Á•!Ñµ°¡™½Éµ…Ñ	±½…Ñ”¡Á½ÍĞ¹ÁÕ‰±¥Í¡•‘}…Ğ¤¤€è€ˆ‰ôğ½ÍÁ…¸øñˆù1•È…ÉÑ¥¼ğ½ˆøğ½‘¥Øøğ½‘¥Øø(€€ğ½„ù€ì)ô()™Õ¹Ñ¥½¸É•¹‘•É%¹™½I½Ü¡¥Ñ•´¤ì(€É•ÑÕÉ¸€ñ…ÉÑ¥±”±…ÍÌô‰¥¹™¼µÉ½Üˆø‘í¥½¸¡¥¹™½%½¸¡¥Ñ•´¹¥¹™½}­•ä¤¥ôñ‘¥ØøñÍÑÉ½¹œø‘í•Í…Á•!Ñµ°¡¥Ñ•´¹Ñ¥Ñ±”¥ôğ½ÍÑÉ½¹œøñÍÁ…¸ø‘í•Í…Á•!Ñµ°¡¥Ñ•´¹‰½‘ä¥ôğ½ÍÁ…¸øğ½‘¥Øø‘í¥½¸ ‰¡•ÙÉ½¸ˆ¥ôğ½…ÉÑ¥±”ù€ì)ô()™Õ¹Ñ¥½¸É•¹‘•ÉµÁÑåMÑ…Ñ”¡µ•ÍÍ…”¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÌô‰Õ•ÍĞµ•µÁÑäˆø‘í¥½¸ ‰¥¹™¼ˆ¥ôñÀø‘í•Í…Á•!Ñµ°¡µ•ÍÍ…”¥ôğ½Àøğ½‘¥Øù€ì)ô()™Õ¹Ñ¥½¸•ÑM•ÉÙ¥•5½‘Õ±•Ì¡‰½½ÑÍÑÉ…À¤ì(€É•ÑÕÉ¸‰½½ÑÍÑÉ…À¹µ½‘Õ±•Ì¹™¥±Ñ•È ¡µ½‘Õ±”¤€ôø€…l‰Õ•ÍĞµÁ½ÉÑ…°ˆ°€‰…‘µ¥¸‰t¹¥¹±Õ‘•Ì¡µ½‘Õ±”¹µ½‘Õ±•}­•ä¤¤ì)ô()•áÁ½ÉĞ™Õ¹Ñ¥½¸•Ñ5½‘Õ±•A…Ñ ¡‰½½ÑÍÑÉ…À°µ½‘Õ±•-•ä¤ì(€É•ÑÕÉ¸€¼‘í•¹½‘•UI%½µÁ½¹•¹Ğ¡‰½½ÑÍÑÉ…À¹Í±Õœ¥ô¼‘í•¹½‘•UI%½µÁ½¹•¹Ğ¡µ½‘Õ±•-•ä¥õ€ì)ô()™Õ¹Ñ¥½¸•Ñ5½‘Õ±••ÍÉ¥ÁÑ¥½¸¡µ½‘Õ±”°‰½½ÑÍÑÉ…À¤ì(€É•ÑÕÉ¸‰½½ÑÍÑÉ…À¹Í•ÑÑ¥¹Ìü¹mÁ½ÉÑ…°¹µ½‘Õ±”¸‘íµ½‘Õ±”¹µ½‘Õ±•}­•åô¹‘•ÍÉ¥ÁÑ¥½¹tñğ5=U1}MI%AQ%=9Mmµ½‘Õ±”¹µ½‘Õ±•}­•åtñğ½¹¡—„€‘íµ½‘Õ±”¹¹…Ù¥…Ñ¥½¹}±…‰•°ñğµ½‘Õ±”¹¹…µ•ô¹€ì)ô()™Õ¹Ñ¥½¸•Ñ•…ÑÕÉ•‘Ù•¹Ğ¡•Ù•¹ÑÌ€ômt¤ì(€¥˜€ …•Ù•¹ÑÌ¹±•¹Ñ ¤É•ÑÕÉ¸¹Õ±°ì(€½¹ÍĞ¹½Ü€ô…Ñ”¹¹½Ü ¤ì(€É•ÑÕÉ¸•Ù•¹ÑÌ¹™¥¹ ¡•Ù•¹Ğ¤€ôø…Ñ”¹Á…ÉÍ”¡•Ù•¹Ğ¹•¹‘Í}…Ğñğ•Ù•¹Ğ¹ÍÑ…ÉÑÍ}…Ğ¤€øô¹½Ü¤ñğ•Ù•¹ÑÌ¹…Ğ ´Ä¤ì)ô()™Õ¹Ñ¥½¸™¥±Ñ•É•‘Ù•¹ÑÌ¡ÍÑ…Ñ”¤ì(€½¹ÍĞ™¥±Ñ•È€ô¹½Éµ…±¥é•¥±Ñ•È¡ÍÑ…Ñ”¹•Ù•¹Ñ¥±Ñ•È¤ì(€¥˜€¡™¥±Ñ•È€ôôô€‰Ñ½‘½Ìˆñğ™¥±Ñ•È€ôôô€‰•Ù•¹Ñ¼ˆ¤É•ÑÕÉ¸ÍÑ…Ñ”¹½¹Ñ•¹Ğ¹•Ù•¹ÑÌì(€É•ÑÕÉ¸ÍÑ…Ñ”¹½¹Ñ•¹Ğ¹•Ù•¹ÑÌ¹™¥±Ñ•È ¡•Ù•¹Ğ¤€ôøì(€€€½¹ÍĞÙ…±Õ•Ì€ôm•Ù•¹Ğ¹…Ñ•½Éä°€¸¸¸¡ÉÉ…ä¹¥ÍÉÉ…ä¡•Ù•¹Ğ¹Ñ…Ì¤€ü•Ù•¹Ğ¹Ñ…Ì€èmt¥t¹µ…À¡¹½Éµ…±¥é•¥±Ñ•È¤ì(€€€É•ÑÕÉ¸Ù…±Õ•Ì¹¥¹±Õ‘•Ì¡™¥±Ñ•È¤ì(€ô¤ì)ô()™Õ¹Ñ¥½¸•Ù•¹Ñ¥±Ñ•É=ÁÑ¥½¹Ì¡•Ù•¹ÑÌ¤ì(€½¹ÍĞÙ…±Õ•Ì€ô¹•Ü5…À¡ml‰Ñ½‘½Ìˆ°€‰Q½‘½Ì‰t°l‰•Ù•¹Ñ¼ˆ°€‰Ù•¹Ñ¼‰ut¤ì(€™½È€¡½¹ÍĞ•Ù•¹Ğ½˜•Ù•¹ÑÌ¤ì(€€€™½È€¡½¹ÍĞÙ…±Õ”½˜m•Ù•¹Ğ¹…Ñ•½Éä°€¸¸¸¡ÉÉ…ä¹¥ÍÉÉ…ä¡•Ù•¹Ğ¹Ñ…Ì¤€ü•Ù•¹Ğ¹Ñ…Ì€èmt¥t¤ì(€€€€€½¹ÍĞ±…‰•°€ôMÑÉ¥¹œ¡Ù…±Õ”ñğ€ˆˆ¤¹ÑÉ¥´ ¤ì(€€€€€½¹ÍĞ­•ä€ô¹½Éµ…±¥é•¥±Ñ•È¡±…‰•°¤ì(€€€€€¥˜€¡±…‰•°€˜˜­•ä€˜˜€…Ù…±Õ•Ì¹¡…Ì¡­•ä¤¤Ù…±Õ•Ì¹Í•Ğ¡­•ä°±…‰•°¤ì(€€€ô(€ô(€É•ÑÕÉ¸l¸¸¹Ù…±Õ•Ít¹µ…À ¡m­•ä°±…‰•±t¤€ôø€¡ì­•ä°±…‰•°ô¤¤ì)ô()™Õ¹Ñ¥½¸¹½Éµ…±¥é•¥±Ñ•È¡Ù…±Õ”¤ì(€É•ÑÕÉ¸MÑÉ¥¹œ¡Ù…±Õ”ñğ€ˆˆ¤¹ÑÉ¥´ ¤¹Ñ½1½…±•1½İ•É…Í” ‰ÁĞµ	Hˆ¤¹¹½Éµ…±¥é” ‰9ˆ¤¹É•Á±…” ½mqÔÀÌÀÀµqÔÀÌÙ™t½œ°€ˆˆ¤¹É•Á±…” ½my„µèÀ´åt¬½œ°€ˆ´ˆ¤¹É•Á±…” ½xµğ´½œ°€ˆˆ¤ì)ô()™Õ¹Ñ¥½¸•ÑÉ••Ñ¥¹œ¡Ñ¥µ•é½¹”¤ì(€½¹ÍĞ¡½ÕÈ€ô9Õµ‰•È¡¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ğ ‰ÁĞµ	Hˆ°ì¡½ÕÈè€ˆÈµ‘¥¥Ğˆ°¡½ÕÈÄÈè™…±Í”°Ñ¥µ•i½¹”èÑ¥µ•é½¹”ô¤¹™½Éµ…Ğ¡¹•Ü…Ñ” ¤¤¤ì(€¥˜€¡¡½ÕÈ€ğ€ÄÈ¤É•ÑÕÉ¸€‰‰½´‘¥„ˆì(€¥˜€¡¡½ÕÈ€ğ€Äà¤É•ÑÕÉ¸€‰‰½„Ñ…É‘”ˆì(€É•ÑÕÉ¸€‰‰½„¹½¥Ñ”ˆì)ô()™Õ¹Ñ¥½¸™½Éµ…ÑÙ•¹Ñ…ä¡•Ù•¹Ğ°‰½½ÑÍÑÉ…À¤ì(€½¹ÍĞÍÑ…ÉĞ€ô¹•Ü…Ñ”¡•Ù•¹Ğ¹ÍÑ…ÉÑÍ}…Ğ¤ì(€¥˜€¡9Õµ‰•È¹¥Í9…8¡ÍÑ…ÉĞ¹•ÑQ¥µ” ¤¤¤É•ÑÕÉ¸€‰…Ñ„„½¹™¥Éµ…Èˆì(€É•ÑÕÉ¸¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ğ¡‰½½ÑÍÑÉ…À¹±½…±”ñğ€‰ÁĞµ	Hˆ°ì‘…äè€ˆÈµ‘¥¥Ğˆ°µ½¹Ñ è€ˆÈµ‘¥¥Ğˆ°å•…Èè€‰¹Õµ•É¥Œˆ°Ñ¥µ•i½¹”è•Ù•¹Ğ¹Ñ¥µ•é½¹”ñğ‰½½ÑÍÑÉ…À¹Ñ¥µ•é½¹”ô¤¹™½Éµ…Ğ¡ÍÑ…ÉĞ¤ì)ô()™Õ¹Ñ¥½¸™½Éµ…ÑÙ•¹ÑQ¥µ”¡•Ù•¹Ğ°‰½½ÑÍÑÉ…À¤ì(€½¹ÍĞÍÑ…ÉĞ€ô¹•Ü…Ñ”¡•Ù•¹Ğ¹ÍÑ…ÉÑÍ}…Ğ¤ì(€¥˜€¡9Õµ‰•È¹¥Í9…8¡ÍÑ…ÉĞ¹•ÑQ¥µ” ¤¤¤É•ÑÕÉ¸€ˆˆì(€½¹ÍĞÑ¥µ•é½¹”€ô•Ù•¹Ğ¹Ñ¥µ•é½¹”ñğ‰½½ÑÍÑÉ…À¹Ñ¥µ•é½¹”ì(€½¹ÍĞ™É½´€ô¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ğ¡‰½½ÑÍÑÉ…À¹±½…±”ñğ€‰ÁĞµ	Hˆ°ì¡½ÕÈè€ˆÈµ‘¥¥Ğˆ°µ¥¹ÕÑ”è€ˆÈµ‘¥¥Ğˆ°Ñ¥µ•i½¹”èÑ¥µ•é½¹”ô¤¹™½Éµ…Ğ¡ÍÑ…ÉĞ¤ì(€½¹ÍĞ•¹€ô¹•Ü…Ñ”¡•Ù•¹Ğ¹•¹‘Í}…Ğñğ€ˆˆ¤ì(€¥˜€¡9Õµ‰•È¹¥Í9…8¡•¹¹•ÑQ¥µ” ¤¤¤É•ÑÕÉ¸ƒÌ€‘í™É½µõ€ì(€½¹ÍĞÑ¼€ô¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ğ¡‰½½ÑÍÑÉ…À¹±½…±”ñğ€‰ÁĞµ	Hˆ°ì¡½ÕÈè€ˆÈµ‘¥¥Ğˆ°µ¥¹ÕÑ”è€ˆÈµ‘¥¥Ğˆ°Ñ¥µ•i½¹”èÑ¥µ•é½¹”ô¤¹™½Éµ…Ğ¡•¹¤ì(€É•ÑÕÉ¸…Ì€‘í™É½µôƒÌ€‘íÑ½õ€ì)ô()™Õ¹Ñ¥½¸•Ù•¹Ñ…Ñ•-•ä¡•Ù•¹Ğ°‰½½ÑÍÑÉ…À¤ì(€½¹ÍĞ‘…Ñ”€ô¹•Ü…Ñ”¡•Ù•¹Ğ¹ÍÑ…ÉÑÍ}…Ğ¤ì(€¥˜€¡9Õµ‰•È¹¥Í9…8¡‘…Ñ”¹•ÑQ¥µ” ¤¤¤É•ÑÕÉ¸¹Õ±°ì(€½¹ÍĞÁ…ÉÑÌ€ô¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ğ ‰•¸µˆ°ìå•…Èè€‰¹Õµ•É¥Œˆ°µ½¹Ñ è€ˆÈµ‘¥¥Ğˆ°‘…äè€ˆÈµ‘¥¥Ğˆ°Ñ¥µ•i½¹”è•Ù•¹Ğ¹Ñ¥µ•é½¹”ñğ‰½½ÑÍÑÉ…À¹Ñ¥µ•é½¹”ô¤¹™½Éµ…ÑQ½A…ÉÑÌ¡‘…Ñ”¤ì(€½¹ÍĞÙ…±Õ•Ì€ô=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì¡Á…ÉÑÌ¹µ…À ¡Á…ÉĞ¤€ôømÁ…ÉĞ¹ÑåÁ”°Á…ÉĞ¹Ù…±Õ•t¤¤ì(€É•ÑÕÉ¸€‘íÙ…±Õ•Ì¹å•…Éô´‘íÙ…±Õ•Ì¹µ½¹Ñ¡ô´‘íÙ…±Õ•Ì¹‘…åõ€ì)ô()™Õ¹Ñ¥½¸¡…¹•…±•¹‘…É5½¹Ñ ¡ÍÑ…Ñ”°‘¥É•Ñ¥½¸¤ì(€½¹ÍĞ‘…Ñ”€ô¹•Ü…Ñ”¡ÍÑ…Ñ”¹…±•¹‘…Ée•…È°ÍÑ…Ñ”¹…±•¹‘…É5½¹Ñ €´€Ä€¬‘¥É•Ñ¥½¸°€Ä¤ì(€ÍÑ…Ñ”¹…±•¹‘…Ée•…È€ô‘…Ñ”¹•ÑÕ±±e•…È ¤ì(€ÍÑ…Ñ”¹…±•¹‘…É5½¹Ñ €ô‘…Ñ”¹•Ñ5½¹Ñ  ¤€¬€Äì(€ÍÑ…Ñ”¹Í•±•Ñ•‘…Ñ”€ô¹Õ±°ì)ô()™Õ¹Ñ¥½¸µ½¹Ñ¡9…µ”¡µ½¹Ñ ¤ì(€É•ÑÕÉ¸¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ğ ‰ÁĞµ	Hˆ°ìµ½¹Ñ è€‰±½¹œˆô¤¹™½Éµ…Ğ¡¹•Ü…Ñ” ÈÀÈÀ°µ½¹Ñ €´€Ä°€Ä¤¤¹É•Á±…” ½x¸¼°€¡±•ÑÑ•È¤€ôø±•ÑÑ•È¹Ñ½UÁÁ•É…Í” ¤¤ì)ô()™Õ¹Ñ¥½¸™½Éµ…Ñ…Ñ•-•ä¡Ù…±Õ”¤ì(€½¹ÍĞ‘…Ñ”€ô¹•Ü…Ñ”¡€‘íÙ…±Õ•õPÄÈèÀÀèÀÁ€¤ì(€É•ÑÕÉ¸9Õµ‰•È¹¥Í9…8¡‘…Ñ”¹•ÑQ¥µ” ¤¤€üÙ…±Õ”€è¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ğ ‰ÁĞµ	Hˆ¤¹™½Éµ…Ğ¡‘…Ñ”¤ì)ô()™Õ¹Ñ¥½¸ÍÉ½±±Ù•¹ÑÍ%¹Ñ½Y¥•Ü¡½¹Ñ…¥¹•È¤ì(€½¹Ñ…¥¹•È¹ÅÕ•ÉåM•±•Ñ½È ‰m‘…Ñ„µ•Ù•¹ÑÌµ…¹¡½Étˆ¤ü¹ÍÉ½±±%¹Ñ½Y¥•Ü¡ì‰•¡…Ù¥½Èè€‰Íµ½½Ñ ˆ°‰±½¬è€‰ÍÑ…ÉĞˆô¤ì)ô()™Õ¹Ñ¥½¸™½Éµ…Ñ	±½…Ñ”¡Ù…±Õ”¤ì(€½¹ÍĞ‘…Ñ”€ô¹•Ü…Ñ”¡Ù…±Õ”ñğ€ˆˆ¤ì(€¥˜€¡9Õµ‰•È¹¥Í9…8¡‘…Ñ”¹•ÑQ¥µ” ¤¤¤É•ÑÕÉ¸€‰A½ÍĞÉ••¹Ñ”ˆì(€É•ÑÕÉ¸¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ğ ‰ÁĞµ	Hˆ°ì‘…äè€ˆÈµ‘¥¥Ğˆ°µ½¹Ñ è€‰Í¡½ÉĞˆ°å•…Èè€‰¹Õµ•É¥Œˆô¤¹™½Éµ…Ğ¡‘…Ñ”¤¹É•Á±…” ˆ¸ˆ°€ˆˆ¤ì)ô()™Õ¹Ñ¥½¸Í…¹¥Ñ¥é•%¹Ñ•É¹…±A…Ñ ¡Ù…±Õ”¤ì(€½¹ÍĞÁ…Ñ €ôMÑÉ¥¹œ¡Ù…±Õ”ñğ€ˆˆ¤¹ÑÉ¥´ ¤ì(€¥˜€ …Á…Ñ ¹ÍÑ…ÉÑÍ]¥Ñ  ˆ¼ˆ¤ñğÁ…Ñ ¹ÍÑ…ÉÑÍ]¥Ñ  ˆ¼¼ˆ¤¤É•ÑÕÉ¸¹Õ±°ì(€É•ÑÕÉ¸Á…Ñ ì)ô()™Õ¹Ñ¥½¸Í…¹¥Ñ¥é•áÑ•É¹…±UÉ°¡Ù…±Õ”¤ì(€ÑÉäì(€€€½¹ÍĞÕÉ°€ô¹•ÜUI0¡MÑÉ¥¹œ¡Ù…±Õ”ñğ€ˆˆ¤¤ì(€€€É•ÑÕÉ¸ÕÉ°¹ÁÉ½Ñ½½°€ôôô€‰¡ÑÑÁÌèˆ€üÕÉ°¹Ñ½MÑÉ¥¹œ ¤€è¹Õ±°ì(€ô…Ñ ì(€€€É•ÑÕÉ¸¹Õ±°ì(€ô)ô()™Õ¹Ñ¥½¸•Ñ5…ÁÍµ‰•‘UÉ±Ì¡‰½½ÑÍÑÉ…À¤ì(€½¹ÍĞ½¹™¥ÕÉ•€ô‰½½ÑÍÑÉ…À¹Í•ÑÑ¥¹Ìü¹l‰½¹Ñ…Ğ¹µ…ÁÍ}•µ‰•‘}ÕÉ±Ì‰tì(€¥˜€ …ÉÉ…ä¹¥ÍÉÉ…ä¡½¹™¥ÕÉ•¤¤É•ÑÕÉ¸mtì(€É•ÑÕÉ¸½¹™¥ÕÉ•¹µ…À¡Í…¹¥Ñ¥é•½½±•5…ÁÍµ‰•‘UÉ°¤¹™¥±Ñ•È¡	½½±•…¸¤¹Í±¥” À°€Ø¤ì)ô()™Õ¹Ñ¥½¸Í…¹¥Ñ¥é•½½±•5…ÁÍµ‰•‘UÉ°¡Ù…±Õ”¤ì(€ÑÉäì(€€€½¹ÍĞÕÉ°€ô¹•ÜUI0¡MÑÉ¥¹œ¡Ù…±Õ”ñğ€ˆˆ¤¤ì(€€€½¹ÍĞ…±±½İ•‘!½ÍÑÌ€ô¹•ÜM•Ğ¡l‰İİÜ¹½½±”¹½´ˆ°€‰µ…ÁÌ¹½½±”¹½´ˆ°€‰İİÜ¹½½±”¹½´¹‰Èˆ°€‰µ…ÁÌ¹½½±”¹½´¹‰È‰t¤ì(€€€¥˜€¡ÕÉ°¹ÁÉ½Ñ½½°€„ôô€‰¡ÑÑÁÌèˆñğ€……±±½İ•‘!½ÍÑÌ¹¡…Ì¡ÕÉ°¹¡½ÍÑ¹…µ”¤ñğÕÉ°¹ÕÍ•É¹…µ”ñğÕÉ°¹Á…ÍÍİ½É¤É•ÑÕÉ¸¹Õ±°ì(€€€¥˜€ …ÕÉ°¹Á…Ñ¡¹…µ”¹ÍÑ…ÉÑÍ]¥Ñ  ˆ½µ…ÁÌ½•µ‰•ˆ¤ñğÕÉ°¹Í•…É¡A…É…µÌ¹¡…Ì ‰­•äˆ¤¤É•ÑÕÉ¸¹Õ±°ì(€€€É•ÑÕÉ¸ÕÉ°¹Ñ½MÑÉ¥¹œ ¤ì(€ô…Ñ ì(€€€É•ÑÕÉ¸¹Õ±°ì(€ô)ô()™Õ¹Ñ¥½¸µ½‘Õ±•%½¸¡µ½‘Õ±•-•ä¤ì(€¥˜€¡µ½‘Õ±•-•ä€ôôô€‰É½½´µÍ•ÉÙ¥”ˆ¤É•ÑÕÉ¸€‰É½½´µÍ•ÉÙ¥”ˆì(€¥˜€¡µ½‘Õ±•-•ä€ôôô€‰•µÁ½É¥¼ˆ¤É•ÑÕÉ¸€‰‰…œˆì(€¥˜€¡µ½‘Õ±•-•ä€ôôô€‰ÍÁ„ˆ¤É•ÑÕÉ¸€‰ÍÁ„ˆì(€¥˜€¡µ½‘Õ±•-•ä€ôôô€‰É½µ…¹Ñ¥ŒµÁ…­…•Ìˆ¤É•ÑÕÉ¸€‰ÍÁ…É­±”ˆì(€¥˜€¡µ½‘Õ±•-•ä€ôôô€‰Á½½°ˆ¤É•ÑÕÉ¸€‰Á½½°ˆì(€É•ÑÕÉ¸€‰ÍÁ…É­±”ˆì)ô()™Õ¹Ñ¥½¸¥¹™½%½¸¡­•ä€ô€ˆˆ¤ì(€½¹ÍĞ¹½Éµ…±¥é•€ôMÑÉ¥¹œ¡­•ä¤¹Ñ½1½İ•É…Í” ¤ì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰É½½´µÍ•ÉÙ¥”ˆ¤¤É•ÑÕÉ¸€‰É½½´µÍ•ÉÙ¥”ˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰Ñ¡”ˆ¤ñğ¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰¡¥µ…ÉÉ…¼ˆ¤ñğ¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰µ…Ñ”ˆ¤¤É•ÑÕÉ¸€‰¡¥µ…ÉÉ…¼ˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰İ¥™¤ˆ¤¤É•ÑÕÉ¸€‰İ¥™¤ˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰‰É•…­™…ÍĞˆ¤ñğ¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰…™”ˆ¤¤É•ÑÕÉ¸€‰½™™•”ˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰Íµ½­¥¹œˆ¤¤É•ÑÕÉ¸€‰¹¼µÍµ½­¥¹œˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰É••ÁÑ¥½¸ˆ¤¤É•ÑÕÉ¸€‰É••ÁÑ¥½¸ˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰‰…‰äˆ¤¤É•ÑÕÉ¸€‰‰…‰äˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰™¥Ñ¹•ÍÌˆ¤¤É•ÑÕÉ¸€‰™¥Ñ¹•ÍÌˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰­¥‘Ìˆ¤¤É•ÑÕÉ¸€‰­¥‘Ìˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰±½Õ¹”ˆ¤¤É•ÑÕÉ¸€‰±½Õ¹”ˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰Ñ• ˆ¤¤É•ÑÕÉ¸€‰Ñ• ˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰Ù½±Ñ…”ˆ¤¤É•ÑÕÉ¸€‰Ù½±Ñ…”ˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰ÅÕ¥•Ğˆ¤¤É•ÑÕÉ¸€‰ÅÕ¥•Ğˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰¡•¬ˆ¤ñğ¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰¡½ÕÈˆ¤¤É•ÑÕÉ¸€‰±½¬ˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰±½…Ñ¥½¸ˆ¤ñğ¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰•¹‘•É•¼ˆ¤ñğ¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰µ…Àˆ¤¤É•ÑÕÉ¸€‰µ…Àˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰Á¡½¹”ˆ¤ñğ¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰½¹Ñ…Ğˆ¤¤É•ÑÕÉ¸€‰Á¡½¹”ˆì(€¥˜€¡¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰ÉÕ±”ˆ¤ñğ¹½Éµ…±¥é•¹¥¹±Õ‘•Ì ‰É•É„ˆ¤¤É•ÑÕÉ¸€‰™¥±”ˆì(€É•ÑÕÉ¸€‰¥¹™¼ˆì)ô()™Õ¹Ñ¥½¸¥½¸¡¹…µ”¤ì(€½¹ÍĞÁ…Ñ¡Ì€ôì(€€€¡½µ”è€œñÁ…Ñ ô‰´Ì€ÄÄ€ä´à€ä€áØÄÁ ´ÙØ´Ù åØÙ ÍXÄÅhˆ¼øœ°(€€€Í•ÉÙ¥•Ìè€œñÁ…Ñ ô‰4Ô€ÄÑ ÄÑ4Ü€ÄÑ„Ô€Ô€À€À€Ä€ÄÀ€Á4ÄÈ€İXÕ4Ğ€Äá ÄÙ4ä€ÄáØÉ4ÄÔ€ÄáØÈˆ¼øñÁ…Ñ ô‰4ÄÀ€Õ Ğˆ¼øœ°(€€€…±•¹‘…Èè€œñÁ…Ñ ô‰4Ô€ÑØÍ4Ää€ÑØÍ4Ğ€å ÄÙ4Ô€Ù ÄÑ„Ä€Ä€À€À€Ä€Ä€ÅØÄÍ ÑXİ„Ä€Ä€À€À€Ä€Ä´Åhˆ¼øñÁ…Ñ ô‰4à€ÄÍ Í4ÄÌ€ÄÍ Í4à€Äİ Ìˆ¼øœ°(€€€¡½Ñ•°è€œñÁ…Ñ ô‰4Ğ€ÈÁXİ4Ğ€ÄÑ ÄÙ4ÈÀ€ÈÁØ´á„Ì€Ì€À€À€À´Ì´Í å„Ô€Ô€À€À€À´Ô€Ôˆ¼øñÁ…Ñ ô‰4Ü€ÄÅ Ñ„È€È€À€À€Ä€È€ÉØÅ İØ´Íi4Ğ€Äİ ÄÙØÍ ÑØ´Íhˆ¼øœ°(€€€‰±½œè€œñÁ…Ñ ô‰4Ô€Ñ ÄÁ„Ğ€Ğ€À€À€Ä€Ğ€ÑØÄÉ á„Ì€Ì€À€À€Ä´Ì´ÍXÑhˆ¼øñÁ…Ñ ô‰4à€á İ4à€ÄÉ á4à€ÄÙ Ôˆ¼øœ°(€€€±½¬è€œñ¥É±”àôˆÄÈˆäôˆÄÈˆÈôˆäˆ¼øñÁ…Ñ ô‰4ÄÈ€İØÕ°Ì€Èˆ¼øœ°(€€€Á¥¸è€œñÁ…Ñ ô‰4ÈÀ€ÄÁŒÀ€Ô´à€ÄÄ´à€ÄÅLĞ€ÄÔ€Ğ€ÄÁ„à€à€À€Ä€Ä€ÄØ€Áhˆ¼øñ¥É±”àôˆÄÈˆäôˆÄÀˆÈôˆÈ¸Ôˆ¼øœ°(€€€µ…Àè€œñÁ…Ñ ô‰´Ì€Ø€Ø´Ì€Ø€Ì€Ø´ÍØÄÕ°´Ø€Ì´Ø´Ì´Ø€ÍXÙhˆ¼øñÁ…Ñ ô‰4ä€ÍØÄÕ4ÄÔ€ÙØÄÔˆ¼øœ°(€€€™¥±”è€œñÁ…Ñ ô‰4Ü€Í İ°Ô€ÕØÄÍ İXÍhˆ¼øñÁ…Ñ ô‰4ÄĞ€ÍØÙ Õ4ä€ÄÍ Ù4ä€Äİ Øˆ¼øœ°(€€€±¥ÍĞè€œñÁ…Ñ ô‰4Ğ€Ù ÄÙ4Ğ€ÄÉ ÄÙ4Ğ€Äá ÄØˆ¼øœ°(€€€€‰É½½´µÍ•ÉÙ¥”ˆè€œñÁ…Ñ ô‰4Ô€ÄÑ ÄÑ4Ü€ÄÑ„Ô€Ô€À€À€Ä€ÄÀ€Á4ÄÈ€İXÕ4Ğ€Äá ÄØˆ¼øñÁ…Ñ ô‰4ÄÀ€Õ Ğˆ¼øœ°(€€€‰…œè€œñÁ…Ñ ô‰4Ô€á ÄÑ°´Ä€ÄÉ Ù0Ô€áhˆ¼øñÁ…Ñ ô‰4ä€åXİ„Ì€Ì€À€À€Ä€Ø€ÁØÈˆ¼øœ°(€€€ÍÁ„è€œñÁ…Ñ ô‰4ÄÈ€ÈÅŒ´Ğ´È´Ø´Ô´Ø´ä€Ì€À€Ô€Ä€Ø€Ì€Ä´È€Ì´Ì€Ø´Ì€À€Ğ´È€Ü´Ø€åhˆ¼øñÁ…Ñ ô‰4ÄÈ€ÄÕŒ´È´È´Ì´Ô€À´ä€Ì€Ğ€È€Ü€À€åhˆ¼øœ°(€€€¡•…ÉĞè€œñÁ…Ñ ô‰4ÈÀ¸à€Ô¸á„Ô¸Ô€Ô¸Ô€À€À€À´Ü¸à€Á0ÄÈ€Ø¸å°´Ä¸Ä´Ä¸Å„Ô¸Ô€Ô¸Ô€À€À€À´Ü¸à€Ü¸á0ÄÈ€ÈÉ°à¸à´à¸Ñ„Ô¸Ô€Ô¸Ô€À€À€À€À´Ü¸áhˆ¼øœ°(€€€ÍÁ…É­±”è€œñÁ…Ñ ô‰´ÄÈ€Ì€Ä¸à€Ô¸É0Ää€ÄÁ°´Ô¸È€Ä¸á0ÄÈ€Äİ°´Ä¸à´Ô¸É0Ô€ÄÁ°Ô¸È´Ä¸á0ÄÈ€Íhˆ¼øñÁ…Ñ ô‰4Ää€ÍØÑ4ÈÄ€Õ ´Ğˆ¼øœ°(€€€¡•ÙÉ½¸è€œñÁ…Ñ ô‰´ä€Ô€Ü€Ü´Ü€Üˆ¼øœ°(€€€İ¥™¤è€œñÁ…Ñ ô‰4Ğ€å„ÄÈ€ÄÈ€À€À€Ä€ÄØ€Á4Ü€ÄÉ„à€à€À€À€Ä€ÄÀ€Á4ÄÀ€ÄÕ„Ì€Ì€À€À€Ä€Ğ€Àˆ¼øñ¥É±”àôˆÄÈˆäôˆÄäˆÈôˆÄˆ¼øœ°(€€€½™™•”è€œñÁ…Ñ ô‰4Ô€á ÄÅØİ„Ğ€Ğ€À€À€Ä´Ğ€Ñ å„Ğ€Ğ€À€À€Ä´Ğ´ÑXáhˆ¼øñÁ…Ñ ô‰4ÄØ€ÄÁ É„È€È€À€À€Ä€À€Ñ ´É4à€ÑØÉ4ÄÈ€ÑØÈˆ¼øœ°(€€€Á¡½¹”è€œñÁ…Ñ ô‰4Ü€Í Í°Ä€Ô´È€Å„ÄÔ€ÄÔ€À€À€À€Ø€Ù°Ä´È€Ô€ÅØÍŒÀ€È´È€Ğ´Ğ€ÑÄØ€ÄØ€À€À€Ä€Ì€İŒÀ´È€È´Ğ€Ğ´Ñhˆ¼øœ°(€€€€‰¹¼µÍµ½­¥¹œˆè€œñÁ…Ñ ô‰4Ğ€Äİ ÄÙ4Ü€ÄÍ ÄÁ„È€È€À€À€Ä€È€ÉØÉ ÕØ´É„È€È€À€À€Ä€È´Éhˆ¼øñÁ…Ñ ô‰4ÄĞ€áŒÀ´È€Ì´È€Ì´Ñ4Ì€Í°Äà€Äàˆ¼øœ°(€€€É••ÁÑ¥½¸è€œñ¥É±”àôˆÄÈˆäôˆÜˆÈôˆÌˆ¼øñÁ…Ñ ô‰4Ô€ÈÁØ´É„Ü€Ü€À€À€Ä€ÄĞ€ÁØÉ4Ì€ÈÁ Äàˆ¼øœ°(€€€‰…‰äè€œñÁ…Ñ ô‰4ÄÀ€É Ñ°Ä€Í å°Ä´Íhˆ¼øñÁ…Ñ ô‰4ä€Õ ÙØÍ°È€ÍØá„È€È€À€À€Ä´È€É å„È€È€À€À€Ä´È´ÉØ´á°È´ÍXÕhˆ¼øñÁ…Ñ ô‰4ä€å Ù4ä€ÄÍ Õ4ä€Äİ Ğˆ¼øœ°(€€€™¥Ñ¹•ÍÌè€œñÁ…Ñ ô‰4Ğ€ÄÁØÑ4Ü€áØá4ÄÜ€áØá4ÈÀ€ÄÁØÑ4Ü€ÄÉ ÄÀˆ¼øœ°(€€€­¥‘Ìè€œñ¥É±”àôˆàˆäôˆàˆÈôˆÌˆ¼øñ¥É±”àôˆÄØˆäôˆàˆÈôˆÌˆ¼øñÁ…Ñ ô‰4Ì€ÈÁØ´É„Ô€Ô€À€À€Ä€ÄÀ€ÁØÉ4ÄÄ€ÈÁØ´É„Ô€Ô€À€À€Ä€ÄÀ€ÁØÈˆ¼øœ°(€€€±½Õ¹”è€œñÁ…Ñ ô‰4Ô€ÄÉXá„È€È€À€À€Ä€È´É ÄÁ„È€È€À€À€Ä€È€ÉØÑ4Ğ€ÄÉ ÄÙØİ ÑØ´İi4Ü€ÄåØÉ4ÄÜ€ÄåØÈˆ¼øœ°(€€€Ñ• è€œñÉ•ĞàôˆÔˆäôˆÌˆİ¥‘Ñ ôˆÄĞˆ¡•¥¡ĞôˆÄàˆÉàôˆÌˆ¼øñÁ…Ñ ô‰4ä€İ Ù4ÄÀ€Äİ Ğˆ¼øœ°(€€€¡¥µ…ÉÉ…¼è€œñÁ…Ñ ô‰4Ü€å ÄÁ°´Ä€İ„Ğ€Ğ€À€À€Ä´Ğ€Ì€Ğ€Ğ€À€À€Ä´Ğ´Í0Ü€åhˆ¼øñÁ…Ñ ô‰´ÄÔ€ÄÀ€Ì´İ4Äà€Í É4ä€ÄÍ Øˆ¼øœ°(€€€Á½½°è€œñÁ…Ñ ô‰4Ì€ÄÙŒÈ€À€È€Ä¸Ô€Ğ€Ä¸ÕLä€ÄØ€ÄÄ€ÄÙÌÈ€Ä¸Ô€Ğ€Ä¸Ô€È´Ä¸Ô€Ğ´Ä¸Ô€È€Ä¸Ô€È€Ä¸Õ4Ì€ÈÁŒÈ€À€È€Ä¸Ô€Ğ€Ä¸ÕLä€ÈÀ€ÄÄ€ÈÁÌÈ€Ä¸Ô€Ğ€Ä¸Ô€È´Ä¸Ô€Ğ´Ä¸Ô€È€Ä¸Ô€È€Ä¸Õ4Ü€ÄÑXİ„Ì€Ì€À€À€Ä€Ø€Á4ÄÌ€ÄÑXå Ôˆ¼øœ°(€€€Ù½±Ñ…”è€œñÁ…Ñ ô‰´ÄÌ€È´à€ÄÉ İ°´Ä€à€à´ÄÉ ´İ°Ä´áhˆ¼øœ°(€€€ÅÕ¥•Ğè€œñÁ…Ñ ô‰4Ø€åØÙ Ñ°Ô€ÑXÕ°´Ô€Ñ Ùi4Ää€å°Ì€Ù4ÈÈ€å°´Ì€Øˆ¼øœ°(€€€¥¹™¼è€œñ¥É±”àôˆÄÈˆäôˆÄÈˆÈôˆäˆ¼øñÁ…Ñ ô‰4ÄÈ€ÄÅØÙ4ÄÈ€İ ¸ÀÄˆ¼øœ°(€€€€‰¡•ÙÉ½¸µ‰…¬ˆè€œñÁ…Ñ ô‰´ÄÔ€Ô´Ü€Ü€Ü€Üˆ¼øœ°(€€€€‰•áÑ•É¹…°µ±¥¹¬ˆè€œñÁ…Ñ ô‰4ÄĞ€Ñ ÙØÙ4ÈÀ€Ñ°´ä€äˆ¼øñÁ…Ñ ô‰4Äà€ÄÍØÙ„Ä€Ä€À€À€Ä´Ä€Å Õ„Ä€Ä€À€À€Ä´Ä´ÅXİ„Ä€Ä€À€À€Ä€Ä´Å Øˆ¼øœ°(€ôì(€É•ÑÕÉ¸€ñÍÙœ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆÙ¥•İ	½àôˆÀ€À€ÈĞ€ÈĞˆ™¥±°ô‰¹½¹”ˆÍÑÉ½­”ô‰ÕÉÉ•¹Ñ½±½ÈˆÍÑÉ½­”µİ¥‘Ñ ôˆÄ¸äˆÍÑÉ½­”µ±¥¹•…Àô‰É½Õ¹ˆÍÑÉ½­”µ±¥¹•©½¥¸ô‰É½Õ¹ˆø‘íÁ…Ñ¡Ím¹…µ•tñğÁ…Ñ¡Ì¹¥¹™½ôğ½ÍÙœù€ì)ô(