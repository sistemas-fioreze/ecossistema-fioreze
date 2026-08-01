import { escapeHtml } from "./errors.js";
import { sanitizePublicAssetUrl } from "./theme.js";

export const PORTAL_NAV_ITEMS = [
  ["inicio", "Início", "home"],
  ["servicos", "Serviços", "services"],
  ["eventos", "Programação", "calendar"],
  ["hotel", "Hotel", "hotel"],
  ["blog", "Blog", "blog"],
];

const MODULE_ICONS = {
  "room-service": "room-service",
  emporio: "bag",
  spa: "spa",
  "romantic-packages": "sparkle",
};

const MODULE_LOGO_FIELDS = {
  "guest-portal": "guest_portal_logo_url",
  "room-service": "room_service_logo_url",
  emporio: "emporio_logo_url",
  "romantic-packages": "romantic_packages_logo_url",
  spa: "spa_logo_url",
};

export function renderGuestNavigation(
  bootstrap,
  { activeTab = "inicio", activeModule = "guest-portal", hideBrand = false } = {},
) {
  const homePath = `/${encodeURIComponent(bootstrap.slug)}`;
  const drawerTheme = bootstrap.settings?.["portal.navigation_drawer_theme"] === "dark"
    ? "dark"
    : "light";
  const headerBrand = renderBrand(bootstrap, resolveHeaderLogo(bootstrap, activeModule));
  const drawerBrand = renderBrand(
    bootstrap,
    bootstrap.branding?.navigation_logo_url || resolveHeaderLogo(bootstrap, activeModule),
  );
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
        <a class="guest-brand-link" href="${escapeHtml(homePath)}" aria-label="Ir para o início de ${escapeHtml(bootstrap.name)}">${headerBrand}</a>
        <nav class="guest-desktop-nav" aria-label="Navegação do hotel">
          ${portalItems}
          ${moduleItems ? `<span class="guest-nav-divider" aria-hidden="true"></span>${moduleItems}` : ""}
        </nav>
        <button class="guest-search-toggle" type="button" data-guest-search-toggle aria-label="Pesquisar" aria-expanded="false" aria-controls="guest-portal-search">
          ${navigationIcon("search")}
        </button>
      </div>
    </header>
    ${renderSearchPanel(bootstrap, { activeModule, homePath })}
    <div class="guest-drawer-backdrop" data-guest-menu-close hidden></div>
    <aside class="guest-navigation-drawer is-${drawerTheme}" id="guest-navigation-drawer" data-guest-navigation-drawer aria-hidden="true" aria-label="Navegação do hotel">
      <div class="guest-drawer-head">
        <button type="button" class="guest-menu-close" data-guest-menu-close aria-label="Fechar navegação">${navigationIcon("close")}</button>
        <a class="guest-drawer-brand" href="${escapeHtml(homePath)}" aria-label="Ir para o início">${drawerBrand}</a>
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
  const closeSearch = () => closeGuestSearch(container);
  container.addEventListener("click", (event) => {
    if (event.target.closest("[data-guest-menu-open]")) {
      openGuestNavigation(container);
      return;
    }
    if (event.target.closest("[data-guest-menu-close]")) {
      close();
      return;
    }
    if (event.target.closest("[data-guest-search-toggle]")) {
      toggleGuestSearch(container);
      return;
    }
    if (event.target.closest("[data-guest-search-close]")) closeSearch();
  });
  container.addEventListener("input", (event) => {
    if (!event.target.matches("[data-guest-search-input]")) return;
    const query = normalizeSearch(event.target.value);
    filterGuestSearchResults(container, query);
    window.dispatchEvent(new CustomEvent("fioreze:portal-search", { detail: { query } }));
  });
  container.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
      closeSearch();
    }
  });
}

