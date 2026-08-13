"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "fiorezeDesktop",
  Object.freeze({
    isElectron: true,
    minimize: () => ipcRenderer.invoke("fioreze:window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("fioreze:window:toggle-maximize"),
    close: () => ipcRenderer.invoke("fioreze:window:close"),
    reload: () => ipcRenderer.invoke("fioreze:window:reload"),
    capturePage: () => ipcRenderer.invoke("fioreze:window:capture"),
    getWindowState: () => ipcRenderer.invoke("fioreze:window:state"),
    getWindowAppearance: () => ipcRenderer.invoke("fioreze:window:appearance"),
    getPrintAgentStatus: () => ipcRenderer.invoke("fioreze:print-agent:status"),
    restartPrintAgent: () => ipcRenderer.invoke("fioreze:print-agent:restart"),
    getUpdateState: () => ipcRenderer.invoke("fioreze:update:state"),
    checkForUpdates: () => ipcRenderer.invoke("fioreze:update:check"),
    downloadAndInstallUpdate: () => ipcRenderer.invoke("fioreze:update:download-install"),
    deferUpdate: () => ipcRenderer.invoke("fioreze:update:defer"),
    onUpdateState: (listener) => {
      if (typeof listener !== "function") return () => {};
      const handler = (_event, state) => listener(state);
      ipcRenderer.on("fioreze:update:state", handler);
      return () => ipcRenderer.removeListener("fioreze:update:state", handler);
    },
    platform: process.platform,
    version: process.versions.electron,
  }),
);
