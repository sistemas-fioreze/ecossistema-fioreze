import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Links e QR Codes V2 reduz densidade e preserva ações existentes", async () => {
  const entry = await readFile(new URL("../public/js/modules/admin/admin-totp.js", import.meta.url), "utf8");
  const module = await readFile(new URL("../public/js/modules/admin/admin-short-links-v2.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/css/modules/admin/admin-short-links-v2.css", import.meta.url), "utf8");
  const canvasCss = await readFile(new URL("../public/css/modules/admin/admin-short-links-canvas.css", import.meta.url), "utf8");

  assert.match(entry, /admin-short-links-v2\.js\?v=20260903-2/);
  assert.match(module, /shortLinksManager/);
  assert.match(module, /dataset\.linksDesign = "v2"/);
  assert.match(module, /SECONDARY_ACTIONS = new Set\(\["share", "toggle", "archive", "delete"\]\)/);
  assert.match(module, /admin-links-overflow-trigger/);
  assert.match(module, /menu\.append\(button\)/);
  assert.match(module, /dataset\.linksSummaryFilter/);
  assert.match(module, /status\.dispatchEvent\(new Event\("change"/);
  assert.match(module, /shortLinksFilters/);
  assert.match(module, /requestSubmit\(\)/);
  assert.match(module, /MutationObserver/);
  assert.match(module, /admin-short-links-canvas\.css\?v=20260903-1/);
  assert.match(module, /data-admin-short-links-canvas/);

  assert.match(css, /#shortLinksManager\[data-links-design="v2"\]/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: 44px minmax\(0, 1fr\) minmax\(180px, 220px\) auto/);
  assert.match(css, /\.admin-links-filter-button[\s\S]*display: none !important/);
  assert.match(css, /\.admin-links-overflow-menu/);
  assert.match(css, /button\[data-link-action="edit"\]/);
  assert.match(css, /@media \(max-width: 820px\)/);

  assert.match(canvasCss, /data-active-portal-section="shortLinksManager"/);
  assert.match(canvasCss, /background: #ffffff !important/);
  assert.match(canvasCss, /#shortLinksManager\[data-links-design="v2"\][\s\S]*min-height: 100%/);
  assert.match(canvasCss, /\.admin-short-links-workspace[\s\S]*background: #ffffff/);
  assert.match(canvasCss, /border-radius: 0 !important/);

  assert.doesNotMatch(`${css}\n${canvasCss}`, /@import\s+url/i);
  assert.doesNotMatch(`${css}\n${canvasCss}`, /font-size:\s*(?:[0-9]|1[01])px/);
  assert.doesNotMatch(`${css}\n${canvasCss}`, /font-weight:\s*(?:[1-9][1-9][0-9]|[1-9][0-9][1-9])/);
});
