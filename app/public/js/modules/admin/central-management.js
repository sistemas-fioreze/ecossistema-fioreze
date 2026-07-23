import { adminApi } from "./shared/admin-api.js";
import { debounce, escapeAttr, escapeHtml } from "./shared/format.js";
import { getAuthorizedHotels, hasPermission } from "./shared/admin-session.js";

const PERMISSIONS = {
  usersCreate: "admin.users.create",
  usersUpdate: "admin.users.update",
  usersDisable: "admin.users.disable",
  usersPasswordReset: "admin.users.password_reset",
  usersSessionsRevoke: "admin.users.sessions_revoke",
  rolesCreate: "admin.roles.create",
  rolesUpdate: "admin.roles.update",
  rolesPermissions: "admin.roles.permissions",
};

const state = {
  session: null,
  users: [],
  roles: [],
  permissions: [],
  hotels: [],
  initialized: false,
};

const els = {
  usersSummary: document.getElementById("usersSummary"),
  usersList: document.getElementById("usersList"),
  usersFilters: document.getElementById("usersFilters"),
  usersSearch: document.getElementById("usersSearch"),
  usersStatus: document.getElementById("usersStatus"),
  addUserButton: document.getElementById("addUserButton"),
  rolesSummary: document.getElementById("rolesSummary"),
  rolesList: document.getElementById("rolesList"),
  addRoleButton: document.getElementById("addRoleButton"),
  dialog: document.getElementById("adminEditorDialog"),
  dialogTitle: document.getElementById("adminDialogTitle"),
  dialogBody: document.getElementById("adminDialogBody"),
};

export async function renderUsersManager(session) {
  state.session = session;
  initialize();
  els.addUserButton.hidden = !hasPermission(session, PERMISSIONS.usersCreate);
  await loadUserDependencies();
  await loadUsers();
}

export async function renderRolesManager(session) {
  state.session = session;
  initialize();
  els.addRoleButton.hidden = !hasPermission(session, PERMISSIONS.rolesCreate);
  setManagerBusy(els.rolesList, true);
  try {
    const [rolesPayload, permissionsPayload] = await Promise.all([
      adminApi("/api/v1/admin/roles"),
      adminApi("/api/v1/admin/permissions"),
    ]);
    state.roles = rolesPayload.data.roles || [];
    state.permissions = permissionsPayload.data.permissions || [];
    els.rolesSummary.textContent = `${state.roles.length} ${state.roles.length === 1 ? "perfil configurado" : "perfis configurados"}.`;
    els.rolesList.innerHTML = state.roles.map(renderRoleRow).join("") || empty("Nenhum perfil cadastrado.");
  } catch (error) {
    els.rolesSummary.textContent = error.message || "Não foi possível carregar os perfis.";
  } finally {
    setManagerBusy(els.rolesList, false);
  }
}

function initialize() {
  if (state.initialized) return;
  state.initialized = true;
  els.usersFilters?.addEventListener("submit", (event) => {
    event.preventDefault();
    loadUsers();
  });
  els.usersSearch?.addEventListener("input", debounce(loadUsers, 250));
  els.usersStatus?.addEventListener("change", loadUsers);
  els.addUserButton?.addEventListener("click", () => openUserEditor());
  els.usersList?.addEventListener("click", handleUserAction);
  els.addRoleButton?.addEventListener("click", () => openRoleEditor());
  els.rolesList?.addEventListener("click", handleRoleAction);
  els.dialog?.querySelector("[data-dialog-close]")?.addEventListener("click", closeDialog);
  els.dialog?.addEventListener("click", (event) => {
    if (event.target === els.dialog) closeDialog();
  });
}

async function loadUserDependencies() {
  state.hotels = getAuthorizedHotels(state.session);
  try {
    const payload = await adminApi("/api/v1/admin/roles");
    state.roles = payload.data.roles || [];
  } catch {
    state.roles = [];
  }
}

