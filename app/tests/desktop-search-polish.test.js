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
  const search = read("public/css/modules/room-service-erp/desktop-search-polish.css");

  assert.match(typography, /^@import url\("\.\/desktop-search-polish\.css\?v=20260819-1"\);/);
  assert.match(search, /data-fioreze-desktop="electron"/);
  assert.match(search, /\.rs-desktop-workspace \.top-search-box \{/);
  assert.match(search, /height: 40px !important/);
  assert.match(search, /background: #ffffff !important/);
  assert.match(search, /\.top-search-box kbd \{/);
  assert.match(search, /font-size: 10px !important/);
  assert.match(search, /\.top-search-results \{/);
  assert.match(search, /width: 100% !important/);
  assert.match(search, /top: calc\(100% \+ 7px\) !important/);
  assert.match(search, /box-shadow: 0 16px 40px rgba\(25, 32, 40, 0\.12\) !important/);
  assert.match(search, /scrollbar-width: thin/);
  assert.match(search, /\.top-search-item\.active/);
});
