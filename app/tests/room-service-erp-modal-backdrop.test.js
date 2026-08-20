import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const appRoot = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(appRoot, relative), "utf8");

test("ERP popups share a blurred full-window backdrop", () => {
  const html = read("public/erp/room-service/index.html");
  const css = read("public/css/modules/room-service-erp/modal-backdrop.css");

  assert.match(html, /modal-backdrop\.css\?v=20260820-2/);
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
  assert.match(css, /padding:\s*calc\(var\(--erp-desktop-titlebar-height, 44px\) \+ var\(--erp-modal-safe-block\)\) var\(--erp-modal-safe-inline\) var\(--erp-modal-safe-block\) !important/);
  assert.match(css, /:has\([\s\S]*?:not\(\.hidden\):not\(\[hidden\]\)[\s\S]*?\) \.rs-desktop-titlebar/);
  assert.match(css, /\.rs-desktop-titlebar \{[\s\S]*?z-index:\s*200 !important;[\s\S]*?pointer-events:\s*none/);
});

test("ERP operational dialogs use landscape geometry with safe viewport margins", () => {
  const css = read("public/css/modules/room-service-erp/modal-backdrop.css");

  assert.match(css, /--erp-modal-safe-inline:\s*clamp\(18px, 2\.5vw, 40px\)/);
  assert.match(css, /--erp-modal-safe-block:\s*clamp\(18px, 2\.5vh, 28px\)/);
  assert.match(css, /\.erp-modal-card--catalog\s*\{[\s\S]*?width:\s*min\(1180px, 100%\) !important;[\s\S]*?height:\s*min\(680px, 100%\) !important/);
  assert.match(css, /:is\(#confirmModal > div, #customModal > div\)\s*\{[\s\S]*?width:\s*min\(600px, 100%\) !important/);
  assert.match(css, /\.erp-catalog-item-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.08fr\) minmax\(360px, \.92fr\)/);
  assert.match(css, /\.erp-catalog-item-form > \.erp-modal-actions\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?bottom:\s*-20px/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.erp-catalog-item-layout\s*\{[\s\S]*?flex-direction:\s*column/);
});

test("catalog item editor separates fields, media and actions in its landscape shell", () => {
  const script = read("public/js/modules/room-service-erp/legacy-app.js");

  assert.match(script, /erp-modal-card erp-modal-card--catalog/);
  assert.match(script, /id="catalogItemForm" class="erp-form erp-catalog-item-form"/);
  assert.match(script, /class="erp-catalog-item-layout"/);
  assert.match(script, /class="erp-catalog-item-fields"/);
  assert.match(script, /class="erp-catalog-item-media"/);
});
