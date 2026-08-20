const STYLESHEET_HREF = "/css/modules/room-service-erp/sidebar-account.css?v=20260819-2";
const RANGE_STYLESHEET_HREF = "/css/modules/room-service-erp/sidebar-account-range.css?v=20260819-1";
const LAYOUT_STYLESHEET_HREF = "/css/modules/room-service-erp/sidebar-account-layout-v2.css?v=20260819-1";
const AVATAR_STYLESHEET_HREF = "/css/modules/room-service-erp/sidebar-account-avatar.css?v=20260819-1";

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
  sessionButton.title = "Conta do usuário";
  sessionButton.setAttribute("aria-label", "Abrir conta do usuário");
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
  removeInterfaceScaleControl(accountPopover);
  setupRangeProgress(accountPopover);
}

function removeInterfaceScaleControl(accountPopover) {
  const scaleControl = accountPopover.querySelector(".scale-control");
  if (!scaleControl) return;

  const panel = scaleControl.closest(".quick-setting-panel");
  scaleControl.remove();
  if (panel && panel.childElementCount === 0) panel.remove();
}

function setupRangeProgress(accountPopover) {
  accountPopover.querySelectorAll('input[type="range"]').forEach((range) => {
    const updateProgress = () => {
      const min = Number(range.min || 0);
      const max = Number(range.max || 100);
      const value = Number(range.value || min);
      const span = max - min || 1;
      const progress = Math.min(100, Math.max(0, ((value - min) / span) * 100));
      range.style.setProperty("--range-progress", `${progress}%`);
    };

    updateProgress();
    range.addEventListener("input", updateProgress);
    range.addEventListener("change", updateProgress);
  });
}

function ensureStyles(root) {
  if (!root.querySelector('link[data-erp-sidebar-account]')) {
    const link = root.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLESHEET_HREF;
    link.dataset.erpSidebarAccount = "";
    root.head.append(link);
  }

  if (!root.querySelector('link[data-erp-sidebar-account-range]')) {
    const rangeLink = root.createElement("link");
    rangeLink.rel = "stylesheet";
    rangeLink.href = RANGE_STYLESHEET_HREF;
    rangeLink.dataset.erpSidebarAccountRange = "";
    root.head.append(rangeLink);
  }

  if (!root.querySelector('link[data-erp-sidebar-account-layout]')) {
    const layoutLink = root.createElement("link");
    layoutLink.rel = "stylesheet";
    layoutLink.href = LAYOUT_STYLESHEET_HREF;
    layoutLink.dataset.erpSidebarAccountLayout = "";
    root.head.append(layoutLink);
  }

  if (!root.querySelector('link[data-erp-sidebar-account-avatar]')) {
    const avatarLink = root.createElement("link");
    avatarLink.rel = "stylesheet";
    avatarLink.href = AVATAR_STYLESHEET_HREF;
    avatarLink.dataset.erpSidebarAccountAvatar = "";
    root.head.append(avatarLink);
  }
}
