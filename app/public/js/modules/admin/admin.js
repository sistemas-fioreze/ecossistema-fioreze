import { createAdminAuthView, syncAdminNavigationActiveState } from "./shared/admin-auth-view.js";
import { adminApi } from "./shared/admin-api.js";
import {
  canAccessAudit,
  canAccessPortals,
  canAccessRoles,
  canAccessRoomService,
  canAccessUsers,
  getAuthorizedHotels,
  getPermissions,
} from "./shared/admin-session.js";
import { escapeAttr, escapeHtml } from "./shared/format.js";
import { renderRolesManager, renderUsersManager } from "./central-management.js";
import { renderMessagesManager } from "./admin-messages.js";

let section = currentSection();
document.body.dataset.adminSection = section;
let currentSession = null;

const els = {
  welcomeTitle: document.getElementById("welcomeTitle"),
  welcomeSubtitle: document.getElementById("welcomeSubtitle"),
  systemsList: document.getElementById("systemsList"),
  authorizedHotels: document.getElementById("authorizedHotels"),
  noSystemsMessage: document.getElementById("noSystemsMessage"),
  homeDashboard: document.getElementById("adminHomeDashboard"),
  homeHotelsKpi: document.getElementById("homeHotelsKpi"),
  homeSystemsKpi: document.getElementById("homeSystemsKpi"),
  homePermissionsKpi: document.getElementById("homePermissionsKpi"),
  homeMessagesKpi: document.getElementById("homeMessagesKpi"),
  homePermissionsChart: document.getElementById("homePermissionsChart"),
  settingsManager: document.getElementById("settingsManager"),
  settingsGrid: document.getElementById("settingsGrid"),
  usersManager: document.getElementById("usersManager"),
  usersSummary: document.getElementById("usersSummary"),
  usersList: document.getElementById("usersList"),
  rolesManager: document.getElementById("rolesManager"),
  rolesSummary: document.getElementById("rolesSummary"),
  rolesList: document.getElementById("rolesList"),
  messagesManager: document.getElementById("messagesManager"),
  accountManager: document.getElementById("accountManager"),
  accountDetails: document.getElementById("accountDetails"),
  avatarForm: document.getElementById("avatarForm"),
  avatarFile: document.getElementById("avatarFile"),
  deleteAvatarButton: document.getElementById("deleteAvatarButton"),
  passwordForm: document.getElementById("passwordForm"),
  currentPassword: document.getElementById("currentPassword"),
  newPassword: document.getElementById("newPassword"),
  confirmPassword: document.getElementById("confirmPassword"),
  accountMessage: document.getElementById("accountMessage"),
  revokeOwnSessionsButton: document.getElementById("revokeOwnSessionsButton"),
};

const auth = createAdminAuthView({
  onAuthenticated(session) {
    currentSession = session;
    return renderLauncher(session);
  },
  onLoggedOut() {
    currentSession = null;
  },
});

auth.boot();
document.addEventListener("click", handleAdminNavigation);
window.addEventListener("popstate", handleAdminHistory);

window.addEventListener("fioreze:admin-refresh", (event) => {
  if (!currentSession) return;
  event.preventDefault();
  Promise.resolve(renderLauncher(currentSession)).finally(() => event.detail?.complete?.());
});

function handleAdminNavigation(event) {
  const link = event.target.closest("a[href]");
  if (
    !link ||
    !currentSession ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link.target ||
    link.hasAttribute("download")
  ) {
    return;
  }
  const target = new URL(link.href, window.location.origin);
  if (target.origin !== window.location.origin || !isCoreAdminPath(target.pathname)) return;
  event.preventDefault();
  navigateAdminRoute(`${target.pathname}${target.search}${target.hash}`);
}

function handleAdminHistory() {
  if (!currentSession || !isCoreAdminPath(window.location.pathname)) return;
  void renderAdminRoute();
}

function navigateAdminRoute(path) {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === path) return;
  window.history.pushState({}, "", path);
  void renderAdminRoute();
}

