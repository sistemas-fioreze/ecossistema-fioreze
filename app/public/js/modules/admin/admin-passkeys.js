import { adminApi } from "./shared/admin-api.js";

const STYLESHEET_HREF = "/css/modules/admin/admin-passkeys.css?v=20260901-1";
let passkeyListLoaded = false;

setupStyles();
setupLoginPasskey();
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
    </div>
    <div class="admin-passkey-enroll" data-passkey-enroll>
      <label>
        <span>Confirme sua senha atual</span>
        <input type="password" autocomplete="current-password" maxlength="300" data-passkey-password>
      </label>
      <button class="admin-primary-button" type="button" data-passkey-add>${passkeyIcon()}<span>Adicionar chave de acesso</span></button>
    </div>
    <p class="admin-passkey-status" data-passkey-status role="status" aria-live="polite"></p>
    <div class="admin-passkey-list" data-passkey-list></div>
  `;
  details.insertAdjacentElement("afterend", section);

  const password = section.querySelector("[data-passkey-password]");
  const addButton = section.querySelector("[data-passkey-add]");
  const status = section.querySelector("[data-passkey-status]");
  const list = section.querySelector("[data-passkey-list]");

  if (!supportsPasskeys()) {
    section.classList.add("is-unsupported");
    section.querySelector("[data-passkey-enroll]").hidden = true;
    status.textContent = "Este navegador ou dispositivo não oferece suporte a chaves de acesso.";
    return;
  }

  addButton.addEventListener("click", async () => {
    status.textContent = "";
    if (!password.value) {
      status.textContent = "Digite sua senha atual para cadastrar uma nova chave de acesso.";
      password.focus();
      return;
    }
    addButton.disabled = true;
    const original = addButton.innerHTML;
    addButton.textContent = "Preparando chave de acesso...";
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
          device_name: defaultPasskeyName(),
        },
      });
      password.value = "";
      status.textContent = "Chave de acesso adicionada. No próximo login, você já pode entrar sem senha.";
      await refreshPasskeyList(list);
    } catch (exception) {
      if (exception?.name === "NotAllowedError") {
        status.textContent = "A criação da chave de acesso foi cancelada.";
      } else if (exception?.name === "InvalidStateError") {
        status.textContent = "Esta chave de acesso já está cadastrada na sua conta.";
      } else {
        status.textContent = exception?.message || "Não foi possível adicionar a chave de acesso.";
      }
    } finally {
      addButton.disabled = false;
      addButton.innerHTML = original;
    }
  });

  list.addEventListener("click", async (event) => {
    const removeButton = event.target.closest("[data-passkey-remove]");
    if (!removeButton) return;
    if (!window.confirm("Remover esta chave de acesso? Ela não poderá mais ser usada para entrar.")) return;
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

  const observer = new MutationObserver(() => {
    if (!manager.hidden && !passkeyListLoaded) void refreshPasskeyList(list);
  });
  observer.observe(manager, { attributes: true, attributeFilter: ["hidden"] });
  if (!manager.hidden || window.location.pathname.startsWith("/admin/minha-conta/")) void refreshPasskeyList(list);
}

async function refreshPasskeyList(list) {
  passkeyListLoaded = true;
  list.setAttribute("aria-busy", "true");
  try {
    const payload = await adminApi("/api/v1/admin/me/passkeys");
    const passkeys = payload.data.passkeys || [];
    list.innerHTML = passkeys.length
      ? passkeys.map(renderPasskey).join("")
      : '<div class="admin-passkey-empty"><strong>Nenhuma chave de acesso cadastrada</strong><span>Adicione uma para entrar com biometria, PIN ou o desbloqueio do seu dispositivo.</span></div>';
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
  return `
    <article class="admin-passkey-row">
      <span class="admin-passkey-row-icon">${passkeyIcon()}</span>
      <div>
        <strong>${escapeHtml(passkey.device_name || "Chave de acesso")}</strong>
        <span>${escapeHtml(used)} · ${escapeHtml(created)}</span>
      </div>
      <button type="button" data-passkey-remove="${escapeAttr(passkey.id)}">Remover</button>
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
