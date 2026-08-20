const STYLESHEET_HREF = "/css/modules/room-service-erp/desktop-titlebar-polish.css?v=20260819-2";

export function setupDesktopTitlebarPolish(root = document) {
  if (!window.fiorezeDesktop?.isElectron) return;

  root.getElementById("desktopReload")?.remove();
  ensureStyles(root);

  let syncFrame = 0;
  const syncWindowState = async () => {
    const state = await window.fiorezeDesktop?.getWindowState?.().catch?.(() => null);
    const maximized = Boolean(state?.maximized);
    document.body.dataset.windowMaximized = maximized ? "true" : "false";
    document.documentElement.dataset.windowMaximized = maximized ? "true" : "false";
  };

  const scheduleWindowStateSync = () => {
    window.cancelAnimationFrame(syncFrame);
    syncFrame = window.requestAnimationFrame(syncWindowState);
  };

  syncWindowState();
  window.addEventListener("resize", scheduleWindowStateSync);
}

function ensureStyles(root) {
  if (root.querySelector('link[data-erp-desktop-titlebar-polish]')) return;
  const link = root.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_HREF;
  link.dataset.erpDesktopTitlebarPolish = "";
  root.head.append(link);
}
