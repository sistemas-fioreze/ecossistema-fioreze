import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), "utf8");
}

test("Electron ERP search uses the dedicated desktop polish layer", () => {
  const typography = read("public/css/modules/room-service-erp/typography.css");
  const adapter = read("public/js/modules/room-service-erp/desktop-adapter.js");
  const search = read("public/css/modules/room-service-erp/desktop-search-polish.css");

  assert.doesNotMatch(typography, /desktop-search-polish|@import\s+url/i);
  assert.match(adapter, /installDesktopSearchPolish\(root\)/);
  assert.match(adapter, /desktop-search-polish\.css\?v=20260819-2/);
  assert.match(adapter, /stylesheet\.rel = "stylesheet"/);
  assert.match(search, /data-fioreze-desktop="electron"/);
  assert.match(search, /\.rs-desktop-workspace \.top-search-box \{/);
  assert.match(search, /height: 36px !important/);
  assert.match(search, /background: #ffffff !important/);
  assert.match(search, /\.top-search-box kbd \{/);
  assert.match(search, /height: 20px !important/);
  assert.match(search, /display: inline-flex !important/);
  assert.match(search, /align-items: center !important/);
  assert.match(search, /font-size: 12px !important/);
  assert.match(search, /font-weight: 600 !important/);
  assert.match(search, /\.top-search-results \{/);
  assert.match(search, /width: 100% !important/);
  assert.match(search, /top: calc\(100% \+ 7px\) !important/);
  assert.match(search, /box-shadow: 0 16px 40px rgba\(25, 32, 40, 0\.12\) !important/);
  assert.match(search, /scrollbar-width: thin/);
  assert.match(search, /\.top-search-item\.active/);
  assert.doesNotMatch(search, /font-weight:\s*(?:450|520|550|620|650|680)(?:\s|;|!)/);
  assert.doesNotMatch(search, /font-size:\s*(?:7|7\.5|8|8\.5|9|9\.5|10|10\.5|11|11\.5)px/);
});
