import { getSession, login, logout } from "./api.js";

export function createSessionController({ onAuthenticated, onLoggedOut, onError }) {
  const els = {
    app: document.getElementById("roomServiceErp"),
    loginView: document.querySelector('[data-view="login"]'),
    loadingView: document.querySelector('[data-view="loading"]'),
    shellView: document.querySelector('[data-view="app"]'),
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
      const payload = await getSession();
      await start(payload.data);
    } catch (error) {
      if (error.status !== 401) onError?.("Nao foi possivel verificar a sessao administrativa.");
      showView("login");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    els.loginError.textContent = "";
    els.loginButton.disabled = true;
    els.loginButton.textContent = "Entrando...";
    try {
      const payload = await login({
        email: els.loginEmail.value,
        password: els.loginPassword.value,
      });
      els.loginPassword.value = "";
      await start(payload.data);
    } catch (error) {
      els.loginError.textContent = error.message || "Falha ao entrar.";
    } finally {
      els.loginButton.disabled = false;
      els.loginButton.textContent = "Entrar";
    }
  }

  async function handleLogout() {
    await logout();
    showView("login");
    onLoggedOut?.();
  }

  async function start(session) {
    els.sessionUser.textContent = session?.user?.display_name || "Usuario";
    showView("app");
    await onAuthenticated(session);
  }

  function showView(view) {
    els.loginView.hidden = view !== "login";
    els.loadingView.hidden = view !== "loading";
    els.shellView.hidden = view !== "app";
    els.app.dataset.state = view;
  }

  return { boot, showView };
}
