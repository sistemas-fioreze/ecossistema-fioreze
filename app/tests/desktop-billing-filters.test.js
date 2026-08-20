import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appEntry = fs.readFileSync(new URL("../public/js/modules/room-service-erp/app.js", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(new URL("../public/js/modules/room-service-erp/desktop-billing-filters.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/css/modules/room-service-erp/desktop-billing-filters.css", import.meta.url), "utf8");

test("Electron billing toolbar is wired without changing the browser ERP", () => {
  assert.match(appEntry, /setupDesktopBillingFilters/);
  assert.match(moduleSource, /fiorezeDesktop\?\.isElectron/);
  assert.match(moduleSource, /querySelector\("\.erp-billing-filters"\)/);
  assert.match(moduleSource, /enhanceDateField\(root, filters\.querySelector\("#histFrom"\), "De"\)/);
  assert.match(moduleSource, /enhanceDateField\(root, filters\.querySelector\("#histTo"\), "Até"\)/);
  assert.match(css, /data-fioreze-desktop="electron"/);
});

test("Electron billing dates and actions share a compact desktop control height", () => {
  assert.match(css, /\.erp-billing-date-input[\s\S]*height:\s*40px !important/);
  assert.match(css, /\.erp-billing-date-input[\s\S]*width:\s*142px !important/);
  assert.match(css, /\.erp-billing-date-input[\s\S]*border-radius:\s*8px !important/);
  assert.match(css, /\.erp-billing-toolbar-action[\s\S]*height:\s*40px !important/);
  assert.match(css, /border-color:\s*#c2a94b !important/);
  assert.match(css, /::-webkit-calendar-picker-indicator/);
});

test("Electron billing polish respects ERP stylesheet guardrails", () => {
  assert.doesNotMatch(css, /@import\s+url\(/);
  assert.doesNotMatch(css, /font-weight:\s*(?:450|520|550|620|650|680|7\d{2}|8\d{2}|9\d{2})(?:\s|;|!)/);
  assert.doesNotMatch(css, /font-size:\s*(?:7|7\.5|8|8\.5|9|9\.5|10|10\.5|11|11\.5)px/);
});
