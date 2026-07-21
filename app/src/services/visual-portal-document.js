import { badRequest } from "../core/errors.js";
import { isSafeIdentifier } from "../core/identifiers.js";
import { sanitizeCustomHtml } from "./custom-html-sanitizer.js";

export const VISUAL_PORTAL_SCHEMA_VERSION = 2;
export const VISUAL_PORTAL_MAX_BLOCKS = 120;
export const VISUAL_PORTAL_MAX_PAGES = 20;
export const VISUAL_PORTAL_MAX_BYTES = 250000;

export const VISUAL_PORTAL_BLOCK_TYPES = new Set([
  "hero", "heading", "text", "button", "image", "video", "embed",
  "gallery", "feature-grid", "quote", "contact", "divider", "spacer",
]);

const ALIGNMENTS = new Set(["left", "center", "right"]);
const WIDTHS = new Set(["narrow", "content", "wide", "full"]);
const BUTTON_STYLES = new Set(["solid", "outline", "ghost"]);
const MEDIA_FITS = new Set(["cover", "contain"]);
const BACKGROUND_POSITIONS = new Set(["center", "top", "bottom", "left", "right"]);
const EMBED_RATIOS = new Set(["16:9", "4:3", "1:1", "9:16"]);
const EMBED_MODES = new Set(["url", "html"]);
const HEADER_STYLES = new Set(["standard", "centered", "floating", "minimal"]);
const HEADER_POSITIONS = new Set(["static", "sticky"]);
const PWA_DISPLAYS = new Set(["standalone", "minimal-ui", "browser"]);
const COLOR_PATTERN = /^(#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i;
const MEDIA_ID_PATTERN = /^media_[a-z0-9-]{8,80}$/i;

export function createBlankVisualPortalDocument({ primaryColor = "#513b2d", fontFamily = "Inter, system-ui, sans-serif" } = {}) {
  const settings = normalizeDocumentSettings({ primary_color: primaryColor, font_family: fontFamily });
  return {
    schema_version: VISUAL_PORTAL_SCHEMA_VERSION,
    settings,
    pages: [createPage({
      id: "inicio",
      slug: "",
      name: "Início",
      title: "Início",
      show_in_navigation: true,
      settings: pageSettingsFromDocument(settings),
      blocks: [
        normalizeBlock({
          id: "hero-principal",
          type: "hero",
          content: {
            eyebrow: "Bem-vindo",
            title: "Uma nova experiência começa aqui",
            text: "Edite este conteúdo e transforme este site no portal da sua unidade.",
            button_text: "Conheça nossos serviços",
            button_url: "page:servicos",
          },
          styles: {
            base: { alignment: "center", width: "wide", padding_top: 88, padding_bottom: 88, min_height: 420 },
            desktop: {},
            mobile: { padding_top: 56, padding_bottom: 56, padding_inline: 18, min_height: 360, heading_size: 48, text_size: 16 },
          },
          visibility: { desktop: true, mobile: true },
        }, 0),
      ],
    }, 0, settings)],
  };
}

export function normalizeVisualPortalDocument(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("O documento visual deve ser um objeto.");
  assertDocumentSize(input);
  const sourceVersion = Number(input.schema_version || 1);
  if (![1, VISUAL_PORTAL_SCHEMA_VERSION].includes(sourceVersion)) throw badRequest("Versão do documento visual não suportada.");

  const settings = normalizeDocumentSettings(input.settings || {});
  const sourcePages = sourceVersion === 1
    ? [legacyPage(input, settings)]
    : input.pages;
  if (!Array.isArray(sourcePages) || !sourcePages.length) throw badRequest("O site precisa conter pelo menos uma página.");
  if (sourcePages.length > VISUAL_PORTAL_MAX_PAGES) throw badRequest("O site excede o limite de páginas.");

  const pageIds = new Set();
  const pageSlugs = new Set();
  let totalBlocks = 0;
  const pages = sourcePages.map((page, index) => {
    const normalized = createPage(page, index, settings);
    if (pageIds.has(normalized.id)) throw badRequest("Existem páginas com o mesmo identificador.");
    if (pageSlugs.has(normalized.slug)) throw badRequest("Existem páginas com o mesmo endereço.");
    pageIds.add(normalized.id);
    pageSlugs.add(normalized.slug);
    totalBlocks += normalized.blocks.length;
    return normalized;
  });
  if (totalBlocks > VISUAL_PORTAL_MAX_BLOCKS) throw badRequest("O site excede o limite total de blocos.");
  if (!pages.some((page) => page.slug === "")) throw badRequest("O site precisa ter uma página inicial.");
  if (pages.filter((page) => page.slug === "").length !== 1) throw badRequest("O site deve ter somente uma página inicial.");

  const document = { schema_version: VISUAL_PORTAL_SCHEMA_VERSION, settings, pages };
  assertDocumentSize(document, "O site normalizado excede o tamanho permitido.");
  return document;
}

export function getVisualPortalPage(document, pageSlug = "") {
  const normalizedSlug = String(pageSlug || "").trim().toLowerCase();
  return document.pages?.find((page) => page.slug === normalizedSlug) || null;
}

export function collectVisualPortalMediaIds(document) {
  const ids = new Set();
  addMediaId(ids, document.settings?.favicon_media_asset_id);
  addMediaId(ids, document.settings?.header?.logo_media_asset_id);
  for (const page of document.pages || []) {
    addMediaId(ids, page.settings?.background_media_asset_id);
    for (const block of page.blocks || []) {
      addMediaId(ids, block.content?.media_asset_id);
      addMediaId(ids, block.content?.poster_media_asset_id);
      for (const mediaId of block.content?.media_asset_ids || []) addMediaId(ids, mediaId);
      for (const item of block.content?.items || []) addMediaId(ids, item.media_asset_id);
    }
  }
  return [...ids];
}

export function visualPortalTemplateDocument(templateKey, branding = {}) {
  const primaryColor = branding.primary_color || "#513b2d";
  const fontFamily = branding.font_family || "Inter, system-ui, sans-serif";
  const base = createBlankVisualPortalDocument({ primaryColor, fontFamily });
  if (templateKey === "blank") return normalizeVisualPortalDocument({ ...base, pages: [{ ...base.pages[0], blocks: [] }] });
  if (templateKey === "guest-portal-classic") return guestPortalClassicTemplate(base);

  const home = base.pages[0];
  const templateBlocks = {
    showcase: [
      { ...home.blocks[0], content: { ...home.blocks[0].content, title: "Descubra tudo o que preparamos para você", text: "Serviços, experiências e informações em um único lugar." } },
      block("heading", "titulo-experiencias", { title: "Experiências em destaque", text: "Escolha por onde começar." }, { alignment: "center" }),
      block("feature-grid", "experiencias", { items: [
        { title: "Gastronomia", text: "Sabores selecionados para cada momento.", button_text: "Explorar", button_url: "page:servicos" },
        { title: "Bem-estar", text: "Uma pausa para cuidar de você.", button_text: "Conhecer", button_url: "page:servicos" },
        { title: "Eventos", text: "Programação especial durante sua estadia.", button_text: "Ver agenda", button_url: "page:eventos" },
      ] }, { columns: 3, border_radius: 24 }),
      block("quote", "mensagem", { quote: "Cada detalhe foi pensado para tornar sua experiência memorável.", author: "Equipe Fioreze" }, { alignment: "center" }),
    ],
    service: [
      { ...home.blocks[0], content: { ...home.blocks[0].content, eyebrow: "Serviços", title: "Tudo ao seu alcance", text: "Apresente seu serviço com imagens, benefícios e uma chamada clara para ação." } },
      block("heading", "titulo-beneficios", { title: "Por que escolher", text: "Destaque os principais diferenciais do serviço." }),
      block("feature-grid", "beneficios", { items: [
        { title: "Atendimento cuidadoso", text: "Uma experiência pensada nos detalhes." },
        { title: "Conforto", text: "Praticidade durante toda a sua estadia." },
        { title: "Qualidade", text: "Seleção e execução com padrão Fioreze." },
      ] }, { columns: 3, border_radius: 24 }),
      block("button", "acao-principal", { text: "Solicitar serviço", url: "page:contato" }, { alignment: "center" }),
    ],
    "digital-store": [
      { ...home.blocks[0], content: { ...home.blocks[0].content, eyebrow: "Loja digital", title: "Escolhas especiais, em um só lugar", text: "Apresente produtos, experiências e coleções com uma navegação clara e convidativa.", button_text: "Explorar coleção", button_url: "page:colecao" }, styles: { ...home.blocks[0].styles, base: { ...home.blocks[0].styles.base, border_radius: 28 } } },
      block("heading", "titulo-colecao", { title: "Destaques da loja", text: "Organize seus produtos em vitrines modernas e responsivas." }, { alignment: "center" }),
      block("feature-grid", "vitrine", { items: [
        { title: "Seleção da casa", text: "Uma curadoria para ocasiões especiais.", button_text: "Ver detalhes", button_url: "page:colecao" },
        { title: "Presentes", text: "Opções prontas para surpreender.", button_text: "Conhecer", button_url: "page:colecao" },
        { title: "Experiências", text: "Momentos criados para aproveitar a estadia.", button_text: "Descobrir", button_url: "page:colecao" },
      ] }, { columns: 3, border_radius: 24 }),
      block("contact", "atendimento-loja", { title: "Precisa de ajuda?", text: "Nossa equipe está à disposição para orientar sua escolha.", button_text: "Falar com a equipe", button_url: "page:contato" }, { border_radius: 24, background_color: "#ffffff", padding_inline: 36 }),
    ],
    campaign: [
      { ...home.blocks[0], content: { ...home.blocks[0].content, eyebrow: "Novidade", title: "Uma campanha que merece destaque", text: "Conte a história, apresente os benefícios e conduza o visitante para uma ação clara." }, styles: { ...home.blocks[0].styles, base: { ...home.blocks[0].styles.base, border_radius: 28, min_height: 560 } } },
      block("text", "historia", { text: "Use este espaço para desenvolver a mensagem principal com clareza e personalidade." }, { width: "narrow", text_size: 18, border_radius: 20 }),
      block("button", "acao-campanha", { text: "Quero saber mais", url: "page:contato", style: "solid" }, { alignment: "center" }),
    ],
    events: [
      { ...home.blocks[0], content: { ...home.blocks[0].content, eyebrow: "Agenda", title: "Experiências para viver agora", text: "Apresente eventos, datas especiais e atrações em uma página visual." }, styles: { ...home.blocks[0].styles, base: { ...home.blocks[0].styles.base, border_radius: 28 } } },
      block("feature-grid", "agenda", { items: [
        { title: "Experiência gastronômica", text: "Data, horário e detalhes do evento.", button_text: "Ver programação", button_url: "page:eventos" },
        { title: "Música e encontros", text: "Uma programação para aproveitar cada momento.", button_text: "Abrir agenda", button_url: "page:eventos" },
      ] }, { columns: 2, border_radius: 24 }),
    ],
  }[templateKey];
  if (!templateBlocks) throw badRequest("Modelo visual não encontrado.");
  return normalizeVisualPortalDocument({ ...base, pages: [{ ...home, blocks: templateBlocks }] });
}

function guestPortalClassicTemplate(base) {
  const pageSettings = base.pages[0].settings;
  const pages = [
    {
      id: "inicio", slug: "", name: "Início", title: "Início", show_in_navigation: true, settings: pageSettings,
      blocks: [
        { ...base.pages[0].blocks[0], content: { ...base.pages[0].blocks[0].content, eyebrow: "Olá, seja bem-vindo", title: "Bem-vindo à sua melhor experiência", text: "Tudo o que você precisa para aproveitar sua estadia com conforto e praticidade.", button_text: "Conhecer serviços", button_url: "page:servicos" } },
        block("heading", "titulo-servicos", { title: "Serviços do hotel", text: "Escolha o que deseja acessar durante a sua estadia." }, { alignment: "center" }),
        block("feature-grid", "atalhos", { items: [
          { title: "Gastronomia", text: "Cardápios e experiências selecionadas.", button_text: "Ver serviços", button_url: "page:servicos" },
          { title: "Eventos", text: "Programação e novidades da unidade.", button_text: "Ver agenda", button_url: "page:eventos" },
          { title: "Como chegar", text: "Rotas, localização e orientações.", button_text: "Abrir mapa", button_url: "page:como-chegar" },
        ] }, { columns: 3, border_radius: 24 }),
      ],
    },
    sitePage("servicos", "servicos", "Serviços", [
      block("heading", "servicos-titulo", { title: "Serviços", text: "Tudo ao seu alcance em um único lugar." }, { alignment: "center", padding_top: 72 }),
      block("feature-grid", "servicos-grade", { items: [
        { title: "Room Service", text: "Consulte o cardápio e faça seu pedido.", button_text: "Abrir", button_url: "module:room-service" },
        { title: "Experiências", text: "Descubra as opções disponíveis na unidade.", button_text: "Conhecer", button_url: "page:hotel" },
      ] }, { columns: 2, border_radius: 24 }),
    ], pageSettings),
    sitePage("eventos", "eventos", "Eventos", [
      block("heading", "eventos-titulo", { title: "Eventos", text: "Experiências, avisos e novidades durante a sua estadia." }, { alignment: "center", padding_top: 72 }),
      block("feature-grid", "eventos-grade", { items: [
        { title: "Programação especial", text: "Adicione aqui os eventos e seus detalhes.", button_text: "Saiba mais", button_url: "page:eventos" },
        { title: "Novidades", text: "Divulgue atrações e experiências da temporada.", button_text: "Conhecer", button_url: "page:eventos" },
      ] }, { columns: 2, border_radius: 24 }),
    ], pageSettings),
    sitePage("hotel", "hotel", "Hotel", [
      block("hero", "hotel-capa", { eyebrow: "Nossa unidade", title: "Tudo para uma estadia memorável", text: "Apresente a história, a estrutura e os diferenciais do hotel.", button_text: "Como chegar", button_url: "page:como-chegar" }, { alignment: "center", min_height: 460, border_radius: 24 }),
      block("contact", "hotel-contato", { title: "Fale com a equipe", text: "Estamos à disposição durante toda a sua estadia.", address: "Endereço da unidade", phone: "", email: "", button_text: "Como chegar", button_url: "page:como-chegar" }, { border_radius: 24 }),
    ], pageSettings),
    sitePage("blog", "blog", "Blog", [
      block("heading", "blog-titulo", { title: "Blog Fioreze", text: "Novidades, dicas e conteúdos para aproveitar Gramado." }, { alignment: "center", padding_top: 72 }),
      block("feature-grid", "blog-grade", { items: [
        { title: "Descubra a cidade", text: "Publique roteiros, dicas e novidades.", button_text: "Ler artigo", button_url: "page:blog" },
        { title: "Experiências Fioreze", text: "Conte histórias da unidade e da região.", button_text: "Ler artigo", button_url: "page:blog" },
      ] }, { columns: 2, border_radius: 24 }),
    ], pageSettings),
    sitePage("como-chegar", "como-chegar", "Como chegar", [
      block("heading", "mapa-titulo", { title: "Como chegar", text: "Consulte rotas e pontos de referência da unidade." }, { alignment: "center", padding_top: 72 }),
      block("embed", "mapa", { title: "Mapa da unidade", mode: "url", url: "", html: "", aspect_ratio: "16:9", allow_fullscreen: true }, { border_radius: 24 }),
      block("contact", "mapa-contato", { title: "Precisa de ajuda?", text: "Nossa equipe pode orientar o melhor acesso.", address: "Endereço da unidade", phone: "", email: "", button_text: "", button_url: "" }, { border_radius: 24 }),
    ], pageSettings),
  ];
  return normalizeVisualPortalDocument({
    ...base,
    settings: {
      ...base.settings,
      header: { ...base.settings.header, style: "floating", position: "sticky", blur: true },
      pwa: { ...base.settings.pwa, app_name: "Portal do Hóspede", short_name: "Portal" },
    },
    pages,
  });
}

function sitePage(id, slug, name, blocks, settings) {
  return { id, slug, name, title: name, show_in_navigation: true, settings, blocks };
}

function legacyPage(input, settings) {
  if (!Array.isArray(input.blocks)) throw badRequest("O portal precisa conter uma lista de blocos.");
  return { id: "inicio", slug: "", name: "Início", title: "Início", show_in_navigation: true, settings: pageSettingsFromDocument(settings), blocks: input.blocks };
}

function createPage(input, index, documentSettings) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest(`Página ${index + 1} inválida.`);
  const id = String(input.id || `pagina-${index + 1}`).trim().toLowerCase();
  if (!isSafeIdentifier(id) || id.length > 80) throw badRequest(`Identificador da página ${index + 1} inválido.`);
  const slug = input.slug == null ? (index === 0 ? "" : id) : String(input.slug).trim().toLowerCase();
  if (slug && (!isSafeIdentifier(slug) || slug.length > 80 || ["manifest.webmanifest", "sw.js"].includes(slug))) throw badRequest(`Endereço da página ${index + 1} inválido.`);
  if (!Array.isArray(input.blocks)) throw badRequest(`A página ${index + 1} precisa conter uma lista de blocos.`);
  const ids = new Set();
  const blocks = input.blocks.map((item, blockIndex) => {
    const normalized = normalizeBlock(item, blockIndex);
    if (ids.has(normalized.id)) throw badRequest(`A página ${index + 1} possui blocos duplicados.`);
    ids.add(normalized.id);
    return normalized;
  });
  return {
    id,
    slug,
    name: requiredText(input.name || input.title || (slug ? titleFromSlug(slug) : "Início"), 100, "nome da página"),
    title: requiredText(input.title || input.name || "Página", 180, "título da página"),
    show_in_navigation: input.show_in_navigation !== false,
    settings: normalizePageSettings(input.settings || {}, documentSettings),
    blocks,
  };
}

