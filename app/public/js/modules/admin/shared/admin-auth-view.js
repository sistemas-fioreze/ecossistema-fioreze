import { adminApi } from "./admin-api.js";
import {
  canAccessLinks,
  canAccessMediaLibrary,
  canAccessPortals,
  canAccessRoles,
  canAccessUnits,
  canAccessUsers,
} from "./admin-session.js";

const HELP_CONTENT = {
  home: {
    title: "Ajuda da Central",
    body: "Use a Central Administrativa para acessar as areas disponiveis para seu perfil e sua unidade.",
    examples: ["Entre em Portais para cuidar de unidades, imagens e links.", "Use Usuarios e Perfis para revisar acessos."],
  },
  portals: {
    title: "Ajuda de Portais",
    body: "Gerencie as experiencias digitais das unidades Fioreze em um unico lugar.",
    examples: ["Atualize dados e identidade das unidades.", "Envie imagens e crie links curtos para campanhas."],
  },
  users: {
    title: "Ajuda de Usuarios",
    body: "Gerencie quem pode acessar a Central Administrativa e quais unidades cada pessoa acompanha.",
    examples: ["Crie usuarios com senha temporaria.", "Desative acessos sem apagar historico."],
  },
  roles: {
    title: "Ajuda de Perfis",
    body: "Organize permissoes em perfis simples para cada tipo de trabalho.",
    examples: ["Revise permissoes por grupo.", "Evite conceder acesso alem do necessario."],
  },
  account: {
    title: "Ajuda da Conta",
    body: "Atualize sua senha e encerre sessoes quando precisar proteger seu acesso.",
    examples: ["Troque a senha com frequencia.", "Use sair de todos os dispositivos se perder acesso a algum aparelho."],
  },
};

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
    enhanceAdminExperience(session);
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

function enhanceAdminExperience(session) {
  const dashboard = document.querySelector('[data-view="dashboard"]');
  if (!dashboard || dashboard.dataset.shellEnhanced === "true") return;
  dashboard.dataset.shellEnhanced = "true";

  const section = document.body.dataset.adminSection || "home";
  const area = adminArea(section);
  const userName = session?.user?.display_name || "Usuario";
  const hotels = session?.hotels || [];

  dashboard.insertAdjacentHTML(
    "afterbegin",
    `
      <button class="admin-mobile-menu" type="button" data-admin-menu aria-label="Abrir menu">
        ${icon("menu")}
      </button>
      <aside class="admin-global-sidebar" data-admin-sidebar aria-label="Navegacao administrativa">
        <a class="admin-brand-lockup" href="/admin/" aria-label="Ir para o inicio da Central Administrativa">
          <span class="admin-brand-symbol" aria-hidden="true">F</span>
          <span><strong>FIOREZE</strong><small>Central Administrativa</small></span>
        </a>
        ${renderGlobalNav(session, section)}
      </aside>
      <div class="admin-mobile-backdrop" data-admin-backdrop hidden></div>
      <aside class="admin-help-drawer" data-admin-help hidden aria-label="Ajuda desta pagina">
        <div>
          <strong>${escapeHtml(HELP_CONTENT[section]?.title || "Ajuda desta pagina")}</strong>
          <button type="button" data-admin-help-close aria-label="Fechar ajuda">${icon("close")}</button>
        </div>
        <p>${escapeHtml(HELP_CONTENT[section]?.body || "Encontre aqui orientacoes simples para esta area.")}</p>
        <h2>O que voce pode fazer aqui</h2>
        <ul>${(HELP_CONTENT[section]?.examples || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </aside>
    `,
  );

  for (const topbar of dashboard.querySelectorAll(".admin-topbar")) {
    topbar.classList.add("admin-topbar-modern");
    if (!topbar.querySelector(".admin-page-kicker")) {
      topbar.querySelector("h1")?.insertAdjacentHTML("beforebegin", `<p class="admin-page-kicker">${escapeHtml(area)}</p>`);
    }
    if (!topbar.querySelector("[data-admin-help-open]")) {
      topbar.insertAdjacentHTML(
        "beforeend",
        `<button class="admin-icon-button" type="button" data-admin-help-open aria-label="Abrir ajuda desta pagina">${icon("help")}</button>`,
      );
    }
  }

  const sessionBox = dashboard.querySelector(".admin-session-box");
  if (sessionBox && !sessionBox.querySelector(".admin-avatar")) {
    sessionBox.insertAdjacentHTML(
      "afterbegin",
      `${renderAvatar(session?.user, userName)}<span class="admin-user-meta"><small>${escapeHtml(hotels.length ? `${hotels.length} unidade(s)` : "Acesso administrativo")}</small></span>`,
    );
  }

  dashboard.addEventListener("click", (event) => {
    if (event.target.closest("[data-admin-menu]")) setMenuOpen(true);
    if (event.target.closest("[data-admin-backdrop]")) setMenuOpen(false);
    if (event.target.closest("[data-admin-help-open]")) setHelpOpen(true);
    if (event.target.closest("[data-admin-help-close]")) setHelpOpen(false);
  });
  dashboard.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
      setHelpOpen(false);
    }
  });

  function setMenuOpen(open) {
    dashboard.classList.toggle("is-menu-open", open);
    const backdrop = dashboard.querySelector("[data-admin-backdrop]");
    if (backdrop) backdrop.hidden = !open;
  }

  function setHelpOpen(open) {
    const drawer = dashboard.querySelector("[data-admin-help]");
    if (!drawer) return;
    drawer.hidden = !open;
    if (open) drawer.querySelector("[data-admin-help-close]")?.focus();
  }
}

