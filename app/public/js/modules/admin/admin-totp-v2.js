import { adminApi } from "./shared/admin-api.js";

const STYLESHEET_HREF = "/css/modules/admin/admin-totp.css?v=20260901-2";
let observer = null;

export function setupAdminTotp(root = document) {
  ensureStyles(root);
  const manager = root.getElementById("accountManager");
  if (!manager || manager.dataset.adminTotpSetup === "ready") return;

  const install = () => {
    const grid = root.getElementById("accountSecurityGrid");
    if (!grid) return false;
    if (manager.dataset.adminTotpSetup === "ready") return true;
    manager.dataset.adminTotpSetup = "ready";
    observer?.disconnect();
    observer = null;
    installTotpManager(root, manager, grid);
    return true;
  };

  if (install()) return;
  observer?.disconnect();
  observer = new MutationObserver(() => install());
  observer.observe(manager, { childList: true, subtree: true });
}

function installTotpManager(root, manager, grid) {
  const card = root.createElement("section");
  card.className = "admin-totp-card";
  card.dataset.adminTotpManager = "";
  card.innerHTML = `
    <div class="admin-totp-card-icon">${totpIcon()}</div>
    <div class="admin-totp-card-copy">
      <div class="admin-totp-card-title-row">
        <strong>Aplicativo autenticador</strong>
        <span class="admin-totp-state is-loading" data-totp-state>Verificando</span>
      </div>
      <p>Use códigos temporários do Google Authenticator, Microsoft Authenticator, 1Password ou outro app compatível.</p>
      <div class="admin-totp-meta" data-totp-meta hidden></div>
    </div>
    <div class="admin-totp-card-actions" data-totp-actions>
      <button type="button" data-totp-configure disabled>Configurar</button>
    </div>
    <p class="admin-totp-card-status" data-totp-card-status role="status" aria-live="polite"></p>
  `;
  grid.prepend(card);

  const statusBadge = card.querySelector("[data-totp-state]");
  const meta = card.querySelector("[data-totp-meta]");
  const actions = card.querySelector("[data-totp-actions]");
  const cardStatus = card.querySelector("[data-totp-card-status]");

  const identityDialog = createIdentityDialog(root);
  const setupDialog = createPairingDialog(root);
  const activationRecoveryDialog = createActivationRecoveryDialog(root);
  const recoveryDialog = createRecoveryDialog(root);
  const disableDialog = createDisableDialog(root);
  root.body.append(identityDialog, setupDialog, activationRecoveryDialog, recoveryDialog, disableDialog);

  const setupFlow = setupAuthenticatorFlow({
    identityDialog,
    setupDialog,
    activationRecoveryDialog,
    onComplete: async () => refreshStatus(),
  });
  recoveryDialogEvents(recoveryDialog, async () => refreshStatus());
  disableDialogEvents(disableDialog, async () => refreshStatus());
  installDialogCloseBehavior(root, identityDialog, setupDialog, activationRecoveryDialog, recoveryDialog, disableDialog);

  actions.addEventListener("click", (event) => {
    if (event.target.closest("[data-totp-configure]")) setupFlow.openIdentity();
    if (event.target.closest("[data-totp-recovery]")) openRecoveryDialog(recoveryDialog);
    if (event.target.closest("[data-totp-disable]")) openDisableDialog(disableDialog);
  });

  async function refreshStatus() {
    cardStatus.textContent = "";
    try {
      const payload = await adminApi("/api/v1/admin/me/totp");
      renderStatus({ data: payload.data || {}, statusBadge, meta, actions });
    } catch (error) {
      statusBadge.className = "admin-totp-state is-error";
      statusBadge.textContent = "Indisponível";
      actions.innerHTML = '<button type="button" data-totp-configure>Configurar</button>';
      cardStatus.textContent = error.message || "Não foi possível verificar o aplicativo autenticador.";
    }
  }

  const visibilityObserver = new MutationObserver(() => {
    if (!manager.hidden) void refreshStatus();
  });
  visibilityObserver.observe(manager, { attributes: true, attributeFilter: ["hidden"] });
  void refreshStatus();
}

