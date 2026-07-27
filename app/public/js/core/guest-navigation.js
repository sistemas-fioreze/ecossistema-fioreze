import { escapeHtml } from "./errors.js";
import { sanitizePublicAssetUrl } from "./theme.js";

export const PORTAL_NAV_ITEMS = [
  ["inicio", "Início", "home"],
  ["servicos", "Serviços", "services"],
  ["eventos", "Eventos", "calendar"],
  ["hotel", "Hotel", "hotel"],
  ["blog", "Blog", "blog"],
];

const MODULE_ICONS = {
  "room-service": "room-service",
  emporio: "bag",
  spa: "spa",
  "romantic-packages": "heart",
};

export function renderGuestNavigation(
  bootstrap,
  { activeTab = "inicio", activeModule = "guest-portal", hideBrand = false } = {},
) {
  const homePath = `/${encodeURIComponent(bootstrap.slug)}`;
  const logoUrl = sanitizePublicAssetUrl(
    bootstrap.branding?.horizontal_logo_url || bootstrap.branding?.logo_url || bootstrap.branding?.icon_url,
  );
  const brand = logoUrl
    ? `<img class="brand-logo-img" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(bootstrap.name)}">`
    : `<strong class="brand-name-text">${escapeHtml(bootstrap.short_name || bootstrap.name)}</strong>`;
  const portalItems = PORTAL_NAV_ITEMS.map(([key, label, iconName]) =>
    renderPortalItem({ activeModule, activeTab, homePath, iconName, key, label }),
  ).join("");
  const moduleItems = getGuestModules(bootstrap).map((module) =>
    renderModuleItem(bootstrap, module, activeModule),
  ).join("");

  return `
    <header class="site-header guest-shared-header${hideBrand ? " is-brand-hidden" : ""}" data-guest-header>
      <div class="guest-brand">
        <button class="guest-menu-toggle" type="button" data-guest-menu-open aria-label="Abrir navegação" aria-expanded="false" aria-controls="guest-navigation-drawer">
          ${navigationIcon("menu")}
        </button>
        <a class="guest-brand-link" href="${escapeHtml(homePath)}" aria-label="Ir para o início de ${escapeHtml(bootstrap.name)}">${brand}</a>
        <nav class="guest-desktop-nav" aria-label="Navegação do hotel">
          ${portalItems}
          ${moduleItems ? `<span class="guest-nav-divider" aria-hidden="true"></span>${moduleItems}` : ""}
        </nav>
      </div>
    </header>
    <div class="guest-drawer-backdrop" data-guest-menu-close hidden></div>
    <aside class="guest-navigation-drawer" id="guest-navigation-drawer" data-guest-navigation-drawer aria-hidden="true" aria-label="Navegação do hotel">
      <div class="guest-drawer-head">
        <a class="guest-drawer-brand" href="${escapeHtml(homePath)}" aria-label="Ir para o início">${brand}</a>
        <button type="button" class="guest-menu-close" data-guest-menu-close aria-label="Fechar navegação">${navigationIcon("close")}</button>
      </div>
      <nav class="guest-drawer-nav">
        <p>Portal do hóspede</p>
        ${portalItems}
        ${moduleItems ? `<p>Serviços da unidade</p>${moduleItems}` : ""}
      </nav>
    </aside>`;
}

export function bindGuestNavigation(container) {
  const close = () => closeGuestNavigation(container);
  container.addEventListener("click", (event) => {
    if (event.target.closest("[data-guest-menu-open]")) {
      openGuestNavigation(container);
      return;
    }
    if (event.target.closest("[data-guest-menu-close]")) close();
  });
  container.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}

export function openGuestNavigation(container) {
  const drawer = container.querySelector("[data-guest-navigation-drawer]");
  const backdrop = container.querySelector(".guest-drawer-backdrop");
  const trigger = container.querySelector("[data-guest-menu-open]");
  if (!drawer || !backdrop || !trigger) return;
  backdrop.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
  trigger.setAttribute("aria-expanded", "true");
  document.body.classList.add("guest-navigation-open");
  window.requestAnimationFrame(() => {
    drawer.classList.add("is-open");
    backdrop.classList.add("is-open");
    drawer.querySelector("a, button")?.focus({ preventScroll: true });
  });
}

