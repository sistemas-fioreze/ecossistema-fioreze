import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appEntry = fs.readFileSync(new URL("../public/js/modules/room-service-erp/app.js", import.meta.url), "utf8");
const accountModule = fs.readFileSync(new URL("../public/js/modules/room-service-erp/sidebar-account.js", import.meta.url), "utf8");
const accountCss = fs.readFileSync(new URL("../public/css/modules/room-service-erp/sidebar-account.css", import.meta.url), "utf8");

test("Electron ERP moves the signed-in account from the topbar to the sidebar footer", () => {
  assert.match(appEntry, /setupSidebarAccount/);
  assert.match(accountModule, /fiorezeDesktop\?\.isElectron/);
  assert.match(accountModule, /querySelector\("\.top-session"\)/);
  assert.match(accountModule, /querySelector\("\.sidebar-footer"\)/);
  assert.match(accountModule, /footer\.append\(row, accountPopover\)/);
});

test("sidebar account reuses the live user identity and Lucide fallback", () => {
  assert.match(accountModule, /getElementById\("topStaffAvatar"\)/);
  assert.match(accountModule, /getElementById\("activeStaff"\)/);
  assert.match(accountModule, /data-lucide="user-round"/);
  assert.match(accountModule, /data-lucide="log-out"/);
  assert.match(accountModule, /quick-tile\.logout/);
});

test("sidebar account is round and collapses to avatar-only mode", () => {
  assert.match(accountCss, /\.sidebar-account-avatar[\s\S]*border-radius:\s*50%/);
  assert.match(accountCss, /\.sidebar-account-photo[\s\S]*border-radius:\s*50%/);
  assert.match(accountCss, /sidebar-collapsed \.sidebar-account-copy[\s\S]*sidebar-account-logout[\s\S]*display:\s*none/);
});
