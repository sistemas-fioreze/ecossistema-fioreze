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
    getWindowState: () => ipcRenderer.invoke("fioreze:window:state"),
    getPrintAgentStatus: () => ipcRenderer.invoke("fioreze:print-agent:status"),
    restartPrintAgent: () => ipcRenderer.invoke("fioreze:print-agent:restart"),
    openPrintManager: () => ipcRenderer.invoke("fioreze:print-agent:open"),
    platform: process.platform,
    version: process.versions.electron,
  }),
);
