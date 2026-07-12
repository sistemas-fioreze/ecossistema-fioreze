export const desktop = {
  get isElectron() {
    return Boolean(window.fiorezeDesktop?.isElectron);
  },
  minimize() {
    window.fiorezeDesktop?.minimize?.();
  },
  toggleMaximize() {
    window.fiorezeDesktop?.toggleMaximize?.();
  },
  close() {
    window.fiorezeDesktop?.close?.();
  },
  platform() {
    return window.fiorezeDesktop?.platform || "browser";
  },
  version() {
    return window.fiorezeDesktop?.version || "web";
  },
};

export function setupDesktopControls(root = document) {
  if (!desktop.isElectron) {
    document.body.dataset.fiorezeDesktop = "browser";
    return;
  }

  document.body.dataset.fiorezeDesktop = "electron";
  const controls = root.querySelector(".rs-window-controls");
  controls?.removeAttribute("hidden");
  root.getElementById("desktopMinimize")?.addEventListener("click", () => desktop.minimize());
  root.getElementById("desktopMaximize")?.addEventListener("click", () => desktop.toggleMaximize());
  root.getElementById("desktopClose")?.addEventListener("click", () => desktop.close());
}
