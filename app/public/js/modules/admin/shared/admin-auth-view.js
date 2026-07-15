import { adminApi } from "./admin-api.js";
import {
  canAccessAreas,
  canAccessAudit,
  canAccessContent,
  canAccessLinks,
  canAccessMediaLibrary,
  canAccessNavigation,
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
  document.body.dataset.adminShell = "erp";
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
  document.body.dataset.adminShell = "erp";

  const section = document.body.dataset.adminSection || "home";
  const area = adminArea(section);
  const userName = session?.user?.display_name || "Usuario";
  const hotels = session?.hotels || [];
  const storedCompact = readShellPreference() === "compact";
  if (storedCompact && !window.matchMedia("(max-width: 980px)").matches) dashboard.classList.add("is-sidebar-compact");

  dashboard.insertAdjacentHTML(
    "afterbegin",
    `
      <aside class="admin-global-sidebar" data-admin-sidebar aria-label="Navegacao administrativa">
        <a class="admin-brand-lockup" href="/admin/" aria-label="Ir para o inicio da Central Administrativa">
          <span class="admin-brand-wordmark"><strong>FIOREZE</strong><small>Central Administrativa</small></span>
          <span class="admin-brand-symbol" aria-hidden="true">F</span>
        </a>
        ${renderGlobalNav(session, section)}
        <div class="admin-sidebar-footer">
          <a class="admin-sidebar-account" href="/admin/minha-conta/" title="Minha conta">
            ${renderAvatar(session?.user, userName)}
            <span><strong>${escapeHtml(userName)}</strong><small>Minha conta</small></span>
          </a>
        </div>
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
    topbar.firstElementChild?.classList.add("admin-topbar-copy");
    if (!topbar.querySelector(".admin-page-kicker")) {
      topbar.querySelector("h1")?.insertAdjacentHTML("beforebegin", `<p class="admin-page-kicker">${escapeHtml(area)}</p>`);
    }
    topbar.insertAdjacentHTML(
      "afterbegin",
      `<button class="admin-shell-toggle" type="button" data-admin-shell-toggle aria-label="Recolher menu" title="Recolher menu">${icon("menu")}</button>`,
    );

    const sessionBox = topbar.querySelector(".admin-session-box");
    const controls = `
      <div class="admin-command-search" data-admin-search>
        <label>${icon("search")}<input type="search" placeholder="Pesquisar no sistema..." aria-label="Pesquisar no sistema" autocomplete="off"><kbd>Ctrl K</kbd></label>
        <div class="admin-command-results" data-admin-search-results hidden></div>
      </div>
      <button class="admin-icon-button" type="button" data-admin-help-open aria-label="Abrir ajuda desta pagina" title="Ajuda">${icon("help")}</button>
    `;
    if (sessionBox) sessionBox.insertAdjacentHTML("beforebegin", controls);
    else topbar.insertAdjacentHTML("beforeend", controls);
  }

  const sessionBox = dashboard.querySelector(".admin-session-box");
  if (sessionBox && !sessionBox.querySelector("[data-admin-session-toggle]")) enhanceSessionControl(sessionBox, session, userName, hotels);

  installAdminSearch(dashboard);
  setCompact(dashboard.classList.contains("is-sidebar-compact"), false);

  dashboard.addEventListener("click", (event) => {
    if (event.target.closest("[data-admin-shell-toggle]")) {
      if (window.matchMedia("(max-width: 980px)").matches) setMenuOpen(!dashboard.classList.contains("is-menu-open"));
      else setCompact(!dashboard.classList.contains("is-sidebar-compact"));
    }
    if (event.target.closest("[data-admin-backdrop]")) setMenuOpen(false);
    if (event.target.closest("[data-admin-help-open]")) setHelpOpen(true);
    if (event.target.closest("[data-admin-help-close]")) setHelpOpen(false);
    if (event.target.closest("[data-admin-session-toggle]")) setSessionOpen(!sessionBox?.classList.contains("is-open"));
    if (!event.target.closest(".admin-session-box")) setSessionOpen(false);
  });
  dashboard.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
      setHelpOpen(false);
      setSessionOpen(false);
    }
  });

  function setMenuOpen(open) {
    dashboard.classList.toggle("is-menu-open", open);
    const backdrop = dashboard.querySelector("[data-admin-backdrop]");
    if (backdrop) backdrop.hidden = !open;
  }

  function setCompact(compact, persist = true) {
    dashboard.classList.toggle("is-sidebar-compact", compact);
    const toggle = dashboard.querySelector("[data-admin-shell-toggle]");
    if (toggle) {
      const label = compact ? "Expandir menu" : "Recolher menu";
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
    }
    if (persist) {
      try {
        localStorage.setItem("fioreze-admin-sidebar", compact ? "compact" : "expanded");
      } catch {
        // The shell remains usable when storage is unavailable.
      }
    }
  }

  function setHelpOpen(open) {
    const drawer = dashboard.querySelector("[data-admin-help]");
    if (!drawer) return;
    drawer.hidden = !open;
    if (open) drawer.querySelector("[data-admin-help-close]")?.focus();
  }

  function setSessionOpen(open) {
    if (!sessionBox) return;
    sessionBox.classList.toggle("is-open", open);
    sessionBox.querySelector("[data-admin-session-menu]")?.toggleAttribute("hidden", !open);
    sessionBox.querySelector("[data-admin-session-toggle]")?.setAttribute("aria-expanded", String(open));
  }
}

function enhanceSessionControl(sessionBox, session, userName, hotels) {
  const sessionUser = sessionBox.querySelector("#sessionUser");
  const logoutButton = sessionBox.querySelector("#logoutButton");
  sessionBox.classList.add("admin-session-control");
  sessionBox.insertAdjacentHTML(
    "afterbegin",
    `<button class="admin-session-trigger" type="button" data-admin-session-toggle aria-expanded="false">
      ${renderAvatar(session?.user, userName)}
      <span class="admin-session-copy"><small>Sessao</small><strong data-admin-session-name></strong></span>
      ${icon("chevron")}
    </button>
    <div class="admin-session-menu" data-admin-session-menu hidden>
      <p><strong>${escapeHtml(userName)}</strong><small>${escapeHtml(hotels.length ? `${hotels.length} unidade(s) autorizada(s)` : "Acesso administrativo")}</small></p>
      <a href="/admin/minha-conta/">${icon("user")} Minha conta</a>
    </div>`,
  );
  const nameSlot = sessionBox.querySelector("[data-admin-session-name]");
  if (sessionUser && nameSlot) nameSlot.append(sessionUser);
  if (logoutButton) {
    logoutButton.textContent = "Sair";
    logoutButton.insertAdjacentHTML("afterbegin", icon("logout"));
    sessionBox.querySelector("[data-admin-session-menu]")?.append(logoutButton);
  }
}

function installAdminSearch(dashboard) {
  const root = dashboard.querySelector("[data-admin-search]");
  const input = root?.querySelector("input");
  const results = root?.querySelector("[data-admin-search-results]");
  if (!root || !input || !results) return;

  const items = [...dashboard.querySelectorAll(".admin-global-nav a")].map((link) => ({
    href: link.getAttribute("href"),
    label: link.textContent.trim(),
  }));

  input.addEventListener("input", renderResults);
  input.addEventListener("focus", renderResults);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const first = results.querySelector("a");
      if (first) {
        event.preventDefault();
        window.location.assign(first.href);
      }
    }
    if (event.key === "Escape") {
      results.hidden = true;
      input.blur();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-admin-search]")) results.hidden = true;
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("pt-BR") === "k") {
      event.preventDefault();
      input.focus();
    }
  });

  function renderResults() {
    const query = input.value.trim().toLocaleLowerCase("pt-BR");
    if (!query) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }
    const matches = items.filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 6);
    results.innerHTML = matches.length
      ? matches.map((item) => `<a href="${escapeAttr(item.href)}">${icon("search")}<span>${escapeHtml(item.label)}</span></a>`).join("")
      : '<p>Nenhuma area encontrada.</p>';
    results.hidden = false;
  }
}

function readShellPreference() {
  try {
    return localStorage.getItem("fioreze-admin-sidebar") || "expanded";
  } catch {
    return "expanded";
  }
}

function renderGlobalNav(session, section) {
  const items = [
    ["home", "Inicio", "/admin/", "home", true],
    ["portals", "Portais", "/admin/portais/", "portal", canAccessPortals(session)],
    ["portals", "Unidades", "/admin/portais/unidades/", "units", canAccessUnits(session)],
    ["portals", "Imagens", "/admin/portais/media/", "image", canAccessMediaLibrary(session)],
    ["portals", "Links", "/admin/portais/links/", "link", canAccessLinks(session)],
    ["portals", "Conteudos", "/admin/portais/conteudos/", "content", canAccessContent(session)],
    ["portals", "Areas", "/admin/portais/areas/", "grid", canAccessAreas(session)],
    ["portals", "Navegacao", "/admin/portais/navegacao/", "navigation", canAccessNavigation(session)],
    ["portals", "Auditoria", "/admin/portais/auditoria/", "history", canAccessAudit(session)],
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
  if (href === "/admin/portais/") return path === href;
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
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    chevron: '<path d="m9 10 3 3 3-3"/>',
    logout: '<path d="M10 5H5v14h5M13 8l4 4-4 4M17 12H9"/>',
    home: '<path d="m4 11 8-7 8 7"/><path d="M6 10v10h12V10"/>',
    portal: '<path d="M4 5h16v12H4z"/><path d="M8 21h8M12 17v4"/>',
    units: '<path d="M5 20V8l7-4 7 4v12"/><path d="M9 20v-6h6v6"/>',
    image: '<path d="M5 5h14v14H5z"/><path d="m7 16 4-4 3 3 2-2 3 3"/><circle cx="9" cy="9" r="1"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
    content: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    grid: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
    navigation: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-6 2 2-6z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
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
