import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

const ADMIN_HTML = [
  ["home", "public/admin/index.html"],
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
  const sourceWithoutTurnstile = source.replace(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    "",
  );
  assert.match(source, /admin-global-sidebar/);
  assert.match(source, /admin-help-drawer/);
  assert.match(source, /admin-avatar/);
  assert.match(source, /canAccessPortals/);
  assert.match(source, /<svg class="admin-svg-icon"/);
  assert.match(source, /fioreze-central-logo\.jpg/);
  assert.match(source, /\/api\/v1\/admin\/me\/preferences/);
  assert.match(source, /data-admin-palette/);
  assert.doesNotMatch(source, /Abra Pedidos|Ajuda de Pedidos|\/admin\/room-service/);
  assert.match(source, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
  assert.doesNotMatch(sourceWithoutTurnstile, /https:\/\/|cdn|lucide|fontawesome/i);
});

test("design system administrativo documenta identidade e modulos ativos", () => {
  const doc = fs.readFileSync("../docs/arquitetura/ADMIN_DESIGN_SYSTEM.md", "utf8");
  assert.match(doc, /FIOREZE/);
  assert.match(doc, /Unidade/);
  assert.match(doc, /Endereco personalizado/);
  assert.match(doc, /Conteudos/);
  assert.match(doc, /Auditoria/);
});

test("CSS administrativo contem drawer mobile, ajuda e reduced motion", () => {
  const css = `${fs.readFileSync("public/css/modules/admin/admin.css", "utf8")}\n${fs.readFileSync("public/css/modules/admin/admin-erp-aligned.css", "utf8")}`;
  assert.match(css, /admin-global-sidebar/);
  assert.match(css, /admin-mobile-menu/);
  assert.match(css, /admin-help-drawer/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /admin-content-loader[\s\S]*backdrop-filter: blur\(3px\)/);
  assert.ok((css.match(/backdrop-filter:/g) || []).length >= 3);
});