async function loadUsers() {
  setManagerBusy(els.usersList, true);
  const params = new URLSearchParams();
  if (els.usersSearch?.value.trim()) params.set("q", els.usersSearch.value.trim());
  if (els.usersStatus?.value) params.set("status", els.usersStatus.value);
  try {
    const payload = await adminApi(`/api/v1/admin/users${params.size ? `?${params}` : ""}`);
    state.users = payload.data.users || [];
    els.usersSummary.textContent = `${state.users.length} ${state.users.length === 1 ? "usuário encontrado" : "usuários encontrados"}.`;
    els.usersList.innerHTML = state.users.map(renderUserRow).join("") || empty("Nenhum usuário encontrado.");
  } catch (error) {
    els.usersSummary.textContent = error.message || "Não foi possível carregar os usuários.";
  } finally {
    setManagerBusy(els.usersList, false);
  }
}

function setManagerBusy(element, busy) {
  element?.closest(".admin-management-panel")?.toggleAttribute("aria-busy", busy);
}

function renderUserRow(user) {
  const actions = [];
  const isMaster = Number(user.number || 0) === 1;
  if (user.id !== state.session?.user?.id) actions.push(actionButton("Enviar mensagem", "message-user", user.id, "mail"));
  if (!isMaster && hasPermission(state.session, PERMISSIONS.usersUpdate)) actions.push(actionButton("Editar", "edit-user", user.id, "edit"));
  if (!isMaster && user.status === "active" && hasPermission(state.session, PERMISSIONS.usersDisable)) {
    actions.push(actionButton("Desativar", "disable-user", user.id, "pause"));
  }
  if (!isMaster && user.status !== "active" && hasPermission(state.session, PERMISSIONS.usersUpdate)) {
    actions.push(actionButton("Ativar", "activate-user", user.id, "play"));
  }
  if (hasPermission(state.session, PERMISSIONS.usersPasswordReset)) {
    actions.push(actionButton("Redefinir senha", "reset-user", user.id, "key"));
  }
  if (hasPermission(state.session, PERMISSIONS.usersSessionsRevoke)) {
    actions.push(actionButton("Encerrar sessões", "revoke-user", user.id, "logout"));
  }
  if (!isMaster && hasPermission(state.session, PERMISSIONS.usersDisable) && user.id !== state.session?.user?.id) {
    actions.push(actionButton("Remover usuário", "remove-user", user.id, "trash", "danger"));
  }
  return `
    <article class="admin-data-row admin-management-row">
      <span class="admin-avatar">${escapeHtml(initials(user.display_name))}</span>
      <div class="admin-row-copy">
        <strong>Usuário nº ${escapeHtml(user.number || "-")} · ${escapeHtml(user.display_name)} ${isMaster ? '<span class="admin-master-badge">Administrador mestre</span>' : ""}</strong>
        <span>${escapeHtml(user.email)}</span>
        <small>${escapeHtml(user.roles.map((role) => role.name).join(", ") || "Sem perfil")} · ${escapeHtml(user.hotels.map((hotel) => hotel.short_name).join(", ") || "Sem unidade")}</small>
      </div>
      <span class="admin-status-chip" data-status="${escapeAttr(user.status)}">${user.status === "active" ? "Ativo" : "Desativado"}</span>
      <span class="admin-session-count">${Number(user.active_session_count || 0)} ${Number(user.active_session_count || 0) === 1 ? "sessão" : "sessões"}</span>
      <div class="admin-row-actions">${actions.join("")}</div>
    </article>`;
}

