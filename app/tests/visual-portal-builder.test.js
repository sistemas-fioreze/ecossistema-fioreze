import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";
import {
  archiveAdminVisualPortal,
  createAdminVisualPortal,
  createAdminVisualPortalTemplate,
  deleteAdminVisualPortal,
  duplicateAdminVisualPortal,
  getAdminVisualPortal,
  getAdminVisualPortalVersion,
  listAdminVisualPortalVersions,
  publishAdminVisualPortal,
  updateAdminVisualPortal,
} from "../src/modules/admin/visual-portals.js";
import { renderVisualPortalPage, serveVisualPortal } from "../src/modules/visual-portals/public.js";
import {
  collectVisualPortalMediaIds,
  createBlankVisualPortalDocument,
  normalizeVisualPortalDocument,
  visualPortalTemplateDocument,
} from "../src/services/visual-portal-document.js";
import {
  deleteVisualBlock,
  duplicateVisualBlock,
  moveVisualBlock,
  reorderVisualBlock,
} from "../public/js/modules/admin/portal-builder-state.js";
import { MockR2Bucket } from "./helpers/mock-d1.js";

const NOW = "2026-07-21T14:00:00.000Z";
const SESSION = {
  user: { id: "user-admin", display_name: "Administradora ficticia" },
  hotel_ids: ["muller-fioreze"],
  hotels: [{ hotel_id: "muller-fioreze", access_level: "owner" }],
  permissions: ["portals.hotels.read", "portals.hotels.settings"],
  password_change_required: false,
};

test("migration 0025 cria portais, versoes, modelos e indices multi-hotel", () => {
  const source = fs.readFileSync("migrations/0025_visual_portal_builder.sql", "utf8").toLowerCase();
  assert.match(source, /create table if not exists visual_portals/);
  assert.match(source, /create table if not exists visual_portal_versions/);
  assert.match(source, /create table if not exists visual_portal_templates/);
  assert.match(source, /unique \(hotel_id, slug\)/);
  assert.match(source, /check \(json_valid\(draft_document_json\)\)/);
  assert.match(source, /idx_visual_portals_hotel_module_status/);
  assert.match(source, /idx_visual_portal_templates_hotel_module_status/);
  assert.doesNotMatch(source, /insert into visual_portals|insert into visual_portal_templates/);
});

test("documento visual normaliza estilos responsivos e referencias de midia", () => {
  const document = normalizeVisualPortalDocument({
    schema_version: 1,
    settings: { primary_color: "#A8513E", font_family: "Inter, system-ui, sans-serif" },
    blocks: [
      {
        id: "capa-principal",
        type: "hero",
        content: { title: "Portal de teste", media_asset_id: "media_12345678", button_text: "Abrir", button_url: "/servicos" },
        styles: { base: { width: "wide", alignment: "center" }, desktop: { min_height: 620 }, mobile: { min_height: 420 } },
        visibility: { desktop: true, mobile: true },
      },
      {
        id: "galeria-principal",
        type: "gallery",
        content: { media_asset_ids: ["media_12345678", "media_87654321", "media_12345678"] },
        styles: { base: { columns: 3 }, desktop: {}, mobile: { columns: 1 } },
      },
    ],
  });

  assert.equal(document.settings.primary_color, "#a8513e");
  assert.equal(homeBlocks(document)[0].styles.desktop.min_height, 620);
  assert.deepEqual(collectVisualPortalMediaIds(document), ["media_12345678", "media_87654321"]);
});

test("documento visual rejeita codigo, links e referencias fora da lista permitida", () => {
  const blank = createBlankVisualPortalDocument();
  const unsafe = structuredClone(blank);
  homeBlocks(unsafe).push({
    id: "botao-inseguro",
    type: "button",
    content: { text: "Executar", url: "javascript:alert(1)" },
    styles: { base: {}, desktop: {}, mobile: {} },
  });
  assert.throws(() => normalizeVisualPortalDocument(unsafe), /endere[cç]o de link.*n[aã]o [eé] permitido/i);

  const invalidMedia = structuredClone(blank);
  homeBlocks(invalidMedia)[0].content.media_asset_id = "arquivo-fora-da-biblioteca";
  assert.throws(() => normalizeVisualPortalDocument(invalidMedia), /refer[eê]ncia de m[ií]dia inv[aá]lida/i);
});

test("modelos internos oferecem pagina completa, servico e tela livre", () => {
  const showcase = visualPortalTemplateDocument("showcase", { primary_color: "#17594a", font_family: "system-ui" });
  const service = visualPortalTemplateDocument("service");
  const blank = visualPortalTemplateDocument("blank");
  assert.ok(homeBlocks(showcase).some((block) => block.type === "feature-grid"));
  assert.equal(homeBlocks(showcase)[0].styles.mobile.heading_size, 48);
  assert.equal(homeBlocks(showcase).find((block) => block.type === "feature-grid").styles.mobile.columns, 1);
  assert.ok(homeBlocks(service).some((block) => block.type === "button"));
  assert.equal(homeBlocks(blank).length, 0);
});

test("modelos modernos incluem loja digital, campanha e agenda", () => {
  const store = visualPortalTemplateDocument("digital-store");
  const campaign = visualPortalTemplateDocument("campaign");
  const events = visualPortalTemplateDocument("events");
  assert.ok(homeBlocks(store).some((block) => block.id === "vitrine" && block.type === "feature-grid"));
  assert.equal(homeBlocks(store).find((block) => block.id === "vitrine").styles.base.border_radius, 24);
  assert.ok(homeBlocks(campaign).some((block) => block.id === "acao-campanha"));
  assert.ok(homeBlocks(events).some((block) => block.id === "agenda"));
});

