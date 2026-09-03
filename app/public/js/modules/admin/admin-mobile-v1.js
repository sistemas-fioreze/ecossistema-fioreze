const MOBILE_STYLESHEET_HREF = "/css/modules/admin/admin-mobile-v1.css?v=20260903-1";
const MOBILE_AUTH_STYLESHEET_HREF = "/css/modules/admin/admin-mobile-auth.css?v=20260903-1";
const MOBILE_SECTIONS_STYLESHEET_HREF = "/css/modules/admin/admin-mobile-sections.css?v=20260903-1";

export function setupAdminMobileV1(root = document) {
  ensureStylesheet(root, 'link[data-admin-mobile-v1]', MOBILE_STYLESHEET_HREF, "adminMobileV1");
  ensureStylesheet(root, 'link[data-admin-mobile-auth]', MOBILE_AUTH_STYLESHEET_HREF, "adminMobileAuth");
  ensureStylesheet(root, 'link[data-admin-mobile-sections]', MOBILE_SECTIONS_STYLESHEET_HREF, "adminMobileSections");

  const dashboard = root.querySelector('[data-view="dashboard"]');
  if (!dashboard || dashboard.dataset.mobileUx === "v1") return;
  dashboard.dataset.mobileUx = "v1";

  dashboard.addEventListener("click", (event) => {
    const navigation = event.target.closest(".admin-global-nav a");
    if (!navigation || !window.matchMedia("(max-width: 980px)").matches) return;
    dashboard.classList.remove("is-menu-open");
    const backdrop = dashboard.querySelector("[data-admin-backdrop]");
    if (backdrop) backdrop.hidden = true;
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(max-width: 980px)").matches) return;
    dashboard.classList.remove("is-menu-open");
    const backdrop = dashboard.querySelector("[data-admin-backdrop]");
    if (backdrop) backdrop.hidden = true;
  });
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
