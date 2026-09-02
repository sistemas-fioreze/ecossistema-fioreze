const STYLESHEET_HREF = "/css/modules/admin/admin-central-v2.css?v=20260902-1";
const POLISH_STYLESHEET_HREF = "/css/modules/admin/admin-central-v3.css?v=20260902-1";
let syncFrame = 0;

export function setupAdminCentralV2(root = document) {
  ensureStyles(root);
  document.body.dataset.adminCentral = "v3";

  const scheduleSync = () => {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(() => syncShell(root));
  };

  scheduleSync();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(root.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden"],
  });
  window.addEventListener("popstate", scheduleSync);
  window.addEventListener("fioreze:admin-refresh", scheduleSync);
}

function syncShell(root) {
  const dashboard = root.querySelector('[data-view="dashboard"]');
  if (!dashboard || dashboard.hidden) return;
  enhanceSidebar(root, dashboard);
  enhanceTopbar(root, dashboard);
  enhanceAccount(root);
}

function enhanceSidebar(root, dashboard) {
  const sidebar = dashboard.querySelector(".admin-global-sidebar");
  if (!sidebar) return;

  sidebar.querySelector("[data-central-sidebar-context]")?.remove();

  let footer = sidebar.querySelector("[data-central-sidebar-footer]");
  if (!footer) {
    footer = root.createElement("div");
    footer.className = "admin-sidebar-footer";
    footer.dataset.centralSidebarFooter = "";
    footer.innerHTML = `
      <span class="admin-avatar" data-central-sidebar-avatar aria-hidden="true">F</span>
      <span class="admin-sidebar-footer-copy"><strong data-central-sidebar-user>Conta</strong><span data-central-sidebar-meta>Acesso administrativo</span></span>
      <a class="admin-sidebar-account-link" href="/admin/minha-conta/" aria-label="Abrir minha conta" title="Minha conta">${userIcon()}</a>
    `;
    sidebar.append(footer);
  }

  const userName = root.querySelector("#sessionUser")?.textContent?.trim() || "Conta";
  const meta = root.querySelector("[data-admin-session-hotels]")?.textContent?.trim() || "Acesso administrativo";
  const initialsText = initials(userName);
  const user = footer.querySelector("[data-central-sidebar-user]");
  const metaNode = footer.querySelector("[data-central-sidebar-meta]");
  const avatar = footer.querySelector("[data-central-sidebar-avatar]");
  if (user && user.textContent !== userName) user.textContent = userName;
  if (metaNode && metaNode.textContent !== meta) metaNode.textContent = meta;
  if (avatar && avatar.textContent !== initialsText) avatar.textContent = initialsText;
}

function enhanceTopbar(root, dashboard) {
  for (const topbar of dashboard.querySelectorAll(".admin-topbar")) {
    if (!topbar.querySelector(":scope > .admin-topbar-actions")) {
      const controls = [
        topbar.querySelector(":scope > .admin-command-search"),
        ...topbar.querySelectorAll(":scope > .admin-icon-button"),
        topbar.querySelector(":scope > .admin-session-box"),
      ].filter(Boolean);
      if (controls.length) {
        const actions = root.createElement("div");
        actions.className = "admin-topbar-actions";
        controls[0].before(actions);
        for (const control of controls) actions.append(control);
      }
    }
    synchronizeTopbarContext(root, topbar);
  }
}

function synchronizeTopbarContext(root, topbar) {
  const copy = topbar.querySelector(".admin-topbar-copy");
  if (!copy) return;
  const section = document.body.dataset.adminSection || "home";
  const kicker = copy.querySelector(".admin-page-kicker");
  let breadcrumbs = copy.querySelector("[data-central-breadcrumbs]");
  if (section !== "account") {
    breadcrumbs?.remove();
    if (kicker) kicker.hidden = false;
    return;
  }

  if (!breadcrumbs) {
    breadcrumbs = root.createElement("nav");
    breadcrumbs.className = "admin-central-breadcrumbs";
    breadcrumbs.dataset.centralBreadcrumbs = "";
    breadcrumbs.setAttribute("aria-label", "Localização");
    breadcrumbs.innerHTML = '<a href="/admin/configuracoes/">Configurações</a><span aria-hidden="true">/</span><strong>Minha conta</strong>';
    copy.prepend(breadcrumbs);
  }
  if (kicker) kicker.hidden = true;
  const subtitle = copy.querySelector(".admin-muted");
  if (subtitle) subtitle.textContent = "Gerencie seu perfil, métodos de acesso e proteção da conta.";
}

function enhanceAccount(root) {
  if (document.body.dataset.adminSection !== "account") return;
  const manager = root.getElementById("accountManager");
  if (!manager || manager.hidden) return;
  enhanceProfileSummary(root, manager);
  enhancePasskeyManager(root, manager);
  clarifyTotpActions(manager);
}