async function renderAdminRoute() {
  section = currentSection();
  document.body.dataset.adminSection = section;
  syncAdminNavigationActiveState();
  document.querySelector('[data-view="dashboard"]')?.classList.remove("is-menu-open");
  document.querySelector("[data-admin-backdrop]")?.setAttribute("hidden", "");
  await renderLauncher(currentSession);
  document.querySelector(".admin-management-panel:not([hidden]), .admin-home-dashboard:not([hidden])")?.scrollIntoView({
    block: "start",
    behavior: "auto",
  });
}

function isCoreAdminPath(pathname) {
  return [
    "/admin/",
    "/admin/mensagens/",
    "/admin/configuracoes/",
    "/admin/usuarios/",
    "/admin/perfis/",
    "/admin/minha-conta/",
  ].some((path) => pathname === path || (path !== "/admin/" && pathname.startsWith(path)));
}

async function renderLauncher(session) {
  setPanelVisibility(section);
  if (section === "users") return renderUsers(session);
  if (section === "roles") return renderRoles(session);
  if (section === "messages") return renderMessages(session);
  if (section === "account") return renderAccount(session);
  if (section === "settings") return renderSettings(session);

  const systems = buildSystems(session);
  const firstName = String(session?.user?.display_name || "Usuário").split(/\s+/)[0] || "Usuário";
  els.welcomeTitle.textContent = `Olá, ${firstName}.`;
  els.welcomeSubtitle.textContent = "Escolha uma área para cuidar da operação e das experiências digitais.";
  els.systemsList.innerHTML = systems.map(renderSystemCard).join("");
  els.noSystemsMessage.hidden = systems.length > 0;
  const hotels = getAuthorizedHotels(session);
  const permissions = getPermissions(session);
  els.authorizedHotels.innerHTML = renderHotels(hotels);
  els.homeHotelsKpi.textContent = String(hotels.length);
  els.homeSystemsKpi.textContent = String(systems.length);
  els.homePermissionsKpi.textContent = String(permissions.length);
  els.homeMessagesKpi.textContent = String(await unreadMessageCount());
  els.homePermissionsChart.innerHTML = renderPermissionsChart(permissions);
  renderDashboardIcons();
}

function buildSystems(session) {
  const systems = [];
  if (canAccessRoomService(session)) {
    for (const hotel of getAuthorizedHotels(session)) {
      if (!hotel.slug) continue;
      systems.push({
        title: `ERP Room Service · ${hotel.short_name || hotel.name}`,
        description: "Pedidos, cardápio, funcionamento e equipe da unidade",
        href: `/${encodeURIComponent(hotel.slug)}/admin/erp/`,
      });
    }
  }
  if (canAccessPortals(session)) {
    systems.push({
      title: "Central de Portais",
      description: "Unidades, portais, conteúdos e equipe",
      href: "/admin/portais/",
    });
  }
  systems.push({
    title: "Mensagens",
    description: "Comunicação interna da equipe",
    href: "/admin/mensagens/",
  });
  systems.push({
    title: "Configurações",
    description: "Usuários, perfis, auditoria e sua conta",
    href: "/admin/configuracoes/",
  });
  return systems;
}

function renderSettings(session) {
  els.welcomeTitle.textContent = "Configurações";
  els.welcomeSubtitle.textContent = "Gerencie contas, acessos, permissões e o histórico administrativo.";
  const cards = [
    ["Usuários", "Cadastre pessoas, unidades autorizadas e sessões.", "/admin/usuarios/", "users", canAccessUsers(session)],
    ["Perfis e permissões", "Defina responsabilidades e níveis de acesso.", "/admin/perfis/", "shield", canAccessRoles(session)],
    ["Auditoria", "Consulte o histórico das alterações administrativas.", "/admin/portais/auditoria/", "history", canAccessAudit(session)],
    ["Minha conta", "Atualize foto, senha e sessões da sua conta.", "/admin/minha-conta/", "account", true],
  ];
  els.settingsGrid.innerHTML = cards
    .map(([title, description, href, iconName, enabled]) => enabled
      ? `<a class="admin-settings-card" href="${escapeAttr(href)}"><span class="admin-settings-icon">${dashboardIcon(iconName)}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div><span class="admin-settings-arrow" aria-hidden="true">›</span></a>`
      : `<div class="admin-settings-card is-disabled" aria-disabled="true"><span class="admin-settings-icon">${dashboardIcon(iconName)}</span><div><strong>${escapeHtml(title)}</strong><p>Acesso não liberado para este perfil.</p></div></div>`)
    .join("");
}