function normalizeDocumentSettings(input) {
  const primaryColor = normalizeColor(input.primary_color || "#513b2d", "cor principal");
  return {
    background_color: normalizeColor(input.background_color || "#ffffff", "cor de fundo"),
    text_color: normalizeColor(input.text_color || "#202124", "cor do texto"),
    primary_color: primaryColor,
    surface_color: normalizeColor(input.surface_color || "#f7f7f7", "cor de superfície"),
    font_family: normalizeFontFamily(input.font_family),
    content_width: normalizeEnum(input.content_width, WIDTHS, "content"),
    page_padding: normalizeNumber(input.page_padding, 0, 80, 24),
    block_gap: normalizeNumber(input.block_gap, 0, 80, 24),
    background_media_asset_id: mediaId(input.background_media_asset_id),
    background_overlay: normalizeNumber(input.background_overlay, 0, 90, 0),
    background_position: normalizeEnum(input.background_position, BACKGROUND_POSITIONS, "center"),
    background_fit: normalizeEnum(input.background_fit, MEDIA_FITS, "cover"),
    background_fixed: Boolean(input.background_fixed),
    favicon_media_asset_id: mediaId(input.favicon_media_asset_id),
    header: normalizeHeaderSettings(input.header || {}, primaryColor),
    pwa: normalizePwaSettings(input.pwa || {}),
    editor: {
      autosave_enabled: input.editor?.autosave_enabled !== false,
      autosave_interval_seconds: normalizeNumber(input.editor?.autosave_interval_seconds, 15, 120, 30),
    },
  };
}

