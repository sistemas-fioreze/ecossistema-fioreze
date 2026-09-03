const MOBILE_STYLESHEET_HREF = "/css/modules/admin/admin-mobile-v1.css?v=20260903-1";
const MOBILE_AUTH_STYLESHEET_HREF = "/css/modules/admin/admin-mobile-auth.css?v=20260903-1";
const MOBILE_SECTIONS_STYLESHEET_HREF = "/css/modules/admin/admin-mobile-sections.css?v=20260903-1";
const MOBILE_FINAL_STYLESHEET_HREF = "/css/modules/admin/admin-mobile-v2.css?v=20260903-1";
const MOBILE_QUERY = "(max-width: 980px)";

export function setupAdminMobileV1(root = document) {
  ensureStylesheet(root, 'link[data-admin-mobile-v1]', MOBILE_STYLESHEET_HREF, "adminMobileV1");
  ensureStylesheet(root, 'link[data-admin-mobile-auth]', MOBILE_AUTH_STYLESHEET_HREF, "adminMobileAuth");
  ensureStylesheet(root, 'link[data-admin-mobile-sections]', MOBILE_SECTIONS_STYLESHEET_HREF, "adminMobileSections");
  ensureStylesheet(root, 'link[data-admin-mobile-v2]', MOBILE_FINAL_STYLESHEET_HREF, "adminMobileV2");

  const dashboard = root.querySelector('[data-view="dashboard"]');
  if (!dashboard || dashboard.dataset.mobileUx === "v2") return;
  dashboard.dataset.mobileUx = "v2";

  const mobileQuery = window.matchMedia(MOBILE_QUERY);
  const backdrop = dashboard.querySelector("[data-admin-backdrop]");

  const syncMenuState = () => {
    const isMobile = mobileQuery.matches;
    const isOpen = isMobile && dashboard.classList.contains("is-menu-open");
    root.body.classList.toggle("is-admin-mobile-menu-open", isOpen);
    for (const toggle of dashboard.querySelectorAll(".admin-shell-toggle-mobile")) {
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
      toggle.title = isOpen ? "Fechar menu" : "Abrir menu";
    }
    if (!isMobile && dashboard.classList.contains("is-menu-open")) {
      dashboard.classList.remove("is-menu-open");
      if (backdrop) backdrop.hidden = true;
    }
  };

  const closeMobileMenu = () => {
    dashboard.classList.remove("is-menu-open");
    if (backdrop) backdrop.hidden = true;
    syncMenuState();
  };

  dashboard.addEventListener("click", (event) => {
    const navigation = event.target.closest(".admin-global-nav a");
    if (navigation && mobileQuery.matches) closeMobileMenu();
  });

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileQuery.matches && dashboard.classList.contains("is-menu-open")) {
      closeMobileMenu();
    }
  });

  window.addEventListener("popstate", closeMobileMenu);
  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", syncMenuState);
  } else {
    window.addEventListener("resize", syncMenuState);
  }

  const observer = new MutationObserver(syncMenuState);
  observer.observe(dashboard, { attributes: true, attributeFilter: ["class"] });
  syncMenuState();
}

function ensureStylesheet(root, selector, href, dataName) {
  if (root.querySelector(selector)) return;
  const link = root.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset[dataName] = "";
  root.head.append(link);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setupAdminMobileV1(), { once: true });
  } else {
    setupAdminMobileV1();
  }
}
