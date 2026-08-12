import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd(), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ERP Room Service exposes desktop controls only through the adapter", () => {
  const html = read("app/public/erp/room-service/index.html");
  const app = read("app/public/js/modules/room-service-erp/app.js");
  const adapter = read("app/public/js/modules/room-service-erp/desktop-adapter.js");
  const css = [
    read("app/public/css/modules/room-service-erp/shell.css"),
    read("app/public/css/modules/room-service-erp/design-system-v5.css"),
  ].join("\n");

  assert.match(html, /rs-window-controls/);
  assert.match(html, /desktopMinimize/);
  assert.match(app, /setupDesktopControls\(\)/);
  assert.match(adapter, /window\.fiorezeDesktop/);
  assert.match(adapter, /dataset\.fiorezeDesktop = "browser"/);
  assert.match(adapter, /dataset\.fiorezeDesktop = "electron"/);
  assert.match(adapter, /dataset\.windowMaterial = material/);
  assert.match(adapter, /dataset\.windowControls = controlMode/);
  assert.match(adapter, /getWindowAppearance/);
  assert.match(css, /body\[data-fioreze-desktop="electron"\] \.rs-window-controls/);
  assert.match(html, /rs-desktop-titlebar/);
  assert.match(html, /desktopPrintManager/);
  assert.match(html, /desktopReload/);
  assert.doesNotMatch(html, /rs-desktop-app-mark/);
  assert.match(css, /-webkit-app-region:\s*drag/);
  assert.match(css, /data-window-material="mica"/);
  assert.match(css, /--erp-window-structural-surface:\s*transparent/);
  assert.match(css, /data-window-material="fluent"/);
  assert.match(css, /rgba\(243, 243, 243, \.96\)/);
  assert.match(css, /data-window-controls="native"/);
  assert.doesNotMatch(html, /require\("electron"\)|require\('electron'\)/);
});

test("Electron wrapper is thin, hardened, and does not duplicate backend access", () => {
  const main = read("desktop/room-service/main.cjs");
  const preload = read("desktop/room-service/preload.cjs");
  const windowMaterial = read("desktop/room-service/window-material.cjs");
  const packageJson = JSON.parse(read("desktop/room-service/package.json"));

  assert.equal(packageJson.main, "main.cjs");
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(windowMaterial, /titleBarStyle:\s*"hidden"/);
  assert.match(windowMaterial, /titleBarOverlay/);
  assert.match(windowMaterial, /setBackgroundMaterial/);
  assert.match(main, /\/erp\/room-service\//);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /will-navigate/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\(\s*"fiorezeDesktop"/);
  assert.match(preload, /getWindowAppearance/);
  assert.match(preload, /getPrintAgentStatus/);
  assert.match(preload, /restartPrintAgent/);
  assert.match(preload, /openPrintManager/);
  assert.ok(packageJson.build.files.includes("window-material.cjs"));

  const combined = `${main}\n${preload}`;
  assert.doesNotMatch(combined, /script\.google\.com|spreadsheets|private_key|client_email/i);
  assert.doesNotMatch(combined, /D1|R2|MEDIA_BUCKET|DB\b/);
});

test("ERP printing settings can copy an enrollment code and control the local agent", () => {
  const app = read("app/public/js/modules/room-service-erp/legacy-app.js");
  assert.match(app, /id="copyPrinterEnrollmentCode"/);
  assert.match(app, /navigator\.clipboard\.writeText/);
  assert.match(app, /refreshLocalPrintAgentStatus/);
  assert.match(app, /restartLocalPrintAgent/);
  assert.match(app, /Reiniciar servidor/);
});
