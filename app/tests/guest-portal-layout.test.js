import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { renderGuestNavigation } from "../public/js/core/guest-navigation.js";
import { getModulePath, resolvePortalSwipe } from "../public/js/core/portal-home.js";
import { formatRoomServiceHours } from "../public/js/core/service-hours.js";

const portalScript = fs.readFileSync(new URL("../public/js/core/portal-home.js", import.meta.url), "utf8");
const portalCss = fs.readFileSync(
  new URL("../public/css/modules/guest-portal/guest-portal.css", import.meta.url),
  "utf8",
);
const navigationScript = fs.readFileSync(new URL("../public/js/core/guest-navigation.js", import.meta.url), "utf8");
const navigationCss = fs.readFileSync(
  new URL("../public/css/modules/guest-portal/guest-navigation.css", import.meta.url),
  "utf8",
);
const publicIndex = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const appScript = fs.readFileSync(new URL("../public/js/core/app.js", import.meta.url), "utf8");
const serviceHoursScript = fs.readFileSync(new URL("../public/js/core/service-hours.js", import.meta.url), "utf8");
const themeScript = fs.readFileSync(new URL("../public/js/core/theme.js", import.meta.url), "utf8");
const adminScript = fs.readFileSync(new URL("../public/js/modules/admin/portals.js", import.meta.url), "utf8");
const roomServiceScript = fs.readFileSync(new URL("../public/js/modules/room-service/index.js", import.meta.url), "utf8");
const guestPortalRoutes = fs.readFileSync(new URL("../src/modules/guest-portal/routes.js", import.meta.url), "utf8");
const poolExperienceMigration = fs.readFileSync(
  new URL("../migrations/0036_fioreze_centro_pool_experience.sql", import.meta.url),
  "utf8",
);
const hotelInformationUpdateMigration = fs.readFileSync(
  new URL("../migrations/0039_hotel_guest_information_updates.sql", import.meta.url),
  "utf8",
);
const poolImageUrl = new URL("../public/assets/hotels/fioreze-centro/piscina.jpg", import.meta.url);

test("portal usa o layout de referencia com identidade e conteudo dinamicos", () => {
  assert.match(navigationScript, /branding\?\.horizontal_logo_url/);
  assert.doesNotMatch(portalScript, /loading-brand|Carregando portal|renderLoading/);
  assert.match(portalScript, /bootstrap\.modules\.filter/);
  assert.match(portalScript, /bootstrap\.settings/);
  assert.match(navigationScript, /\["inicio", "InÃ­cio", "home"\]/);
  assert.match(portalScript, /InformaÃ§Ãµes do hotel/);
  assert.match(portalCss, /\.featured-home-card/);
  assert.match(navigationCss, /\.guest-navigation-drawer/);
  assert.match(navigationCss, /backdrop-filter:\s*blur\(26px\)\s+saturate\(1\.14\)/);
  assert.match(portalCss, /@media \(min-width: 960px\)/);
  assert.match(publicIndex, /guest-portal\/guest-portal\.css/);
  assert.match(publicIndex, /guest-portal\/guest-navigation\.css/);
});

test("identidade da unidade controla favicon e escala uniforme da logo", () => {
  assert.match(themeScript, /branding\.favicon_url/);
  assert.match(themeScript, /data-hotel-favicon/);
  assert.match(themeScript, /--header-logo-scale/);
  assert.match(navigationCss, /object-fit:\s*contain/);
  assert.match(navigationCss, /transform:\s*scale\(var\(--header-logo-scale,\s*1\)\)/);
  assert.match(adminScript, /Escala da logo no cabeÃ§alho/);
  assert.match(adminScript, /header_logo_scale/);
});

test("cabecalho usa logo por portal e menu lateral usa identidade independente", () => {
  const html = renderGuestNavigation({
    slug: "hotel-ficticio",
    name: "Hotel FictÃ­cio",
    branding: {
      horizontal_logo_url: "/media/logo-geral",
      emporio_logo_url: "/media/logo-emporio",
      navigation_logo_url: "/media/logo-menu",
    },
    settings: {},
    modules: [{ module_key: "emporio", name: "EmpÃ³rio", enabled: true }],
  }, { activeModule: "emporio" });

  assert.match(html, /class="guest-brand-link"[^]*?src="\/media\/logo-emporio"/);
  assert.match(html, /class="guest-drawer-brand"[^]*?src="\/media\/logo-menu"/);
  assert.match(adminScript, /guest_portal_logo_url/);
  assert.match(adminScript, /room_service_logo_url/);
  assert.match(adminScript, /navigation_logo_url/);
});