function normalizeHeaderSettings(input, primaryColor) {
  return {
    enabled: input.enabled !== false,
    position: normalizeEnum(input.position, HEADER_POSITIONS, "sticky"),
    style: normalizeEnum(input.style, HEADER_STYLES, "standard"),
    background_color: normalizeColor(input.background_color || "#ffffff", "fundo do cabeçalho"),
    text_color: normalizeColor(input.text_color || "#202124", "texto do cabeçalho"),
    accent_color: normalizeColor(input.accent_color || primaryColor, "destaque do cabeçalho"),
    logo_media_asset_id: mediaId(input.logo_media_asset_id),
    show_logo: input.show_logo !== false,
    show_navigation: input.show_navigation !== false,
    transparent: Boolean(input.transparent),
    blur: input.blur !== false,
    cta_text: text(input.cta_text, 80),
    cta_url: safeUrl(input.cta_url),
  };
}

function normalizePwaSettings(input) {
  return {
    install_enabled: Boolean(input.install_enabled),
    app_name: text(input.app_name, 80),
    short_name: text(input.short_name, 30),
    description: text(input.description, 180),
    display: normalizeEnum(input.display, PWA_DISPLAYS, "standalone"),
  };
}

function normalizePageSettings(input, fallback) {
  return {
    background_color: normalizeColor(input.background_color || fallback.background_color, "cor de fundo da página"),
    text_color: normalizeColor(input.text_color || fallback.text_color, "cor do texto da página"),
    surface_color: normalizeColor(input.surface_color || fallback.surface_color, "cor de superfície da página"),
    content_width: normalizeEnum(input.content_width, WIDTHS, fallback.content_width),
    page_padding: normalizeNumber(input.page_padding, 0, 80, fallback.page_padding),
    block_gap: normalizeNumber(input.block_gap, 0, 80, fallback.block_gap),
    background_media_asset_id: mediaId(input.background_media_asset_id),
    background_overlay: normalizeNumber(input.background_overlay, 0, 90, fallback.background_overlay || 0),
    background_position: normalizeEnum(input.background_position, BACKGROUND_POSITIONS, fallback.background_position || "center"),
    background_fit: normalizeEnum(input.background_fit, MEDIA_FITS, fallback.background_fit || "cover"),
    background_fixed: Boolean(input.background_fixed),
  };
}