test("Central Administrativa usa a linguagem visual do ERP sem modulos de fachada", () => {
  const home = fs.readFileSync("public/admin/index.html", "utf8");
  const portals = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const source = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");
  const management = fs.readFileSync("public/js/modules/admin/central-management.js", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/admin-erp-aligned.css", "utf8");

  assert.match(home, /admin-erp-aligned\.css/);
  assert.match(portals, /admin-erp-aligned\.css/);
  assert.match(css, /--admin-accent: #513b2d/);
  assert.match(portals, /contentManager/);
  assert.match(portals, /areasManager/);
  assert.match(portals, /navigationManager/);
  assert.match(portals, /auditManager/);
  assert.match(management, /temporary_password/);
  assert.match(management, /permission_keys/);
  assert.doesNotMatch(source, /#preparacao|Em preparacao|Unidade Fioreze Demo|Fioreze Demo|unidade-demo/);
});

test("navegacao centraliza equipe e conta em Configuracoes e Inicio usa dashboard real", () => {
  const home = fs.readFileSync("public/admin/index.html", "utf8");
  const shell = fs.readFileSync("public/js/modules/admin/shared/admin-auth-view.js", "utf8");
  const controller = fs.readFileSync("public/js/modules/admin/admin.js", "utf8");

  assert.match(home, /adminHomeDashboard/);
  assert.match(home, /homePermissionsChart/);
  assert.match(home, /settingsManager/);
  assert.match(shell, /\/admin\/configuracoes\//);
  assert.doesNotMatch(shell, /\["users", "Usuários"|\["roles", "Perfis e permissões"|\["account", "Minha conta"/);
  assert.match(controller, /renderSettings/);
  assert.match(controller, /getPermissions/);
  assert.match(controller, /unreadMessageCount/);
});

test("interface de links diferencia propriedade e compartilhamento", () => {
  const html = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const source = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");

  assert.match(html, /shortLinkSharingPanel/);
  assert.match(html, /shortLinkSharingForm/);
  assert.match(source, /link\.can_manage/);
  assert.match(source, /Compartilhado com você/);
  assert.match(source, /\/shares/);
  assert.match(source, /data-share-revoke/);
});

test("textos visiveis da Central preservam acentuacao em portugues", () => {
  const visibleSources = [
    "public/admin/index.html",
    "public/admin/portais/index.html",
    "public/js/modules/admin/admin.js",
    "public/js/modules/admin/portals.js",
    "public/js/modules/admin/room-service.js",
  ].map((path) => fs.readFileSync(path, "utf8")).join("\n");

  for (const legacyText of [
    "Nao foi possivel",
    "nao disponivel",
    "Permissao administrativa",
    "Nao informado",
    "Hospede",
    "Acomodacao",
    "Biblioteca de Midia",
    "imagem ou video",
    "Video sera",
  ]) {
    assert.doesNotMatch(visibleSources, new RegExp(legacyText), legacyText);
  }
});

test("Central compartilha as proporcoes e os controles do shell oficial do ERP", () => {
  const shell = fs.readFileSync("public/js/modules/admin/shared/admin-auth-view.js", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/admin-erp-aligned.css", "utf8");

  assert.match(css, /grid-template-columns: 258px minmax\(0, 1fr\)/);
  assert.match(css, /grid-template-columns: 72px minmax\(0, 1fr\)/);
  assert.match(css, /height: 66px/);
  assert.match(css, /border-radius: 14px 0 0 0/);
  assert.match(css, /background: var\(--admin-canvas\)/);
  assert.match(shell, /data-admin-shell-toggle/);
  assert.match(shell, /fioreze-admin-sidebar/);
  assert.match(shell, /data-admin-search-results/);
  assert.match(shell, /data-admin-session-toggle/);
  assert.match(shell, /admin-brand-wordmark/);
  assert.match(shell, /admin-sidebar-head[\s\S]*data-admin-shell-toggle[\s\S]*admin-brand-lockup/);
  assert.match(shell, /data-admin-refresh/);
  assert.match(shell, /fioreze:admin-refresh/);
  assert.doesNotMatch(shell, /admin-sidebar-footer|admin-brand-symbol/);
  assert.match(css, /\.is-sidebar-compact \.admin-brand-lockup,[\s\S]{0,160}display: none/);
  assert.match(css, /\.is-sidebar-compact \.admin-global-nav a > span,[\s\S]{0,220}display: none/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /touch-action: pan-y/);
});

test("Biblioteca de Midia unifica pastas, imagens e videos em grade ou lista", () => {
  const html = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const source = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");

  for (const id of ["mediaGrid", "mediaBreadcrumbs", "mediaUploadForm", "mediaFolderDialog", "mediaViewGrid", "mediaViewList", "mediaStorageProgress"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.doesNotMatch(html, /id="mediaFolders"|>Pastas<|>Imagens</);
  assert.match(html, /video\/mp4,video\/webm,video\/quicktime/);
  assert.match(source, /renderMediaItems/);
  assert.match(source, /<video/);
  assert.match(source, /mediaStorageProgress/);
  assert.match(source, /application\/x-fioreze-media-id/);
  assert.match(source, /dataTransfer/);
  assert.match(source, /\/api\/v1\/admin\/media-folders/);
  assert.match(source, /folder_id/);
  assert.equal(fs.existsSync("public/assets/shared/fioreze-central-logo.jpg"), true);
});

test("login usa marca estatica, paleta padrao e spinner proprio", () => {
  const home = fs.readFileSync("public/admin/index.html", "utf8");
  const portals = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/admin-erp-aligned.css", "utf8");

  for (const html of [home, portals]) {
    assert.match(html, /data-admin-palette="fioreze"/);
    assert.match(html, /rel="preload" as="image" href="\/assets\/shared\/fioreze-central-logo\.jpg"/);
    assert.match(html, /admin-modern-spinner/);
  }
  assert.match(css, /admin-access-card \.brand-mark[\s\S]*animation: none/);
  assert.match(css, /admin-login[\s\S]*background: #fff/);
  assert.match(css, /admin-access-card \.brand-mark[\s\S]*border: 0/);
  assert.match(css, /admin-access-card \.brand-mark[\s\S]*background: transparent url/);
  assert.match(css, /@keyframes admin-modern-spin/);
});

test("Central mobile remove o Criador da lateral e reserva o editor para desktop", () => {
  const shell = fs.readFileSync("public/js/modules/admin/shared/admin-auth-view.js", "utf8");
  const portals = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");
  const html = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/admin-erp-aligned.css", "utf8");

  assert.doesNotMatch(shell, /\["portals", "Criador"/);
  assert.doesNotMatch(portals, /\["Criador", "\/admin\/portais\/conteudos\/"/);
  assert.match(html, /id="creatorDesktopGuard"/);
  assert.match(portals, /matchMedia\("\(min-width: 1024px\)"\)/);
  assert.match(portals, /visualPortalBuilder\.dismiss\(\)/);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*html\.visual-builder-open \.vp-builder[\s\S]*display: none/);
});

test("seletores de mídia permitem upload contextual sem sair do formulário", () => {
  const portals = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");
  const builder = fs.readFileSync("public/js/modules/admin/portal-builder.js", "utf8");

  assert.match(portals, /data-inline-media-upload/);
  assert.match(portals, /context: "identity"/);
  assert.match(portals, /context: "event"/);
  assert.match(portals, /context: "area"/);
  assert.match(portals, /PORTALS_MEDIA_UPLOAD_PERMISSION/);
  assert.match(portals, /adminApi\("\/api\/v1\/admin\/media", \{ method: "POST", body: form \}\)/);
  assert.match(builder, /data-media-upload/);
});

test("shells administrativos continuam respondendo sem fallback incorreto", async () => {
  const { fetch } = createWorkerTestContext();
  for (const path of ["/admin/", "/admin/configuracoes/", "/admin/portais/", "/admin/portais/unidades/", "/admin/portais/media/", "/admin/portais/links/", "/erp/room-service/"]) {
    const response = await fetch(path, { redirect: "manual" });
    const html = await response.text();
    assert.equal(response.status, 200, path);
    assert.match(html, /loginForm|settingsManager|routeOutlet|portalsContent|unitsManager|mediaLibrary|shortLinksManager/, path);
    assert.doesNotMatch(html, /"error"|Not Found/, path);
  }
});

test("ERP Room Service oficial nao usa CDN, webhook legado ou Postimg", () => {
  const html = fs.readFileSync("public/erp/room-service/index.html", "utf8");
  const app = fs.readFileSync("public/js/modules/room-service-erp/app.js", "utf8");
  const adapter = fs.readFileSync("public/js/modules/room-service-erp/legacy-app.js", "utf8");
  assert.match(html, /data-erp="room-service"/);
  assert.match(html, /routeOutlet/);
  assert.doesNotMatch(`${html}\n${app}\n${adapter}`, /https:\/\/|cdn|postimg|script\.google|WEBHOOK|Sheets/i);
});

test("ERP Room Service preserva shell visual, SVGs, abas e dashboard do legado sanitizado", () => {
  const html = fs.readFileSync("public/erp/room-service/index.html", "utf8");
  const svgCount = (html.match(/<svg\b/g) || []).length;

  assert.ok(svgCount >= 40, `esperava ao menos 40 SVGs locais, recebeu ${svgCount}`);
  for (const id of [
    "btnTabDashboard",
    "btnTabVendas",
    "btnTabHist",
    "btnTabHospedes",
    "btnTabFaturamento",
    "btnTabCardapio",
    "btnTabAdmin",
    "dashboardContainer",
    "dashTopItemsList",
    "dashLastOrders",
    "vendasContainer",
    "histContainer",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /legacy-tailwind\.css/);
  assert.match(html, /legacy-adapter\.css/);
  assert.match(html, /room-service-erp\/app\.js/);
  assert.doesNotMatch(html, /\son[a-z]+=/i);
});
