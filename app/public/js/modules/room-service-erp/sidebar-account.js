const STYLESHEET_HREF = "/css/modules/room-service-erp/sidebar-account.css?v=20260819-1";

export function setupSidebarAccount(root = document) {
  if (!window.fiorezeDesktop?.isElectron) return;

  ensureStyles(root);

  const sidebar = root.querySelector(".app-sidebar");
  const sessionButton = root.querySelector(".top-session");
  const accountPopover = root.getElementById("accountPopover");
  const avatar = root.getElementById("topStaffAvatar");
  const activeStaff = root.getElementById("activeStaff");
  if (!sidebar || !sessionButton || !accountPopover || !avatar || !activeStaff) return;

  let footer = sidebar.querySelector(".sidebar-footer");
  if (!footer) {
    footer = root.createElement("div");
    footer.className = "sidebar-footer";
    sidebar.append(footer);
  }

  const row = root.createElement("div");
  row.className = "sidebar-account-row";

  const avatarFrame = root.createElement("span");
  avatarFrame.className = "sidebar-account-avatar";

  const fallback = root.createElement("span");
  fallback.className = "sidebar-account-avatar-fallback";
  fallback.innerHTML = '<i data-lucide="user-round" aria-hidden="true"></i>';

  avatar.className = "sidebar-account-photo";
  avatarFrame.append(fallback, avatar);

  const copy = root.createElement("span");
  copy.className = "sidebar-account-copy";
  activeStaff.className = "sidebar-account-name";
  copy.append(activeStaff);

  sessionButton.className = "sidebar-account-trigger";
  sessionButton.type = "button";
  sessionButton.title = "Conta do usuario";
  sessionButton.setAttribute("aria-label", "Abrir conta do usuario");
  sessionButton.replaceChildren(avatarFrame, copy);

  const logoutButton = root.createElement("button");
  logoutButton.type = "button";
  logoutButton.className = "sidebar-account-logout";
  logoutButton.title = "Sair";
  logoutButton.setAttribute("aria-label", "Sair do ERP");
  logoutButton.innerHTML = '<i data-lucide="log-out" aria-hidden="true"></i>';
  logoutButton.addEventListener("click", (event) => {
    event.stopPropagation();
    root.querySelector(".quick-tile.logout")?.click();
  });

  row.append(sessionButton, logoutButton);
  footer.append(row, accountPopover);
}

function ensureStyles(root) {
  if (root.querySelector('link[data-erp-sidebar-account]')) return;
  const link = root.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_HREF;
  link.dataset.erpSidebarAccount = "";
  root.head.append(link);
}
