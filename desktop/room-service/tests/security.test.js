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
  assert.match(main, /frame:\s*false/);
  assert.match(main, /loadFile\(path\.join\(__dirname, "unconfigured\.html"\)\)/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /will-navigate/);
  assert.match(main, /\/erp\/room-service\//);
});

test("desktop window stays inside the active monitor work area", () => {
  const main = read("main.cjs");
  assert.match(main, /screen\.getDisplayNearestPoint\(screen\.getCursorScreenPoint\(\)\)/);
  assert.match(main, /Math\.min\(1280, workArea\.width\)/);
  assert.match(main, /Math\.min\(820, workArea\.height\)/);
  assert.match(main, /workArea\.y \+ Math\.floor\(\(workArea\.height - height\) \/ 2\)/);
  assert.match(main, /minHeight: Math\.min\(680, workArea\.height\)/);
});

test("unconfigured window keeps local controls and does not embed remote code", () => {
  const page = read("unconfigured.html");
  assert.match(page, /fiorezeDesktop\.minimize/);
  assert.match(page, /fiorezeDesktop\.toggleMaximize/);
  assert.match(page, /fiorezeDesktop\.close/);
  assert.doesNotMatch(page, /<script[^>]+src=|https?:\/\//i);
});

test("preload exposes only the approved desktop bridge", () => {
  const preload = read("preload.cjs");
  assert.match(preload, /contextBridge\.exposeInMainWorld\(\s*"fiorezeDesktop"/);
  for (const key of ["isElectron", "minimize", "toggleMaximize", "close", "reload", "getWindowState", "getPrintAgentStatus", "restartPrintAgent", "openPrintManager", "platform", "version"]) {
    assert.match(preload, new RegExp(`${key}\\s*:`));
  }
  assert.doesNotMatch(preload, /fs|child_process|exec|spawn|token|password|secret/i);
});

test("wrapper does not include legacy integrations or credentials", () => {
  const runtime = ["main.cjs", "preload.cjs"].map(read).join("\n");
  const docs = read("README.md");
  assert.doesNotMatch(runtime, /script\.google\.com|spreadsheets|apps script|google sheets/i);
  assert.doesNotMatch(`${runtime}\n${docs}`, /private_key|client_email|credenciais\.json|credentials\.json/i);
  assert.doesNotMatch(runtime, /localhost:\d+\/print|print_raw|win32print|lpstat/i);
  assert.doesNotMatch(docs, /script\.google\.com\/macros|private_key|client_email/i);
});

test("local print integration exposes fixed actions instead of arbitrary execution", () => {
  const main = read("main.cjs");
  const runtime = read("runtime.cjs");
  assert.match(main, /fioreze:print-agent:status/);
  assert.match(main, /fioreze:print-agent:restart/);
  assert.match(main, /fioreze:print-agent:open/);
  assert.match(runtime, /Fioreze-Suite\.exe/);
  assert.match(runtime, /show\.request/);
  assert.match(runtime, /shell:\s*false/);
  assert.doesNotMatch(runtime, /exec\(|execFile\(|shell:\s*true|cmd\.exe|powershell/i);
});
