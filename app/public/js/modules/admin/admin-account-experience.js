import { adminApi } from "./shared/admin-api.js";

const STYLESHEET_HREF = "/css/modules/admin/admin-account.css?v=20260901-1";

export function setupAdminAccountExperience(root = document) {
  const manager = root.getElementById("accountManager");
  const details = root.getElementById("accountDetails");
  const avatarForm = root.getElementById("avatarForm");
  const avatarFile = root.getElementById("avatarFile");
  const passwordForm = root.getElementById("passwordForm");
  const accountMessage = root.getElementById("accountMessage");
  const revokeButton = root.getElementById("revokeOwnSessionsButton");
  if (!manager || !details || !avatarForm || !passwordForm || !accountMessage || !revokeButton) return;
  if (manager.dataset.accountExperience === "ready") return;
  manager.dataset.accountExperience = "ready";
  ensureStyles(root);

  const workspace = root.createElement("div");
  workspace.className = "admin-account-workspace";

  const profileSection = root.createElement("section");
  profileSection.className = "admin-account-profile-card";
  profileSection.innerHTML = `
    <div class="admin-account-section-copy">
      <span class="admin-account-kicker">Perfil</span>
      <h2>Suas informações</h2>
      <p>Identidade usada na Central Administrativa e nos ERPs.</p>
    </div>
    <div class="admin-account-profile-body" data-account-profile-body></div>
  `;
  const profileBody = profileSection.querySelector("[data-account-profile-body]");
  profileBody.append(details);
  const photoButton = root.createElement("button");
  photoButton.type = "button";
  photoButton.className = "admin-account-secondary-action";
  photoButton.dataset.accountDialogOpen = "avatar";
  photoButton.innerHTML = `${cameraIcon()}<span>Alterar foto</span>`;
  profileBody.append(photoButton);

  const securitySection = root.createElement("section");
  securitySection.className = "admin-account-section";
  securitySection.innerHTML = `
    <header class="admin-account-section-header">
      <div class="admin-account-section-copy">
        <span class="admin-account-kicker">Segurança</span>
        <h2>Login e proteção da conta</h2>
        <p>Gerencie como você entra e onde sua sessão administrativa permanece ativa.</p>
      </div>
    </header>
    <div id="accountSecurityGrid" class="admin-account-security-grid"></div>
  `;
  const securityGrid = securitySection.querySelector("#accountSecurityGrid");
  securityGrid.append(
    actionCard({
      root,
      icon: lockIcon(),
      title: "Senha",
      description: "Altere sua senha administrativa quando precisar renovar suas credenciais.",
      action: "Alterar senha",
      dialog: "password",
    }),
    actionCard({
      root,
      icon: devicesIcon(),
      title: "Sessões",
      description: "Encerre acessos mantidos em outros computadores, celulares ou navegadores.",
      action: "Gerenciar sessões",
      dialog: "sessions",
    }),
  );

  workspace.append(profileSection, securitySection);
  manager.prepend(workspace);
  accountMessage.classList.add("admin-account-toast");

  const avatarDialog = createDialog(root, {
    id: "adminAccountAvatarDialog",
    key: "avatar",
    kicker: "Perfil",
    title: "Alterar foto",
    description: "Escolha uma imagem para representar sua conta na Central Administrativa.",
    icon: cameraIcon(),
  });
  prepareAvatarForm(root, avatarForm, avatarFile);
  avatarDialog.querySelector("[data-account-dialog-body]").append(avatarForm);

  const passwordDialog = createDialog(root, {
    id: "adminAccountPasswordDialog",
    key: "password",
    kicker: "Segurança",
    title: "Alterar senha",
    description: "Confirme sua senha atual e escolha uma nova senha com pelo menos 12 caracteres.",
    icon: lockIcon(),
  });
  preparePasswordForm(passwordForm);
  passwordDialog.querySelector("[data-account-dialog-body]").append(passwordForm);

  const sessionsDialog = createDialog(root, {
    id: "adminAccountSessionsDialog",
    key: "sessions",
    kicker: "Segurança",
    title: "Encerrar outras sessões",
    description: "Use esta ação se você deixou sua conta aberta em outro dispositivo ou navegador.",
    icon: devicesIcon(),
  });
  const sessionBody = sessionsDialog.querySelector("[data-account-dialog-body]");
  const sessionNotice = root.createElement("div");
  sessionNotice.className = "admin-account-session-notice";
  sessionNotice.innerHTML = `${shieldIcon()}<div><strong>Sua sessão atual será mantida</strong><span>Somente as outras sessões administrativas serão encerradas.</span></div>`;
  sessionBody.append(sessionNotice, revokeButton);
  revokeButton.classList.add("admin-account-danger-action");
  revokeButton.textContent = "Encerrar outras sessões";

  root.body.append(avatarDialog, passwordDialog, sessionsDialog);
  setupDialogInteractions(root, manager);
  setupAvatarFilename(avatarFile, avatarDialog);
  setupActionSuccessObserver(accountMessage, { avatarDialog, passwordDialog });
  takeoverSessionRevoke(revokeButton, accountMessage, sessionsDialog);
}

