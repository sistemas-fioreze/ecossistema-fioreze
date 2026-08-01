import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { renderGuestNavigation } from "../public/js/core/guest-navigation.js";
import { getModulePath, resolvePortalSwipe } from "../public/js/core/portal-home.js";

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
const themeScript = fs.readFileSync(new URL("../public/js/core/theme.js", import.meta.url), "utf8");
const adminScript = fs.readFileSync(new URL("../public/js/modules/admin/portals.js", import.meta.url), "utf8");
const roomServiceScript = fs.readFileSync(new URL("../public/js/modules/room-service/index.js", import.meta.url), "utf8");
const guestPortalRoutes = fs.readFileSync(new URL("../src/modules/guest-portal/routes.js", import.meta.url), "utf8");

test("portal usa o layout de referencia com identidade e conteudo dinamicos", () => {
  assert.match(navigationScript, /branding\?\.horizontal_logo_url/);
  assert.doesNotMatch(portalScript, /loading-brand|Carregando portal|renderLoading/);
  assert.match(portalScript, /bootstrap\.modules\.filter/);
  assert.match(portalScript, /bootstrap\.settings/);
  assert.match(navigationScript, /\["inicio", "Início", "home"\]/);
  assert.match(portalScript, /Informações do hotel/);
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
  assert.match(adminScript, /Escala da logo no cabeçalho/);
  assert.match(adminScript, /header_logo_scale/);
});

