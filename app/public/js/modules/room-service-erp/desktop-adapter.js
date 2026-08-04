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
  windowState() {
    return window.fiorezeDesktop?.getWindowState?.() || Promise.resolve({ maximized: false });
  },
  printAgentStatus() {
    return window.fiorezeDesktop?.getPrintAgentStatus?.() || Promise.resolve(null);
  },
  restartPrintAgent() {
    return window.fiorezeDesktop?.restartPrintAgent?.() || Promise.resolve({ ok: false, action: "browser" });
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
  root.getElementById("desktopTitlebar")?.removeAttribute("hidden");
  root.getElementById("desktopMinimize")?.addEventListener("click", () => desktop.minimize());
  root.getElementById("desktopMaximize")?.addEventListener("click", async () => {
    await desktop.toggleMaximize();
    const state = await desktop.windowState();
    root.getElementById("desktopMaximize")?.setAttribute("aria-label", state.maximized ? "Restaurar janela" : "Maximizar janela");
  });
  root.getElementById("desktopClose")?.addEventListener("click", () => desktop.close());
}
