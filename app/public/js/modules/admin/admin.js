import { createAdminAuthView } from "./shared/admin-auth-view.js";
import { canAccessPortals, canAccessRoomService, getAuthorizedHotels } from "./shared/admin-session.js";
import { escapeAttr, escapeHtml } from "./shared/format.js";

const els = {
  welcomeTitle: document.getElementById("welcomeTitle"),
  systemsList: document.getElementById("systemsList"),
  authorizedHotels: document.getElementById("authorizedHotels"),
  noSystemsMessage: document.getElementById("noSystemsMessage"),
};

const auth = createAdminAuthView({
  onAuthenticated(session) {
    renderLauncher(session);
  },
});

auth.boot();

function renderLauncher(session) {
  const systems = buildSystems(session);
  const firstName = String(session?.user?.display_name || "Usuario").split(/\s+/)[0] || "Usuario";
  els.welcomeTitle.textContent = `Ola, ${firstName}.`;
  els.systemsList.innerHTML = systems.map(renderSystemCard).join("");
  els.noSystemsMessage.hidden = systems.length > 0;
  els.authorizedHotels.innerHTML = renderHotels(getAuthorizedHotels(session));
}

function buildSystems(session) {
  const systems = [];
  if (canAccessRoomService(session)) {
    systems.push({
      title: "Room Service",
      description: "Pedidos, operacao e atendimento",
      href: "/admin/room-service/",
    });
  }
  if (canAccessPortals(session)) {
    systems.push({
      title: "Central de Portais",
      description: "Unidades, portais, conteudos e equipe",
      href: "/admin/portais/",
    });
  }
  return systems;
}

function renderSystemCard(system) {
  return `
    <a class="admin-system-card" href="${escapeAttr(system.href)}">
      <strong>${escapeHtml(system.title)}</strong>
      <span>${escapeHtml(system.description)}</span>
    </a>
  `;
}

function renderHotels(hotels) {
  if (!hotels.length) {
    return '<p class="admin-empty">Nenhum hotel autorizado.</p>';
  }
  return hotels
    .map(
      (hotel) => `
        <div class="admin-hotel-chip">
          <strong>${escapeHtml(hotel.short_name || hotel.name)}</strong>
          <span>${escapeHtml(hotel.access_level || "acesso")}</span>
        </div>
      `,
    )
    .join("");
}
