import { createAdminAuthView } from "./shared/admin-auth-view.js";
import { canAccessPortals } from "./shared/admin-session.js";
import { escapeHtml } from "./shared/format.js";

const els = {
  portalsDenied: document.getElementById("portalsDenied"),
  portalsContent: document.getElementById("portalsContent"),
  portalsModules: document.getElementById("portalsModules"),
};

const modules = ["Visao geral", "Hoteis", "Portais e modulos", "Conteudos", "Usuarios e acessos", "Auditoria"];

const auth = createAdminAuthView({
  onAuthenticated(session) {
    renderPortals(session);
  },
});

auth.boot();

function renderPortals(session) {
  const allowed = canAccessPortals(session);
  els.portalsDenied.hidden = allowed;
  els.portalsContent.hidden = !allowed;
  if (!allowed) return;

  els.portalsModules.innerHTML = modules
    .map(
      (moduleName) => `
        <article class="admin-module-card">
          <strong>${escapeHtml(moduleName)}</strong>
          <span>Modulo preparado para implementacao futura.</span>
        </article>
      `,
    )
    .join("");
}
