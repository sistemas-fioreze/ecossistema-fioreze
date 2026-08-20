import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appEntry = fs.readFileSync(new URL("../public/js/modules/room-service-erp/app.js", import.meta.url), "utf8");
const titlebarModule = fs.readFileSync(new URL("../public/js/modules/room-service-erp/desktop-titlebar-polish.js", import.meta.url), "utf8");

test("Electron ERP removes the refresh button before revealing desktop controls", () => {
  assert.match(appEntry, /setupDesktopTitlebarPolish\(\);\s*setupDesktopControls\(\);/);
  assert.match(titlebarModule, /fiorezeDesktop\?\.isElectron/);
  assert.match(titlebarModule, /getElementById\("desktopReload"\)\?\.remove\(\)/);
});
