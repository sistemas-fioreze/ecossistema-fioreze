"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");

const DEFAULT_ERP_URL = "http://127.0.0.1:8787/erp/room-service/";
const DEFAULT_ALLOWED_HOSTS = [
  "127.0.0.1",
  "localhost",
  "fioreze-portais-dev.marketing1-840.workers.dev",
];

const configuredUrl = process.env.FIOREZE_ROOM_SERVICE_ERP_URL || DEFAULT_ERP_URL;
const allowedHosts = parseAllowedHosts(process.env.FIOREZE_ROOM_SERVICE_ALLOWED_HOSTS);

let mainWindow;

app.whenReady().then(async () => {
  registerWindowControls();
  mainWindow = createMainWindow();
  await mainWindow.loadURL(normalizeErpUrl(configuredUrl).toString());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length) return;
  mainWindow = createMainWindow();
  await mainWindow.loadURL(normalizeErpUrl(configuredUrl).toString());
});

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: "ERP Room Service Fioreze",
    autoHideMenuBar: true,
    backgroundColor: "#f6f1ec",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: process.env.FIOREZE_DESKTOP_DEVTOOLS === "true",
    },
  });

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

function registerWindowControls() {
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
}

function normalizeErpUrl(value) {
  const url = new URL(value);
  if (!isAllowedHost(url.hostname)) {
    throw new Error("ERP host is not allowed for this desktop wrapper.");
  }
  if (!url.pathname.startsWith("/erp/room-service/")) {
    url.pathname = "/erp/room-service/";
  }
  url.hash = "";
  return url;
}

function isAllowedAppUrl(value) {
  try {
    const url = new URL(value);
    return isAllowedHost(url.hostname) && url.pathname.startsWith("/erp/room-service/");
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
