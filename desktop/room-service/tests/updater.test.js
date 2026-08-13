const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createUpdateController, isDeferred, writeReminder } = require("../updater.cjs");

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fioreze-updater-"));
  const updater = new EventEmitter();
  updater.setFeedURL = (value) => { updater.feed = value; };
  updater.checkForUpdates = async () => { updater.checked = (updater.checked || 0) + 1; };
  updater.downloadUpdate = async () => { updater.downloaded = (updater.downloaded || 0) + 1; };
  updater.quitAndInstall = (...args) => { updater.installed = args; };
  const handlers = new Map();
  const messages = [];
  const controller = createUpdateController({
    updater,
    app: {
      isPackaged: true,
      getVersion: () => "1.1.7",
      getPath: () => directory,
    },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    getWindow: () => ({ isDestroyed: () => false, webContents: { send: (_channel, state) => messages.push(state) } }),
    assertTrustedSender: () => {},
    scheduleInstall: (callback) => callback(),
  });
  return { directory, updater, handlers, messages, controller };
}

test("update is announced without automatic download", () => {
  const value = fixture();
  value.updater.emit("update-available", { version: "1.1.8", releaseNotes: "Melhorias de estabilidade" });
  assert.equal(value.controller.state().status, "available");
  assert.equal(value.controller.state().availableVersion, "1.1.8");
  assert.equal(value.updater.downloaded, undefined);
  assert.deepEqual(value.updater.feed, { provider: "generic", url: "https://portal.hoteisfioreze.com.br/downloads/erp" });
  fs.rmSync(value.directory, { recursive: true, force: true });
});

test("download starts only after the approved IPC action and then installs", async () => {
  const value = fixture();
  value.updater.emit("update-available", { version: "1.1.8" });
  await value.handlers.get("fioreze:update:download-install")({});
  assert.equal(value.updater.downloaded, 1);
  value.updater.emit("download-progress", { percent: 52.4 });
  assert.equal(value.controller.state().progress, 52);
  value.updater.emit("update-downloaded");
  assert.deepEqual(value.updater.installed, [false, true]);
  fs.rmSync(value.directory, { recursive: true, force: true });
});

test("remind later is local, version-scoped and expires after 24 hours", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fioreze-reminder-"));
  const file = path.join(directory, "update-reminder.json");
  const now = Date.parse("2026-08-13T12:00:00.000Z");
  writeReminder(file, "1.1.8", fs, { now: () => now });
  assert.equal(isDeferred(file, "1.1.8", fs, { now: () => now + 23 * 60 * 60 * 1000 }), true);
  assert.equal(isDeferred(file, "1.1.8", fs, { now: () => now + 25 * 60 * 60 * 1000 }), false);
  assert.equal(isDeferred(file, "1.1.9", fs, { now: () => now }), false);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(file, "utf8"))).sort(), ["remindAfter", "version"]);
  fs.rmSync(directory, { recursive: true, force: true });
});
