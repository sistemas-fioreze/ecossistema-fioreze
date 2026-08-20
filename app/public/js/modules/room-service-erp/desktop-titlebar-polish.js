export function setupDesktopTitlebarPolish(root = document) {
  if (!window.fiorezeDesktop?.isElectron) return;
  root.getElementById("desktopReload")?.remove();
}