function renderRoleRow(role) {
  const edit = !role.protected && (hasPermission(state.session, PERMISSIONS.rolesUpdate) || hasPermission(state.session, PERMISSIONS.rolesPermissions));
  const removable = !role.protected && hasPermission(state.session, PERMISSIONS.rolesUpdate);
  return `
    <article class="admin-data-row admin-management-row">
      <span class="admin-role-icon">${icon("shield")}</span>
      <div class="admin-row-copy">
        <strong>Perfil nº ${escapeHtml(role.number || "-")} · ${escapeHtml(role.name)} ${role.protected ? '<span class="admin-master-badge">Protegido</span>' : ""}</strong>
        <span>${escapeHtml(role.description || "Perfil administrativo")}</span>
        <small>${role.permissions.length} ${role.permissions.length === 1 ? "permissão" : "permissões"} · ${Number(role.user_count || 0)} ${Number(role.user_count || 0) === 1 ? "usuário" : "usuários"}</small>
      </div>
      <div class="admin-permission-preview">${role.permissions.slice(0, 3).map((item) => `<span>${escapeHtml(item.label || item.permission_key)}</span>`).join("")}</div>
      <div class="admin-row-actions">${edit ? actionButton("Editar", "edit-role", role.id, "edit") : ""}${removable ? actionButton("Remover perfil", "remove-role", role.id, "trash", "danger") : ""}</div>
    </article>`;
}