function enhanceProfileSummary(root, manager) {
  const profileCard = manager.querySelector(".admin-account-profile-card");
  const details = manager.querySelector("#accountDetails");
  if (!profileCard || !details) return;

  let summary = profileCard.querySelector("[data-central-profile-summary]");
  if (!summary) {
    summary = root.createElement("div");
    summary.className = "admin-central-profile-summary";
    summary.dataset.centralProfileSummary = "";
    summary.innerHTML = `
      <div><span>Perfil administrativo</span><strong data-central-profile-role>Carregando...</strong></div>
      <div><span>Escopo de acesso</span><strong data-central-profile-scope>Acesso administrativo</strong></div>
    `;
    profileCard.append(summary);
  }

  const role = details.querySelector("small")?.textContent?.trim() || "Acesso administrativo";
  const scope = root.querySelector("[data-admin-session-hotels]")?.textContent?.trim() || "Acesso administrativo";
  const roleNode = summary.querySelector("[data-central-profile-role]");
  const scopeNode = summary.querySelector("[data-central-profile-scope]");
  if (roleNode && roleNode.textContent !== role) roleNode.textContent = role;
  if (scopeNode && scopeNode.textContent !== scope) scopeNode.textContent = scope;
}

function enhancePasskeyManager(root, manager) {
  const card = manager.querySelector("[data-admin-passkey-manager]");
  if (!card || card.dataset.centralManaged === "true") return;
  const head = card.querySelector(".admin-passkey-card-head");
  const copy = head?.querySelector(":scope > div");
  const addButton = card.querySelector("[data-passkey-add]");
  const status = card.querySelector("[data-passkey-status]");
  const list = card.querySelector("[data-passkey-list]");
  if (!head || !copy || !addButton || !status || !list) return;
  card.dataset.centralManaged = "true";

  const summary = root.createElement("p");
  summary.className = "admin-central-passkey-summary";
  summary.dataset.centralPasskeySummary = "";
  summary.textContent = "Carregando chaves cadastradas...";
  copy.append(summary);

  const manageButton = root.createElement("button");
  manageButton.type = "button";
  manageButton.className = "admin-central-manage-button";
  manageButton.dataset.centralPasskeyManage = "";
  manageButton.innerHTML = `<span>Gerenciar</span>${chevronIcon()}`;
  card.append(manageButton);

  const dialog = root.createElement("dialog");
  dialog.className = "admin-account-dialog admin-central-passkey-dialog";
  dialog.dataset.centralPasskeyDialog = "";
  dialog.innerHTML = `
    <div class="admin-account-dialog-shell">
      <header>
        <div class="admin-account-dialog-heading">
          <span class="admin-account-dialog-icon">${keyIcon()}</span>
          <div><span>Segurança</span><h2>Chaves de acesso</h2><p>Gerencie os dispositivos que podem entrar sem digitar sua senha.</p></div>
        </div>
        <button type="button" class="admin-account-dialog-close" data-central-passkey-close aria-label="Fechar">${closeIcon()}</button>
      </header>
      <div class="admin-account-dialog-body">
        <div class="admin-central-passkey-toolbar" data-central-passkey-toolbar></div>
        <div class="admin-central-passkey-content" data-central-passkey-content></div>
      </div>
    </div>
  `;
  const toolbar = dialog.querySelector("[data-central-passkey-toolbar]");
  const content = dialog.querySelector("[data-central-passkey-content]");
  toolbar.append(addButton);
  content.append(status, list);
  root.body.append(dialog);

  const updateSummary = () => {
    const rows = list.querySelectorAll(".admin-passkey-row").length;
    const busy = list.getAttribute("aria-busy") === "true";
    const text = busy
      ? "Atualizando chaves cadastradas..."
      : rows === 1
        ? "1 chave de acesso cadastrada"
        : rows > 1
          ? `${rows} chaves de acesso cadastradas`
          : "Nenhuma chave de acesso cadastrada";
    if (summary.textContent !== text) summary.textContent = text;
  };

  const listObserver = new MutationObserver(updateSummary);
  listObserver.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-busy"] });
  updateSummary();

  manageButton.addEventListener("click", () => {
    dialog.showModal();
    requestAnimationFrame(() => addButton.focus());
  });
  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-central-passkey-close]") || event.target === dialog) dialog.close();
  });
}

function clarifyTotpActions(manager) {
  const recoveryButton = manager.querySelector("[data-totp-recovery]");
  if (recoveryButton && recoveryButton.textContent.trim() !== "Códigos de recuperação") {
    recoveryButton.textContent = "Códigos de recuperação";
  }
}

function ensureStyles(root) {
  ensureStylesheet(root, 'link[data-admin-central-v2]', STYLESHEET_HREF, "adminCentralV2");
  ensureStylesheet(root, 'link[data-admin-central-v3]', POLISH_STYLESHEET_HREF, "adminCentralV3");
}

function ensureStylesheet(root, selector, href, dataName) {
  if (root.querySelector(selector)) return;
  const link = root.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset[dataName] = "";
  root.head.append(link);
}

function initials(name) {
  return String(name || "F")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "F";
}

function userIcon() {
  return '<svg class="admin-svg-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>';
}

function chevronIcon() {
  return '<svg class="admin-svg-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"></path></svg>';
}

function keyIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4"></circle><path d="M11 12l8-8M15 8l2 2M17 6l2 2"></path></svg>';
}

function closeIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
}

if (typeof document !== "undefined") setupAdminCentralV2();
