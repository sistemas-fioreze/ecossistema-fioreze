import { createAdminAuthView } from "./shared/admin-auth-view.js";
import { adminApi } from "./shared/admin-api.js";
import { canAccessPortals, canAccessRoles, canAccessUsers, getAuthorizedHotels } from "./shared/admin-session.js";
import { escapeAttr, escapeHtml } from "./shared/format.js";
import { renderRolesManager, renderUsersManager } from "./central-management.js";

const section = currentSection();
document.body.dataset.adminSection = section;

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
    renderLauncher(session);
  },
});

auth.boot();

function renderLauncher(session) {
  setPanelVisibility(section);
  if (section === "users") return renderUsers(session);
  if (section === "roles") return renderRoles(session);
  if (section === "account") return renderAccount(session);

  const systems = buildSystems(session);
  const firstName = String(session?.user?.display_name || "Usuario").split(/\s+/)[0] || "Usuario";
  els.welcomeTitle.textContent = `Ola, ${firstName}.`;
  els.welcomeSubtitle.textContent = "Escolha uma area para cuidar da operacao e das experiencias digitais.";
  els.systemsList.innerHTML = systems.map(renderSystemCard).join("");
  els.noSystemsMessage.hidden = systems.length > 0;
  els.authorizedHotels.innerHTML = renderHotels(getAuthorizedHotels(session));
}

function buildSystems(session) {
  const systems = [];
  if (canAccessPortals(session)) {
    systems.push({
      title: "Central de Portais",
      description: "Unidades, portais, conteudos e equipe",
      href: "/admin/portais/",
    });
  }
  if (canAccessUsers(session)) {
    systems.push({
      title: "Usuarios",
      description: "Equipe, acessos e sessoes",
      href: "/admin/usuarios/",
    });
  }
  if (canAccessRoles(session)) {
    systems.push({
      title: "Perfis e permissoes",
      description: "Grupos de acesso administrativo",
      href: "/admin/perfis/",
    });
  }
  return systems;
}

async function renderUsers(session) {
  els.welcomeTitle.textContent = "Usuarios";
  els.welcomeSubtitle.textContent = "Gerencie a equipe e as unidades autorizadas de cada usuario.";
  if (!canAccessUsers(session)) {
    els.usersList.innerHTML = '<p class="admin-empty">Voce nao tem acesso a esta funcao.</p>';
    return;
  }
  await renderUsersManager(session);
}

async function renderRoles(session) {
  els.welcomeTitle.textContent = "Perfis e permissoes";
  els.welcomeSubtitle.textContent = "Defina responsabilidades e acessos administrativos com seguranca.";
  if (!canAccessRoles(session)) {
    els.rolesList.innerHTML = '<p class="admin-empty">Voce nao tem acesso a esta funcao.</p>';
    return;
  }
  await renderRolesManager(session);
}

async function renderAccount(session) {
  els.welcomeTitle.textContent = "Minha conta";
  els.welcomeSubtitle.textContent = "Atualize sua foto, senha e sessoes administrativas.";
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
    els.accountDetails.innerHTML = `<p class="admin-empty">${escapeHtml(error.message || "Nao foi possivel carregar sua conta.")}</p>`;
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
    els.accountMessage.textContent = error.message || "Nao foi possivel alterar a senha.";
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
    els.accountMessage.textContent = error.message || "Nao foi possivel atualizar a foto.";
  }
});

els.deleteAvatarButton?.addEventListener("click", async () => {
  els.accountMessage.textContent = "Removendo foto...";
  try {
    await adminApi("/api/v1/admin/me/avatar", { method: "DELETE", body: {} });
    els.accountMessage.textContent = "Foto removida.";
    await renderAccount();
  } catch (error) {
    els.accountMessage.textContent = error.message || "Nao foi possivel remover a foto.";
  }
});

els.revokeOwnSessionsButton?.addEventListener("click", async () => {
  if (!window.confirm("Encerrar suas outras sessoes administrativas?")) return;
  els.accountMessage.textContent = "Encerrando sessoes...";
  try {
    const payload = await adminApi("/api/v1/admin/me/sessions/revoke", { method: "POST", body: {} });
    els.accountMessage.textContent = `${payload.data.revoked_sessions || 0} sessao(oes) encerrada(s).`;
  } catch (error) {
    els.accountMessage.textContent = error.message || "Nao foi possivel encerrar as sessoes.";
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
  els.accountManager.hidden = activeSection !== "account";
}

function currentSection() {
  const path = window.location.pathname;
  if (path.startsWith("/admin/usuarios/")) return "users";
  if (path.startsWith("/admin/perfis/")) return "roles";
  if (path.startsWith("/admin/minha-conta/")) return "account";
  return "home";
}

function initials(name) {
  return String(name || "Usuario")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
