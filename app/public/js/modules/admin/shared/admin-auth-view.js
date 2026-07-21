import { adminApi } from "./admin-api.js";
import {
  canAccessContent,
  canAccessLinks,
  canAccessMediaLibrary,
  canAccessPortals,
  canAccessUnits,
} from "./admin-session.js";

const ADMIN_LOGO_URL = "/assets/shared/fioreze-central-logo.jpg";
const ADMIN_PALETTES = [
  ["fioreze", "Fioreze"],
  ["terracotta", "Terracota"],
  ["forest", "Floresta"],
  ["ocean", "Oceano"],
  ["graphite", "Grafite"],
  ["burgundy", "Vinho"],
  ["sage", "Sálvia"],
  ["navy", "Azul noturno"],
  ["plum", "Ameixa"],
  ["sunset", "Pôr do sol"],
];
const TURNSTILE_ACTION = "admin_login";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let turnstileScriptPromise = null;

const HELP_CONTENT = {
  home: {
    title: "Ajuda da Central",
    body: "Use a Central Administrativa para acessar as áreas disponíveis para seu perfil e sua unidade.",
    examples: ["Entre em Portais para cuidar de unidades, imagens e links.", "Use Usuários e Perfis para revisar acessos."],
  },
  portals: {
    title: "Ajuda de Portais",
    body: "Gerencie as experiências digitais das unidades Fioreze em um único lugar.",
    examples: ["Atualize dados e identidade das unidades.", "Envie imagens e crie links curtos para campanhas."],
  },
  users: {
    title: "Ajuda de Usuários",
    body: "Gerencie quem pode acessar a Central Administrativa e quais unidades cada pessoa acompanha.",
    examples: ["Crie usuários com senha temporária.", "Desative acessos sem apagar histórico."],
  },
  roles: {
    title: "Ajuda de Perfis",
    body: "Organize permissões em perfis simples para cada tipo de trabalho.",
    examples: ["Revise permissões por grupo.", "Evite conceder acesso além do necessário."],
  },
  messages: {
    title: "Ajuda de Mensagens",
    body: "Use a caixa de mensagens para conversar com usuários que trabalham nas mesmas unidades.",
    examples: ["Envie orientações sem sair da Central.", "Acompanhe mensagens recebidas e enviadas."],
  },
  account: {
    title: "Ajuda da Conta",
    body: "Atualize sua senha e encerre sessões quando precisar proteger seu acesso.",
    examples: ["Troque a senha com frequência.", "Use sair de todos os dispositivos se perder acesso a algum aparelho."],
  },
  settings: {
    title: "Ajuda das Configurações",
    body: "Encontre em um só lugar as contas, os perfis, as permissões e o histórico administrativo.",
    examples: ["Revise acessos da equipe.", "Consulte a auditoria antes de alterar permissões."],
  },
};

