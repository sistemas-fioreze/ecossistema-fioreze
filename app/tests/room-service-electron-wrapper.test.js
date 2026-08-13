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
  assert.match(adapter, /--erp-desktop-bottom-inset/);
  assert.match(adapter, /workAreaBottomInset/);
  assert.match(adapter, /dataset\.windowMaterial = "solid"/);
  assert.match(adapter, /dataset\.windowControls = controlMode/);
  assert.match(adapter, /getWindowAppearance/);
  assert.match(css, /body\[data-fioreze-desktop="electron"\] \.rs-window-controls/);
  assert.match(css, /--erp-desktop-titlebar-height:\s*44px/);
  assert.match(css, /padding-top:\s*var\(--erp-desktop-titlebar-height/);
  assert.match(css, /height:\s*calc\(100dvh - var\(--erp-desktop-titlebar-height/);
  assert.match(css, /#loginOverlay[^}]*top:\s*var\(--erp-desktop-titlebar-height/s);
  assert.match(html, /rs-desktop-titlebar/);
  assert.match(html, /desktopPrintManager/);
  assert.match(html, /desktopReload/);
  assert.doesNotMatch(html, /rs-desktop-app-mark/);
  assert.match(css, /-webkit-app-region:\s*drag/);
  assert.match(css, /:is\(\.rs-desktop-titlebar, \.app-sidebar\) \{[\s\S]*background:\s*#f7f8fa/);
  assert.match(css, /\.app-main \{[\s\S]*border-top:\s*1px solid var\(--erp-line\)[\s\S]*border-left:\s*1px solid var\(--erp-line\)[\s\S]*border-top-left-radius:\s*14px/);
  assert.match(css, /\.rs-desktop-titlebar::after \{\s*content:\s*none;/);
  assert.doesNotMatch(css, /data-window-material="mica"|data-window-material="fluent"/);
  assert.match(css, /data-window-controls="native"/);
  assert.doesNotMatch(html, /require\("electron"\)|require\('electron'\)/);
});

test("Electron wrapper is thin, hardened, and does not duplicate backend access", () => {
  const main = read("desktop/room-service/main.cjs");
  const preload = read("desktop/room-service/preload.cjs");
  const windowChrome = read("desktop/room-service/window-chrome.cjs");
  const packageJson = JSON.parse(read("desktop/room-service/package.json"));

  assert.equal(packageJson.main, "main.cjs");
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(windowChrome, /titleBarStyle:\s*"hidden"/);
  assert.match(windowChrome, /titleBarOverlay/);
  assert.match(windowChrome, /WINDOW_CHROME_BACKGROUND\s*=\s*"#f7f8fa"/);
  assert.match(windowChrome, /WINDOW_CHROME_OVERLAY\s*=\s*"#f7f8fa00"/);
  assert.doesNotMatch(windowChrome, /setBackgroundMaterial|mica|fluent/i);
  assert.match(main, /\/erp\/room-service\//);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /will-navigate/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\(\s*"fiorezeDesktop"/);
  assert.match(preload, /getWindowAppearance/);
  assert.match(preload, /getPrintAgentStatus/);
  assert.match(preload, /restartPrintAgent/);
  assert.match(preload, /openPrintManager/);
  assert.ok(packageJson.build.files.includes("window-chrome.cjs"));

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