function actionCard({ root, icon, title, description, action, dialog }) {
  const card = root.createElement("article");
  card.className = "admin-account-action-card";
  card.innerHTML = `
    <span class="admin-account-action-icon">${icon}</span>
    <div class="admin-account-action-copy">
      <strong>${title}</strong>
      <p>${description}</p>
    </div>
    <button type="button" data-account-dialog-open="${dialog}">${action}<span aria-hidden="true">›</span></button>
  `;
  return card;
}

function createDialog(root, { id, key, kicker, title, description, icon }) {
  const dialog = root.createElement("dialog");
  dialog.id = id;
  dialog.className = "admin-account-dialog";
  dialog.dataset.accountDialog = key;
  dialog.innerHTML = `
    <div class="admin-account-dialog-shell">
      <header>
        <div class="admin-account-dialog-heading">
          <span class="admin-account-dialog-icon">${icon}</span>
          <div><span>${kicker}</span><h2>${title}</h2><p>${description}</p></div>
        </div>
        <button type="button" class="admin-account-dialog-close" data-account-dialog-close aria-label="Fechar">${closeIcon()}</button>
      </header>
      <div class="admin-account-dialog-body" data-account-dialog-body></div>
    </div>
  `;
  return dialog;
}

function prepareAvatarForm(root, form, input) {
  form.classList.add("admin-account-dialog-form", "admin-account-avatar-form");
  const label = form.querySelector("label");
  const actions = form.querySelector(".admin-inline-actions");
  if (label) {
    label.classList.add("admin-account-upload-picker");
    const caption = label.querySelector("span");
    if (caption) caption.textContent = "Selecionar nova foto";
    input.classList.add("admin-account-file-input");
    const helper = root.createElement("span");
    helper.className = "admin-account-upload-helper";
    helper.innerHTML = `${imageIcon()}<span><strong>Escolher imagem</strong><small>JPG, PNG, WebP ou AVIF</small><em data-account-file-name>Nenhum arquivo selecionado</em></span>`;
    label.append(helper);
  }
  if (actions) actions.classList.add("admin-account-dialog-actions");
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.textContent = "Salvar nova foto";
  const remove = root.getElementById("deleteAvatarButton");
  if (remove) remove.classList.add("admin-account-text-danger");
}

function preparePasswordForm(form) {
  form.classList.add("admin-account-dialog-form", "admin-account-password-form");
  for (const label of form.querySelectorAll("label")) label.classList.add("admin-account-field");
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.textContent = "Salvar nova senha";
}

function setupAvatarFilename(input, dialog) {
  const fileName = dialog.querySelector("[data-account-file-name]");
  if (!input || !fileName) return;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    fileName.textContent = file?.name || "Nenhum arquivo selecionado";
    fileName.classList.toggle("has-file", Boolean(file));
  });
}

function setupDialogInteractions(root, manager) {
  manager.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-account-dialog-open]");
    if (!opener) return;
    const dialog = root.querySelector(`[data-account-dialog="${opener.dataset.accountDialogOpen}"]`);
    if (!dialog) return;
    dialog.showModal();
    requestAnimationFrame(() => dialog.querySelector("input, button:not([data-account-dialog-close])")?.focus());
  });
  root.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-account-dialog-close]");
    if (closer) closer.closest("dialog")?.close();
    if (event.target instanceof HTMLDialogElement && event.target.classList.contains("admin-account-dialog")) {
      event.target.close();
    }
  });
}

function setupActionSuccessObserver(message, { avatarDialog, passwordDialog }) {
  const observer = new MutationObserver(() => {
    const text = message.textContent.trim();
    if (/^Foto (atualizada|removida)/i.test(text) && avatarDialog.open) avatarDialog.close();
    if (/^Senha alterada/i.test(text) && passwordDialog.open) passwordDialog.close();
  });
  observer.observe(message, { childList: true, characterData: true, subtree: true });
}

function takeoverSessionRevoke(button, message, dialog) {
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    message.textContent = "Encerrando outras sessões...";
    try {
      const payload = await adminApi("/api/v1/admin/me/sessions/revoke", { method: "POST", body: {} });
      const count = Number(payload.data.revoked_sessions || 0);
      message.textContent = count === 1 ? "1 outra sessão foi encerrada." : `${count} outras sessões foram encerradas.`;
      dialog.close();
    } catch (error) {
      message.textContent = error?.message || "Não foi possível encerrar as outras sessões.";
    } finally {
      button.disabled = false;
    }
  }, { capture: true });
}

function ensureStyles(root) {
  if (root.querySelector('link[data-admin-account-experience]')) return;
  const link = root.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_HREF;
  link.dataset.adminAccountExperience = "";
  root.head.append(link);
}

function cameraIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h4l1.5-2h5L16 8h4v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle></svg>';
}

function lockIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>';
}

function devicesIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="14" height="10" rx="2"></rect><path d="M7 18h6M10 14v4"></path><rect x="17" y="9" width="4" height="9" rx="1"></rect></svg>';
}

function shieldIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6z"></path><path d="m9 12 2 2 4-4"></path></svg>';
}

function imageIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"></rect><circle cx="9" cy="9" r="1.5"></circle><path d="m6 17 4-4 3 3 2-2 3 3"></path></svg>';
}

function closeIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
}
