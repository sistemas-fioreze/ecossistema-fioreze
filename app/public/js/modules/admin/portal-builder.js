import { adminApi } from "./shared/admin-api.js";
import { escapeAttr, escapeHtml } from "./shared/format.js";
import {
  deleteVisualBlock,
  duplicateVisualBlock,
  moveVisualBlock,
  reorderVisualBlock,
} from "./portal-builder-state.js";

const BLOCKS = [
  ["hero", "Capa", "Imagem, título e chamada", icon("sparkles")],
  ["heading", "Título", "Título e texto de abertura", icon("heading")],
  ["text", "Texto", "Parágrafos de conteúdo", icon("text")],
  ["button", "Botão", "Ação para outro endereço", icon("button")],
  ["image", "Imagem", "Imagem da Biblioteca de Mídia", icon("image")],
  ["video", "Vídeo", "Vídeo com capa e controles", icon("video")],
  ["embed", "Incorporar", "Google Maps, vídeos e páginas HTTPS", icon("embed")],
  ["gallery", "Galeria", "Conjunto de imagens", icon("gallery")],
  ["feature-grid", "Grade", "Cards de serviços e destaques", icon("grid")],
  ["quote", "Citação", "Depoimento ou frase em destaque", icon("quote")],
  ["contact", "Contato", "Endereço, telefone e chamada", icon("contact")],
  ["divider", "Divisor", "Separação entre seções", icon("divider")],
  ["spacer", "Espaço", "Respiro ajustável", icon("spacer")],
];

const BLOCK_LABELS = Object.fromEntries(BLOCKS.map(([key, label]) => [key, label]));
const HISTORY_LIMIT = 50;