function pageSettingsFromDocument(settings) {
  return normalizePageSettings(settings, settings);
}

function block(type, id, content, baseStyles = {}) {
  const mobileStyles = {};
  if (["feature-grid", "gallery"].includes(type)) mobileStyles.columns = 1;
  if (type === "heading") mobileStyles.heading_size = 38;
  if (type === "quote") mobileStyles.heading_size = 30;
  return normalizeBlock({ id, type, content, styles: { base: baseStyles, desktop: {}, mobile: mobileStyles }, visibility: { desktop: true, mobile: true } }, 0);
}

function normalizeBlock(input, index) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest(`Bloco ${index + 1} inválido.`);
  const type = String(input.type || "").trim();
  if (!VISUAL_PORTAL_BLOCK_TYPES.has(type)) throw badRequest(`Tipo de bloco não permitido: ${type || "vazio"}.`);
  const id = String(input.id || `${type}-${index + 1}`).trim().toLowerCase();
  if (!isSafeIdentifier(id) || id.length > 80) throw badRequest(`Identificador do bloco ${index + 1} inválido.`);
  return {
    id,
    type,
    content: normalizeBlockContent(type, input.content || {}),
    styles: {
      base: normalizeBlockStyles(input.styles?.base || {}),
      desktop: normalizeBlockStyles(input.styles?.desktop || {}),
      mobile: normalizeBlockStyles(input.styles?.mobile || {}),
    },
    visibility: { desktop: input.visibility?.desktop !== false, mobile: input.visibility?.mobile !== false },
  };
}