function renderStatus({ data, statusBadge, meta, actions }) {
  const enabled = data.enabled === true;
  statusBadge.className = `admin-totp-state ${enabled ? "is-active" : "is-off"}`;
  statusBadge.textContent = enabled ? "Ativo" : "Desativado";
  if (enabled) {
    const enabledAt = data.enabled_at ? formatDate(data.enabled_at) : "data desconhecida";
    const remaining = Number(data.recovery_codes_remaining || 0);
    meta.hidden = false;
    meta.innerHTML = `
      <span><b>${remaining}</b> código${remaining === 1 ? "" : "s"} de recuperação disponível${remaining === 1 ? "" : "is"}</span>
      <span>Ativado em ${escapeHtml(enabledAt)}</span>
    `;
    actions.innerHTML = `
      <button type="button" data-totp-recovery>Novos códigos</button>
      <button type="button" class="is-danger" data-totp-disable>Desativar</button>
    `;
    return;
  }
  meta.hidden = true;
  meta.innerHTML = "";
  actions.innerHTML = `<button class="admin-primary-button" type="button" data-totp-configure>${totpIcon()}<span>Configurar autenticador</span></button>`;
}

function createIdentityDialog(root) {
  const dialog = root.createElement("dialog");
  dialog.className = "admin-account-dialog admin-totp-dialog admin-totp-identity-dialog";
  dialog.dataset.totpDialog = "identity";
  dialog.innerHTML = dialogShell({
    kicker: "Segurança",
    title: "Confirmar identidade",
    description: "Antes de configurar o autenticador, confirme que é realmente você.",
    icon: shieldIcon(),
    body: `
      <div class="admin-totp-identity-copy">
        <strong>Confirme sua senha atual</strong>
        <p>Essa verificação protege a criação de um novo segundo fator na sua conta.</p>
      </div>
      <label class="admin-totp-field">
        <span>Senha atual</span>
        <input type="password" autocomplete="current-password" maxlength="300" data-totp-identity-password>
      </label>
      <p class="admin-totp-dialog-status" data-totp-identity-status role="status" aria-live="polite"></p>
      <div class="admin-totp-dialog-actions">
        <button type="button" data-totp-dialog-close>Cancelar</button>
        <button class="admin-primary-button" type="button" data-totp-identity-continue>Continuar</button>
      </div>
    `,
  });
  return dialog;
}

function createPairingDialog(root) {
  const dialog = root.createElement("dialog");
  dialog.className = "admin-account-dialog admin-totp-dialog admin-totp-pairing-dialog";
  dialog.dataset.totpDialog = "pairing";
  dialog.innerHTML = dialogShell({
    kicker: "Segurança",
    title: "Configurar autenticador",
    description: "Escaneie o QR Code e confirme o primeiro código para ativar a proteção.",
    icon: totpIcon(),
    body: `
      <div class="admin-totp-pair-grid">
        <div class="admin-totp-qr-card">
          <div class="admin-totp-qr" data-totp-qr aria-label="QR Code do autenticador"></div>
          <span>Aponte a câmera do aplicativo autenticador para o código.</span>
        </div>
        <div class="admin-totp-pair-copy">
          <div>
            <strong>Escaneie o QR Code</strong>
            <p>Abra seu aplicativo autenticador, adicione uma nova conta e escaneie o código ao lado.</p>
          </div>
          <div class="admin-totp-secret-box">
            <span>Não consegue escanear?</span>
            <p>Adicione a conta manualmente usando esta chave.</p>
            <code data-totp-secret-display></code>
            <button type="button" data-totp-copy-secret>Copiar chave</button>
          </div>
        </div>
      </div>
      <div class="admin-totp-code-confirmation">
        <div>
          <strong>Confirme a configuração</strong>
          <p>Digite o código de 6 dígitos que apareceu no seu aplicativo.</p>
        </div>
        <label class="admin-totp-field admin-totp-code-field">
          <span>Código de 6 dígitos</span>
          <input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" data-totp-setup-code>
        </label>
      </div>
      <p class="admin-totp-dialog-status" data-totp-pair-status role="status" aria-live="polite"></p>
      <div class="admin-totp-dialog-actions">
        <button type="button" data-totp-pair-back>Voltar</button>
        <button class="admin-primary-button" type="button" data-totp-setup-verify>Ativar autenticador</button>
      </div>
    `,
  });
  return dialog;
}

