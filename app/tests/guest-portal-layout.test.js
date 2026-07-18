import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const portalScript = fs.readFileSync(new URL("../public/js/core/portal-home.js", import.meta.url), "utf8");
const portalCss = fs.readFileSync(
  new URL("../public/css/modules/guest-portal/guest-portal.css", import.meta.url),
  "utf8",
);
const publicIndex = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const appScript = fs.readFileSync(new URL("../public/js/core/app.js", import.meta.url), "utf8");
const adminScript = fs.readFileSync(new URL("../public/js/modules/admin/portals.js", import.meta.url), "utf8");

test("portal usa o layout de referencia com identidade e conteudo dinamicos", () => {
  assert.match(portalScript, /branding\.horizontal_logo_url/);
  assert.doesNotMatch(portalScript, /loading-brand|Carregando portal|renderLoading/);
  assert.match(portalScript, /bootstrap\.modules\.filter/);
  assert.match(portalScript, /bootstrap\.settings/);
  assert.match(portalScript, /\["inicio", "Início", "home"\]/);
  assert.match(portalScript, /Informações do hotel/);
  assert.match(portalCss, /\.featured-home-card/);
  assert.match(portalCss, /\.bottom-nav-shell/);
  assert.match(portalCss, /backdrop-filter:\s*blur\(24px\)\s+saturate\(1\.18\)/);
  assert.match(portalCss, /\.bottom-nav \.nav-slider/);
  assert.match(portalCss, /@media \(min-width: 960px\)/);
  assert.match(publicIndex, /guest-portal\/guest-portal\.css/);
});

test("portal integra clima, blog, eventos ilustrados e capas dos servicos", () => {
  assert.match(portalScript, /\/portal\/weather/);
  assert.match(portalScript, /\/portal\/blog/);
  assert.match(portalScript, /event\.image_url/);
  assert.match(portalScript, /data-event-open/);
  assert.match(portalScript, /renderEventDetail/);
  assert.match(portalScript, /module\.background_image_url/);
  assert.match(portalScript, /home-landscape-media/);
  assert.match(portalScript, /renderMonthCalendar/);
  assert.match(portalScript, /renderStayCalendar/);
  assert.match(portalScript, /portal-detail-view/);
  assert.match(portalScript, /event-detail-aside/);
  assert.match(portalScript, /weather-now-temp/);
  assert.match(portalScript, /detail-action-button/);
  assert.match(portalScript, /event\.action_url/);
  assert.doesNotMatch(portalScript, /class="header-time"/);
  assert.match(portalCss, /\.event-title-controls/);
  assert.match(portalCss, /\.event-blog-card/);
  assert.match(portalCss, /\.month-calendar-card/);
  assert.match(portalCss, /\.event-detail-layout/);
  assert.match(portalCss, /@keyframes portal-nav-slide/);
  assert.match(portalCss, /\.bottom-nav\.is-changing \.nav-slider/);
  assert.match(portalCss, /@media \(max-width: 959px\)[\s\S]*?\.site-header\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(portalCss, /\.site-header\.is-scrolled\s*\{[\s\S]*?backdrop-filter:\s*blur\(22px\)/);
  assert.match(portalCss, /@media \(max-width: 959px\)[\s\S]*?\.site-header\s*\{[\s\S]*?border:\s*0;[\s\S]*?box-shadow:\s*none/);
  assert.match(adminScript, /media_asset_id/);
  assert.match(adminScript, /background_media_asset_id/);
  assert.match(adminScript, /portal\.blog_feed_url/);
  assert.match(adminScript, /action_text/);
  assert.match(adminScript, /action_url/);
});

test("portal anima a troca de abas a partir da posicao anterior", () => {
  assert.match(portalScript, /previousTab/);
  assert.match(portalScript, /--nav-from-index/);
  assert.match(portalScript, /portal-tab-transition/);
  assert.match(portalCss, /animation:\s*portal-nav-slide 0\.42s/);
  assert.match(portalCss, /animation:\s*portal-tab-enter 0\.36s/);
});

test("shell abre o portal diretamente sem uma segunda tela de carregamento", () => {
  assert.match(appScript, /document\.createElement\("section"\)/);
  assert.ok(appScript.indexOf("app.replaceChildren(moduleContainer)") < appScript.indexOf("await module.render(moduleContainer"));
  assert.match(publicIndex, /<main id="app" class="app-shell" aria-live="polite"><\/main>/);
  assert.doesNotMatch(publicIndex, /loader-screen|Carregando experiência/);
  assert.doesNotMatch(appScript, /app\.innerHTML\s*=\s*moduleLoader[\s\S]*renderGuestPortalHome/);
  assert.doesNotMatch(portalScript, /loading-screen|Carregando portal/);
  assert.ok(portalScript.indexOf("renderPortal(container, state)") < portalScript.indexOf("await Promise.all"));
});

test("header movel ganha blur somente depois da rolagem", () => {
  assert.match(portalScript, /syncHeaderScroll/);
  assert.match(portalScript, /window\.scrollY > 8/);
  assert.match(portalScript, /addEventListener\("scroll"/);
  assert.match(portalScript, /removeEventListener\("scroll"/);
  assert.match(portalCss, /background:\s*transparent/);
  assert.match(portalCss, /\.site-header\.is-scrolled/);
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
