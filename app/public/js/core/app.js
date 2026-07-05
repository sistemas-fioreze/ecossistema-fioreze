import { apiGet } from "./api.js";
import { renderError } from "./errors.js";
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
  const logo = bootstrap.branding?.logo_url
    ? `<img class="hotel-logo" src="${bootstrap.branding.logo_url}" alt="">`
    : `<div class="hotel-logo" aria-hidden="true"></div>`;
  const nav = bootstrap.navigation
    .filter((item) => bootstrap.modules.some((module) => module.module_key === item.module_key))
    .map(
      (item) =>
        `<a class="nav-link" data-module-link="${item.module_key}" href="${item.path}">${item.label}</a>`,
    )
    .join("");

  return `
    <section class="portal-shell">
      <header class="portal-header">
        <div class="hotel-brand">
          ${logo}
          <div>
            <h1 class="hotel-title">${bootstrap.name}</h1>
            <p class="hotel-subtitle">${bootstrap.locale} · ${bootstrap.currency}</p>
          </div>
        </div>
        <nav class="module-nav" data-module-nav aria-label="Modulos do hotel">${nav}</nav>
      </header>
      <section class="module-view" data-module-view data-module-key="${moduleKey}">
        <div class="panel">Carregando modulo...</div>
      </section>
    </section>
  `;
}

boot().catch((error) => {
  renderError(app, "Falha ao carregar", error.message);
});
