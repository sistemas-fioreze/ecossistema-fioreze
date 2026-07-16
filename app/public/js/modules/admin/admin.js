import { createAdminAuthView } from "./shared/admin-auth-view.js";
import { adminApi } from "./shared/admin-api.js";
import { canAccessPortals, canAccessRoles, canAccessUsers, getAuthorizedHotels } from "./shared/admin-session.js";
import { escapeAttr, escapeHtml } from "./shared/format.js";
import { renderRolesManager, renderUsersManager } from "./central-management.js";
import { renderMessagesManager } from "./admin-messages.js";

const section = currentSection();
document.body.dataset.adminSection = section;
let currentSession = null;

const els = {
  welcomeTitle: document.getElementById("welcomeTitle"),
  welcomeSubtitle: document.getElementById("welcomeSubtitle"),
  systemsList: document.getElementById("systemsList"),
  authorizedHotels: document.getElementById("authorizedHotels"),
  noSystemsMessage: document.getElementById("noSystemsMessage"),
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
});

auth.boot();

window.addEventListener("fioreze:admin-refresh", (event) => {
  if (!currentSession) return;
  event.preventDefault();
  Promise.resolve(renderLauncher(currentSession)).finally(() => event.detail?.complete?.());
});

function renderLauncher(session) {
  setPanelVisibility(section);
  if (section === "users") return renderUsers(session);
  if (section === "roles") return renderRoles(session);
  if (section === "messages") return renderMessages(session);
  if (section === "account") return renderAccount(session);

  const systems = buildSystems(session);
  const firstName = String(session?.user?.display_name || "Usuário").split(/\s+/)[0] || "Usuário";
  els.welcomeTitle.textContent = `Olá, ${firstName}.`;
  els.welcomeSubtitle.textContent = "Escolha uma área para cuidar da operação e das experiências digitais.";
  els.systemsList.innerHTML = systems.map(renderSystemCard).join("");
  els.noSystemsMessage.hidden = systems.length > 0;
  els.authorizedHotels.innerHTML = renderHotels(getAuthorizedHotels(session));
}

function buildSystems(session) {
  const systems = [];
  if (canAccessPortals(session)) {
    systems.push({
      title: "Central de Portais",
      description: "Unidades, portais, conteúdos e equipe",
      href: "/admin/portais/",
    });
  }
  if (canAccessUsers(session)) {
    systems.push({
      title: "Usuários",
      description: "Equipe, acessos e sessões",
      href: "/admin/usuarios/",
    });
  }
  if (canAccessRoles(session)) {
    systems.push({
      title: "Perfis e permissões",
      description: "Grupos de acesso administrativo",
      href: "/admin/perfis/",
    });
  }
  systems.push({
    title: "Mensagens",
    description: "Comunicação interna da equipe",
    href: "/admin/mensagens/",
  });
  return systems;
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

function renderAccountAvatar(user) {
  if (user.avatar?.url) {
    return `<img class="admin-profile-photo" src="${escapeAttr(user.avatar.url)}" alt="Foto de perfil de ${escapeAttr(user.display_name)}">`;
  }
  return `<span class="admin-avatar">${escapeHtml(initials(user.display_name))}</span>`;
}

function setPanelVisibility(activeSection) {
  const home = activeSection === "home";
  document.querySelector(".admin-launcher-grid").hidden = !home;
  els.usersManager.hidden = activeSection !== "users";
  els.rolesManager.hidden = activeSection !== "roles";
  els.messagesManager.hidden = activeSection !== "messages";
  els.accountManager.hidden = activeSection !== "account";
}

function currentSection() {
  const path = window.location.pathname;
  if (path.startsWith("/admin/usuarios/")) return "users";
  if (path.startsWith("/admin/perfis/")) return "roles";
  if (path.startsWith("/admin/mensagens/")) return "messages";
  if (path.startsWith("/admin/minha-conta/")) return "account";
  return "home";
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
