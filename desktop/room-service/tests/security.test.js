const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("main process keeps Electron hardening enabled", () => {
  const main = read("main.cjs");
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /will-navigate/);
  assert.match(main, /\/erp\/room-service\//);
});

test("preload exposes only the approved desktop bridge", () => {
  const preload = read("preload.cjs");
  assert.match(preload, /contextBridge\.exposeInMainWorld\(\s*"fiorezeDesktop"/);
  for (const key of ["isElectron", "minimize", "toggleMaximize", "close", "platform", "version"]) {
    assert.match(preload, new RegExp(`${key}\\s*:`));
  }
  assert.doesNotMatch(preload, /fs|child_process|exec|spawn|token|password|secret/i);
});

test("wrapper does not include legacy integrations or credentials", () => {
  const runtime = ["main.cjs", "preload.cjs"].map(read).join("\n");
  const docs = read("README.md");
  assert.doesNotMatch(runtime, /script\.google\.com|spreadsheets|apps script|google sheets/i);
  assert.doesNotMatch(`${runtime}\n${docs}`, /private_key|client_email|credenciais\.json|credentials\.json/i);
  assert.doesNotMatch(runtime, /printer|impressora|localhost:\d+\/print/i);
  assert.doesNotMatch(docs, /script\.google\.com\/macros|private_key|client_email/i);
});
