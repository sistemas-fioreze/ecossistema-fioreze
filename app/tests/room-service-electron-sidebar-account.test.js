import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appEntry = fs.readFileSync(new URL("../public/js/modules/room-service-erp/app.js", import.meta.url), "utf8");
const accountModule = fs.readFileSync(new URL("../public/js/modules/room-service-erp/sidebar-account.js", import.meta.url), "utf8");
const accountCss = fs.readFileSync(new URL("../public/css/modules/room-service-erp/sidebar-account.css", import.meta.url), "utf8");
const accountAvatarCss = fs.readFileSync(new URL("../public/css/modules/room-service-erp/sidebar-account-avatar.css", import.meta.url), "utf8");
const accountLayoutCss = fs.readFileSync(new URL("../public/css/modules/room-service-erp/sidebar-account-layout-v2.css", import.meta.url), "utf8");
const rangeCss = fs.readFileSync(new URL("../public/css/modules/room-service-erp/sidebar-account-range.css", import.meta.url), "utf8");

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

test("sidebar account is round, white and collapses to avatar-only mode", () => {
  assert.match(accountCss, /\.sidebar-account-avatar[\s\S]*border-radius:\s*50%/);
  assert.match(accountCss, /\.sidebar-account-photo[\s\S]*border-radius:\s*50%/);
  assert.match(accountModule, /sidebar-account-avatar\.css\?v=20260819-1/);
  assert.match(accountAvatarCss, /\.sidebar-account-avatar[\s\S]*background:\s*#ffffff !important/);
  assert.match(accountAvatarCss, /\.sidebar-account-avatar[\s\S]*color:\s*#56616d !important/);
  assert.match(accountCss, /sidebar-collapsed \.sidebar-account-copy[\s\S]*sidebar-account-logout[\s\S]*display:\s*none/);
});

test("expanded sidebar account menu aligns above the user row while collapsed mode remains lateral", () => {
  assert.match(accountCss, /\.sidebar-footer > \.account-popover[\s\S]*left:\s*calc\(100% \+ 7px\)[\s\S]*width:\s*284px/);
  assert.match(accountLayoutCss, /:not\(\.sidebar-collapsed\) \.sidebar-footer > \.account-popover[\s\S]*left:\s*0 !important/);
  assert.match(accountLayoutCss, /bottom:\s*calc\(100% \+ 8px\) !important/);
  assert.match(accountLayoutCss, /width:\s*100% !important/);
  assert.match(accountLayoutCss, /\.account-popover::before[\s\S]*display:\s*none !important/);
  assert.match(accountCss, /\.quick-settings-grid > \.quick-tile:not\(\.hidden\)[\s\S]*min-height:\s*38px/);
  assert.match(accountCss, /\.quick-tile\.logout\s*\{[\s\S]*order:\s*100/);
  assert.doesNotMatch(accountLayoutCss, /font-size:\s*(?:7|7\.5|8|8\.5|9|9\.5|10|10\.5|11|11\.5)px/);
});

test("Electron account removes interface scale from the popover and keeps volume progress", () => {
  assert.match(accountModule, /sidebar-account-layout-v2\.css\?v=20260819-1/);
  assert.match(accountModule, /removeInterfaceScaleControl\(accountPopover\)/);
  assert.match(accountModule, /querySelector\("\.scale-control"\)/);
  assert.match(accountModule, /scaleControl\.remove\(\)/);
  assert.match(accountModule, /setupRangeProgress\(accountPopover\)/);
  assert.match(accountModule, /--range-progress/);
  assert.match(accountModule, /addEventListener\("input", updateProgress\)/);
  assert.match(accountLayoutCss, /\.scale-control[\s\S]*display:\s*none !important/);
  assert.match(rangeCss, /-webkit-appearance:\s*none/);
  assert.match(rangeCss, /::-webkit-slider-runnable-track/);
  assert.match(rangeCss, /height:\s*4px/);
  assert.match(rangeCss, /linear-gradient\(to right, #c2a94b/);
  assert.match(rangeCss, /::-webkit-slider-thumb/);
  assert.match(rangeCss, /width:\s*14px/);
});
