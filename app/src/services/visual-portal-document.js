import { badRequest } from "../core/errors.js";
import { isSafeIdentifier } from "../core/identifiers.js";

export const VISUAL_PORTAL_SCHEMA_VERSION = 1;
export const VISUAL_PORTAL_MAX_BLOCKS = 120;
export const VISUAL_PORTAL_MAX_BYTES = 250000;

export const VISUAL_PORTAL_BLOCK_TYPES = new Set([
  "hero",
  "heading",
  "text",
  "button",
  "image",
  "video",
  "gallery",
  "feature-grid",
  "quote",
  "contact",
  "divider",
  "spacer",
]);

const ALIGNMENTS = new Set(["left", "center", "right"]);
const WIDTHS = new Set(["narrow", "content", "wide", "full"]);
const BUTTON_STYLES = new Set(["solid", "outline", "ghost"]);
const MEDIA_FITS = new Set(["cover", "contain"]);
const COLOR_PATTERN = /^(#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i;
const MEDIA_ID_PATTERN = /^media_[a-z0-9-]{8,80}$/i;

export function createBlankVisualPortalDocument({ primaryColor = "#513b2d", fontFamily = "Inter, system-ui, sans-serif" } = {}) {
  return {
    schema_version: VISUAL_PORTAL_SCHEMA_VERSION,
    settings: {
      background_color: "#ffffff",
      text_color: "#202124",
      primary_color: normalizeColor(primaryColor, "cor principal"),
      surface_color: "#f7f7f7",
      font_family: normalizeFontFamily(fontFamily),
      content_width: "content",
      page_padding: 24,
      block_gap: 24,
    },
    blocks: [
      normalizeBlock({
        id: "hero-principal",
        type: "hero",
        content: {
          eyebrow: "Bem-vindo",
          title: "Uma nova experiência começa aqui",
          text: "Edite este conteúdo e transforme esta página no portal da sua unidade.",
          button_text: "Conheça nossos serviços",
          button_url: "/",
        },
        styles: {
          base: { alignment: "center", width: "wide", padding_top: 88, padding_bottom: 88, min_height: 420 },
          desktop: {},
          mobile: { padding_top: 56, padding_bottom: 56, padding_inline: 18, min_height: 360, heading_size: 48, text_size: 16 },
        },
        visibility: { desktop: true, mobile: true },
      }, 0),
    ],
  };
}

export function normalizeVisualPortalDocument(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("O documento visual deve ser um objeto.");
  }
  const sourceBytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
  if (sourceBytes > VISUAL_PORTAL_MAX_BYTES) throw badRequest("O portal excede o tamanho permitido.");
  if (Number(input.schema_version || VISUAL_PORTAL_SCHEMA_VERSION) !== VISUAL_PORTAL_SCHEMA_VERSION) {
    throw badRequest("Versao do documento visual nao suportada.");
  }
  if (!Array.isArray(input.blocks)) throw badRequest("O portal precisa conter uma lista de blocos.");
  if (input.blocks.length > VISUAL_PORTAL_MAX_BLOCKS) throw badRequest("O portal excede o limite de blocos.");

  const ids = new Set();
  const blocks = input.blocks.map((block, index) => {
    const normalized = normalizeBlock(block, index);
    if (ids.has(normalized.id)) throw badRequest("Existem blocos com o mesmo identificador.");
    ids.add(normalized.id);
    return normalized;
  });

  const document = {
    schema_version: VISUAL_PORTAL_SCHEMA_VERSION,
    settings: normalizeDocumentSettings(input.settings || {}),
    blocks,
  };
  if (new TextEncoder().encode(JSON.stringify(document)).byteLength > VISUAL_PORTAL_MAX_BYTES) {
    throw badRequest("O portal normalizado excede o tamanho permitido.");
  }
  return document;
}

export function collectVisualPortalMediaIds(document) {
  const ids = new Set();
  for (const block of document.blocks || []) {
    addMediaId(ids, block.content?.media_asset_id);
    addMediaId(ids, block.content?.poster_media_asset_id);
    for (const mediaId of block.content?.media_asset_ids || []) addMediaId(ids, mediaId);
    for (const item of block.content?.items || []) addMediaId(ids, item.media_asset_id);
  }
  return [...ids];
}