export function createAdminAuthView({ onAuthenticated, onLoggedOut = () => {} }) {
  document.body.dataset.adminShell = "erp";
  document.body.dataset.adminPalette = "fioreze";
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
    loginTurnstile: document.getElementById("loginTurnstile"),
    sessionUser: document.getElementById("sessionUser"),
    logoutButton: document.getElementById("logoutButton"),
  };
  let activeSession = null;
  let turnstileEnabled = false;
  let turnstileToken = "";
  let turnstileWidgetId = null;

  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutButton.addEventListener("click", handleLogout);

  async function boot() {
    showView("loading");
    try {
      const payload = await adminApi("/api/v1/admin/session");
      await startAuthenticated(payload.data);
    } catch (error) {
      if (error.status !== 401) {
        els.loginError.textContent = "Não foi possível verificar a sessão administrativa.";
      }
      await prepareLoginSecurityWidget();
      showView("login");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    els.loginError.textContent = "";
    if (turnstileEnabled && !turnstileToken) {
      els.loginError.textContent = "Conclua a verificação de segurança para entrar.";
      return;
    }
    els.loginButton.disabled = true;
    els.loginButton.textContent = "Entrando...";
    try {
      const payload = await adminApi("/api/v1/admin/login", {
        method: "POST",
        body: {
          email: els.loginEmail.value,
          password: els.loginPassword.value,
          turnstile_token: turnstileToken || undefined,
        },
      });
      els.loginPassword.value = "";
      await startAuthenticated(payload.data);
    } catch (error) {
      els.loginError.textContent = error.status === 429
        ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        : "Não foi possível concluir o acesso. Verifique os dados e tente novamente.";
    } finally {
      resetTurnstileWidget();
      els.loginButton.disabled = false;
      els.loginButton.textContent = "Entrar";
    }
  }

  async function handleLogout() {
    await adminApi("/api/v1/admin/logout", { method: "POST", body: {} }).catch(() => null);
    activeSession = null;
    turnstileToken = "";
    els.sessionUser.textContent = "";
    els.loginPassword.value = "";
    onLoggedOut();
    applyAdminPalette("fioreze");
    window.location.replace("/admin/");
  }

  async function startAuthenticated(session) {
    activeSession = session;
    const preferencePayload = await adminApi("/api/v1/admin/me/preferences").catch(() => ({
      data: { color_palette: "fioreze" },
    }));
    session.preferences = preferencePayload.data || { color_palette: "fioreze" };
    applyAdminPalette(session.preferences.color_palette);
    els.sessionUser.textContent = session?.user?.display_name || "Usuário";
    showView("dashboard");
    enhanceAdminExperience(session);
    synchronizeAdminExperience(session);
    setDashboardLoading(false);
    await onAuthenticated(session);
  }

  async function prepareLoginSecurityWidget() {
    let config;
    try {
      const payload = await adminApi("/api/v1/public/admin/login-config");
      config = payload.data || {};
    } catch {
      els.loginButton.disabled = true;
      els.loginError.textContent = "Não foi possível preparar a verificação de segurança.";
      return;
    }

    turnstileEnabled = config.TURNSTILE_ENABLED === true;
    els.loginTurnstile.hidden = !turnstileEnabled;
    if (!turnstileEnabled) return;
    if (!config.TURNSTILE_SITE_KEY) {
      els.loginButton.disabled = true;
      els.loginError.textContent = "O acesso administrativo está temporariamente indisponível.";
      return;
    }

    try {
      await loadTurnstileScript();
      turnstileWidgetId = window.turnstile.render(els.loginTurnstile, {
        sitekey: config.TURNSTILE_SITE_KEY,
        action: TURNSTILE_ACTION,
        callback(token) {
          turnstileToken = token;
          els.loginError.textContent = "";
        },
        "expired-callback"() {
          turnstileToken = "";
        },
        "error-callback"() {
          turnstileToken = "";
          els.loginError.textContent = "Não foi possível concluir a verificação de segurança.";
        },
      });
    } catch {
      els.loginButton.disabled = true;
      els.loginError.textContent = "Não foi possível preparar a verificação de segurança.";
    }
  }

  function resetTurnstileWidget() {
    turnstileToken = "";
    if (turnstileEnabled && turnstileWidgetId !== null && window.turnstile?.reset) {
      window.turnstile.reset(turnstileWidgetId);
    }
  }

  function setDashboardLoading(loading) {
    els.dashboardView.dispatchEvent(new CustomEvent("fioreze:admin-content-loading", {
      bubbles: true,
      detail: { loading },
    }));
  }

  function showView(view) {
    els.loginView.hidden = view !== "login";
    els.dashboardView.hidden = view !== "dashboard";
    els.loadingView.hidden = view !== "loading";
    els.app.dataset.state = view;
  }

  return {
    boot,
    showView,
    getSession() {
      return activeSession;
    },
  };
}

function loadTurnstileScript() {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(window.turnstile), { once: true });
    script.addEventListener("error", () => reject(new Error("turnstile_load_failed")), { once: true });
    document.head.append(script);
  });
  return turnstileScriptPromise;
}

