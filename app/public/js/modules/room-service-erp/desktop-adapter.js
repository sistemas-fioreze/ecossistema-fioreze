import { iconMarkup } from "./icon-system.js";

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
  capturePage() {
    return window.fiorezeDesktop?.capturePage?.() || Promise.resolve(null);
  },
  windowState() {
    return window.fiorezeDesktop?.getWindowState?.() || Promise.resolve({ maximized: false });
  },
  windowAppearance() {
    return window.fiorezeDesktop?.getWindowAppearance?.() || Promise.resolve({ material: "solid", nativeWindowControls: false });
  },
  printAgentStatus() {
    return window.fiorezeDesktop?.getPrintAgentStatus?.() || Promise.resolve(null);
  },
  restartPrintAgent() {
    return window.fiorezeDesktop?.restartPrintAgent?.() || Promise.resolve({ ok: false, action: "browser" });
  },
  updateState() {
    return window.fiorezeDesktop?.getUpdateState?.() || Promise.resolve({ status: "unsupported" });
  },
  checkForUpdates() {
    return window.fiorezeDesktop?.checkForUpdates?.() || Promise.resolve({ status: "unsupported" });
  },
  downloadAndInstallUpdate() {
    return window.fiorezeDesktop?.downloadAndInstallUpdate?.() || Promise.resolve({ status: "unsupported" });
  },
  deferUpdate() {
    return window.fiorezeDesktop?.deferUpdate?.() || Promise.resolve({ status: "unsupported" });
  },
  onUpdateState(listener) {
    return window.fiorezeDesktop?.onUpdateState?.(listener) || (() => {});
  },
  platform() {
    return window.fiorezeDesktop?.platform || "browser";
  },
  version() {
    return window.fiorezeDesktop?.version || "web";
  },
};

export async function setupDesktopControls(root = document) {
  if (!desktop.isElectron) {
    document.body.dataset.fiorezeDesktop = "browser";
    return;
  }

  const appearance = await desktop.windowAppearance().catch(() => ({ material: "solid", nativeWindowControls: false }));
  const controlMode = appearance?.nativeWindowControls ? "native" : "custom";

  document.body.dataset.fiorezeDesktop = "electron";
  document.body.dataset.windowMaterial = "solid";
  document.body.dataset.windowControls = controlMode;
  document.documentElement.dataset.fiorezeDesktop = "electron";
  document.documentElement.dataset.windowMaterial = "solid";
  document.documentElement.dataset.windowControls = controlMode;
  installDesktopSearchPolish(root);
  const customWindowControls = root.querySelector(".rs-window-controls");
  if (customWindowControls) customWindowControls.hidden = controlMode === "native";
  root.getElementById("desktopTitlebar")?.removeAttribute("hidden");
  installDesktopWorkspace(root);
  const syncViewportInsets = async () => {
    const state = await desktop.windowState().catch(() => ({ workAreaBottomInset: 0 }));
    const bottomInset = Math.max(0, Math.min(96, Number(state?.workAreaBottomInset) || 0));
    document.documentElement.style.setProperty("--erp-desktop-bottom-inset", `${bottomInset}px`);
  };
  await syncViewportInsets();
  let viewportSyncFrame = 0;
  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(viewportSyncFrame);
    viewportSyncFrame = window.requestAnimationFrame(syncViewportInsets);
  });

  if (controlMode === "custom") {
    root.getElementById("desktopMinimize")?.addEventListener("click", () => desktop.minimize());
    root.getElementById("desktopMaximize")?.addEventListener("click", async () => {
      await desktop.toggleMaximize();
      const state = await desktop.windowState();
      root.getElementById("desktopMaximize")?.setAttribute("aria-label", state.maximized ? "Restaurar janela" : "Maximizar janela");
    });
    root.getElementById("desktopClose")?.addEventListener("click", () => desktop.close());
  }
  root.getElementById("desktopReload")?.addEventListener("click", () => desktop.reload());
  installDesktopPrintStatus(root);
  syncDesktopPrintStatus(root);
  window.setInterval(() => syncDesktopPrintStatus(root), 10_000);
  installDesktopUpdater(root);
}

