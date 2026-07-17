import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const portalScript = fs.readFileSync(new URL("../public/js/core/portal-home.js", import.meta.url), "utf8");
const portalCss = fs.readFileSync(
  new URL("../public/css/modules/guest-portal/guest-portal.css", import.meta.url),
  "utf8",
);
const publicIndex = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

test("portal usa o layout de referencia com identidade e conteudo dinamicos", () => {
  assert.match(portalScript, /branding\.horizontal_logo_url/);
  assert.match(portalScript, /bootstrap\.modules\.filter/);
  assert.match(portalScript, /bootstrap\.settings/);
  assert.match(portalScript, /\["inicio", "Início", "home"\]/);
  assert.match(portalScript, /Informações do hotel/);
  assert.match(portalCss, /\.featured-home-card/);
  assert.match(portalCss, /\.bottom-nav-shell/);
  assert.match(portalCss, /@media \(min-width: 960px\)/);
  assert.match(publicIndex, /guest-portal\/guest-portal\.css/);
});

test("portal nao incorpora dependencias nem endpoints do sistema legado", () => {
  assert.doesNotMatch(portalScript, /script\.google\.com/i);
  assert.doesNotMatch(portalScript, /docs\.google\.com/i);
  assert.doesNotMatch(portalScript, /tailwindcss/i);
  assert.doesNotMatch(portalScript, /Müller|Fioreze Centro|postimg/i);
});

test("portal limita imagens dinamicas aos assets publicos da plataforma", () => {
  assert.match(portalScript, /sanitizePublicAssetUrl/);
  assert.doesNotMatch(portalScript, /background-image:\s*url\(/i);
});