export function createVisualPortalBuilder({ onSaved = () => {} } = {}) {
  const root = createBuilderRoot();
  const state = {
    portal: null,
    document: null,
    original: "",
    selectedId: null,
    viewport: "desktop",
    styleTarget: "base",
    leftTab: "blocks",
    zoom: 82,
    media: [],
    templates: [],
    versions: [],
    history: [],
    historyIndex: -1,
    saving: false,
    dragBlockId: "",
    previewViewport: "desktop",
    mediaTarget: "block",
    clipboardBlock: null,
    positionDrag: null,
    zoomManuallySet: false,
  };
  const els = mapElements(root);

  root.addEventListener("click", handleClick);
  root.addEventListener("input", handleInput);
  root.addEventListener("change", handleInput);
  root.addEventListener("dragstart", handleDragStart);
  root.addEventListener("dragover", handleDragOver);
  root.addEventListener("drop", handleDrop);
  root.addEventListener("dragend", clearDragState);
  root.addEventListener("pointerdown", handlePositionPointerDown);
  window.addEventListener("pointermove", handlePositionPointerMove);
  window.addEventListener("pointerup", handlePositionPointerUp);
  document.addEventListener("keydown", handleKeyboard);
  window.addEventListener("resize", handleResize);

  return {
    async open(portalId) {
      root.hidden = false;
      document.documentElement.classList.add("visual-builder-open");
      setBusy(true, "Abrindo o construtor...");
      try {
        const payload = await adminApi(`/api/v1/admin/visual-portals/${encodeURIComponent(portalId)}`);
        state.portal = payload.data.portal;
        state.document = clone(state.portal.document);
        state.original = stableJson(state.document);
        state.selectedId = state.document.blocks[0]?.id || null;
        state.history = [clone(state.document)];
        state.historyIndex = 0;
        state.leftTab = "blocks";
        await Promise.all([loadMedia(), loadTemplates(), loadVersions()]);
        renderAll();
        requestAnimationFrame(() => fitCanvas(true));
      } catch (error) {
        close();
        window.alert(error.message || "Não foi possível abrir o construtor.");
      } finally {
        setBusy(false);
      }
    },
  };

  function close() {
    if (isDirty() && !window.confirm("Existem alterações não salvas. Sair do construtor?")) return;
    root.hidden = true;
    document.documentElement.classList.remove("visual-builder-open");
    state.portal = null;
    state.document = null;
  }

  async function loadMedia() {
    const params = new URLSearchParams({ hotel_id: state.portal.hotel_id, status: "active", limit: "60" });
    try {
      const payload = await adminApi(`/api/v1/admin/media?${params}`);
      state.media = payload.data.assets || [];
    } catch {
      state.media = [];
    }
  }

  function mediaById(id) {
    return state.media.find((asset) => asset.id === id) || null;
  }

  function mediaThumbnail(id) {
    const media = mediaById(id);
    return media && String(media.mime_type).startsWith("image/")
      ? `<img src="${escapeAttr(media.public_url)}" alt="">`
      : "";
  }

  function mediaPreview(id, kind, label, fit = "cover") {
    const media = mediaById(id);
    if (!media) return `<div class="vp-preview-inner vp-preview-media">${mediaPlaceholder(label)}</div>`;
    return `<figure class="vp-preview-inner vp-preview-media">${kind === "video" ? `<video src="${escapeAttr(media.public_url)}" muted controls preload="metadata"></video>` : `<img src="${escapeAttr(media.public_url)}" alt="${escapeAttr(label)}" style="object-fit:${escapeAttr(fit)}">`}</figure>`;
  }

  function pageBackgroundPreview(settings) {
    const media = mediaById(settings.background_media_asset_id);
    if (!media) return "";
    const common = `style="object-fit:${escapeAttr(settings.background_fit || "cover")};object-position:${escapeAttr(settings.background_position || "center")}"`;
    const asset = String(media.mime_type).startsWith("video/")
      ? `<video src="${escapeAttr(media.public_url)}" muted loop autoplay playsinline ${common}></video>`
      : `<img src="${escapeAttr(media.public_url)}" alt="" ${common}>`;
    return `<div class="vp-page-background ${settings.background_fixed ? "is-fixed" : ""}" aria-hidden="true">${asset}<span></span></div>`;
  }

  function resolvedBlockStyle(block) {
    const target = block.styles?.[state.viewport] || {};
    return { ...(block.styles?.base || {}), ...target };
  }

  async function loadTemplates() {
    const params = new URLSearchParams({ hotel_id: state.portal.hotel_id, module_key: state.portal.module_key });
    try {
      const payload = await adminApi(`/api/v1/admin/visual-portal-templates?${params}`);
      state.templates = payload.data.templates || [];
    } catch {
      state.templates = [];
    }
  }

  async function loadVersions() {
    try {
      const payload = await adminApi(`/api/v1/admin/visual-portals/${encodeURIComponent(state.portal.id)}/versions`);
      state.versions = payload.data.versions || [];
    } catch {
      state.versions = [];
    }
  }

  function renderAll() {
    if (!state.portal || !state.document) return;
    els.title.textContent = state.portal.name;
    els.path.textContent = `/${state.portal.hotel_slug}/${state.portal.slug}`;
    els.status.textContent = state.portal.status === "published" ? "Publicado" : "Rascunho";
    els.status.dataset.status = state.portal.status;
    els.deviceButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.viewport === state.viewport)));
    els.undo.disabled = state.historyIndex <= 0;
    els.redo.disabled = state.historyIndex >= state.history.length - 1;
    els.zoom.value = state.zoom;
    els.zoomLabel.textContent = `${state.zoom}%`;
    renderLeftPanel();
    renderCanvas();
    renderInspector();
    renderSaveState();
  }

  function renderLeftPanel() {
    els.leftTabs.forEach((button) => button.setAttribute("aria-selected", String(button.dataset.builderTab === state.leftTab)));
    if (state.leftTab === "blocks") {
      els.leftContent.innerHTML = `<div class="vp-library-search"><span>${icon("search")}</span><input type="search" data-block-search placeholder="Buscar bloco" aria-label="Buscar bloco"></div><div class="vp-block-library">${BLOCKS.map(([type, label, description, svg]) => `<button type="button" draggable="true" data-add-block="${type}" title="Arraste ou clique para adicionar"><span>${svg}</span><strong>${label}</strong><small>${description}</small></button>`).join("")}</div>`;
      return;
    }
    if (state.leftTab === "layers") {
      els.leftContent.innerHTML = `<div class="vp-panel-heading"><div><strong>Camadas</strong><span>${state.document.blocks.length} blocos</span></div></div><div class="vp-layers">${state.document.blocks.map((block, index) => `<button type="button" draggable="true" data-layer-id="${escapeAttr(block.id)}" class="${block.id === state.selectedId ? "is-selected" : ""}"><span class="vp-layer-drag">${icon("grip")}</span><span>${iconForBlock(block.type)}</span><strong>${escapeHtml(blockLabel(block, index))}</strong><small>${block.visibility.desktop ? "D" : ""}${block.visibility.mobile ? "M" : ""}</small></button>`).join("") || '<p class="vp-empty">A página ainda não tem blocos.</p>'}</div>`;
      return;
    }
    if (state.leftTab === "templates") {
      els.leftContent.innerHTML = `<div class="vp-panel-heading"><div><strong>Modelos</strong><span>Reutilize páginas prontas</span></div><button type="button" data-save-template title="Salvar página atual como modelo">${icon("plus")}</button></div><div class="vp-templates">${state.templates.map((template) => `<article><span>${icon(template.builtin ? "template" : "bookmark")}</span><div><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.description || "Modelo salvo pela sua equipe")}</small></div><button type="button" data-apply-template="${escapeAttr(template.id)}">Aplicar</button>${template.builtin ? "" : `<button type="button" class="icon-only danger" data-archive-template="${escapeAttr(template.id)}" title="Arquivar modelo">${icon("trash")}</button>`}</article>`).join("") || '<p class="vp-empty">Nenhum modelo disponível.</p>'}</div>`;
      return;
    }
    els.leftContent.innerHTML = `<div class="vp-panel-heading"><div><strong>Histórico</strong><span>Restaure uma versão como rascunho</span></div></div><div class="vp-versions">${state.versions.map((version) => `<article><span data-version-type="${escapeAttr(version.version_type)}">${icon(version.version_type === "published" ? "publish" : version.version_type === "restored" ? "undo" : "save")}</span><div><strong>Versão ${Number(version.revision)}</strong><small>${version.version_type === "published" ? "Publicada" : version.version_type === "restored" ? "Restaurada" : "Rascunho"} · ${escapeHtml(formatVersionDate(version.created_at))}</small><em>${escapeHtml(version.created_by_name || "Equipe")}</em></div><button type="button" data-restore-version="${escapeAttr(version.id)}">Restaurar</button></article>`).join("") || '<p class="vp-empty">Nenhuma versão salva.</p>'}</div>`;
  }

  function renderCanvas() {
    const page = state.document;
    const settings = page.settings;
    const frameWidth = state.viewport === "mobile" ? 390 : 1440;
    els.stage.dataset.viewport = state.viewport;
    els.stage.style.setProperty("--preview-width", `${frameWidth}px`);
    els.stage.style.setProperty("--preview-scale", state.zoom / 100);
    els.canvas.innerHTML = `<div class="vp-preview-page ${settings.background_media_asset_id ? "has-page-media" : ""}" style="--vp-page-bg:${escapeAttr(settings.background_color)};--vp-page-text:${escapeAttr(settings.text_color)};--vp-page-primary:${escapeAttr(settings.primary_color)};--vp-page-surface:${escapeAttr(settings.surface_color)};--vp-page-font:${escapeAttr(settings.font_family)};--vp-page-gap:${Number(settings.block_gap)}px;--vp-page-padding:${Number(settings.page_padding)}px;--vp-page-overlay:${Number(settings.background_overlay || 0) / 100};--vp-page-media-position:${escapeAttr(settings.background_position || "center")};--vp-page-media-fit:${escapeAttr(settings.background_fit || "cover")}">${pageBackgroundPreview(settings)}<div class="vp-page-content">${page.blocks.map((block, index) => renderEditableBlock(block, index)).join("") || `<button type="button" class="vp-empty-canvas" data-add-block="hero">${icon("plus")}<strong>Adicione o primeiro bloco</strong><span>Comece por uma capa ou arraste qualquer elemento da biblioteca.</span></button>`}</div></div>`;
  }

  function renderEditableBlock(block, index) {
    const selected = block.id === state.selectedId;
    const styles = resolvedBlockStyle(block);
    const style = editableStyle(styles);
    const hidden = (state.viewport === "desktop" && !block.visibility.desktop) || (state.viewport === "mobile" && !block.visibility.mobile);
    return `<section class="vp-canvas-block ${selected ? "is-selected" : ""} ${hidden ? "is-hidden-device" : ""}" data-canvas-block="${escapeAttr(block.id)}" draggable="true" style="${escapeAttr(style)}"><div class="vp-block-toolbar"><button type="button" data-position-block title="Arrastar livremente">${icon("move")}</button><button type="button" data-move-block="up" title="Mover para cima" ${index === 0 ? "disabled" : ""}>${icon("up")}</button><button type="button" data-move-block="down" title="Mover para baixo" ${index === state.document.blocks.length - 1 ? "disabled" : ""}>${icon("down")}</button><button type="button" data-duplicate-block title="Duplicar bloco">${icon("copy")}</button><button type="button" data-delete-block title="Excluir bloco">${icon("trash")}</button></div>${renderBlockPreview(block)}</section>`;
  }

  function renderBlockPreview(block) {
    const content = block.content;
    if (block.type === "hero") {
      const media = mediaById(content.media_asset_id);
      const background = media ? `background-image:linear-gradient(rgba(0,0,0,${Number(content.overlay || 0) / 100}),rgba(0,0,0,${Number(content.overlay || 0) / 100})),url('${escapeCssUrl(media.public_url)}')` : "";
      return `<div class="vp-preview-hero ${media ? "has-media" : ""}" style="${escapeAttr(background)}"><div>${content.eyebrow ? `<p class="vp-eyebrow">${escapeHtml(content.eyebrow)}</p>` : ""}<h1>${escapeHtml(content.title || "Título da capa")}</h1>${previewParagraphs(content.text)}${previewButton(content.button_text, content.button_url)}</div></div>`;
    }
    if (block.type === "heading") return `<div class="vp-preview-inner"><h2>${escapeHtml(content.title || "Título da seção")}</h2>${previewParagraphs(content.text)}</div>`;
    if (block.type === "text") return `<div class="vp-preview-inner vp-preview-text">${previewParagraphs(content.text || "Clique para editar este texto.")}</div>`;
    if (block.type === "button") return `<div class="vp-preview-inner">${previewButton(content.text || "Novo botão", content.url || "/", content.style)}</div>`;
    if (block.type === "image") return mediaPreview(content.media_asset_id, "image", content.alt_text || "Selecione uma imagem", content.fit);
    if (block.type === "video") return mediaPreview(content.media_asset_id, "video", content.title || "Selecione um vídeo");
    if (block.type === "embed") return `<div class="vp-preview-inner vp-preview-embed" style="--vp-embed-ratio:${escapeAttr(embedRatio(content.aspect_ratio))}">${content.url ? `<iframe src="${escapeAttr(content.url)}" title="${escapeAttr(content.title || "Conteúdo incorporado")}" tabindex="-1"></iframe><span>${icon("embed")} Conteúdo incorporado</span>` : mediaPlaceholder("Informe um endereço HTTPS para incorporar")}</div>`;
    if (block.type === "gallery") return `<div class="vp-preview-inner">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}<div class="vp-preview-gallery">${content.media_asset_ids.map((id) => mediaById(id)).filter(Boolean).map((media) => `<img src="${escapeAttr(media.public_url)}" alt="">`).join("") || mediaPlaceholder("Galeria sem imagens")}</div></div>`;
    if (block.type === "feature-grid") return `<div class="vp-preview-inner vp-preview-grid">${content.items.map((item) => `<article>${mediaThumbnail(item.media_asset_id)}<div><h3>${escapeHtml(item.title || "Novo destaque")}</h3>${previewParagraphs(item.text)}${previewButton(item.button_text, item.button_url, "ghost")}</div></article>`).join("") || mediaPlaceholder("Adicione itens à grade")}</div>`;
    if (block.type === "quote") return `<figure class="vp-preview-inner vp-preview-quote"><blockquote>${escapeHtml(content.quote || "Uma frase memorável para destacar.")}</blockquote>${content.author ? `<figcaption>${escapeHtml(content.author)}</figcaption>` : ""}</figure>`;
    if (block.type === "contact") return `<div class="vp-preview-inner vp-preview-contact"><h2>${escapeHtml(content.title || "Fale conosco")}</h2>${previewParagraphs(content.text)}<div>${[content.address, content.phone, content.email].filter(Boolean).map((value) => `<span>${escapeHtml(value)}</span>`).join("")}</div>${previewButton(content.button_text, content.button_url)}</div>`;
    if (block.type === "divider") return `<div class="vp-preview-inner vp-preview-divider"><span></span>${content.label ? `<em>${escapeHtml(content.label)}</em>` : ""}<span></span></div>`;
    return `<div class="vp-preview-spacer"><span>${Number(resolvedBlockStyle(block).min_height || 48)} px</span></div>`;
  }

  function renderInspector() {
    const block = selectedBlock();
    els.inspectorTitle.textContent = block ? BLOCK_LABELS[block.type] : "Página";
    els.inspectorSubtitle.textContent = block ? "Conteúdo e aparência do bloco" : "Identidade e espaçamento geral";
    if (!block) {
      els.inspectorBody.innerHTML = pageInspector();
      return;
    }
    els.inspectorBody.innerHTML = `${blockContentInspector(block)}${styleInspector(block)}${visibilityInspector(block)}<div class="vp-inspector-danger"><button type="button" data-duplicate-block>${icon("copy")} Duplicar bloco</button><button type="button" data-delete-block>${icon("trash")} Excluir bloco</button></div>`;
  }

  function pageInspector() {
    const settings = state.document.settings;
    return `<fieldset><legend>Identidade da página</legend>${colorField("Fundo", "background_color", settings.background_color, "doc")}${colorField("Texto", "text_color", settings.text_color, "doc")}${colorField("Cor principal", "primary_color", settings.primary_color, "doc")}${colorField("Superfície", "surface_color", settings.surface_color, "doc")}<label><span>Tipografia</span><input data-doc-field="font_family" value="${escapeAttr(settings.font_family)}"></label><label><span>Largura do conteúdo</span><select data-doc-field="content_width">${options([["narrow", "Estreita"], ["content", "Padrão"], ["wide", "Ampla"], ["full", "Tela inteira"]], settings.content_width)}</select></label></fieldset><fieldset><legend>Fundo da página</legend>${pageMediaField(settings.background_media_asset_id)}${rangeField("Escurecimento", "background_overlay", settings.background_overlay, 0, 90, "doc")}<label><span>Posição</span><select data-doc-field="background_position">${options([["center", "Centro"], ["top", "Topo"], ["bottom", "Rodapé"], ["left", "Esquerda"], ["right", "Direita"]], settings.background_position)}</select></label><label><span>Ajuste</span><select data-doc-field="background_fit">${options([["cover", "Preencher"], ["contain", "Conter"]], settings.background_fit)}</select></label>${docToggleField("Fixar durante a rolagem", "background_fixed", settings.background_fixed)}${settings.background_media_asset_id ? `<button type="button" class="vp-secondary-action" data-clear-page-media>${icon("trash")} Remover mídia de fundo</button>` : ""}</fieldset><fieldset><legend>Ritmo</legend>${rangeField("Margem lateral", "page_padding", settings.page_padding, 0, 80, "doc")}${rangeField("Espaço entre blocos", "block_gap", settings.block_gap, 0, 80, "doc")}</fieldset>`;
  }

  function blockContentInspector(block) {
    const content = block.content;
    const fields = [];
    if (block.type === "hero") fields.push(textField("Chamada", "eyebrow", content.eyebrow), textField("Título", "title", content.title), textareaField("Texto", "text", content.text), textField("Texto do botão", "button_text", content.button_text), textField("Endereço do botão", "button_url", content.button_url), mediaField("Imagem de fundo", "media_asset_id", content.media_asset_id, "image"), rangeField("Escurecimento", "overlay", content.overlay, 0, 90, "content"));
    if (block.type === "heading") fields.push(textField("Título", "title", content.title), textareaField("Texto", "text", content.text));
    if (block.type === "text") fields.push(textareaField("Conteúdo", "text", content.text, 10));
    if (block.type === "button") fields.push(textField("Texto", "text", content.text), textField("Endereço", "url", content.url), `<label><span>Estilo</span><select data-content-field="style">${options([["solid", "Preenchido"], ["outline", "Contorno"], ["ghost", "Somente texto"]], content.style)}</select></label>`);
    if (block.type === "image") fields.push(mediaField("Imagem", "media_asset_id", content.media_asset_id, "image"), textField("Texto alternativo", "alt_text", content.alt_text), textField("Legenda", "caption", content.caption), `<label><span>Ajuste</span><select data-content-field="fit">${options([["cover", "Preencher"], ["contain", "Conter"]], content.fit)}</select></label>`);
    if (block.type === "video") fields.push(mediaField("Vídeo", "media_asset_id", content.media_asset_id, "video"), mediaField("Imagem de capa", "poster_media_asset_id", content.poster_media_asset_id, "image"), textField("Título", "title", content.title), toggleField("Exibir controles", "controls", content.controls), toggleField("Reprodução automática", "autoplay", content.autoplay), toggleField("Sem som", "muted", content.muted), toggleField("Repetir", "loop", content.loop));
    if (block.type === "embed") fields.push(textField("Título acessível", "title", content.title), textField("Endereço HTTPS", "url", content.url), `<label><span>Proporção</span><select data-content-field="aspect_ratio">${options([["16:9", "Paisagem 16:9"], ["4:3", "Clássica 4:3"], ["1:1", "Quadrada"], ["9:16", "Vertical 9:16"]], content.aspect_ratio)}</select></label>`, toggleField("Permitir tela cheia", "allow_fullscreen", content.allow_fullscreen));
    if (block.type === "gallery") fields.push(textField("Título", "title", content.title), `<div class="vp-gallery-inspector">${content.media_asset_ids.map((id) => { const media = mediaById(id); return `<button type="button" data-remove-gallery-media="${escapeAttr(id)}" title="Remover">${media ? `<img src="${escapeAttr(media.public_url)}" alt="">` : icon("image")}<span>${icon("close")}</span></button>`; }).join("")}<button type="button" class="vp-add-gallery" data-choose-media="media_asset_ids" data-media-kind="image">${icon("plus")}<span>Adicionar</span></button></div>`);
    if (block.type === "feature-grid") fields.push(featureItemsInspector(content.items));
    if (block.type === "quote") fields.push(textareaField("Citação", "quote", content.quote, 6), textField("Autoria", "author", content.author));
    if (block.type === "contact") fields.push(textField("Título", "title", content.title), textareaField("Texto", "text", content.text), textField("Endereço", "address", content.address), textField("Telefone", "phone", content.phone), textField("E-mail", "email", content.email), textField("Texto do botão", "button_text", content.button_text), textField("Endereço do botão", "button_url", content.button_url));
    if (block.type === "divider") fields.push(textField("Legenda opcional", "label", content.label));
    return fields.length ? `<fieldset><legend>Conteúdo</legend>${fields.join("")}</fieldset>` : "";
  }

  function featureItemsInspector(items) {
    return `<div class="vp-feature-items">${items.map((item, index) => `<details ${index === 0 ? "open" : ""}><summary><span>${index + 1}</span><strong>${escapeHtml(item.title || "Novo destaque")}</strong><button type="button" data-remove-feature="${index}" title="Remover">${icon("trash")}</button></summary><div>${textField("Título", `items.${index}.title`, item.title)}${textareaField("Texto", `items.${index}.text`, item.text, 4)}${mediaField("Imagem", `items.${index}.media_asset_id`, item.media_asset_id, "image")}${textField("Texto do botão", `items.${index}.button_text`, item.button_text)}${textField("Endereço", `items.${index}.button_url`, item.button_url)}</div></details>`).join("")}<button type="button" class="vp-secondary-action" data-add-feature>${icon("plus")} Adicionar destaque</button></div>`;
  }

  function styleInspector(block) {
    const style = block.styles[state.styleTarget] || {};
    const hasHeading = ["hero", "heading", "feature-grid", "quote", "contact", "gallery", "video"].includes(block.type);
    const hasText = ["hero", "heading", "text", "feature-grid", "contact"].includes(block.type);
    return `<fieldset><legend>Aparência</legend><div class="vp-style-target" role="tablist"><button type="button" data-style-target="base" aria-selected="${state.styleTarget === "base"}">Global</button><button type="button" data-style-target="desktop" aria-selected="${state.styleTarget === "desktop"}">Desktop</button><button type="button" data-style-target="mobile" aria-selected="${state.styleTarget === "mobile"}">Mobile</button></div><label><span>Alinhamento</span><select data-style-field="alignment"><option value="">Herdar</option>${options([["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]], style.alignment)}</select></label><label><span>Largura</span><select data-style-field="width"><option value="">Herdar</option>${options([["narrow", "Estreita"], ["content", "Padrão"], ["wide", "Ampla"], ["full", "Tela inteira"]], style.width)}</select></label>${hasHeading ? rangeField("Tamanho dos títulos", "heading_size", style.heading_size ?? "", 18, 160, "style", true) : ""}${hasText ? rangeField("Tamanho do texto", "text_size", style.text_size ?? "", 12, 40, "style", true) : ""}${colorField("Fundo", "background_color", style.background_color, "style", true)}${colorField("Texto", "text_color", style.text_color, "style", true)}${colorField("Destaque", "accent_color", style.accent_color, "style", true)}${rangeField("Espaço acima", "padding_top", style.padding_top ?? "", 0, 200, "style", true)}${rangeField("Espaço abaixo", "padding_bottom", style.padding_bottom ?? "", 0, 200, "style", true)}${rangeField("Margem lateral", "padding_inline", style.padding_inline ?? "", 0, 120, "style", true)}${rangeField("Altura mínima", "min_height", style.min_height ?? "", 0, 1200, "style", true)}${rangeField("Cantos", "border_radius", style.border_radius ?? "", 0, 48, "style", true)}${["gallery", "feature-grid"].includes(block.type) ? rangeField("Colunas", "columns", style.columns ?? "", 1, 4, "style", true) : ""}</fieldset><fieldset><legend>Posição livre</legend><p class="vp-field-help">Ajuste a posição neste dispositivo sem alterar a ordem da página.</p>${positionRangeField("Horizontal", "offset_x", style.offset_x)}${positionRangeField("Vertical", "offset_y", style.offset_y)}<button type="button" class="vp-secondary-action" data-reset-position>${icon("target")} Centralizar bloco</button></fieldset>`;
  }

  function visibilityInspector(block) {
    return `<fieldset><legend>Visibilidade</legend>${toggleField("Exibir no desktop", "desktop", block.visibility.desktop, "visibility")}${toggleField("Exibir no mobile", "mobile", block.visibility.mobile, "visibility")}</fieldset>`;
  }

  function handleClick(event) {
    const closeButton = event.target.closest("[data-builder-close]");
    if (closeButton) return close();
    const leftTab = event.target.closest("[data-builder-tab]");
    if (leftTab) { state.leftTab = leftTab.dataset.builderTab; renderLeftPanel(); return; }
    const viewport = event.target.closest("button[data-viewport]");
    if (viewport) {
      state.viewport = viewport.dataset.viewport;
      state.styleTarget = state.viewport;
      state.zoomManuallySet = false;
      renderAll();
      requestAnimationFrame(() => fitCanvas(true));
      return;
    }
    if (event.target.closest("[data-builder-undo]")) return undo();
    if (event.target.closest("[data-builder-redo]")) return redo();
    if (event.target.closest("[data-builder-save]")) return save();
    if (event.target.closest("[data-builder-publish]")) return publish();
    if (event.target.closest("[data-builder-preview]")) return preview();
    const add = event.target.closest("[data-add-block]");
    if (add) return addBlock(add.dataset.addBlock);
    const canvasBlock = event.target.closest("[data-canvas-block]");
    const layer = event.target.closest("[data-layer-id]");
    if (layer) { state.selectedId = layer.dataset.layerId; renderAll(); return; }
    const move = event.target.closest("[data-move-block]");
    if (move) return moveSelected(move.dataset.moveBlock === "up" ? -1 : 1, canvasBlock?.dataset.canvasBlock);
    if (event.target.closest("[data-duplicate-block]")) return duplicateSelected(canvasBlock?.dataset.canvasBlock);
    if (event.target.closest("[data-delete-block]")) return deleteSelected(canvasBlock?.dataset.canvasBlock);
    if (canvasBlock && !event.target.closest("button,a,input,select,textarea")) { state.selectedId = canvasBlock.dataset.canvasBlock; renderCanvas(); renderInspector(); return; }
    const styleTarget = event.target.closest("[data-style-target]");
    if (styleTarget) { state.styleTarget = styleTarget.dataset.styleTarget; renderInspector(); return; }
    const chooseMedia = event.target.closest("[data-choose-media]");
    if (chooseMedia) return openMediaPicker(chooseMedia.dataset.chooseMedia, chooseMedia.dataset.mediaKind || "image", chooseMedia.dataset.mediaTarget || "block");
    const mediaChoice = event.target.closest("[data-media-choice]");
    if (mediaChoice) return selectMedia(mediaChoice.dataset.mediaChoice);
    if (event.target.closest("[data-media-picker-close]")) return closeMediaPicker();
    if (event.target.closest("[data-preview-close]")) { els.previewDialog.close(); return; }
    const previewViewport = event.target.closest("[data-preview-viewport]");
    if (previewViewport) return setPreviewViewport(previewViewport.dataset.previewViewport);
    if (event.target.closest("[data-clear-page-media]")) {
      state.document.settings.background_media_asset_id = "";
      checkpoint();
      renderAll();
      return;
    }
    if (event.target.closest("[data-reset-position]")) {
      const block = selectedBlock();
      if (!block) return;
      delete block.styles[state.styleTarget].offset_x;
      delete block.styles[state.styleTarget].offset_y;
      checkpoint();
      renderAll();
      return;
    }
    const removeGallery = event.target.closest("[data-remove-gallery-media]");
    if (removeGallery) return removeGalleryMedia(removeGallery.dataset.removeGalleryMedia);
    if (event.target.closest("[data-add-feature]")) return addFeature();
    const removeFeature = event.target.closest("[data-remove-feature]");
    if (removeFeature) return removeFeatureItem(Number(removeFeature.dataset.removeFeature));
    if (event.target.closest("[data-save-template]")) return saveTemplate();
    const applyTemplate = event.target.closest("[data-apply-template]");
    if (applyTemplate) return applyTemplateDocument(applyTemplate.dataset.applyTemplate);
    const archiveTemplate = event.target.closest("[data-archive-template]");
    if (archiveTemplate) return archiveTemplateDocument(archiveTemplate.dataset.archiveTemplate);
    const restoreVersion = event.target.closest("[data-restore-version]");
    if (restoreVersion) return restoreVersionDocument(restoreVersion.dataset.restoreVersion);
    if (event.target.closest("[data-page-settings]")) { state.selectedId = null; renderCanvas(); renderInspector(); }
  }

  function handleInput(event) {
    if (event.target.matches("[data-block-search]")) {
      const query = event.target.value.toLowerCase();
      els.leftContent.querySelectorAll("[data-add-block]").forEach((button) => { button.hidden = !button.textContent.toLowerCase().includes(query); });
      return;
    }
    if (event.target === els.zoom) {
      state.zoom = Number(els.zoom.value);
      state.zoomManuallySet = true;
      renderCanvas();
      els.zoomLabel.textContent = `${state.zoom}%`;
      return;
    }
    if (!state.document) return;
    if (event.target.type === "range") {
      const output = event.target.closest("label")?.querySelector("output");
      if (output) output.textContent = event.target.dataset.styleField?.startsWith("offset_") ? `${event.target.value}px` : event.target.value;
    }
    const block = selectedBlock();
    if (event.target.dataset.docField) setPath(state.document.settings, event.target.dataset.docField, inputValue(event.target));
    if (block && event.target.dataset.contentField) setPath(block.content, event.target.dataset.contentField, inputValue(event.target));
    if (block && event.target.dataset.styleField) setPath(block.styles[state.styleTarget], event.target.dataset.styleField, emptyAsUndefined(event.target));
    if (block && event.target.dataset.visibilityField) setPath(block.visibility, event.target.dataset.visibilityField, event.target.checked);
    if (event.target.matches("[data-doc-field],[data-content-field],[data-style-field],[data-visibility-field]")) {
      checkpoint();
      renderCanvas();
      renderSaveState();
    }
  }

  function handleDragStart(event) {
    const add = event.target.closest("[data-add-block]");
    if (add) {
      event.dataTransfer.setData("application/x-fioreze-block-type", add.dataset.addBlock);
      event.dataTransfer.effectAllowed = "copy";
      return;
    }
    const existing = event.target.closest("[data-canvas-block],[data-layer-id]");
    if (existing) {
      state.dragBlockId = existing.dataset.canvasBlock || existing.dataset.layerId;
      event.dataTransfer.setData("application/x-fioreze-block-id", state.dragBlockId);
      event.dataTransfer.effectAllowed = "move";
    }
  }

  function handleDragOver(event) {
    if (!event.target.closest("[data-builder-canvas],.vp-layers")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes("application/x-fioreze-block-type") ? "copy" : "move";
    root.querySelectorAll(".is-drop-target").forEach((element) => element.classList.remove("is-drop-target"));
    event.target.closest("[data-canvas-block],[data-layer-id]")?.classList.add("is-drop-target");
  }

  function handleDrop(event) {
    const zone = event.target.closest("[data-builder-canvas],.vp-layers");
    if (!zone) return;
    event.preventDefault();
    const target = event.target.closest("[data-canvas-block],[data-layer-id]");
    const targetId = target?.dataset.canvasBlock || target?.dataset.layerId;
    const targetIndex = targetId ? state.document.blocks.findIndex((block) => block.id === targetId) : state.document.blocks.length;
    const type = event.dataTransfer.getData("application/x-fioreze-block-type");
    if (type) return addBlock(type, targetIndex);
    const blockId = event.dataTransfer.getData("application/x-fioreze-block-id");
    if (blockId) reorderBlock(blockId, targetIndex);
  }

  function clearDragState() {
    state.dragBlockId = "";
    root.querySelectorAll(".is-drop-target").forEach((element) => element.classList.remove("is-drop-target"));
  }

  function handlePositionPointerDown(event) {
    const handle = event.target.closest("[data-position-block]");
    const blockElement = handle?.closest("[data-canvas-block]");
    if (!handle || !blockElement) return;
    event.preventDefault();
    event.stopPropagation();
    state.selectedId = blockElement.dataset.canvasBlock;
    const block = selectedBlock();
    if (!block) return;
    const styleTarget = state.viewport;
    const style = block.styles[styleTarget] || (block.styles[styleTarget] = {});
    state.positionDrag = {
      pointerId: event.pointerId,
      element: blockElement,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: Number(style.offset_x || 0),
      offsetY: Number(style.offset_y || 0),
      style,
    };
    blockElement.classList.add("is-positioning");
    handle.setPointerCapture?.(event.pointerId);
  }

  function handlePositionPointerMove(event) {
    const drag = state.positionDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const scale = Math.max(.1, state.zoom / 100);
    drag.style.offset_x = clamp(Math.round(drag.offsetX + (event.clientX - drag.startX) / scale), -320, 320);
    drag.style.offset_y = clamp(Math.round(drag.offsetY + (event.clientY - drag.startY) / scale), -320, 320);
    const style = resolvedBlockStyle(selectedBlock());
    drag.element.style.transform = `translate(${Number(style.offset_x || 0)}px,${Number(style.offset_y || 0)}px)`;
  }

  function handlePositionPointerUp(event) {
    const drag = state.positionDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.element.classList.remove("is-positioning");
    state.positionDrag = null;
    checkpoint();
    renderAll();
    announce("Posição do bloco atualizada.");
  }

  function handleKeyboard(event) {
    if (root.hidden) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); save(); }
    if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) { event.preventDefault(); undo(); }
    if (mod && (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey))) { event.preventDefault(); redo(); }
    if (mod && event.key.toLowerCase() === "c" && state.selectedId && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) {
      state.clipboardBlock = clone(selectedBlock());
      announce("Bloco copiado.");
    }
    if (mod && event.key.toLowerCase() === "v" && state.clipboardBlock && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) {
      event.preventDefault();
      pasteBlock();
    }
    if (event.key === "Escape" && els.mediaDialog.open) closeMediaPicker();
    if ((event.key === "Delete" || event.key === "Backspace") && state.selectedId && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) {
      event.preventDefault();
      deleteSelected();
    }
  }

  function handleResize() {
    if (!root.hidden && !state.zoomManuallySet) requestAnimationFrame(() => fitCanvas());
  }

  function fitCanvas(force = false) {
    if (root.hidden || (!force && state.zoomManuallySet)) return;
    const scroll = els.stage.querySelector(".vp-stage-scroll");
    const frameWidth = state.viewport === "mobile" ? 390 : 1440;
    const available = Math.max(240, (scroll?.clientWidth || frameWidth) - 64);
    const fitted = Math.max(45, Math.min(100, Math.floor((available / frameWidth) * 100)));
    if (state.zoom === fitted) return;
    state.zoom = fitted;
    els.zoom.value = String(fitted);
    els.zoomLabel.textContent = `${fitted}%`;
    renderCanvas();
  }

  function addBlock(type, index = state.document.blocks.length) {
    if (!BLOCK_LABELS[type]) return;
    const block = createBlock(type);
    state.document.blocks.splice(Math.max(0, index), 0, block);
    state.selectedId = block.id;
    checkpoint();
    renderAll();
  }

  function deleteSelected(blockId = state.selectedId) {
    const result = deleteVisualBlock(state.document, blockId);
    if (!result.changed) return;
    state.selectedId = result.selectedId;
    checkpoint();
    renderAll();
    announce(`${BLOCK_LABELS[result.removed.type]} removido.`);
  }

  function duplicateSelected(blockId = state.selectedId) {
    const source = state.document.blocks.find((block) => block.id === blockId);
    if (!source) return;
    const result = duplicateVisualBlock(state.document, blockId, uniqueBlockId(source.type));
    if (!result.changed) return;
    state.selectedId = result.selectedId;
    checkpoint();
    renderAll();
    announce("Bloco duplicado.");
  }

  function moveSelected(delta, blockId = state.selectedId) {
    const result = moveVisualBlock(state.document, blockId, delta);
    if (!result.changed) return;
    state.selectedId = result.selectedId;
    checkpoint();
    renderAll();
    announce(delta < 0 ? "Bloco movido para cima." : "Bloco movido para baixo.");
  }

  function reorderBlock(blockId, targetIndex) {
    const result = reorderVisualBlock(state.document, blockId, targetIndex);
    clearDragState();
    if (!result.changed) return;
    state.selectedId = result.selectedId;
    checkpoint();
    renderAll();
  }

  function pasteBlock() {
    if (!state.clipboardBlock) return;
    const block = clone(state.clipboardBlock);
    block.id = uniqueBlockId(block.type);
    const index = selectedIndex();
    state.document.blocks.splice(index < 0 ? state.document.blocks.length : index + 1, 0, block);
    state.selectedId = block.id;
    checkpoint();
    renderAll();
    announce("Bloco colado.");
  }

  function addFeature() {
    const block = selectedBlock();
    if (!block || block.type !== "feature-grid" || block.content.items.length >= 12) return;
    block.content.items.push({ title: "Novo destaque", text: "Descreva este conteúdo.", media_asset_id: "", button_text: "", button_url: "" });
    checkpoint();
    renderAll();
  }

  function removeFeatureItem(index) {
    const block = selectedBlock();
    if (!block || block.type !== "feature-grid") return;
    block.content.items.splice(index, 1);
    checkpoint();
    renderAll();
  }

  function removeGalleryMedia(mediaId) {
    const block = selectedBlock();
    if (!block || block.type !== "gallery") return;
    block.content.media_asset_ids = block.content.media_asset_ids.filter((id) => id !== mediaId);
    checkpoint();
    renderAll();
  }

  function openMediaPicker(field, kind, target = "block") {
    els.mediaDialog.dataset.field = field;
    els.mediaDialog.dataset.kind = kind;
    state.mediaTarget = target;
    const selectedIds = new Set(field === "media_asset_ids" ? selectedBlock()?.content.media_asset_ids || [] : []);
    const assets = state.media.filter((asset) => {
      const mime = String(asset.mime_type || "");
      if (kind === "any") return mime.startsWith("image/") || mime.startsWith("video/");
      return kind === "video" ? mime.startsWith("video/") : mime.startsWith("image/");
    });
    els.mediaDialogTitle.textContent = kind === "video" ? "Escolher vídeo" : kind === "any" ? "Escolher imagem ou vídeo" : "Escolher imagem";
    els.mediaGrid.innerHTML = assets.map((asset) => `<button type="button" data-media-choice="${escapeAttr(asset.id)}" class="${selectedIds.has(asset.id) ? "is-selected" : ""}">${String(asset.mime_type).startsWith("video/") ? `<video src="${escapeAttr(asset.public_url)}" muted preload="metadata"></video><span>${icon("video")}</span>` : `<img src="${escapeAttr(asset.public_url)}" alt="">`}<strong>${escapeHtml(asset.original_filename || asset.alt_text || "Mídia")}</strong></button>`).join("") || '<p class="vp-empty">Nenhum arquivo compatível na Biblioteca de Mídia.</p>';
    els.mediaDialog.showModal();
  }

  function selectMedia(mediaId) {
    const field = els.mediaDialog.dataset.field;
    if (state.mediaTarget === "page") {
      setPath(state.document.settings, field, mediaId);
      checkpoint();
      closeMediaPicker();
      renderAll();
      return;
    }
    const block = selectedBlock();
    if (!block) return;
    if (field === "media_asset_ids") {
      if (!block.content.media_asset_ids.includes(mediaId)) block.content.media_asset_ids.push(mediaId);
    } else {
      setPath(block.content, field, mediaId);
    }
    checkpoint();
    closeMediaPicker();
    renderAll();
  }

  function closeMediaPicker() {
    if (els.mediaDialog.open) els.mediaDialog.close();
  }

  async function save() {
    if (!state.portal || state.saving || !isDirty()) return state.portal;
    state.saving = true;
    renderSaveState("Salvando...");
    try {
      const payload = await adminApi(`/api/v1/admin/visual-portals/${encodeURIComponent(state.portal.id)}`, {
        method: "PATCH",
        body: { document: state.document, expected_revision: state.portal.draft_revision },
      });
      state.portal = payload.data.portal;
      state.document = clone(state.portal.document);
      state.original = stableJson(state.document);
      state.history = [clone(state.document)];
      state.historyIndex = 0;
      await loadVersions();
      renderAll();
      announce("Alterações salvas.");
      onSaved(state.portal);
      return state.portal;
    } catch (error) {
      announce(error.message || "Não foi possível salvar.", true);
      throw error;
    } finally {
      state.saving = false;
      renderSaveState();
    }
  }

  async function publish() {
    try {
      if (isDirty()) await save();
      if (!window.confirm("Publicar esta versão agora? O endereço público será atualizado.")) return;
      setBusy(true, "Publicando portal...");
      const payload = await adminApi(`/api/v1/admin/visual-portals/${encodeURIComponent(state.portal.id)}/publish`, { method: "POST", body: {} });
      state.portal = payload.data.portal;
      state.original = stableJson(state.document);
      renderAll();
      onSaved(state.portal);
      announce(payload.data.published ? "Portal publicado com sucesso." : "Esta versão já estava publicada.");
    } catch (error) {
      announce(error.message || "Não foi possível publicar.", true);
    } finally {
      setBusy(false);
    }
  }

  function preview() {
    state.previewViewport = state.viewport;
    updatePreviewDialog();
    els.previewDialog.showModal();
  }

  function setPreviewViewport(viewport) {
    if (!new Set(["desktop", "mobile"]).has(viewport)) return;
    state.previewViewport = viewport;
    updatePreviewDialog();
  }

  function updatePreviewDialog() {
    els.previewDialog.dataset.viewport = state.previewViewport;
    els.previewDeviceButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.previewViewport === state.previewViewport)));
    els.previewDialogFrame.srcdoc = previewDocumentHtml();
  }

  async function saveTemplate() {
    const name = window.prompt("Nome do novo modelo:", `${state.portal.name} - modelo`);
    if (!name?.trim()) return;
    try {
      await adminApi("/api/v1/admin/visual-portal-templates", {
        method: "POST",
        body: { hotel_id: state.portal.hotel_id, module_key: state.portal.module_key, name: name.trim(), description: `Criado a partir de ${state.portal.name}`, document: state.document },
      });
      await loadTemplates();
      state.leftTab = "templates";
      renderLeftPanel();
      announce("Modelo salvo.");
    } catch (error) {
      announce(error.message || "Não foi possível salvar o modelo.", true);
    }
  }

  async function applyTemplateDocument(templateId) {
    if (!window.confirm("Substituir todos os blocos atuais por este modelo?")) return;
    try {
      const params = new URLSearchParams({ hotel_id: state.portal.hotel_id, module_key: state.portal.module_key });
      const payload = await adminApi(`/api/v1/admin/visual-portal-templates/${encodeURIComponent(templateId)}?${params}`);
      state.document = clone(payload.data.template.document);
      state.selectedId = state.document.blocks[0]?.id || null;
      checkpoint();
      renderAll();
      announce("Modelo aplicado. Salve para confirmar.");
    } catch (error) {
      announce(error.message || "Não foi possível aplicar o modelo.", true);
    }
  }

  async function archiveTemplateDocument(templateId) {
    if (!window.confirm("Arquivar este modelo salvo?")) return;
    try {
      await adminApi(`/api/v1/admin/visual-portal-templates/${encodeURIComponent(templateId)}`, { method: "DELETE", body: {} });
      await loadTemplates();
      renderLeftPanel();
    } catch (error) {
      announce(error.message || "Não foi possível arquivar o modelo.", true);
    }
  }

  async function restoreVersionDocument(versionId) {
    if (!window.confirm("Restaurar esta versão como novo rascunho? A versão publicada continuará no ar até uma nova publicação.")) return;
    try {
      setBusy(true, "Restaurando versão...");
      const payload = await adminApi(`/api/v1/admin/visual-portals/${encodeURIComponent(state.portal.id)}/versions/${encodeURIComponent(versionId)}/restore`, { method: "POST", body: {} });
      state.portal = payload.data.portal;
      state.document = clone(state.portal.document);
      state.original = stableJson(state.document);
      state.selectedId = state.document.blocks[0]?.id || null;
      state.history = [clone(state.document)];
      state.historyIndex = 0;
      await loadVersions();
      renderAll();
      onSaved(state.portal);
      announce("Versão restaurada como rascunho.");
    } catch (error) {
      announce(error.message || "Não foi possível restaurar a versão.", true);
    } finally {
      setBusy(false);
    }
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    state.document = clone(state.history[state.historyIndex]);
    if (!selectedBlock()) state.selectedId = state.document.blocks[0]?.id || null;
    renderAll();
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    state.document = clone(state.history[state.historyIndex]);
    if (!selectedBlock()) state.selectedId = state.document.blocks[0]?.id || null;
    renderAll();
  }

  function checkpoint() {
    const snapshot = stableJson(state.document);
    if (stableJson(state.history[state.historyIndex]) === snapshot) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(clone(state.document));
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
    state.historyIndex = state.history.length - 1;
  }

  function renderSaveState(forced = "") {
    const text = forced || (isDirty() ? "Alterações não salvas" : `Versão ${state.portal?.draft_revision || 1} salva`);
    els.saveState.textContent = text;
    els.saveState.dataset.dirty = String(isDirty());
    els.save.disabled = state.saving || !isDirty();
  }

  function isDirty() {
    return Boolean(state.document && stableJson(state.document) !== state.original);
  }

  function selectedBlock() {
    return state.document?.blocks.find((block) => block.id === state.selectedId) || null;
  }

  function selectedIndex() {
    return state.document?.blocks.findIndex((block) => block.id === state.selectedId) ?? -1;
  }

  function setBusy(visible, text = "") {
    els.busy.hidden = !visible;
    if (text) els.busyText.textContent = text;
  }

  function announce(message, error = false) {
    els.toast.textContent = message;
    els.toast.dataset.error = String(error);
    els.toast.hidden = false;
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(() => { els.toast.hidden = true; }, 3600);
  }

  function previewDocumentHtml() {
    const settings = state.document.settings;
    const previousViewport = state.viewport;
    let blocks = "";
    try {
      state.viewport = state.previewViewport;
      blocks = state.document.blocks.map((block, index) => renderEditableBlock(block, index).replace(/draggable="true"/g, "").replace(/<div class="vp-block-toolbar">[\s\S]*?<\/div>/, "")).join("");
    } finally {
      state.viewport = previousViewport;
    }
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:${settings.background_color};color:${settings.text_color};font-family:${settings.font_family}}${builderPreviewCss()}</style></head><body><main class="vp-preview-page ${settings.background_media_asset_id ? "has-page-media" : ""}" style="--vp-page-bg:${settings.background_color};--vp-page-text:${settings.text_color};--vp-page-primary:${settings.primary_color};--vp-page-surface:${settings.surface_color};--vp-page-font:${settings.font_family};--vp-page-gap:${settings.block_gap}px;--vp-page-padding:${settings.page_padding}px;--vp-page-overlay:${Number(settings.background_overlay || 0) / 100};--vp-page-media-position:${settings.background_position || "center"};--vp-page-media-fit:${settings.background_fit || "cover"}">${pageBackgroundPreview(settings)}<div class="vp-page-content">${blocks}</div></main></body></html>`;
  }
}

function createBuilderRoot() {
  const root = document.createElement("section");
  root.id = "visualPortalBuilder";
  root.className = "vp-builder";
  root.hidden = true;
  root.innerHTML = `
    <header class="vp-builder-header">
      <div class="vp-builder-brand"><button type="button" data-builder-close title="Voltar para Conteúdos">${icon("back")}</button><span class="vp-builder-mark">F</span><div><strong data-builder-title>Construtor de portal</strong><small data-builder-path></small></div><em data-builder-status></em></div>
      <div class="vp-history-controls"><button type="button" data-builder-undo title="Desfazer (Ctrl+Z)">${icon("undo")}</button><button type="button" data-builder-redo title="Refazer (Ctrl+Y)">${icon("redo")}</button></div>
      <div class="vp-device-controls" aria-label="Visualização"><button type="button" data-viewport="desktop" aria-pressed="true">${icon("desktop")}<span>Desktop</span></button><button type="button" data-viewport="mobile" aria-pressed="false">${icon("mobile")}<span>Mobile</span></button></div>
      <div class="vp-zoom-control"><span>${icon("zoomout")}</span><input type="range" min="45" max="110" value="82" step="1" aria-label="Zoom"><output>82%</output></div>
      <div class="vp-builder-actions"><span data-builder-save-state></span><button type="button" data-builder-preview>${icon("eye")} Visualizar</button><button type="button" data-builder-save>${icon("save")} Salvar</button><button class="primary" type="button" data-builder-publish>${icon("publish")} Publicar</button></div>
    </header>
    <div class="vp-builder-workspace">
      <aside class="vp-left-panel"><nav><button type="button" data-builder-tab="blocks" aria-selected="true">${icon("plusgrid")}<span>Blocos</span></button><button type="button" data-builder-tab="layers">${icon("layers")}<span>Camadas</span></button><button type="button" data-builder-tab="templates">${icon("template")}<span>Modelos</span></button><button type="button" data-builder-tab="versions">${icon("history")}<span>Versões</span></button></nav><div class="vp-left-content"></div></aside>
      <main class="vp-stage" data-viewport="desktop"><div class="vp-stage-toolbar"><button type="button" data-page-settings>${icon("sliders")} Configurações da página</button><span>Arraste os blocos para reorganizar</span></div><div class="vp-stage-scroll"><div class="vp-canvas-frame"><div class="vp-builder-canvas" data-builder-canvas></div></div></div></main>
      <aside class="vp-inspector"><header><div><strong>Propriedades</strong><span>Selecione um bloco</span></div>${icon("sliders")}</header><div class="vp-inspector-body"></div></aside>
    </div>
    <div class="vp-builder-busy" hidden><span class="admin-modern-spinner"></span><strong>Carregando...</strong></div>
    <p class="vp-builder-toast" role="status" aria-live="polite" hidden></p>
    <dialog class="vp-media-picker"><header><div><strong>Biblioteca de Mídia</strong><span>Selecione um arquivo da unidade</span></div><button type="button" data-media-picker-close>${icon("close")}</button></header><div class="vp-media-picker-grid"></div></dialog>
    <dialog class="vp-live-preview" data-viewport="desktop"><header><strong>Pré-visualização</strong><div class="vp-preview-device-controls" aria-label="Dispositivo da pré-visualização"><button type="button" data-preview-viewport="desktop" aria-pressed="true">${icon("desktop")} Desktop</button><button type="button" data-preview-viewport="mobile" aria-pressed="false">${icon("mobile")} Mobile</button></div><button type="button" data-preview-close title="Fechar">${icon("close")}</button></header><div class="vp-preview-frame-wrap"><iframe title="Pré-visualização do portal" sandbox="allow-scripts allow-forms allow-popups allow-presentation"></iframe></div></dialog>`;
  document.body.append(root);
  return root;
}

function mapElements(root) {
  return {
    title: root.querySelector("[data-builder-title]"),
    path: root.querySelector("[data-builder-path]"),
    status: root.querySelector("[data-builder-status]"),
    saveState: root.querySelector("[data-builder-save-state]"),
    undo: root.querySelector("[data-builder-undo]"),
    redo: root.querySelector("[data-builder-redo]"),
    save: root.querySelector("[data-builder-save]"),
    zoom: root.querySelector(".vp-zoom-control input"),
    zoomLabel: root.querySelector(".vp-zoom-control output"),
    deviceButtons: [...root.querySelectorAll("[data-viewport]")],
    leftTabs: [...root.querySelectorAll("[data-builder-tab]")],
    leftContent: root.querySelector(".vp-left-content"),
    stage: root.querySelector(".vp-stage"),
    canvas: root.querySelector("[data-builder-canvas]"),
    inspectorTitle: root.querySelector(".vp-inspector header strong"),
    inspectorSubtitle: root.querySelector(".vp-inspector header span"),
    inspectorBody: root.querySelector(".vp-inspector-body"),
    busy: root.querySelector(".vp-builder-busy"),
    busyText: root.querySelector(".vp-builder-busy strong"),
    toast: root.querySelector(".vp-builder-toast"),
    mediaDialog: root.querySelector(".vp-media-picker"),
    mediaDialogTitle: root.querySelector(".vp-media-picker header strong"),
    mediaGrid: root.querySelector(".vp-media-picker-grid"),
    previewDialog: root.querySelector(".vp-live-preview"),
    previewDialogFrame: root.querySelector(".vp-live-preview iframe"),
    previewDeviceButtons: [...root.querySelectorAll("[data-preview-viewport]")],
  };
}

function createBlock(type) {
  const shared = { id: `${type}-${crypto.randomUUID().slice(0, 8)}`, type, styles: { base: { width: "content", padding_top: 40, padding_bottom: 40 }, desktop: {}, mobile: { padding_top: 28, padding_bottom: 28 } }, visibility: { desktop: true, mobile: true } };
  const content = {
    hero: { eyebrow: "Bem-vindo", title: "Uma experiência especial", text: "Conte sua história e conduza o visitante para a próxima ação.", button_text: "Saiba mais", button_url: "/", media_asset_id: "", overlay: 35 },
    heading: { title: "Novo título", text: "Adicione uma descrição para apresentar esta seção." },
    text: { text: "Escreva aqui seu conteúdo. Você pode criar novos parágrafos deixando uma linha em branco." },
    button: { text: "Novo botão", url: "/", style: "solid" },
    image: { media_asset_id: "", alt_text: "", caption: "", fit: "cover" },
    video: { media_asset_id: "", poster_media_asset_id: "", title: "", autoplay: false, muted: true, loop: false, controls: true },
    embed: { title: "Conteúdo incorporado", url: "", aspect_ratio: "16:9", allow_fullscreen: true },
    gallery: { title: "Galeria", media_asset_ids: [] },
    "feature-grid": { items: [{ title: "Novo destaque", text: "Descreva este conteúdo.", media_asset_id: "", button_text: "", button_url: "" }] },
    quote: { quote: "Uma frase memorável para destacar.", author: "" },
    contact: { title: "Fale conosco", text: "Estamos à disposição para ajudar.", phone: "", email: "", address: "", button_text: "", button_url: "" },
    divider: { label: "" },
    spacer: {},
  }[type];
  if (type === "spacer") shared.styles.base.min_height = 64;
  if (type === "feature-grid") shared.styles.base.columns = 3;
  if (type === "gallery") shared.styles.base.columns = 3;
  if (["feature-grid", "gallery"].includes(type)) shared.styles.mobile.columns = 1;
  if (type === "hero") Object.assign(shared.styles.mobile, { heading_size: 48, text_size: 16, padding_inline: 18 });
  if (type === "heading") shared.styles.mobile.heading_size = 38;
  if (type === "quote") shared.styles.mobile.heading_size = 30;
  if (["hero", "heading", "quote", "button"].includes(type)) shared.styles.base.alignment = "center";
  return { ...shared, content };
}

function builderPreviewCss() {
  return `.vp-preview-page{position:relative;min-height:100vh;background:var(--vp-page-bg);color:var(--vp-page-text);font-family:var(--vp-page-font)}.vp-page-background{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}.vp-page-background.is-fixed{position:fixed}.vp-page-background img,.vp-page-background video{width:100%;height:100%;object-fit:var(--vp-page-media-fit);object-position:var(--vp-page-media-position)}.vp-page-background span{position:absolute;inset:0;background:rgba(0,0,0,var(--vp-page-overlay))}.vp-page-content{position:relative;z-index:1;display:grid;gap:var(--vp-page-gap)}.vp-canvas-block{position:relative;padding:40px var(--vp-page-padding)}.vp-block-toolbar{display:none}.vp-preview-inner{width:min(100%,1120px);margin:auto}.vp-preview-hero{display:grid;place-items:center;min-height:420px;padding:64px;background-position:center;background-size:cover;text-align:center}.vp-preview-hero.has-media{color:#fff}.vp-preview-hero h1{font-size:clamp(2.6rem,6vw,6rem);line-height:1}.vp-preview-inner h2{font-size:clamp(2rem,4vw,4rem)}.vp-preview-button{display:inline-flex;padding:12px 18px;border-radius:999px;background:var(--vp-page-primary);color:#fff;text-decoration:none}.vp-preview-grid,.vp-preview-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.vp-preview-grid article{overflow:hidden;border:1px solid #ddd;border-radius:24px}.vp-preview-grid article>div{padding:18px}.vp-preview-grid img,.vp-preview-gallery img,.vp-preview-media img,.vp-preview-media video{width:100%;display:block;object-fit:cover}.vp-preview-grid img,.vp-preview-gallery img{aspect-ratio:4/3}.vp-preview-quote{font-size:2.4rem;text-align:center}.vp-preview-embed{position:relative;aspect-ratio:var(--vp-embed-ratio);overflow:hidden;border-radius:inherit;background:#e9ebef}.vp-preview-embed iframe{width:100%;height:100%;border:0}.vp-preview-embed>span{display:none}@media(max-width:760px){.vp-preview-grid,.vp-preview-gallery{grid-template-columns:1fr}.vp-preview-hero{padding:32px 18px}.vp-canvas-block{padding-inline:18px}}`;
}

