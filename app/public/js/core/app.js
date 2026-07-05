import { apiGet } from "./api.js";
import { escapeHtml, renderError } from "./errors.js";
import { loadModule } from "./module-loader.js";
import { setActiveNavigation } from "./router.js";
import { resolveModuleFromPath, resolveSlugFromPath } from "./tenant.js";
import { applyBranding } from "./theme.js";

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

  app.innerHTML = renderShell(bootstrap, moduleKey);
  const nav = app.querySelector("[data-module-nav]");
  setActiveNavigation(nav, moduleKey);

  const moduleContainer = app.querySelector("[data-module-view]");
  const module = await loadModule(moduleKey);
  await module.render(moduleContainer, { bootstrap, moduleKey });
}

function renderShell(bootstrap, moduleKey) {
  const logoUrl = sanitizeAssetPath(bootstrap.branding?.logo_url);
  const logo = logoUrl
    ? `<img class="hotel-logo" src="${escapeHtml(logoUrl)}" alt="">`
    : `<div class="hotel-logo" aria-hidden="true"></div>`;
  const nav = bootstrap.navigation
    .filter((item) => bootstrap.modules.some((module) => module.module_key === item.module_key))
    .map(
      (item) =>
        `<a class="nav-link" data-module-link="${escapeHtml(item.module_key)}" href="${escapeHtml(item.path)}">${escapeHtml(item.label)}</a>`,
    )
    .join("");

  return `
    <section class="portal-shell">
      <header class="portal-header">
        <div class="hotel-brand">
          ${logo}
          <div>
            <h1 class="hotel-title">${escapeHtml(bootstrap.name)}</h1>
            <p class="hotel-subtitle">${escapeHtml(bootstrap.locale)} &middot; ${escapeHtml(bootstrap.currency)}</p>
          </div>
        </div>
        <nav class="module-nav" data-module-nav aria-label="Modulos do hotel">${nav}</nav>
      </header>
      <section class="module-view" data-module-view data-module-key="${escapeHtml(moduleKey)}">
        <div class="panel">Carregando modulo...</div>
      </section>
    </section>
  `;
}

function sanitizeAssetPath(path) {
  const value = String(path || "").trim();
  if (value.startsWith("/assets/")) return value;
  return null;
}

boot().catch((error) => {
  renderError(app, "Falha ao carregar", error.message);
});