function renderGlobalNav(session, section) {
  const items = [
    ["home", "Inicio", "/admin/", "home", true],
    ["portals", "Portais", "/admin/portais/", "portal", canAccessPortals(session)],
    ["portals", "Unidades", "/admin/portais/unidades/", "units", canAccessUnits(session)],
    ["portals", "Imagens", "/admin/portais/media/", "image", canAccessMediaLibrary(session)],
    ["portals", "Links", "/admin/portais/links/", "link", canAccessLinks(session)],
    ["users", "Usuarios", "/admin/usuarios/", "users", canAccessUsers(session)],
    ["roles", "Perfis e permissoes", "/admin/perfis/", "shield", canAccessRoles(session)],
    ["account", "Minha conta", "/admin/minha-conta/", "user", true],
  ];
  return `<nav class="admin-global-nav">${items
    .map(([area, label, href, iconName, enabled]) =>
      enabled
        ? `<a href="${href}" ${isActive(href, section) ? 'aria-current="page"' : ""}>${icon(iconName)}<span>${label}</span></a>`
        : `<span aria-disabled="true">${icon(iconName)}<span>${label}</span></span>`,
    )
    .join("")}</nav>`;
}

function isActive(href, section) {
  const path = window.location.pathname;
  if (href === "/admin/") return section === "home" && path === "/admin/";
  return path.startsWith(href);
}

function adminArea(section) {
  return {
    home: "Inicio",
    portals: "Experiencias digitais",
    users: "Equipe",
    roles: "Equipe",
    account: "Conta",
  }[section] || "Central Administrativa";
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

function renderAvatar(user, fallbackName) {
  if (user?.avatar?.url) {
    return `<img class="admin-avatar admin-avatar-image" src="${escapeAttr(user.avatar.url)}" alt="Foto de perfil de ${escapeAttr(user.display_name || fallbackName)}">`;
  }
  return `<span class="admin-avatar" aria-hidden="true">${escapeHtml(initials(fallbackName))}</span>`;
}

function icon(name) {
  const paths = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    help: '<path d="M9.5 9a2.5 2.5 0 1 1 4.7 1.2c-.8 1.1-2.2 1.2-2.2 2.8"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
    home: '<path d="m4 11 8-7 8 7"/><path d="M6 10v10h12V10"/>',
    portal: '<path d="M4 5h16v12H4z"/><path d="M8 21h8M12 17v4"/>',
    units: '<path d="M5 20V8l7-4 7 4v12"/><path d="M9 20v-6h6v6"/>',
    image: '<path d="M5 5h14v14H5z"/><path d="m7 16 4-4 3 3 2-2 3 3"/><circle cx="9" cy="9" r="1"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.8"/><path d="M16 3.2a4 4 0 0 1 0 7.6"/>',
    shield: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  };
  return `<svg class="admin-svg-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.help}</svg>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
