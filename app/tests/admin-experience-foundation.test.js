import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

const ADMIN_HTML = [
  ["home", "public/admin/index.html"],
  ["room-service", "public/admin/room-service/index.html"],
  ["portals", "public/admin/portais/index.html"],
];

test("rotas administrativas declaram a secao do shell global", () => {
  for (const [section, path] of ADMIN_HTML) {
    const html = fs.readFileSync(path, "utf8");
    assert.match(html, new RegExp(`data-admin-section="${section}"`));
    assert.match(html, /loginForm/);
    assert.match(html, /logoutButton/);
    assert.doesNotMatch(html, /https:\/\/cdn\.|unpkg\.com|cdnjs\.cloudflare\.com/);
  }
});

test("shell administrativo compartilhado possui navegacao, avatar, ajuda e SVG local", () => {
  const source = fs.readFileSync("public/js/modules/admin/shared/admin-auth-view.js", "utf8");
  assert.match(source, /admin-global-sidebar/);
  assert.match(source, /admin-help-drawer/);
  assert.match(source, /admin-avatar/);
  assert.match(source, /canAccessRoomService/);
  assert.match(source, /canAccessPortals/);
  assert.match(source, /<svg class="admin-svg-icon"/);
  assert.doesNotMatch(source, /https:\/\/|cdn|lucide|fontawesome/i);
});

test("design system administrativo documenta identidade, linguagem e proximas etapas", () => {
  const doc = fs.readFileSync("../docs/arquitetura/ADMIN_DESIGN_SYSTEM.md", "utf8");
  assert.match(doc, /FIOREZE/);
  assert.match(doc, /Unidade/);
  assert.match(doc, /Endereco personalizado/);
  assert.match(doc, /PR 2/);
  assert.match(doc, /PR 3/);
});

test("CSS administrativo contem drawer mobile, ajuda e reduced motion", () => {
  const css = fs.readFileSync("public/css/modules/admin/admin.css", "utf8");
  assert.match(css, /admin-global-sidebar/);
  assert.match(css, /admin-mobile-menu/);
  assert.match(css, /admin-help-drawer/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /backdrop-filter|blur\(/);
});

test("shells administrativos continuam respondendo sem fallback incorreto", async () => {
  const { fetch } = createWorkerTestContext();
  for (const path of ["/admin/", "/admin/room-service/", "/admin/portais/", "/admin/portais/unidades/", "/admin/portais/media/", "/admin/portais/links/"]) {
    const response = await fetch(path, { redirect: "manual" });
    const html = await response.text();
    assert.equal(response.status, 200, path);
    assert.match(html, /loginForm|ordersList|portalsContent|unitsManager|mediaLibrary|shortLinksManager/, path);
    assert.doesNotMatch(html, /"error"|Not Found/, path);
  }
});