function normalizeBlockContent(type, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Conteúdo de bloco inválido.");
  if (type === "hero") return { eyebrow: text(input.eyebrow, 100), title: text(input.title, 220), text: text(input.text, 1200), button_text: text(input.button_text, 80), button_url: safeUrl(input.button_url), media_asset_id: mediaId(input.media_asset_id), overlay: normalizeNumber(input.overlay, 0, 90, 35) };
  if (type === "heading") return { title: text(input.title, 220), text: text(input.text, 1000) };
  if (type === "text") return { text: text(input.text, 5000) };
  if (type === "button") return { text: text(input.text, 80), url: safeUrl(input.url), style: normalizeEnum(input.style, BUTTON_STYLES, "solid") };
  if (type === "image") return { media_asset_id: mediaId(input.media_asset_id), alt_text: text(input.alt_text, 300), caption: text(input.caption, 500), fit: normalizeEnum(input.fit, MEDIA_FITS, "cover") };
  if (type === "video") return { media_asset_id: mediaId(input.media_asset_id), poster_media_asset_id: mediaId(input.poster_media_asset_id), title: text(input.title, 180), autoplay: Boolean(input.autoplay), muted: input.muted !== false, loop: Boolean(input.loop), controls: input.controls !== false };
  if (type === "embed") {
    const mode = normalizeEnum(input.mode || (input.html ? "html" : "url"), EMBED_MODES, "url");
    return {
      title: text(input.title, 180),
      mode,
      url: mode === "url" ? safeEmbedUrl(input.url) : "",
      html: mode === "html" ? safeEmbedHtml(input.html) : "",
      aspect_ratio: normalizeEnum(input.aspect_ratio, EMBED_RATIOS, "16:9"),
      allow_fullscreen: input.allow_fullscreen !== false,
    };
  }
  if (type === "gallery") return { title: text(input.title, 180), media_asset_ids: uniqueMediaIds(input.media_asset_ids, 24) };
  if (type === "feature-grid") return { items: normalizeFeatureItems(input.items) };
  if (type === "quote") return { quote: text(input.quote, 1800), author: text(input.author, 160) };
  if (type === "contact") return { title: text(input.title, 180), text: text(input.text, 1200), phone: phone(input.phone), email: email(input.email), address: text(input.address, 500), button_text: text(input.button_text, 80), button_url: safeUrl(input.button_url) };
  if (type === "divider") return { label: text(input.label, 100) };
  return {};
}