function synchronizeAdminExperience(session) {
  const dashboard = document.querySelector('[data-view="dashboard"]');
  if (!dashboard?.dataset.shellEnhanced) return;
  const section = document.body.dataset.adminSection || "home";
  const nav = dashboard.querySelector(".admin-global-nav");
  if (nav) nav.outerHTML = renderGlobalNav(session, section);
  const userName = session?.user?.display_name || "Usuário";
  const sessionUser = dashboard.querySelector("#sessionUser");
  if (sessionUser) sessionUser.textContent = userName;
  const menuUser = dashboard.querySelector("[data-admin-session-user]");
  if (menuUser) menuUser.textContent = userName;
  const menuHotels = dashboard.querySelector("[data-admin-session-hotels]");
  if (menuHotels) {
    const total = session?.hotels?.length || 0;
    menuHotels.textContent = total ? `${total} unidade(s) autorizada(s)` : "Acesso administrativo";
  }
  updatePaletteButtons(dashboard.querySelector(".admin-session-box"), session.preferences?.color_palette || "fioreze");
}

function enhanceAdminExperience(session) {
  const dashboard = document.querySelector('[data-view="dashboard"]');
  if (!dashboard || dashboard.dataset.shellEnhanced === "true") return;
  dashboard.dataset.shellEnhanced = "true";
  document.body.dataset.adminShell = "erp";

  const section = document.body.dataset.adminSection || "home";
  const area = adminArea(section);
  const userName = session?.user?.display_name || "Usuário";
  const hotels = session?.hotels || [];
  const storedCompact = readShellPreference() === "compact";
  if (storedCompact && !window.matchMedia("(max-width: 980px)").matches) dashboard.classList.add("is-sidebar-compact");

  dashboard.insertAdjacentHTML(
    "afterbegin",
    `
      <aside class="admin-global-sidebar" data-admin-sidebar aria-label="Navegação administrativa">
        <div class="admin-sidebar-head">
          <button class="admin-shell-toggle admin-shell-toggle-sidebar" type="button" data-admin-shell-toggle aria-label="Recolher menu" title="Recolher menu">${icon("menu")}</button>
          <a class="admin-brand-lockup" href="/admin/" aria-label="Ir para o início da Central Administrativa">
            <span class="admin-brand-wordmark"><img src="${ADMIN_LOGO_URL}" alt="Fioreze Hotéis" loading="eager" decoding="async"></span>
          </a>
        </div>
        ${renderGlobalNav(session, section)}
      </aside>
      <div class="admin-mobile-backdrop" data-admin-backdrop hidden></div>
      <div class="admin-content-loader" data-admin-content-loader hidden aria-live="polite" aria-busy="true">
        <div><span class="admin-modern-spinner" aria-hidden="true"></span><strong>Carregando área...</strong></div>
      </div>
      <aside class="admin-help-drawer" data-admin-help hidden aria-label="Ajuda desta página">
        <div>
          <strong>${escapeHtml(HELP_CONTENT[section]?.title || "Ajuda desta página")}</strong>
          <button type="button" data-admin-help-close aria-label="Fechar ajuda">${icon("close")}</button>
        </div>
        <p>${escapeHtml(HELP_CONTENT[section]?.body || "Encontre aqui orientações simples para esta área.")}</p>
        <h2>O que você pode fazer aqui</h2>
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
      `<button class="admin-shell-toggle admin-shell-toggle-mobile" type="button" data-admin-shell-toggle aria-label="Abrir menu" title="Abrir menu">${icon("menu")}</button>`,
    );

    const sessionBox = topbar.querySelector(".admin-session-box");
    const controls = `
      <div class="admin-command-search" data-admin-search>
        <label>${icon("search")}<input type="search" placeholder="Pesquisar no sistema..." aria-label="Pesquisar no sistema" autocomplete="off"><kbd>Ctrl K</kbd></label>
        <div class="admin-command-results" data-admin-search-results hidden></div>
      </div>
      <button class="admin-icon-button" type="button" data-admin-refresh aria-label="Atualizar esta tela" title="Atualizar">${icon("refresh")}</button>
      <a class="admin-icon-button admin-mail-button" href="/admin/mensagens/" aria-label="Abrir mensagens" title="Mensagens">${icon("mail")}<span data-admin-unread hidden></span></a>
      <button class="admin-icon-button" type="button" data-admin-help-open aria-label="Abrir ajuda desta página" title="Ajuda">${icon("help")}</button>
    `;
    if (sessionBox) sessionBox.insertAdjacentHTML("beforebegin", controls);
    else topbar.insertAdjacentHTML("beforeend", controls);
  }

  const sessionBox = dashboard.querySelector(".admin-session-box");
  if (sessionBox && !sessionBox.querySelector("[data-admin-session-toggle]")) enhanceSessionControl(sessionBox, session, userName, hotels);

  installAdminSearch(dashboard);
  updateMessageBadge(dashboard);
  setCompact(dashboard.classList.contains("is-sidebar-compact"), false);

  dashboard.addEventListener("click", (event) => {
    if (event.target.closest("[data-admin-shell-toggle]")) {
      if (window.matchMedia("(max-width: 980px)").matches) setMenuOpen(!dashboard.classList.contains("is-menu-open"));
      else setCompact(!dashboard.classList.contains("is-sidebar-compact"));
    }
    if (event.target.closest("[data-admin-backdrop]")) setMenuOpen(false);
    if (event.target.closest("[data-admin-help-open]")) setHelpOpen(true);
    if (event.target.closest("[data-admin-help-close]")) setHelpOpen(false);
    if (event.target.closest("[data-admin-refresh]")) requestContentRefresh();
    if (event.target.closest("[data-admin-session-toggle]")) setSessionOpen(!sessionBox?.classList.contains("is-open"));
    const paletteButton = event.target.closest("[data-admin-palette]");
    if (paletteButton) void savePalettePreference(paletteButton.dataset.adminPalette, session, sessionBox);
    if (!event.target.closest(".admin-session-box")) setSessionOpen(false);
  });
  dashboard.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="/admin/"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (new URL(link.href, window.location.origin).pathname !== window.location.pathname) setContentLoading(true);
  });
  dashboard.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
      setHelpOpen(false);
      setSessionOpen(false);
    }
  });
  dashboard.addEventListener("fioreze:admin-content-loading", (event) => {
    setContentLoading(Boolean(event.detail?.loading));
  });

  function setMenuOpen(open) {
    dashboard.classList.toggle("is-menu-open", open);
    const backdrop = dashboard.querySelector("[data-admin-backdrop]");
    if (backdrop) backdrop.hidden = !open;
  }

  function setCompact(compact, persist = true) {
    dashboard.classList.toggle("is-sidebar-compact", compact);
    for (const toggle of dashboard.querySelectorAll("[data-admin-shell-toggle]")) {
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

  function requestContentRefresh() {
    setContentLoading(true);
    let finished = false;
    const complete = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(fallbackTimer);
      setContentLoading(false);
    };
    const fallbackTimer = window.setTimeout(complete, 12000);
    const refreshEvent = new CustomEvent("fioreze:admin-refresh", {
      bubbles: true,
      cancelable: true,
      detail: { complete },
    });
    dashboard.dispatchEvent(refreshEvent);
    if (!refreshEvent.defaultPrevented) window.location.reload();
  }

  function setContentLoading(loading) {
    const loader = dashboard.querySelector("[data-admin-content-loader]");
    if (!loader) return;
    loader.hidden = !loading;
    loader.setAttribute("aria-busy", String(loading));
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
      <span class="admin-session-copy"><small>Sessão</small><strong data-admin-session-name></strong></span>
      ${icon("chevron")}
    </button>
    <div class="admin-session-menu" data-admin-session-menu hidden>
      <p><strong data-admin-session-user>${escapeHtml(userName)}</strong><small data-admin-session-hotels>${escapeHtml(hotels.length ? `${hotels.length} unidade(s) autorizada(s)` : "Acesso administrativo")}</small></p>
      <div class="admin-palette-picker" aria-label="Paleta da Central">
        <span>Aparência</span>
        <div>${ADMIN_PALETTES.map(
          ([key, label]) =>
            `<button type="button" data-admin-palette="${key}" aria-label="Usar paleta ${label}" title="${label}" ${
              key === (session.preferences?.color_palette || "fioreze") ? 'aria-pressed="true"' : 'aria-pressed="false"'
            }><i aria-hidden="true"></i></button>`,
        ).join("")}</div>
        <small data-admin-palette-status>Escolha as cores da sua Central.</small>
      </div>
      <a href="/admin/configuracoes/">${icon("settings")} Configurações</a>
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

async function savePalettePreference(palette, session, sessionBox) {
  if (!ADMIN_PALETTES.some(([key]) => key === palette)) return;
  const previous = session.preferences?.color_palette || "fioreze";
  const status = sessionBox?.querySelector("[data-admin-palette-status]");
  applyAdminPalette(palette);
  updatePaletteButtons(sessionBox, palette);
  if (status) status.textContent = "Salvando aparência...";
  try {
    const payload = await adminApi("/api/v1/admin/me/preferences", {
      method: "PATCH",
      body: { color_palette: palette },
    });
    session.preferences = payload.data;
    if (status) status.textContent = "Aparência salva para sua conta.";
  } catch {
    applyAdminPalette(previous);
    updatePaletteButtons(sessionBox, previous);
    if (status) status.textContent = "Não foi possível salvar a aparência.";
  }
}

function updatePaletteButtons(sessionBox, selected) {
  for (const button of sessionBox?.querySelectorAll("[data-admin-palette]") || []) {
    button.setAttribute("aria-pressed", String(button.dataset.adminPalette === selected));
  }
}

function applyAdminPalette(palette) {
  const safePalette = ADMIN_PALETTES.some(([key]) => key === palette) ? palette : "fioreze";
  document.body.dataset.adminPalette = safePalette;
}

function installAdminSearch(dashboard) {
  const root = dashboard.querySelector("[data-admin-search]");
  const input = root?.querySelector("input");
  const results = root?.querySelector("[data-admin-search-results]");
  if (!root || !input || !results) return;

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
    const items = [...dashboard.querySelectorAll(".admin-global-nav a")].map((link) => ({
      href: link.getAttribute("href"),
      label: link.textContent.trim(),
    }));
    const matches = items.filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 6);
    results.innerHTML = matches.length
      ? matches.map((item) => `<a href="${escapeAttr(item.href)}">${icon("search")}<span>${escapeHtml(item.label)}</span></a>`).join("")
      : '<p>Nenhuma área encontrada.</p>';
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

async function updateMessageBadge(dashboard) {
  const badge = dashboard.querySelector("[data-admin-unread]");
  if (!badge) return;
  try {
    const payload = await adminApi("/api/v1/admin/messages?box=inbox");
    const unread = (payload.data.messages || []).filter((message) => !message.read_at).length;
    badge.textContent = unread ? String(unread) : "";
    badge.hidden = unread === 0;
  } catch {
    badge.hidden = true;
  }
}

function renderGlobalNav(session, section) {
  const items = [
    ["home", "Início", "/admin/", "home", true],
    ["portals", "Portais", "/admin/portais/", "portal", canAccessPortals(session)],
    ["portals", "Unidades", "/admin/portais/unidades/", "units", canAccessUnits(session)],
    ["portals", "Mídia", "/admin/portais/media/", "image", canAccessMediaLibrary(session)],
    ["portals", "Links", "/admin/portais/links/", "link", canAccessLinks(session)],
    ["portals", "Criador", "/admin/portais/conteudos/", "content", canAccessContent(session)],
    ["messages", "Mensagens", "/admin/mensagens/", "mail", true],
    ["settings", "Configurações", "/admin/configuracoes/", "settings", true],
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
  if (href === "/admin/configuracoes/") {
    return ["/admin/configuracoes/", "/admin/usuarios/", "/admin/perfis/", "/admin/minha-conta/", "/admin/portais/auditoria/"].some((prefix) => path.startsWith(prefix));
  }
  if (href === "/admin/") return section === "home" && path === "/admin/";
  if (href === "/admin/portais/") return path === href;
  return path.startsWith(href);
}

function adminArea(section) {
  return {
    home: "Início",
    portals: "Experiências digitais",
    users: "Equipe",
    roles: "Equipe",
    messages: "Comunicação",
    account: "Conta",
    settings: "Configurações",
  }[section] || "Central Administrativa";
}

function initials(name) {
  return String(name || "Usuário")
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
    refresh: '<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.6-2L20 8M4 16l2.3 2a7 7 0 0 0 11.6-2"/>',
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
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
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
