import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { HELP_ARTICLES, HELP_CATEGORIES } from "../public/js/modules/room-service-erp/help-content.js";
import { canAccessHelpArticle } from "../public/js/modules/room-service-erp/help.js";

const appRoot = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(appRoot, relative), "utf8");

test("Help Center documents only the audited Room Service ERP modules", () => {
  assert.deepEqual(HELP_CATEGORIES.map(({ id }) => id), [
    "getting-started", "dashboard", "pdv", "orders", "guests", "billing", "catalog", "operation", "printing", "settings",
  ]);
  assert.ok(HELP_ARTICLES.length >= 18);
  assert.ok(HELP_ARTICLES.some((article) => article.title === "Primeiros passos no ERP"));
  assert.ok(HELP_ARTICLES.every((article) => article.steps.length >= 3));
  assert.ok(HELP_ARTICLES.every((article) => article.relatedRoutes.length >= 1));
  assert.equal(new Set(HELP_ARTICLES.map((article) => article.id)).size, HELP_ARTICLES.length);
});

test("Help articles respect ERP permissions and platform", () => {
  const catalog = HELP_ARTICLES.find((article) => article.id === "catalog-manage-products");
  const updates = HELP_ARTICLES.find((article) => article.id === "desktop-updates");
  assert.equal(canAccessHelpArticle(catalog, { permissions: [] }), false);
  assert.equal(canAccessHelpArticle(catalog, { permissions: ["room-service.catalog.manage"] }), true);
  assert.equal(canAccessHelpArticle(catalog, { permissions: [], isMaster: true }), true);
  assert.equal(canAccessHelpArticle(updates, { isElectron: false }), false);
  assert.equal(canAccessHelpArticle(updates, { isElectron: true }), true);
});

test("Help Center omits internal search and browser-like navigation", () => {
  const help = read("public/js/modules/room-service-erp/help.js");
  const css = read("public/css/modules/room-service-erp/help-center.css");

  assert.doesNotMatch(help, /erpHelpSearch|Pesquisar na ajuda|Ctrl K/);
  assert.doesNotMatch(help, /erp-help-history|data-help-action="forward"|data-help-action="home"/);
  assert.doesNotMatch(help, /<small>ERP Fioreze<\/small>/);
  assert.match(help, /erp-help-contextual/);
  assert.match(help, /data-help-action="back"/);
  assert.doesNotMatch(css, /\.erp-help-search|\.erp-help-history/);
});

test("Help Center is integrated once into the shared web and Electron ERP shell", () => {
  const html = read("public/erp/room-service/index.html");
  const app = read("public/js/modules/room-service-erp/legacy-app.js");
  const entry = read("public/js/modules/room-service-erp/app.js");
  const help = read("public/js/modules/room-service-erp/help.js");
  const css = read("public/css/modules/room-service-erp/help-center.css");

  assert.match(html, /help-center\.css\?v=20260820-5/);
  assert.match(html, /app\.js\?v=20260820-7/);
  assert.match(entry, /legacy-app\.js\?v=20260820-6/);
  assert.match(app, /setupHelpCenter/);
  assert.match(app, /getPermissions: \(\) => state\.session\?\.permissions/);
  assert.match(app, /isElectron: \(\) => desktop\.isElectron/);
  assert.match(app, /helpCenter\.closeIfOpen\(\)/);
  assert.match(help, /id = "erpHelpButton"/);
  assert.match(help, /iconMarkup\("circle-help"\)/);
  assert.match(help, /role="dialog" aria-modal="true"/);
  assert.match(help, /data-help-action="context"/);
  assert.match(help, /erp-help-contextual/);
  assert.match(help, /data-help-action="back"/);
  assert.match(help, /loading="lazy" decoding="async"/);
  assert.match(help, /event\.key === "Escape"/);
  assert.doesNotMatch(help, /erpHelpSearch|Pesquisar na ajuda|Ctrl K|erp-help-history|data-help-action="forward"/);
  assert.doesNotMatch(help, /<small>ERP Fioreze<\/small>/);
  assert.match(css, /data-fioreze-desktop="electron"/);
  assert.match(css, /height: 56px/);
  assert.doesNotMatch(css, /\.erp-help-search|\.erp-help-history/);
  assert.match(css, /@media \(max-width: 780px\)/);
  assert.match(css, /@media \(max-width: 580px\)/);
});

test("Help screenshots are real local and consistently sized JPEG assets without external loading", () => {
  const source = read("public/js/modules/room-service-erp/help-content.js");
  const help = read("public/js/modules/room-service-erp/help.js");
  const expected = ["dashboard.jpg", "pdv.jpg", "billing.jpg", "catalog.jpg"];
  const sizes = [];
  for (const name of expected) {
    const file = path.join(appRoot, "public/assets/help/room-service-erp", name);
    const data = fs.readFileSync(file);
    assert.ok(data.length > 50_000, `${name} deve preservar qualidade visual`);
    assert.equal(data[0], 0xff);
    assert.equal(data[1], 0xd8);
    const dimensions = jpegDimensions(data);
    assert.ok(dimensions.width >= 1200);
    sizes.push(`${dimensions.width}x${dimensions.height}`);
  }
  assert.deepEqual([...new Set(sizes)], ["1280x720"]);
  assert.doesNotMatch(source, /https?:\/\//);
  assert.doesNotMatch(source, /Wesley|telefone|password|token/i);
  assert.doesNotMatch(help, /fonts\.googleapis|fonts\.gstatic/);
});

function jpegDimensions(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error("JPEG inválido");
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("Dimensões JPEG não encontradas");
}