function normalizeFeatureItems(items) {
  if (items == null) return [];
  if (!Array.isArray(items) || items.length > 12) throw badRequest("A grade excede o limite de itens.");
  return items.map((item) => ({ title: text(item?.title, 160), text: text(item?.text, 1000), media_asset_id: mediaId(item?.media_asset_id), button_text: text(item?.button_text, 80), button_url: safeUrl(item?.button_url) }));
}

function normalizeBlockStyles(input) {
  return {
    alignment: normalizeEnum(input.alignment, ALIGNMENTS, undefined),
    width: normalizeEnum(input.width, WIDTHS, undefined),
    background_color: optionalColor(input.background_color, "fundo do bloco"),
    text_color: optionalColor(input.text_color, "texto do bloco"),
    accent_color: optionalColor(input.accent_color, "destaque do bloco"),
    padding_top: optionalNumber(input.padding_top, 0, 200),
    padding_bottom: optionalNumber(input.padding_bottom, 0, 200),
    padding_inline: optionalNumber(input.padding_inline, 0, 120),
    gap: optionalNumber(input.gap, 0, 80),
    min_height: optionalNumber(input.min_height, 0, 1200),
    border_radius: optionalNumber(input.border_radius, 0, 48),
    columns: optionalNumber(input.columns, 1, 4),
    heading_size: optionalNumber(input.heading_size, 18, 160),
    text_size: optionalNumber(input.text_size, 12, 40),
    offset_x: optionalNumber(input.offset_x, -320, 320),
    offset_y: optionalNumber(input.offset_y, -320, 320),
  };
}

