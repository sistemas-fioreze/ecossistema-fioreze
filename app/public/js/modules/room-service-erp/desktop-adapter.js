import { iconMarkup } from "./icon-system.js";
import { getPrintingStatus } from "./api.js";

let printStatusRoot = null;
let observedHotelId = "";
let observedRemotePrinting = null;
let remotePrintFailureCount = 0;
let remotePrintRetryAt = 0;

const REMOTE_PRINT_POLL_BASE_DELAY_MS = 30_000;
const REMOTE_PRINT_POLL_MAX_BACKOFF_MS = 5 * 60_000;

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
  observePrintServer({ hotelId, printing } = {}) {
    const nextHotelId = String(hotelId || "").trim();
    if (nextHotelId !== observedHotelId) {
      remotePrintFailureCount = 0;
      remotePrintRetryAt = 0;
    }
    observedHotelId = nextHotelId;
    observedRemotePrinting = printing || null;
    if (printStatusRoot && this.isElectron) void syncDesktopPrintStatus(printStatusRoot, { refreshRemote: false });
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
  printStatusRoot = root;
  installDesktopPrintStatus(root);
  syncDesktopPrintStatus(root, { refreshRemote: true });
  window.setInterval(() => {
    if (!document.hidden) syncDesktopPrintStatus(root, { refreshRemote: true });
  }, 30_000);
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

async function syncDesktopPrintStatus(root, { refreshRemote = false } = {}) {
  const button = root.getElementById("desktopPrintManager");
  if (!button) return;
  try {
    const status = await resolveDesktopPrintStatus({ refreshRemote });
    const localServer = isPrintServerComputer(status);
    const state = status?.running ? "online" : status?.server_configured || localServer ? "offline" : "not-configured";
    button.dataset.state = state;
    button.title = status?.running
      ? `${status.remote ? "Servidor de impressao online" : "Impressao conectada"}: ${status.printer_name || "impressora configurada"}`
      : status?.server_configured || localServer
        ? status?.remote ? "Consultar o servidor de impressao da unidade" : "Consultar o servidor de impressao deste computador"
        : "Consultar o status da impressao";
    renderDesktopPrintStatus(root, status);
  } catch {
    button.dataset.state = "offline";
  }
}

async function resolveDesktopPrintStatus({ refreshRemote = false } = {}) {
  const local = await desktop.printAgentStatus().catch(() => null);
  if (isPrintServerComputer(local)) {
    return { ...local, is_local_server: true, server_configured: true, remote: false };
  }
  if (refreshRemote && observedHotelId) {
    if (Date.now() < remotePrintRetryAt) return remotePrintStatus(local, observedRemotePrinting);
    try {
      observedRemotePrinting = (await getPrintingStatus({ hotelId: observedHotelId })).data;
      remotePrintFailureCount = 0;
      remotePrintRetryAt = 0;
    } catch (error) {
      // Keep the last server observation when a transient request fails.
      if (error.status >= 500 || error.status === 429) {
        remotePrintFailureCount = Math.min(remotePrintFailureCount + 1, 4);
        const retryDelay = Math.min(
          REMOTE_PRINT_POLL_MAX_BACKOFF_MS,
          REMOTE_PRINT_POLL_BASE_DELAY_MS * (2 ** (remotePrintFailureCount - 1)),
        );
        remotePrintRetryAt = Date.now() + retryDelay;
      }
    }
  }
  return remotePrintStatus(local, observedRemotePrinting);
}

function remotePrintStatus(local, printing) {
  const device = printing?.device || null;
  const connection = device?.connection_status || (device ? "offline" : "not_configured");
  const running = Boolean(device && connection === "online");
  return {
    ...(local || {}),
    configured: false,
    is_local_server: false,
    server_configured: Boolean(device),
    remote: true,
    running,
    status: !printing?.enabled ? "disabled" : connection,
    message: printing?.message || (device ? "O servidor de impressão não respondeu recentemente." : "Nenhum servidor de impressão está vinculado à unidade."),
    hotel_id: printing?.hotel_id || observedHotelId,
    device_id: device?.id || "",
    device_name: device?.name || "Nenhum servidor vinculado",
    printer_name: device?.printer_name || "Não informada",
    app_version: device?.app_version || "-",
    updated_at: device?.last_seen_at || device?.updated_at || printing?.observed_at || null,
  };
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
  const serverConfigured = Boolean(configured || status?.server_configured);
  const running = Boolean(status?.running);
  const pill = root.getElementById("desktopPrintStatusPill");
  const message = root.getElementById("desktopPrintStatusMessage");
  const restart = root.getElementById("desktopPrintRestart");
  const values = {
    desktopPrintRole: configured ? "Servidor de impressão" : "Somente ERP",
    desktopPrintDevice: status?.device_name || (configured ? "Este computador" : "Nenhum servidor vinculado"),
    desktopPrintPrinter: serverConfigured ? status?.printer_name || "Não informada" : "Não configurada",
    desktopPrintVersion: status?.app_version || "-",
    desktopPrintUpdatedAt: formatDesktopTimestamp(status?.updated_at),
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = root.getElementById(id);
    if (element) element.textContent = value;
  });
  if (pill) {
    pill.className = `desktop-print-status-pill ${running ? "online" : serverConfigured ? "offline" : "erp-only"}`;
    pill.textContent = running ? "Online" : status?.status === "paused" ? "Pausado" : serverConfigured ? "Sem resposta" : "Não configurado";
  }
  if (message) {
    message.textContent = running
      ? status?.message || "Aguardando novos pedidos."
      : serverConfigured
        ? status?.message || "O servidor de impressão não respondeu recentemente."
        : status?.message || "Nenhum servidor de impressão está vinculado à unidade.";
  }
  if (restart) restart.disabled = !configured;
  const hint = root.getElementById("desktopPrintStatusHint");
  if (hint) hint.textContent = configured
    ? "Este computador executa o agente e pode reiniciá-lo localmente."
    : "Status recebido do computador servidor. Este ERP não inicia outro agente de impressão.";
}

function isPrintServerComputer(status = {}) {
  if (typeof status?.is_local_server === "boolean") return status.is_local_server;
  if (typeof status?.configured === "boolean") return status.configured;
  return Boolean(status?.running || status?.device_id || status?.hotel_id);
}

function formatDesktopTimestamp(value) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "Sem atividade recente";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(timestamp));
}
