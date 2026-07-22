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
  ["embed", "Incorporar", "Endereço HTTPS ou HTML sanitizado", icon("embed")],
  ["gallery", "Galeria", "Conjunto de imagens", icon("gallery")],
  ["feature-grid", "Grade", "Cards de serviços e destaques", icon("grid")],
  ["faq", "Perguntas frequentes", "Respostas organizadas em acordeão", icon("faq")],
  ["stats", "Indicadores", "Números e resultados em destaque", icon("stats")],
  ["timeline", "Linha do tempo", "Etapas, agenda ou trajetória", icon("timeline")],
  ["testimonials", "Depoimentos", "Relatos com foto e identificação", icon("quote")],
  ["icon-list", "Lista com ícones", "Benefícios, facilidades ou atalhos", icon("list")],
  ["cta-banner", "Chamada destacada", "Faixa visual com mídia e botões", icon("megaphone")],
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
    activePageId: null,
    original: "",
    selectedId: null,
    viewport: "desktop",
    styleTarget: "base",
    leftTab: "blocks",
    zoom: 82,
    media: [],
    mediaBrowserAssets: [],
    mediaHotels: [],
    mediaFolders: [],
    mediaBreadcrumbs: [],
    mediaBrowseHotelId: "",
    mediaFolderId: "",
    mediaSearch: "",
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
    autosaveTimer: null,
    previewDocument: null,
    previewVersionId: "",
    previewPageId: "",
    editorMobileMenuOpen: false,
  };
  const els = mapElements(root);

  root.addEventListener("click", handleClick);
  root.addEventListener("input", handleInput);
  root.addEventListener("change", handleInput);
  root.addEventListener("submit", handleSubmit);
  root.addEventListener("dragstart", handleDragStart);
  root.addEventListener("dragover", handleDragOver);
  root.addEventListener("drop", handleDrop);
  root.addEventListener("dragend", clearDragState);
  root.addEventListener("pointerdown", handlePositionPointerDown);
  window.addEventListener("pointermove", handlePositionPointerMove);
  window.addEventListener("pointerup", handlePositionPointerUp);
  document.addEventListener("keydown", handleKeyboard);
  window.addEventListener("resize", handleResize);
  window.addEventListener("message", handlePreviewMessage);

  return {
    async open(portalId) {
      root.hidden = false;
      document.documentElement.classList.add("visual-builder-open");
      setBusy(true, "Abrindo o construtor...");
      try {
        const payload = await adminApi(`/api/v1/admin/visual-portals/${encodeURIComponent(portalId)}`);
        state.portal = payload.data.portal;
        state.document = clone(state.portal.document);
        state.activePageId = state.document.pages[0]?.id || null;
        state.original = stableJson(state.document);
        state.selectedId = activePage()?.blocks[0]?.id || null;
        state.history = [clone(state.document)];
        state.historyIndex = 0;
        state.leftTab = "blocks";
        await Promise.all([loadMedia(), loadTemplates(), loadVersions()]);
        renderAll();
        scheduleAutosave();
        requestAnimationFrame(() => fitCanvas(true));
      } catch (error) {
        forceClose();
        announce(error.message || "Não foi possível abrir o construtor.", true);
      } finally {
        setBusy(false);
      }
    },
  };

  async function close() {
    if (isDirty() && !await requestConfirmation({ title: "Sair sem salvar?", message: "As alterações feitas desde o último salvamento serão perdidas.", confirmLabel: "Sair sem salvar", danger: true })) return;
    forceClose();
  }

  function forceClose() {
    window.clearTimeout(state.autosaveTimer);
    root.hidden = true;
    document.documentElement.classList.remove("visual-builder-open");
    state.portal = null;
    state.document = null;
    state.activePageId = null;
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

  async function loadMediaHotels() {
    if (state.mediaHotels.length) return;
    const payload = await adminApi("/api/v1/admin/hotels?sort=name");
    state.mediaHotels = payload.data.hotels || [];
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
    renderPortalPath();
    els.status.textContent = state.portal.status === "published" ? "Publicado" : "Rascunho";
    els.status.dataset.status = state.portal.status;
    const hasPublishedVersion = state.portal.status === "published" && Number(state.portal.published_revision || 0) > 0;
    els.publicLink.hidden = !hasPublishedVersion;
    els.publicLink.href = hasPublishedVersion ? state.portal.public_url : "#";
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
    if (state.leftTab === "pages") {
      const page = activePage();
      const hasRoomService = state.document.pages.some((item) => item.type === "room-service");
      els.leftContent.innerHTML = `<div class="vp-panel-heading"><div><strong>Páginas</strong><span>${state.document.pages.length} de 20 páginas</span></div><button type="button" data-add-page title="Adicionar página livre">${icon("plus")}</button></div><div class="vp-pages">${state.document.pages.map((item) => `<article class="${item.id === state.activePageId ? "is-selected" : ""}"><button type="button" data-select-page="${escapeAttr(item.id)}"><span>${icon(item.type === "room-service" ? "shopping-bag" : item.slug ? "page" : "home")}</span><div><strong>${escapeHtml(item.name)}</strong><small>${item.type === "room-service" ? "Página conectada ao cardápio" : item.slug ? `/${escapeHtml(item.slug)}` : "Página inicial"}${item.show_in_navigation ? " · no menu" : ""}</small></div></button><div>${item.type === "room-service" ? "" : `<button type="button" data-duplicate-page="${escapeAttr(item.id)}" title="Duplicar página">${icon("copy")}</button>`}<button type="button" data-delete-page="${escapeAttr(item.id)}" title="Excluir página" ${item.slug ? "" : "disabled"}>${icon("trash")}</button></div></article>`).join("")}</div>${hasRoomService ? "" : `<div class="vp-page-presets"><strong>Página pronta</strong><button type="button" data-add-room-service-page><span>${icon("shopping-bag")}</span><div><b>Room Service</b><small>Cardápio e pedidos da unidade</small></div>${icon("plus")}</button></div>`}${page ? '<button type="button" class="vp-secondary-action" data-page-settings>Configurar página atual</button>' : ""}`;
      return;
    }
    if (state.leftTab === "blocks") {
      if (isRoomServicePage()) {
        els.leftContent.innerHTML = `<div class="vp-system-page-panel">${icon("shopping-bag")}<strong>Room Service conectado</strong><p>Esta página usa automaticamente o cardápio, os horários e os quartos da unidade. O conteúdo é administrado pelo ERP Room Service.</p></div>`;
        return;
      }
      els.leftContent.innerHTML = `<div class="vp-library-search"><span>${icon("search")}</span><input type="search" data-block-search placeholder="Buscar bloco" aria-label="Buscar bloco"></div><div class="vp-block-library">${BLOCKS.map(([type, label, description, svg]) => `<button type="button" draggable="true" data-add-block="${type}" title="Arraste ou clique para adicionar"><span>${svg}</span><strong>${label}</strong><small>${description}</small></button>`).join("")}</div>`;
      return;
    }
    if (state.leftTab === "layers") {
      if (isRoomServicePage()) {
        els.leftContent.innerHTML = `<div class="vp-system-page-panel">${icon("layers")}<strong>Página gerenciada pelo sistema</strong><p>O cabeçalho pertence a este portal. O cardápio é carregado sem um segundo cabeçalho.</p></div>`;
        return;
      }
      const blocks = pageBlocks();
      els.leftContent.innerHTML = `<div class="vp-panel-heading"><div><strong>Camadas</strong><span>${blocks.length} blocos em ${escapeHtml(activePage()?.name || "Página")}</span></div></div><div class="vp-layers">${blocks.map((block, index) => `<button type="button" draggable="true" data-layer-id="${escapeAttr(block.id)}" class="${block.id === state.selectedId ? "is-selected" : ""}"><span class="vp-layer-drag">${icon("grip")}</span><span>${iconForBlock(block.type)}</span><strong>${escapeHtml(blockLabel(block, index))}</strong><small>${block.visibility.desktop ? "D" : ""}${block.visibility.mobile ? "M" : ""}</small></button>`).join("") || '<p class="vp-empty">A página ainda não tem blocos.</p>'}</div>`;
      return;
    }
    if (state.leftTab === "templates") {
      els.leftContent.innerHTML = `<div class="vp-panel-heading"><div><strong>Modelos</strong><span>Reutilize páginas prontas</span></div><button type="button" data-save-template title="Salvar página atual como modelo">${icon("plus")}</button></div><div class="vp-templates">${state.templates.map((template) => `<article><span>${icon(template.builtin ? "template" : "bookmark")}</span><div><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.description || "Modelo salvo pela sua equipe")}</small></div><button type="button" data-apply-template="${escapeAttr(template.id)}">Aplicar</button>${template.builtin ? "" : `<button type="button" class="icon-only danger" data-archive-template="${escapeAttr(template.id)}" title="Arquivar modelo">${icon("trash")}</button>`}</article>`).join("") || '<p class="vp-empty">Nenhum modelo disponível.</p>'}</div>`;
      return;
    }
    els.leftContent.innerHTML = `<div class="vp-panel-heading"><div><strong>Histórico</strong><span>Confira a prévia antes de restaurar</span></div></div><div class="vp-versions">${state.versions.map((version) => `<article><span data-version-type="${escapeAttr(version.version_type)}">${icon(version.version_type === "published" ? "publish" : version.version_type === "restored" ? "undo" : "save")}</span><div><strong>Versão ${Number(version.revision)}</strong><small>${version.version_type === "published" ? "Publicada" : version.version_type === "restored" ? "Restaurada" : "Rascunho"} · ${escapeHtml(formatVersionDate(version.created_at))}</small><em>${escapeHtml(version.created_by_name || "Equipe")}</em></div><button type="button" data-preview-version="${escapeAttr(version.id)}">Ver prévia</button></article>`).join("") || '<p class="vp-empty">Nenhuma versão salva.</p>'}</div>`;
  }

  function renderCanvas() {
    const page = activePage();
    if (!page) return;
    const settings = page.settings;
    const frameWidth = state.viewport === "mobile" ? 390 : 1440;
    els.stage.dataset.viewport = state.viewport;
    els.stage.style.setProperty("--preview-width", `${frameWidth}px`);
    els.stage.style.setProperty("--preview-scale", state.zoom / 100);
    const site = state.document.settings;
    const pageContent = isRoomServicePage(page)
      ? renderRoomServicePagePreview()
      : page.blocks.map((block, index) => renderEditableBlock(block, index)).join("") || `<button type="button" class="vp-empty-canvas" data-add-block="hero">${icon("plus")}<strong>Adicione o primeiro bloco</strong><span>Comece por uma capa ou arraste qualquer elemento da biblioteca.</span></button>`;
    els.canvas.innerHTML = `<div class="vp-preview-page ${settings.background_media_asset_id ? "has-page-media" : ""} ${state.editorMobileMenuOpen ? "is-editor-menu-open" : ""}" style="--vp-page-bg:${escapeAttr(settings.background_color)};--vp-page-text:${escapeAttr(settings.text_color)};--vp-page-primary:${escapeAttr(site.primary_color)};--vp-page-surface:${escapeAttr(settings.surface_color)};--vp-page-font:${escapeAttr(site.font_family)};--vp-page-gap:${Number(settings.block_gap)}px;--vp-page-padding:${Number(settings.page_padding)}px;--vp-page-overlay:${Number(settings.background_overlay || 0) / 100};--vp-page-media-position:${escapeAttr(settings.background_position || "center")};--vp-page-media-fit:${escapeAttr(settings.background_fit || "cover")}">${pageBackgroundPreview(settings)}<span class="vp-alignment-guide is-vertical" data-alignment-guide="x"></span>${renderEditorHeader()}<div class="vp-page-content">${pageContent}</div></div>`;
  }

  function renderRoomServicePagePreview() {
    return `<section class="vp-room-service-preview" aria-label="Prévia do Room Service"><aside><div class="vp-rs-copy"><strong>Room Service</strong><span>Cardápio conectado à unidade</span></div><div class="vp-rs-field"></div><div class="vp-rs-field"></div><div class="vp-rs-field"></div><h2>Resumo do Pedido</h2><div class="vp-rs-empty">Seu carrinho está vazio</div><button type="button" tabindex="-1">Finalizar Pedido</button></aside><section><div class="vp-rs-search">Pesquisar pratos, bebidas ou descrições...</div><nav><span>Todos</span><span>Pratos</span><span>Bebidas</span></nav><h2>Cardápio da unidade</h2><div class="vp-rs-products">${["Prato em destaque", "Bebida", "Sobremesa", "Opção especial"].map((name) => `<article><small>ITEM</small><strong>${name}</strong><p>Informações atualizadas pelo ERP Room Service.</p><footer><b>R$ --,--</b><span>Adicionar</span></footer></article>`).join("")}</div></section></section>`;
  }

  function renderEditableBlock(block, index) {
    const selected = block.id === state.selectedId;
    const styles = resolvedBlockStyle(block);
    const style = editableStyle(styles);
    const hidden = (state.viewport === "desktop" && !block.visibility.desktop) || (state.viewport === "mobile" && !block.visibility.mobile);
    return `<section class="vp-canvas-block ${selected ? "is-selected" : ""} ${hidden ? "is-hidden-device" : ""}" data-canvas-block="${escapeAttr(block.id)}" draggable="true" style="${escapeAttr(style)}"><div class="vp-block-toolbar"><button type="button" data-position-block title="Arrastar livremente">${icon("move")}</button><button type="button" data-move-block="up" title="Mover para cima" ${index === 0 ? "disabled" : ""}>${icon("up")}</button><button type="button" data-move-block="down" title="Mover para baixo" ${index === pageBlocks().length - 1 ? "disabled" : ""}>${icon("down")}</button><button type="button" data-duplicate-block title="Duplicar bloco">${icon("copy")}</button><button type="button" data-delete-block title="Excluir bloco">${icon("trash")}</button></div>${renderBlockPreview(block)}</section>`;
  }

  function renderBlockPreview(block) {
    const content = block.content;
    if (block.type === "hero") {
      const media = mediaById(content.media_asset_id);
      const background = media ? `background-image:linear-gradient(rgba(0,0,0,${Number(content.overlay || 0) / 100}),rgba(0,0,0,${Number(content.overlay || 0) / 100})),url('${escapeCssUrl(media.public_url)}')` : "";
      return `<div class="vp-preview-hero ${media ? "has-media" : ""}" style="${escapeAttr(background)}"><div>${content.eyebrow ? `<p class="vp-eyebrow">${escapeHtml(content.eyebrow)}</p>` : ""}<h1>${escapeHtml(content.title || "Título da capa")}</h1>${previewParagraphs(content.text)}${previewActionButtons(content.buttons)}</div></div>`;
    }
    if (block.type === "heading") return `<div class="vp-preview-inner"><h2>${escapeHtml(content.title || "Título da seção")}</h2>${previewParagraphs(content.text)}</div>`;
    if (block.type === "text") return `<div class="vp-preview-inner vp-preview-text">${previewParagraphs(content.text || "Clique para editar este texto.")}</div>`;
    if (block.type === "button") return `<div class="vp-preview-inner">${previewButton(content.text || "Novo botão", content.url || "/", content.style)}</div>`;
    if (block.type === "image") return mediaPreview(content.media_asset_id, "image", content.alt_text || "Selecione uma imagem", content.fit);
    if (block.type === "video") return mediaPreview(content.media_asset_id, "video", content.title || "Selecione um vídeo");
    if (block.type === "embed") {
      const source = content.mode === "html"
        ? (content.html ? `srcdoc="${escapeAttr(content.html)}" sandbox="allow-forms allow-popups allow-presentation"` : "")
        : (content.url ? `src="${escapeAttr(content.url)}"` : "");
      return `<div class="vp-preview-inner vp-preview-embed" style="--vp-embed-ratio:${escapeAttr(embedRatio(content.aspect_ratio))}">${source ? `<iframe ${source} title="${escapeAttr(content.title || "Conteúdo incorporado")}" tabindex="-1"></iframe><span>${icon("embed")} Conteúdo incorporado</span>` : mediaPlaceholder(content.mode === "html" ? "Cole o HTML que deseja incorporar" : "Informe um endereço HTTPS para incorporar")}</div>`;
    }
    if (block.type === "gallery") return `<div class="vp-preview-inner">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}<div class="vp-preview-gallery">${content.media_asset_ids.map((id) => mediaById(id)).filter(Boolean).map((media) => `<img src="${escapeAttr(media.public_url)}" alt="">`).join("") || mediaPlaceholder("Galeria sem imagens")}</div></div>`;
    if (block.type === "feature-grid") return `<div class="vp-preview-inner vp-preview-grid ${content.layout === "overlay" ? "is-overlay" : ""}" style="--vp-card-copy-bg:${escapeAttr(content.text_background_color)};--vp-card-copy-text:${escapeAttr(content.text_color)};--vp-card-copy-blur:${Number(content.text_background_blur)}px">${content.items.map((item) => `<article>${mediaThumbnail(item.media_asset_id)}<div><h3>${escapeHtml(item.title || "Novo destaque")}</h3>${previewParagraphs(item.text)}${previewButton(item.button_text, item.button_url, "ghost")}</div></article>`).join("") || mediaPlaceholder("Adicione itens à grade")}</div>`;
    if (block.type === "faq") return `<div class="vp-preview-inner vp-preview-faq">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}${content.items.map((item) => `<details><summary>${escapeHtml(item.question || "Nova pergunta")}<span aria-hidden="true">+</span></summary>${previewParagraphs(item.answer)}</details>`).join("") || mediaPlaceholder("Adicione perguntas e respostas")}</div>`;
    if (block.type === "stats") return `<div class="vp-preview-inner">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}<div class="vp-preview-stats">${content.items.map((item) => `<article><strong>${escapeHtml(item.value || "0")}</strong><span>${escapeHtml(item.label || "Novo indicador")}</span></article>`).join("") || mediaPlaceholder("Adicione indicadores")}</div></div>`;
    if (block.type === "timeline") return `<div class="vp-preview-inner vp-preview-timeline">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}${content.items.map((item) => `<article><span></span><div>${item.period ? `<small>${escapeHtml(item.period)}</small>` : ""}<h3>${escapeHtml(item.title || "Nova etapa")}</h3>${previewParagraphs(item.text)}</div></article>`).join("") || mediaPlaceholder("Adicione etapas à linha do tempo")}</div>`;
    if (block.type === "testimonials") return `<div class="vp-preview-inner">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}<div class="vp-preview-testimonials">${content.items.map((item) => `<figure>${mediaThumbnail(item.media_asset_id)}<blockquote>${escapeHtml(item.quote || "Novo depoimento")}</blockquote><figcaption><strong>${escapeHtml(item.author || "Cliente")}</strong><span>${escapeHtml(item.role || "")}</span></figcaption></figure>`).join("")}</div></div>`;
    if (block.type === "icon-list") return `<div class="vp-preview-inner">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}<div class="vp-preview-icon-list">${content.items.map((item) => `<article>${previewPortalIcon(item.icon)}<div><h3>${escapeHtml(item.title || "Novo item")}</h3>${previewParagraphs(item.text)}</div></article>`).join("")}</div></div>`;
    if (block.type === "cta-banner") { const media = mediaById(content.media_asset_id); const background = media ? `background-image:linear-gradient(rgba(0,0,0,${Number(content.overlay || 0) / 100}),rgba(0,0,0,${Number(content.overlay || 0) / 100})),url('${escapeCssUrl(media.public_url)}')` : ""; return `<div class="vp-preview-inner vp-preview-cta ${media ? "has-media" : ""}" style="${escapeAttr(background)}"><div>${content.eyebrow ? `<p class="vp-eyebrow">${escapeHtml(content.eyebrow)}</p>` : ""}<h2>${escapeHtml(content.title || "Chamada em destaque")}</h2>${previewParagraphs(content.text)}${previewActionButtons(content.buttons)}</div></div>`; }
    if (block.type === "quote") return `<figure class="vp-preview-inner vp-preview-quote"><blockquote>${escapeHtml(content.quote || "Uma frase memorável para destacar.")}</blockquote>${content.author ? `<figcaption>${escapeHtml(content.author)}</figcaption>` : ""}</figure>`;
    if (block.type === "contact") return `<div class="vp-preview-inner vp-preview-contact"><h2>${escapeHtml(content.title || "Fale conosco")}</h2>${previewParagraphs(content.text)}<div>${[content.address, content.phone, content.email].filter(Boolean).map((value) => `<span>${escapeHtml(value)}</span>`).join("")}</div>${previewButton(content.button_text, content.button_url)}</div>`;
    if (block.type === "divider") return `<div class="vp-preview-inner vp-preview-divider"><span></span>${content.label ? `<em>${escapeHtml(content.label)}</em>` : ""}<span></span></div>`;
    return `<div class="vp-preview-spacer"><span>${Number(resolvedBlockStyle(block).min_height || 48)} px</span></div>`;
  }

  function renderEditorHeader() {
    const header = state.document.settings.header;
    if (!header.enabled) return "";
    const logo = mediaById(header.logo_media_asset_id);
    const pages = header.show_navigation ? state.document.pages.filter((page) => page.show_in_navigation) : [];
    const nav = pages.map((page) => `<button type="button" data-editor-page-link="${escapeAttr(page.id)}" class="${page.id === state.activePageId ? "is-current" : ""}">${escapeHtml(page.name)}</button>`).join("");
    const brand = header.show_logo ? `<div class="vp-editor-brand">${logo ? `<img src="${escapeAttr(logo.public_url)}" alt="">` : `<strong>${escapeHtml(state.portal.hotel_name)}</strong>`}</div>` : "";
    const mobileMenuToggle = pages.length ? `<button type="button" class="vp-editor-menu-toggle" data-editor-menu-toggle aria-expanded="${state.editorMobileMenuOpen}" title="Abrir páginas">${icon("menu")}</button>` : "";
    const mobileMenu = pages.length ? `<button type="button" class="vp-editor-menu-backdrop" data-editor-menu-close aria-label="Fechar menu" tabindex="-1"></button><aside class="vp-editor-mobile-menu ${header.mobile_menu_blur ? "has-blur" : ""}" aria-hidden="${!state.editorMobileMenuOpen}" style="--vp-mobile-menu-bg:${escapeAttr(header.mobile_menu_background_color)};--vp-mobile-menu-text:${escapeAttr(header.mobile_menu_text_color)}"><header><strong>Páginas</strong><button type="button" data-editor-menu-close title="Fechar">${icon("close")}</button></header><nav>${nav}</nav>${header.cta_text ? `<span class="vp-editor-header-cta">${escapeHtml(header.cta_text)}</span>` : ""}</aside>` : "";
    return `<div class="${editorHeaderClasses(header)} navigation-${escapeAttr(header.desktop_navigation_alignment || "center")}" style="--vp-header-bg:${escapeAttr(header.background_color)};--vp-header-text:${escapeAttr(header.text_color)};--vp-header-accent:${escapeAttr(header.accent_color)}">${brand}<nav class="vp-editor-desktop-nav">${nav}</nav>${header.cta_text ? `<span class="vp-editor-header-cta">${escapeHtml(header.cta_text)}</span>` : ""}${mobileMenuToggle}</div>${mobileMenu}`;
  }

  function renderInspector() {
    const block = selectedBlock();
    els.inspectorTitle.textContent = block ? BLOCK_LABELS[block.type] : "Página";
    els.inspectorSubtitle.textContent = block ? "Conteúdo e aparência do bloco" : isRoomServicePage() ? "Endereço e navegação do Room Service" : "Identidade e espaçamento geral";
    if (!block) {
      els.inspectorBody.innerHTML = pageInspector();
      return;
    }
    els.inspectorBody.innerHTML = `${blockContentInspector(block)}${styleInspector(block)}${visibilityInspector(block)}<div class="vp-inspector-danger"><button type="button" data-duplicate-block>${icon("copy")} Duplicar bloco</button><button type="button" data-delete-block>${icon("trash")} Excluir bloco</button></div>`;
  }

  function pageInspector() {
    const site = state.document.settings;
    const page = activePage();
    const settings = page.settings;
    const slugPrefix = `/${state.portal.hotel_slug}/${state.portal.slug}/`;
    const systemNotice = isRoomServicePage(page) ? `<div class="vp-system-page-note">${icon("shopping-bag")}<div><strong>Conteúdo conectado ao ERP</strong><span>Este portal fornece o cabeçalho. Cardápio, horários, disponibilidade e quartos vêm da unidade selecionada.</span></div></div>` : "";
    return `${systemNotice}<fieldset><legend>Página atual</legend><label><span>Nome</span><input data-page-field="name" value="${escapeAttr(page.name)}"></label><label><span>Slug da página</span><div class="vp-slug-field"><span title="Endereço base">${escapeHtml(page.slug ? slugPrefix : `/${state.portal.hotel_slug}/${state.portal.slug}`)}</span><input data-page-field="slug" value="${escapeAttr(page.slug)}" ${page.slug ? "" : "disabled"} aria-describedby="vp-page-slug-help"></div><small class="vp-field-help" id="vp-page-slug-help">${page.slug ? "Use letras, números e hífens. O endereço é atualizado ao sair do campo." : "A página inicial usa o endereço principal do site."}</small></label>${pageToggleField("Exibir no menu", "show_in_navigation", page.show_in_navigation)}</fieldset><fieldset><legend>Identidade do site</legend>${colorField("Cor principal", "primary_color", site.primary_color, "doc")}${colorField("Texto padrão", "text_color", site.text_color, "doc")}${colorField("Superfície padrão", "surface_color", site.surface_color, "doc")}<label><span>Tipografia</span><input data-doc-field="font_family" value="${escapeAttr(site.font_family)}"></label>${siteMediaField("Ícone da guia", "favicon_media_asset_id", site.favicon_media_asset_id, "image", "document")}</fieldset><fieldset><legend>Cabeçalho</legend>${headerToggleField("Exibir cabeçalho", "enabled", site.header.enabled)}${headerToggleField("Exibir logotipo", "show_logo", site.header.show_logo)}${headerToggleField("Exibir páginas no menu", "show_navigation", site.header.show_navigation)}${headerToggleField("Fundo transparente", "transparent", site.header.transparent)}${headerToggleField("Desfoque do cabeçalho", "blur", site.header.blur)}${siteMediaField("Logotipo do cabeçalho", "logo_media_asset_id", site.header.logo_media_asset_id, "image", "header")}<label><span>Estilo</span><select data-header-field="style">${options([["standard", "Padrão"], ["floating", "Flutuante"], ["centered", "Centralizado"], ["minimal", "Minimalista"]], site.header.style)}</select></label><label><span>Posição</span><select data-header-field="position">${options([["sticky", "Fixo ao rolar"], ["static", "No fluxo da página"]], site.header.position)}</select></label><label><span>Alinhamento no desktop</span><select data-header-field="desktop_navigation_alignment">${options([["left", "À esquerda"], ["center", "Centralizado"], ["right", "À direita"]], site.header.desktop_navigation_alignment)}</select></label>${headerColorField("Fundo", "background_color", site.header.background_color)}${headerColorField("Texto", "text_color", site.header.text_color)}${headerColorField("Destaque", "accent_color", site.header.accent_color)}<div class="vp-subsection"><strong>Menu móvel</strong>${headerToggleField("Desfoque do menu lateral", "mobile_menu_blur", site.header.mobile_menu_blur)}${headerColorField("Fundo do menu", "mobile_menu_background_color", site.header.mobile_menu_background_color)}${headerColorField("Texto do menu", "mobile_menu_text_color", site.header.mobile_menu_text_color)}</div>${textFieldForScope("Ação do cabeçalho", "cta_text", site.header.cta_text, "header")}${linkField("Destino da ação", "cta_url", site.header.cta_url, "header")}</fieldset><fieldset><legend>Fundo desta página</legend>${pageMediaField(settings.background_media_asset_id)}${pageColorField("Fundo", "background_color", settings.background_color)}${pageColorField("Texto", "text_color", settings.text_color)}${pageColorField("Superfície", "surface_color", settings.surface_color)}${pageRangeField("Escurecimento", "background_overlay", settings.background_overlay, 0, 90)}<label><span>Posição</span><select data-page-setting-field="background_position">${options([["center", "Centro"], ["top", "Topo"], ["bottom", "Rodapé"], ["left", "Esquerda"], ["right", "Direita"]], settings.background_position)}</select></label><label><span>Ajuste</span><select data-page-setting-field="background_fit">${options([["cover", "Preencher"], ["contain", "Conter"]], settings.background_fit)}</select></label>${pageSettingToggleField("Fixar durante a rolagem", "background_fixed", settings.background_fixed)}${settings.background_media_asset_id ? `<button type="button" class="vp-secondary-action" data-clear-page-media>${icon("trash")} Remover mídia de fundo</button>` : ""}</fieldset><fieldset><legend>Layout da página</legend><label><span>Largura do conteúdo</span><select data-page-setting-field="content_width">${options([["narrow", "Estreita"], ["content", "Padrão"], ["wide", "Ampla"], ["full", "Tela inteira"]], settings.content_width)}</select></label>${pageRangeField("Margem lateral", "page_padding", settings.page_padding, 0, 80)}${pageRangeField("Espaço entre blocos", "block_gap", settings.block_gap, 0, 80)}</fieldset><fieldset><legend>Salvamento automático</legend>${editorToggleField("Salvar automaticamente", "autosave_enabled", site.editor.autosave_enabled)}${editorRangeField("Intervalo em segundos", "autosave_interval_seconds", site.editor.autosave_interval_seconds, 15, 120)}</fieldset>`;
  }

  function blockContentInspector(block) {
    const content = block.content;
    const fields = [];
    if (block.type === "hero") fields.push(textField("Chamada", "eyebrow", content.eyebrow), textField("Título", "title", content.title), textareaField("Texto", "text", content.text), mediaField("Imagem de fundo", "media_asset_id", content.media_asset_id, "image"), rangeField("Escurecimento", "overlay", content.overlay, 0, 90, "content"), actionButtonsInspector(content.buttons));
    if (block.type === "heading") fields.push(textField("Título", "title", content.title), textareaField("Texto", "text", content.text));
    if (block.type === "text") fields.push(textareaField("Conteúdo", "text", content.text, 10));
    if (block.type === "button") fields.push(textField("Texto", "text", content.text), linkField("Destino", "url", content.url), `<label><span>Estilo</span><select data-content-field="style">${options([["solid", "Preenchido"], ["outline", "Contorno"], ["ghost", "Somente texto"]], content.style)}</select></label>`);
    if (block.type === "image") fields.push(mediaField("Imagem", "media_asset_id", content.media_asset_id, "image"), textField("Texto alternativo", "alt_text", content.alt_text), textField("Legenda", "caption", content.caption), `<label><span>Ajuste</span><select data-content-field="fit">${options([["cover", "Preencher"], ["contain", "Conter"]], content.fit)}</select></label>`);
    if (block.type === "video") fields.push(mediaField("Vídeo", "media_asset_id", content.media_asset_id, "video"), mediaField("Imagem de capa", "poster_media_asset_id", content.poster_media_asset_id, "image"), textField("Título", "title", content.title), toggleField("Exibir controles", "controls", content.controls), toggleField("Reprodução automática", "autoplay", content.autoplay), toggleField("Sem som", "muted", content.muted), toggleField("Repetir", "loop", content.loop));
    if (block.type === "embed") fields.push(textField("Título acessível", "title", content.title), `<label><span>Tipo de incorporação</span><select data-content-field="mode">${options([["url", "Endereço HTTPS"], ["html", "Código HTML"]], content.mode)}</select></label>`, content.mode === "html" ? textareaField("HTML sanitizado", "html", content.html, 12) : textField("Endereço HTTPS", "url", content.url), `<label><span>Proporção</span><select data-content-field="aspect_ratio">${options([["16:9", "Paisagem 16:9"], ["4:3", "Clássica 4:3"], ["1:1", "Quadrada"], ["9:16", "Vertical 9:16"]], content.aspect_ratio)}</select></label>`, toggleField("Permitir tela cheia", "allow_fullscreen", content.allow_fullscreen));
    if (block.type === "gallery") fields.push(textField("Título", "title", content.title), `<div class="vp-gallery-inspector">${content.media_asset_ids.map((id) => { const media = mediaById(id); return `<button type="button" data-remove-gallery-media="${escapeAttr(id)}" title="Remover">${media ? `<img src="${escapeAttr(media.public_url)}" alt="">` : icon("image")}<span>${icon("close")}</span></button>`; }).join("")}<button type="button" class="vp-add-gallery" data-choose-media="media_asset_ids" data-media-kind="image">${icon("plus")}<span>Adicionar</span></button></div>`);
    if (block.type === "feature-grid") fields.push(`<label><span>Posição do texto</span><select data-content-field="layout">${options([["stacked", "Abaixo da imagem"], ["overlay", "Dentro da imagem"]], content.layout)}</select></label>`, colorField("Fundo do texto", "text_background_color", content.text_background_color, "content"), colorField("Cor do texto", "text_color", content.text_color, "content"), rangeField("Desfoque do fundo (px)", "text_background_blur", content.text_background_blur, 0, 30, "content"), featureItemsInspector(content.items));
    if (block.type === "faq") fields.push(textField("Título", "title", content.title), faqItemsInspector(content.items));
    if (block.type === "stats") fields.push(textField("Título", "title", content.title), statItemsInspector(content.items));
    if (block.type === "timeline") fields.push(textField("Título", "title", content.title), timelineItemsInspector(content.items));
    if (block.type === "testimonials") fields.push(textField("Título", "title", content.title), testimonialItemsInspector(content.items));
    if (block.type === "icon-list") fields.push(textField("Título", "title", content.title), iconListItemsInspector(content.items));
    if (block.type === "cta-banner") fields.push(textField("Chamada", "eyebrow", content.eyebrow), textField("Título", "title", content.title), textareaField("Texto", "text", content.text), mediaField("Imagem de fundo", "media_asset_id", content.media_asset_id, "image"), rangeField("Escurecimento", "overlay", content.overlay, 0, 90, "content"), actionButtonsInspector(content.buttons));
    if (block.type === "quote") fields.push(textareaField("Citação", "quote", content.quote, 6), textField("Autoria", "author", content.author));
    if (block.type === "contact") fields.push(textField("Título", "title", content.title), textareaField("Texto", "text", content.text), textField("Endereço", "address", content.address), textField("Telefone", "phone", content.phone), textField("E-mail", "email", content.email), textField("Texto do botão", "button_text", content.button_text), linkField("Destino do botão", "button_url", content.button_url));
    if (block.type === "divider") fields.push(textField("Legenda opcional", "label", content.label));
    return fields.length ? `<fieldset><legend>Conteúdo</legend>${fields.join("")}</fieldset>` : "";
  }

  function linkField(label, field, value, scope = "content") {
    const kind = linkKind(value);
    const scopeAttr = scope === "header" ? "data-header-link" : "data-link-kind";
    const pageTarget = String(value || "").startsWith("page:") ? String(value).slice(5) : state.document.pages[0]?.id || "inicio";
    const pageAttr = scope === "header" ? "data-header-link-page" : "data-link-page";
    const valueAttr = scope === "header" ? "data-header-link-value" : "data-link-value";
    const targetControl = kind === "page"
      ? `<select ${pageAttr}="${escapeAttr(field)}">${state.document.pages.map((page) => `<option value="${escapeAttr(page.id)}" ${page.id === pageTarget ? "selected" : ""}>${escapeHtml(page.name)}</option>`).join("")}</select>`
      : kind === "room-service"
        ? '<small class="vp-field-help">O endereço será montado automaticamente para a unidade deste site.</small>'
        : `<input ${valueAttr}="${escapeAttr(field)}" value="${escapeAttr(value || linkDefault(kind))}" placeholder="${escapeAttr(linkPlaceholder(kind))}">`;
    return `<div class="vp-link-field"><span>${escapeHtml(label)}</span><select ${scopeAttr}="${escapeAttr(field)}">${options([["page", "Página deste site"], ["room-service", "Room Service da unidade"], ["external", "Endereço externo"], ["anchor", "Seção da página"], ["email", "E-mail"], ["phone", "Telefone"]], kind)}</select>${targetControl}</div>`;
  }

  function linkKind(value) {
    const normalized = String(value || "");
    if (normalized.startsWith("page:")) return "page";
    if (normalized === "module:room-service") return "room-service";
    if (normalized.startsWith("#")) return "anchor";
    if (normalized.startsWith("mailto:")) return "email";
    if (normalized.startsWith("tel:")) return "phone";
    return "external";
  }

  function linkDefault(kind) {
    return ({ external: "https://", anchor: "#conteudo", email: "mailto:", phone: "tel:" })[kind] || "";
  }

  function linkPlaceholder(kind) {
    return ({ external: "https://exemplo.com", anchor: "#secao", email: "mailto:contato@exemplo.com", phone: "tel:+5500000000000" })[kind] || "";
  }

  function featureItemsInspector(items) {
    return `<div class="vp-feature-items">${items.map((item, index) => `<details ${index === 0 ? "open" : ""}><summary><span>${index + 1}</span><strong>${escapeHtml(item.title || "Novo destaque")}</strong><button type="button" data-remove-feature="${index}" title="Remover">${icon("trash")}</button></summary><div>${textField("Título", `items.${index}.title`, item.title)}${textareaField("Texto", `items.${index}.text`, item.text, 4)}${mediaField("Imagem", `items.${index}.media_asset_id`, item.media_asset_id, "image")}${textField("Texto do botão", `items.${index}.button_text`, item.button_text)}${linkField("Destino", `items.${index}.button_url`, item.button_url)}</div></details>`).join("")}<button type="button" class="vp-secondary-action" data-add-feature>${icon("plus")} Adicionar destaque</button></div>`;
  }

  function faqItemsInspector(items) {
    return collectionInspector(items, "faq", "pergunta", (item, index) => `${textField("Pergunta", `items.${index}.question`, item.question)}${textareaField("Resposta", `items.${index}.answer`, item.answer, 5)}`);
  }

  function statItemsInspector(items) {
    return collectionInspector(items, "stats", "indicador", (item, index) => `${textField("Valor", `items.${index}.value`, item.value)}${textField("Legenda", `items.${index}.label`, item.label)}`);
  }

  function timelineItemsInspector(items) {
    return collectionInspector(items, "timeline", "etapa", (item, index) => `${textField("Período", `items.${index}.period`, item.period)}${textField("Título", `items.${index}.title`, item.title)}${textareaField("Texto", `items.${index}.text`, item.text, 4)}`);
  }

  function testimonialItemsInspector(items) {
    return collectionInspector(items, "testimonials", "depoimento", (item, index) => `${textareaField("Depoimento", `items.${index}.quote`, item.quote, 5)}${textField("Nome", `items.${index}.author`, item.author)}${textField("Identificação", `items.${index}.role`, item.role)}${mediaField("Foto", `items.${index}.media_asset_id`, item.media_asset_id, "image")}`);
  }

  function iconListItemsInspector(items) {
    return collectionInspector(items, "icon-list", "item", (item, index) => `${iconSelectField("Ícone", `items.${index}.icon`, item.icon)}${textField("Título", `items.${index}.title`, item.title)}${textareaField("Texto", `items.${index}.text`, item.text, 4)}${linkField("Destino opcional", `items.${index}.url`, item.url)}`);
  }

  function actionButtonsInspector(buttons = []) {
    return `<div class="vp-action-items"><header><strong>Botões</strong><span>${buttons.length} de 4</span></header>${buttons.map((button, index) => `<article><header><span>${index + 1}</span><strong>${escapeHtml(button.text || "Novo botão")}</strong><button type="button" data-remove-action-button="${index}" title="Remover botão">${icon("trash")}</button></header><div>${textField("Texto", `buttons.${index}.text`, button.text)}${linkField("Destino", `buttons.${index}.url`, button.url)}${iconSelectField("Ícone", `buttons.${index}.icon`, button.icon)}${mediaField("Imagem no botão", `buttons.${index}.media_asset_id`, button.media_asset_id, "image")}<label><span>Estilo</span><select data-content-field="buttons.${index}.style">${options([["solid", "Preenchido"], ["outline", "Contorno"], ["ghost", "Somente texto"]], button.style)}</select></label></div></article>`).join("")}<button type="button" class="vp-secondary-action" data-add-action-button ${buttons.length >= 4 ? "disabled" : ""}>${icon("plus")} Adicionar botão</button></div>`;
  }

  function collectionInspector(items, kind, itemLabel, fields) {
    return `<div class="vp-collection-items">${items.map((item, index) => `<article><header><span>${index + 1}</span><strong>${escapeHtml(item.question || item.title || item.label || item.author || item.quote || `Novo ${itemLabel}`)}</strong><button type="button" data-remove-collection="${index}" title="Remover ${escapeAttr(itemLabel)}">${icon("trash")}</button></header><div>${fields(item, index)}</div></article>`).join("")}<button type="button" class="vp-secondary-action" data-add-collection="${escapeAttr(kind)}">${icon("plus")} Adicionar ${escapeHtml(itemLabel)}</button></div>`;
  }

  function styleInspector(block) {
    const style = block.styles[state.styleTarget] || {};
    const hasHeading = ["hero", "heading", "feature-grid", "faq", "stats", "timeline", "testimonials", "icon-list", "cta-banner", "quote", "contact", "gallery", "video"].includes(block.type);
    const hasText = ["hero", "heading", "text", "feature-grid", "faq", "timeline", "icon-list", "cta-banner", "contact"].includes(block.type);
    return `<fieldset><legend>Aparência</legend><div class="vp-style-target" role="tablist"><button type="button" data-style-target="base" aria-selected="${state.styleTarget === "base"}">Global</button><button type="button" data-style-target="desktop" aria-selected="${state.styleTarget === "desktop"}">Desktop</button><button type="button" data-style-target="mobile" aria-selected="${state.styleTarget === "mobile"}">Mobile</button></div><label><span>Alinhamento</span><select data-style-field="alignment"><option value="">Herdar</option>${options([["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]], style.alignment)}</select></label><label><span>Largura</span><select data-style-field="width"><option value="">Herdar</option>${options([["narrow", "Estreita"], ["content", "Padrão"], ["wide", "Ampla"], ["full", "Tela inteira"]], style.width)}</select></label>${hasHeading ? rangeField("Tamanho dos títulos", "heading_size", style.heading_size ?? "", 18, 160, "style", true) : ""}${hasText ? rangeField("Tamanho do texto", "text_size", style.text_size ?? "", 12, 40, "style", true) : ""}${colorField("Fundo", "background_color", style.background_color, "style", true)}${colorField("Texto", "text_color", style.text_color, "style", true)}${colorField("Destaque", "accent_color", style.accent_color, "style", true)}${rangeField("Espaço acima", "padding_top", style.padding_top ?? "", 0, 200, "style", true)}${rangeField("Espaço abaixo", "padding_bottom", style.padding_bottom ?? "", 0, 200, "style", true)}${rangeField("Margem lateral", "padding_inline", style.padding_inline ?? "", 0, 120, "style", true)}${rangeField("Altura mínima", "min_height", style.min_height ?? "", 0, 1200, "style", true)}${rangeField("Cantos", "border_radius", style.border_radius ?? "", 0, 48, "style", true)}${["gallery", "feature-grid", "stats", "testimonials", "icon-list"].includes(block.type) ? rangeField("Colunas", "columns", style.columns ?? "", 1, 4, "style", true) : ""}</fieldset><fieldset><legend>Posição livre</legend><p class="vp-field-help">Ajuste a posição neste dispositivo sem alterar a ordem da página.</p>${positionRangeField("Horizontal", "offset_x", style.offset_x)}${positionRangeField("Vertical", "offset_y", style.offset_y)}<button type="button" class="vp-secondary-action" data-reset-position>${icon("target")} Centralizar bloco</button></fieldset>`;
  }

  function visibilityInspector(block) {
    return `<fieldset><legend>Visibilidade</legend>${toggleField("Exibir no desktop", "desktop", block.visibility.desktop, "visibility")}${toggleField("Exibir no mobile", "mobile", block.visibility.mobile, "visibility")}</fieldset>`;
  }

  function handleClick(event) {
    if (event.target.closest("[data-action-dialog-close]")) { els.actionDialog.close(); return; }
    const closeButton = event.target.closest("[data-builder-close]");
    if (closeButton) return close();
    const leftTab = event.target.closest("[data-builder-tab]");
    if (leftTab) { state.leftTab = leftTab.dataset.builderTab; renderLeftPanel(); return; }
    const viewport = event.target.closest("button[data-viewport]");
    if (viewport) {
      state.viewport = viewport.dataset.viewport;
      state.styleTarget = state.viewport;
      state.editorMobileMenuOpen = false;
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
    const editorPageLink = event.target.closest("[data-editor-page-link]");
    if (editorPageLink) return switchPage(editorPageLink.dataset.editorPageLink);
    if (event.target.closest("[data-editor-menu-toggle]")) {
      state.editorMobileMenuOpen = !state.editorMobileMenuOpen;
      renderCanvas();
      return;
    }
    if (event.target.closest("[data-editor-menu-close]")) {
      state.editorMobileMenuOpen = false;
      renderCanvas();
      return;
    }
    const toggle = event.target.closest("[data-toggle-scope]");
    if (toggle) return toggleSetting(toggle);
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
    const mediaFolder = event.target.closest("[data-media-folder]");
    if (mediaFolder) return openMediaFolder(mediaFolder.dataset.mediaFolder);
    const mediaBreadcrumb = event.target.closest("[data-media-breadcrumb]");
    if (mediaBreadcrumb) return openMediaFolder(mediaBreadcrumb.dataset.mediaBreadcrumb);
    if (event.target.closest("[data-media-picker-close]")) return closeMediaPicker();
    if (event.target.closest("[data-preview-close]")) { els.previewDialog.close(); return; }
    const previewViewport = event.target.closest("[data-preview-viewport]");
    if (previewViewport) return setPreviewViewport(previewViewport.dataset.previewViewport);
    if (event.target.closest("[data-preview-version-restore]")) return restoreVersionDocument(state.previewVersionId);
    const selectPage = event.target.closest("[data-select-page]");
    if (selectPage) return switchPage(selectPage.dataset.selectPage);
    if (event.target.closest("[data-add-page]")) return addPage();
    if (event.target.closest("[data-add-room-service-page]")) return addRoomServicePage();
    const duplicatePageButton = event.target.closest("[data-duplicate-page]");
    if (duplicatePageButton) return duplicatePage(duplicatePageButton.dataset.duplicatePage);
    const deletePageButton = event.target.closest("[data-delete-page]");
    if (deletePageButton) return deletePage(deletePageButton.dataset.deletePage);
    if (event.target.closest("[data-clear-page-media]")) {
      activePage().settings.background_media_asset_id = "";
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
    const addCollectionButton = event.target.closest("[data-add-collection]");
    if (addCollectionButton) return addCollectionItem(addCollectionButton.dataset.addCollection);
    const removeCollectionButton = event.target.closest("[data-remove-collection]");
    if (removeCollectionButton) return removeCollectionItem(Number(removeCollectionButton.dataset.removeCollection));
    if (event.target.closest("[data-add-action-button]")) return addActionButton();
    const removeActionButton = event.target.closest("[data-remove-action-button]");
    if (removeActionButton) return removeActionButtonAt(Number(removeActionButton.dataset.removeActionButton));
    if (event.target.closest("[data-save-template]")) return saveTemplate();
    const applyTemplate = event.target.closest("[data-apply-template]");
    if (applyTemplate) return applyTemplateDocument(applyTemplate.dataset.applyTemplate);
    const archiveTemplate = event.target.closest("[data-archive-template]");
    if (archiveTemplate) return archiveTemplateDocument(archiveTemplate.dataset.archiveTemplate);
    const restoreVersion = event.target.closest("[data-restore-version]");
    if (restoreVersion) return restoreVersionDocument(restoreVersion.dataset.restoreVersion);
    const previewVersion = event.target.closest("[data-preview-version]");
    if (previewVersion) return previewSavedVersion(previewVersion.dataset.previewVersion);
    if (event.target.closest("[data-page-settings]")) { state.selectedId = null; renderCanvas(); renderInspector(); }
  }

  function handleInput(event) {
    if (event.target.matches("[data-block-search]")) {
      const query = event.target.value.toLowerCase();
      els.leftContent.querySelectorAll("[data-add-block]").forEach((button) => { button.hidden = !button.textContent.toLowerCase().includes(query); });
      return;
    }
    if (event.target.matches("[data-media-hotel]")) {
      state.mediaBrowseHotelId = event.target.value;
      state.mediaFolderId = "";
      state.mediaSearch = "";
      els.mediaSearch.value = "";
      loadMediaBrowser();
      return;
    }
    if (event.target.matches("[data-media-upload]")) {
      const [file] = event.target.files || [];
      if (file) uploadMediaFromPicker(file);
      return;
    }
    if (event.type === "input" && event.target.matches("select")) return;
    if (event.target.matches("[data-color-control]")) return handleColorControl(event.target);
    if (event.target === els.zoom) {
      state.zoom = Number(els.zoom.value);
      state.zoomManuallySet = true;
      renderCanvas();
      els.zoomLabel.textContent = `${state.zoom}%`;
      return;
    }
    if (!state.document) return;
    const block = selectedBlock();
    const headerLinkKind = event.target.dataset.headerLink;
    if (headerLinkKind) {
      const firstPage = state.document.pages[0]?.id || "inicio";
      const nextValue = event.target.value === "page" ? `page:${firstPage}` : event.target.value === "room-service" ? "module:room-service" : event.target.value === "anchor" ? "#conteudo" : event.target.value === "email" ? "mailto:" : event.target.value === "phone" ? "tel:" : "https://";
      setPath(state.document.settings.header, headerLinkKind, nextValue);
      checkpoint(); renderCanvas(); renderInspector(); renderSaveState(); scheduleAutosave(); return;
    }
    if (event.target.dataset.headerLinkPage) {
      setPath(state.document.settings.header, event.target.dataset.headerLinkPage, `page:${event.target.value}`);
      checkpoint(); renderCanvas(); renderSaveState(); scheduleAutosave(); return;
    }
    if (event.target.dataset.headerLinkValue) {
      setPath(state.document.settings.header, event.target.dataset.headerLinkValue, event.target.value);
      checkpoint(); renderCanvas(); renderSaveState(); scheduleAutosave(); return;
    }
    const linkKind = event.target.dataset.linkKind;
    if (block && linkKind) {
      const firstPage = state.document.pages[0]?.id || "inicio";
      const nextValue = event.target.value === "page" ? `page:${firstPage}` : event.target.value === "room-service" ? "module:room-service" : event.target.value === "anchor" ? "#conteudo" : event.target.value === "email" ? "mailto:" : event.target.value === "phone" ? "tel:" : "https://";
      setPath(block.content, linkKind, nextValue);
      checkpoint();
      renderCanvas();
      renderInspector();
      renderSaveState();
      scheduleAutosave();
      return;
    }
    if (block && event.target.dataset.linkPage) {
      setPath(block.content, event.target.dataset.linkPage, `page:${event.target.value}`);
      checkpoint(); renderCanvas(); renderSaveState(); scheduleAutosave(); return;
    }
    if (block && event.target.dataset.linkValue) {
      setPath(block.content, event.target.dataset.linkValue, event.target.value);
      checkpoint(); renderCanvas(); renderSaveState(); scheduleAutosave(); return;
    }
    if (event.target.type === "range") {
      const output = event.target.closest("label")?.querySelector("output");
      if (output) output.textContent = event.target.dataset.styleField?.startsWith("offset_") ? `${event.target.value}px` : event.target.value;
    }
    if (event.target.dataset.docField) setPath(state.document.settings, event.target.dataset.docField, inputValue(event.target));
    if (event.target.dataset.pageField) {
      const field = event.target.dataset.pageField;
      const value = field === "slug" && event.type === "change" ? normalizedPageSlug(event.target.value, activePage().id) : inputValue(event.target);
      setPath(activePage(), field, value);
      if (field === "slug" && event.type === "change") {
        event.target.value = value;
        renderPortalPath();
        renderLeftPanel();
      }
    }
    if (event.target.dataset.pageSettingField) setPath(activePage().settings, event.target.dataset.pageSettingField, inputValue(event.target));
    if (event.target.dataset.headerField) setPath(state.document.settings.header, event.target.dataset.headerField, inputValue(event.target));
    if (event.target.dataset.editorField) setPath(state.document.settings.editor, event.target.dataset.editorField, inputValue(event.target));
    if (block && event.target.dataset.contentField) setPath(block.content, event.target.dataset.contentField, inputValue(event.target));
    if (block && event.target.dataset.styleField) setPath(block.styles[state.styleTarget], event.target.dataset.styleField, emptyAsUndefined(event.target));
    if (block && event.target.dataset.visibilityField) setPath(block.visibility, event.target.dataset.visibilityField, event.target.checked);
    if (event.target.matches("[data-doc-field],[data-page-field],[data-page-setting-field],[data-header-field],[data-editor-field],[data-content-field],[data-style-field],[data-visibility-field]")) {
      checkpoint();
      renderCanvas();
      if (event.type === "change" && event.target.dataset.contentField === "mode") requestAnimationFrame(renderInspector);
      renderSaveState();
      scheduleAutosave();
    }
  }

  function handleSubmit(event) {
    if (!event.target.matches("[data-media-search-form]")) return;
    event.preventDefault();
    state.mediaSearch = els.mediaSearch.value.trim();
    loadMediaBrowser();
  }

  function toggleSetting(control) {
    const scope = control.dataset.toggleScope;
    const field = control.dataset.toggleField;
    const targets = {
      document: state.document.settings,
      page: activePage(),
      pageSettings: activePage()?.settings,
      header: state.document.settings.header,
      editor: state.document.settings.editor,
      content: selectedBlock()?.content,
      visibility: selectedBlock()?.visibility,
    };
    const target = targets[scope];
    if (!target || !field) return;
    setPath(target, field, !Boolean(getPath(target, field)));
    checkpoint();
    if (scope === "page") renderLeftPanel();
    renderCanvas();
    renderInspector();
    renderSaveState();
    scheduleAutosave();
  }

  function handleColorControl(control) {
    const scope = control.dataset.colorScope;
    const field = control.dataset.colorField;
    const wrapper = control.closest(".vp-color-field");
    const textInput = wrapper?.querySelector('[data-color-role="text"]');
    const picker = wrapper?.querySelector('[data-color-role="picker"]');
    const alpha = wrapper?.querySelector('[data-color-role="alpha"]');
    let parsed;
    if (control.dataset.colorRole === "text") {
      if (!control.value.trim() && control.dataset.colorOptional === "true") {
        const targets = { style: selectedBlock()?.styles?.[state.styleTarget] };
        if (targets[scope]) setPath(targets[scope], field, undefined);
        checkpoint(); renderCanvas(); renderSaveState(); scheduleAutosave();
        return;
      }
      parsed = parseEditorColor(control.value);
      if (!parsed) return;
      picker.value = parsed.rgb;
      alpha.value = String(100 - parsed.alpha);
    } else {
      parsed = { rgb: picker.value.toLowerCase(), alpha: 100 - Number(alpha.value) };
      textInput.value = colorWithAlpha(parsed.rgb, parsed.alpha);
    }
    const value = colorWithAlpha(parsed.rgb, parsed.alpha);
    const targets = {
      doc: state.document.settings,
      page: activePage()?.settings,
      header: state.document.settings.header,
      content: selectedBlock()?.content,
      style: selectedBlock()?.styles?.[state.styleTarget],
    };
    if (!targets[scope]) return;
    setPath(targets[scope], field, value);
    const output = wrapper?.querySelector("output");
    if (output) output.textContent = `${100 - parsed.alpha}%`;
    checkpoint();
    renderCanvas();
    renderSaveState();
    scheduleAutosave();
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
    const blocks = pageBlocks();
    const targetIndex = targetId ? blocks.findIndex((block) => block.id === targetId) : blocks.length;
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
    const rawX = clamp(Math.round(drag.offsetX + (event.clientX - drag.startX) / scale), -320, 320);
    const rawY = clamp(Math.round(drag.offsetY + (event.clientY - drag.startY) / scale), -320, 320);
    drag.style.offset_x = Math.abs(rawX) <= 8 ? 0 : rawX;
    drag.style.offset_y = Math.abs(rawY) <= 8 ? 0 : rawY;
    setAlignmentGuide("x", drag.style.offset_x === 0);
    const style = resolvedBlockStyle(selectedBlock());
    drag.element.style.transform = `translate(${Number(style.offset_x || 0)}px,${Number(style.offset_y || 0)}px)`;
  }

  function handlePositionPointerUp(event) {
    const drag = state.positionDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.element.classList.remove("is-positioning");
    setAlignmentGuide("x", false);
    state.positionDrag = null;
    checkpoint();
    renderAll();
    announce("Posição do bloco atualizada.");
  }

  function setAlignmentGuide(axis, visible) {
    els.canvas.querySelector(`[data-alignment-guide="${axis}"]`)?.classList.toggle("is-visible", visible);
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

  function addBlock(type, index = pageBlocks().length) {
    if (isRoomServicePage()) return announce("A página de Room Service é atualizada pelo ERP e não aceita blocos.", true);
    if (!BLOCK_LABELS[type]) return;
    const block = createBlock(type);
    pageBlocks().splice(Math.max(0, index), 0, block);
    state.selectedId = block.id;
    checkpoint();
    renderAll();
  }

  function deleteSelected(blockId = state.selectedId) {
    const result = deleteVisualBlock(activePage(), blockId);
    if (!result.changed) return;
    state.selectedId = result.selectedId;
    checkpoint();
    renderAll();
    announce(`${BLOCK_LABELS[result.removed.type]} removido.`);
  }

  function duplicateSelected(blockId = state.selectedId) {
    const source = pageBlocks().find((block) => block.id === blockId);
    if (!source) return;
    const result = duplicateVisualBlock(activePage(), blockId, uniqueBlockId(source.type));
    if (!result.changed) return;
    state.selectedId = result.selectedId;
    checkpoint();
    renderAll();
    announce("Bloco duplicado.");
  }

  function moveSelected(delta, blockId = state.selectedId) {
    const result = moveVisualBlock(activePage(), blockId, delta);
    if (!result.changed) return;
    state.selectedId = result.selectedId;
    checkpoint();
    renderAll();
    announce(delta < 0 ? "Bloco movido para cima." : "Bloco movido para baixo.");
  }

  function reorderBlock(blockId, targetIndex) {
    const result = reorderVisualBlock(activePage(), blockId, targetIndex);
    clearDragState();
    if (!result.changed) return;
    state.selectedId = result.selectedId;
    checkpoint();
    renderAll();
  }

  function pasteBlock() {
    if (!state.clipboardBlock) return;
    if (isRoomServicePage()) return announce("A página de Room Service é atualizada pelo ERP e não aceita blocos.", true);
    const block = clone(state.clipboardBlock);
    block.id = uniqueBlockId(block.type);
    const index = selectedIndex();
    pageBlocks().splice(index < 0 ? pageBlocks().length : index + 1, 0, block);
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

  function addCollectionItem(kind) {
    const block = selectedBlock();
    if (!block || block.type !== kind) return;
    const definitions = {
      faq: { limit: 16, item: { question: "Nova pergunta", answer: "Escreva uma resposta clara e objetiva." } },
      stats: { limit: 8, item: { value: "100%", label: "Novo indicador" } },
      timeline: { limit: 16, item: { period: "Etapa", title: "Novo momento", text: "Descreva o que acontece nesta etapa." } },
      testimonials: { limit: 12, item: { quote: "Conte como foi esta experiência.", author: "Cliente", role: "", media_asset_id: "" } },
      "icon-list": { limit: 16, item: { icon: "sparkles", title: "Novo benefício", text: "Descreva este item.", url: "" } },
    };
    const definition = definitions[kind];
    if (!definition || block.content.items.length >= definition.limit) return;
    block.content.items.push(clone(definition.item));
    checkpoint();
    renderAll();
  }

  function removeCollectionItem(index) {
    const block = selectedBlock();
    if (!block || !["faq", "stats", "timeline", "testimonials", "icon-list"].includes(block.type)) return;
    block.content.items.splice(index, 1);
    checkpoint();
    renderAll();
  }

  function addActionButton() {
    const block = selectedBlock();
    if (!block || !["hero", "cta-banner"].includes(block.type) || block.content.buttons.length >= 4) return;
    block.content.buttons.push({ text: "Novo botão", url: "page:inicio", icon: "arrow-right", media_asset_id: "", style: "solid" });
    checkpoint();
    renderAll();
  }

  function removeActionButtonAt(index) {
    const block = selectedBlock();
    if (!block || !["hero", "cta-banner"].includes(block.type)) return;
    block.content.buttons.splice(index, 1);
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

  async function openMediaPicker(field, kind, target = "block") {
    els.mediaDialog.dataset.field = field;
    els.mediaDialog.dataset.kind = kind;
    state.mediaTarget = target;
    els.mediaDialogTitle.textContent = kind === "video" ? "Escolher vídeo" : kind === "any" ? "Escolher imagem ou vídeo" : "Escolher imagem";
    els.mediaDialog.showModal();
    try {
      await loadMediaHotels();
      state.mediaBrowseHotelId = state.portal.hotel_id;
      state.mediaFolderId = "";
      state.mediaSearch = "";
      els.mediaSearch.value = "";
      renderMediaHotelOptions();
      await loadMediaBrowser();
    } catch (error) {
      renderMediaMessage(error.message || "Não foi possível abrir a Biblioteca de Mídia.", true);
    }
  }

  async function loadMediaBrowser() {
    if (!state.mediaBrowseHotelId) return;
    renderMediaMessage("Carregando arquivos...");
    const folderParams = new URLSearchParams({ hotel_id: state.mediaBrowseHotelId });
    if (state.mediaFolderId) folderParams.set("parent_id", state.mediaFolderId);
    const mediaParams = new URLSearchParams({
      hotel_id: state.mediaBrowseHotelId,
      status: "active",
      limit: "60",
      folder_id: state.mediaFolderId || "root",
    });
    if (state.mediaSearch) mediaParams.set("q", state.mediaSearch);
    try {
      const [foldersPayload, mediaPayload] = await Promise.all([
        adminApi(`/api/v1/admin/media-folders?${folderParams}`),
        adminApi(`/api/v1/admin/media?${mediaParams}`),
      ]);
      state.mediaFolders = foldersPayload.data.folders || [];
      state.mediaBreadcrumbs = foldersPayload.data.breadcrumbs || [];
      state.mediaBrowserAssets = mediaPayload.data.assets || [];
      renderMediaBrowser();
    } catch (error) {
      renderMediaMessage(error.message || "Não foi possível carregar os arquivos.", true);
    }
  }

  function renderMediaHotelOptions() {
    els.mediaHotel.innerHTML = state.mediaHotels.map((hotel) => `<option value="${escapeAttr(hotel.hotel_id)}" ${hotel.hotel_id === state.mediaBrowseHotelId ? "selected" : ""}>${escapeHtml(hotel.name || hotel.short_name || hotel.hotel_id)}</option>`).join("");
  }

  function renderMediaBrowser() {
    renderMediaHotelOptions();
    const selectedIds = new Set(els.mediaDialog.dataset.field === "media_asset_ids" ? selectedBlock()?.content.media_asset_ids || [] : []);
    const kind = els.mediaDialog.dataset.kind || "image";
    const assets = state.mediaBrowserAssets.filter((asset) => {
      const mime = String(asset.mime_type || "");
      if (kind === "any") return mime.startsWith("image/") || mime.startsWith("video/");
      return kind === "video" ? mime.startsWith("video/") : mime.startsWith("image/");
    });
    els.mediaBreadcrumbs.innerHTML = `<button type="button" data-media-breadcrumb="">${icon("home")}<span>Início</span></button>${state.mediaBreadcrumbs.map((folder) => `<span>${icon("down")}</span><button type="button" data-media-breadcrumb="${escapeAttr(folder.id)}">${escapeHtml(folder.name)}</button>`).join("")}`;
    const folders = state.mediaFolders.map((folder) => `<button type="button" class="vp-media-folder" data-media-folder="${escapeAttr(folder.id)}">${icon("folder")}<strong>${escapeHtml(folder.name)}</strong><small>${Number(folder.item_count || 0)} arquivo(s)</small></button>`).join("");
    const files = assets.map((asset) => `<button type="button" data-media-choice="${escapeAttr(asset.id)}" class="${selectedIds.has(asset.id) ? "is-selected" : ""}">${String(asset.mime_type).startsWith("video/") ? `<video src="${escapeAttr(asset.public_url)}" muted preload="metadata"></video><span>${icon("video")}</span>` : `<img src="${escapeAttr(asset.public_url)}" alt="">`}<strong>${escapeHtml(asset.original_filename || asset.alt_text || "Mídia")}</strong><small>${escapeHtml(asset.hotel_id === state.portal.hotel_id ? "Nesta unidade" : "Será copiado para esta unidade")}</small></button>`).join("");
    els.mediaGrid.innerHTML = folders + files || '<p class="vp-empty">Nenhum arquivo compatível nesta pasta.</p>';
    renderMediaMessage(`${state.mediaFolders.length} pasta(s) e ${assets.length} arquivo(s).`);
  }

  function openMediaFolder(folderId) {
    state.mediaFolderId = folderId || "";
    state.mediaSearch = "";
    els.mediaSearch.value = "";
    loadMediaBrowser();
  }

  async function uploadMediaFromPicker(file) {
    const form = new FormData();
    form.set("hotel_id", state.mediaBrowseHotelId);
    form.set("module_key", state.portal.module_key);
    if (state.mediaFolderId) form.set("folder_id", state.mediaFolderId);
    form.set("file", file);
    renderMediaMessage("Enviando arquivo...");
    els.mediaUpload.disabled = true;
    try {
      const payload = await adminApi("/api/v1/admin/media", { method: "POST", body: form });
      const asset = payload.data.asset;
      if (asset.hotel_id === state.portal.hotel_id) upsertPortalMedia(asset);
      await loadMediaBrowser();
      announce("Arquivo enviado para a Biblioteca de Mídia.");
    } catch (error) {
      renderMediaMessage(error.message || "Não foi possível enviar o arquivo.", true);
    } finally {
      els.mediaUpload.disabled = false;
      els.mediaUpload.value = "";
    }
  }

  async function selectMedia(mediaId) {
    let asset = state.mediaBrowserAssets.find((entry) => entry.id === mediaId) || state.media.find((entry) => entry.id === mediaId);
    if (!asset) return;
    try {
      if (asset.hotel_id !== state.portal.hotel_id) {
        renderMediaMessage("Copiando arquivo para a unidade do portal...");
        const payload = await adminApi(`/api/v1/admin/media/${encodeURIComponent(mediaId)}/copy`, {
          method: "POST",
          body: { hotel_id: state.portal.hotel_id, module_key: state.portal.module_key },
        });
        asset = payload.data.asset;
      }
      upsertPortalMedia(asset);
    } catch (error) {
      renderMediaMessage(error.message || "Não foi possível usar este arquivo.", true);
      return;
    }
    const field = els.mediaDialog.dataset.field;
    if (state.mediaTarget === "page") {
      setPath(activePage().settings, field, mediaId);
      checkpoint();
      closeMediaPicker();
      renderAll();
      scheduleAutosave();
      return;
    }
    if (state.mediaTarget === "document" || state.mediaTarget === "header") {
      setPath(state.mediaTarget === "header" ? state.document.settings.header : state.document.settings, field, mediaId);
      checkpoint();
      closeMediaPicker();
      renderAll();
      scheduleAutosave();
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
    scheduleAutosave();
  }

  function upsertPortalMedia(asset) {
    state.media = state.media.filter((entry) => entry.id !== asset.id);
    state.media.unshift(asset);
  }

  function renderMediaMessage(message, error = false) {
    els.mediaMessage.textContent = message;
    els.mediaMessage.dataset.error = String(error);
  }

  function closeMediaPicker() {
    if (els.mediaDialog.open) els.mediaDialog.close();
  }

  function switchPage(pageId) {
    const page = state.document.pages.find((item) => item.id === pageId);
    if (!page) return;
    state.activePageId = page.id;
    state.editorMobileMenuOpen = false;
    state.selectedId = page.blocks[0]?.id || null;
    renderAll();
    requestAnimationFrame(() => fitCanvas(true));
  }

  async function addPage() {
    if (state.document.pages.length >= 20) return announce("O site já atingiu o limite de páginas.", true);
    const values = await requestForm({
      title: "Nova página",
      message: "Defina como a página aparecerá no menu e no endereço do site.",
      confirmLabel: "Criar página",
      fields: [
        { name: "name", label: "Nome", value: "Nova página", required: true },
        { name: "slug", label: "Endereço", value: uniquePageSlug("nova-pagina"), required: true },
      ],
    });
    if (!values) return;
    const slug = uniquePageSlug(slugify(values.slug || values.name));
    const page = {
      id: uniquePageId(slug || "pagina"),
      type: "standard",
      slug,
      name: values.name.trim(),
      title: values.name.trim(),
      show_in_navigation: true,
      settings: clone(activePage()?.settings || defaultPageSettings()),
      blocks: [],
    };
    state.document.pages.push(page);
    state.activePageId = page.id;
    state.selectedId = null;
    checkpoint();
    renderAll();
    scheduleAutosave();
    announce("Página criada.");
  }

  function addRoomServicePage() {
    const existing = state.document.pages.find((page) => page.type === "room-service");
    if (existing) {
      switchPage(existing.id);
      announce("A página de Room Service já faz parte deste portal.");
      return;
    }
    if (state.document.pages.length >= 20) return announce("O site já atingiu o limite de páginas.", true);
    const slug = uniquePageSlug("room-service");
    const page = {
      id: uniquePageId("room-service"),
      type: "room-service",
      slug,
      name: "Room Service",
      title: "Room Service",
      show_in_navigation: true,
      settings: clone(activePage()?.settings || defaultPageSettings()),
      blocks: [],
    };
    state.document.pages.push(page);
    state.activePageId = page.id;
    state.selectedId = null;
    checkpoint();
    renderAll();
    scheduleAutosave();
    announce("Página de Room Service adicionada.");
  }

  function duplicatePage(pageId) {
    const source = state.document.pages.find((page) => page.id === pageId);
    if (!source || state.document.pages.length >= 20) return;
    if (source.type === "room-service") return announce("O portal pode ter somente uma página de Room Service.", true);
    const copy = clone(source);
    copy.id = uniquePageId(`${source.id}-copia`);
    copy.slug = uniquePageSlug(`${source.slug || "inicio"}-copia`);
    copy.name = `${source.name} - cópia`;
    copy.title = copy.name;
    copy.blocks = copy.blocks.map((block) => ({ ...block, id: uniqueBlockId(block.type) }));
    state.document.pages.splice(state.document.pages.indexOf(source) + 1, 0, copy);
    state.activePageId = copy.id;
    state.selectedId = copy.blocks[0]?.id || null;
    checkpoint(); renderAll(); scheduleAutosave(); announce("Página duplicada.");
  }

  async function deletePage(pageId) {
    const page = state.document.pages.find((item) => item.id === pageId);
    if (!page || !page.slug) return;
    if (!await requestConfirmation({ title: "Excluir página?", message: `A página “${page.name}” e todos os seus blocos serão removidos do rascunho.`, confirmLabel: "Excluir página", danger: true })) return;
    state.document.pages = state.document.pages.filter((item) => item.id !== pageId);
    state.activePageId = state.document.pages[0].id;
    state.selectedId = activePage().blocks[0]?.id || null;
    checkpoint(); renderAll(); scheduleAutosave(); announce("Página excluída.");
  }

  function uniquePageSlug(value) {
    const base = slugify(value) || "pagina";
    let candidate = base;
    let suffix = 2;
    while (state.document.pages.some((page) => page.slug === candidate)) candidate = `${base}-${suffix++}`;
    return candidate;
  }

  function normalizedPageSlug(value, pageId) {
    const base = slugify(value) || "pagina";
    let candidate = base;
    let suffix = 2;
    while (state.document.pages.some((page) => page.id !== pageId && page.slug === candidate)) candidate = `${base}-${suffix++}`;
    return candidate;
  }

  function renderPortalPath() {
    const page = activePage();
    els.path.textContent = `/${state.portal.hotel_slug}/${state.portal.slug}${page?.slug ? `/${page.slug}` : ""}`;
  }

  function uniquePageId(value) {
    const base = slugify(value) || "pagina";
    let candidate = base;
    let suffix = 2;
    while (state.document.pages.some((page) => page.id === candidate)) candidate = `${base}-${suffix++}`;
    return candidate;
  }

  function scheduleAutosave() {
    window.clearTimeout(state.autosaveTimer);
    const editor = state.document?.settings?.editor;
    if (!editor?.autosave_enabled || !isDirty() || state.saving) return;
    state.autosaveTimer = window.setTimeout(() => save({ automatic: true }).catch(() => {}), Math.max(15, Number(editor.autosave_interval_seconds || 30)) * 1000);
  }

  async function save({ automatic = false } = {}) {
    if (!state.portal || state.saving || !isDirty()) return state.portal;
    window.clearTimeout(state.autosaveTimer);
    state.saving = true;
    renderSaveState(automatic ? "Salvamento automático..." : "Salvando...");
    try {
      const payload = await adminApi(`/api/v1/admin/visual-portals/${encodeURIComponent(state.portal.id)}`, {
        method: "PATCH",
        body: { document: state.document, expected_revision: state.portal.draft_revision },
      });
      state.portal = payload.data.portal;
      state.document = clone(state.portal.document);
      if (!activePage()) state.activePageId = state.document.pages[0]?.id || null;
      state.original = stableJson(state.document);
      state.history = [clone(state.document)];
      state.historyIndex = 0;
      await loadVersions();
      renderAll();
      announce(automatic ? "Rascunho salvo automaticamente." : "Alterações salvas.");
      onSaved(state.portal);
      return state.portal;
    } catch (error) {
      announce(error.message || "Não foi possível salvar.", true);
      throw error;
    } finally {
      state.saving = false;
      renderSaveState();
      scheduleAutosave();
    }
  }

  async function publish() {
    try {
      if (isDirty()) await save();
      if (!await requestConfirmation({ title: "Publicar site?", message: "Todas as páginas desta versão ficarão disponíveis no endereço público.", confirmLabel: "Publicar agora" })) return;
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
    state.previewDocument = null;
    state.previewVersionId = "";
    state.previewPageId = state.activePageId;
    state.previewViewport = state.viewport;
    updatePreviewDialog();
    els.previewDialog.showModal();
  }

  function setPreviewViewport(viewport) {
    if (!new Set(["desktop", "mobile"]).has(viewport)) return;
    state.previewViewport = viewport;
    updatePreviewDialog();
  }

  function handlePreviewMessage(event) {
    if (event.source !== els.previewDialogFrame.contentWindow || event.data?.type !== "fioreze-visual-preview-page") return;
    const sourceDocument = state.previewDocument || state.document;
    if (!sourceDocument?.pages.some((page) => page.id === event.data.pageId)) return;
    state.previewPageId = event.data.pageId;
    updatePreviewDialog();
  }

  function updatePreviewDialog() {
    els.previewDialog.dataset.viewport = state.previewViewport;
    els.previewDeviceButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.previewViewport === state.previewViewport)));
    els.previewDialogFrame.srcdoc = previewDocumentHtml(state.previewDocument || state.document);
    els.previewVersionActions.hidden = !state.previewVersionId;
  }

  async function saveTemplate() {
    const values = await requestForm({ title: "Salvar como modelo", message: "O modelo incluirá todas as páginas, o cabeçalho e a identidade visual.", confirmLabel: "Salvar modelo", fields: [{ name: "name", label: "Nome do modelo", value: `${state.portal.name} - modelo`, required: true }] });
    const name = values?.name?.trim();
    if (!name) return;
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
    if (!await requestConfirmation({ title: "Aplicar modelo?", message: "As páginas e configurações atuais do rascunho serão substituídas pelo modelo selecionado.", confirmLabel: "Aplicar modelo" })) return;
    try {
      const params = new URLSearchParams({ hotel_id: state.portal.hotel_id, module_key: state.portal.module_key });
      const payload = await adminApi(`/api/v1/admin/visual-portal-templates/${encodeURIComponent(templateId)}?${params}`);
      state.document = clone(payload.data.template.document);
      state.activePageId = state.document.pages[0]?.id || null;
      state.selectedId = activePage()?.blocks[0]?.id || null;
      checkpoint();
      renderAll();
      announce("Modelo aplicado. Salve para confirmar.");
    } catch (error) {
      announce(error.message || "Não foi possível aplicar o modelo.", true);
    }
  }

  async function archiveTemplateDocument(templateId) {
    if (!await requestConfirmation({ title: "Arquivar modelo?", message: "O modelo deixará de aparecer para a equipe, sem alterar os sites que já o utilizam.", confirmLabel: "Arquivar", danger: true })) return;
    try {
      await adminApi(`/api/v1/admin/visual-portal-templates/${encodeURIComponent(templateId)}`, { method: "DELETE", body: {} });
      await loadTemplates();
      renderLeftPanel();
    } catch (error) {
      announce(error.message || "Não foi possível arquivar o modelo.", true);
    }
  }

  async function restoreVersionDocument(versionId) {
    if (!versionId || !await requestConfirmation({ title: "Restaurar esta versão?", message: "Ela será copiada para um novo rascunho. O site publicado continuará no ar até uma nova publicação.", confirmLabel: "Restaurar versão" })) return;
    try {
      setBusy(true, "Restaurando versão...");
      const payload = await adminApi(`/api/v1/admin/visual-portals/${encodeURIComponent(state.portal.id)}/versions/${encodeURIComponent(versionId)}/restore`, { method: "POST", body: {} });
      state.portal = payload.data.portal;
      state.document = clone(state.portal.document);
      state.activePageId = state.document.pages[0]?.id || null;
      state.original = stableJson(state.document);
      state.selectedId = activePage()?.blocks[0]?.id || null;
      state.history = [clone(state.document)];
      state.historyIndex = 0;
      await loadVersions();
      if (els.previewDialog.open) els.previewDialog.close();
      renderAll();
      onSaved(state.portal);
      announce("Versão restaurada como rascunho.");
    } catch (error) {
      announce(error.message || "Não foi possível restaurar a versão.", true);
    } finally {
      setBusy(false);
    }
  }

  async function previewSavedVersion(versionId) {
    try {
      setBusy(true, "Preparando prévia da versão...");
      const payload = await adminApi(`/api/v1/admin/visual-portals/${encodeURIComponent(state.portal.id)}/versions/${encodeURIComponent(versionId)}`);
      state.previewDocument = clone(payload.data.version.document);
      state.previewVersionId = versionId;
      state.previewPageId = state.previewDocument.pages[0]?.id || "";
      state.previewViewport = state.viewport;
      updatePreviewDialog();
      els.previewDialog.showModal();
    } catch (error) {
      announce(error.message || "Não foi possível abrir a prévia da versão.", true);
    } finally {
      setBusy(false);
    }
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    state.document = clone(state.history[state.historyIndex]);
    if (!activePage()) state.activePageId = state.document.pages[0]?.id || null;
    if (!selectedBlock()) state.selectedId = pageBlocks()[0]?.id || null;
    renderAll();
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    state.document = clone(state.history[state.historyIndex]);
    if (!activePage()) state.activePageId = state.document.pages[0]?.id || null;
    if (!selectedBlock()) state.selectedId = pageBlocks()[0]?.id || null;
    renderAll();
  }

  function checkpoint() {
    const snapshot = stableJson(state.document);
    if (stableJson(state.history[state.historyIndex]) === snapshot) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(clone(state.document));
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
    state.historyIndex = state.history.length - 1;
    scheduleAutosave();
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
    return pageBlocks().find((block) => block.id === state.selectedId) || null;
  }

  function selectedIndex() {
    return pageBlocks().findIndex((block) => block.id === state.selectedId);
  }

  function activePage() {
    return state.document?.pages?.find((page) => page.id === state.activePageId) || null;
  }

  function isRoomServicePage(page = activePage()) {
    return page?.type === "room-service";
  }

  function pageBlocks() {
    return activePage()?.blocks || [];
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

  function requestConfirmation({ title, message, confirmLabel = "Confirmar", danger = false }) {
    return requestForm({ title, message, confirmLabel, danger, fields: [] }).then((value) => Boolean(value));
  }

  function requestForm({ title, message, confirmLabel = "Confirmar", danger = false, fields = [] }) {
    return new Promise((resolve) => {
      els.actionDialogTitle.textContent = title;
      els.actionDialogMessage.textContent = message || "";
      els.actionDialogFields.innerHTML = fields.map((field) => `<label><span>${escapeHtml(field.label)}</span><input name="${escapeAttr(field.name)}" value="${escapeAttr(field.value || "")}" ${field.required ? "required" : ""}></label>`).join("");
      els.actionDialogConfirm.textContent = confirmLabel;
      els.actionDialogConfirm.classList.toggle("danger", danger);
      const finish = (value) => {
        els.actionDialog.removeEventListener("close", onClose);
        els.actionDialogForm.removeEventListener("submit", onSubmit);
        resolve(value);
      };
      const onClose = () => finish(null);
      const onSubmit = (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(els.actionDialogForm));
        els.actionDialog.removeEventListener("close", onClose);
        els.actionDialog.close();
        finish(values);
      };
      els.actionDialog.addEventListener("close", onClose, { once: true });
      els.actionDialogForm.addEventListener("submit", onSubmit, { once: true });
      els.actionDialog.showModal();
      els.actionDialogFields.querySelector("input")?.focus();
    });
  }

  function defaultPageSettings() {
    const settings = state.document.settings;
    return {
      background_color: settings.background_color,
      text_color: settings.text_color,
      surface_color: settings.surface_color,
      content_width: settings.content_width,
      page_padding: settings.page_padding,
      block_gap: settings.block_gap,
      background_media_asset_id: "",
      background_overlay: 0,
      background_position: "center",
      background_fit: "cover",
      background_fixed: false,
    };
  }

  function previewHeaderHtml(documentValue, page) {
    const header = documentValue.settings.header;
    if (!header.enabled) return "";
    const logo = mediaById(header.logo_media_asset_id);
    const pages = header.show_navigation ? documentValue.pages.filter((item) => item.show_in_navigation) : [];
    return `<div class="${editorHeaderClasses(header)} navigation-${escapeAttr(header.desktop_navigation_alignment || "center")}" style="--vp-header-bg:${escapeAttr(header.background_color)};--vp-header-text:${escapeAttr(header.text_color)};--vp-header-accent:${escapeAttr(header.accent_color)}">${header.show_logo ? `<div class="vp-editor-brand">${logo ? `<img src="${escapeAttr(logo.public_url)}" alt="">` : `<strong>${escapeHtml(state.portal.hotel_name)}</strong>`}</div>` : ""}<nav>${pages.map((item) => `<button type="button" data-preview-page="${escapeAttr(item.id)}" class="${item.id === page.id ? "is-current" : ""}">${escapeHtml(item.name)}</button>`).join("")}</nav>${header.cta_text ? `<span class="vp-editor-header-cta">${escapeHtml(header.cta_text)}</span>` : ""}</div>`;
  }

  function editorHeaderClasses(header) {
    return [
      "vp-editor-site-header",
      `header-${header.style}`,
      header.position === "sticky" ? "is-sticky" : "",
      header.transparent ? "is-transparent" : "",
      header.blur ? "has-blur" : "",
    ].filter(Boolean).map(escapeAttr).join(" ");
  }

  function previewDocumentHtml(sourceDocument = state.document) {
    const previousDocument = state.document;
    const previousPageId = state.activePageId;
    const page = sourceDocument.pages.find((item) => item.id === state.previewPageId)
      || sourceDocument.pages.find((item) => item.id === previousPageId)
      || sourceDocument.pages[0];
    const siteSettings = sourceDocument.settings;
    const settings = page.settings;
    const previousViewport = state.viewport;
    let blocks = "";
    try {
      state.document = sourceDocument;
      state.activePageId = page.id;
      state.viewport = state.previewViewport;
      blocks = isRoomServicePage(page)
        ? renderRoomServicePagePreview()
        : page.blocks.map((block, index) => renderEditableBlock(block, index).replace(/draggable="true"/g, "").replace(/<div class="vp-block-toolbar">[\s\S]*?<\/div>/, "")).join("");
    } finally {
      state.viewport = previousViewport;
      state.document = previousDocument;
      state.activePageId = previousPageId;
    }
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:${settings.background_color};color:${settings.text_color};font-family:${siteSettings.font_family}}${builderPreviewCss()}</style><link rel="stylesheet" href="/css/modules/admin/portal-builder.css"></head><body><main class="vp-preview-page ${settings.background_media_asset_id ? "has-page-media" : ""}" style="--vp-page-bg:${settings.background_color};--vp-page-text:${settings.text_color};--vp-page-primary:${siteSettings.primary_color};--vp-page-surface:${settings.surface_color};--vp-page-font:${siteSettings.font_family};--vp-page-gap:${settings.block_gap}px;--vp-page-padding:${settings.page_padding}px;--vp-page-overlay:${Number(settings.background_overlay || 0) / 100};--vp-page-media-position:${settings.background_position || "center"};--vp-page-media-fit:${settings.background_fit || "cover"}">${pageBackgroundPreview(settings)}${previewHeaderHtml(sourceDocument, page)}<div class="vp-page-content">${blocks}</div></main><script>document.addEventListener("click",event=>{const target=event.target.closest("[data-preview-page]");if(!target)return;event.preventDefault();parent.postMessage({type:"fioreze-visual-preview-page",pageId:target.dataset.previewPage},"*")});<\/script></body></html>`;
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
      <div class="vp-builder-actions"><span data-builder-save-state></span><a data-builder-open-public href="#" target="_blank" rel="noopener noreferrer" hidden>${icon("external")} Abrir publicado</a><button type="button" data-builder-preview>${icon("eye")} Visualizar</button><button type="button" data-builder-save>${icon("save")} Salvar</button><button class="primary" type="button" data-builder-publish>${icon("publish")} Publicar</button></div>
    </header>
    <div class="vp-builder-workspace">
      <aside class="vp-left-panel"><nav><button type="button" data-builder-tab="pages">${icon("page")}<span>Páginas</span></button><button type="button" data-builder-tab="blocks" aria-selected="true">${icon("plusgrid")}<span>Blocos</span></button><button type="button" data-builder-tab="layers">${icon("layers")}<span>Camadas</span></button><button type="button" data-builder-tab="templates">${icon("template")}<span>Modelos</span></button><button type="button" data-builder-tab="versions">${icon("history")}<span>Versões</span></button></nav><div class="vp-left-content"></div></aside>
      <main class="vp-stage" data-viewport="desktop"><div class="vp-stage-toolbar"><button type="button" data-page-settings>${icon("sliders")} Configurações da página</button><span>Arraste os blocos para reorganizar</span></div><div class="vp-stage-scroll"><div class="vp-canvas-frame"><div class="vp-builder-canvas" data-builder-canvas></div></div></div></main>
      <aside class="vp-inspector"><header><div><strong>Propriedades</strong><span>Selecione um bloco</span></div>${icon("sliders")}</header><div class="vp-inspector-body"></div></aside>
    </div>
    <div class="vp-builder-busy" hidden><span class="admin-modern-spinner"></span><strong>Carregando...</strong></div>
    <p class="vp-builder-toast" role="status" aria-live="polite" hidden></p>
    <dialog class="vp-media-picker"><header><div><strong>Biblioteca de Mídia</strong><span>Pastas e arquivos das unidades autorizadas</span></div><button type="button" data-media-picker-close>${icon("close")}</button></header><div class="vp-media-picker-toolbar"><label><span>Unidade</span><select data-media-hotel></select></label><form data-media-search-form><span>${icon("search")}</span><input type="search" data-media-search placeholder="Buscar arquivo" aria-label="Buscar arquivo"><button type="submit" data-media-search-submit title="Buscar">${icon("search")}</button></form><label class="vp-media-upload"><input type="file" data-media-upload accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime"><span>${icon("plus")} Enviar arquivo</span></label></div><nav class="vp-media-breadcrumbs" aria-label="Pastas"></nav><p class="vp-media-picker-message" role="status"></p><div class="vp-media-picker-grid"></div></dialog>
    <dialog class="vp-live-preview" data-viewport="desktop"><header><strong>Pré-visualização</strong><div class="vp-preview-device-controls" aria-label="Dispositivo da pré-visualização"><button type="button" data-preview-viewport="desktop" aria-pressed="true">${icon("desktop")} Desktop</button><button type="button" data-preview-viewport="mobile" aria-pressed="false">${icon("mobile")} Mobile</button></div><div class="vp-preview-version-actions" hidden><button type="button" data-preview-version-restore>${icon("undo")} Restaurar esta versão</button></div><button type="button" data-preview-close title="Fechar">${icon("close")}</button></header><div class="vp-preview-frame-wrap"><iframe title="Pré-visualização do portal" sandbox="allow-scripts allow-forms allow-popups allow-presentation"></iframe></div></dialog>
    <dialog class="vp-action-dialog"><form method="dialog"><header><strong></strong><button type="button" data-action-dialog-close title="Fechar">${icon("close")}</button></header><p></p><div class="vp-action-dialog-fields"></div><footer><button type="button" data-action-dialog-close>Cancelar</button><button class="primary" type="submit">Confirmar</button></footer></form></dialog>`;
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
    publicLink: root.querySelector("[data-builder-open-public]"),
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
    mediaHotel: root.querySelector("[data-media-hotel]"),
    mediaSearch: root.querySelector("[data-media-search]"),
    mediaUpload: root.querySelector("[data-media-upload]"),
    mediaBreadcrumbs: root.querySelector(".vp-media-breadcrumbs"),
    mediaMessage: root.querySelector(".vp-media-picker-message"),
    mediaGrid: root.querySelector(".vp-media-picker-grid"),
    previewDialog: root.querySelector(".vp-live-preview"),
    previewDialogFrame: root.querySelector(".vp-live-preview iframe"),
    previewDeviceButtons: [...root.querySelectorAll("[data-preview-viewport]")],
    previewVersionActions: root.querySelector(".vp-preview-version-actions"),
    actionDialog: root.querySelector(".vp-action-dialog"),
    actionDialogForm: root.querySelector(".vp-action-dialog form"),
    actionDialogTitle: root.querySelector(".vp-action-dialog header strong"),
    actionDialogMessage: root.querySelector(".vp-action-dialog form > p"),
    actionDialogFields: root.querySelector(".vp-action-dialog-fields"),
    actionDialogConfirm: root.querySelector(".vp-action-dialog footer .primary"),
  };
}

function createBlock(type) {
  const shared = { id: `${type}-${crypto.randomUUID().slice(0, 8)}`, type, styles: { base: { width: "content", padding_top: 40, padding_bottom: 40 }, desktop: {}, mobile: { padding_top: 28, padding_bottom: 28 } }, visibility: { desktop: true, mobile: true } };
  const content = {
    hero: { eyebrow: "Bem-vindo", title: "Uma experiência especial", text: "Conte sua história e conduza o visitante para a próxima ação.", button_text: "Saiba mais", button_url: "/", buttons: [{ text: "Saiba mais", url: "/", icon: "arrow-right", media_asset_id: "", style: "solid" }], media_asset_id: "", overlay: 35 },
    heading: { title: "Novo título", text: "Adicione uma descrição para apresentar esta seção." },
    text: { text: "Escreva aqui seu conteúdo. Você pode criar novos parágrafos deixando uma linha em branco." },
    button: { text: "Novo botão", url: "/", style: "solid" },
    image: { media_asset_id: "", alt_text: "", caption: "", fit: "cover" },
    video: { media_asset_id: "", poster_media_asset_id: "", title: "", autoplay: false, muted: true, loop: false, controls: true },
    embed: { title: "Conteúdo incorporado", mode: "url", url: "", html: "", aspect_ratio: "16:9", allow_fullscreen: true },
    gallery: { title: "Galeria", media_asset_ids: [] },
    "feature-grid": { layout: "stacked", text_background_color: "#ffffffee", text_color: "#ffffff", text_background_blur: 12, items: [{ title: "Novo destaque", text: "Descreva este conteúdo.", media_asset_id: "", button_text: "", button_url: "" }] },
    faq: { title: "Perguntas frequentes", items: [{ question: "Como funciona?", answer: "Escreva uma resposta clara e objetiva." }] },
    stats: { title: "Nossos números", items: [{ value: "100%", label: "Novo indicador" }] },
    timeline: { title: "Nossa trajetória", items: [{ period: "Etapa", title: "Novo momento", text: "Descreva o que acontece nesta etapa." }] },
    testimonials: { title: "O que dizem sobre nós", items: [{ quote: "Uma experiência memorável.", author: "Cliente", role: "", media_asset_id: "" }] },
    "icon-list": { title: "Destaques", items: [{ icon: "sparkles", title: "Novo benefício", text: "Descreva este item.", url: "" }] },
    "cta-banner": { eyebrow: "Em destaque", title: "Uma chamada importante", text: "Conduza o visitante para a próxima ação.", media_asset_id: "", overlay: 35, buttons: [{ text: "Conhecer", url: "/", icon: "arrow-right", media_asset_id: "", style: "solid" }] },
    quote: { quote: "Uma frase memorável para destacar.", author: "" },
    contact: { title: "Fale conosco", text: "Estamos à disposição para ajudar.", phone: "", email: "", address: "", button_text: "", button_url: "" },
    divider: { label: "" },
    spacer: {},
  }[type];
  if (type === "spacer") shared.styles.base.min_height = 64;
  if (type === "feature-grid") shared.styles.base.columns = 3;
  if (type === "gallery") shared.styles.base.columns = 3;
  if (type === "stats") shared.styles.base.columns = 3;
  if (type === "testimonials") shared.styles.base.columns = 3;
  if (type === "icon-list") shared.styles.base.columns = 3;
  if (["feature-grid", "gallery", "stats", "testimonials", "icon-list"].includes(type)) shared.styles.mobile.columns = 1;
  if (type === "hero") Object.assign(shared.styles.mobile, { heading_size: 48, text_size: 16, padding_inline: 18 });
  if (type === "heading") shared.styles.mobile.heading_size = 38;
  if (type === "quote") shared.styles.mobile.heading_size = 30;
  if (["hero", "heading", "quote", "button", "cta-banner"].includes(type)) shared.styles.base.alignment = "center";
  return { ...shared, content };
}

function builderPreviewCss() {
  return `.vp-preview-page{position:relative;min-height:100vh;background:var(--vp-page-bg);color:var(--vp-page-text);font-family:var(--vp-page-font)}.vp-page-background{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}.vp-page-background.is-fixed{position:fixed}.vp-page-background img,.vp-page-background video{width:100%;height:100%;object-fit:var(--vp-page-media-fit);object-position:var(--vp-page-media-position)}.vp-page-background span{position:absolute;inset:0;background:rgba(0,0,0,var(--vp-page-overlay))}.vp-editor-site-header{position:relative;z-index:4;display:grid;grid-template-columns:minmax(150px,1fr) auto minmax(150px,1fr);align-items:center;gap:22px;min-height:76px;padding:12px 28px;background:var(--vp-header-bg);color:var(--vp-header-text)}.vp-editor-site-header.is-sticky{position:sticky;top:0}.vp-editor-site-header.is-transparent,.vp-editor-site-header.header-minimal{background:transparent}.vp-editor-site-header.has-blur{backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.vp-editor-site-header.header-floating{margin:16px;border:1px solid rgba(0,0,0,.1);border-radius:18px;background:color-mix(in srgb,var(--vp-header-bg) 84%,transparent);backdrop-filter:blur(18px)}.vp-editor-site-header.header-floating.is-transparent{border-color:transparent;background:transparent;box-shadow:none}.vp-editor-site-header.header-centered{grid-template-columns:1fr;justify-items:center}.vp-editor-brand img{display:block;max-width:180px;max-height:48px}.vp-editor-site-header nav{display:flex;justify-content:center;gap:4px;scrollbar-width:none}.vp-editor-site-header nav::-webkit-scrollbar{display:none}.vp-editor-site-header nav button{padding:8px 11px;border:0;border-radius:999px;background:transparent;color:inherit;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap}.vp-editor-site-header nav button.is-current{background:color-mix(in srgb,var(--vp-header-accent) 14%,transparent);color:var(--vp-header-accent)}.vp-editor-header-cta{justify-self:end;padding:9px 14px;border-radius:999px;background:var(--vp-header-accent);color:#fff;font-size:11px;font-weight:750}.vp-page-content{position:relative;z-index:1;display:grid;gap:var(--vp-page-gap)}.vp-canvas-block{position:relative;padding:40px var(--vp-page-padding)}.vp-block-toolbar{display:none}.vp-preview-inner{width:min(100%,1120px);margin:auto}.vp-preview-hero{display:grid;place-items:center;min-height:420px;padding:64px;background-position:center;background-size:cover;text-align:center}.vp-preview-hero.has-media{color:#fff}.vp-preview-hero h1{font-size:clamp(2.6rem,6vw,6rem);line-height:1}.vp-preview-inner h2{font-size:clamp(2rem,4vw,4rem)}.vp-preview-button{display:inline-flex;padding:12px 18px;border-radius:999px;background:var(--vp-page-primary);color:#fff;text-decoration:none}.vp-preview-grid,.vp-preview-gallery,.vp-preview-stats{display:grid;grid-template-columns:repeat(var(--vp-columns,3),minmax(0,1fr));gap:20px}.vp-preview-grid article{overflow:hidden;border:1px solid #ddd;border-radius:24px}.vp-preview-grid article>div{padding:18px}.vp-preview-grid img,.vp-preview-gallery img,.vp-preview-media img,.vp-preview-media video{width:100%;display:block;object-fit:cover}.vp-preview-grid img,.vp-preview-gallery img{aspect-ratio:4/3}.vp-preview-faq{display:grid;gap:10px}.vp-preview-faq h2{margin-bottom:12px}.vp-preview-faq details,.vp-preview-stats article{padding:18px;border:1px solid #ddd;border-radius:18px}.vp-preview-faq summary{display:flex;justify-content:space-between;gap:16px;font-weight:750}.vp-preview-stats article{display:grid;gap:6px;text-align:center}.vp-preview-stats strong{color:var(--vp-accent);font-size:2.8rem}.vp-preview-timeline article{display:grid;grid-template-columns:18px 1fr;gap:16px;padding-bottom:22px}.vp-preview-timeline article>span{width:16px;height:16px;margin-top:5px;border-radius:50%;background:var(--vp-accent)}.vp-preview-timeline small{color:var(--vp-accent);font-weight:800;text-transform:uppercase}.vp-preview-quote{font-size:2.4rem;text-align:center}.vp-preview-embed{position:relative;aspect-ratio:var(--vp-embed-ratio);overflow:hidden;border-radius:inherit;background:#e9ebef}.vp-preview-embed iframe{width:100%;height:100%;border:0}.vp-preview-embed>span{display:none}@media(max-width:760px){.vp-editor-site-header{grid-template-columns:minmax(0,1fr);gap:8px;padding:12px 18px}.vp-editor-site-header nav{justify-content:flex-start;overflow-x:auto}.vp-preview-grid,.vp-preview-gallery,.vp-preview-stats{grid-template-columns:1fr}.vp-preview-hero{padding:32px 18px}.vp-canvas-block{padding-inline:18px}}`;
}

function editableStyle(style) {
  return [
    `text-align:${style.alignment || "left"}`,
    `background:${style.background_color || "transparent"}`,
    `color:${style.text_color || "inherit"}`,
    `--vp-accent:${style.accent_color || "var(--vp-page-primary)"}`,
    `--vp-columns:${style.columns || 3}`,
    `--vp-radius:${Number(style.border_radius || 0)}px`,
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
function previewActionButtons(buttons = []) { return `<div class="vp-preview-actions">${buttons.map((button) => button.text ? `<a class="vp-preview-button is-${escapeAttr(button.style || "solid")}" href="#" tabindex="-1">${button.media_asset_id ? icon("image") : previewPortalIcon(button.icon)}<span>${escapeHtml(button.text)}</span></a>` : "").join("")}</div>`; }
function previewPortalIcon(name) { return icon(name || "sparkles"); }
function blockLabel(block, index) { return block.content?.title || block.content?.text?.slice(0, 32) || `${BLOCK_LABELS[block.type]} ${index + 1}`; }
function iconForBlock(type) { return BLOCKS.find(([key]) => key === type)?.[3] || icon("grid"); }
function uniqueBlockId(type) { return `${type}-${crypto.randomUUID().slice(0, 8)}`; }
function slugify(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function escapeCssUrl(value) { return String(value || "").replace(/["'()\\\n\r]/g, ""); }
function formatVersionDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "data indisponível" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stableJson(value) { return JSON.stringify(value); }
function setPath(target, path, value) { const parts = path.split("."); const last = parts.pop(); const parent = parts.reduce((current, part) => current[Number.isInteger(Number(part)) ? Number(part) : part], target); if (value === undefined) delete parent[last]; else parent[last] = value; }
function getPath(target, path) { return path.split(".").reduce((current, part) => current?.[Number.isInteger(Number(part)) ? Number(part) : part], target); }
function inputValue(input) { if (input.type === "checkbox") return input.checked; if (input.type === "number" || input.type === "range") return Number(input.value); return input.value; }
function emptyAsUndefined(input) { return input.value === "" ? undefined : inputValue(input); }
function options(entries, selected) { return entries.map(([value, label]) => `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`).join(""); }
function textField(label, field, value) { return `<label><span>${escapeHtml(label)}</span><input data-content-field="${escapeAttr(field)}" value="${escapeAttr(value || "")}"></label>`; }
function textareaField(label, field, value, rows = 5) { return `<label><span>${escapeHtml(label)}</span><textarea data-content-field="${escapeAttr(field)}" rows="${rows}">${escapeHtml(value || "")}</textarea></label>`; }
function colorField(label, field, value, scope, optional = false) {
  const parsed = parseEditorColor(value) || { rgb: "#ffffff", alpha: 100 };
  const transparency = 100 - parsed.alpha;
  return `<label class="vp-color-field"><span>${escapeHtml(label)}</span><input type="color" data-color-control data-color-role="picker" data-color-scope="${escapeAttr(scope)}" data-color-field="${escapeAttr(field)}" value="${escapeAttr(parsed.rgb)}"><input data-color-control data-color-role="text" data-color-scope="${escapeAttr(scope)}" data-color-field="${escapeAttr(field)}" data-color-optional="${optional}" value="${escapeAttr(value || "")}" placeholder="${optional ? "Herdar" : "#000000"}"><div class="vp-color-alpha"><span>Transparência</span><input type="range" min="0" max="100" value="${transparency}" data-color-control data-color-role="alpha" data-color-scope="${escapeAttr(scope)}" data-color-field="${escapeAttr(field)}"><output>${transparency}%</output></div></label>`;
}
function rangeField(label, field, value, min, max, scope, optional = false) { const attr = scope === "doc" ? "data-doc-field" : scope === "content" ? "data-content-field" : "data-style-field"; return `<label class="vp-range-field"><span>${escapeHtml(label)} <output>${value === "" ? (optional ? "Herdar" : min) : value}</output></span><input type="range" ${attr}="${escapeAttr(field)}" min="${min}" max="${max}" value="${value === "" ? min : value}"></label>`; }
function positionRangeField(label, field, value) { const normalized = Number(value || 0); return `<label class="vp-range-field"><span>${escapeHtml(label)} <output>${normalized}px</output></span><input type="range" data-style-field="${escapeAttr(field)}" min="-320" max="320" value="${normalized}"></label>`; }
function toggleField(label, field, checked, scope = "content") { return switchField(label, field, checked, scope); }
function mediaField(label, field, value, kind) { return `<div class="vp-media-field"><span>${escapeHtml(label)}</span><button type="button" data-choose-media="${escapeAttr(field)}" data-media-kind="${kind}">${value ? `${icon(kind === "video" ? "video" : "image")}<strong>Trocar arquivo</strong>` : `${icon("plus")}<strong>Escolher da biblioteca</strong>`}</button></div>`; }
function pageMediaField(value) { return `<div class="vp-media-field"><span>Imagem ou vídeo</span><button type="button" data-choose-media="background_media_asset_id" data-media-kind="any" data-media-target="page">${value ? `${icon("image")}<strong>Trocar fundo</strong>` : `${icon("plus")}<strong>Escolher da biblioteca</strong>`}</button></div>`; }
function docToggleField(label, field, checked) { return switchField(label, field, checked, "document"); }
function pageColorField(label, field, value) { return colorField(label, field, value, "page"); }
function headerColorField(label, field, value) { return colorField(label, field, value, "header"); }
function pageRangeField(label, field, value, min, max) { return `<label class="vp-range-field"><span>${escapeHtml(label)} <output>${value}</output></span><input type="range" data-page-setting-field="${escapeAttr(field)}" min="${min}" max="${max}" value="${value}"></label>`; }
function editorRangeField(label, field, value, min, max) { return `<label class="vp-range-field"><span>${escapeHtml(label)} <output>${value}</output></span><input type="range" data-editor-field="${escapeAttr(field)}" min="${min}" max="${max}" value="${value}"></label>`; }
function pageToggleField(label, field, checked) { return switchField(label, field, checked, "page"); }
function pageSettingToggleField(label, field, checked) { return switchField(label, field, checked, "pageSettings"); }
function headerToggleField(label, field, checked) { return switchField(label, field, checked, "header"); }
function editorToggleField(label, field, checked) { return switchField(label, field, checked, "editor"); }
function switchField(label, field, checked, scope) { return `<button type="button" class="vp-toggle" role="switch" aria-checked="${Boolean(checked)}" data-toggle-scope="${escapeAttr(scope)}" data-toggle-field="${escapeAttr(field)}"><span aria-hidden="true"></span><strong>${escapeHtml(label)}</strong></button>`; }
function textFieldForScope(label, field, value, scope) { return `<label><span>${escapeHtml(label)}</span><input data-${escapeAttr(scope)}-field="${escapeAttr(field)}" value="${escapeAttr(value || "")}"></label>`; }
function siteMediaField(label, field, value, kind, target) { return `<div class="vp-media-field"><span>${escapeHtml(label)}</span><button type="button" data-choose-media="${escapeAttr(field)}" data-media-kind="${kind}" data-media-target="${escapeAttr(target)}">${value ? `${icon("image")}<strong>Trocar arquivo</strong>` : `${icon("plus")}<strong>Escolher da biblioteca</strong>`}</button></div>`; }

function iconSelectField(label, field, value) {
  return `<label><span>${escapeHtml(label)}</span><select data-content-field="${escapeAttr(field)}">${options([["", "Sem ícone"], ["arrow-right", "Seta"], ["calendar", "Calendário"], ["map-pin", "Localização"], ["phone", "Telefone"], ["shopping-bag", "Compras"], ["sparkles", "Destaque"]], value)}</select></label>`;
}

function parseEditorColor(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(normalized)) return { rgb: normalized, alpha: 100 };
  if (/^#[0-9a-f]{8}$/.test(normalized)) return { rgb: normalized.slice(0, 7), alpha: Math.round((Number.parseInt(normalized.slice(7), 16) / 255) * 100) };
  const match = normalized.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/);
  if (!match) return null;
  const channels = match.slice(1, 4).map(Number);
  if (channels.some((channel) => channel > 255)) return null;
  return { rgb: `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`, alpha: Math.round(Number(match[4] ?? 1) * 100) };
}

function colorWithAlpha(rgb, alpha) {
  const normalizedAlpha = clamp(Math.round(Number(alpha)), 0, 100);
  return normalizedAlpha === 100 ? rgb : `${rgb}${Math.round((normalizedAlpha / 100) * 255).toString(16).padStart(2, "0")}`;
}

function icon(name) {
  const paths = {
    list: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
    megaphone: '<path d="m3 11 14-6v14L3 13v-2Z"/><path d="M7 15v4a2 2 0 0 0 2 2h2l-1-5"/>',
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    "map-pin": '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    phone: '<path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-4-2-2 2c-3.5-1.5-6.5-4.5-8-8l2-2-2-4Z"/>',
    "shopping-bag": '<path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
    back: '<path d="m15 18-6-6 6-6"/>', undo: '<path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/>', redo: '<path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/>', desktop: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>', mobile: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>', zoomout: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6"/>', eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>', external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', save: '<path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>', publish: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v6h14v-6"/>', plusgrid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M17.5 14v7M14 17.5h7"/>', layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>', template: '<path d="M4 4h16v16H4zM4 10h16M10 10v10"/>', history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>', page: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>', home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>', sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', sparkles: '<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z"/>', heading: '<path d="M5 5v14M19 5v14M5 12h14"/>', text: '<path d="M4 6h16M4 10h16M4 14h12M4 18h9"/>', button: '<rect x="3" y="7" width="18" height="10" rx="3"/><path d="M9 12h6"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m3 17 5-5 4 4 3-3 6 6"/>', video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>', embed: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m9 10-3 2 3 2M15 10l3 2-3 2"/>', move: '<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>', gallery: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>', grid: '<rect x="3" y="4" width="5" height="16"/><rect x="10" y="4" width="5" height="16"/><rect x="17" y="4" width="4" height="16"/>', faq: '<path d="M9.5 9a2.7 2.7 0 1 1 4.6 1.9c-1.2 1-2.1 1.4-2.1 3.1"/><path d="M12 18h.01"/><circle cx="12" cy="12" r="9"/>', stats: '<path d="M5 20V10M12 20V4M19 20v-7"/><path d="M3 20h18"/>', timeline: '<path d="M6 4v16"/><circle cx="6" cy="7" r="2"/><circle cx="6" cy="17" r="2"/><path d="M10 7h10M10 17h10"/>', quote: '<path d="M5 7h5v5H7v5H4v-7a3 3 0 0 1 3-3M15 7h5v5h-3v5h-3v-7a3 3 0 0 1 3-3"/>', contact: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', divider: '<path d="M3 12h18"/>', spacer: '<path d="M8 3h8M8 21h8M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3"/>', grip: '<circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/>', up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>', trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>', plus: '<path d="M12 5v14M5 12h14"/>', bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.grid}</svg>`;
}
