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

test("shortened links editor is promoted to a native popup workflow", () => {
  const format = read("public/js/modules/admin/shared/format.js");
  const popups = read("public/js/modules/admin/shared/short-links-popups.js");
  const styles = read("public/css/modules/admin/short-links-popup.css");

  assert.match(format, /import "\.\/short-links-popups\.js"/);
  assert.match(popups, /typeof document !== "undefined"/);
  assert.match(popups, /document\.createElement\("dialog"\)/);
  assert.match(popups, /showModal/);
  assert.match(styles, /#adminShortLinksDialog::backdrop/);
  assert.match(popups, /data-short-link-popup-mode/);
});

test("shortened links expose dedicated popup modes for view edit metrics QR and sharing", () => {
  const popups = read("public/js/modules/admin/shared/short-links-popups.js");

  assert.match(popups, /label: "Visualizar"/);
  assert.match(popups, /label: "Métricas"/);
  assert.match(popups, /label\.textContent = "Editar"/);
  assert.match(popups, /\["edit", "view", "metrics", "qr", "share"\]/);
  assert.match(popups, /title\.textContent = "Métricas do link"/);
  assert.match(popups, /title\.textContent = "Visualizar link"/);
  assert.match(popups, /manager\.hidden && !editor\.hidden/);
});

test("shortened links popup uses tabs and a two-column preview layout on wide screens", () => {
  const popups = read("public/js/modules/admin/shared/short-links-popups.js");
  const styles = read("public/css/modules/admin/short-links-popup.css");

  assert.match(popups, /adminShortLinksPopupLayout/);
  assert.match(popups, /shortLinkPopupTabs/);
  assert.match(popups, /shortLinkPopupSummary/);
  assert.match(popups, /Visualização do link/);
  assert.match(popups, /data-popup-tab/);
  assert.match(popups, /syncPopupPresentation/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) 320px/);
  assert.match(styles, /#shortLinkPopupSummary/);
  assert.match(styles, /@media \(max-width: 920px\)/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\);/);
  assert.doesNotMatch(styles, /@import\s/);
});