export function visualPortalTemplateDocument(templateKey, branding = {}) {
  const primaryColor = branding.primary_color || "#513b2d";
  const fontFamily = branding.font_family || "Inter, system-ui, sans-serif";
  const base = createBlankVisualPortalDocument({ primaryColor, fontFamily });
  if (templateKey === "blank") return { ...base, blocks: [] };

  if (templateKey === "showcase") {
    return normalizeVisualPortalDocument({
      ...base,
      blocks: [
        { ...base.blocks[0], content: { ...base.blocks[0].content, title: "Descubra tudo o que preparamos para você", text: "Serviços, experiências e informações em um único lugar." } },
        block("heading", "titulo-experiencias", { title: "Experiências em destaque", text: "Escolha por onde começar." }, { alignment: "center" }),
        block("feature-grid", "experiencias", { items: [
          { title: "Gastronomia", text: "Sabores selecionados para cada momento.", button_text: "Explorar", button_url: "/" },
          { title: "Bem-estar", text: "Uma pausa para cuidar de você.", button_text: "Conhecer", button_url: "/" },
          { title: "Eventos", text: "Programação especial durante sua estadia.", button_text: "Ver agenda", button_url: "/" },
        ] }, { columns: 3 }),
        block("quote", "mensagem", { quote: "Cada detalhe foi pensado para tornar sua experiência memorável.", author: "Equipe Fioreze" }, { alignment: "center" }),
      ],
    });
  }

  if (templateKey === "service") {
    return normalizeVisualPortalDocument({
      ...base,
      blocks: [
        { ...base.blocks[0], content: { ...base.blocks[0].content, eyebrow: "Serviços", title: "Tudo ao seu alcance", text: "Apresente seu serviço com imagens, benefícios e uma chamada clara para ação." } },
        block("heading", "titulo-beneficios", { title: "Por que escolher", text: "Destaque os principais diferenciais do serviço." }),
        block("feature-grid", "beneficios", { items: [
          { title: "Atendimento cuidadoso", text: "Uma experiência pensada nos detalhes." },
          { title: "Conforto", text: "Praticidade durante toda a sua estadia." },
          { title: "Qualidade", text: "Seleção e execução com padrão Fioreze." },
        ] }, { columns: 3 }),
        block("button", "acao-principal", { text: "Solicitar serviço", url: "/" }, { alignment: "center" }),
      ],
    });
  }

  throw badRequest("Modelo visual nao encontrado.");
}

function block(type, id, content, baseStyles = {}) {
  const mobileStyles = {};
  if (["feature-grid", "gallery"].includes(type)) mobileStyles.columns = 1;
  if (type === "heading") mobileStyles.heading_size = 38;
  if (type === "quote") mobileStyles.heading_size = 30;
  return normalizeBlock({
    id,
    type,
    content,
    styles: { base: baseStyles, desktop: {}, mobile: mobileStyles },
    visibility: { desktop: true, mobile: true },
  }, 0);
}

function normalizeDocumentSettings(input) {
  return {
    background_color: normalizeColor(input.background_color || "#ffffff", "cor de fundo"),
    text_color: normalizeColor(input.text_color || "#202124", "cor do texto"),
    primary_color: normalizeColor(input.primary_color || "#513b2d", "cor principal"),
    surface_color: normalizeColor(input.surface_color || "#f7f7f7", "cor de superficie"),
    font_family: normalizeFontFamily(input.font_family),
    content_width: normalizeEnum(input.content_width, WIDTHS, "content"),
    page_padding: normalizeNumber(input.page_padding, 0, 80, 24),
    block_gap: normalizeNumber(input.block_gap, 0, 80, 24),
  };
}

function normalizeBlock(input, index) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest(`Bloco ${index + 1} invalido.`);
  const type = String(input.type || "").trim();
  if (!VISUAL_PORTAL_BLOCK_TYPES.has(type)) throw badRequest(`Tipo de bloco nao permitido: ${type || "vazio"}.`);
  const id = String(input.id || `${type}-${index + 1}`).trim().toLowerCase();
  if (!isSafeIdentifier(id) || id.length > 80) throw badRequest(`Identificador do bloco ${index + 1} invalido.`);
  return {
    id,
    type,
    content: normalizeBlockContent(type, input.content || {}),
    styles: {
      base: normalizeBlockStyles(input.styles?.base || {}),
      desktop: normalizeBlockStyles(input.styles?.desktop || {}),
      mobile: normalizeBlockStyles(input.styles?.mobile || {}),
    },
    visibility: {
      desktop: input.visibility?.desktop !== false,
      mobile: input.visibility?.mobile !== false,
    },
  };
}