test("cabecalho usa logo por portal e menu lateral usa identidade independente", () => {
  const html = renderGuestNavigation({
    slug: "hotel-ficticio",
    name: "Hotel Fictício",
    branding: {
      horizontal_logo_url: "/media/logo-geral",
      emporio_logo_url: "/media/logo-emporio",
      navigation_logo_url: "/media/logo-menu",
    },
    settings: {},
    modules: [{ module_key: "emporio", name: "Empório", enabled: true }],
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
    name: "Hotel Fictício",
    branding: {},
    settings: {},
    modules: [
      { module_key: "guest-portal", name: "Portal", enabled: true },
      { module_key: "room-service", name: "Room Service", enabled: true },
      { module_key: "emporio", name: "Empório", enabled: true },
      { module_key: "spa", name: "Spa", enabled: true },
    ],
  });

  assert.match(html, /data-guest-search-toggle/);
  assert.match(html, /data-guest-search-input/);
  assert.match(html, /Buscar no portal/);
  assert.match(html, /Serviço da unidade/);
  assert.match(navigationScript, /fioreze:portal-search/);
  assert.match(navigationCss, /\.guest-search-panel:not\(\[hidden\]\)/);
  assert.match(navigationCss, /grid-template-columns:\s*44px minmax\(0,\s*1fr\) 44px/);
  assert.match(navigationCss, /\.guest-search-field input::\x2dwebkit-search-cancel-button\s*\{[\s\S]*?\x2dwebkit-appearance:\s*none/);
});

test("cabecalhos mobile nao acumulam espacamento e Emporio compartilha o mesmo fundo", () => {
  const emporioCss = fs.readFileSync(
    new URL("../public/css/modules/emporio/emporio.css", import.meta.url),
    "utf8",
  );

  assert.match(navigationCss, /\.public-module-root \.public-module-heading\s*\{\s*padding-top:\s*0/);
  assert.match(navigationCss, /\.public-module-heading-copy\s*\{[^]*?padding-top:\s*calc\(74px \+ env\(safe-area-inset-top\)\)/);
  assert.match(emporioCss, /\.emporio-root \.public-module-heading,[^]*?background:\s*#fafafa/);
  assert.match(emporioCss, /@media \(max-width: 959px\)[^]*?\.emporio-search\s*\{\s*display:\s*none/);
});

test("Decorações Especiais preserva titulo dourado proprio e acao solida", () => {
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
  assert.doesNotMatch(publicIndex, /loader-screen|Carregando experiência/);
  assert.doesNotMatch(appScript, /app\.innerHTML\s*=\s*moduleLoader[\s\S]*renderGuestPortalHome/);
  assert.doesNotMatch(portalScript, /loading-screen|Carregando portal/);
  assert.ok(portalScript.indexOf("renderPortal(container, state)") < portalScript.indexOf("await apiGet"));
  assert.doesNotMatch(appScript, /Carregando modulo/);
  assert.doesNotMatch(roomServiceScript, /Carregando cardápio|renderLoading/);
});

test("cabecalhos dos modulos repetem o padrao icone e titulo do Portal do Hospede", () => {
  assert.match(appScript, /has-module-heading/);
  assert.match(appScript, /function renderModuleHeading/);
  assert.match(appScript, /class="app-top-title"/);
  assert.match(appScript, /navigationIcon\(iconName\)/);
  assert.match(appScript, /Seja bem-vindo ao Room Service digital/);
  assert.match(appScript, /Use o ramal n° 9/);
  assert.match(appScript, /O Room Service opera diariamente das/);
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
  assert.match(portalCss, /@media \(max-width: 959px\)[\s\S]*?\.home-info-section\s*\{\s*display:\s*none/);
  assert.match(portalCss, /@media \(max-width: 959px\)[\s\S]*?\.quick-card,[\s\S]*?\.quick-card:hover\s*\{[\s\S]*?background:\s*rgba\(18, 13, 10, 0\.68\);[\s\S]*?backdrop-filter:\s*blur\(16px\) saturate\(1\.12\)/);
  assert.match(portalCss, /\.quick-card > svg,[\s\S]*?\.quick-card > strong,[\s\S]*?\.quick-card > span\s*\{[\s\S]*?color:\s*#fff/);
  assert.match(portalCss, /@media \(max-width: 959px\)[\s\S]*?\.quick-card > span\s*\{[\s\S]*?overflow:\s*visible;[\s\S]*?-webkit-line-clamp:\s*unset/);
});

test("swipe horizontal mobile avanca e volta entre as guias", () => {
  assert.equal(resolvePortalSwipe({ activeTab: "inicio", startX: 310, startY: 420, endX: 110, endY: 426, durationMs: 280 }), "servicos");
  assert.equal(resolvePortalSwipe({ activeTab: "eventos", startX: 80, startY: 420, endX: 270, endY: 414, durationMs: 300 }), "servicos");
});

test("swipe mobile respeita limites e preserva a rolagem vertical", () => {
  assert.equal(resolvePortalSwipe({ activeTab: "inicio", startX: 290, startY: 420, endX: 90, endY: 425, durationMs: 250 }), "servicos");
  assert.equal(resolvePortalSwipe({ activeTab: "inicio", startX: 80, startY: 420, endX: 290, endY: 425, durationMs: 250 }), null);
  assert.equal(resolvePortalSwipe({ activeTab: "blog", startX: 290, startY: 420, endX: 80, endY: 425, durationMs: 250 }), null);
  assert.equal(resolvePortalSwipe({ activeTab: "servicos", startX: 300, startY: 200, endX: 270, endY: 400, durationMs: 250 }), null);
  assert.equal(resolvePortalSwipe({ activeTab: "servicos", startX: 300, startY: 200, endX: 230, endY: 205, durationMs: 900 }), null);
});

test("gesto mobile ignora controles interativos e usa somente o conteudo", () => {
  assert.match(portalScript, /MOBILE_SWIPE_BLOCKED_SELECTOR/);
  assert.match(portalScript, /event\.target\.closest\?\.\(MOBILE_SWIPE_BLOCKED_SELECTOR\)/);
  assert.match(portalScript, /addEventListener\("touchstart"/);
  assert.match(portalScript, /addEventListener\("touchend"/);
  assert.match(portalScript, /addEventListener\("touchcancel"/);
  assert.match(portalCss, /\.guest-shell,[\s\S]*?touch-action:\s*pan-y/);
});

test("navegacao mobile alinha icone e texto no drawer", () => {
  assert.match(navigationCss, /\.guest-nav-item\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*13px/);
  assert.match(navigationCss, /\.guest-nav-item\.is-active\s*\{[\s\S]*?color:\s*#fff/);
  assert.match(navigationCss, /\.guest-menu-toggle\s*,[\s\S]*?background:\s*transparent/);
});

test("menu lateral aceita fundo branco ou preto por configuracao publica", () => {
  const light = renderGuestNavigation({
    slug: "hotel-claro",
    name: "Hotel Claro",
    branding: {},
    settings: { "portal.navigation_drawer_theme": "light" },
    navigation: [],
    modules: [],
  });
  const dark = renderGuestNavigation({
    slug: "hotel-escuro",
    name: "Hotel Escuro",
    branding: {},
    settings: { "portal.navigation_drawer_theme": "dark" },
    navigation: [],
    modules: [],
  });

  assert.match(light, /guest-navigation-drawer is-light/);
  assert.match(dark, /guest-navigation-drawer is-dark/);
  assert.match(navigationCss, /\.guest-navigation-drawer\.is-dark/);
  assert.match(navigationCss, /background:\s*rgba\(17,\s*17,\s*17,\s*0\.96\)/);
});

test("menu lateral inclui todas as secoes e modulos publicos habilitados", () => {
  const html = renderGuestNavigation({
    slug: "hotel-ficticio",
    name: "Hotel Fictício",
    short_name: "Fictício",
    branding: {},
    navigation: [],
    modules: [
      { module_key: "guest-portal", name: "Portal", enabled: true },
      { module_key: "room-service", name: "Room Service", enabled: true },
      { module_key: "emporio", name: "Empório", enabled: true },
      { module_key: "spa", name: "Spa", enabled: true },
      { module_key: "romantic-packages", name: "Pacotes", enabled: true },
      { module_key: "admin", name: "Admin", enabled: true },
      { module_key: "oculto", name: "Oculto", enabled: false },
    ],
  });
  for (const label of ["Início", "Serviços", "Programação", "Hotel", "Blog", "Room Service", "Empório", "Spa", "Pacotes"]) {
    assert.match(html, new RegExp(label));
  }
  assert.doesNotMatch(html, />Admin</);
  assert.doesNotMatch(html, />Oculto</);
});

test("informacoes do hotel suportam guia visual editavel e programacao", () => {
  assert.match(navigationScript, /\["eventos", "Programação", "calendar"\]/);
  assert.match(portalScript, /portal\.hotel_information\.layout/);
  assert.match(portalScript, /is-guest-guide/);
  assert.match(portalScript, /renderAppTop\(state, "Programação"/);
  assert.match(portalCss, /\.is-guest-guide \.hotel-info-grid/);
  assert.match(portalCss, /\.info-key-baby-kitchen/);
  assert.match(adminScript, /Programação/);
});

test("links dos modulos seguem o slug atual mesmo com navegacao antiga", () => {
  const html = renderGuestNavigation({
    slug: "muller",
    name: "Muller & Fioreze",
    branding: {},
    navigation: [
      {
        module_key: "room-service",
        path: "/muller-fioreze/room-service",
      },
    ],
    modules: [
      {
        module_key: "room-service",
        name: "Room Service",
        enabled: true,
      },
    ],
  });

  assert.match(html, /href="\/muller\/room-service"/);
  assert.doesNotMatch(html, /muller-fioreze\/room-service/);
});

test("cards da pagina inicial seguem o slug atual da unidade", () => {
  const bootstrap = {
    slug: "muller",
    navigation: [
      {
        module_key: "room-service",
        path: "/muller-fioreze/room-service",
      },
    ],
  };

  assert.equal(getModulePath(bootstrap, "room-service"), "/muller/room-service");
});

test("portal renderiza varios mapas seguros na secao Como chegar", () => {
  assert.match(portalScript, /contact\.maps_embed_urls/);
  assert.match(portalScript, /function sanitizeGoogleMapsEmbedUrl/);
  assert.match(portalScript, /data-maps-section/);
  assert.match(portalScript, /sandbox="allow-scripts allow-same-origin allow-popups"/);
  assert.match(portalScript, /data-portal-map-open/);
  assert.match(portalCss, /\.hotel-maps-grid/);
  assert.match(portalCss, /\.hotel-map-card iframe\s*\{[\s\S]*?aspect-ratio:\s*16 \/ 10/);
});

test("central administra uma lista de mapas sem armazenar iframe livre", () => {
  assert.match(adminScript, /function mapsEmbedField/);
  assert.match(adminScript, /data-add-map-embed/);
  assert.match(adminScript, /data-remove-map-embed/);
  assert.match(adminScript, /body\["contact\.maps_embed_urls"\] = mapsEmbedUrls/);
  assert.match(adminScript, /Códigos HTML e chaves de API não são armazenados/);
});

test("desktop alinha logo e guias compartilhadas sem fundo", () => {
  assert.match(navigationCss, /@media \(min-width: 960px\)[\s\S]*?\.guest-shared-header\.site-header,[\s\S]*?background:\s*transparent;[\s\S]*?backdrop-filter:\s*none/);
  assert.match(navigationCss, /\.guest-shared-header\.site-header\.is-scrolled,[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.88\);[\s\S]*?backdrop-filter:\s*blur\(22px\)/);
  assert.match(navigationCss, /\.guest-shared-header \.brand-logo-img\s*\{[\s\S]*?object-fit:\s*contain/);
  assert.match(navigationCss, /\.guest-desktop-nav \.guest-nav-item\s*\{[\s\S]*?border-radius:\s*999px/);
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

test("central permite escolher imagem, video ou fonte da biblioteca para a identidade", () => {
  assert.match(adminScript, /allowVideo = fieldName === "cover_image_url"/);
  assert.match(adminScript, /fontOnly = fieldName === "font_asset_id"/);
  assert.match(adminScript, /renderIdentityMediaOption/);
  assert.match(adminScript, /name="media_asset_id"/);
  assert.match(adminScript, /const isVideo = mimeType\.startsWith\("video\/"\)/);
  assert.match(adminScript, /const isFont = mimeType\.startsWith\("font\/"\)/);
  assert.match(adminScript, /Capa do portal \(imagem ou vídeo\)/);
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
