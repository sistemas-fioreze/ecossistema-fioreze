import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, "..");
const erpCssRoot = path.join(appRoot, "public", "css", "modules", "room-service-erp");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readFont(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath));
}

function erpStyleSources() {
  const css = fs.readdirSync(erpCssRoot)
    .filter((name) => name.endsWith(".css"))
    .map((name) => fs.readFileSync(path.join(erpCssRoot, name), "utf8"));
  return [read("app/public/erp/room-service/index.html"), ...css].join("\n");
}

test("ERP serves the official Inter variable fonts locally", () => {
  const regular = readFont("app/public/fonts/inter/InterVariable.woff2");
  const italic = readFont("app/public/fonts/inter/InterVariable-Italic.woff2");
  const license = read("app/public/fonts/inter/LICENSE.txt");
  const typography = read("app/public/css/modules/room-service-erp/typography.css");
  const html = read("app/public/erp/room-service/index.html");

  assert.equal(regular.subarray(0, 4).toString("ascii"), "wOF2");
  assert.equal(italic.subarray(0, 4).toString("ascii"), "wOF2");
  assert.match(license, /SIL OPEN FONT LICENSE/i);
  assert.match(typography, /url\("\/fonts\/inter\/InterVariable\.woff2"\)/);
  assert.match(typography, /url\("\/fonts\/inter\/InterVariable-Italic\.woff2"\)/);
  assert.match(typography, /font-weight:\s*100 900/);
  assert.match(typography, /font-display:\s*swap/);
  assert.match(html, /typography\.css\?v=20260814-2/);
  assert.ok(html.indexOf("typography.css") > html.indexOf("design-system-v5.css"));
});

test("ERP uses one operational font token without external or hotel font overrides", () => {
  const sources = erpStyleSources();
  const hotelContext = read("app/public/js/modules/room-service-erp/hotel-context.js");
  const legacyApp = read("app/public/js/modules/room-service-erp/legacy-app.js");
  const typography = read("app/public/css/modules/room-service-erp/typography.css");

  assert.match(typography, /--font-ui:\s*"Inter", Arial, sans-serif/);
  assert.match(typography, /font-family:\s*var\(--font-ui\)\s*!important/);
  assert.doesNotMatch(sources, /fonts\.googleapis|fonts\.gstatic|@import\s+url/i);
  assert.doesNotMatch(sources, /Segoe UI|system-ui|Roboto|Helvetica|Effra|Montserrat|Poppins|Open Sans/i);
  assert.doesNotMatch(hotelContext, /setProperty\("--rs-font-family"/);
  assert.doesNotMatch(legacyApp, /setProperty\("--hotel-font"/);
  assert.match(legacyApp, /removeProperty\("--hotel-font"\)/);
  assert.match(legacyApp, /Inter Variable/);
});

test("ERP typography keeps readable weights, metadata, and tabular numbers", () => {
  const sources = erpStyleSources();
  const typography = read("app/public/css/modules/room-service-erp/typography.css");

  assert.doesNotMatch(sources, /font-weight:\s*(?:7\d{2}|8\d{2}|9\d{2})(?:\s|;|!)/);
  assert.doesNotMatch(sources, /font-weight:\s*(?:450|520|550|620|650|680)(?:\s|;|!)/);
  assert.doesNotMatch(sources, /font-size:\s*(?:7|7\.5|8|8\.5|9|9\.5|10|10\.5)px/);
  assert.match(typography, /--erp-type-body:\s*14px/);
  assert.match(typography, /--erp-type-secondary:\s*13px/);
  assert.match(typography, /--erp-type-meta:\s*12px/);
  assert.match(typography, /--erp-weight-regular:\s*400/);
  assert.match(typography, /--erp-weight-medium:\s*500/);
  assert.match(typography, /--erp-weight-semibold:\s*600/);
  assert.match(typography, /font-variant-numeric:\s*tabular-nums/);
  assert.match(typography, /#appShell :is\(input, textarea, select\)/);
  assert.match(typography, /\.side-nav-btn/);
  assert.match(typography, /table/);
  assert.match(typography, /\[role="tooltip"\]/);
  assert.match(typography, /\[role="dialog"\]/);
});

test("Inter typography preserves the ERP Lucide icon system", () => {
  const html = read("app/public/erp/room-service/index.html");
  const iconSystem = read("app/public/js/modules/room-service-erp/icon-system.js");

  assert.match(html, /lucide-erp\.min\.js\?v=1\.27\.0/);
  assert.match(iconSystem, /globalThis\.FiorezeLucide/);
  assert.match(iconSystem, /stroke-width/);
});