function normalizeBlockContent(type, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Conteudo de bloco invalido.");
  if (type === "hero") return {
    eyebrow: text(input.eyebrow, 100), title: text(input.title, 220), text: text(input.text, 1200),
    button_text: text(input.button_text, 80), button_url: safeUrl(input.button_url), media_asset_id: mediaId(input.media_asset_id),
    overlay: normalizeNumber(input.overlay, 0, 90, 35),
  };
  if (type === "heading") return { title: text(input.title, 220), text: text(input.text, 1000) };
  if (type === "text") return { text: text(input.text, 5000) };
  if (type === "button") return { text: text(input.text, 80), url: safeUrl(input.url), style: normalizeEnum(input.style, BUTTON_STYLES, "solid") };
  if (type === "image") return { media_asset_id: mediaId(input.media_asset_id), alt_text: text(input.alt_text, 300), caption: text(input.caption, 500), fit: normalizeEnum(input.fit, MEDIA_FITS, "cover") };
  if (type === "video") return { media_asset_id: mediaId(input.media_asset_id), poster_media_asset_id: mediaId(input.poster_media_asset_id), title: text(input.title, 180), autoplay: Boolean(input.autoplay), muted: input.muted !== false, loop: Boolean(input.loop), controls: input.controls !== false };
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
  return items.map((item) => ({
    title: text(item?.title, 160),
    text: text(item?.text, 1000),
    media_asset_id: mediaId(item?.media_asset_id),
    button_text: text(item?.button_text, 80),
    button_url: safeUrl(item?.button_url),
  }));
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
  };
}

function text(value, max) {
  if (value == null) return "";
  if (typeof value !== "string") throw badRequest("Um texto do bloco possui formato invalido.");
  const normalized = value.trim();
  if (normalized.length > max) throw badRequest("Um texto do bloco excede o limite permitido.");
  return normalized;
}

function safeUrl(value) {
  const normalized = text(value, 1000);
  if (!normalized) return "";
  if (normalized.startsWith("/") && !normalized.startsWith("//")) return normalized;
  if (/^(https:\/\/|mailto:|tel:)/i.test(normalized)) return normalized;
  throw badRequest("Um endereco de link do portal nao e permitido.");
}

function mediaId(value) {
  if (value == null || value === "") return "";
  const normalized = String(value).trim();
  if (!MEDIA_ID_PATTERN.test(normalized)) throw badRequest("Referencia de midia invalida.");
  return normalized;
}

function uniqueMediaIds(values, max) {
  if (values == null) return [];
  if (!Array.isArray(values) || values.length > max) throw badRequest("A galeria excede o limite de midias.");
  return [...new Set(values.map(mediaId).filter(Boolean))];
}

function addMediaId(target, value) {
  if (typeof value === "string" && value) target.add(value);
}

function normalizeColor(value, label) {
  const normalized = String(value || "").trim();
  if (!COLOR_PATTERN.test(normalized)) throw badRequest(`${label} invalida.`);
  return normalized.toLowerCase();
}

function optionalColor(value, label) {
  if (value == null || value === "") return undefined;
  return normalizeColor(value, label);
}

function normalizeFontFamily(value) {
  const normalized = String(value || "Inter, system-ui, sans-serif").trim();
  if (!/^[\p{L}\p{N}\s,'"-]{2,180}$/u.test(normalized)) throw badRequest("Familia tipografica invalida.");
  return normalized;
}

function normalizeEnum(value, allowed, fallback) {
  if (value == null || value === "") return fallback;
  const normalized = String(value);
  if (!allowed.has(normalized)) throw badRequest("Opcao visual invalida.");
  return normalized;
}

function normalizeNumber(value, min, max, fallback) {
  if (value == null || value === "") return fallback;
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < min || normalized > max) throw badRequest("Valor visual fora do intervalo permitido.");
  return Math.round(normalized);
}

function optionalNumber(value, min, max) {
  if (value == null || value === "") return undefined;
  return normalizeNumber(value, min, max, undefined);
}

function phone(value) {
  const normalized = text(value, 40);
  if (normalized && !/^[+\d\s().-]+$/.test(normalized)) throw badRequest("Telefone invalido.");
  return normalized;
}

function email(value) {
  const normalized = text(value, 180);
  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw badRequest("E-mail invalido.");
  return normalized;
}