function createActivationRecoveryDialog(root) {
  const dialog = root.createElement("dialog");
  dialog.className = "admin-account-dialog admin-totp-dialog admin-totp-recovery-dialog";
  dialog.dataset.totpDialog = "activation-recovery";
  dialog.innerHTML = dialogShell({
    kicker: "Segurança",
    title: "Guarde seus códigos de recuperação",
    description: "Eles são sua porta de emergência se você perder acesso ao aplicativo autenticador.",
    icon: recoveryIcon(),
    body: `
      ${recoveryCodesShell("Cada código substitui o código de 6 dígitos uma única vez. Guarde-os em um local seguro antes de concluir.")}
      <div class="admin-totp-dialog-actions">
        <button type="button" data-totp-download-codes>Baixar códigos</button>
        <button type="button" data-totp-copy-codes>Copiar todos</button>
        <button class="admin-primary-button" type="button" data-totp-finish>Concluir</button>
      </div>
    `,
  });
  return dialog;
}

function createRecoveryDialog(root) {
  const dialog = root.createElement("dialog");
  dialog.className = "admin-account-dialog admin-totp-dialog";
  dialog.dataset.totpDialog = "recovery";
  dialog.innerHTML = dialogShell({
    kicker: "Segurança",
    title: "Gerar novos códigos",
    description: "Os códigos atuais serão invalidados assim que os novos forem criados.",
    icon: recoveryIcon(),
    body: `
      <div data-totp-recovery-stage="verify">
        <div class="admin-totp-form-stack">
          <label class="admin-totp-field"><span>Senha atual</span><input type="password" autocomplete="current-password" maxlength="300" data-totp-recovery-password></label>
          <label class="admin-totp-field"><span>Código do autenticador</span><input type="text" autocomplete="one-time-code" maxlength="24" data-totp-recovery-factor><small>Você também pode usar um código de recuperação ainda válido.</small></label>
        </div>
        <p class="admin-totp-dialog-status" data-totp-recovery-status role="status" aria-live="polite"></p>
        <div class="admin-totp-dialog-actions"><button type="button" data-totp-dialog-close>Cancelar</button><button class="admin-primary-button" type="button" data-totp-regenerate>Gerar novos códigos</button></div>
      </div>
      <div data-totp-recovery-stage="codes" hidden>
        ${recoveryCodesShell("Guarde os novos códigos em um lugar seguro. Os anteriores já não funcionam mais.")}
        <div class="admin-totp-dialog-actions"><button type="button" data-totp-download-codes>Baixar códigos</button><button type="button" data-totp-copy-codes>Copiar todos</button><button class="admin-primary-button" type="button" data-totp-finish>Concluir</button></div>
      </div>
    `,
  });
  return dialog;
}

function createDisableDialog(root) {
  const dialog = root.createElement("dialog");
  dialog.className = "admin-account-dialog admin-totp-dialog";
  dialog.dataset.totpDialog = "disable";
  dialog.innerHTML = dialogShell({
    kicker: "Segurança",
    title: "Desativar autenticador",
    description: "Sua conta voltará a aceitar login por senha sem o segundo código.",
    icon: warningIcon(),
    body: `
      <div class="admin-totp-warning"><strong>Esta ação reduz a proteção da conta</strong><span>Passkeys continuarão funcionando normalmente, mas logins por senha deixarão de exigir o autenticador.</span></div>
      <div class="admin-totp-form-stack">
        <label class="admin-totp-field"><span>Senha atual</span><input type="password" autocomplete="current-password" maxlength="300" data-totp-disable-password></label>
        <label class="admin-totp-field"><span>Código do autenticador</span><input type="text" autocomplete="one-time-code" maxlength="24" data-totp-disable-factor><small>Um código de recuperação ainda válido também pode ser usado.</small></label>
      </div>
      <p class="admin-totp-dialog-status" data-totp-disable-status role="status" aria-live="polite"></p>
      <div class="admin-totp-dialog-actions"><button type="button" data-totp-dialog-close>Cancelar</button><button class="admin-totp-danger-button" type="button" data-totp-disable-confirm>Desativar autenticador</button></div>
    `,
  });
  return dialog;
}

