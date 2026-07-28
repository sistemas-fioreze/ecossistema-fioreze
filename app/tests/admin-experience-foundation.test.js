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
  assert.doesNotMatch(source, /\/api\/v1\/admin\/me\/preferences/);
  assert.doesNotMatch(source, /data-admin-palette|ADMIN_PALETTES|savePalettePreference/);
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
  const shell = fs.readFileSync("public/js/modules/admin/shared/admin-auth-view.js", "utf8");
  assert.match(css, /admin-global-sidebar/);
  assert.match(css, /admin-mobile-menu/);
  assert.match(css, /admin-help-drawer/);
  assert.match(css, /prefers-reduced-motion/);
  assert.ok((css.match(/backdrop-filter:/g) || []).length >= 3);
  assert.doesNotMatch(css, /admin-content-loader/);
  assert.doesNotMatch(shell, /data-admin-content-loader|Carregando área/);
});

test("novo workspace visual permanece isolado da Central e responsivo", () => {
  const home = fs.readFileSync("public/admin/index.html", "utf8");
  const portals = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const roomService = fs.readFileSync("public/admin/room-service/index.html", "utf8");
  const shell = fs.readFileSync("public/js/modules/admin/shared/admin-auth-view.js", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/admin-workspace.css", "utf8");

  for (const html of [home, portals]) {
    assert.match(html, /admin-workspace\.css/);
    assert.match(html, /data-admin-design="workspace"/);
  }
  assert.doesNotMatch(roomService, /admin-workspace\.css|data-admin-design="workspace"/);
  assert.match(css, /--workspace-sidebar: #ffffff/);
  assert.match(css, /border-right: 1px solid var\(--workspace-line\)/);
  assert.match(css, /grid-template-columns: 272px minmax\(0, 1fr\)/);
  assert.match(css, /admin-nav-group/);
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(shell, /admin-brand-copy|<strong>Central<\/strong><small>Administrativa<\/small>/);
  assert.match(shell, /Visão geral/);
  assert.match(shell, /Experiências/);
  assert.match(shell, /Colaboração/);
  assert.match(shell, /Administração/);
  assert.match(shell, /syncAdminShellContext/);
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

test("Central navega sem overlay e Links preserva ícones com rótulos no mobile", () => {
  const admin = fs.readFileSync("public/js/modules/admin/admin.js", "utf8");
  const messages = fs.readFileSync("public/js/modules/admin/admin-messages.js", "utf8");
  const management = fs.readFileSync("public/js/modules/admin/central-management.js", "utf8");
  const source = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");
  const roomService = fs.readFileSync("public/js/modules/admin/room-service.js", "utf8");
  const shell = fs.readFileSync("public/js/modules/admin/shared/admin-auth-view.js", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/admin-erp-aligned.css", "utf8");

  assert.match(admin, /handleAdminNavigation/);
  assert.match(admin, /window\.history\.pushState/);
  assert.match(admin, /window\.addEventListener\("popstate"/);
  assert.match(source, /handlePortalNavigation/);
  assert.match(source, /window\.history\.pushState/);
  assert.match(source, /window\.addEventListener\("popstate"/);
  assert.match(source, /syncAdminNavigationActiveState/);
  assert.match(shell, /syncAdminNavigationActiveState/);
  assert.match(source, /function renderTabTransition\(render\) \{\s*render\(\);\s*\}/);
  assert.doesNotMatch(source, /Carregando links|Carregando eventos|Carregando conteúdos|Carregando unidades/);
  assert.doesNotMatch(
    [messages, management, source, roomService].join("\n"),
    /Carregando (pedidos|detalhes|mensagens|usuários|perfis|pessoas|pastas|seções|arquivos)/,
  );
  assert.doesNotMatch(shell, /setContentLoading|fioreze:admin-content-loading/);
  assert.match(css, /html\.short-link-editor-open/);
  assert.match(css, /\.admin-short-links-editor[\s\S]*position: fixed/);
  assert.match(css, /\.admin-link-card-actions[\s\S]*grid-template-columns: repeat\(2/);
  assert.match(source, /<svg aria-hidden="true"[\s\S]*<span>\$\{escapeHtml\(label\)\}<\/span>/);
  assert.match(css, /\.admin-link-card-actions button span \{[\s\S]*display: inline/);
});

test("abas administrativas usam conteúdo solto sem caixa ou fundo", () => {
  const css = fs.readFileSync("public/css/modules/admin/admin-erp-aligned.css", "utf8");
  assert.match(css, /:where\(\.admin-tabs, \.admin-segmented, \.admin-message-boxes\) \{[\s\S]*border: 0[\s\S]*background: transparent/);
  assert.match(css, /:where\(\.admin-tabs, \.admin-segmented, \.admin-message-boxes\) button \{[\s\S]*border: 0[\s\S]*background: transparent/);
  assert.match(css, /body\[data-admin-shell="erp"\] \.admin-tab-panel \{[\s\S]*border: 0[\s\S]*background: transparent/);
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
  const css = fs.readFileSync("public/css/modules/admin/admin-workspace.css", "utf8");

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
  assert.match(source, /activePortalSection = active\?\.id/);
  assert.match(css, /data-active-portal-section="mediaLibrary"[\s\S]*overflow: hidden;[\s\S]*padding: 0/);
  assert.match(css, /\.admin-media-library \{[\s\S]*height: 100%;[\s\S]*grid-template-rows: auto minmax\(0, 1fr\)/);
  assert.match(css, /\.admin-media-drive-main \{[\s\S]*height: 100%;[\s\S]*overflow-y: auto/);
  assert.equal(fs.existsSync("public/assets/shared/fioreze-central-logo.jpg"), true);
});

test("configuracao de unidades nao exibe mais a aba de incorporacao", () => {
  const html = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const source = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");

  assert.doesNotMatch(html, /data-unit-tab="embed"|data-tab-panel="embed"|>Incorporação</);
  assert.doesNotMatch(source, /renderEmbedPanel|saveEmbed|currentEmbed|PORTALS_EMBED_/);
  assert.match(html, /data-unit-tab="general"/);
  assert.match(html, /data-unit-tab="branding"/);
  assert.match(html, /data-unit-tab="contact"/);
  assert.match(html, /data-unit-tab="hosting"/);
  assert.match(html, /data-unit-tab="seo"/);
});

test("login usa marca estática e valida sessão sem tela intermediária", () => {
  const home = fs.readFileSync("public/admin/index.html", "utf8");
  const portals = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const roomService = fs.readFileSync("public/admin/room-service/index.html", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/admin-workspace.css", "utf8");

  for (const html of [home, portals, roomService]) {
    assert.match(html, /data-view="loading" aria-label="Verificando sessão administrativa"/);
    assert.doesNotMatch(html, /admin-loading-card|admin-modern-spinner|Preparando a Central|Verificando sessao local/);
  }
  for (const html of [home, portals]) {
    assert.doesNotMatch(html, /data-admin-palette/);
    assert.match(html, /rel="preload" as="image" href="\/assets\/shared\/fioreze-central-logo\.jpg"/);
  }
  assert.match(css, /admin-access-card \.brand-mark[\s\S]*animation: none/);
  assert.match(css, /admin-login[\s\S]*background: #fff/);
  assert.match(css, /admin-access-card \.brand-mark[\s\S]*border: 0/);
  assert.match(css, /admin-access-card \.brand-mark[\s\S]*background: transparent url/);
  assert.match(css, /admin-access-card input:-webkit-autofill/);
  assert.match(css, /admin-access-card \.admin-primary-button \{[\s\S]*width: 178px/);
});

test("Central usa identidade fixa sem seletor pessoal de cores", () => {
  const home = fs.readFileSync("public/admin/index.html", "utf8");
  const portals = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const shell = fs.readFileSync("public/js/modules/admin/shared/admin-auth-view.js", "utf8");
  const routes = fs.readFileSync("src/modules/admin/routes.js", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/admin-workspace.css", "utf8");
  const doc = fs.readFileSync("../docs/arquitetura/ADMIN_DESIGN_SYSTEM.md", "utf8");

  assert.doesNotMatch(`${home}\n${portals}\n${shell}`, /data-admin-palette|admin-palette-picker|ADMIN_PALETTES/);
  assert.doesNotMatch(routes, /admin\/me\/preferences|\.\/preferences\.js/);
  assert.match(css, /--workspace-sidebar: #ffffff/);
  assert.match(css, /--admin-primary: #3d4349/);
  assert.match(css, /\.is-sidebar-compact :where\([\s\S]*display: none !important/);
  assert.match(doc, /identidade institucional fixa/);
  assert.doesNotMatch(doc, /Seletor pessoal de paleta|escolha uma paleta propria/);
});

test("Central substitui o Criador livre pelo editor fixo do Portal do Hóspede", () => {
  const shell = fs.readFileSync("public/js/modules/admin/shared/admin-auth-view.js", "utf8");
  const portals = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");
  const html = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const editor = fs.readFileSync("public/js/modules/admin/guest-portal-editor.js", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/guest-portal-editor.css", "utf8");

  assert.doesNotMatch(shell, /\["portals", "Criador"/);
  assert.doesNotMatch(portals, /createVisualPortalBuilder|visual-portals|Novo portal visual/);
  assert.match(portals, /Portal do Hóspede/);
  assert.match(html, /id="guestPortalEditor"/);
  assert.match(html, /data-guest-device="desktop"/);
  assert.match(html, /data-guest-device="mobile"/);
  assert.match(editor, /fioreze:guest-portal-preview/);
  assert.match(editor, /SERVICE_KEYS = \["room-service", "emporio", "romantic-packages", "spa"\]/);
  assert.match(editor, /portal\.navigation_drawer_theme/);
  assert.match(css, /\.guest-portal-preview-frame\.is-mobile/);
  assert.match(css, /\.admin-portals-surface\[data-active-portal-section="contentManager"\]\s*\{[\s\S]*?padding:\s*0;[\s\S]*?overflow:\s*hidden/);
});

test("seletores de mídia permitem upload contextual sem sair do formulário", () => {
  const portals = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");
  const editor = fs.readFileSync("public/js/modules/admin/guest-portal-editor.js", "utf8");

  assert.match(portals, /data-inline-media-upload/);
  assert.match(portals, /context: "identity"/);
  assert.match(portals, /context: "event"/);
  assert.match(portals, /context: "area"/);
  assert.match(portals, /PORTALS_MEDIA_UPLOAD_PERMISSION/);
  assert.match(portals, /adminApi\("\/api\/v1\/admin\/media", \{ method: "POST", body: form \}\)/);
  assert.match(editor, /data-guest-media-upload/);
  assert.match(editor, /adminApi\("\/api\/v1\/admin\/media", \{ method: "POST", body: form \}\)/);
});

test("shells administrativos continuam respondendo sem fallback incorreto", async () => {
  const { fetch } = createWorkerTestContext();
  for (const path of ["/admin/", "/admin/configuracoes/", "/admin/portais/", "/admin/portais/portal-hospede/", "/admin/portais/unidades/", "/admin/portais/media/", "/admin/portais/links/", "/erp/room-service/"]) {
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
