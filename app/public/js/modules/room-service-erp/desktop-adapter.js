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
  reload() {
    return window.fiorezeDesktop?.reload?.() || Promise.resolve();
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
  openPrintManager() {
    return window.fiorezeDesktop?.openPrintManager?.() || Promise.resolve({ ok: false, action: "browser" });
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
  root.getElementById("desktopReload")?.addEventListener("click", () => desktop.reload());
  root.getElementById("desktopPrintManager")?.addEventListener("click", async () => {
    const button = root.getElementById("desktopPrintManager");
    button?.setAttribute("aria-busy", "true");
    try {
      await desktop.openPrintManager();
    } finally {
      button?.removeAttribute("aria-busy");
    }
  });
  syncDesktopPrintStatus(root);
  window.setInterval(() => syncDesktopPrintStatus(root), 10_000);
}

async function syncDesktopPrintStatus(root) {
  const button = root.getElementById("desktopPrintManager");
  if (!button) return;
  try {
    const status = await desktop.printAgentStatus();
    const state = status?.running ? "online" : status?.installed ? "offline" : "not-installed";
    button.dataset.state = state;
    button.title = status?.running
      ? `Impressao conectada: ${status.printer_name || "impressora configurada"}`
      : status?.installed
        ? "Abrir gerenciador de impressao"
        : "Fioreze Suite ainda nao instalada";
    const label = button.querySelector("span");
    if (label) label.textContent = status?.running ? "Impressao online" : "Impressao";
  } catch {
    button.dataset.state = "offline";
  }
}
