const STYLESHEET_HREF = "/css/modules/admin/admin-central-v2.css?v=20260902-1";
let syncFrame = 0;

export function setupAdminCentralV2(root = document) {
  ensureStyles(root);
  document.body.dataset.adminCentral = "v2";

  const scheduleSync = () => {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(() => syncShell(root));
  };

  scheduleSync();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(root.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener("popstate", scheduleSync);
  window.addEventListener("fioreze:admin-refresh", scheduleSync);
}

function syncShell(root) {
  const dashboard = root.querySelector('[data-view="dashboard"]');
  if (!dashboard || dashboard.hidden) return;
  enhanceSidebar(root, dashboard);
  enhanceTopbar(root, dashboard);
}

function enhanceSidebar(root, dashboard) {
  const sidebar = dashboard.querySelector(".admin-global-sidebar");
  if (!sidebar) return;

  const head = sidebar.querySelector(".admin-sidebar-head");
  if (head && !sidebar.querySelector("[data-central-sidebar-context]")) {
    head.insertAdjacentHTML(
      "afterend",
      `<div class="admin-sidebar-context" data-central-sidebar-context>
        <span class="admin-sidebar-context-mark" aria-hidden="true"></span>
        <span class="admin-sidebar-context-copy"><strong>Central Administrativa</strong><span>Ecossistema Fioreze</span></span>
      </div>`,
    );
  }

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
    if (topbar.querySelector(":scope > .admin-topbar-actions")) continue;
    const controls = [
      topbar.querySelector(":scope > .admin-command-search"),
      ...topbar.querySelectorAll(":scope > .admin-icon-button"),
      topbar.querySelector(":scope > .admin-session-box"),
    ].filter(Boolean);
    if (!controls.length) continue;
    const actions = root.createElement("div");
    actions.className = "admin-topbar-actions";
    controls[0].before(actions);
    for (const control of controls) actions.append(control);
  }
}

function ensureStyles(root) {
  if (root.querySelector('link[data-admin-central-v2]')) return;
  const link = root.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_HREF;
  link.dataset.adminCentralV2 = "";
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

if (typeof document !== "undefined") setupAdminCentralV2();