function setupAuthenticatorFlow({ identityDialog, setupDialog, activationRecoveryDialog, onComplete }) {
  let setupToken = "";
  let rawSecret = "";
  let recoveryCodes = [];
  const password = identityDialog.querySelector("[data-totp-identity-password]");
  const identityStatus = identityDialog.querySelector("[data-totp-identity-status]");
  const code = setupDialog.querySelector("[data-totp-setup-code]");
  const pairStatus = setupDialog.querySelector("[data-totp-pair-status]");

  identityDialog.querySelector("[data-totp-identity-continue]").addEventListener("click", async (event) => {
    if (!password.value) {
      identityStatus.textContent = "Digite sua senha atual para continuar.";
      password.focus();
      return;
    }
    const button = event.currentTarget;
    setBusy(button, true, "Verificando...");
    identityStatus.textContent = "";
    try {
      const payload = await adminApi("/api/v1/admin/me/totp/setup/options", {
        method: "POST",
        body: { current_password: password.value },
      });
      const data = payload.data || {};
      setupToken = data.setup_token || "";
      rawSecret = data.secret || "";
      populatePairingDialog(setupDialog, data);
      identityDialog.close();
      setupDialog.showModal();
      requestAnimationFrame(() => code.focus());
    } catch (error) {
      identityStatus.textContent = error.message || "Não foi possível confirmar sua identidade.";
      password.select();
    } finally {
      setBusy(button, false, "Continuar");
    }
  });

  identityDialog.addEventListener("close", () => {
    password.value = "";
    identityStatus.textContent = "";
  });

  setupDialog.querySelector("[data-totp-copy-secret]").addEventListener("click", async (event) => {
    await copyText(rawSecret);
    event.currentTarget.textContent = "Copiado";
    setTimeout(() => { event.currentTarget.textContent = "Copiar chave"; }, 1400);
  });

  setupDialog.querySelector("[data-totp-pair-back]").addEventListener("click", () => {
    setupDialog.close();
    resetPairingDialog(setupDialog);
    setupToken = "";
    rawSecret = "";
    identityDialog.showModal();
    requestAnimationFrame(() => password.focus());
  });

  code.addEventListener("input", () => {
    code.value = code.value.replace(/\D/g, "").slice(0, 6);
    pairStatus.textContent = "";
  });

  setupDialog.querySelector("[data-totp-setup-verify]").addEventListener("click", async (event) => {
    if (!setupToken) {
      pairStatus.textContent = "A configuração expirou. Volte e confirme sua identidade novamente.";
      return;
    }
    if (code.value.length !== 6) {
      pairStatus.textContent = "Digite o código de 6 dígitos exibido no autenticador.";
      code.focus();
      return;
    }
    const button = event.currentTarget;
    setBusy(button, true, "Verificando...");
    pairStatus.textContent = "";
    try {
      const payload = await adminApi("/api/v1/admin/me/totp/setup/verify", {
        method: "POST",
        body: { setup_token: setupToken, code: code.value },
      });
      recoveryCodes = payload.data?.recovery_codes || [];
      renderRecoveryCodes(activationRecoveryDialog, recoveryCodes);
      setupDialog.close();
      resetPairingDialog(setupDialog);
      setupToken = "";
      rawSecret = "";
      activationRecoveryDialog.showModal();
      await onComplete();
    } catch (error) {
      pairStatus.textContent = error.message || "Não foi possível ativar o autenticador.";
      code.select();
    } finally {
      setBusy(button, false, "Ativar autenticador");
    }
  });

  wireRecoveryActions(activationRecoveryDialog, () => recoveryCodes);
  activationRecoveryDialog.querySelector("[data-totp-finish]").addEventListener("click", () => activationRecoveryDialog.close());
  activationRecoveryDialog.addEventListener("close", () => {
    recoveryCodes = [];
    renderRecoveryCodes(activationRecoveryDialog, []);
  });
  setupDialog.addEventListener("close", () => {
    pairStatus.textContent = "";
    code.value = "";
  });

  return {
    openIdentity() {
      setupToken = "";
      rawSecret = "";
      resetPairingDialog(setupDialog);
      password.value = "";
      identityStatus.textContent = "";
      identityDialog.showModal();
      requestAnimationFrame(() => password.focus());
    },
  };
}

