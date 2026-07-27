import { apiGet } from "./api.js";
import { renderError } from "./errors.js";
import { bindGuestNavigation, renderGuestNavigation, syncGuestHeader } from "./guest-navigation.js";
import { loadModule } from "./module-loader.js";
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

  app.classList.toggle("guest-portal-root", moduleKey === "guest-portal");
  app.classList.toggle("room-service-root", moduleKey === "room-service");
  app.classList.toggle("public-module-root", moduleKey !== "guest-portal");
  document.title = moduleKey === "room-service"
    ? `Room Service | ${bootstrap.short_name || bootstrap.name}`
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
      <section class="module-view" data-module-view data-module-key="${moduleKey}">
      </section>
    </section>
  `;
}

boot().catch((error) => {
  renderError(app, "Falha ao carregar", error.message);
});
