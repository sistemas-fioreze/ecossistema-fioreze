"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "fiorezeDesktop",
  Object.freeze({
    isElectron: true,
    minimize: () => ipcRenderer.invoke("fioreze:window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("fioreze:window:toggle-maximize"),
    close: () => ipcRenderer.invoke("fioreze:window:close"),
    platform: process.platform,
    version: process.versions.electron,
  }),
);