function populatePairingDialog(dialog, data) {
  const qr = dialog.querySelector("[data-totp-qr]");
  const secret = String(data.secret || "");
  qr.innerHTML = data.qr_svg || "";
  dialog.querySelector("[data-totp-secret-display]").textContent = formatSecret(secret);
  dialog.querySelector("[data-totp-setup-code]").value = "";
  dialog.querySelector("[data-totp-pair-status]").textContent = "";
}

function resetPairingDialog(dialog) {
  dialog.querySelector("[data-totp-qr]").innerHTML = "";
  dialog.querySelector("[data-totp-secret-display]").textContent = "";
  dialog.querySelector("[data-totp-setup-code]").value = "";
  dialog.querySelector("[data-totp-pair-status]").textContent = "";
}

function recoveryDialogEvents(dialog, onComplete) {
  let recoveryCodes = [];
  const verifyStage = dialog.querySelector('[data-totp-recovery-stage="verify"]');
  const codesStage = dialog.querySelector('[data-totp-recovery-stage="codes"]');
  const password = dialog.querySelector("[data-totp-recovery-password]");
  const factor = dialog.querySelector("[data-totp-recovery-factor]");
  const status = dialog.querySelector("[data-totp-recovery-status]");

  dialog.querySelector("[data-totp-regenerate]").addEventListener("click", async (event) => {
    if (!password.value || !factor.value.trim()) {
      status.textContent = "Informe sua senha e um código de verificação.";
      return;
    }
    const button = event.currentTarget;
    setBusy(button, true, "Gerando...");
    status.textContent = "";
    try {
      const payload = await adminApi("/api/v1/admin/me/totp/recovery-codes/regenerate", {
        method: "POST",
        body: { current_password: password.value, code: factor.value.trim() },
      });
      recoveryCodes = payload.data?.recovery_codes || [];
      renderRecoveryCodes(codesStage, recoveryCodes);
      verifyStage.hidden = true;
      codesStage.hidden = false;
      await onComplete();
    } catch (error) {
      status.textContent = error.message || "Não foi possível gerar novos códigos.";
    } finally {
      setBusy(button, false, "Gerar novos códigos");
    }
  });

  wireRecoveryActions(dialog, () => recoveryCodes);
  dialog.querySelector("[data-totp-finish]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    verifyStage.hidden = false;
    codesStage.hidden = true;
    password.value = "";
    factor.value = "";
    status.textContent = "";
    recoveryCodes = [];
    renderRecoveryCodes(codesStage, []);
  });
}

function disableDialogEvents(dialog, onComplete) {
  const password = dialog.querySelector("[data-totp-disable-password]");
  const factor = dialog.querySelector("[data-totp-disable-factor]");
  const status = dialog.querySelector("[data-totp-disable-status]");
  dialog.querySelector("[data-totp-disable-confirm]").addEventListener("click", async (event) => {
    if (!password.value || !factor.value.trim()) {
      status.textContent = "Informe sua senha e um código de verificação.";
      return;
    }
    const button = event.currentTarget;
    setBusy(button, true, "Desativando...");
    status.textContent = "";
    try {
      await adminApi("/api/v1/admin/me/totp/disable", {
        method: "POST",
        body: { current_password: password.value, code: factor.value.trim() },
      });
      dialog.close();
      await onComplete();
    } catch (error) {
      status.textContent = error.message || "Não foi possível desativar o autenticador.";
    } finally {
      setBusy(button, false, "Desativar autenticador");
    }
  });
  dialog.addEventListener("close", () => {
    password.value = "";
    factor.value = "";
    status.textContent = "";
  });
}

