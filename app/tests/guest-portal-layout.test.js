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

test("desktop centraliza header e mostra SVG em todas as guias", () => {
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.portal-app-top \.site-header\s*\{[\s\S]*?margin-right:\s*auto;[\s\S]*?margin-left:\s*auto/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.bottom-nav-shell\s*\{[\s\S]*?width:\s*min\(610px, calc\(100vw - 520px\)\)/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.bottom-nav button svg\s*\{[\s\S]*?display:\s*block/);
  assert.match(portalCss, /@media \(min-width: 960px\) and \(max-width: 1120px\)/);
  assert.equal((portalScript.match(/\["(?:inicio|servicos|eventos|hotel|blog)",/g) || []).length, 5);
});

test("desktop usa a capa sanitizada da unidade como fundo de tela inteira", () => {
  assert.match(portalScript, /branding\?\.cover_image_url/);
  assert.match(portalScript, /sanitizePublicAssetUrl\(bootstrap\.branding\?\.cover_image_url\)/);
  assert.match(portalScript, /const classes = `desktop-unit-cover/);
  assert.match(portalCss, /\.desktop-unit-cover\s*\{\s*display:\s*none/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.desktop-unit-cover\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?width:\s*100vw;[\s\S]*?height:\s*100dvh/);
  assert.match(portalCss, /\.desktop-unit-cover img,[\s\S]*?\.desktop-unit-cover video\s*\{[\s\S]*?object-fit:\s*cover/);
});

test("capa aceita video no desktop e somente na guia inicio do mobile", () => {
  assert.match(portalScript, /branding\?\.cover_media_type === "video"/);
  assert.match(portalScript, /const isMobileHome = !isDesktop && activeTab === "inicio"/);
  assert.match(portalScript, /if \(!isDesktop && !isMobileHome\) return ""/);
  assert.match(portalScript, /isMobileHome \? " is-mobile-home"/);
  assert.match(portalScript, /<video src=.*muted loop playsinline preload="metadata"/);
  assert.match(portalScript, /prefers-reduced-motion: reduce/);
  assert.match(portalCss, /\.desktop-unit-cover img,[\s\S]*?\.desktop-unit-cover video\s*\{[\s\S]*?object-fit:\s*cover/);
  assert.match(portalCss, /@media \(max-width: 959px\)[\s\S]*?\.desktop-unit-cover\.is-mobile-home\s*\{[\s\S]*?display:\s*block;[\s\S]*?height:\s*100dvh/);
  assert.match(portalCss, /\.desktop-unit-cover\.is-mobile-home img,[\s\S]*?\.desktop-unit-cover\.is-mobile-home video\s*\{[\s\S]*?object-fit:\s*cover/);
});

test("inicio mobile usa contraste branco e header com respiro seguro", () => {
  assert.match(portalCss, /@media \(max-width: 959px\)[\s\S]*?\.site-header\s*\{[\s\S]*?padding-top:\s*calc\(10px \+ env\(safe-area-inset-top\)\)/);
  assert.match(portalCss, /@media \(max-width: 959px\)[\s\S]*?\.guest-portal-root:has\(\.desktop-unit-cover\.is-mobile-home\) \.home-hero-copy \.guest-title/);
  assert.match(portalCss, /\.guest-portal-root:has\(\.desktop-unit-cover\.is-mobile-home\) \.home-info-section \.guest-section-heading button\s*\{[\s\S]*?color:\s*#fff/);
  assert.match(portalCss, /\.guest-portal-root:has\(\.desktop-unit-cover\.is-mobile-home\) \.site-header\.is-scrolled\s*\{[\s\S]*?rgba\(18, 13, 10, 0\.46\)/);
});

test("desktop alinha as guias e deixa logo, clima e localizacao sem fundo", () => {
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.site-header,[\s\S]*?background:\s*transparent;[\s\S]*?backdrop-filter:\s*none/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.brand-logo-img\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.header-weather,[\s\S]*?\.header-location-button\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.bottom-nav-shell\s*\{[\s\S]*?top:\s*24px;[\s\S]*?height:\s*64px;[\s\S]*?align-items:\s*center/);
  assert.match(portalCss, /\.bottom-nav\s*\{[\s\S]*?height:\s*64px;[\s\S]*?padding:\s*9px 4px/);
  assert.match(portalScript, /class="header-location-label">Como Chegar<\/span>/);
  assert.match(portalCss, /\.guest-portal-root:has\(\.desktop-unit-cover\) \.desktop-unit-cover::after\s*\{[\s\S]*?rgba\(14, 11, 9, 0\.68\)/);
  assert.match(portalCss, /\.guest-portal-root:has\(\.desktop-unit-cover\) \.home-hero-copy \.guest-title/);
  assert.match(portalCss, /\.guest-portal-root:has\(\.desktop-unit-cover\) \.home-services-section > \.guest-section-title/);
  assert.match(portalCss, /\.guest-portal-root:has\(\.desktop-unit-cover\) \.home-info-section \.guest-section-heading button/);
  assert.match(portalCss, /\.guest-portal-root:has\(\.desktop-unit-cover\) \.app-top-card > p\s*\{[\s\S]*?color:\s*#fff/);
});

test("hero desktop separa a saudacao do nome da unidade", () => {
  assert.match(portalScript, /class="guest-title-welcome">Bem-vindo ao<\/span>/);
  assert.match(portalScript, /class="guest-title-unit">/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.guest-title-welcome\s*\{[\s\S]*?font-size:\s*clamp\(2\.15rem, 3\.15vw, 3\.2rem\)/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.guest-title-unit\s*\{[\s\S]*?font-size:\s*clamp\(3\.65rem, 6vw, 5\.8rem\)/);
});

test("inicio desktop herda o fundo do topo e usa imagens configuradas nos servicos", () => {
  assert.match(portalScript, /sanitizePublicAssetUrl\(module\.background_image_url\)/);
  assert.match(portalScript, /class="quick-card\$\{imageUrl \? " has-desktop-image" : ""\}"/);
  assert.match(portalScript, /class="quick-card-media"/);
  assert.match(portalCss, /\.quick-card-media\s*\{[\s\S]*?display:\s*none/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.quick-card\.has-desktop-image \.quick-card-media\s*\{[\s\S]*?display:\s*block/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.guest-shell:has\(\.home-hero-copy\)::before\s*\{[\s\S]*?rgba\(14, 11, 9, 0\.48\)/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.home-info-section\s*\{\s*display:\s*none/);
});

test("central permite escolher imagem ou video da biblioteca para a identidade", () => {
  assert.match(adminScript, /allowVideo = fieldName === "cover_image_url"/);
  assert.match(adminScript, /renderIdentityMediaOption/);
  assert.match(adminScript, /name="media_asset_id"/);
  assert.match(adminScript, /String\(asset\.mime_type \|\| ""\)\.startsWith\("video\/"\)/);
  assert.match(adminScript, /Capa do portal \(imagem ou video\)/);
  assert.doesNotMatch(adminScript, /const selected = assets\[0\]/);
});

test("eventos abrem em dialogo no desktop e preservam o detalhe movel", () => {
  assert.match(portalScript, /isDesktopPortal\(\)/);
  assert.match(portalScript, /class="desktop-event-context" aria-hidden="true" inert/);
  assert.match(portalScript, /class="desktop-event-dialog-backdrop" data-event-dialog role="dialog" aria-modal="true"/);
  assert.match(portalScript, /event\.key === "Escape"/);
  assert.match(portalScript, /event\.target\.matches\("\[data-event-dialog\]"\)/);
  assert.match(portalScript, /class="portal-detail-view"/);
  assert.match(portalCss, /@media \(min-width: 960px\)[\s\S]*?\.desktop-event-dialog-backdrop\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?backdrop-filter:\s*blur\(5px\)/);
  assert.match(portalCss, /\.desktop-event-dialog-backdrop \.portal-detail-view\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 128px\)/);
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
