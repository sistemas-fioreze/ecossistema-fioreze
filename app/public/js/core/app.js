import { apiGet } from "./api.js";
import { portalPageKey, trackPortalVisit } from "./analytics.js";
import { renderError } from "./errors.js";
import {
  bindGuestNavigation,
  navigationIcon,
  renderGuestNavigation,
  syncGuestHeader,
} from "./guest-navigation.js";
import { loadModule } from "./module-loader.js";
import { resolveModuleFromPath, resolveSlugFromPath } from "./tenant.js";
import { applyBranding, sanitizePublicAssetUrl } from "./theme.js";
import { evaluateServiceStatus } from "../modules/room-service/service-status.js";

const app = document.getElementById("app");

async function boot() {
  const slug = resolveSlugFromPath();
  if (!slug) {
    renderError(app, "Hotel nao informado", "Acesse a plataforma usando o slug publico do hotel.");
    return;
  }

  const bootstrap = await apiGet(`/api/v1/public/hotels/${encodeURIComponent(slug)}/bootstrap`);
  applyBranding(bootstrap.branding);

  const requestedModule = resolveModuleFromPath(window.location.pathname);
  const enabledModules = new Set(bootstrap.modules.map((module) => module.module_key));
  const moduleKey = enabledModules.has(requestedModule) ? requestedModule : "guest-portal";
  trackPortalVisit(slug, portalPageKey(moduleKey));

  app.classList.toggle("guest-portal-root", moduleKey === "guest-portal");
  app.classList.toggle("room-service-root", moduleKey === "room-service");
  app.classList.toggle("emporio-root", moduleKey === "emporio");
  app.classList.toggle("romantic-packages-root", moduleKey === "romantic-packages");
  app.classList.toggle("public-module-root", moduleKey !== "guest-portal");
  app.classList.toggle("has-module-hero", moduleKey !== "guest-portal" && moduleKey !== "emporio");
  document.title = moduleKey === "room-service"
    ? `Room Service | ${bootstrap.short_name || bootstrap.name}`
    : moduleKey === "emporio"
      ? `Empório | ${bootstrap.short_name || bootstrap.name}`
      : moduleKey === "romantic-packages"
        ? `Pacotes românticos | ${bootstrap.short_name || bootstrap.name}`
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
  const hero = moduleKey === "emporio" ? "" : renderModuleHero(bootstrap, moduleKey);
  return `
    <section class="portal-shell public-module-shell">
      ${renderGuestNavigation(bootstrap, { activeModule: moduleKey })}
      ${hero}
      <section class="module-view" data-module-view data-module-key="${moduleKey}">
      </section>
    </section>
  `;
}

function renderModuleHero(bootstrap, moduleKey) {
  const module = bootstrap.modules?.find((entry) => entry.module_key === moduleKey);
  if (!module) return "";
  const cover = sanitizePublicAssetUrl(module.background_image_url);
  const style = cover ? ` style="--module-hero-image: url('${escapeCssUrl(cover)}')"` : "";
  const hours = moduleKey === "room-service" ? roomServiceHours(bootstrap) : "";
  return `
    <section class="public-module-hero${cover ? " has-cover" : ""}"${style}>
      <div class="public-module-hero-shade" aria-hidden="true"></div>
      <div class="public-module-hero-copy">
        <h1>${navigationIcon(moduleKey)}<span>${escapeText(module.navigation_label || module.name || moduleKey)}</span></h1>
        ${hours ? `<p>${escapeText(hours)}</p>` : ""}
      </div>
    </section>`;
}

function roomServiceHours(bootstrap) {
  const status = evaluateServiceStatus({
    serviceHours: bootstrap.service_hours?.["room-service"] || [],
    timezone: bootstrap.timezone,
    operationMode: bootstrap.settings?.["room-service.operation_mode"] || "automatic",
  });
  return status.today_text;
}

function escapeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeCssUrl(value) {
  return String(value || "").replace(/['\\\n\r\f]/g, "");
}

boot().catch((error) => {
  renderError(app, "Falha ao carregar", error.message);
});
