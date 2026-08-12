"use strict";

const { app, BrowserWindow, ipcMain, nativeTheme, screen, shell } = require("electron");
const os = require("node:os");
const path = require("node:path");
const { openPrintManager, readErpConfiguration, readPrintAgentStatus, restartPrintAgent, suitePaths } = require("./runtime.cjs");
const {
  activateWindowMaterial,
  buildWindowSurfaceOptions,
  isRemoteWindowsSession,
  publicWindowAppearance,
  resolveWindowAppearance,
} = require("./window-material.cjs");

const DEFAULT_ALLOWED_HOSTS = [
  "127.0.0.1",
  "localhost",
  "portal.hoteisfioreze.com.br",
  "fioreze-portais-dev.marketing1-840.workers.dev",
  "fioreze-portais-pages-dev.pages.dev",
];

const erpConfiguration = readErpConfiguration();
const configuredUrl = erpConfiguration.url;
const allowedHosts = parseAllowedHosts(process.env.FIOREZE_ROOM_SERVICE_ALLOWED_HOSTS);

let mainWindow;

app.whenReady().then(async () => {
  registerWindowControls();
  mainWindow = createMainWindow();
  await loadConfiguredContent(mainWindow);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length) return;
  mainWindow = createMainWindow();
  await loadConfiguredContent(mainWindow);
});

function createMainWindow() {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const width = Math.min(1280, workArea.width);
  const height = Math.min(820, workArea.height);
  const requestedAppearance = resolveCurrentWindowAppearance();
  const window = new BrowserWindow({
    x: workArea.x + Math.floor((workArea.width - width) / 2),
    y: workArea.y + Math.floor((workArea.height - height) / 2),
    width,
    height,
    minWidth: Math.min(1024, workArea.width),
    minHeight: Math.min(680, workArea.height),
    title: "ERP Room Service Fioreze",
    ...buildWindowSurfaceOptions(requestedAppearance),
    autoHideMenuBar: true,
    icon: suitePaths().iconFile,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: process.env.FIOREZE_DESKTOP_DEVTOOLS === "true",
    },
  });
  window.fiorezeWindowAppearance = activateWindowMaterial(window, requestedAppearance);

  window.once("ready-to-show", () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    handleExternalUrl(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isAllowedAppUrl(url)) return;
    event.preventDefault();
    handleExternalUrl(url);
  });

  return window;
}

async function loadConfiguredContent(window) {
  if (erpConfiguration.source === "unconfigured") {
    await window.loadFile(path.join(__dirname, "unconfigured.html"));
    return;
  }
  await window.loadURL(normalizeErpUrl(configuredUrl).toString());
}

function registerWindowControls() {
  ipcMain.handle("fioreze:window:appearance", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return publicWindowAppearance(window?.fiorezeWindowAppearance || resolveCurrentWindowAppearance());
  });
  ipcMain.handle("fioreze:window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle("fioreze:window:toggle-maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.handle("fioreze:window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle("fioreze:window:state", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return { maximized: Boolean(window?.isMaximized()) };
  });
  ipcMain.handle("fioreze:window:reload", (event) => {
    assertTrustedSender(event);
    BrowserWindow.fromWebContents(event.sender)?.webContents.reloadIgnoringCache();
  });
  ipcMain.handle("fioreze:print-agent:status", (event) => {
    assertTrustedSender(event);
    return readPrintAgentStatus();
  });
  ipcMain.handle("fioreze:print-agent:restart", (event) => {
    assertTrustedSender(event);
    return restartPrintAgent();
  });
  ipcMain.handle("fioreze:print-agent:open", (event) => {
    assertTrustedSender(event);
    return openPrintManager();
  });
}

function resolveCurrentWindowAppearance() {
  return resolveWindowAppearance({
    platform: process.platform,
    release: os.release(),
    highContrast: nativeTheme.shouldUseHighContrastColors,
    remoteSession: isRemoteWindowsSession(process.env),
    micaApiAvailable: typeof BrowserWindow.prototype.setBackgroundMaterial === "function",
  });
}

function normalizeErpUrl(value) {
  const url = new URL(value);
  if (!isAllowedHost(url.hostname)) {
    throw new Error("ERP host is not allowed for this desktop wrapper.");
  }
  if (!isAllowedAppPath(url.pathname)) {
    throw new Error("ERP path is not allowed for this desktop wrapper.");
  }
  url.hash = "";
  return url;
}

function isAllowedAppUrl(value) {
  try {
    const url = new URL(value);
    return isAllowedHost(url.hostname) && isAllowedAppPath(url.pathname);
  } catch {
    return false;
  }
}

function handleExternalUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !isAllowedHost(url.hostname)) return;
    shell.openExternal(url.toString());
  } catch {
    // Invalid URLs are ignored intentionally.
  }
}

function parseAllowedHosts(value) {
  const configured = String(value || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_HOSTS, ...configured]);
}

function isAllowedHost(hostname) {
  return allowedHosts.has(String(hostname || "").toLowerCase());
}

function isAllowedAppPath(pathname) {
  return pathname.startsWith("/erp/room-service/") || /^\/[a-z0-9]+(?:-[a-z0-9]+)*\/admin\/erp\//.test(pathname);
}

function assertTrustedSender(event) {
  if (!isAllowedAppUrl(event.senderFrame?.url || event.sender?.getURL?.())) {
    throw new Error("Desktop request rejected.");
  }
}
