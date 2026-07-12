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
  els.themeToggle.addEventListener("click", () => {
    const next = document.body.dataset.rsTheme === "dark" ? "light" : "dark";
    onPreferenceChange({ theme: next });
  });
  els.compactToggle.addEventListener("click", () => {
    onPreferenceChange({ compact: !els.shell.classList.contains("is-compact") });
  });
  els.mobileMenuButton.addEventListener("click", () => els.shell.classList.toggle("is-menu-open"));

  function renderNav() {
    const permissions = new Set(session?.permissions || []);
    els.nav.innerHTML = NAV_ITEMS.map((item) => {
      if (!permissions.has(item.permission)) return "";
      return `<button type="button" data-route="${item.key}" aria-current="${item.key === activeRoute ? "page" : "false"}"><span>${item.label}</span></button>`;
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
    els.themeToggle.textContent = next.theme === "dark" ? "Tema claro" : "Tema escuro";
  }

  return {
    setRoute(route) {
      activeRoute = route;
      renderNav();
    },
    applyPreferences,
  };
}