export function toggleGuestSearch(container) {
  const panel = container.querySelector("[data-guest-search-panel]");
  const trigger = container.querySelector("[data-guest-search-toggle]");
  const input = panel?.querySelector("[data-guest-search-input]");
  if (!panel || !trigger || !input) return;
  const opening = panel.hidden;
  panel.hidden = !opening;
  trigger.setAttribute("aria-expanded", String(opening));
  if (opening) {
    window.requestAnimationFrame(() => input.focus({ preventScroll: true }));
  } else {
    clearGuestSearch(container);
  }
}

export function closeGuestSearch(container) {
  const panel = container.querySelector("[data-guest-search-panel]");
  const trigger = container.querySelector("[data-guest-search-toggle]");
  if (!panel || !trigger) return;
  panel.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
  clearGuestSearch(container);
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

function renderSearchPanel(bootstrap, { activeModule, homePath }) {
  const resultItems = activeModule === "guest-portal"
    ? [
        ...PORTAL_NAV_ITEMS.map(([key, label, iconName]) => ({
          href: key === "inicio" ? homePath : `${homePath}?tab=${encodeURIComponent(key)}`,
          iconName,
          label,
          meta: "Portal do hóspede",
        })),
        ...getGuestModules(bootstrap).map((module) => ({
          href: getModulePath(bootstrap, module.module_key),
          iconName: MODULE_ICONS[module.module_key] || "sparkle",
          label: module.navigation_label || module.name || module.module_key,
          meta: "Serviço da unidade",
        })),
      ]
    : [];
  return `
    <section class="guest-search-panel" id="guest-portal-search" data-guest-search-panel hidden>
      <div class="guest-search-field">
        ${navigationIcon("search")}
        <input type="search" data-guest-search-input autocomplete="off" placeholder="${activeModule === "guest-portal" ? "Buscar no portal" : "Buscar neste catálogo"}" aria-label="Pesquisar">
        <button type="button" data-guest-search-close aria-label="Fechar pesquisa">${navigationIcon("close")}</button>
      </div>
      ${resultItems.length
        ? `<div class="guest-search-results" data-guest-search-results>
            ${resultItems.map((item) => `
              <a href="${escapeHtml(item.href)}" data-guest-search-item data-search-text="${escapeHtml(normalizeSearch(`${item.label} ${item.meta}`))}">
                ${navigationIcon(item.iconName)}
                <span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.meta)}</small></span>
              </a>`).join("")}
            <p class="guest-search-empty" data-guest-search-empty hidden>Nenhum resultado encontrado.</p>
          </div>`
        : ""}
    </section>`;
}

function renderBrand(bootstrap, source) {
  const logoUrl = sanitizePublicAssetUrl(source);
  return logoUrl
    ? `<img class="brand-logo-img" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(bootstrap.name)}">`
    : `<strong class="brand-name-text">${escapeHtml(bootstrap.name)}</strong>`;
}

function resolveHeaderLogo(bootstrap, activeModule) {
  const branding = bootstrap.branding || {};
  return branding[MODULE_LOGO_FIELDS[activeModule]]
    || bootstrap.branding?.horizontal_logo_url
    || branding.logo_url
    || branding.icon_url;
}

function filterGuestSearchResults(container, query) {
  const items = [...container.querySelectorAll("[data-guest-search-item]")];
  if (!items.length) return;
  let visible = 0;
  for (const item of items) {
    const matches = !query || item.dataset.searchText.includes(query);
    item.hidden = !matches;
    if (matches) visible += 1;
  }
  const empty = container.querySelector("[data-guest-search-empty]");
  if (empty) empty.hidden = visible > 0;
}

function clearGuestSearch(container) {
  const input = container.querySelector("[data-guest-search-input]");
  if (input) input.value = "";
  filterGuestSearchResults(container, "");
  window.dispatchEvent(new CustomEvent("fioreze:portal-search", { detail: { query: "" } }));
}

function normalizeSearch(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
  return `/${encodeURIComponent(bootstrap.slug)}/${encodeURIComponent(moduleKey)}`;
}

export function navigationIcon(name) {
  const paths = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
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
