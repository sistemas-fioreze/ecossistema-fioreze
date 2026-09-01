export const ADMIN_MUTATION_HEADER = "x-fioreze-admin-action";
export const ADMIN_MUTATION_HEADER_VALUE = "erp-admin";

const TOTP_STYLESHEET_HREF = "/css/modules/admin/admin-totp.css?v=20260901-2";
const TOTP_LOGIN_STYLESHEET_HREF = "/css/modules/admin/admin-totp-login.css?v=20260901-1";

export async function adminApi(path, options = {}) {
  const payload = await requestAdmin(path, options);
  if (path === "/api/v1/admin/login" && payload?.data?.mfa_required === true && payload.data.mfa_method === "totp") {
    return completeTotpLogin(payload.data);
  }
  return payload;
}

async function requestAdmin(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const init = {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(options.body && !isFormData ? { "content-type": "application/json" } : {}),
      ...(requiresAdminMutationHeader(options) ? { [ADMIN_MUTATION_HEADER]: ADMIN_MUTATION_HEADER_VALUE } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined,
  };
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.error?.message || "Falha na API administrativa.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function completeTotpLogin(challenge) {
  ensureTotpStyles();
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return Promise.reject(new Error("Tela de autenticação indisponível."));

  loginForm.querySelector("[data-admin-totp-login-step]")?.remove();
  loginForm.classList.add("is-totp-step");
  const step = document.createElement("section");
  step.className = "admin-totp-login-step";
  step.dataset.adminTotpLoginStep = "";
  step.innerHTML = `
    <div class="admin-totp-login-header">
      <span class="admin-totp-login-icon">${totpIcon()}</span>
      <span class="admin-totp-login-progress">Etapa 2 de 2</span>
    </div>
    <div class="admin-totp-login-heading">
      <p class="eyebrow">Verificação em duas etapas</p>
      <h2>Confirme seu acesso</h2>
      <p class="admin-totp-login-copy">Sua senha já foi verificada. Use o código temporário do aplicativo autenticador para concluir o acesso.</p>
    </div>
    <div class="admin-totp-login-field">
      <label>
        <span data-admin-totp-login-label>Código de 6 dígitos</span>
        <input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" data-admin-totp-login-code>
      </label>
      <div class="admin-totp-login-field-meta">
        <p data-admin-totp-login-help>Digite o código que aparece agora no seu aplicativo.</p>
        <button type="button" data-admin-totp-login-mode>Usar código de recuperação</button>
      </div>
    </div>
    <p class="admin-totp-login-status" role="alert" aria-live="polite" data-admin-totp-login-status></p>
    <div class="admin-totp-login-actions">
      <button class="admin-primary-button admin-totp-login-submit" type="button" data-admin-totp-login-submit>Verificar e entrar</button>
      <button class="admin-totp-login-back" type="button" data-admin-totp-login-back>${backIcon()}<span>Voltar ao login</span></button>
    </div>
  `;
  loginForm.append(step);

  const input = step.querySelector("[data-admin-totp-login-code]");
  const submit = step.querySelector("[data-admin-totp-login-submit]");
  const status = step.querySelector("[data-admin-totp-login-status]");
  const back = step.querySelector("[data-admin-totp-login-back]");
  const modeToggle = step.querySelector("[data-admin-totp-login-mode]");
  const fieldLabel = step.querySelector("[data-admin-totp-login-label]");
  const fieldHelp = step.querySelector("[data-admin-totp-login-help]");
  let recoveryMode = false;
  requestAnimationFrame(() => input?.focus());

  const setRecoveryMode = (enabled) => {
    recoveryMode = enabled;
    input.value = "";
    status.textContent = "";
    if (enabled) {
      input.inputMode = "text";
      input.maxLength = 24;
      input.placeholder = "XXXX-XXXX-XXXX-XXXX";
      fieldLabel.textContent = "Código de recuperação";
      fieldHelp.textContent = "Use um dos códigos salvos quando você ativou o autenticador.";
      modeToggle.textContent = "Usar código do autenticador";
    } else {
      input.inputMode = "numeric";
      input.maxLength = 6;
      input.placeholder = "000000";
      fieldLabel.textContent = "Código de 6 dígitos";
      fieldHelp.textContent = "Digite o código que aparece agora no seu aplicativo.";
      modeToggle.textContent = "Usar código de recuperação";
    }
    requestAnimationFrame(() => input.focus());
  };

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      loginForm.classList.remove("is-totp-step");
      step.remove();
    };

    back.addEventListener("click", () => {
      cleanup();
      window.location.reload();
    });

    modeToggle.addEventListener("click", () => setRecoveryMode(!recoveryMode));

    input.addEventListener("input", () => {
      if (recoveryMode) {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
      } else {
        input.value = input.value.replace(/\D/g, "").slice(0, 6);
      }
      status.textContent = "";
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit.click();
      }
    });

    submit.addEventListener("click", async () => {
      const code = input.value.trim();
      if (!code) {
        status.textContent = recoveryMode
          ? "Digite um código de recuperação válido."
          : "Digite o código de 6 dígitos do seu autenticador.";
        input.focus();
        return;
      }
      if (!recoveryMode && code.length !== 6) {
        status.textContent = "O código do autenticador deve ter 6 dígitos.";
        input.focus();
        return;
      }
      submit.disabled = true;
      submit.textContent = "Verificando...";
      status.textContent = "";
      try {
        const payload = await requestAdmin("/api/v1/admin/login/totp", {
          method: "POST",
          body: { challenge_token: challenge.challenge_token, code },
        });
        cleanup();
        resolve(payload);
      } catch (error) {
        if (error.status === 429) {
          status.textContent = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
        } else if (error.status === 401) {
          status.textContent = recoveryMode
            ? "Código de recuperação inválido ou já utilizado."
            : "Código inválido ou expirado. Confira o autenticador e tente novamente.";
        } else {
          status.textContent = error.message || "Não foi possível concluir a verificação.";
        }
        input.select();
        submit.disabled = false;
        submit.textContent = "Verificar e entrar";
        if (error.status >= 500) reject(error);
      }
    });
  });
}

function ensureTotpStyles() {
  ensureStylesheet({ selector: 'link[data-admin-totp]', href: TOTP_STYLESHEET_HREF, dataName: "adminTotp" });
  ensureStylesheet({ selector: 'link[data-admin-totp-login]', href: TOTP_LOGIN_STYLESHEET_HREF, dataName: "adminTotpLogin" });
}

function ensureStylesheet({ selector, href, dataName }) {
  if (document.querySelector(selector)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset[dataName] = "";
  document.head.append(link);
}

function totpIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"></rect><path d="M9 8h6M9 12h2M13 12h2M9 16h2M13 16h2"></path></svg>';
}

function backIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>';
}

function requiresAdminMutationHeader(options) {
  return String(options.method || "GET").toUpperCase() !== "GET";
}

if (typeof document !== "undefined") {
  queueMicrotask(() => {
    import("../admin-totp.js")
      .then((module) => module.setupAdminTotp?.())
      .catch(() => null);
  });
}