test("pesquisa mobile da header encontra portais e encaminha filtros dos catalogos", () => {
  const html = renderGuestNavigation({
    slug: "hotel-ficticio",
    name: "Hotel FictÃ­cio",
    branding: {},
    settings: {},
    modules: [
      { module_key: "guest-portal", name: "Portal", enabled: true },
      { module_key: "room-service", name: "Room Service", enabled: true },
      { module_key: "emporio", name: "EmpÃ³rio", enabled: true },
      { module_key: "spa", name: "Spa", enabled: true },
    ],
  });

  assert.match(html, /data-guest-search-toggle/);
  assert.match(html, /data-guest-search-input/);
  assert.match(html, /Buscar no portal/);
  assert.match(html, /ServiÃ§o da unidade/);
  assert.match(navigationScript, /fioreze:portal-search/);
  assert.match(navigationCss, /\.guest-search-panel:not\(\[hidden\]\)/);
  assert.match(navigationCss, /grid-template-columns:\s*44px minmax\(0,\s*1fr\) 44px/);
  assert.match(navigationCss, /\.guest-search-field input::\x2dwebkit-search-cancel-button\s*\{[\s\S]*?\x2dwebkit-appearance:\s*none/);
  assert.ok(navigationScript.indexOf("data-guest-menu-close") < navigationScript.indexOf("guest-drawer-brand"));
  assert.match(navigationCss, /\.guest-drawer-head\s*\{[\s\S]*?border:\s*0/);
  assert.match(navigationCss, /\.guest-search-panel:not\(\[hidden\]\)\s*\{[\s\S]*?top:\s*0;[\s\S]*?width:\s*100%/);
});

test("cabecalhos mobile nao acumulam espacamento e Emporio compartilha o mesmo fundo", () => {
  const emporioCss = fs.readFileSync(
    new URL("../public/css/modules/emporio/emporio.css", import.meta.url),
    "utf8",
  );

  assert.match(navigationCss, /\.public-module-root \.public-module-heading\s*\{\s*padding-top:\s*0/);
  assert.match(navigationCss, /\.public-module-heading-copy\s*\{[^]*?padding-top:\s*calc\(74px \+ env\(safe-area-inset-top\)\)/);
  assert.match(emporioCss, /\.emporio-root \.public-module-heading,[^]*?background:\s*#fff/);
  assert.match(emporioCss, /@media \(max-width: 959px\)[^]*?\.emporio-search\s*\{\s*display:\s*none/);
});

test("DecoraÃ§Ãµes Especiais preserva titulo dourado proprio e acao solida", () => {
  const romanticScript = fs.readFileSync(
    new URL("../public/js/modules/romantic-packages/index.js", import.meta.url),
    "utf8",
  );
  const romanticCss = fs.readFileSync(
    new URL("../public/css/modules/romantic-packages/romantic-packages.css", import.meta.url),
    "utf8",
  );

  assert.match(appScript, /moduleKey === "romantic-packages" \? "" : renderModuleHeading/);
  assert.match(appScript, /!\["guest-portal", "romantic-packages"\]\.includes\(moduleKey\)/);
  assert.match(romanticScript, /<em>\+ Detalhes<\/em>/);
  assert.match(romanticCss, /\.is-special-decorations \.romantic-packages-heading[^]*?background:\s*var\(--centro-gold\)/);
  assert.match(romanticCss, /\.is-centro-experience \.romantic-package-card-copy em[^]*?background:\s*var\(--centro-gold-deep\)/);
});

test("portal integra blog, eventos ilustrados e capas dos servicos sem clima", () => {
  assert.doesNotMatch(portalScript, /\/portal\/weather|weather|clima/i);
  assert.doesNotMatch(guestPortalRoutes, /portal\/weather|loadPublicWeather|DEFAULT_WEATHER_LOCATION/);
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
  assert.match(portalScript, /detail-action-button/);
  assert.match(portalScript, /event\.action_url/);
  assert.doesNotMatch(portalScript, /class="header-time"/);
  assert.match(portalCss, /\.event-title-controls/);
  assert.match(portalCss, /\.event-blog-card/);
  assert.match(portalCss, /\.month-calendar-card/);
  assert.match(portalCss, /\.event-detail-layout/);
  assert.match(navigationCss, /@media \(max-width: 959px\)[\s\S]*?\.guest-shared-header\.site-header\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(navigationCss, /\.guest-shared-header\.is-scrolled/);
  assert.match(adminScript, /media_asset_id/);
  assert.match(adminScript, /background_media_asset_id/);
  assert.match(adminScript, /portal\.blog_feed_url/);
  assert.match(adminScript, /action_text/);
  assert.match(adminScript, /action_url/);
});

test("portal anima a troca de abas a partir da posicao anterior", () => {
  assert.match(portalScript, /previousTab/);
  assert.match(portalScript, /portal-tab-transition/);
  assert.match(portalCss, /animation:\s*portal-tab-enter 0\.36s/);
});

test("shell abre o portal diretamente sem uma segunda tela de carregamento", () => {
  assert.match(appScript, /document\.createElement\("section"\)/);
  assert.ok(appScript.indexOf("app.replaceChildren(moduleContainer)") < appScript.indexOf("await module.render(moduleContainer"));
  assert.match(publicIndex, /<main id="app" class="app-shell" aria-live="polite"><\/main>/);
  assert.doesNotMatch(publicIndex, /loader-screen|Carregando experiÃªncia/);
  assert.doesNotMatch(appScript, /app\.innerHTML\s*=\s*moduleLoader[\s\S]*renderGuestPortalHome/);
  assert.doesNotMatch(portalScript, /loading-screen|Carregando portal/);
  assert.ok(portalScript.indexOf("renderPortal(container, state)") < portalScript.indexOf("await apiGet"));
  assert.doesNotMatch(appScript, /Carregando modulo/);
  assert.doesNotMatch(roomServiceScript, /Carregando cardÃ¡pio|renderLoading/);
});

test("cabecalhos dos modulos repetem o padrao icone e titulo do Portal do Hospede", () => {
  assert.match(appScript, /has-module-heading/);
  assert.match(appScript, /function renderModuleHeading/);
  assert.match(appScript, /class="app-top-title"/);
  assert.match(appScript, /navigationIcon\(iconName\)/);
  assert.match(appScript, /Seja bem-vindo ao Room Service digital/);
  assert.match(appScript, /Use o ramal nÂ° 9/);
  assert.match(serviceHoursScript, /O Room Service opera diariamente das/);
  assert.doesNotMatch(appScript, /public-module-hero|--module-hero-image|public-module-hero-shade/);
  assert.match(navigationScript, /hideBrand = false/);
  assert.match(navigationScript, /is-brand-hidden/);
  assert.doesNotMatch(navigationCss, /public-module-hero|has-module-hero|--module-hero-image/);
  assert.match(navigationCss, /\.public-module-heading\s*\{[\s\S]*?background:\s*transparent;/);
  assert.match(navigationCss, /\.public-module-heading-copy h1/);
  assert.match(navigationCss, /--header-logo-scale/);
});

test("header movel ganha blur somente depois da rolagem", () => {
  assert.match(portalScript, /syncHeaderScroll/);
  assert.match(navigationScript, /window\.scrollY > 8/);
  assert.match(portalScript, /addEventListener\("scroll"/);
  assert.match(portalScript, /removeEventListener\("scroll"/);
  assert.match(portalCss, /background:\s*transparent/);
  assert.match(navigationCss, /\.guest-shared-header\.is-scrolled/);
});

test("mobile usa menu lateral e remove a navegacao horizontal da tela", () => {
  assert.match(navigationScript, /data-guest-menu-open/);
  assert.match(navigationScript, /data-guest-navigation-drawer/);
  assert.match(navigationScript, /aria-controls="guest-navigation-drawer"/);
  assert.match(navigationCss, /\.guest-navigation-drawer\s*\{[\s\S]*?transform:\s*translateX\(-104%\)/);
  assert.match(navigationCss, /\.guest-navigation-drawer\.is-open\s*\{[\s\S]*?translateX\(0\)/);
  assert.doesNotMatch(portalScript, /bottom-nav|portal-header-nav/);
  assert.match(navigationCss, /@media \(max-width: 959px\)[\s\S]*?\.guest-portal-root \.guest-shell\s*\{[\s\S]*?padding-top:\s*calc\(82px \+ env\(safe-area-inset-top\)\)/);
});

test("desktop centraliza header e mostra SVG em todas as guias", () => {
  assert.match(navigationCss, /@media \(min-width: 960px\)[\s\S]*?\.guest-shared-header\.site-header/);
  assert.match(navigationCss, /\.guest-desktop-nav\s*\{[\s\S]*?display:\s*flex/);
  assert.match(navigationCss, /\.guest-desktop-nav \.guest-nav-item svg/);
  assert.equal((navigationScript.match(/\["(?:inicio|servicos|eventos|hotel|blog)",/g) || []).length, 5);
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
  assert.match(navigationCss, /@media \(max-width: 959px\)[\s\S]*?\.guest-shared-header\.site-header\s*\{[\s\S]*?padding:\s*calc\(10px \+ env\(safe-area-inset-top\)\)/);
  assert.match(portalCss, /@media \(max-width: 959px\)[\s\S]*?\.guest-portal-root:has\(\.desktop-unit-cover\.is-mobile-home\) \.home-hero-copy \.guest-title/);
  assert.match(portalCss, /\.guest-portal-root:has\(\.desktop-unit-cover\.is-mobile-home\) \.home-info-section \.guest-section-heading button\s*\{[\s\S]*?color:\s*#fff/);
  assert.match(portalCss, /\.guest-portal-root:has\(\.desktop-unit-cover\.is-mobile-home\) \.site-header\.is-scrolled\s*\{[\s\S]*?rgba\(18, 13, 10, 0\.46\)/);
});

test("inicio mobile oculta informes e usa servicos com vidro escuro", () => {
  assert.match(portalCss, /@media \(max-width: 95ã›h‘éì¶»§q«^w×××J×œ]ZXÚËXØ\™šİ™\—Ê—Ö×××JØ˜XÚÙÜ›İ[™—Êœ™Ø˜W
NLËL
NÖ×××JØ˜XÚÙ›ÜYš[\—Ê˜›\—
Mœ
HØ]\˜]W
WŒL—
KÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×œ]ZXÚËXØ\™ˆİ™Ë×××J×œ]ZXÚËXØ\™ˆİ›Û™Ë×××J×œ]ZXÚËXØ\™ˆÜ[—Ê—Ö×××JØÛÛÜ—ÊˆÙ™™‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜËĞYYXH
X^]ÚYˆMN\
V×××J×œ]ZXÚËXØ\™ˆÜ[—Ê—Ö×××JÛİ™\™›İÎ—Êš\ÚX›NÖ×××JË]ÙXšÚ][[™KXÛ[\—Ê[œÙ]ÊNÂŸJNÂ‚\İ
œİÚ\HÜš^›Û[[Øš[H]˜[˜ØHH›ÛH[™H\ÈİZX\È‹

HOˆÂˆ\ÜÙ\™\]X[
™\ÛÛ™TÜ[İÚ\JÈXİ]™UXˆš[šXÚ[È‹İ\ˆÌLİ\NˆŒ[™ˆLL[™Nˆ‹\˜][Û“\ÎˆJKœÙ\šXÛÜÈŠNÂˆ\ÜÙ\™\]X[
™\ÛÛ™TÜ[İÚ\JÈXİ]™UXˆ™]™[ÜÈ‹İ\ˆİ\NˆŒ[™ˆÌ[™NˆM\˜][Û“\ÎˆÌJKœÙ\šXÛÜÈŠNÂŸJNÂ‚\İ
œİÚ\H[Øš[H™\ÜZ]H[Z]\ÈH™\Ù\˜HH›ÛYÙ[H™\XØ[‹

HOˆÂˆ\ÜÙ\™\]X[
™\ÛÛ™TÜ[İÚ\JÈXİ]™UXˆš[šXÚ[È‹İ\ˆLİ\NˆŒ[™ˆL[™NˆK\˜][Û“\ÎˆLJKœÙ\šXÛÜÈŠNÂˆ\ÜÙ\™\]X[
™\ÛÛ™TÜ[İÚ\JÈXİ]™UXˆš[šXÚ[È‹İ\ˆİ\NˆŒ[™ˆL[™NˆK\˜][Û“\ÎˆLJK[
NÂˆ\ÜÙ\™\]X[
™\ÛÛ™TÜ[İÚ\JÈXİ]™UXˆ˜›ÙÈ‹İ\ˆLİ\NˆŒ[™ˆ[™NˆK\˜][Û“\ÎˆLJK[
NÂˆ\ÜÙ\™\]X[
™\ÛÛ™TÜ[İÚ\JÈXİ]™UXˆœÙ\šXÛÜÈ‹İ\ˆÌİ\NˆŒ[™ˆÌ[™Nˆ\˜][Û“\ÎˆLJK[
NÂˆ\ÜÙ\™\]X[
™\ÛÛ™TÜ[İÚ\JÈXİ]™UXˆœÙ\šXÛÜÈ‹İ\ˆÌİ\NˆŒ[™ˆŒÌ[™NˆŒK\˜][Û“\ÎˆLJK[
NÂŸJNÂ‚\İ
™Ù\İÈ[Øš[HYÛ›Ü˜HÛÛ›Û\È[\˜]]›ÜÈH\ØHÛÛY[HÈÛÛ]YÈ‹

HOˆÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ÓSĞ’SWÔÕÒTWĞ“ĞÒÑQÔÑSPÕÔ‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ù]™[\™Ù]˜ÛÜÙ\İ×—
SĞ’SWÔÕÒTWĞ“ĞÒÑQÔÑSPÕÔ—
KÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØY]™[\İ[™\—
İXÚİ\‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØY]™[\İ[™\—
İXÚ[™‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØY]™[\İ[™\—
İXÚØ[˜Ù[‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×™İY\İ\Ú[×××JİİXÚXXİ[Û—Êœ[‹^KÊNÂŸJNÂ‚\İ
›˜]™YØXØ[È[Øš[H[[šHXÛÛ™HH^È›È˜]Ù\ˆ‹

HOˆÂˆ\ÜÙ\›X]Ú
˜]šYØ][ÛÜÜË×™İY\İ[˜]‹Z][WÊ—Ö×××JÙ\Ü^N—Êš[›[™KY›^Ö×××JØ[YÛ‹Z][\Î—Ê˜Ù[\Ö×××JÙØ\—ÊŒLÜÊNÂˆ\ÜÙ\›X]Ú
˜]šYØ][ÛÜÜË×™İY\İ[˜]‹Z][Wš\ËXXİ]™WÊ—Ö×××JØÛÛÜ—ÊˆÙ™™‹ÊNÂˆ\ÜÙ\›X]Ú
˜]šYØ][ÛÜÜË×™İY\İ[Y[K]ÙÙÛWÊ‹×××JØ˜XÚÙÜ›İ[™—Ê˜[œÜ\™[ÊNÂŸJNÂ‚\İ
›Y[H]\˜[XÙZ]H[™Èœ˜[˜ÛÈİH™]ÈÜˆÛÛ™šYİ\˜XØ[ÈX›XØH‹

HOˆÂˆÛÛœİYÚH™[™\‘İY\İ˜]šYØ][ÛŠÂˆÛYÎˆšİ[XÛ\›È‹ˆ˜[YNˆ’İ[Û\›È‹ˆœ˜[™[™ÎˆßKˆÙ][™ÜÎˆÈœÜ[›˜]šYØ][Û—Ù˜]Ù\—İ[YHˆ›YÚˆKˆ˜]šYØ][Ûˆ×Kˆ[Ù[\Îˆ×KˆJNÂˆÛÛœİ\šÈH™[™\‘İY\İ˜]šYØ][ÛŠÂˆÛYÎˆšİ[Y\Øİ\›È‹ˆ˜[YNˆ’İ[\Øİ\›È‹ˆœ˜[™[™ÎˆßKˆÙ][™ÜÎˆÈœÜ[›˜]šYØ][Û—Ù˜]Ù\—İ[YHˆ™\šÈˆKˆ˜]šYØ][Ûˆ×Kˆ[Ù[\Îˆ×KˆJNÂ‚ˆ\ÜÙ\›X]Ú
YÚÙİY\İ[˜]šYØ][Û‹Y˜]Ù\ˆ\Ë[YÚÊNÂˆ\ÜÙ\›X]Ú
\šËÙİY\İ[˜]šYØ][Û‹Y˜]Ù\ˆ\ËY\šËÊNÂˆ\ÜÙ\›X]Ú
˜]šYØ][ÛÜÜË×™İY\İ[˜]šYØ][Û‹Y˜]Ù\—š\ËY\šËÊNÂˆ\ÜÙ\›X]Ú
˜]šYØ][ÛÜÜËØ˜XÚÙÜ›İ[™—Êœ™Ø˜W
MËÊŒMËÊŒMËÊŒM—
KÊNÂŸJNÂ‚\İ
›Y[H]\˜[[˜ÛZHÙ\È\ÈÙXÛÙ\ÈH[Ù[ÜÈX›XÛÜÈXš[]YÜÈ‹

HOˆÂˆÛÛœİ[H™[™\‘İY\İ˜]šYØ][ÛŠÂˆÛYÎˆšİ[YšXİXÚ[È‹ˆ˜[YNˆ’İ[šXİ0ëXÚ[È‹ˆÚÜÛ˜[YNˆ‘šXİ0ëXÚ[È‹ˆœ˜[™[™ÎˆßKˆ˜]šYØ][Ûˆ×Kˆ[Ù[\ÎˆÂˆÈ[Ù[WÚÙ^Nˆ™İY\İ\Ü[‹˜[YNˆ”Ü[‹[˜X›YˆYHKˆÈ[Ù[WÚÙ^Nˆœ›ÛÛK\Ù\šXÙH‹˜[YNˆ”›ÛÛHÙ\šXÙH‹[˜X›YˆYHKˆÈ[Ù[WÚÙ^Nˆ™[\Üš[È‹˜[YNˆ‘[\0ìÜš[È‹[˜X›YˆYHKˆÈ[Ù[WÚÙ^NˆœÜH‹˜[YNˆ”ÜH‹[˜X›YˆYHKˆÈ[Ù[WÚÙ^Nˆœ›ÛX[XË\XÚØYÙ\È‹˜[YNˆ”XÛİ\È‹[˜X›YˆYHKˆÈ[Ù[WÚÙ^Nˆ˜YZ[ˆ‹˜[YNˆYZ[ˆ‹[˜X›YˆYHKˆÈ[Ù[WÚÙ^Nˆ›Øİ[È‹˜[YNˆ“Øİ[È‹[˜X›Yˆ˜[ÙHKˆKˆJNÂˆ›Üˆ
ÛÛœİX™[ÙˆÈ’[°ëXÚ[È‹”Ù\špéÛÜÈ‹”›ÙÜ˜[XpéğèÛÈ‹’İ[‹›ÙÈ‹”›ÛÛHÙ\šXÙH‹‘[\0ìÜš[È‹”ÜH‹”XÛİ\È—JHÂˆ\ÜÙ\›X]Ú
[™]È™YÑ^
X™[
JNÂˆBˆ\ÜÙ\™Ù\Ó›İX]Ú
[ÏYZ[ÊNÂˆ\ÜÙ\™Ù\Ó›İX]Ú
[Ï“Øİ[ÏÊNÂŸJNÂ‚\İ
š[™›Ü›XXÛÙ\ÈÈİ[İ\Ü[HİZXHš\İX[Y]]™[H›ÙÜ˜[XXØ[È‹

HOˆÂˆ\ÜÙ\›X]Ú
˜]šYØ][Û”ØÜš\×È™]™[ÜÈ‹”›ÙÜ˜[XpéğèÛÈ‹˜Ø[[™\ˆ—KÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ÜÜ[šİ[Ú[™›Ü›X][Û—›^[İ]ŠˆOOH˜Ø\™È‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ú\ËYİY\İYİZYKÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ü™[™\\Ü
İ]K”›ÙÜ˜[XpéğèÛÈ‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×š\ËYİY\İYİZYHšİ[Z[™›ËYÜšYÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×š[™›ËZÙ^KX˜XKZÚ]Ú[‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×š[™›ËZÙ^KY\ÜXÛË]ÚKÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØÚ[X\œ˜[ËÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ù›Ü›X]›ÛÛTÙ\šXÙRİ\œËÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ø\œ˜[™ÙQİZYR[™›Ü›X][Û‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ú[™›Ü›X][Û—İÚYšR[™^V×××Jš[™›Ü›X][Û—Ø˜XR[™^KÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ø˜XN‹Š“LLšHÒKÊNÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\Ô›ÙÜ˜[XpéğèÛËÊNÂŸJNÂ‚\İ
œÙ\šXÛÜÈ\Ø[H\İHY]ÜšX[[XYÙ[œÈÛÛ™šYİ\˜Y\ÈH^\šY[˜ÚX\È^˜\È‹

HOˆÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ÔÙ\špéÛÜÈH^\špê›˜ÚX\ËÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ÜÜ[œÙ\šXÙ\×™^˜WÚ][\ËÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ÚÛYK[[™ØØ\KZXÛÛ‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ÚÛYK[[™ØØ\K[YYXKÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Û[Ù[RXÛÛ—
[Ù[W›[Ù[WÚÙ^W
KÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØÛÛœİ\ÔÛÛH[Ù[W›[Ù[WÚÙ^HOOHœÛÛ‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ÚÛYK[[™ØØ\KXØ\™	Ú[XYÙU\›Èˆˆˆˆ›ËZ[XYÙH—W	Ú\ÔÛÛÈˆ\Ë\İ]XÈˆˆˆ—KÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜËÙÜšY][\]KXÛÛ[[œÎ—ÊœZ[›X^
Yœ—
HLœÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×šÛYK[[™ØØ\K[\İÊ—Ö×××JØ›Ü™\—ÊŒÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×šÛYK[[™ØØ\KXØ\™Ê—Ö×××JØ›Ü™\‹X›İÛN—ÊŒ\ÛÛY˜\—
KYİY\İ[[™W
NÖ×××JØ›Ü™\‹\˜Y]\Î—ÊŒÊNÂˆ\ÜÙ\™Ù\Ó›İX]Ú
Ü[ØÜš\ÚÛYK[[™ØØ\KXXİ[Û‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×šÛYK[[™ØØ\K[YYXWÊ—Ö×××JÛØš™XİYš]—Ê˜Ûİ™\‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜËĞYYXH
Z[‹]ÚYˆMŒ
V×××J×˜\]ÜXØ\™Ê—Ö×××JÛX\™Ú[—ÊÌœ]]ÈÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×™İY\İ\Ü[\›Ûİš\×
™\ÚİÜ][š]XÛİ™\—
HœÙ\šXÙ\ËY^\šY[˜ÙK\Ú[šÛYK[[™ØØ\KXÛÜH×Ê—Ö×××JØÛÛÜ—ÊˆÙ™™‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×™İY\İ\Ü[\›Ûİš\×
™\ÚİÜ][š]XÛİ™\—
HœÙ\šXÙ\ËY^\šY[˜ÙK\Ú[šÛYK[[™ØØ\KXÛÜHÊ—Ö×××JÜ™Ø˜W
MKMKMK
KÊNÂˆÛÛœİÙ\šXÙQ^\šY[˜Ù\ÔÛİ\˜ÙHHÜ[ØÜš\›X]Ú
ˆÙ[˜İ[ÛˆÙ]Ù\šXÙQ^\šY[˜Ù\×
›Ûİİ˜\
HÖ×××J×—KËˆ
OË–ÌHˆÂˆ\ÜÙ\™Ù\Ó›İX]Ú
Ù\šXÙQ^\šY[˜Ù\ÔÛİ\˜ÙKÙ›Ü›X]›ÛÛTÙ\šXÙRİ\œËÊNÂŸJNÂ‚\İ
“pï\ˆHÙ[›È™XÙX™[H[™›Ü›XpéğíY\È0î˜›XØ\È\ÜXğëYšXØ\ÈÜˆ[šYYH‹

HOˆÂˆ\ÜÙ\›X]Ú
İ[[™›Ü›X][Û•\]SZYÜ˜][Û‹ÉÛ][\‹Yš[Ü™^™IË×××JÉĞØY°êHHX[š0èÉË×××JÉÔÙ\šYÈX\šX[Y[H\ÈÚ0èÈL‰ËÊNÂˆ\ÜÙ\›X]Ú
İ[[™›Ü›X][Û•\]SZYÜ˜][Û‹ÉĞXØY[ZXIË	ĞÛÛœİ[HH™XÙ\0éğèÛ×‰ËÊNÂˆ\ÜÙ\›X]Ú
İ[[™›Ü›X][Û•\]SZYÜ˜][Û‹Ópï\ˆ	ˆš[Ü™^™HHİ[›İ]\]YKÊNÂˆ\ÜÙ\›X]Ú
İ[[™›Ü›X][Û•\]SZYÜ˜][Û‹Ô™YHX™\KÙ[HÙ[šKÊNÂˆ\ÜÙ\›X]Ú
İ[[™›Ü›X][Û•\]SZYÜ˜][Û‹Ú[™›×ÚÙ^HSˆ
	ØÚXÚÛİ]Y[[ÉË	Ø˜XKZÚ]Ú[‰Ë	ÚÚYÉË	İXÚ	Ë	Ù\ÜXÛË]ÚI×
KÊNÂˆ\ÜÙ\›X]Ú
İ[[™›Ü›X][Û•\]SZYÜ˜][Û‹ÔÙ\šYÈX\šX[Y[H\ÈšÌ0èÈL‹ÊNÂˆ\ÜÙ\›X]Ú
İ[[™›Ü›X][Û•\]SZYÜ˜][Û‹Ô™YNˆİ[š[Ü™^™HÙ[›ÉÖ×××JğìÙYÛÈHXÙ\ÜÛÎˆİ[Ù[›ÉËÊNÂŸJNÂ‚\İ
™^\šY[˜ÚXHH\ØÚ[˜HÈÙ[›ÈÜÜİZHÛÛ™šYİ\˜XØ[ÈX›XØHH[XYÙ[HØØ[‹

HOˆÂˆ\ÜÙ\›X]Ú
ÛÛ^\šY[˜ÙSZYÜ˜][Û‹ÉÙš[Ü™^™XÙ[›ÉËÊNÂˆ\ÜÙ\›X]Ú
ÛÛ^\šY[˜ÙSZYÜ˜][Û‹ÉÜÜ[œÙ\šXÙ\×™^˜WÚ][\ÉËÊNÂˆ\ÜÙ\›X]Ú
ÛÛ^\šY[˜ÙSZYÜ˜][Û‹Ô\ØÚ[˜H
ÜšYÙ[HH]Y\›ËT]Y\›×
KÊNÂˆ\ÜÙ\›X]Ú
ÛÛ^\šY[˜ÙSZYÜ˜][Û‹×Ø\ÜÙ]×Úİ[×Ùš[Ü™^™KXÙ[›×Ü\ØÚ[˜WšœËÊNÂˆ\ÜÙ\›ÚÊœË™^\İÔŞ[˜ÊÛÛ[XYÙU\›
JNÂˆ\ÜÙ\›ÚÊœËœİ]Ş[˜ÊÛÛ[XYÙU\›
KœÚ^™Hˆ
NÂŸJNÂ‚\İ
™İZXHÈİ[\ØHÈÜ˜\š[ÈØ[›ÛšXÛÈÈT”›ÈØ\™H›ÛÛHÙ\šXÙH‹

HOˆÂˆÛÛœİ]™\Q^HH\œ˜^K™œ›ÛJÈ[™İˆÈK
Ë^JHOˆ
Âˆ^WÛÙ—İÙYZÎˆ^KˆÜ[œ×Ø]ˆŒMŒ‹ˆÛÜÙ\×Ø]ˆŒŒŒ‹ˆ\×ØÛÜÙYˆ˜[ÙKˆJJNÂ‚ˆ\ÜÙ\™\]X[
›Ü›X]›ÛÛTÙ\šXÙRİ\œÊ]™\Q^JK“È›ÛÛHÙ\šXÙHÜ\˜HX\šX[Y[H\ÈMŒ0èÈŒŒˆŠNÂˆ\ÜÙ\›X]Ú
›Ü›X]›ÛÛTÙ\šXÙRİ\œÊ×JKĞÛÛœİ[HH™XÙ\0éğèÛËÊNÂŸJNÂ‚\İ
›[šÜÈÜÈ[Ù[ÜÈÙYİY[HÈÛYÈ]X[Y\Û[ÈÛÛH˜]™YØXØ[È[YØH‹

HOˆÂˆÛÛœİ[H™[™\‘İY\İ˜]šYØ][ÛŠÂˆÛYÎˆ›][\ˆ‹ˆ˜[YNˆ“][\ˆ	ˆš[Ü™^™H‹ˆœ˜[™[™ÎˆßKˆ˜]šYØ][ÛˆÂˆÂˆ[Ù[WÚÙ^Nˆœ›ÛÛK\Ù\šXÙH‹ˆ]ˆ‹Û][\‹Yš[Ü™^™KÜ›ÛÛK\Ù\šXÙH‹ˆKˆKˆ[Ù[\ÎˆÂˆÂˆ[Ù[WÚÙ^Nˆœ›ÛÛK\Ù\šXÙH‹ˆ˜[YNˆ”›ÛÛHÙ\šXÙH‹ˆ[˜X›YˆYKˆKˆKˆJNÂ‚ˆ\ÜÙ\›X]Ú
[Ú™YH—Û][\—Ü›ÛÛK\Ù\šXÙH‹ÊNÂˆ\ÜÙ\™Ù\Ó›İX]Ú
[Û][\‹Yš[Ü™^™WÜ›ÛÛK\Ù\šXÙKÊNÂŸJNÂ‚\İ
˜Ø\™ÈHYÚ[˜H[šXÚX[ÙYİY[HÈÛYÈ]X[H[šYYH‹

HOˆÂˆÛÛœİ›Ûİİ˜\HÂˆÛYÎˆ›][\ˆ‹ˆ˜]šYØ][ÛˆÂˆÂˆ[Ù[WÚÙ^Nˆœ›ÛÛK\Ù\šXÙH‹ˆ]ˆ‹Û][\‹Yš[Ü™^™KÜ›ÛÛK\Ù\šXÙH‹ˆKˆKˆNÂ‚ˆ\ÜÙ\™\]X[
Ù][Ù[T]
›Ûİİ˜\œ›ÛÛK\Ù\šXÙHŠK‹Û][\‹Ü›ÛÛK\Ù\šXÙHŠNÂŸJNÂ‚\İ
œÜ[™[™\š^˜H˜\š[ÜÈX\\ÈÙYİ\›ÜÈ˜HÙXØ[ÈÛÛ[ÈÚYØ\ˆ‹

HOˆÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØÛÛXİ›X\×Ù[X™Yİ\›ËÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ù[˜İ[ÛˆØ[š]^™QÛÛÙÛSX\Ñ[X™Y\›ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ù]K[X\Ë\ÙXİ[Û‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ÜØ[™›ŞH˜[İË\ØÜš\È[İË\Ø[YK[ÜšYÚ[ˆ[İË\Ü\È‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ù]K\Ü[[X\[Ü[‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×šİ[[X\ËYÜšYÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×šİ[[X\XØ\™Yœ˜[YWÊ—Ö×××JØ\ÜXİ\˜][Î—ÊŒMˆÈLÊNÂŸJNÂ‚\İ
˜Ù[˜[YZ[š\İ˜H[XH\İHHX\\ÈÙ[H\›X^™[˜\ˆYœ˜[YH]œ™H‹

HOˆÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\Ù[˜İ[ÛˆX\Ñ[X™YšY[ÊNÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\Ù]KXY[X\Y[X™YÊNÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\Ù]K\™[[İ™K[X\Y[X™YÊNÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\Ø›ÙWÈ˜ÛÛXİ›X\×Ù[X™Yİ\›È—HHX\Ñ[X™Y\›ËÊNÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\ĞğìÙYÛÜÈSHÚ]™\ÈHTH°èÛÈğèÛÈ\›X^™[˜YÜËÊNÂŸJNÂ‚\İ
™\ÚİÜ[[šHÙÛÈHİZX\ÈÛÛ\\[Y\ÈÙ[H[™È‹

HOˆÂˆ\ÜÙ\›X]Ú
˜]šYØ][ÛÜÜËĞYYXH
Z[‹]ÚYˆMŒ
V×××J×™İY\İ\Ú\™YZXY\—œÚ]KZXY\‹×××JØ˜XÚÙÜ›İ[™—Ê˜[œÜ\™[Ö×××JØ˜XÚÙ›ÜYš[\—Ê››Û™KÊNÂˆ\ÜÙ\›X]Ú
˜]šYØ][ÛÜÜË×™İY\İ\Ú\™YZXY\—œÚ]KZXY\—š\Ë\ØÜ›ÛY×××JØ˜XÚÙÜ›İ[™—Êœ™Ø˜W
MKÊŒMKÊŒMKÊŒ
NÖ×××JØ˜XÚÙ›ÜYš[\—Ê˜›\—
Œœ
KÊNÂˆ\ÜÙ\›X]Ú
˜]šYØ][ÛÜÜË×™İY\İ\Ú\™YZXY\ˆ˜œ˜[™[ÙÛËZ[Y×Ê—Ö×××JÛØš™XİYš]—Ê˜ÛÛZ[‹ÊNÂˆ\ÜÙ\›X]Ú
˜]šYØ][ÛÜÜË×™İY\İY\ÚİÜ[˜]ˆ™İY\İ[˜]‹Z][WÊ—Ö×××JØ›Ü™\‹\˜Y]\Î—ÊNN\ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×™İY\İ\Ü[\›Ûİš\×
™\ÚİÜ][š]XÛİ™\—
H™\ÚİÜ][š]XÛİ™\˜Y\—Ê—Ö×××JÜ™Ø˜W
MLKK
KÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×™İY\İ\Ü[\›Ûİš\×
™\ÚİÜ][š]XÛİ™\—
HšÛYKZ\›ËXÛÜH™İY\İ]]KÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×™İY\İ\Ü[\›Ûİš\×
™\ÚİÜ][š]XÛİ™\—
HšÛYK\Ù\šXÙ\Ë\ÙXİ[Ûˆˆ™İY\İ\ÙXİ[Û‹]]KÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×™İY\İ\Ü[\›Ûİš\×
™\ÚİÜ][š]XÛİ™\—
HšÛYKZ[™›Ë\ÙXİ[Ûˆ™İY\İ\ÙXİ[Û‹ZXY[™È]Û‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×™İY\İ\Ü[\›Ûİš\×
™\ÚİÜ][š]XÛİ™\—
H˜\]ÜXØ\™ˆÊ—Ö×××JØÛÛÜ—ÊˆÙ™™‹ÊNÂŸJNÂ‚\İ
š\›È\ÚİÜÙ\\˜HHØ]YXØ[ÈÈ›ÛYHH[šYYH‹

HOˆÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØÛ\ÜÏH™İY\İ]]K]Ù[ÛÛYH™[K]š[™È[ÏÜÜ[‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØÛ\ÜÏH™İY\İ]]K][š]‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜËĞYYXH
Z[‹]ÚYˆMŒ
V×××J×™İY\İ]]K]Ù[ÛÛYWÊ—Ö×××JÙ›Û\Ú^™N—Ê˜Û[\
—ŒM\™[K×ŒM]Ë×Œœ™[W
KÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜËĞYYXH
Z[‹]ÚYˆMŒ
V×××J×™İY\İ]]K][š]Ê—Ö×××JÙ›Û\Ú^™N—Ê˜Û[\
×\™[KËW™[W
KÊNÂŸJNÂ‚\İ
š[šXÚ[È\ÚİÜ\™HÈ[™ÈÈÜÈH\ØH[XYÙ[œÈÛÛ™šYİ\˜Y\È›ÜÈÙ\šXÛÜÈ‹

HOˆÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ÜØ[š]^™TX›XĞ\ÜÙ]\›
[Ù[W˜˜XÚÙÜ›İ[™Ú[XYÙWİ\›
KÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØÛ\ÜÏHœ]ZXÚËXØ\™	Ú[XYÙU\›Èˆ\ËY\ÚİÜZ[XYÙHˆˆˆ—H‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØÛ\ÜÏHœ]ZXÚËXØ\™[YYXH‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×œ]ZXÚËXØ\™[YYXWÊ—Ö×××JÙ\Ü^N—Ê››Û™KÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜËĞYYXH
Z[‹]ÚYˆMŒ
V×××J×œ]ZXÚËXØ\™š\ËY\ÚİÜZ[XYÙHœ]ZXÚËXØ\™[YYXWÊ—Ö×××JÙ\Ü^N—Ê˜›ØÚËÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜËĞYYXH
Z[‹]ÚYˆMŒ
V×××J×™İY\İ\Ú[š\×
šÛYKZ\›ËXÛÜW
N˜™Y›Ü™WÊ—Ö×××JÜ™Ø˜W
MLKK
KÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜËĞYYXH
Z[‹]ÚYˆMŒ
V×××J×šÛYKZ[™›Ë\ÙXİ[Û—Ê—×Ê™\Ü^N—Ê››Û™KÊNÂŸJNÂ‚\İ
˜Ù[˜[\›Z]H\ØÛÛ\ˆ[XYÙ[KšY[ÈİH›ÛHHšX›[İXØH\˜HHY[YYH‹

HOˆÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\Ø[İÕšY[ÈHšY[˜[YHOOH˜Ûİ™\—Ú[XYÙWİ\›‹ÊNÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\Ù›ÛÛ›HHšY[˜[YHOOH™›ÛØ\ÜÙ]ÚY‹ÊNÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\Ü™[™\’Y[]SYYXSÜ[Û‹ÊNÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\Û˜[YOH›YYXWØ\ÜÙ]ÚY‹ÊNÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\ØÛÛœİ\ÕšY[ÈHZ[YU\Wœİ\ÕÚ]
šY[×È—
KÊNÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\ØÛÛœİ\Ñ›ÛHZ[YU\Wœİ\ÕÚ]
™›ÛÈ—
KÊNÂˆ\ÜÙ\›X]Ú
YZ[”ØÜš\ĞØ\HÈÜ[
[XYÙ[HİH°ëY[×
KÊNÂˆ\ÜÙ\™Ù\Ó›İX]Ú
YZ[”ØÜš\ØÛÛœİÙ[XİYH\ÜÙ]×ÌKÊNÂŸJNÂ‚\İ
™]™[ÜÈXœ™[H[HX[ÙÛÈ›È\ÚİÜH™\Ù\˜[HÈ][H[İ™[‹

HOˆÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ú\Ñ\ÚİÜÜ[

KÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØÛ\ÜÏH™\ÚİÜY]™[XÛÛ^ˆ\šXKZY[HYHˆ[™\ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØÛ\ÜÏH™\ÚİÜY]™[YX[ÙËX˜XÚÙ›Üˆ]KY]™[YX[ÙÈ›ÛOH™X[ÙÈˆ\šXK[[Ù[HYH‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ù]™[šÙ^HOOH‘\ØØ\H‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\Ù]™[\™Ù]›X]Ú\×
—Ù]KY]™[YX[Ù×H—
KÊNÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ØÛ\ÜÏHœÜ[Y]Z[]šY]È‹ÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜËĞYYXH
Z[‹]ÚYˆMŒ
V×××J×™\ÚİÜY]™[YX[ÙËX˜XÚÙ›ÜÊ—Ö×××JÜÜÚ][Û—Ê™š^YÖ×××JØ˜XÚÙ›ÜYš[\—Ê˜›\—
\
KÊNÂˆ\ÜÙ\›X]Ú
Ü[ÜÜË×™\ÚİÜY]™[YX[ÙËX˜XÚÙ›ÜœÜ[Y]Z[]šY]×Ê—Ö×××JÛX^ZZYÚ—Ê˜Ø[×
LšHL
KÊNÂŸJNÂ‚\İ
œÜ[˜[È[˜ÛÜœÜ˜H\[™[˜ÚX\È™[H[™Ú[ÈÈÚ\İ[XHYØYÈ‹

HOˆÂˆ\ÜÙ\™Ù\Ó›İX]Ú
Ü[ØÜš\ÜØÜš\™ÛÛÙÛW˜ÛÛKÚJNÂˆ\ÜÙ\™Ù\Ó›İX]Ú
Ü[ØÜš\ÙØÜ×™ÛÛÙÛW˜ÛÛKÚJNÂˆ\ÜÙ\™Ù\Ó›İX]Ú
Ü[ØÜš\İZ[Ú[™ÜÜËÚJNÂˆ\ÜÙ\™Ù\Ó›İX]Ú
Ü[ØÜš\Ópï\Ÿš[Ü™^™HÙ[›ßÜİ[YËÚJNÂŸJNÂ‚\İ
œÜ[[Z]H[XYÙ[œÈ[˜[ZXØ\È[ÜÈ\ÜÙ]ÈX›XÛÜÈH]Y›Ü›XH‹

HOˆÂˆ\ÜÙ\›X]Ú
Ü[ØÜš\ÜØ[š]^™TX›XĞ\ÜÙ]\›ÊNÂˆ\ÜÙ\™Ù\Ó›İX]Ú
Ü[ØÜš\Ø˜XÚÙÜ›İ[™Z[XYÙN—Ê\›
ÚJNÂŸJNÂ