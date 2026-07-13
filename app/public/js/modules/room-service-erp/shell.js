import { NAV_ITEMS } from "./static-config.js";

export function createShell({ session, preferences, onNavigate, onHotelChange, onPreferenceChange }) {
  const els = {
    shell: document.querySelector(".rs-shell"),
    nav: document.getElementById("erpNav"),
    hotelSelect: document.getElementById("hotelSelect"),
    themeToggle: document.getElementById("themeToggle"),
    compactToggle: document.getElementById("compactToggle"),
    mobileMenuButton: document.getElementById("mobileMenuButton"),
  };

  let activeRoute = preferences.route || "dashboard";
  applyPreferences(preferences);
  renderNav();

  els.hotelSelect.addEventListener("change", () => onHotelChange(els.hotelSelect.value));
  els.themeToggle.addEventListener("click", () => onPreferenceChange({ theme: "light" }));
  els.compactToggle.addEventListener("click", () => {
    onPreferenceChange({ compact: !els.shell.classList.contains("is-compact") });
  });
  els.mobileMenuButton.addEventListener("click", () => els.shell.classList.toggle("is-menu-open"));

  function renderNav() {
    const permissions = new Set(session?.permissions || []);
    els.nav.innerHTML = NAV_ITEMS.map((item) => {
      if (!permissions.has(item.permission)) return "";
      return `<button type="button" data-route="${item.key}" aria-current="${item.key === activeRoute ? "page" : "false"}"><span class="rs-nav-icon" aria-hidden="true">${navIcon(item.key)}</span><span>${item.label}</span></button>`;
    }).join("");
    for (const button of els.nav.querySelectorAll("[data-route]")) {
      button.addEventListener("click", () => {
        activeRoute = button.dataset.route;
        renderNav();
        onNavigate(activeRoute);
      });
    }
  }

  function applyPreferences(next) {
    document.body.dataset.rsTheme = next.theme === "dark" ? "dark" : "light";
    els.shell.classList.toggle("is-compact", Boolean(next.compact));
    document.documentElement.style.setProperty("--rs-scale", String(next.scale || 1));
    els.themeToggle.textContent = "v2.0";
  }

  return {
    setRoute(route) {
      activeRoute = route;
      renderNav();
    },
    applyPreferences,
  };
}

function navIcon(route) {
  const icons = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-width="2" d="M4 6a2 2 0 0 1 2-2h3v7H4V6Zm11-2h3a2 2 0 0 1 2 2v3h-5V4ZM4 15h5v5H6a2 2 0 0 1-2-2v-3Zm11-2h5v5a2 2 0 0 1-2 2h-3v-7Z"/></svg>',
    pos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.3 2.3A1 1 0 0 0 5.4 17H17M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-width="2" d="M9 12h6m-6 4h6M7 3h5.6L19 9.4V21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path stroke-width="2" d="M13 3v6h6"/></svg>',
    guests: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-width="2" d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4" stroke-width="2"/><path stroke-width="2" d="M21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    billing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-width="2" d="M4 7h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"/><path stroke-width="2" d="M4 10h16M8 15h3"/></svg>',
    catalog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-width="2" d="M4 5h16M4 12h16M4 19h16"/><path stroke-width="2" d="M8 5v14"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-width="2" d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path stroke-width="2" d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 0 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 20 7.2l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.8.8Z"/></svg>',
  };
  return icons[route] || "";
}