async function handleUserAction(event) {
  const button = event.target.closest("[data-admin-action]");
  if (!button) return;
  const user = state.users.find((item) => item.id === button.dataset.id);
  if (!user) return;
  const action = button.dataset.adminAction;
  if (action === "message-user") {
    window.history.pushState({}, "", `/admin/mensagens/?to=${encodeURIComponent(user.id)}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  if (action === "edit-user") return openUserEditor(user);
  if (action === "disable-user" && !window.confirm(`Desativar o acesso de ${user.display_name}?`)) return;
  if (action === "reset-user" && !window.confirm(`Gerar uma nova senha temporária para ${user.display_name}?`)) return;
  if (action === "revoke-user" && !window.confirm(`Encerrar todas as sessões de ${user.display_name}?`)) return;
  if (action === "remove-user" && !window.confirm(`Remover o acesso de ${user.display_name}? O histórico administrativo será preservado.`)) return;
  const paths = {
    "disable-user": `/api/v1/admin/users/${encodeURIComponent(user.id)}/disable`,
    "activate-user": `/api/v1/admin/users/${encodeURIComponent(user.id)}/activate`,
    "reset-user": `/api/v1/admin/users/${encodeURIComponent(user.id)}/password-reset`,
    "revoke-user": `/api/v1/admin/users/${encodeURIComponent(user.id)}/sessions/revoke`,
    "remove-user": `/api/v1/admin/users/${encodeURIComponent(user.id)}`,
  };
  if (!paths[action]) return;
  button.disabled = true;
  try {
    const payload = await adminApi(paths[action], { method: action === "remove-user" ? "DELETE" : "POST", body: {} });
    if (payload.data.temporary_password) showTemporaryPassword(payload.data.temporary_password, user.display_name);
    if (action === "revoke-user") window.alert(`${payload.data.revoked_sessions || 0} sessão(ões) encerrada(s).`);
    await loadUsers();
  } catch (error) {
    window.alert(error.message || "Não foi possível concluir a ação.");
  } finally {
    button.disabled = false;
  }
}

function openUserEditor(user = null) {
  els.dialogTitle.textContent = user ? "Editar usuário" : "Novo usuário";
  const selectedRoles = new Set((user?.roles || []).map((role) => role.id));
  const selectedHotels = new Set((user?.hotels || []).map((hotel) => hotel.hotel_id));
  els.dialogBody.innerHTML = `
    <form id="adminUserForm" class="admin-form-stack">
      <div class="admin-form-grid">
        <label><span>Nome</span><input name="display_name" maxlength="160" value="${escapeAttr(user?.display_name || "")}" required></label>
        <label><span>E-mail</span><input name="email" type="email" maxlength="180" value="${escapeAttr(user?.email || "")}" required></label>
      </div>
      <fieldset><legend>Perfis</legend><div class="admin-choice-grid">${state.roles.map((role) => checkbox("role_ids", role.id, role.name, selectedRoles.has(role.id))).join("") || '<p class="admin-muted">Nenhum perfil disponível.</p>'}</div></fieldset>
      <fieldset><legend>Unidades autorizadas</legend><div class="admin-choice-grid">${state.hotels.map((hotel) => checkbox("hotel_ids", hotel.hotel_id, hotel.short_name || hotel.name, selectedHotels.has(hotel.hotel_id))).join("")}</div></fieldset>
      <p class="admin-dialog-message" role="status"></p>
      <div class="admin-dialog-actions"><button type="button" data-dialog-cancel>Cancelar</button><button class="admin-primary-button" type="submit">${user ? "Salvar alterações" : "Criar usuário"}</button></div>
    </form>`;
  openDialog();
  els.dialogBody.querySelector("[data-dialog-cancel]").addEventListener("click", closeDialog);
  els.dialogBody.querySelector("#adminUserForm").addEventListener("submit", (event) => saveUser(event, user));
}

async function saveUser(event, user) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = form.querySelector(".admin-dialog-message");
  const submit = form.querySelector('[type="submit"]');
  const data = new FormData(form);
  const body = {
    display_name: data.get("display_name"),
    email: data.get("email"),
    role_ids: data.getAll("role_ids"),
    hotel_ids: data.getAll("hotel_ids"),
  };
  submit.disabled = true;
  message.textContent = "Salvando...";
  try {
    const payload = await adminApi(user ? `/api/v1/admin/users/${encodeURIComponent(user.id)}` : "/api/v1/admin/users", {
      method: user ? "PATCH" : "POST",
      body,
    });
    closeDialog();
    await loadUsers();
    if (payload.data.temporary_password) showTemporaryPassword(payload.data.temporary_password, body.display_name);
  } catch (error) {
    message.textContent = error.message || "Não foi possível salvar o usuário.";
  } finally {
    submit.disabled = false;
  }
}

async function handleRoleAction(event) {
  const button = event.target.closest("[data-admin-action]");
  if (!button) return;
  const role = state.roles.find((item) => item.id === button.dataset.id);
  if (!role) return;
  if (button.dataset.adminAction === "edit-role") {
    openRoleEditor(role);
    return;
  }
  if (button.dataset.adminAction !== "remove-role") return;
  if (!window.confirm(`Remover o perfil "${role.name}"? Esta ação não pode ser desfeita.`)) return;
  button.disabled = true;
  try {
    await adminApi(`/api/v1/admin/roles/${encodeURIComponent(role.id)}`, { method: "DELETE", body: {} });
    await renderRolesManager(state.session);
  } catch (error) {
    window.alert(error.message || "Não foi possível remover o perfil. Perfis em uso ou protegidos devem ser preservados.");
  } finally {
    button.disabled = false;
  }
}

function openRoleEditor(role = null) {
  els.dialogTitle.textContent = role ? "Editar perfil" : "Novo perfil";
  const selected = new Set((role?.permissions || []).map((permission) => permission.permission_key));
  const groups = groupPermissions(state.permissions);
  els.dialogBody.innerHTML = `
    <form id="adminRoleForm" class="admin-form-stack">
      <div class="admin-form-grid">
        <label><span>Nome</span><input name="name" maxlength="120" value="${escapeAttr(role?.name || "")}" required></label>
        <label><span>Identificador</span><input name="role_key" maxlength="80" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${escapeAttr(role?.role_key || "")}" ${role ? "disabled" : "required"}></label>
      </div>
      <label><span>Descrição</span><textarea name="description" maxlength="500" rows="2">${escapeHtml(role?.description || "")}</textarea></label>
      <div class="admin-permission-groups">${Object.entries(groups).map(([group, permissions]) => `
        <fieldset><legend>${escapeHtml(group)}</legend><div class="admin-choice-grid">${permissions.map((permission) => checkbox("permission_keys", permission.permission_key, permission.label, selected.has(permission.permission_key), permission.description)).join("")}</div></fieldset>`).join("")}</div>
      <p class="admin-dialog-message" role="status"></p>
      <div class="admin-dialog-actions"><button type="button" data-dialog-cancel>Cancelar</button><button class="admin-primary-button" type="submit">Salvar perfil</button></div>
    </form>`;
  openDialog();
  els.dialogBody.querySelector("[data-dialog-cancel]").addEventListener("click", closeDialog);
  els.dialogBody.querySelector("#adminRoleForm").addEventListener("submit", (event) => saveRole(event, role));
}

async function saveRole(event, role) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const message = form.querySelector(".admin-dialog-message");
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  message.textContent = "Salvando...";
  try {
    let roleId = role?.id;
    if (role) {
      await adminApi(`/api/v1/admin/roles/${encodeURIComponent(role.id)}`, {
        method: "PATCH",
        body: { name: data.get("name"), description: data.get("description") },
      });
    } else {
      await adminApi("/api/v1/admin/roles", {
        method: "POST",
        body: { role_key: data.get("role_key"), name: data.get("name"), description: data.get("description") },
      });
      const refreshed = await adminApi("/api/v1/admin/roles");
      roleId = refreshed.data.roles.find((item) => item.role_key === data.get("role_key"))?.id;
    }
    if (roleId && hasPermission(state.session, PERMISSIONS.rolesPermissions)) {
      await adminApi(`/api/v1/admin/roles/${encodeURIComponent(roleId)}/permissions`, {
        method: "PATCH",
        body: { permission_keys: data.getAll("permission_keys") },
      });
    }
    closeDialog();
    await renderRolesManager(state.session);
  } catch (error) {
    message.textContent = error.message || "Não foi possível salvar o perfil.";
  } finally {
    submit.disabled = false;
  }
}

function showTemporaryPassword(password, displayName) {
  els.dialogTitle.textContent = "Acesso temporário criado";
  els.dialogBody.innerHTML = `
    <div class="admin-secret-once">
      <p>Entregue esta senha a ${escapeHtml(displayName)} por um canal seguro. Ela será exibida somente agora.</p>
      <code data-temporary-password>${escapeHtml(password)}</code>
      <div class="admin-dialog-actions"><button type="button" data-copy-password>Copiar senha</button><button class="admin-primary-button" type="button" data-dialog-done>Concluir</button></div>
    </div>`;
  openDialog();
  els.dialogBody.querySelector("[data-copy-password]").addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(password);
    event.currentTarget.textContent = "Copiada";
  });
  els.dialogBody.querySelector("[data-dialog-done]").addEventListener("click", closeDialog);
}

function groupPermissions(permissions) {
  return permissions.reduce((groups, permission) => {
    (groups[permission.group || "Configurações"] ||= []).push(permission);
    return groups;
  }, {});
}

function checkbox(name, value, label, checked, description = "") {
  return `<label class="admin-choice"><input type="checkbox" name="${escapeAttr(name)}" value="${escapeAttr(value)}" ${checked ? "checked" : ""}><span><strong>${escapeHtml(label)}</strong>${description ? `<small>${escapeHtml(description)}</small>` : ""}</span></label>`;
}

function actionButton(label, action, id, iconName, className = "") {
  return `<button class="${escapeAttr(className)}" type="button" data-admin-action="${escapeAttr(action)}" data-id="${escapeAttr(id)}" title="${escapeAttr(label)}">${icon(iconName)}<span>${escapeHtml(label)}</span></button>`;
}

function icon(name) {
  const paths = {
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    pause: '<path d="M9 4H5v16h4zM19 4h-4v16h4z"/>',
    play: '<path d="m5 3 14 9-14 9z"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M15 8l2 2M17 6l2 2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
    shield: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
  };
  return `<svg class="admin-svg-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.edit}</svg>`;
}

function openDialog() {
  if (!els.dialog.open) els.dialog.showModal();
}

function closeDialog() {
  if (els.dialog.open) els.dialog.close();
  els.dialogBody.innerHTML = "";
}

function initials(name) {
  return String(name || "Usuário").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function empty(message) {
  return `<p class="admin-empty">${escapeHtml(message)}</p>`;
}
