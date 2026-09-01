import { adminApi } from "./shared/admin-api.js";
import { setupAdminAccountExperience } from "./admin-account-experience.js";

const STYLESHEET_HREF = "/css/modules/admin/admin-passkeys.css?v=20260901-2";
let passkeyListLoaded = false;

setupStyles();
setupLoginPasskey();
setupAdminAccountExperience();
setupAccountPasskeys();

function setupStyles() {
  if (document.querySelector('link[data-admin-passkeys]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_HREF;
  link.dataset.adminPasskeys = "";
  document.head.append(link);
}

function setupLoginPasskey() {
  const form = document.getElementById("loginForm");
  const passwordButton = document.getElementById("loginButton");
  const error = document.getElementById("loginError");
  const email = document.getElementById("loginEmail");
  if (!form || !passwordButton || !error) return;

  if (email) email.setAttribute("autocomplete", "username webauthn");
  if (!supportsPasskeys()) return;

  const divider = document.createElement("div");
  divider.className = "admin-passkey-divider";
  divider.innerHTML = "<span>ou</span>";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-passkey-login-button";
  button.innerHTML = `${passkeyIcon()}<span>Entrar com chave de acesso</span>`;
  button.addEventListener("click", async () => {
    error.textContent = "";
    button.disabled = true;
    const original = button.innerHTML;
    button.textContent = "Abrindo sua chave de acesso...";
    try {
      const optionsPayload = await adminApi("/api/v1/admin/passkeys/login/options", { method: "POST", body: {} });
      const publicKey = decodeRequestOptions(optionsPayload.data.publicKey);
      const credential = await navigator.credentials.get({ publicKey });
      if (!credential) throw new Error("Nenhuma chave de acesso foi selecionada.");
      await adminApi("/api/v1/admin/passkeys/login/verify", {
        method: "POST",
        body: { credential: serializeAssertion(credential) },
      });
      window.location.reload();
    } catch (exception) {
      if (exception?.name === "NotAllowedError") {
        error.textContent = "A chave de acesso foi cancelada ou não está disponível neste dispositivo.";
      } else {
        error.textContent = exception?.message || "Não foi possível entrar com a chave de acesso.";
      }
      button.disabled = false;
      button.innerHTML = original;
    }
  });

  passwordButton.insertAdjacentElement("afterend", divider);
  divider.insertAdjacentElement("afterend", button);
}

function setupAccountPasskeys() {
  const manager = document.getElementById("accountManager");
  const details = document.getElementById("accountDetails");
  const securityGrid = document.getElementById("accountSecurityGrid");
  if (!manager || !details || manager.querySelector("[data-admin-passkey-manager]")) return;

  const section = document.createElement("section");
  section.className = "admin-passkey-card";
  section.dataset.adminPasskeyManager = "";
  section.innerHTML = `
    <div class="admin-passkey-card-head">
      <span class="admin-passkey-card-icon">${passkeyIcon()}</span>
      <div>
        <strong>Chaves de acesso</strong>
        <p>Entre com Windows Hello, biometria, PIN ou uma passkey sincronizada, sem digitar sua senha.</p>
      </div>
      <button class="admin-primary-button" type="button" data-passkey-add>${passkeyIcon()}<span>Nova chave de acesso</span></button>
    </div>
    <p class="admin-passkey-status" data-passkey-status role="status" aria-live="polite"></p>
    <div class="admin-passkey-list" data-passkey-list></div>
  `;
  if (securityGrid) securityGrid.prepend(section);
  else details.insertAdjacentElement("afterend", section);

  const addButton = section.querySelector("[data-passkey-add]");
  const status = section.querySelector("[data-passkey-status]");
  const list = section.querySelector("[data-passkey-list]");
  const enrollDialog = createEnrollmentDialog();
  document.body.append(enrollDialog);
  const password = enrollDialog.querySelector("[data-passkey-password]");
  const name = enrollDialog.querySelector("[data-passkey-name]");
  const confirmButton = enrollDialog.querySelector("[data-passkey-confirm]");
  const dialogStatus = enrollDialog.querySelector("[data-passkey-dialog-status]");

  if (!supportsPasskeys()) {
    section.classList.add("is-unsupported");
    addButton.hidden = true;
    status.textContent = "Este navegador ou dispositivo não oferece suporte a chaves de acesso.";
    return;
  }

  addButton.addEventListener("click", () => {
    password.value = "";
    name.value = defaultPasskeyName();
    dialogStatus.textContent = "";
    enrollDialog.showModal();
    requestAnimationFrame(() => password.focus());
  });

  confirmButton.addEventListener("click", async () => {
    dialogStatus.textContent = "";
    if (!password.value) {
      dialogStatus.textContent = "Confirme sua senha atual para continuar.";
      password.focus();
      return;
    }
    confirmButton.disabled = true;
    const original = confirmButton.textContent;
    confirmButton.textContent = "Preparando...";
    try {
      const optionsPayload = await adminApi("/api/v1/admin/me/passkeys/registration/options", {
        method: "POST",
        body: { current_password: password.value },
      });
      const publicKey = decodeCreationOptions(optionsPayload.data.publicKey);
      const credential = await navigator.credentials.create({ publicKey });
      if (!credential) throw new Error("A chave de acesso não foi criada.");
      await adminApi("/api/v1/admin/me/passkeys/registration/verify", {
        method: "POST",
        body: {
          credential: serializeRegistration(credential),
          device_name: name.value.trim() || defaultPasskeyName(),
        },
      });
      enrollDialog.close();
      password.value = "";
      status.textContent = "Chave de acesso adicionada. Ela já pode ser usada no próximo login.";
      await refreshPasskeyList(list);
    } catch (exception) {
      if (exception?.name === "NotAllowedError") {
        dialogStatus.textContent = "A criação da chave de acesso foi cancelada.";
      } else if (exception?.name === "InvalidStateError") {
        dialogStatus.textContent = "Esta chave de acesso já está cadastrada na sua conta.";
      } else {
        dialogStatus.textContent = exception?.message || "Não foi possível adicionar a chave de acesso.";
      }
    } finally {
      confirmButton.disabled = false;
      confirmButton.textContent = original;
    }
  });

  list.addEventListener("click", async (event) => {
    const removeButton = event.target.closest("[data-passkey-remove]");
    if (!removeButton) return;
    const confirmed = await confirmPasskeyRemoval(removeButton.dataset.passkeyName || "esta chave de acesso");
    if (!confirmed) return;
    removeButton.disabled = true;
    status.textContent = "Removendo chave de acesso...";
    try {
      await adminApi(`/api/v1/admin/me/passkeys/${encodeURIComponent(removeButton.dataset.passkeyRemove)}`, {
        method: "DELETE",
        body: {},
      });
      status.textContent = "Chave de acesso removida.";
      await refreshPasskeyList(list);
    } catch (exception) {
      status.textContent = exception?.message || "Não foi possível remover a chave de acesso.";
      removeButton.disabled = false;
    }
  });

  enrollDialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-passkey-dialog-close]")) enrollDialog.close();
    if (event.target === enrollDialog) enrollDialog.close();
  });

  const observer = new MutationObserver(() => {
    if (!manager.hidden && !passkeyListLoaded) void refreshPasskeyList(list);
  });
  observer.observe(manager, { attributes: true, attributeFilter: ["hidden"] });
  if (!manager.hidden || window.location.pathname.startsWith("/admin/minha-conta/")) void refreshPasskeyList(list);
}

function createEnrollmentDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "admin-account-dialog admin-passkey-dialog";
  dialog.dataset.passkeyDialog = "enroll";
  dialog.innerHTML = `
    <div class="admin-account-dialog-shell">
      <header>
        <div class="admin-account-dialog-heading">
          <span class="admin-account-dialog-icon">${passkeyIcon()}</span>
          <div><span>Segurança</span><h2>Nova chave de acesso</h2><p>Confirme sua identidade e dê um nome fácil de reconhecer para esta chave.</p></div>
        </div>
        <button type="button" class="admin-account-dialog-close" data-passkey-dialog-close aria-label="Fechar">${closeIcon()}</button>
      </header>
      <div class="admin-account-dialog-body">
        <div class="admin-passkey-dialog-form">
          <label><span>Senha atual</span><input type="password" autocomplete="current-password" maxlength="300" data-passkey-password></label>
          <label><span>Nome da chave</span><input type="text" maxlength="80" autocomplete="off" data-passkey-name><small>Ex.: Windows Hello do escritório ou iPhone pessoal.</small></label>
          <p class="admin-passkey-dialog-status" data-passkey-dialog-status role="status" aria-live="polite"></p>
          <div class="admin-passkey-dialog-actions">
            <button type="button" data-passkey-dialog-close>Cancelar</button>
            <button class="admin-primary-button" type="button" data-passkey-confirm>Continuar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  return dialog;
}

async function confirmPasskeyRemoval(name) {
  const dialog = document.createElement("dialog");
  dialog.className = "admin-account-dialog admin-passkey-dialog";
  dialog.innerHTML = `
    <div class="admin-account-dialog-shell">
      <header>
        <div class="admin-account-dialog-heading">
          <span class="admin-account-dialog-icon">${passkeyIcon()}</span>
          <div><span>Segurança</span><h2>Remover chave de acesso</h2><p>Depois de removida, esta chave não poderá mais ser usada para entrar.</p></div>
        </div>
        <button type="button" class="admin-account-dialog-close" data-passkey-cancel aria-label="Fechar">${closeIcon()}</button>
      </header>
      <div class="admin-account-dialog-body">
        <div class="admin-passkey-remove-summary"><strong>${escapeHtml(name)}</strong><span>As outras chaves da sua conta continuarão funcionando normalmente.</span></div>
        <div class="admin-passkey-dialog-actions">
          <button type="button" data-passkey-cancel>Cancelar</button>
          <button type="button" class="admin-passkey-danger" data-passkey-remove-confirm>Remover chave</button>
        </div>
      </div>
    </div>
  `;
  document.body.append(dialog);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-passkey-remove-confirm]")) finish(true);
      else if (event.target.closest("[data-passkey-cancel]") || event.target === dialog) finish(false);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.showModal();
  });
}

async function refreshPasskeyList(list) {
  passkeyListLoaded = true;
  list.setAttribute("aria-busy", "true");
  try {
    const payload = await adminApi("/api/v1/admin/me/passkeys");
    const passkeys = payload.data.passkeys || [];
    list.innerHTML = passkeys.length
      ? passkeys.map(renderPasskey).join("")
      : '<div class="admin-passkey-empty"><strong>Nenhuma chave cadastrada</strong><span>Adicione uma chave para entrar sem digitar sua senha.</span></div>';
  } catch (exception) {
    passkeyListLoaded = false;
    list.innerHTML = `<div class="admin-passkey-empty"><span>${escapeHtml(exception?.message || "Não foi possível carregar suas chaves de acesso.")}</span></div>`;
  } finally {
    list.removeAttribute("aria-busy");
  }
}

function renderPasskey(passkey) {
  const used = passkey.last_used_at ? `Último uso ${formatDate(passkey.last_used_at)}` : "Ainda não utilizada";
  const created = `Adicionada ${formatDate(passkey.created_at)}`;
  const name = passkey.device_name || "Chave de acesso";
  return `
    <article class="admin-passkey-row">
      <span class="admin-passkey-row-icon">${passkeyIcon()}</span>
      <div>
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(used)} · ${escapeHtml(created)}</span>
      </div>
      <span class="admin-passkey-state">Ativa</span>
      <button type="button" data-passkey-remove="${escapeAttr(passkey.id)}" data-passkey-name="${escapeAttr(name)}">Remover</button>
    </article>`;
}

function decodeCreationOptions(options) {
  return {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    user: { ...options.user, id: base64UrlToBuffer(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id),
    })),
  };
}

function decodeRequestOptions(options) {
  return {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    allowCredentials: options.allowCredentials?.map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id),
    })),
  };
}

function serializeRegistration(credential) {
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || null,
    response: {
      clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
      attestationObject: bufferToBase64Url(credential.response.attestationObject),
      transports: credential.response.getTransports?.() || [],
    },
  };
}

function serializeAssertion(credential) {
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || null,
    response: {
      clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
      authenticatorData: bufferToBase64Url(credential.response.authenticatorData),
      signature: bufferToBase64Url(credential.response.signature),
      userHandle: credential.response.userHandle ? bufferToBase64Url(credential.response.userHandle) : null,
    },
  };
}

function supportsPasskeys() {
  return Boolean(window.PublicKeyCredential && navigator.credentials?.create && navigator.credentials?.get);
}

function defaultPasskeyName() {
  const agent = navigator.userAgent || "";
  if (/Windows/i.test(agent)) return "Windows Hello";
  if (/iPhone|iPad|iPod/i.test(agent)) return "Passkey do iPhone/iPad";
  if (/Android/i.test(agent)) return "Passkey do Android";
  if (/Macintosh|Mac OS X/i.test(agent)) return "Passkey do Mac";
  return "Chave de acesso";
}

function base64UrlToBuffer(value) {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bufferToBase64Url(value) {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "em data desconhecida";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function passkeyIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4"></circle><path d="M11 12l8-8M15 8l2 2M17 6l2 2"></path></svg>';
}

function closeIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