async function renderUsers(session) {
  els.welcomeTitle.textContent = "Usuários";
  els.welcomeSubtitle.textContent = "Gerencie a equipe e as unidades autorizadas de cada usuário.";
  if (!canAccessUsers(session)) {
    els.usersList.innerHTML = '<p class="admin-empty">Você não tem acesso a esta função.</p>';
    return;
  }
  await renderUsersManager(session);
}

async function renderRoles(session) {
  els.welcomeTitle.textContent = "Perfis e permissões";
  els.welcomeSubtitle.textContent = "Defina responsabilidades e acessos administrativos com segurança.";
  if (!canAccessRoles(session)) {
    els.rolesList.innerHTML = '<p class="admin-empty">Você não tem acesso a esta função.</p>';
    return;
  }
  await renderRolesManager(session);
}

async function renderMessages() {
  els.welcomeTitle.textContent = "Mensagens";
  els.welcomeSubtitle.textContent = "Envie e receba mensagens da equipe administrativa.";
  await renderMessagesManager();
}

async function renderAccount(session) {
  els.welcomeTitle.textContent = "Minha conta";
  els.welcomeSubtitle.textContent = "Atualize sua foto, senha e sessões administrativas.";
  try {
    const payload = await adminApi("/api/v1/admin/me");
    const user = payload.data.user;
    els.accountDetails.innerHTML = `
      <div class="admin-account-identity">
        ${renderAccountAvatar(user)}
        <div>
          <strong>${escapeHtml(user.display_name)}</strong>
          <span>${escapeHtml(user.email)}</span>
          <small>${escapeHtml(user.roles.map((role) => role.name).join(", ") || "Sem perfil")}</small>
        </div>
      </div>
    `;
  } catch (error) {
    els.accountDetails.innerHTML = `<p class="admin-empty">${escapeHtml(error.message || "Não foi possível carregar sua conta.")}</p>`;
  }
}

els.passwordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.accountMessage.textContent = "Alterando senha...";
  try {
    await adminApi("/api/v1/admin/me/password", {
      method: "POST",
      body: {
        current_password: els.currentPassword.value,
        new_password: els.newPassword.value,
        confirm_password: els.confirmPassword.value,
      },
    });
    els.passwordForm.reset();
    els.accountMessage.textContent = "Senha alterada. Entre novamente para continuar.";
  } catch (error) {
    els.accountMessage.textContent = error.message || "Não foi possível alterar a senha.";
  }
});

els.avatarForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!els.avatarFile.files?.[0]) {
    els.accountMessage.textContent = "Escolha uma imagem para atualizar sua foto.";
    return;
  }
  els.accountMessage.textContent = "Atualizando foto...";
  const form = new FormData();
  form.append("avatar", els.avatarFile.files[0]);
  try {
    await adminApi("/api/v1/admin/me/avatar", { method: "POST", body: form });
    els.avatarForm.reset();
    els.accountMessage.textContent = "Foto atualizada.";
    await renderAccount();
  } catch (error) {
    els.accountMessage.textContent = error.message || "Não foi possível atualizar a foto.";
  }
});

els.deleteAvatarButton?.addEventListener("click", async () => {
  els.accountMessage.textContent = "Removendo foto...";
  try {
    await adminApi("/api/v1/admin/me/avatar", { method: "DELETE", body: {} });
    els.accountMessage.textContent = "Foto removida.";
    await renderAccount();
  } catch (error) {
    els.accountMessage.textContent = error.message || "Não foi possível remover a foto.";
  }
});

