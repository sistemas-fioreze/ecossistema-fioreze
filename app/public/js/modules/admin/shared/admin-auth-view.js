import { adminApi } from "./admin-api.js";

export function createAdminAuthView({ onAuthenticated }) {
  const els = {
    app: document.getElementById("adminApp"),
    loginView: document.querySelector('[data-view="login"]'),
    dashboardView: document.querySelector('[data-view="dashboard"]'),
    loadingView: document.querySelector('[data-view="loading"]'),
    loginForm: document.getElementById("loginForm"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    loginButton: document.getElementById("loginButton"),
    loginError: document.getElementById("loginError"),
    sessionUser: document.getElementById("sessionUser"),
    logoutButton: document.getElementById("logoutButton"),
  };

  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutButton.addEventListener("click", handleLogout);

  async function boot() {
    showView("loading");
    try {
      const payload = await adminApi("/api/v1/admin/session");
      await startAuthenticated(payload.data);
    } catch (error) {
      if (error.status !== 401) {
        els.loginError.textContent = "Nao foi possivel verificar a sessao administrativa.";
      }
      showView("login");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    els.loginError.textContent = "";
    els.loginButton.disabled = true;
    els.loginButton.textContent = "Entrando...";
    try {
      const payload = await adminApi("/api/v1/admin/login", {
        method: "POST",
        body: {
          email: els.loginEmail.value,
          password: els.loginPassword.value,
        },
      });
      els.loginPassword.value = "";
      await startAuthenticated(payload.data);
    } catch (error) {
      els.loginError.textContent = error.message || "Falha ao entrar.";
    } finally {
      els.loginButton.disabled = false;
      els.loginButton.textContent = "Entrar";
    }
  }

  async function handleLogout() {
    await adminApi("/api/v1/admin/logout", { method: "POST", body: {} }).catch(() => null);
    showView("login");
  }

  async function startAuthenticated(session) {
    els.sessionUser.textContent = session?.user?.display_name || "Usuario";
    showView("dashboard");
    await onAuthenticated(session);
  }

  function showView(view) {
    els.loginView.hidden = view !== "login";
    els.dashboardView.hidden = view !== "dashboard";
    els.loadingView.hidden = view !== "loading";
    els.app.dataset.state = view;
  }

  return { boot, showView };
}
