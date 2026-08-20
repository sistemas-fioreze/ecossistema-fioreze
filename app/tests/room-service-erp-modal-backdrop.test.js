import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const appRoot = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(appRoot, relative), "utf8");

test("ERP popups share a blurred full-window backdrop", () => {
  const html = read("public/erp/room-service/index.html");
  const css = read("public/css/modules/room-service-erp/modal-backdrop.css");

  assert.match(html, /modal-backdrop\.css\?v=20260820-1/);
  assert.match(css, /--erp-modal-backdrop-blur:\s*9px/);
  assert.match(css, /-webkit-backdrop-filter:\s*blur\(var\(--erp-modal-backdrop-blur\)\) saturate\(\.9\)/);
  assert.match(css, /backdrop-filter:\s*blur\(var\(--erp-modal-backdrop-blur\)\) saturate\(\.9\)/);
  for (const selector of [
    ".erp-modal",
    ".erp-user-modal",
    ".erp-help-overlay",
    ".desktop-update-modal",
    "#orderModal",
    "#printManagerModal",
    "#confirmModal",
    "#cardapioModal",
  ]) {
    assert.ok(css.includes(selector), `${selector} deve usar o backdrop compartilhado`);
  }
  assert.doesNotMatch(css, /#loginOverlay/);
});

test("Electron modal backdrop includes and blocks the custom titlebar", () => {
  const css = read("public/css/modules/room-service-erp/modal-backdrop.css");

  assert.match(css, /data-fioreze-desktop="electron"/);
  assert.match(css, /inset:\s*0 !important/);
  assert.match(css, /padding-top:\s*calc\(var\(--erp-desktop-titlebar-height, 44px\) \+ 18px\) !important/);
  assert.match(css, /:has\([\s\S]*?:not\(\.hidden\):not\(\[hidden\]\)[\s\S]*?\) \.rs-desktop-titlebar/);
  assert.match(css, /\.rs-desktop-titlebar \{[\s\S]*?z-index:\s*200 !important;[\s\S]*?pointer-events:\s*none/);
});
