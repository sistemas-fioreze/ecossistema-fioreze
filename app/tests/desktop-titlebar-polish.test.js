import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appEntry = fs.readFileSync(new URL("../public/js/modules/room-service-erp/app.js", import.meta.url), "utf8");
const titlebarModule = fs.readFileSync(new URL("../public/js/modules/room-service-erp/desktop-titlebar-polish.js", import.meta.url), "utf8");
const titlebarCss = fs.readFileSync(new URL("../public/css/modules/room-service-erp/desktop-titlebar-polish.css", import.meta.url), "utf8");

test("Electron ERP removes the refresh button before revealing desktop controls", () => {
  assert.match(appEntry, /setupDesktopTitlebarPolish\(\);\s*setupDesktopControls\(\);/);
  assert.match(appEntry, /desktop-titlebar-polish\.js\?v=20260819-2/);
  assert.match(titlebarModule, /fiorezeDesktop\?\.isElectron/);
  assert.match(titlebarModule, /getElementById\("desktopReload"\)\?\.remove\(\)/);
});

test("maximized ERP centers search on the real window axis", () => {
  assert.match(titlebarModule, /getWindowState/);
  assert.match(titlebarModule, /dataset\.windowMaximized = maximized \? "true" : "false"/);
  assert.match(titlebarModule, /addEventListener\("resize", scheduleWindowStateSync\)/);
  assert.match(titlebarModule, /desktop-titlebar-polish\.css\?v=20260819-2/);
  assert.match(titlebarCss, /data-window-maximized="true"/);
  assert.match(titlebarCss, /\.rs-desktop-workspace \.top-search/);
  assert.match(titlebarCss, /position:\s*fixed !important/);
  assert.match(titlebarCss, /left:\s*50% !important/);
  assert.match(titlebarCss, /transform:\s*translateX\(-50%\) !important/);
  assert.doesNotMatch(titlebarCss, /@media\s*\([^)]*min-width/i);
});
