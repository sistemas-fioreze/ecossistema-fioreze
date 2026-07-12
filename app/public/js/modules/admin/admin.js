import { createAdminAuthView } from "./shared/admin-auth-view.js";
import { adminApi } from "./shared/admin-api.js";
import { canAccessPortals, canAccessRoles, canAccessUsers, getAuthorizedHotels } from "./shared/admin-session.js";
import { escapeAttr, escapeHtml } from "./shared/format.js";

const section = currentSection();
document.body.dataset.adminSection = section;

const els = {
  welcomeTitle: document.getElementById("welcomeTitle"),
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
  if (!canAccessUsers(session)) {
    els.usersList.innerHTML = '<p class="admin-empty">Voce nao tem acesso a esta funcao.</p>';
    return;
  }
  els.usersSummary.textContent = "Carregando usuarios...";
  try {
    const payload = await adminApi("/api/v1/admin/users");
    const users = payload.data.users || [];
    els.usersSummary.textContent = `${users.length} usuario(s) encontrado(s).`;
    els.usersList.innerHTML = users.map(renderUserRow).join("") || '<p class="admin-empty">Nenhum usuario encontrado.</p>';
  } catch (error) {
    els.usersSummary.textContent = error.message || "Nao foi possivel carregar os usuarios.";
  }
}

async function renderRoles(session) {
  els.welcomeTitle.textContent = "Perfis e permissoes";
  if (!canAccessRoles(session)) {
    els.rolesList.innerHTML = '<p class="admin-empty">Voce nao tem acesso a esta funcao.</p>';
    return;
  }
  els.rolesSummary.textContent = "Carregando perfis...";
  try {
    const payload = await adminApi("/api/v1/admin/roles");
    const roles = payload.data.roles || [];
    els.rolesSummary.textContent = `${roles.length} perfil(is) encontrado(s).`;
    els.rolesList.innerHTML = roles.map(renderRoleRow).join("") || '<p class="admin-empty">Nenhum perfil encontrado.</p>';
  } catch (error) {
    els.rolesSummary.textContent = error.message || "Nao foi possivel carregar os perfis.";
  }
}

async function renderAccount(session) {
  els.welcomeTitle.textContent = "Minha conta";
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

function renderUserRow(user) {
  return `
    <article class="admin-data-row">
      <span class="admin-avatar">${escapeHtml(initials(user.display_name))}</span>
      <div>
        <strong>${escapeHtml(user.display_name)}</strong>
        <span>${escapeHtml(user.email)}</span>
        <small>${escapeHtml(user.roles.map((role) => role.name).join(", ") || "Sem perfil")}</small>
      </div>
      <span class="admin-status-chip">${escapeHtml(statusLabel(user.status))}</span>
    </article>
  `;
}

function renderRoleRow(role) {
  const permissions = role.permissions.map((permission) => permission.label).slice(0, 5).join(", ");
  return `
    <article class="admin-data-row">
      <div>
        <strong>${escapeHtml(role.name)}</strong>
        <span>${escapeHtml(role.description || "Perfil administrativo")}</span>
        <small>${escapeHtml(permissions || "Sem permissoes")}</small>
      </div>
      <span class="admin-status-chip">${Number(role.user_count || 0)} usuario(s)</span>
    </article>
  `;
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

function statusLabel(status) {
  return status === "active" ? "Ativo" : "Desativado";
}