function safeEmbedHtml(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length > 40000) throw badRequest("O HTML incorporado excede o tamanho permitido.");
  return sanitizeCustomHtml(normalized).html;
}

function safeUrl(value) {
  const normalized = text(value, 1000);
  if (!normalized) return "";
  if (/^(?:page:[a-z0-9][a-z0-9-]{0,79}|module:room-service)$/i.test(normalized)) return normalized.toLowerCase();
  if (/^#[a-z0-9][a-z0-9-_:.]{0,79}$/i.test(normalized)) return normalized;
  if (normalized.startsWith("/") && !normalized.startsWith("//")) return normalized;
  if (/^(https:\/\/|mailto:|tel:)/i.test(normalized)) return normalized;
  throw badRequest("Um endereço de link do portal não é permitido.");
}

function safeEmbedUrl(value) {
  const normalized = text(value, 2000);
  if (!normalized) return "";
  let url;
  try { url = new URL(normalized); } catch { throw badRequest("O endereço incorporado é inválido."); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateHostname(hostname)) throw badRequest("O endereço incorporado não é permitido.");
  return url.toString();
}

function isPrivateHostname(hostname) {
  if (hostname.startsWith("[") || hostname.includes(":")) return true;
  if (/^(?:127|10)\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname) || /^198\.(?:18|19)\./.test(hostname)) return true;
  const shared = hostname.match(/^100\.(\d{1,3})\./);
  if (shared && Number(shared[1]) >= 64 && Number(shared[1]) <= 127) return true;
  const match = hostname.match(/^172\.(\d{1,3})\./);
  return Boolean((match && Number(match[1]) >= 16 && Number(match[1]) <= 31) || hostname === "0.0.0.0" || hostname === "::1" || hostname.endsWith(".local"));
}