test("pagina nativa de Room Service preserva isolamento, cabecalho do portal e contrato do editor", () => {
  const document = createBlankVisualPortalDocument();
  document.pages[0].settings.background_media_asset_id = "media_12345678";
  document.pages.push({
    id: "room-service",
    type: "room-service",
    slug: "room-service",
    name: "Room Service",
    title: "Room Service",
    show_in_navigation: true,
    settings: structuredClone(document.pages[0].settings),
    blocks: [],
  });
  const normalized = normalizeVisualPortalDocument(document);
  const page = normalized.pages[1];
  const media = new Map([["media_12345678", { public_url: "/media/media_12345678", mime_type: "video/mp4" }]]);
  const homeHtml = renderVisualPortalPage({
    portal: { title: "Portal", portal_slug: "estadia", hotel_name: "Hotel", hotel_slug: "hotel-ficticio", module_key: "guest-portal", locale: "pt-BR" },
    document: normalized,
    page: normalized.pages[0],
    media,
  });
  const html = renderVisualPortalPage({
    portal: { title: "Portal", portal_slug: "estadia", hotel_name: "Hotel", hotel_slug: "hotel-ficticio", module_key: "guest-portal", locale: "pt-BR" },
    document: normalized,
    page,
    media,
  });

  assert.equal(page.type, "room-service");
  assert.match(homeHtml, /class="page-background/);
  assert.match(homeHtml, /<video/);
  assert.match(html, /data-visual-room-service/);
  assert.match(html, /data-hotel-slug="hotel-ficticio"/);
  assert.match(html, /visual-portal-room-service\.js/);
  assert.match(html, /css\/modules\/room-service\/room-service\.css/);
  assert.match(html, /site-header[^"\n]*is-system-page/);
  assert.match(html, /site-header\.is-system-page\.has-blur:not\(\.is-transparent\)\{background:#fff/);
  assert.match(html, /--menu-toggle-bg:rgba\(255,255,255,\.9\)/);
  assert.doesNotMatch(html, /class="page-background/);
  assert.equal((html.match(/class="site-header/g) || []).length, 1);
  assert.doesNotMatch(html, /class="rs-mobile-header"|data-rs-loader/);

  const duplicated = structuredClone(document);
  duplicated.pages.push({ ...structuredClone(duplicated.pages[1]), id: "room-service-dois", slug: "cardapio" });
  assert.throws(() => normalizeVisualPortalDocument(duplicated), /somente uma página de Room Service/i);

  const withBlocks = structuredClone(document);
  withBlocks.pages[1].blocks.push(structuredClone(withBlocks.pages[0].blocks[0]));
  assert.throws(() => normalizeVisualPortalDocument(withBlocks), /não aceita blocos personalizados/i);
});

test("pagina nativa de Blog usa o feed oficial, o cabecalho branco e um unico contrato por portal", () => {
  const document = createBlankVisualPortalDocument();
  document.pages[0].settings.background_media_asset_id = "media_12345678";
  document.pages.push({
    id: "blog",
    type: "blog",
    slug: "blog",
    name: "Blog",
    title: "Blog",
    show_in_navigation: true,
    settings: structuredClone(document.pages[0].settings),
    blocks: [],
  });
  const normalized = normalizeVisualPortalDocument(document);
  const media = new Map([["media_12345678", { public_url: "/media/media_12345678", mime_type: "video/mp4" }]]);
  const html = renderVisualPortalPage({
    portal: { title: "Portal", portal_slug: "estadia", hotel_name: "Hotel", hotel_slug: "hotel-ficticio", module_key: "guest-portal", locale: "pt-BR" },
    document: normalized,
    page: normalized.pages[1],
    media,
  });

  assert.match(html, /data-visual-blog/);
  assert.match(html, /data-hotel-slug="hotel-ficticio"/);
  assert.match(html, /visual-portal-blog\.js/);
  assert.match(html, /css\/modules\/visual-portal-blog\.css/);
  assert.match(html, /site-header[^"\n]*is-system-page/);
  assert.doesNotMatch(html, /class="page-background/);
  assert.equal((html.match(/class="site-header/g) || []).length, 1);

  const duplicated = structuredClone(document);
  duplicated.pages.push({ ...structuredClone(duplicated.pages[1]), id: "blog-dois", slug: "noticias" });
  assert.throws(() => normalizeVisualPortalDocument(duplicated), /somente uma página de Blog/i);
});

test("pagina nativa de Eventos preserva o visual legado e um unico contrato por portal", () => {
  const document = createBlankVisualPortalDocument();
  document.pages[0].settings.background_media_asset_id = "media_12345678";
  document.pages.push({
    id: "events",
    type: "events",
    slug: "eventos",
    name: "Eventos",
    title: "Eventos",
    show_in_navigation: true,
    settings: structuredClone(document.pages[0].settings),
    blocks: [],
  });
  const normalized = normalizeVisualPortalDocument(document);
  const page = normalized.pages[1];
  const media = new Map([["media_12345678", { public_url: "/media/media_12345678", mime_type: "video/mp4" }]]);
  const html = renderVisualPortalPage({
    portal: {
      title: "Portal",
      portal_slug: "estadia",
      hotel_name: "Hotel fictício",
      hotel_short_name: "Hotel",
      hotel_slug: "hotel-ficticio",
      module_key: "guest-portal",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      primary_color: "#513b2d",
      accent_color: "#c1a94c",
    },
    document: normalized,
    page,
    media,
  });

  assert.equal(page.type, "events");
  assert.match(html, /data-visual-events/);
  assert.match(html, /data-hotel-slug="hotel-ficticio"/);
  assert.match(html, /data-timezone="America\/Sao_Paulo"/);
  assert.match(html, /visual-portal-events\.js/);
  assert.match(html, /css\/modules\/visual-portal-events\.css/);
  assert.match(html, /site-header[^"\n]*is-system-page/);
  assert.doesNotMatch(html, /class="page-background/);
  assert.equal((html.match(/class="site-header/g) || []).length, 1);

  const duplicated = structuredClone(document);
  duplicated.pages.push({ ...structuredClone(duplicated.pages[1]), id: "events-dois", slug: "programacao" });
  assert.throws(() => normalizeVisualPortalDocument(duplicated), /somente uma página de Eventos/i);

  const withBlocks = structuredClone(document);
  withBlocks.pages[1].blocks.push(structuredClone(withBlocks.pages[0].blocks[0]));
  assert.throws(() => normalizeVisualPortalDocument(withBlocks), /não aceita blocos personalizados/i);
});

test("bloco Evento em destaque usa a agenda publica sem fixar conteudo no portal", () => {
  const document = createBlankVisualPortalDocument();
  homeBlocks(document).push({
    id: "evento-principal",
    type: "event-highlight",
    content: {
      event_id: "event-ficticio",
      label: "Próxima experiência",
      button_text: "Ver programação",
      show_summary: true,
      show_date: true,
    },
    styles: { base: { border_radius: 24 }, desktop: {}, mobile: {} },
    visibility: { desktop: true, mobile: true },
  });
  const normalized = normalizeVisualPortalDocument(document);
  const block = homeBlocks(normalized).at(-1);
  const html = renderVisualPortalPage({
    portal: {
      title: "Portal",
      portal_slug: "estadia",
      hotel_name: "Hotel fictício",
      hotel_slug: "hotel-ficticio",
      module_key: "guest-portal",
      locale: "pt-BR",
      primary_color: "#513b2d",
      accent_color: "#c1a94c",
    },
    document: normalized,
  });

  assert.equal(block.content.event_id, "event-ficticio");
  assert.equal(block.content.label, "Próxima experiência");
  assert.match(html, /data-visual-event-highlight/);
  assert.match(html, /data-event-id="event-ficticio"/);
  assert.match(html, /data-button-text="Ver programação"/);
  assert.match(html, /visual-portal-events\.js/);
  assert.match(html, /css\/modules\/visual-portal-events\.css/);
});

test("documentos legados sao promovidos para site multipagina sem perder blocos", () => {
  const document = normalizeVisualPortalDocument({
    schema_version: 1,
    settings: { primary_color: "#513b2d", pwa: { install_enabled: true, app_name: "Aplicativo antigo" } },
    blocks: [{ id: "texto-legado", type: "text", content: { text: "Conteúdo preservado" }, styles: { base: {}, desktop: {}, mobile: {} } }],
  });
  assert.equal(document.schema_version, 2);
  assert.equal(document.pages.length, 1);
  assert.equal(document.pages[0].slug, "");
  assert.equal(document.pages[0].blocks[0].id, "texto-legado");
  assert.equal("pwa" in document.settings, false);
});

test("novos blocos normalizam limites e renderizam conteudo funcional", () => {
  const document = createBlankVisualPortalDocument();
  homeBlocks(document).push(
    { id: "duvidas", type: "faq", content: { title: "Dúvidas", items: [{ question: "Posso editar?", answer: "Sim, todo o conteúdo é editável." }] }, styles: { base: {}, desktop: {}, mobile: {} } },
    { id: "numeros", type: "stats", content: { title: "Indicadores", items: [{ value: "24h", label: "Atendimento" }] }, styles: { base: { columns: 3 }, desktop: {}, mobile: { columns: 1 } } },
    { id: "trajetoria", type: "timeline", content: { title: "Etapas", items: [{ period: "Agora", title: "Publicação", text: "Conteúdo disponível no portal." }] }, styles: { base: {}, desktop: {}, mobile: {} } },
    { id: "depoimentos", type: "testimonials", content: { title: "Relatos", items: [{ quote: "Estadia excelente", author: "Visitante", role: "Hóspede" }] }, styles: { base: { columns: 2 }, desktop: {}, mobile: { columns: 1 } } },
    { id: "facilidades", type: "icon-list", content: { title: "Facilidades", items: [{ icon: "map-pin", title: "Localização", text: "Perto de tudo." }] }, styles: { base: { columns: 2 }, desktop: {}, mobile: { columns: 1 } } },
    { id: "chamada", type: "cta-banner", content: { title: "Reserve sua experiência", text: "Escolha como continuar.", buttons: [{ text: "Conhecer", url: "page:inicio", icon: "arrow-right", style: "solid" }] }, styles: { base: { border_radius: 28 }, desktop: {}, mobile: {} } },
  );
  const normalized = normalizeVisualPortalDocument(document);
  const html = renderVisualPortalPage({ portal: { title: "Portal", portal_slug: "site", hotel_name: "Hotel", hotel_slug: "hotel", module_key: "guest-portal", locale: "pt-BR" }, document: normalized });
  assert.match(html, /class="block-inner faq-block"/);
  assert.match(html, /<details><summary>/);
  assert.match(html, /class="stats-grid"/);
  assert.match(html, /class="timeline-list"/);
  assert.match(html, /class="testimonials-grid"/);
  assert.match(html, /class="icon-list-grid"/);
  assert.match(html, /class="block-inner cta-banner"/);
  assert.match(html, /Atendimento/);
  assert.match(html, /Publicação/);
});

test("cabecalho, cards e botoes aceitam alinhamento, transparencia e midia", () => {
  const document = createBlankVisualPortalDocument();
  document.settings.header.desktop_navigation_alignment = "left";
  document.settings.header.mobile_menu_background_color = "#102030cc";
  document.settings.header.mobile_menu_text_color = "#ffffffff";
  document.settings.header.mobile_menu_blur = false;
  const hero = homeBlocks(document)[0];
  hero.content.buttons = [
    { text: "Agenda", url: "page:inicio", icon: "calendar", style: "solid" },
    { text: "Galeria", url: "page:inicio", media_asset_id: "media_12345678", style: "outline" },
  ];
  homeBlocks(document).push({
    id: "servicos-overlay",
    type: "feature-grid",
    content: { layout: "overlay", text_background_color: "#11111199", text_color: "#f4ead7", text_background_blur: 18, items: [{ title: "Spa", text: "Bem-estar", media_asset_id: "media_12345678" }] },
    styles: { base: { border_radius: 32 }, desktop: {}, mobile: {} },
    visibility: { desktop: true, mobile: true },
  });
  const normalized = normalizeVisualPortalDocument(document);
  const html = renderVisualPortalPage({
    portal: { title: "Portal", portal_slug: "site", hotel_name: "Hotel", hotel_slug: "hotel", module_key: "guest-portal", locale: "pt-BR" },
    document: normalized,
    media: new Map([["media_12345678", { id: "media_12345678", public_url: "/media/media_12345678", mime_type: "image/webp" }]]),
  });
  assert.equal(normalized.settings.header.mobile_menu_background_color, "#102030cc");
  assert.match(html, /navigation-left/);
  assert.match(html, /--mobile-menu-bg:#102030cc/);
  assert.doesNotMatch(html, /mobile-navigation has-menu-blur/);
  assert.match(html, /feature-grid is-overlay/);
  assert.match(html, /--card-copy-background:#11111199/);
  assert.match(html, /--card-copy-text:#f4ead7/);
  assert.match(html, /--card-copy-blur:18px/);
  assert.match(html, /color:var\(--card-copy-text,#fff\)/);
  assert.match(html, /blur\(var\(--card-copy-blur,12px\)\)/);
  assert.equal(normalized.pages[0].blocks.at(-1).content.text_background_blur, 18);
  assert.match(html, /class="button-media"/);
  assert.deepEqual(collectVisualPortalMediaIds(normalized), ["media_12345678"]);
});

test("cards de servico legados recebem cor e desfoque compativeis", () => {
  const document = createBlankVisualPortalDocument();
  homeBlocks(document).push({
    id: "servicos-legado",
    type: "feature-grid",
    content: { layout: "overlay", text_background_color: "#202124aa", items: [{ title: "Serviço", text: "Descrição" }] },
    styles: { base: {}, desktop: {}, mobile: {} },
    visibility: { desktop: true, mobile: true },
  });
  const content = normalizeVisualPortalDocument(document).pages[0].blocks.at(-1).content;
  assert.equal(content.text_color, "#ffffff");
  assert.equal(content.text_background_blur, 12);
});

test("slug personalizado altera a rota e os links internos sem mudar o id da pagina", () => {
  const document = visualPortalTemplateDocument("guest-portal-classic");
  const services = document.pages.find((page) => page.id === "servicos");
  services.slug = "experiencias-do-hotel";
  const normalized = normalizeVisualPortalDocument(document);
  const html = renderVisualPortalPage({ portal: { title: "Portal", portal_slug: "site", hotel_name: "Hotel", hotel_slug: "hotel", module_key: "guest-portal", locale: "pt-BR" }, document: normalized });
  assert.match(html, /href="\/hotel\/site\/experiencias-do-hotel"/);
  assert.doesNotMatch(html, /href="\/hotel\/site\/servicos"/);
});

test("modelo do Portal do Hospede oferece paginas, navegacao e links internos", () => {
  const document = visualPortalTemplateDocument("guest-portal-classic", { primary_color: "#8c3d2f", font_family: "system-ui" });
  assert.deepEqual(document.pages.map((page) => page.slug), ["", "servicos", "eventos", "hotel", "blog", "como-chegar"]);
  assert.equal(document.settings.header.style, "floating");
  assert.equal(homeBlocks(document)[0].content.button_url, "page:servicos");
  const html = renderVisualPortalPage({
    portal: { title: "Portal", portal_slug: "inicio", hotel_name: "Hotel", hotel_short_name: "Hotel", hotel_slug: "hotel-ficticio", module_key: "guest-portal", locale: "pt-BR" },
    document,
  });
  assert.match(html, /href="\/hotel-ficticio\/inicio\/servicos"/);
  assert.match(renderVisualPortalPage({
    portal: { title: "Portal", portal_slug: "inicio", hotel_name: "Hotel", hotel_short_name: "Hotel", hotel_slug: "hotel-ficticio", module_key: "guest-portal", locale: "pt-BR" },
    document,
    page: document.pages.find((page) => page.id === "servicos"),
  }), /href="\/hotel-ficticio\/room-service"/);
  assert.match(html, /Navega[cç][aã]o do site/);
  assert.match(html, /data-mobile-menu-toggle/);
  assert.match(html, /class="mobile-navigation/);
});

test("cabecalho respeita visibilidade, transparencia e paginas ocultas", () => {
  const document = visualPortalTemplateDocument("guest-portal-classic");
  document.settings.header.transparent = true;
  document.pages.find((page) => page.id === "blog").show_in_navigation = false;
  const portal = { title: "Portal", portal_slug: "inicio", hotel_name: "Hotel", hotel_short_name: "Hotel", hotel_slug: "hotel-ficticio", module_key: "guest-portal", locale: "pt-BR" };
  const html = renderVisualPortalPage({ portal, document });
  assert.match(html, /site-header[^"\n]*is-transparent/);
  assert.doesNotMatch(html, />Blog<\/a>/);
  assert.match(html, />Serviços<\/a>/);

  document.settings.header.enabled = false;
  assert.doesNotMatch(renderVisualPortalPage({ portal, document }), /class="site-header/);
});

test("slug reservado do Room Service nao pode ser usado por portal personalizado", async () => {
  await assert.rejects(
    () => createAdminVisualPortal({
      request: jsonRequest("POST", {
        hotel_id: "muller-fioreze",
        module_key: "guest-portal",
        slug: "room-service",
        name: "Conflito de rota",
        title: "Conflito de rota",
        template_key: "blank",
      }),
      env: createSqliteEnv(),
      session: SESSION,
    }),
    (error) => error.status === 400,
  );
});

test("acoes de bloco movem, duplicam, reordenam e excluem o alvo correto", () => {
  const document = {
    blocks: [
      { id: "primeiro", type: "text", content: { text: "A" } },
      { id: "segundo", type: "text", content: { text: "B" } },
      { id: "terceiro", type: "text", content: { text: "C" } },
    ],
  };
  assert.equal(moveVisualBlock(document, "segundo", -1).changed, true);
  assert.deepEqual(document.blocks.map((block) => block.id), ["segundo", "primeiro", "terceiro"]);
  assert.equal(duplicateVisualBlock(document, "primeiro", "primeiro-copia").selectedId, "primeiro-copia");
  assert.deepEqual(document.blocks.map((block) => block.id), ["segundo", "primeiro", "primeiro-copia", "terceiro"]);
  assert.equal(reorderVisualBlock(document, "terceiro", 0).changed, true);
  assert.deepEqual(document.blocks.map((block) => block.id), ["terceiro", "segundo", "primeiro", "primeiro-copia"]);
  const deleted = deleteVisualBlock(document, "segundo");
  assert.equal(deleted.removed.id, "segundo");
  assert.deepEqual(document.blocks.map((block) => block.id), ["terceiro", "primeiro", "primeiro-copia"]);
});

test("fundo de pagina, posicao responsiva e incorporacao HTTPS sao normalizados", () => {
  const document = createBlankVisualPortalDocument();
  document.pages[0].settings.background_media_asset_id = "media_background01";
  document.pages[0].settings.background_overlay = 42;
  document.pages[0].settings.background_position = "top";
  document.pages[0].settings.background_fixed = true;
  homeBlocks(document)[0].styles.desktop.offset_x = 36;
  homeBlocks(document)[0].styles.mobile.offset_y = -24;
  homeBlocks(document).push({
    id: "mapa-incorporado",
    type: "embed",
    content: { title: "Mapa", url: "https://www.google.com/maps/embed?pb=demo", aspect_ratio: "4:3", allow_fullscreen: true },
    styles: { base: { border_radius: 24 }, desktop: {}, mobile: {} },
    visibility: { desktop: true, mobile: true },
  });
  document.settings.favicon_media_asset_id = "media_12345678";
  document.pages.push({
    id: "servicos",
    slug: "servicos",
    name: "Serviços",
    title: "Serviços",
    show_in_navigation: true,
    settings: structuredClone(document.pages[0].settings),
    blocks: [{ id: "servicos-titulo", type: "heading", content: { title: "Serviços", text: "Conteúdo fictício" }, styles: { base: {}, desktop: {}, mobile: {} }, visibility: { desktop: true, mobile: true } }],
  });
  const normalized = normalizeVisualPortalDocument(document);
  assert.deepEqual(collectVisualPortalMediaIds(normalized), ["media_12345678", "media_background01"]);
  assert.equal(homeBlocks(normalized)[0].styles.desktop.offset_x, 36);
  assert.equal(homeBlocks(normalized)[0].styles.mobile.offset_y, -24);
  assert.equal(homeBlocks(normalized)[1].content.aspect_ratio, "4:3");

  const media = new Map([["media_background01", { id: "media_background01", public_url: "/media/media_background01", mime_type: "video/mp4", alt_text: "" }]]);
  const html = renderVisualPortalPage({
    portal: { title: "Portal", hotel_name: "Hotel", hotel_slug: "hotel", module_key: "guest-portal", locale: "pt-BR" },
    document: normalized,
    media,
  });
  assert.match(html, /class="page-background is-fixed"/);
  assert.match(html, /<video muted loop autoplay playsinline/);
  assert.match(html, /class="block-inner embed-frame"/);
  assert.match(html, /sandbox="allow-scripts allow-forms allow-popups allow-presentation"/);
  assert.doesNotMatch(html, /allow-presentation allow-same-origin/);
  assert.match(html, /--desktop-offset-x:36px/);
});

test("incorporacao rejeita protocolos e destinos locais", () => {
  for (const url of ["javascript:alert(1)", "http://example.com/frame", "https://localhost/map", "https://192.168.1.10/frame", "https://[::1]/frame", "https://169.254.1.1/frame"]) {
    const document = createBlankVisualPortalDocument();
    homeBlocks(document).push({ id: "embed-invalido", type: "embed", content: { url }, styles: { base: {}, desktop: {}, mobile: {} } });
    assert.throws(() => normalizeVisualPortalDocument(document), /incorporado.*n[aã]o [eé] permitido|incorporado [eé] inv[aá]lido/i);
  }
});

test("HTML incorporado e sanitizado e isolado sem permissao de scripts", () => {
  const document = createBlankVisualPortalDocument();
  homeBlocks(document).push({
    id: "html-incorporado",
    type: "embed",
    content: { mode: "html", title: "Conteúdo", html: '<section onclick="alert(1)"><h2>Conteúdo seguro</h2><script>roubar()</script></section>', aspect_ratio: "16:9" },
    styles: { base: {}, desktop: {}, mobile: {} },
    visibility: { desktop: true, mobile: true },
  });
  const normalized = normalizeVisualPortalDocument(document);
  const embed = homeBlocks(normalized).at(-1);
  assert.match(embed.content.html, /Conteúdo seguro/);
  assert.doesNotMatch(embed.content.html, /script|onclick/i);
  const html = renderVisualPortalPage({ portal: { title: "Portal", portal_slug: "site", hotel_name: "Hotel", hotel_slug: "hotel", module_key: "guest-portal", locale: "pt-BR" }, document: normalized });
  assert.match(html, /srcdoc=/);
  assert.match(html, /sandbox="allow-forms allow-popups allow-presentation"/);
  assert.doesNotMatch(html, /srcdoc=.*allow-scripts/);
});

test("tipografia responsiva e limitada e renderizada por dispositivo", () => {
  const document = createBlankVisualPortalDocument();
  homeBlocks(document)[0].styles.desktop.heading_size = 92;
  homeBlocks(document)[0].styles.desktop.width = "wide";
  homeBlocks(document)[0].styles.mobile.heading_size = 44;
  homeBlocks(document)[0].styles.mobile.text_size = 15;
  homeBlocks(document)[0].styles.mobile.width = "narrow";
  const normalized = normalizeVisualPortalDocument(document);
  const html = renderVisualPortalPage({
    portal: {
      title: "Portal responsivo",
      hotel_name: "Hotel ficticio",
      hotel_slug: "hotel-ficticio",
      module_key: "guest-portal",
      locale: "pt-BR",
    },
    document: normalized,
  });
  assert.match(html, /--desktop-heading-size:92px/);
  assert.match(html, /--desktop-width:1440px/);
  assert.match(html, /--mobile-heading-size:44px/);
  assert.match(html, /--mobile-text-size:15px/);
  assert.match(html, /--mobile-width:720px/);

  const invalid = structuredClone(document);
  homeBlocks(invalid)[0].styles.mobile.heading_size = 161;
  assert.throws(() => normalizeVisualPortalDocument(invalid), /valor visual fora do intervalo/i);
});

test("CRUD visual salva versoes, valida isolamento e publica renderizacao segura", async () => {
  const env = createSqliteEnv();
  const created = await createAdminVisualPortal({
    request: jsonRequest("POST", {
      hotel_id: "muller-fioreze",
      module_key: "guest-portal",
      slug: "experiencias",
      name: "Portal de experiencias",
      title: "Experiencias Fioreze",
      template_key: "showcase",
    }),
    env,
    session: SESSION,
  });
  assert.equal(created.portal.status, "draft");
  assert.equal(created.portal.draft_revision, 1);
  assert.equal(created.portal.public_url, "https://portal.hoteisfioreze.com.br/muller-fioreze/experiencias");

  const document = structuredClone(created.portal.document);
  homeBlocks(document).push({
    id: "imagem-hotel",
    type: "image",
    content: { media_asset_id: "media_12345678", alt_text: "Imagem ficticia", caption: "", fit: "cover" },
    styles: { base: { width: "wide", border_radius: 8 }, desktop: {}, mobile: {} },
    visibility: { desktop: true, mobile: true },
  });
  document.settings.favicon_media_asset_id = "media_12345678";
  document.pages.push({
    id: "servicos",
    slug: "servicos",
    name: "Serviços",
    title: "Serviços",
    show_in_navigation: true,
    settings: structuredClone(document.pages[0].settings),
    blocks: [{
      id: "servicos-titulo",
      type: "heading",
      content: { title: "Serviços", text: "Conteúdo fictício" },
      styles: { base: {}, desktop: {}, mobile: {} },
      visibility: { desktop: true, mobile: true },
    }],
  });
  document.pages.push({
    id: "room-service",
    type: "room-service",
    slug: "room-service",
    name: "Room Service",
    title: "Room Service",
    show_in_navigation: true,
    settings: structuredClone(document.pages[0].settings),
    blocks: [],
  });
  document.pages.push({
    id: "blog",
    type: "blog",
    slug: "blog",
    name: "Blog",
    title: "Blog",
    show_in_navigation: true,
    settings: structuredClone(document.pages[0].settings),
    blocks: [],
  });
  const updated = await updateAdminVisualPortal({
    request: jsonRequest("PATCH", { document, expected_revision: 1 }),
    env,
    session: SESSION,
    portalId: created.portal.id,
  });
  assert.equal(updated.portal.draft_revision, 2);
  assert.equal(updated.portal.has_unpublished_changes, true);

  const versions = await listAdminVisualPortalVersions({ env, session: SESSION, portalId: created.portal.id });
  assert.equal(versions.versions.length, 2);
  const version = await getAdminVisualPortalVersion({ env, session: SESSION, portalId: created.portal.id, versionId: versions.versions[0].id });
  assert.equal(version.version.document.pages.length, 4);

  const published = await publishAdminVisualPortal({
    request: jsonRequest("POST", {}), env, session: SESSION, portalId: created.portal.id,
  });
  assert.equal(published.portal.status, "published");
  assert.equal(published.portal.published_revision, 2);
  assert.equal(published.portal.has_unpublished_changes, false);

  const response = await serveVisualPortal({ env, params: { hotel_slug: "muller-fioreze", portal_slug: "experiencias" } });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy") || "", /script-src 'self'/);
  assert.match(html, /Experiencias Fioreze/);
  assert.match(html, /\/media\/media_12345678/);
  assert.match(html, /visual-portal-runtime\.js/);
  assert.match(html, /rel="icon"/);

  const servicesResponse = await serveVisualPortal({ env, params: { hotel_slug: "muller-fioreze", portal_slug: "experiencias", page_slug: "servicos" } });
  assert.equal(servicesResponse.status, 200);
  assert.match(await servicesResponse.text(), /Conteúdo fictício/);
  const roomServicePageResponse = await serveVisualPortal({ env, params: { hotel_slug: "muller-fioreze", portal_slug: "experiencias", page_slug: "room-service" } });
  const roomServicePageHtml = await roomServicePageResponse.text();
  assert.equal(roomServicePageResponse.status, 200);
  assert.match(roomServicePageResponse.headers.get("content-security-policy") || "", /connect-src 'self'/);
  assert.match(roomServicePageResponse.headers.get("content-security-policy") || "", /style-src 'self' 'unsafe-inline'/);
  assert.match(roomServicePageHtml, /data-visual-room-service/);
  assert.match(roomServicePageHtml, /visual-portal-room-service\.js/);
  const blogPageResponse = await serveVisualPortal({ env, params: { hotel_slug: "muller-fioreze", portal_slug: "experiencias", page_slug: "blog" } });
  const blogPageHtml = await blogPageResponse.text();
  assert.equal(blogPageResponse.status, 200);
  assert.match(blogPageResponse.headers.get("content-security-policy") || "", /connect-src 'self'/);
  assert.match(blogPageResponse.headers.get("content-security-policy") || "", /img-src 'self' data: https:/);
  assert.match(blogPageHtml, /data-visual-blog/);
  assert.match(blogPageHtml, /visual-portal-blog\.js/);
  await assert.rejects(
    () => serveVisualPortal({ env, params: { hotel_slug: "muller-fioreze", portal_slug: "experiencias", page_slug: "inexistente" } }),
    (error) => error.status === 404,
  );
  await assert.rejects(
    () => serveVisualPortal({ env, params: { hotel_slug: "muller-fioreze", portal_slug: "experiencias", resource: "removed-installation-resource" } }),
    (error) => error.status === 404,
  );

  env.ASSETS = {
    fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const canonical = await worker.fetch(new Request(created.portal.public_url), env, ctx);
  const canonicalHead = await worker.fetch(new Request(created.portal.public_url, { method: "HEAD" }), env, ctx);
  const legacyPrefix = await worker.fetch(new Request("https://portal.hoteisfioreze.com.br/portal/muller-fioreze/experiencias"), env, ctx);
  const legacyHome = await worker.fetch(new Request("https://portal.hoteisfioreze.com.br/muller-fioreze"), env, ctx);
  const unknownLegacyTab = await worker.fetch(new Request("https://portal.hoteisfioreze.com.br/muller-fioreze/inicio"), env, ctx);
  const legacyHtml = await worker.fetch(new Request("https://portal.hoteisfioreze.com.br/portal-content/muller-fioreze/boas-vindas"), env, ctx);
  const roomService = await worker.fetch(new Request("https://portal.hoteisfioreze.com.br/muller-fioreze/room-service"), env, ctx);
  const removedManifest = await worker.fetch(new Request(`${created.portal.public_url}/manifest.webmanifest`), env, ctx);
  const removedServiceWorker = await worker.fetch(new Request(`${created.portal.public_url}/sw.js`), env, ctx);

  assert.equal(canonical.status, 200);
  assert.match(await canonical.text(), /Experiencias Fioreze/);
  assert.equal(canonicalHead.status, 200);
  assert.equal(await canonicalHead.text(), "");
  assert.equal(legacyPrefix.status, 308);
  assert.equal(legacyPrefix.headers.get("location"), created.portal.public_url);
  assert.equal(legacyHome.status, 404);
  assert.equal(unknownLegacyTab.status, 404);
  assert.equal(legacyHtml.status, 404);
  assert.equal(roomService.status, 200);
  assert.equal(await roomService.text(), "asset:/");
  assert.equal(removedManifest.status, 404);
  assert.equal(removedServiceWorker.status, 404);
  assert.doesNotMatch(await removedManifest.text(), /<html/i);

  const otherSession = { ...SESSION, hotel_ids: ["aurora-demo"], hotels: [{ hotel_id: "aurora-demo" }] };
  await assert.rejects(
    () => getAdminVisualPortal({ request: jsonRequest("GET"), env, session: otherSession, portalId: created.portal.id }),
    (error) => error.status === 404,
  );

  await assert.rejects(
    () => createAdminVisualPortalTemplate({
      request: jsonRequest("POST", { hotel_id: "muller-fioreze", module_key: "emporio", name: "Modelo cruzado", source_portal_id: created.portal.id }),
      env,
      session: SESSION,
    }),
    (error) => error.status === 404,
  );

  await createAdminVisualPortalTemplate({
    request: jsonRequest("POST", { hotel_id: "muller-fioreze", module_key: "guest-portal", name: "Modelo da equipe", source_portal_id: created.portal.id }),
    env,
    session: SESSION,
  });
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS total FROM visual_portal_templates").get().total, 1);

  await assert.rejects(
    () => deleteAdminVisualPortal({ request: jsonRequest("DELETE", {}), env, session: SESSION, portalId: created.portal.id }),
    (error) => error.status === 400,
  );
  await archiveAdminVisualPortal({ request: jsonRequest("DELETE", {}), env, session: SESSION, portalId: created.portal.id });
  await assert.rejects(
    () => serveVisualPortal({ env, params: { hotel_slug: "muller-fioreze", portal_slug: "experiencias" } }),
    (error) => error.status === 404,
  );
  const deleted = await deleteAdminVisualPortal({ request: jsonRequest("DELETE", {}), env, session: SESSION, portalId: created.portal.id });
  assert.equal(deleted.deleted, true);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS total FROM visual_portals WHERE id = ?").get(created.portal.id).total, 0);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS total FROM visual_portal_versions WHERE portal_id = ?").get(created.portal.id).total, 0);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS total FROM admin_audit_log WHERE action = 'visual-portal.delete' AND entity_id = ?").get(created.portal.id).total, 1);
});

test("clonagem para outra unidade copia midias e reescreve referencias", async () => {
  const env = createSqliteEnv();
  await env.MEDIA_BUCKET.put("hotels/muller-fioreze/guest-portal/2026/07/media_12345678.webp", new Uint8Array([82, 73, 70, 70]), {
    httpMetadata: { contentType: "image/webp" },
  });
  const session = {
    ...SESSION,
    hotel_ids: ["muller-fioreze", "aurora-demo"],
    hotels: [{ hotel_id: "muller-fioreze" }, { hotel_id: "aurora-demo" }],
    permissions: [...SESSION.permissions, "portals.media.read", "portals.media.upload"],
  };
  const created = await createAdminVisualPortal({
    request: jsonRequest("POST", { hotel_id: "muller-fioreze", module_key: "guest-portal", slug: "origem", name: "Portal origem", title: "Portal origem", template_key: "blank" }),
    env,
    session,
  });
  const document = structuredClone(created.portal.document);
  document.settings.favicon_media_asset_id = "media_12345678";
  homeBlocks(document).push({ id: "foto", type: "image", content: { media_asset_id: "media_12345678", alt_text: "Foto fictícia" }, styles: { base: {}, desktop: {}, mobile: {} }, visibility: { desktop: true, mobile: true } });
  await updateAdminVisualPortal({ request: jsonRequest("PATCH", { document, expected_revision: 1 }), env, session, portalId: created.portal.id });

  const duplicated = await duplicateAdminVisualPortal({
    request: jsonRequest("POST", { hotel_id: "aurora-demo", module_key: "guest-portal", slug: "copia", name: "Portal copiado", title: "Portal copiado" }),
    env,
    session,
    portalId: created.portal.id,
  });
  const copiedMediaIds = collectVisualPortalMediaIds(duplicated.portal.document);
  assert.equal(duplicated.portal.hotel_id, "aurora-demo");
  assert.equal(copiedMediaIds.length, 1);
  assert.notEqual(copiedMediaIds[0], "media_12345678");
  assert.equal(env.DB.raw.prepare("SELECT hotel_id FROM media_assets WHERE id = ?").get(copiedMediaIds[0]).hotel_id, "aurora-demo");
  assert.equal(env.MEDIA_BUCKET.objects.size, 2);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS total FROM admin_audit_log WHERE action = 'media.copy'").get().total, 1);
});

test("renderer escapa textos e nunca transforma conteudo em script", () => {
  const document = createBlankVisualPortalDocument();
  homeBlocks(document)[0].content.title = '<img src=x onerror="alert(1)">';
  homeBlocks(document)[0].content.text = "<script>segredo()</script>";
  const html = renderVisualPortalPage({
    portal: {
      title: "Portal seguro",
      hotel_name: "Hotel ficticio",
      hotel_short_name: "Hotel",
      hotel_slug: "hotel-ficticio",
      module_key: "guest-portal",
      locale: "pt-BR",
      logo_url: "",
    },
    document,
    media: new Map(),
  });
  assert.doesNotMatch(html, /<img src=x/i);
  assert.match(html, /<script src="\/js\/modules\/visual-portal-runtime\.js" defer><\/script>/);
  assert.doesNotMatch(html, /onerror="/i);
  assert.match(html, /&lt;script&gt;segredo\(\)&lt;\/script&gt;/);
});

test("Central integra construtor visual e Worker-first preserva a rota publica", () => {
  const html = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const portals = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");
  const builder = fs.readFileSync("public/js/modules/admin/portal-builder.js", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/portal-builder.css", "utf8");
  const wrangler = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
  assert.match(html, /id="contentManager"/);
  assert.doesNotMatch(html, /data-content-type="(?:pages|custom_pages|events|information)"/);
  assert.doesNotMatch(html, /data-unit-tab="(?:modules|navigation)"/);
  assert.match(html, /portal-builder\.css/);
  assert.match(portals, /createVisualPortalBuilder/);
  assert.match(portals, /\/admin\/creator\//);
  assert.match(portals, /searchParams\.set\("portal"/);
  assert.match(portals, /searchParams\.set\("page"/);
  assert.match(builder, /onPageChange/);
  assert.match(builder, /application\/x-fioreze-block-type/);
  assert.match(builder, /data-viewport="desktop"/);
  assert.match(builder, /data-viewport="mobile"/);
  assert.match(builder, /closest\("button\[data-viewport\]"\)/);
  assert.match(builder, /data-preview-viewport="desktop"/);
  assert.match(builder, /data-preview-viewport="mobile"/);
  assert.match(builder, /data-builder-tab="pages"/);
  assert.match(builder, /data-builder-open-public/);
  assert.match(builder, /data-editor-page-link/);
  assert.match(builder, /data-toggle-scope/);
  assert.match(builder, /role="switch"/);
  assert.match(builder, /data-add-page/);
  assert.match(builder, /data-add-room-service-page/);
  assert.match(builder, /data-add-blog-page/);
  assert.match(builder, /data-add-events-page/);
  assert.match(builder, /Página conectada ao cardápio/);
  assert.match(builder, /Página conectada ao Blog Fioreze/);
  assert.match(builder, /Página conectada à agenda/);
  assert.match(builder, /data-preview-version/);
  assert.match(builder, /autosave_interval_seconds/);
  assert.match(builder, /data-header-field/);
  assert.doesNotMatch(builder, /data-pwa-field|Aplicativo instalável|install_enabled/);
  assert.match(builder, /data-link-page/);
  assert.match(builder, /Room Service da unidade/);
  assert.match(builder, /data-media-target="page"/);
  assert.match(builder, /data-media-hotel/);
  assert.match(builder, /data-media-upload/);
  assert.match(builder, /media-folders/);
  assert.match(builder, /event\.type === "input" && event\.target\.matches\("select"\)/);
  assert.match(builder, /data-color-control/);
  assert.match(builder, /Cor do texto/);
  assert.match(builder, /Desfoque do fundo/);
  assert.match(builder, /--vp-card-copy-text/);
  assert.match(builder, /--vp-card-copy-blur/);
  assert.match(builder, /text_background_blur/);
  assert.match(builder, /data-add-action-button/);
  assert.match(builder, /desktop_navigation_alignment/);
  assert.match(builder, /data-reset-position/);
  assert.match(builder, /type === "embed"/);
  assert.match(builder, /visual-portal-templates/);
  assert.match(builder, /fitCanvas\(true\)/);
  assert.doesNotMatch(builder, /window\.(?:alert|confirm|prompt)\(/);
  const runtime = fs.readFileSync("public/js/modules/visual-portal-runtime.js", "utf8");
  const roomServiceRuntime = fs.readFileSync("public/js/modules/visual-portal-room-service.js", "utf8");
  const blogRuntime = fs.readFileSync("public/js/modules/visual-portal-blog.js", "utf8");
  const eventsRuntime = fs.readFileSync("public/js/modules/visual-portal-events.js", "utf8");
  const eventsCss = fs.readFileSync("public/css/modules/visual-portal-events.css", "utf8");
  const roomServiceModule = fs.readFileSync("public/js/modules/room-service/index.js", "utf8");
  assert.doesNotMatch(runtime, /beforeinstallprompt|serviceWorker|data-install-app/);
  assert.match(runtime, /data-mobile-menu-toggle/);
  assert.doesNotMatch(runtime, /window\.(?:alert|confirm|prompt)\(/);
  assert.match(roomServiceRuntime, /presentation: "portal-page"/);
  assert.match(roomServiceRuntime, /hotelSlug/);
  assert.match(blogRuntime, /portal\/blog/);
  assert.match(blogRuntime, /blog\.hoteisfioreze\.com\.br/);
  assert.match(eventsRuntime, /portal\/events/);
  assert.match(eventsRuntime, /visual-events-calendar/);
  assert.match(eventsRuntime, /visual-event-dialog/);
  assert.match(eventsCss, /\.visual-event-card/);
  assert.match(eventsCss, /\.visual-event-dialog/);
  assert.match(roomServiceModule, /bootstrap\.modules/);
  assert.match(builder, /\["faq", "Perguntas frequentes"/);
  assert.match(builder, /\["stats", "Indicadores"/);
  assert.match(builder, /\["timeline", "Linha do tempo"/);
  assert.match(builder, /\["testimonials", "Depoimentos"/);
  assert.match(builder, /\["icon-list", "Lista com ícones"/);
  assert.match(builder, /\["cta-banner", "Chamada destacada"/);
  assert.match(builder, /\["event-highlight", "Evento em destaque"/);
  assert.match(html, /id="eventsManager"/);
  assert.match(portals, /Data de início/);
  assert.match(portals, /Descrição completa/);
  assert.match(portals, /Botão de ação opcional/);
  assert.match(portals, /Unidade de destino/);
  assert.match(css, /grid-template-columns:\s*286px minmax\(0, 1fr\) 318px/);
  assert.match(css, /\.vp-live-preview\[data-viewport="mobile"\]/);
  assert.doesNotMatch(portals, /\["modulos", "Áreas"/);
  assert.doesNotMatch(portals, /\["navegacao", "Navegação"/);
  assert.match(portals, /module_key: "guest-portal"/);
  assert.deepEqual(wrangler.assets.run_worker_first, ["/*"]);
  assert.equal(wrangler.vars.VISUAL_PORTAL_PUBLIC_ORIGIN, "https://portal.hoteisfioreze.com.br");
});

function createSqliteEnv() {
  const raw = new DatabaseSync(":memory:");
  raw.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE hotels (id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT, short_name TEXT, timezone TEXT, locale TEXT, status TEXT, archived_at TEXT);
    CREATE TABLE modules (module_key TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE hotel_modules (hotel_id TEXT, module_key TEXT, enabled INTEGER, is_public INTEGER, PRIMARY KEY (hotel_id, module_key));
    CREATE TABLE hotel_branding (hotel_id TEXT PRIMARY KEY, logo_url TEXT, icon_url TEXT, primary_color TEXT, secondary_color TEXT, accent_color TEXT, background_color TEXT, text_color TEXT, font_family TEXT);
    CREATE TABLE admin_users (id TEXT PRIMARY KEY, display_name TEXT);
    CREATE TABLE admin_audit_log (id TEXT PRIMARY KEY, hotel_id TEXT, module_key TEXT, actor_user_id TEXT, action TEXT, entity_type TEXT, entity_id TEXT, metadata_json TEXT, created_at TEXT);
    CREATE TABLE media_assets (
      id TEXT PRIMARY KEY, hotel_id TEXT, module_key TEXT, folder_id TEXT,
      storage_provider TEXT, object_key TEXT, public_url TEXT, alt_text TEXT,
      mime_type TEXT, status TEXT, created_at TEXT, updated_at TEXT,
      archived_at TEXT, original_filename TEXT, size_bytes INTEGER,
      checksum_sha256 TEXT, storage_etag TEXT, uploaded_by_user_id TEXT,
      archived_by_user_id TEXT
    );
    INSERT INTO hotels VALUES ('muller-fioreze','muller-fioreze','Muller ficticio','Muller','America/Sao_Paulo','pt-BR','active',NULL);
    INSERT INTO hotels VALUES ('aurora-demo','aurora-demo','Aurora ficticio','Aurora','America/Sao_Paulo','pt-BR','active',NULL);
    INSERT INTO modules VALUES ('guest-portal','Portal do Hospede'), ('emporio','Emporio'), ('room-service','Room Service'), ('admin','Admin');
    INSERT INTO hotel_modules VALUES ('muller-fioreze','guest-portal',1,1), ('muller-fioreze','emporio',1,1), ('muller-fioreze','room-service',1,1), ('muller-fioreze','admin',1,0), ('aurora-demo','guest-portal',1,1);
    INSERT INTO hotel_branding VALUES ('muller-fioreze','/assets/hotels/muller-fioreze/logo.png',NULL,'#17594a','#f2b84b','#8c3d2f','#f7f4ee','#202124','system-ui');
    INSERT INTO admin_users VALUES ('user-admin','Administradora ficticia');
    INSERT INTO media_assets (
      id, hotel_id, module_key, folder_id, storage_provider, object_key,
      public_url, alt_text, mime_type, status, created_at, updated_at,
      archived_at, original_filename, size_bytes, checksum_sha256,
      storage_etag, uploaded_by_user_id, archived_by_user_id
    ) VALUES (
      'media_12345678','muller-fioreze','guest-portal',NULL,'r2',
      'hotels/muller-fioreze/guest-portal/2026/07/media_12345678.webp',
      '/media/media_12345678','Imagem ficticia','image/webp','active',
      '2026-07-21T14:00:00.000Z','2026-07-21T14:00:00.000Z',NULL,
      'imagem-ficticia.webp',4,'checksum-ficticio',NULL,'user-admin',NULL
    );
  `);
  raw.exec(fs.readFileSync("migrations/0025_visual_portal_builder.sql", "utf8"));
  return {
    DB: new SqliteD1(raw),
    MEDIA_BUCKET: new MockR2Bucket(),
    ENVIRONMENT: "test",
    VISUAL_PORTAL_PUBLIC_ORIGIN: "https://portal.hoteisfioreze.com.br",
  };
}

class SqliteD1 {
  constructor(raw) {
    this.raw = raw;
  }

  prepare(sql) {
    return new SqliteD1Statement(this.raw, sql);
  }

  async batch(statements) {
    this.raw.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.raw.exec("COMMIT");
      return results;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }
}

class SqliteD1Statement {
  constructor(raw, sql, params = []) {
    this.raw = raw;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new SqliteD1Statement(this.raw, this.sql, params);
  }

  async first() {
    return this.raw.prepare(this.sql).get(...this.params) || null;
  }

  async all() {
    return { results: this.raw.prepare(this.sql).all(...this.params) };
  }

  async run() {
    const result = this.raw.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(result.changes || 0) } };
  }
}

function jsonRequest(method, body = undefined) {
  return new Request("https://local.test/api/v1/admin/visual-portals", {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      origin: "https://local.test",
      "x-fioreze-admin-action": "erp-admin",
      "x-fioreze-test-now": NOW,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function homeBlocks(document) {
  return document.pages.find((page) => page.slug === "")?.blocks || [];
}
