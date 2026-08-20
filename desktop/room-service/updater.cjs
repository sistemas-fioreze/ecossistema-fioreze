"use strict";

const fs = require("node:fs");
const path = require("node:path");

const UPDATE_FEED_URL = "https://portal.hoteisfioreze.com.br/downloads/erp";
const REMINDER_HOURS = 24;

function createUpdateController({
  updater,
  app,
  ipcMain,
  getWindow,
  assertTrustedSender,
  fileSystem = fs,
  clock = Date,
  scheduleInstall = (callback) => setTimeout(callback, 500),
}) {
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.allowDowngrade = false;
  updater.setFeedURL({ provider: "generic", url: UPDATE_FEED_URL });

  let installWhenReady = false;
  let state = publicState({ status: "idle", currentVersion: app.getVersion() });
  const reminderFile = path.join(app.getPath("userData"), "update-reminder.json");

  const publish = (patch) => {
    state = publicState({ ...state, ...patch, currentVersion: app.getVersion() });
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send("fioreze:update:state", state);
    return state;
  };

  updater.on("checking-for-update", () => publish({ status: "checking", message: "Verificando atualizações..." }));
  updater.on("update-not-available", () => publish({ status: "current", availableVersion: null, message: "O ERP está atualizado." }));
  updater.on("update-available", (info) => {
    const availableVersion = cleanVersion(info?.version);
    if (isDeferred(reminderFile, availableVersion, fileSystem, clock)) {
      publish({ status: "deferred", availableVersion, message: "Atualização adiada temporariamente." });
      return;
    }
    publish({
      status: "available",
      availableVersion,
      releaseNotes: cleanReleaseNotes(info?.releaseNotes),
      message: `Versão ${availableVersion} disponível.`,
    });
  });
  updater.on("download-progress", (progress) => publish({
    status: "downloading",
    progress: Math.max(0, Math.min(100, Math.round(Number(progress?.percent) || 0))),
    message: "Baixando atualização...",
  }));
  updater.on("update-downloaded", () => {
    publish({ status: "ready", progress: 100, message: "Atualização pronta para instalar." });
    if (installWhenReady) scheduleInstall(() => updater.quitAndInstall(false, true));
  });
  updater.on("error", () => publish({
    status: "error",
    message: "Não foi possível verificar ou baixar a atualização agora.",
  }));

  ipcMain.handle("fioreze:update:state", (event) => {
    assertTrustedSender(event);
    return state;
  });
  ipcMain.handle("fioreze:update:check", async (event) => {
    assertTrustedSender(event);
    if (!app.isPackaged) return publish({ status: "development", message: "Atualizações nativas estão desativadas no modo local." });
    await updater.checkForUpdates();
    return state;
  });
  ipcMain.handle("fioreze:update:download-install", async (event) => {
    assertTrustedSender(event);
    if (state.status !== "available") return state;
    installWhenReady = true;
    publish({ status: "downloading", progress: 0, message: "Preparando download seguro..." });
    await updater.downloadUpdate();
    return state;
  });
  ipcMain.handle("fioreze:update:defer", (event) => {
    assertTrustedSender(event);
    const availableVersion = cleanVersion(state.availableVersion);
    if (availableVersion) writeReminder(reminderFile, availableVersion, fileSystem, clock);
    return publish({ status: "deferred", message: "Vamos lembrar você novamente amanhã." });
  });

  return {
    state: () => state,
    check: async () => {
      if (!app.isPackaged) return state;
      await updater.checkForUpdates().catch(() => {});
      return state;
    },
  };
}

function cleanVersion(value) {
  const version = String(value || "").trim();
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version) ? version : "";
}

function cleanReleaseNotes(value) {
  const source = Array.isArray(value) ? value.map((entry) => entry?.note || "").join("\n") : String(value || "");
  return source.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 600);
}

function publicState(value) {
  return Object.freeze({
    status: String(value.status || "idle"),
    currentVersion: cleanVersion(value.currentVersion),
    availableVersion: cleanVersion(value.availableVersion) || null,
    releaseNotes: cleanReleaseNotes(value.releaseNotes),
    progress: Math.max(0, Math.min(100, Number(value.progress) || 0)),
    message: String(value.message || "").slice(0, 180),
  });
}

function isDeferred(file, version, fileSystem, clock) {
  try {
    const reminder = JSON.parse(fileSystem.readFileSync(file, "utf8"));
    return reminder.version === version && Number(reminder.remindAfter) > clock.now();
  } catch {
    return false;
  }
}

function writeReminder(file, version, fileSystem, clock) {
  fileSystem.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fileSystem.writeFileSync(temporary, JSON.stringify({
    version,
    remindAfter: clock.now() + REMINDER_HOURS * 60 * 60 * 1000,
  }), { encoding: "utf8", mode: 0o600 });
  fileSystem.renameSync(temporary, file);
}

module.exports = {
  REMINDER_HOURS,
  UPDATE_FEED_URL,
  cleanVersion,
  createUpdateController,
  isDeferred,
  publicState,
  writeReminder,
};