function text(value, max) {
  if (value == null) return "";
  if (typeof value !== "string") throw badRequest("Um texto do bloco possui formato inválido.");
  const normalized = value.trim();
  if (normalized.length > max) throw badRequest("Um texto do bloco excede o limite permitido.");
  return normalized;
}

function requiredText(value, max, label) {
  const normalized = text(String(value || ""), max);
  if (!normalized) throw badRequest(`${label} é obrigatório.`);
  return normalized;
}

function addMediaId(target, value) { if (typeof value === "string" && value) target.add(value); }
function assertDocumentSize(value, message = "O portal excede o tamanho permitido.") { if (new TextEncoder().encode(JSON.stringify(value)).byteLength > VISUAL_PORTAL_MAX_BYTES) throw badRequest(message); }
function titleFromSlug(value) { return String(value).split("-").map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "").join(" "); }
function normalizeColor(value, label) { const normalized = String(value || "").trim(); if (!COLOR_PATTERN.test(normalized)) throw badRequest(`${label} inválida.`); return normalized.toLowerCase(); }
function optionalColor(value, label) { return value == null || value === "" ? undefined : normalizeColor(value, label); }
function normalizeFontFamily(value) { const normalized = String(value || "Inter, system-ui, sans-serif").trim(); if (!/^[\p{L}\p{N}\s,'"-]{2,180}$/u.test(normalized)) throw badRequest("Família tipográfica inválida."); return normalized; }
function normalizeEnum(value, allowed, fallback) { if (value == null || value === "") return fallback; const normalized = String(value); if (!allowed.has(normalized)) throw badRequest("Opção visual inválida."); return normalized; }
function normalizeNumber(value, min, max, fallback) { if (value == null || value === "") return fallback; const normalized = Number(value); if (!Number.isFinite(normalized) || normalized < min || normalized > max) throw badRequest("Valor visual fora do intervalo permitido."); return Math.round(normalized); }
function optionalNumber(value, min, max) { return value == null || value === "" ? undefined : normalizeNumber(value, min, max, undefined); }
function mediaId(value) { if (value == null || value === "") return ""; const normalized = String(value).trim(); if (!MEDIA_ID_PATTERN.test(normalized)) throw badRequest("Referência de mídia inválida."); return normalized; }
function uniqueMediaIds(values, max) { if (values == null) return []; if (!Array.isArray(values) || values.length > max) throw badRequest("A galeria excede o limite de mídias."); return [...new Set(values.map(mediaId).filter(Boolean))]; }
function phone(value) { const normalized = text(value, 40); if (normalized && !/^[+\d\s().-]+$/.test(normalized)) throw badRequest("Telefone inválido."); return normalized; }
function email(value) { const normalized = text(value, 180); if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw badRequest("E-mail inválido."); return normalized; }