function installDesktopSearchPolish(root) {
  if (root.getElementById("desktopSearchPolishStylesheet")) return;
  const stylesheet = root.createElement("link");
  stylesheet.id = "desktopSearchPolishStylesheet";
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/css/modules/room-service-erp/desktop-search-polish.css?v=20260819-2";
  root.head.append(stylesheet);
}

function installDesktopWorkspace(root) {
  const workspace = root.getElementById("desktopWorkspace");
  const search = root.getElementById("topSearchWrap");
  const feedback = root.getElementById("erpFeedbackButton");
  if (!workspace) return;
  if (search) workspace.append(search);
  if (feedback) workspace.append(feedback);
}

async function installDesktopUpdater(root) {
  const modal = buildUpdateModal(root);
  const render = (state) => renderUpdateState(modal, state);
  const unsubscribe = desktop.onUpdateState(render);
  window.addEventListener("beforeunload", unsubscribe, { once: true });
  render(await desktop.updateState().catch(() => ({ status: "error" })));
}

function buildUpdateModal(root) {
  let modal = root.getElementById("desktopUpdateModal");
  if (modal) return modal;
  modal = root.createElement("div");
  modal.id = "desktopUpdateModal";
  modal.className = "desktop-update-modal";
  modal.hidden = true;
  modal.innerHTML = `<section class="desktop-update-card" role="dialog" aria-modal="true" aria-labelledby="desktopUpdateTitle">
    <div class="desktop-update-icon" aria-hidden="true">${updateIcon()}</div>
    <div class="desktop-update-copy">
      <p class="admin-kicker">Atualizacao do aplicativo</p>
      <h2 id="desktopUpdateTitle">Nova versao do Fioreze ERP</h2>
      <p id="desktopUpdateMessage">Uma atualizacao nativa esta disponivel.</p>
      <p id="desktopUpdateVersions" class="desktop-update-versions"></p>
      <p id="desktopUpdateNotes" class="desktop-update-notes" hidden></p>
      <div class="desktop-update-progress" hidden><span></span></div>
    </div>
    <div class="desktop-update-actions">
      <button type="button" class="admin-secondary-btn" data-update-defer>Lembrar mais tarde</button>
      <button type="button" class="admin-primary-btn" data-update-install>Baixar e instalar</button>
    </div>
  </section>`;
  root.body.append(modal);
  modal.querySelector("[data-update-defer]")?.addEventListener("click", async () => {
    await desktop.deferUpdate();
    modal.hidden = true;
  });
  modal.querySelector("[data-update-install]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    await desktop.downloadAndInstallUpdate();
  });
  return modal;
}

function renderUpdateState(modal, state = {}) {
  const visible = ["available", "downloading", "ready"].includes(state.status);
  modal.hidden = !visible;
  if (!visible) return;
  const downloading = state.status === "downloading" || state.status === "ready";
  const progress = Math.max(0, Math.min(100, Number(state.progress) || 0));
  const message = modal.querySelector("#desktopUpdateMessage");
  const versions = modal.querySelector("#desktopUpdateVersions");
  const notes = modal.querySelector("#desktopUpdateNotes");
  const progressTrack = modal.querySelector(".desktop-update-progress");
  const installButton = modal.querySelector("[data-update-install]");
  const deferButton = modal.querySelector("[data-update-defer]");
  message.textContent = state.message || "Uma atualizacao nativa esta disponivel.";
  versions.textContent = state.availableVersion
    ? `Versao atual ${state.currentVersion || "-"} · nova versao ${state.availableVersion}`
    : "";
  notes.textContent = state.releaseNotes || "";
  notes.hidden = !notes.textContent;
  progressTrack.hidden = !downloading;
  progressTrack.querySelector("span").style.width = `${state.status === "ready" ? 100 : progress}%`;
  installButton.disabled = downloading || state.status === "error";
  installButton.textContent = state.status === "ready" ? "Instalando..." : state.status === "downloading" ? `Baixando ${progress}%` : "Baixar e instalar";
  deferButton.hidden = downloading;
}