function installDialogCloseBehavior(root, ...dialogs) {
  for (const dialog of dialogs) {
    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-totp-dialog-close]")) dialog.close();
      if (event.target === dialog) dialog.close();
    });
  }
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    dialogs.find((dialog) => dialog.open)?.close();
  });
}

function openRecoveryDialog(dialog) {
  dialog.showModal();
  requestAnimationFrame(() => dialog.querySelector("[data-totp-recovery-password]")?.focus());
}

function openDisableDialog(dialog) {
  dialog.showModal();
  requestAnimationFrame(() => dialog.querySelector("[data-totp-disable-password]")?.focus());
}

function wireRecoveryActions(dialog, getCodes) {
  for (const button of dialog.querySelectorAll("[data-totp-copy-codes]")) {
    button.addEventListener("click", async () => {
      await copyText(recoveryText(getCodes()));
      button.textContent = "Copiados";
      setTimeout(() => { button.textContent = "Copiar todos"; }, 1400);
    });
  }
  for (const button of dialog.querySelectorAll("[data-totp-download-codes]")) {
    button.addEventListener("click", () => downloadRecoveryCodes(getCodes()));
  }
}

function renderRecoveryCodes(container, codes) {
  const list = container.querySelector("[data-totp-recovery-list]");
  if (!list) return;
  list.innerHTML = (codes || []).map((code) => `<code>${escapeHtml(code)}</code>`).join("");
}

function recoveryCodesShell(copy) {
  return `
    <div class="admin-totp-recovery-intro"><span class="admin-totp-recovery-icon">${recoveryIcon()}</span><div><strong>Guarde seus códigos de recuperação</strong><p>${copy}</p></div></div>
    <div class="admin-totp-recovery-list" data-totp-recovery-list></div>
    <p class="admin-totp-recovery-warning">Estes códigos são exibidos somente agora. Cada código funciona uma única vez.</p>
  `;
}

function dialogShell({ kicker, title, description, icon, body }) {
  return `
    <div class="admin-account-dialog-shell">
      <header>
        <div class="admin-account-dialog-heading">
          <span class="admin-account-dialog-icon">${icon}</span>
          <div><span>${kicker}</span><h2>${title}</h2><p>${description}</p></div>
        </div>
        <button type="button" class="admin-account-dialog-close" data-totp-dialog-close aria-label="Fechar">${closeIcon()}</button>
      </header>
      <div class="admin-account-dialog-body">${body}</div>
    </div>
  `;
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
}

async function copyText(value) {
  const text = String(value || "");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function downloadRecoveryCodes(codes) {
  if (!codes?.length) return;
  const blob = new Blob([recoveryText(codes)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fioreze-codigos-recuperacao.txt";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function recoveryText(codes) {
  return `Fioreze - códigos de recuperação\n\n${(codes || []).join("\n")}\n\nCada código funciona uma única vez.`;
}

function ensureStyles(root) {
  if (root.querySelector('link[data-admin-totp]')) return;
  const link = root.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_HREF;
  link.dataset.adminTotp = "";
  root.head.append(link);
}

function formatSecret(secret) {
  return String(secret || "").replace(/\s+/g, "").match(/.{1,4}/g)?.join(" ") || "";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data desconhecida";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function totpIcon() {
  return '<svg class="admin-totp-ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"></rect><path d="M9 8h6M9 12h2M13 12h2M9 16h2M13 16h2"></path></svg>';
}

function shieldIcon() {
  return '<svg class="admin-totp-ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z"></path><path d="m9.5 12 1.7 1.7 3.6-4"></path></svg>';
}

function recoveryIcon() {
  return '<svg class="admin-totp-ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v10H4z"></path><path d="M8 11h8M8 14h5"></path></svg>';
}

function warningIcon() {
  return '<svg class="admin-totp-ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z"></path><path d="M12 9v5M12 17h.01"></path></svg>';
}

function closeIcon() {
  return '<svg class="admin-totp-ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
}
