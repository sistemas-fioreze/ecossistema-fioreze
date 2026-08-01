import { apiGet } from "./api.js";
import { portalPageKey, trackPortalVisit } from "./analytics.js";
import { renderError, renderNotFound } from "./errors.js";
import {
  bindGuestNavigation,
  navigationIcon,
  renderGuestNavigation,
  syncGuestHeader,
} from "./guest-navigation.js";
import { loadModule } from "./module-loader.js";
import { formatRoomServiceHours } from "./service-hours.js";
import { resolveModuleFromPath, resolveSlugFromPath } from "./tenant.js";
import { applyBranding } from "./theme.js";

const app = document.getElementById("app");

async function boot() {
  const slug = resolveSlugFromPath();
  if (!slug) {
    renderNotFound(app);
    return;
  }

  const bootstrap = await apiGet(`/api/v1/public/hotels/${encodeURIComponent(slug)}/bootstrap`);
  applyBranding(bootstrap.branding);

  const requestedModule = resolveModuleFromPath(window.location.pathname);
  const enabledModules = new Set(bootstrap.modules.map((module) => module.module_key));
  if (!enabledModules.has(requestedModule)) {
    renderNotFound(app);
    return;
  }
  const moduleKey = requestedModule;
  trackPortalVisit(slug, portalPageKey(moduleKey));

  app.classList.toggle("guest-portal-root", moduleKey === "guest-portal");
  app.classList.toggle("room-service-root", moduleKey === "room-service");
  app.classList.toggle("emporio-root", moduleKey === "emporio");
  app.classList.toggle("romantic-packages-root", moduleKey === "romantic-packages");
  app.classList.toggle("spa-root", moduleKey === "spa");
  app.classList.toggle("public-module-root", moduleKey !== "guest-portal");
  app.classList.toggle("has-module-heading", !["guest-portal", "romantic-packages"].includes(moduleKey));
  document.title = moduleKey === "room-service"
    ? `Room Service | ${bootstrap.short_name || bootstrap.name}`
    : moduleKey === "emporio"
      ? `Empório | ${bootstrap.short_name || bootstrap.name}`
      : moduleKey === "romantic-packages"
        ? `Decorações especiais | ${bootstrap.short_name || bootstrap.name}`
        : moduleKey === "spa"
          ? `Spa | ${bootstrap.short_name || bootstrap.name}`
          : `${bootstrap.short_name || bootstrap.name} | Portal do Hóspede`;

  if (moduleKey === "guest-portal") {
    const module = await loadModule(moduleKey);
    const moduleContainer = document.createElement("section");
    moduleContainer.className = "module-view guest-portal-view";
    moduleContainer.dataset.moduleView = "";
    moduleContainer.dataset.moduleKey = moduleKey;
    app.replaceChildren(moduleContainer);
    await module.render(moduleContainer, { bootstrap, moduleKey });
    return;
  }

  app.innerHTML = renderShell(bootstrap, moduleKey);
  bindGuestNavigation(app);
  const scrollHandler = () => syncGuestHeader(app);
  window.addEventListener("scroll", scrollHandler, { passive: true });
  syncGuestHeader(app);

  const moduleContainer = app.querySelector("[data-module-view]");
  const module = await loadModule(moduleKey);
  await module.render(moduleContainer, { bootstrap, moduleKey });
}

function renderShell(bootstrap, moduleKey) {
  return `
    <section class="portal-shell public-module-shell">
      ${renderGuestNavigation(bootstrap, { activeModule: moduleKey })}
      ${moduleKey === "romantic-packages" ? "" : renderModuleHeading(bootstrap, moduleKey)}
      <section class="module-view" data-module-view data-module-key="${moduleKey}">
      </section>
    </section>
  `;
}

function renderModuleHeading(bootstrap, moduleKey) {
  const module = bootstrap.modules?.find((entry) => entry.module_key === moduleKey);
  if (!module) return "";
  const iconName = {
    "room-service": "room-service",
    emporio: "bag",
    spa: "spa",
    "romantic-packages": "sparkle",
  }[moduleKey] || "sparkle";
  const title = module.navigation_label || module.name || moduleKey;
  const body = moduleKey === "room-service"
    ? renderRoomServiceHeading(bootstrap)
    : `<p>${escapeText(moduleDescription(bootstrap, moduleKey))}</p>`;
  return `
    <section class="portal-app-top public-module-heading">
      <div class="app-top-card public-module-heading-copy">
        <h1 class="app-top-title">${navigationIcon(iconName)}<span>${escapeText(title)}</span></h1>
        <div class="public-module-heading-description">
          ${body}
        </div>
      </div>
    </section>`;
}

function renderRoomServiceHeading(bootstrap) {
  const unitName = String(bootstrap.short_name || bootstrap.name || "").trim();
  const hotelName = /^hotel\b/i.test(unitName) ? unitName : `Hotel ${unitName}`;
  const support = bootstrap.settings?.["room-service.support_text"]
    || (bootstrap.hotel_id === "muller-fioreze"
      ? "Use o ramal n° 9 do telefone em sua acomodação em caso de dúvidas."
      : "Em caso de dúvidas, entre em contato com a recepção.");
  return `
    <p><strong>Seja bem-vindo ao Room Service digital do ${escapeText(hotelName)}.</strong></p>
    <p><strong>${escapeText(support)}</strong></p>
    <p><strong>${escapeText(formatRoomServiceHours(bootstrap.service_hours?.["room-service"]))}</strong></p>`;
}

function moduleDescription(bootstrap, moduleKey) {
  const configured = bootstrap.settings?.[`portal.module.${moduleKey}.description`];
  if (configured) return configured;
  return {
    emporio: "Produtos selecionados, presentes e lembranças para tornar sua experiência ainda mais especial.",
    spa: "Bem-estar, relaxamento e cuidado durante a sua estadia.",
    "romantic-packages": "Experiências pensadas para celebrar momentos especiais.",
  }[moduleKey] || "";
}

function escapeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

boot().catch((error) => {
  if (error?.status === 404 || error?.code === "not_found") {
    renderNotFound(app);
    return;
  }
  renderError(app, "Falha ao carregar", error.message);
});