els.revokeOwnSessionsButton?.addEventListener("click", async () => {
  if (!window.confirm("Encerrar suas outras sessões administrativas?")) return;
  els.accountMessage.textContent = "Encerrando sessões...";
  try {
    const payload = await adminApi("/api/v1/admin/me/sessions/revoke", { method: "POST", body: {} });
    els.accountMessage.textContent = `${payload.data.revoked_sessions || 0} sessão(ões) encerrada(s).`;
  } catch (error) {
    els.accountMessage.textContent = error.message || "Não foi possível encerrar as sessões.";
  }
});

function renderSystemCard(system) {
  return `
    <a class="admin-system-card" href="${escapeAttr(system.href)}">
      <span class="admin-home-action-icon">${dashboardIcon(system.title === "Mensagens" ? "mail" : system.title === "Configurações" ? "settings" : "portal")}</span>
      <div><strong>${escapeHtml(system.title)}</strong><span>${escapeHtml(system.description)}</span></div>
      <b aria-hidden="true">›</b>
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
        <div class="admin-home-hotel-row">
          <span class="admin-home-hotel-avatar">${escapeHtml(initials(hotel.short_name || hotel.name))}</span>
          <div><strong>${escapeHtml(hotel.short_name || hotel.name)}</strong><span>${escapeHtml(hotel.access_level || "acesso autorizado")}</span></div>
          <i aria-hidden="true"></i>
        </div>
      `,
    )
    .join("");
}

function renderAccountAvatar(user) {
  if (user.avatar?.url) {
    return `<img class="admin-profile-photo" src="${escapeAttr(user.avatar.url)}" alt="Foto de perfil de ${escapeAttr(user.display_name)}">`;
  }
  return `<span class="admin-avatar">${escapeHtml(initials(user.display_name))}</span>`;
}

function setPanelVisibility(activeSection) {
  const home = activeSection === "home";
  els.homeDashboard.hidden = !home;
  els.settingsManager.hidden = activeSection !== "settings";
  els.usersManager.hidden = activeSection !== "users";
  els.rolesManager.hidden = activeSection !== "roles";
  els.messagesManager.hidden = activeSection !== "messages";
  els.accountManager.hidden = activeSection !== "account";
}

function currentSection() {
  const path = window.location.pathname;
  if (path.startsWith("/admin/configuracoes/")) return "settings";
  if (path.startsWith("/admin/usuarios/")) return "users";
  if (path.startsWith("/admin/perfis/")) return "roles";
  if (path.startsWith("/admin/mensagens/")) return "messages";
  if (path.startsWith("/admin/minha-conta/")) return "account";
  return "home";
}

async function unreadMessageCount() {
  try {
    const payload = await adminApi("/api/v1/admin/messages?box=inbox");
    return (payload.data.messages || []).filter((message) => !message.read_at).length;
  } catch {
    return 0;
  }
}

function renderPermissionsChart(permissions) {
  const groups = [
    ["Portais", "portals."],
    ["Administração", "admin."],
    ["Room Service", "room-service."],
    ["Plataforma", "platform."],
  ].map(([label, prefix]) => [label, permissions.filter((permission) => permission.startsWith(prefix)).length]);
  const maximum = Math.max(1, ...groups.map(([, total]) => total));
  return groups.map(([label, total]) => `
    <div class="admin-home-bar-row">
      <div><span>${escapeHtml(label)}</span><strong>${total}</strong></div>
      <span class="admin-home-bar-track"><i style="width:${Math.round((total / maximum) * 100)}%"></i></span>
    </div>`).join("");
}

function renderDashboardIcons() {
  for (const slot of document.querySelectorAll(".admin-home-kpi-icon[data-icon]")) {
    slot.innerHTML = dashboardIcon(slot.dataset.icon);
  }
}

function dashboardIcon(name) {
  const paths = {
    units: '<path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6M8 10h.01M12 10h.01M16 10h.01"/>',
    apps: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
    shield: '<path d="M12 3 5 6v5c0 4.7 2.7 8 7 10 4.3-2 7-5.3 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    portal: '<path d="M4 5h16v14H4zM4 9h16M8 5v4"/><path d="M9 14h6"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.settings}</svg>`;
}

function initials(name) {
  return String(name || "Usuário")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