function editableStyle(style) {
  return [
    `text-align:${style.alignment || "left"}`,
    `background:${style.background_color || "transparent"}`,
    `color:${style.text_color || "inherit"}`,
    `--vp-accent:${style.accent_color || "var(--vp-page-primary)"}`,
    `--vp-columns:${style.columns || 3}`,
    style.heading_size ? `--vp-heading-size:${Number(style.heading_size)}px` : "",
    style.text_size ? `--vp-text-size:${Number(style.text_size)}px` : "",
    `padding:${Number(style.padding_top || 0)}px ${Number(style.padding_inline ?? 24)}px ${Number(style.padding_bottom || 0)}px`,
    `min-height:${Number(style.min_height || 0)}px`,
    `border-radius:${Number(style.border_radius || 0)}px`,
    `transform:translate(${Number(style.offset_x || 0)}px,${Number(style.offset_y || 0)}px)`,
  ].join(";");
}

function mediaPlaceholder(label) { return `<div class="vp-media-placeholder">${icon("image")}<span>${escapeHtml(label)}</span></div>`; }
function embedRatio(value) { return ({ "16:9": "16 / 9", "4:3": "4 / 3", "1:1": "1", "9:16": "9 / 16" })[value] || "16 / 9"; }
function previewParagraphs(value) { return String(value || "").split(/\n{2,}/).filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join(""); }
function previewButton(text, url, style = "solid") { return text ? `<a class="vp-preview-button is-${escapeAttr(style || "solid")}" href="${escapeAttr(url || "#")}" tabindex="-1">${escapeHtml(text)}</a>` : ""; }
function blockLabel(block, index) { return block.content?.title || block.content?.text?.slice(0, 32) || `${BLOCK_LABELS[block.type]} ${index + 1}`; }
function iconForBlock(type) { return BLOCKS.find(([key]) => key === type)?.[3] || icon("grid"); }
function uniqueBlockId(type) { return `${type}-${crypto.randomUUID().slice(0, 8)}`; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function escapeCssUrl(value) { return String(value || "").replace(/["'()\\\n\r]/g, ""); }
function formatVersionDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "data indisponível" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stableJson(value) { return JSON.stringify(value); }
function setPath(target, path, value) { const parts = path.split("."); const last = parts.pop(); const parent = parts.reduce((current, part) => current[Number.isInteger(Number(part)) ? Number(part) : part], target); if (value === undefined) delete parent[last]; else parent[last] = value; }
function inputValue(input) { if (input.type === "checkbox") return input.checked; if (input.type === "number" || input.type === "range") return Number(input.value); return input.value; }
function emptyAsUndefined(input) { return input.value === "" ? undefined : inputValue(input); }
function options(entries, selected) { return entries.map(([value, label]) => `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`).join(""); }
function textField(label, field, value) { return `<label><span>${escapeHtml(label)}</span><input data-content-field="${escapeAttr(field)}" value="${escapeAttr(value || "")}"></label>`; }
function textareaField(label, field, value, rows = 5) { return `<label><span>${escapeHtml(label)}</span><textarea data-content-field="${escapeAttr(field)}" rows="${rows}">${escapeHtml(value || "")}</textarea></label>`; }
function colorField(label, field, value, scope, optional = false) { const attr = scope === "doc" ? "data-doc-field" : "data-style-field"; return `<label class="vp-color-field"><span>${escapeHtml(label)}</span><input type="color" ${attr}="${escapeAttr(field)}" value="${escapeAttr(value || "#ffffff")}"><input ${attr}="${escapeAttr(field)}" value="${escapeAttr(value || "")}" placeholder="${optional ? "Herdar" : "#000000"}"></label>`; }
function rangeField(label, field, value, min, max, scope, optional = false) { const attr = scope === "doc" ? "data-doc-field" : scope === "content" ? "data-content-field" : "data-style-field"; return `<label class="vp-range-field"><span>${escapeHtml(label)} <output>${value === "" ? (optional ? "Herdar" : min) : value}</output></span><input type="range" ${attr}="${escapeAttr(field)}" min="${min}" max="${max}" value="${value === "" ? min : value}"></label>`; }
function positionRangeField(label, field, value) { const normalized = Number(value || 0); return `<label class="vp-range-field"><span>${escapeHtml(label)} <output>${normalized}px</output></span><input type="range" data-style-field="${escapeAttr(field)}" min="-320" max="320" value="${normalized}"></label>`; }
function toggleField(label, field, checked, scope = "content") { const attr = scope === "visibility" ? "data-visibility-field" : "data-content-field"; return `<label class="vp-toggle"><input type="checkbox" ${attr}="${escapeAttr(field)}" ${checked ? "checked" : ""}><span></span><strong>${escapeHtml(label)}</strong></label>`; }
function mediaField(label, field, value, kind) { return `<div class="vp-media-field"><span>${escapeHtml(label)}</span><button type="button" data-choose-media="${escapeAttr(field)}" data-media-kind="${kind}">${value ? `${icon(kind === "video" ? "video" : "image")}<strong>Trocar arquivo</strong>` : `${icon("plus")}<strong>Escolher da biblioteca</strong>`}</button></div>`; }
function pageMediaField(value) { return `<div class="vp-media-field"><span>Imagem ou vídeo</span><button type="button" data-choose-media="background_media_asset_id" data-media-kind="any" data-media-target="page">${value ? `${icon("image")}<strong>Trocar fundo</strong>` : `${icon("plus")}<strong>Escolher da biblioteca</strong>`}</button></div>`; }
function docToggleField(label, field, checked) { return `<label class="vp-toggle"><input type="checkbox" data-doc-field="${escapeAttr(field)}" ${checked ? "checked" : ""}><span></span><strong>${escapeHtml(label)}</strong></label>`; }

function icon(name) {
  const paths = {
    back: '<path d="m15 18-6-6 6-6"/>', undo: '<path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/>', redo: '<path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/>', desktop: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>', mobile: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>', zoomout: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6"/>', eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>', save: '<path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>', publish: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v6h14v-6"/>', plusgrid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M17.5 14v7M14 17.5h7"/>', layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>', template: '<path d="M4 4h16v16H4zM4 10h16M10 10v10"/>', history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>', sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', sparkles: '<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z"/>', heading: '<path d="M5 5v14M19 5v14M5 12h14"/>', text: '<path d="M4 6h16M4 10h16M4 14h12M4 18h9"/>', button: '<rect x="3" y="7" width="18" height="10" rx="3"/><path d="M9 12h6"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m3 17 5-5 4 4 3-3 6 6"/>', video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>', embed: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m9 10-3 2 3 2M15 10l3 2-3 2"/>', move: '<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>', gallery: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>', grid: '<rect x="3" y="4" width="5" height="16"/><rect x="10" y="4" width="5" height="16"/><rect x="17" y="4" width="4" height="16"/>', quote: '<path d="M5 7h5v5H7v5H4v-7a3 3 0 0 1 3-3M15 7h5v5h-3v5h-3v-7a3 3 0 0 1 3-3"/>', contact: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', divider: '<path d="M3 12h18"/>', spacer: '<path d="M8 3h8M8 21h8M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3"/>', grip: '<circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/>', up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>', trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>', plus: '<path d="M12 5v14M5 12h14"/>', bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.grid}</svg>`;
}