function updateIcon() {
  return iconMarkup("download");
}

async function syncDesktopPrintStatus(root) {
  const button = root.getElementById("desktopPrintManager");
  if (!button) return;
  try {
    const status = await desktop.printAgentStatus();
    const configured = isPrintServerComputer(status);
    const state = status?.running ? "online" : configured ? "offline" : "not-configured";
    button.dataset.state = state;
    button.title = status?.running
      ? `Impressao conectada: ${status.printer_name || "impressora configurada"}`
      : configured
        ? "Consultar o servidor de impressao deste computador"
        : "Consultar o status da impressao";
    renderDesktopPrintStatus(root, status);
  } catch {
    button.dataset.state = "offline";
  }
}

function installDesktopPrintStatus(root) {
  const modal = root.getElementById("printManagerModal");
  const openButton = root.getElementById("desktopPrintManager");
  const refreshButton = root.getElementById("desktopPrintRefresh");
  const restartButton = root.getElementById("desktopPrintRestart");
  if (!modal || !openButton) return;

  const close = () => {
    modal.classList.add("hidden");
    openButton.focus();
  };
  const refresh = () => syncDesktopPrintStatus(root);

  openButton.addEventListener("click", async () => {
    modal.classList.remove("hidden");
    openButton.setAttribute("aria-busy", "true");
    try {
      await refresh();
    } finally {
      openButton.removeAttribute("aria-busy");
      modal.querySelector("[data-print-status-close]")?.focus();
    }
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  modal.querySelector("[data-print-status-close]")?.addEventListener("click", close);
  refreshButton?.addEventListener("click", refresh);
  restartButton?.addEventListener("click", async () => {
    restartButton.disabled = true;
    restartButton.setAttribute("aria-busy", "true");
    try {
      const result = await desktop.restartPrintAgent();
      const message = root.getElementById("desktopPrintStatusMessage");
      if (message) {
        message.textContent = result?.ok
          ? "Reinício solicitado ao servidor de impressão deste computador."
          : result?.action === "not_configured"
            ? "Este computador usa somente o ERP e não executa o servidor de impressão."
            : "Não foi possível reiniciar o servidor de impressão.";
      }
      window.setTimeout(refresh, 1800);
    } finally {
      restartButton.removeAttribute("aria-busy");
    }
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) close();
  });
}

function renderDesktopPrintStatus(root, status = {}) {
  const configured = isPrintServerComputer(status);
  const running = Boolean(status?.running);
  const pill = root.getElementById("desktopPrintStatusPill");
  const message = root.getElementById("desktopPrintStatusMessage");
  const restart = root.getElementById("desktopPrintRestart");
  const values = {
    desktopPrintRole: configured ? "Servidor de impressão" : "Somente ERP",
    desktopPrintDevice: status?.device_name || "Este computador",
    desktopPrintPrinter: configured ? status?.printer_name || "Não informada" : "Não configurada",
    desktopPrintVersion: status?.app_version || "-",
    desktopPrintUpdatedAt: formatDesktopTimestamp(status?.updated_at),
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = root.getElementById(id);
    if (element) element.textContent = value;
  });
  if (pill) {
    pill.className = `desktop-print-status-pill ${running ? "online" : configured ? "offline" : "erp-only"}`;
    pill.textContent = running ? "Online" : configured ? "Sem resposta" : "Somente ERP";
  }
  if (message) {
    message.textContent = running
      ? status?.message || "Aguardando novos pedidos."
      : configured
        ? status?.message || "O servidor de impressão não respondeu recentemente."
        : "Nenhum servidor de impressão será iniciado neste computador.";
  }
  if (restart) restart.disabled = !configured;
}

function isPrintServerComputer(status = {}) {
  if (typeof status?.configured === "boolean") return status.configured;
  return Boolean(status?.running || status?.device_id || status?.hotel_id);
}

function formatDesktopTimestamp(value) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "Sem atividade recente";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(timestamp));
}