export function closeGuestNavigation(container) {
  const drawer = container.querySelector("[data-guest-navigation-drawer]");
  const backdrop = container.querySelector(".guest-drawer-backdrop");
  const trigger = container.querySelector("[data-guest-menu-open]");
  if (!drawer || !backdrop || !trigger) return;
  drawer.classList.remove("is-open");
  backdrop.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  trigger.setAttribute("aria-expanded", "false");
  document.body.classList.remove("guest-navigation-open");
  window.setTimeout(() => {
    if (!backdrop.classList.contains("is-open")) backdrop.hidden = true;
  }, 240);
}

export function syncGuestHeader(container) {
  container.querySelector("[data-guest-header]")?.classList.toggle("is-scrolled", window.scrollY > 8);
}

function renderPortalItem({ activeModule, activeTab, homePath, iconName, key, label }) {
  const active = activeModule === "guest-portal" && activeTab === key;
  const href = key === "inicio" ? homePath : `${homePath}?tab=${encodeURIComponent(key)}`;
  const action = activeModule === "guest-portal"
    ? `button type="button" data-portal-tab="${escapeHtml(key)}"`
    : `a href="${escapeHtml(href)}"`;
  const closeTag = activeModule === "guest-portal" ? "button" : "a";
  return `<${action} class="guest-nav-item${active ? " is-active" : ""}"${active ? ' aria-current="page"' : ""}>${navigationIcon(iconName)}<span>${escapeHtml(label)}</span></${closeTag}>`;
}

function renderModuleItem(bootstrap, module, activeModule) {
  const active = activeModule === module.module_key;
  const href = getModulePath(bootstrap, module.module_key);
  return `<a class="guest-nav-item${active ? " is-active" : ""}" href="${escapeHtml(href)}"${active ? ' aria-current="page"' : ""}>${navigationIcon(MODULE_ICONS[module.module_key] || "sparkle")}<span>${escapeHtml(module.navigation_label || module.name || module.module_key)}</span></a>`;
}

function getGuestModules(bootstrap) {
  return (bootstrap.modules || []).filter((module) =>
    module.enabled !== false && !["guest-portal", "admin"].includes(module.module_key),
  );
}

function getModulePath(bootstrap, moduleKey) {
  const configured = (bootstrap.navigation || []).find((item) => item.module_key === moduleKey)?.path;
  if (isSafeInternalPath(configured)) return configured;
  return `/${encodeURIComponent(bootstrap.slug)}/${encodeURIComponent(moduleKey)}`;
}

function isSafeInternalPath(value) {
  return typeof value === "string" && /^\/(?!\/)[A-Za-z0-9_~!$&'()*+,;=:@%./-]*$/.test(value);
}

export function navigationIcon(name) {
  const paths = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    home: '<path d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z"/>',
    services: '<path d="M5 14h14M7 14a5 5 0 0 1 10 0M12 7V5M4 18h16M10 5h4"/>',
    calendar: '<path d="M5 4v3M19 4v3M4 9h16M5 6h14a1 1 0 0 1 1 1v13H4V7a1 1 0 0 1 1-1Z"/><path d="M8 13h3M13 13h3M8 17h3"/>',
    hotel: '<path d="M4 20V7M4 14h16M20 20v-8a3 3 0 0 0-3-3H9a5 5 0 0 0-5 5"/><path d="M4 17h16v3H4v-3Z"/>',
    blog: '<path d="M5 4h10a4 4 0 0 1 4 4v12H8a3 3 0 0 1-3-3V4Z"/><path d="M8 8h7M8 12h8M8 16h5"/>',
    "room-service": '<path d="M5 14h14M7 14a5 5 0 0 1 10 0M12 7V5M4 18h16M10 5h4"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
    spa: '<path d="M12 21c-4-2-6-5-6-9 3 0 5 1 6 3 1-2 3-3 6-3 0 4-2 7-6 9Z"/><path d="M12 15c-2-2-3-5 0-9 3 4 2 7 0 9Z"/>',
    heart: '<path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',
    sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.sparkle}</svg>`;
}
