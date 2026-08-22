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

test("Central Administrativa points ERP and Suite downloads to the unified internal center", () => {
  const downloads = read("public/js/modules/admin/shared/admin-downloads.js");
  const selectPicker = read("public/js/modules/admin/shared/admin-select-picker.js");

  assert.match(selectPicker, /installAdminDownloads\(root\)/);
  assert.match(downloads, /data-admin-downloads-card/);
  assert.match(downloads, /\/internal\/download/);
  assert.match(downloads, /\/internal\/download\/erp/);
  assert.match(downloads, /\/internal\/download\/suite/);
  assert.doesNotMatch(downloads, /\/downloads\/erp\/(?:installer|download)/);
  assert.doesNotMatch(downloads, /\/downloads\/print-agent\/(?:installer|download)/);
  assert.match(downloads, /Fioreze ERP/);
  assert.match(downloads, /Fioreze Suite/);
});
