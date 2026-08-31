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

  assert.match(format, /import "\.\/short-links-popups\.js"/);
  assert.match(popups, /typeof document !== "undefined"/);
  assert.match(popups, /document\.createElement\("dialog"\)/);
  assert.match(popups, /showModal/);
  assert.match(popups, /::backdrop/);
  assert.match(popups, /data-short-link-popup-mode/);
});

test("shortened links expose dedicated popup modes for view edit metrics QR and sharing", () => {
  const popups = read("public/js/modules/admin/shared/short-links-popups.js");

  assert.match(popups, /label: "Visualizar"/);
  assert.match(popups, /label: "Métricas"/);
  assert.match(popups, /label\.textContent = "Editar"/);
  assert.match(popups, /"edit", "view", "metrics", "qr", "share"/);
  assert.match(popups, /title\.textContent = "Métricas do link"/);
  assert.match(popups, /title\.textContent = "Visualizar link"/);
  assert.match(popups, /manager\.hidden && !editor\.hidden/);
});
