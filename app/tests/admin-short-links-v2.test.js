import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Links e QR Codes V2 reduz densidade e preserva ações existentes", async () => {
  const entry = await readFile(new URL("../public/js/modules/admin/admin-totp.js", import.meta.url), "utf8");
  const module = await readFile(new URL("../public/js/modules/admin/admin-short-links-v2.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/css/modules/admin/admin-short-links-v2.css", import.meta.url), "utf8");

  assert.match(entry, /admin-short-links-v2\.js\?v=20260903-1/);
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

  assert.match(css, /#shortLinksManager\[data-links-design="v2"\]/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: 44px minmax\(0, 1fr\) minmax\(180px, 220px\) auto/);
  assert.match(css, /\.admin-links-filter-button[\s\S]*display: none !important/);
  assert.match(css, /\.admin-links-overflow-menu/);
  assert.match(css, /button\[data-link-action="edit"\]/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.doesNotMatch(css, /@import\s+url/i);
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|1[01])px/);
  assert.doesNotMatch(css, /font-weight:\s*(?:[1-9][1-9][0-9]|[1-9][0-9][1-9])/);
});
