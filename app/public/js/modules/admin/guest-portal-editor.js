import { adminApi } from "./shared/admin-api.js";
import {
  PORTALS_HOTELS_BRANDING_PERMISSION,
  PORTALS_HOTELS_MODULES_PERMISSION,
  PORTALS_HOTELS_SETTINGS_PERMISSION,
  PORTALS_MEDIA_READ_PERMISSION,
  PORTALS_MEDIA_UPLOAD_PERMISSION,
  getAuthorizedHotels,
  hasPermission,
} from "./shared/admin-session.js";
import { escapeAttr, escapeHtml } from "./shared/format.js";
import { portalFontOptions } from "../../core/portal-fonts.js";

const SERVICE_KEYS = ["room-service", "emporio", "romantic-packages", "spa"];
const SERVICE_LABELS = {
  "room-service": "Room Service",
  emporio: "Empório",
  "romantic-packages": "Pacotes românticos",
  spa: "Spa",
};
const SERVICE_DESCRIPTIONS = {
  "room-service": "Refeições e bebidas no conforto da acomodação.",
  emporio: "Produtos selecionados, presentes e lembranças.",
  "romantic-packages": "Experiências especiais para celebrar a dois.",
  spa: "Massagens, tratamentos e momentos de bem-estar.",
};

export function createGuestPortalEditor({ root, hotelSelect, onHeading }) {
  const els = {
    root,
    hotelSelect,
    panel: root.querySelector("#guestPortalEditorPanel"),
    save: root.querySelector("#saveGuestPortalButton"),
    status: root.querySelector("#guestPortalEditorStatus"),
    publicLink: root.querySelector("#guestPortalPublicLink"),
    publicLinkLabel: root.querySelector("#guestPortalPublicLinkLabel"),
    previewName: root.querySelector("#guestPortalPreviewName"),
    previewFrame: root.querySelector("#guestPortalPreviewFrame"),
    preview: root.querySelector("#guestPortalPreview"),
  };
  const state = {
    session: null,
    hotel: null,
    modules: [],
    media: [],
    catalog: { categories: [], category_options: [] },
    catalogEditor: null,
    activeTab: "identity",
    device: "desktop",
    dirty: false,
    saving: false,
    loaded: false,
  };
  let bound = false;

  function open(session) {
    state.session = session;
    bind();
    populateHotels();
    onHeading?.("Portal do Hóspede", "Personalize o template oficial da unidade sem alterar sua estrutura.");
    return load();
  }

  function refresh() {
    if (!state.session) return Promise.resolve();
    return load();
  }

  function dismiss() {
    state.loaded = false;
  }

  function bind() {
    if (bound) return;
    bound = true;
    els.hotelSelect.addEventListener("change", load);
    els.save.addEventListener("click", save);
    els.root.addEventListener("click", handleClick);
    els.root.addEventListener("input", handleInput);
    els.root.addEventListener("change", handleChange);
    els.root.addEventListener("submit", handleSubmit);
    els.preview.addEventListener("load", postPreview);
  }

  function populateHotels() {
    const previous = els.hotelSelect.value;
    const hotels = getAuthorizedHotels(state.session);
    els.hotelSelect.innerHTML = hotels
      .map((hotel) => `<option value="${escapeAttr(hotel.hotel_id)}">${escapeHtml(hotel.short_name || hotel.name || hotel.hotel_id)}</option>`)
      .join("");
    if (previous && hotels.some((hotel) => hotel.hotel_id === previous)) els.hotelSelect.value = previous;
  }

  async function load() {
    const hotelId = els.hotelSelect.value;
    if (!hotelId) {
      renderUnavailable("Nenhuma unidade disponível para esta conta.");
      return;
    }
    setStatus("Carregando portal...");
    els.panel.innerHTML = '<div class="guest-portal-editor-loading">Preparando o editor...</div>';
    try {
      const requests = [
        adminApi(`/api/v1/admin/hotels/${encodeURIComponent(hotelId)}`),
        adminApi(`/api/v1/admin/hotels/${encodeURIComponent(hotelId)}/modules`),
        adminApi(`/api/v1/admin/emporio/catalog?hotel_id=${encodeURIComponent(hotelId)}`),
      ];
      if (hasPermission(state.session, PORTALS_MEDIA_READ_PERMISSION)) {
        requests.push(adminApi(`/api/v1/admin/media?hotel_id=${encodeURIComponent(hotelId)}&status=active`));
      }
      const [hotelPayload, modulesPayload, catalogPayload, mediaPayload] = await Promise.all(requests);
      state.hotel = structuredClone(hotelPayload.data.hotel);
      state.modules = structuredClone(modulesPayload.data.modules || []);
      state.catalog = structuredClone(catalogPayload.data || { categories: [], category_options: [] });
      state.media = mediaPayload?.data?.assets || [];
      state.catalogEditor = null;
      state.dirty = false;
      state.loaded = true;
      els.publicLink.href = publicPortalUrl();
      els.previewName.textContent = state.hotel.short_name || state.hotel.name;
      els.preview.src = `${publicPortalUrl()}?admin_preview=1`;
      renderPanel();
      syncSaveAccess();
      setStatus("Tudo salvo.", "success");
      postPreview();
    } catch (error) {
      state.loaded = false;
      renderUnavailable(error.message || "Não foi possível carregar o portal.");
    }
  }

  function renderUnavailable(message) {
    els.panel.innerHTML = `<div class="guest-portal-editor-empty"><strong>Portal indisponível</strong><span>${escapeHtml(message)}</span></div>`;
    setStatus(message, "error");
    els.save.disabled = true;
  }

  function renderPanel() {
    for (const button of els.root.querySelectorAll("[data-guest-editor-tab]")) {
      button.setAttribute("aria-selected", String(button.dataset.guestEditorTab === state.activeTab));
    }
    if (state.activeTab === "identity") els.panel.innerHTML = renderIdentityPanel();
    else if (state.activeTab === "home") els.panel.innerHTML = renderHomePanel();
    else if (state.activeTab === "services") els.panel.innerHTML = renderServicesPanel();
    else if (state.activeTab === "emporio") els.panel.innerHTML = renderEmporioPanel();
    else els.panel.innerHTML = renderContentPanel();
    syncEditorChrome();
  }

  function renderIdentityPanel() {
    const branding = state.hotel.branding || {};
    return `
      <section class="guest-editor-section">
        <header><strong>Marca da unidade</strong><span>As mesmas escolhas aparecem no portal inteiro.</span></header>
        ${mediaPicker("Logo horizontal", "branding.horizontal_logo_url", branding.horizontal_logo_url, { imagesOnly: true })}
        ${mediaPicker("Logo reduzida", "branding.icon_url", branding.icon_url, { imagesOnly: true })}
      </section>
      <section class="guest-editor-section">
        <header><strong>Paleta e tipografia</strong><span>O template aplica essas escolhas automaticamente em todas as telas.</span></header>
        <div class="guest-editor-color-grid">
          ${colorField("Cor principal", "branding.primary_color", branding.primary_color)}
          ${colorField("Destaque", "branding.accent_color", branding.accent_color)}
          ${colorField("Fundo", "branding.background_color", branding.background_color)}
          ${colorField("Texto", "branding.text_color", branding.text_color)}
        </div>
        ${fontSelectField("Fonte do portal", "branding.font_family", branding.font_family)}
        ${mediaPicker("Fonte personalizada", "branding.font_asset_id", branding.font_asset_id, { fontOnly: true })}
        <p class="guest-editor-help">Envie uma fonte WOFF ou WOFF2 para reproduzir com precisão a identidade da unidade. A fonte personalizada tem prioridade sobre o seletor.</p>
      </section>
      <section class="guest-editor-section">
        <header><strong>Capa principal</strong><span>Use uma imagem ou vídeo para a tela inicial.</span></header>
        ${mediaPicker("Imagem ou vídeo de fundo", "branding.cover_image_url", branding.cover_image_url, { allowVideo: true })}
      </section>`;
  }

  function renderHomePanel() {
    const settings = state.hotel.settings || {};
    return `
      <section class="guest-editor-section">
        <header><strong>Boas-vindas</strong><span>O nome da unidade continua vindo do cadastro oficial.</span></header>
        ${textareaField("Mensagem de apresentação", "settings.hosting.welcome_text", settings["hosting.welcome_text"] || settings["general.short_description"] || "", 180)}
        ${textareaField("Descrição institucional curta", "settings.general.short_description", settings["general.short_description"] || "", 280)}
      </section>
      <section class="guest-editor-section">
        <header><strong>Blog e localização</strong><span>Conteúdos oficiais exibidos nas áreas fixas do portal.</span></header>
        ${textField("Feed público do blog", "settings.portal.blog_feed_url", settings["portal.blog_feed_url"] || "", "url")}
        ${textField("Link Como chegar", "settings.contact.maps_url", settings["contact.maps_url"] || "", "url")}
        ${textareaField("Mapas incorporados", "settings.contact.maps_embed_urls", mapsValue(settings["contact.maps_embed_urls"]), 1200)}
        <p class="guest-editor-help">Informe um endereço HTTPS de incorporação por linha.</p>
      </section>`;
  }

  function renderServicesPanel() {
    return `
      <section class="guest-editor-section">
        <header><strong>Serviços do portal</strong><span>Ative somente as experiências disponíveis nesta unidade.</span></header>
        <div class="guest-editor-service-list">
          ${SERVICE_KEYS.map(renderServiceEditor).join("")}
        </div>
      </section>`;
  }

  function renderServiceEditor(moduleKey) {
    const module = moduleByKey(moduleKey);
    const settingKey = `portal.module.${moduleKey}.description`;
    const description = state.hotel.settings?.[settingKey] || SERVICE_DESCRIPTIONS[moduleKey];
    return `
      <article class="guest-editor-service" data-service-card="${escapeAttr(moduleKey)}">
        <header>
          <div><strong>${escapeHtml(module?.navigation_label || module?.public_name || SERVICE_LABELS[moduleKey])}</strong><small>${escapeHtml(moduleKey)}</small></div>
          <label class="guest-editor-switch" aria-label="Exibir ${escapeAttr(SERVICE_LABELS[moduleKey])}">
            <input type="checkbox" data-editor-path="modules.${escapeAttr(moduleKey)}.enabled" ${module?.enabled && module?.is_public ? "checked" : ""}>
            <span aria-hidden="true"></span>
          </label>
        </header>
        ${textField("Nome público", `modules.${moduleKey}.navigation_label`, module?.navigation_label || module?.public_name || SERVICE_LABELS[moduleKey])}
        ${textareaField("Descrição", `settings.${settingKey}`, description, 240)}
        ${mediaPicker("Imagem do serviço", `modules.${moduleKey}.background_media_asset_id`, module?.settings?.background_media_asset_id || "", { imagesOnly: true })}
      </article>`;
  }

  function renderContentPanel() {
    return `
      <section class="guest-editor-section">
        <header><strong>Conteúdo do template</strong><span>Estas áreas alimentam automaticamente o mesmo portal em desktop e mobile.</span></header>
        <div class="guest-editor-content-links">
          ${contentLink("/admin/portais/eventos/", "calendar", "Eventos", "Agenda, imagens, períodos e botões de ação")}
          ${contentLink(`/admin/portais/unidades/${encodeURIComponent(state.hotel.hotel_id)}/`, "hotel", "Informações do hotel", "Horários, contatos, mapas e dados da hospedagem")}
          ${contentLink("/admin/portais/media/", "image", "Biblioteca de mídia", "Logos, capas, fotos e vídeos da unidade")}
          ${contentLink("/admin/portais/areas/", "services", "Disponibilidade dos serviços", "Ativação e imagens de Room Service, Empório, Spa e pacotes")}
        </div>
      </section>
      <section class="guest-editor-section">
        <header><strong>Estrutura protegida</strong><span>O Portal do Hóspede usa um único template oficial para todas as unidades.</span></header>
        <p class="guest-editor-help">Início, Serviços, Eventos, Hotel e Blog mantêm o mesmo fluxo. A identidade e os conteúdos mudam conforme a unidade selecionada.</p>
      </section>`;
  }

  function renderEmporioPanel() {
    if (state.catalogEditor?.kind === "category") return renderEmporioCategoryForm();
    if (state.catalogEditor?.kind === "product") return renderEmporioProductForm();
    const categories = state.catalog.category_options || [];
    const products = catalogProducts();
    return `
      ${renderEmporioCarouselPanel()}
      <section class="guest-editor-section emporio-editor-overview">
        <header>
          <strong>Catálogo do Empório</strong>
          <span>Cadastre produtos para consulta. Nenhum item pode ser comprado pelo portal.</span>
        </header>
        <div class="emporio-editor-summary">
          <span><strong>${products.length}</strong> produtos</span>
          <span><strong>${categories.length}</strong> categorias</span>
          <span><strong>${products.filter((item) => item.available).length}</strong> disponíveis</span>
        </div>
        <div class="emporio-editor-actions">
          <button type="button" data-emporio-action="new-category">${icon("plus")} Categoria</button>
          <button type="button" data-emporio-action="new-product" ${categories.length ? "" : "disabled"}>${icon("plus")} Produto</button>
        </div>
      </section>
      <section class="guest-editor-section">
        <header><strong>Categorias</strong><span>Organize a navegação pública do catálogo.</span></header>
        <div class="emporio-editor-category-list">
          ${categories.map((category) => `
            <button type="button" data-emporio-action="edit-category" data-id="${escapeAttr(category.id)}">
              <span><strong>${escapeHtml(category.name)}</strong><small>Ordem ${Number(category.sort_order || 0)}</small></span>
              ${icon("edit")}
            </button>`).join("") || '<p class="guest-editor-help">Crie a primeira categoria para começar o catálogo.</p>'}
        </div>
      </section>
      <section class="guest-editor-section">
        <header><strong>Produtos</strong><span>Preço, imagem e disponibilidade exibidos ao hóspede.</span></header>
        <div class="emporio-editor-product-list">
          ${products.map(renderEmporioProductRow).join("") || '<p class="guest-editor-help">Nenhum produto cadastrado.</p>'}
        </div>
      </section>`;
  }

  function renderEmporioCarouselPanel() {
    const slides = emporioCarouselSlides();
    const images = state.media.filter((asset) => String(asset.mime_type || "").startsWith("image/"));
    return `
      <section class="guest-editor-section emporio-carousel-editor">
        <header>
          <strong>Destaques do carrossel</strong>
          <span>${slides.length} de 8 páginas configuradas. A ordem abaixo é a ordem exibida no portal.</span>
        </header>
        <div class="emporio-carousel-editor-list">
          ${slides.map((slide, index) => {
            const selected = mediaByRef(slide.media_asset_id);
            return `
              <article class="emporio-carousel-editor-row" data-emporio-slide-index="${index}">
                <span class="emporio-carousel-editor-preview">${selected ? `<img src="${escapeAttr(selected.public_url)}" alt="">` : icon("image")}</span>
                <div>
                  <label class="guest-editor-field"><span>Título do destaque</span><input data-emporio-carousel-field="title" maxlength="120" value="${escapeAttr(slide.title || "")}" placeholder="Experiência em destaque"></label>
                  <label class="guest-editor-field"><span>Imagem</span><select data-emporio-carousel-field="media_asset_id" required>
                    <option value="">Selecione uma imagem</option>
                    ${images.map((asset) => `<option value="${escapeAttr(asset.id)}" ${asset.id === slide.media_asset_id ? "selected" : ""}>${escapeHtml(asset.original_filename || asset.id)}</option>`).join("")}
                  </select></label>
                  ${hasPermission(state.session, PORTALS_MEDIA_UPLOAD_PERMISSION) ? `<label class="guest-editor-upload is-compact"><input type="file" data-emporio-carousel-upload="${index}" accept="image/jpeg,image/png,image/webp,image/avif"><span>Enviar nova imagem</span></label>` : ""}
                </div>
                <div class="emporio-carousel-editor-actions">
                  <button type="button" data-emporio-action="slide-up" data-index="${index}" ${index === 0 ? "disabled" : ""} aria-label="Mover destaque para cima">↑</button>
                  <button type="button" data-emporio-action="slide-down" data-index="${index}" ${index === slides.length - 1 ? "disabled" : ""} aria-label="Mover destaque para baixo">↓</button>
                  <button type="button" data-emporio-action="remove-slide" data-index="${index}">Remover</button>
                </div>
              </article>`;
          }).join("") || '<p class="guest-editor-help">Sem destaques editoriais. Enquanto esta lista estiver vazia, o portal usa automaticamente as imagens dos produtos.</p>'}
        </div>
        <div class="emporio-editor-form-actions">
          <button type="button" data-emporio-action="add-slide" ${slides.length >= 8 ? "disabled" : ""}>${icon("plus")} Adicionar destaque</button>
          <button class="admin-primary-button" type="button" data-emporio-action="save-carousel">Salvar carrossel</button>
        </div>
        <p class="guest-editor-help" data-emporio-carousel-status aria-live="polite"></p>
      </section>`;
  }

  function renderEmporioProductRow(item) {
    const media = mediaByRef(item.media_asset_id);
    const image = media?.public_url || item.image_url || "";
    return `
      <button type="button" data-emporio-action="edit-product" data-id="${escapeAttr(item.id)}">
        <span class="emporio-editor-thumb">${image ? `<img src="${escapeAttr(image)}" alt="">` : icon("bag")}</span>
        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(formatPrice(item.price_cents, item.currency))} · ${item.available ? "Disponível" : "Indisponível"}</small></span>
        ${icon("edit")}
      </button>`;
  }

  function catalogProducts() {
    return (state.catalog.categories || []).flatMap((category) =>
      (category.items || []).map((item) => ({
        ...item,
        category_id: category.id,
        category_name: category.name,
      })),
    );
  }

  function renderEmporioCategoryForm() {
    const category = state.catalogEditor.value || {};
    return `
      <form class="guest-editor-section emporio-editor-form" data-emporio-form="category" data-id="${escapeAttr(category.id || "")}">
        <header><strong>${category.id ? "Editar categoria" : "Nova categoria"}</strong><span>Use nomes curtos e fáceis de localizar.</span></header>
        ${textField("Nome", "catalog-category-name", category.name || "")}
        ${textareaField("Descrição", "catalog-category-description", category.description || "", 500)}
        <label class="guest-editor-field"><span>Ordem</span><input name="sort_order" type="number" min="0" max="100000" value="${Number(category.sort_order ?? 100)}"></label>
        ${category.id ? `<label class="guest-editor-field"><span>Status</span><select name="status">${statusOptions(category.status)}</select></label>` : ""}
        <div class="emporio-editor-form-actions">
          <button type="button" data-emporio-action="cancel">Cancelar</button>
          <button class="admin-primary-button" type="submit">Salvar categoria</button>
        </div>
        <p class="guest-editor-help" data-emporio-form-status aria-live="polite"></p>
      </form>`;
  }

  function renderEmporioProductForm() {
    const item = state.catalogEditor.value || {};
    const categories = (state.catalog.category_options || []).filter((category) => category.status !== "archived");
    const selectedMedia = item.media_asset_id || "";
    return `
      <form class="guest-editor-section emporio-editor-form" data-emporio-form="product" data-id="${escapeAttr(item.id || "")}">
        <header><strong>${item.id ? "Editar produto" : "Novo produto"}</strong><span>O portal exibirá estes dados como catálogo, sem compra online.</span></header>
        <label class="guest-editor-field"><span>Categoria</span><select name="category_id" required>${categories.map((category) => `<option value="${escapeAttr(category.id)}" ${category.id === item.category_id ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}</select></label>
        <label class="guest-editor-field"><span>Nome</span><input name="name" maxlength="160" value="${escapeAttr(item.name || "")}" required></label>
        <label class="guest-editor-field"><span>Descrição</span><textarea name="description" maxlength="1000">${escapeHtml(item.description || "")}</textarea></label>
        <div class="emporio-editor-form-grid">
          <label class="guest-editor-field"><span>Preço</span><input name="price" inputmode="decimal" placeholder="0,00" value="${escapeAttr(priceInput(item.price_cents))}" required></label>
          <label class="guest-editor-field"><span>Etiqueta</span><input name="tag" maxlength="60" value="${escapeAttr(item.tag || "")}" placeholder="Exclusivo"></label>
          <label class="guest-editor-field"><span>Ordem</span><input name="sort_order" type="number" min="0" max="100000" value="${Number(item.sort_order ?? 100)}"></label>
          <label class="guest-editor-field"><span>Status</span><select name="status">${statusOptions(item.status || "active")}</select></label>
        </div>
        <label class="emporio-editor-availability"><input name="is_available" type="checkbox" ${item.available !== false ? "checked" : ""}><span><strong>Disponível para consulta</strong><small>O hóspede ainda confirmará a disponibilidade com a recepção.</small></span></label>
        <label class="guest-editor-field"><span>Mensagem de disponibilidade</span><input name="availability_label" maxlength="120" value="${escapeAttr(item.availability_label || "")}" placeholder="Disponível na recepção"></label>
        <fieldset class="guest-editor-media">
          <legend>Imagem do produto</legend>
          <div class="guest-editor-media-grid">
            <label class="guest-editor-media-option is-empty"><input type="radio" name="media_asset_id" value="" ${selectedMedia ? "" : "checked"}><span>Sem imagem</span></label>
            ${state.media.filter((asset) => String(asset.mime_type || "").startsWith("image/")).map((asset) => mediaOption("media_asset_id", asset, asset.id === selectedMedia)).join("")}
          </div>
          ${hasPermission(state.session, PORTALS_MEDIA_UPLOAD_PERMISSION) ? `
            <label class="guest-editor-upload"><input type="file" data-emporio-media-upload accept="image/jpeg,image/png,image/webp,image/avif"><span>Enviar imagem do produto</span></label>` : ""}
        </fieldset>
        <div class="emporio-editor-form-actions">
          <button type="button" data-emporio-action="cancel">Cancelar</button>
          <button class="admin-primary-button" type="submit">Salvar produto</button>
        </div>
        <p class="guest-editor-help" data-emporio-form-status aria-live="polite"></p>
      </form>`;
  }

  function mediaPicker(label, path, selectedValue, options = {}) {
    const assets = state.media.filter((asset) => {
      const type = String(asset.mime_type || "");
      if (options.fontOnly) return type === "font/woff" || type === "font/woff2";
      return type.startsWith("image/") || (options.allowVideo && type.startsWith("video/"));
    });
    const selectedAsset = assets.find((asset) => asset.id === selectedValue || asset.public_url === selectedValue);
    return `
      <fieldset class="guest-editor-media">
        <legend>${escapeHtml(label)}</legend>
        <div class="guest-editor-media-grid">
          <label class="guest-editor-media-option is-empty">
            <input type="radio" name="${escapeAttr(path)}" data-editor-path="${escapeAttr(path)}" value="" ${selectedValue ? "" : "checked"}>
            <span>Sem arquivo</span>
          </label>
          ${assets.map((asset) => mediaOption(path, asset, asset.id === selectedAsset?.id)).join("")}
        </div>
        ${hasPermission(state.session, PORTALS_MEDIA_UPLOAD_PERMISSION) ? `
          <label class="guest-editor-upload">
            <input type="file" data-guest-media-upload data-editor-path="${escapeAttr(path)}" data-allow-video="${String(Boolean(options.allowVideo))}" data-font-only="${String(Boolean(options.fontOnly))}" accept="${options.fontOnly ? ".woff,.woff2,font/woff,font/woff2" : options.allowVideo ? "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" : "image/jpeg,image/png,image/webp,image/avif"}">
            <span>Enviar novo arquivo</span>
          </label>` : ""}
      </fieldset>`;
  }

  function mediaOption(path, asset, checked) {
    const mimeType = String(asset.mime_type || "");
    const preview = mimeType.startsWith("video/")
      ? `<video src="${escapeAttr(asset.public_url)}" muted preload="metadata"></video>`
      : mimeType.startsWith("font/")
        ? `<span class="guest-editor-font-preview">Aa</span>`
        : `<img src="${escapeAttr(asset.public_url)}" alt="" loading="lazy">`;
    const value = mediaValueForPath(path, asset);
    return `<label class="guest-editor-media-option" title="${escapeAttr(asset.original_filename || "Mídia")}"><input type="radio" name="${escapeAttr(path)}" data-editor-path="${escapeAttr(path)}" value="${escapeAttr(value)}" ${checked ? "checked" : ""}><span>${preview}</span></label>`;
  }

  function colorField(label, path, value) {
    const color = validColor(value) ? value : "#202124";
    return `<label class="guest-editor-field"><span>${escapeHtml(label)}</span><div class="guest-editor-color"><input type="color" data-editor-path="${escapeAttr(path)}" value="${escapeAttr(color)}"><input type="text" data-editor-path="${escapeAttr(path)}" value="${escapeAttr(color)}" maxlength="7" pattern="#[0-9a-fA-F]{6}"></div></label>`;
  }

  function textField(label, path, value, type = "text") {
    return `<label class="guest-editor-field"><span>${escapeHtml(label)}</span><input type="${escapeAttr(type)}" data-editor-path="${escapeAttr(path)}" value="${escapeAttr(value || "")}"></label>`;
  }

  function fontSelectField(label, path, value) {
    return `
      <label class="guest-editor-field">
        <span>${escapeHtml(label)}</span>
        <select data-editor-path="${escapeAttr(path)}">
          ${portalFontOptions(value).map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>`;
  }

  function textareaField(label, path, value, maxLength) {
    return `<label class="guest-editor-field"><span>${escapeHtml(label)}</span><textarea data-editor-path="${escapeAttr(path)}" maxlength="${Number(maxLength)}">${escapeHtml(value || "")}</textarea></label>`;
  }

  function contentLink(href, iconName, title, text) {
    return `<a href="${escapeAttr(href)}"><span>${icon(iconName)}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(text)}</small></div><b aria-hidden="true">›</b></a>`;
  }

  function handleClick(event) {
    const tab = event.target.closest("[data-guest-editor-tab]");
    if (tab) {
      state.activeTab = tab.dataset.guestEditorTab;
      state.catalogEditor = null;
      renderPanel();
      return;
    }
    const emporioAction = event.target.closest("[data-emporio-action]");
    if (emporioAction) {
      handleEmporioAction(emporioAction);
      return;
    }
    const device = event.target.closest("[data-guest-device]");
    if (device) {
      state.device = device.dataset.guestDevice;
      for (const button of els.root.querySelectorAll("[data-guest-device]")) {
        button.setAttribute("aria-pressed", String(button === device));
      }
      els.previewFrame.classList.toggle("is-mobile", state.device === "mobile");
      els.previewFrame.classList.toggle("is-desktop", state.device === "desktop");
    }
  }

  function handleInput(event) {
    const carouselField = event.target.closest("[data-emporio-carousel-field]");
    if (carouselField) {
      updateEmporioCarouselField(carouselField);
      return;
    }
    const control = event.target.closest("[data-editor-path]");
    if (!control || control.type === "file" || control.type === "radio" || control.type === "checkbox") return;
    if (control.closest("[data-emporio-form]")) return;
    setPath(control.dataset.editorPath, control.value);
    if (control.type === "color") syncColorPair(control);
    markDirty();
  }

  function handleChange(event) {
    const carouselUpload = event.target.closest("[data-emporio-carousel-upload]");
    if (carouselUpload) {
      uploadEmporioCarouselMedia(carouselUpload);
      return;
    }
    const carouselField = event.target.closest("[data-emporio-carousel-field]");
    if (carouselField) {
      updateEmporioCarouselField(carouselField);
      renderPanel();
      return;
    }
    const emporioUpload = event.target.closest("[data-emporio-media-upload]");
    if (emporioUpload) {
      uploadEmporioMedia(emporioUpload);
      return;
    }
    const upload = event.target.closest("[data-guest-media-upload]");
    if (upload) {
      uploadMedia(upload);
      return;
    }
    const control = event.target.closest("[data-editor-path]");
    if (!control || control.type === "file") return;
    if (control.closest("[data-emporio-form]")) return;
    setPath(control.dataset.editorPath, control.type === "checkbox" ? control.checked : control.value);
    if (control.matches('input[type="text"][pattern]')) syncColorPair(control);
    markDirty();
  }

  async function handleSubmit(event) {
    const form = event.target.closest("[data-emporio-form]");
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const status = form.querySelector("[data-emporio-form-status]");
    const data = new FormData(form);
    const kind = form.dataset.emporioForm;
    const id = form.dataset.id;
    submit.disabled = true;
    status.textContent = "Salvando...";
    try {
      if (kind === "category") {
        const current = state.catalogEditor?.value || {};
        const body = {
          hotel_id: state.hotel.hotel_id,
          name: fieldValue(form, "catalog-category-name"),
          description: fieldValue(form, "catalog-category-description"),
          sort_order: Number(data.get("sort_order") || 100),
          ...(id ? { status: data.get("status") || current.status || "active" } : {}),
        };
        await adminApi(
          id
            ? `/api/v1/admin/emporio/catalog/categories/${encodeURIComponent(id)}`
            : "/api/v1/admin/emporio/catalog/categories",
          { method: id ? "PATCH" : "POST", body },
        );
      } else {
        const body = {
          hotel_id: state.hotel.hotel_id,
          category_id: data.get("category_id"),
          name: data.get("name"),
          description: data.get("description"),
          tag: data.get("tag"),
          price_cents: parsePrice(data.get("price")),
          currency: state.hotel.currency || "BRL",
          status: data.get("status") || "active",
          sort_order: Number(data.get("sort_order") || 100),
          is_available: data.get("is_available") === "on",
          availability_label: data.get("availability_label"),
          media_asset_id: data.get("media_asset_id") || "",
        };
        await adminApi(
          id
            ? `/api/v1/admin/emporio/catalog/items/${encodeURIComponent(id)}`
            : "/api/v1/admin/emporio/catalog/items",
          { method: id ? "PATCH" : "POST", body },
        );
      }
      state.catalogEditor = null;
      await loadEmporioCatalog();
      setStatus("Catálogo do Empório atualizado.", "success");
    } catch (error) {
      status.textContent = error.message || "Não foi possível salvar.";
      submit.disabled = false;
    }
  }

  function handleEmporioAction(button) {
    const action = button.dataset.emporioAction;
    if (action === "add-slide") {
      const slides = emporioCarouselSlides();
      if (slides.length < 8) slides.push({ title: "", media_asset_id: "" });
      renderPanel();
      return;
    }
    if (["slide-up", "slide-down", "remove-slide"].includes(action)) {
      const slides = emporioCarouselSlides();
      const index = Number(button.dataset.index);
      if (action === "remove-slide") {
        slides.splice(index, 1);
      } else {
        const target = action === "slide-up" ? index - 1 : index + 1;
        if (target >= 0 && target < slides.length) {
          [slides[index], slides[target]] = [slides[target], slides[index]];
        }
      }
      renderPanel();
      return;
    }
    if (action === "save-carousel") {
      saveEmporioCarousel();
      return;
    }
    if (action === "cancel") {
      state.catalogEditor = null;
      renderPanel();
      return;
    }
    if (action === "new-category") {
      state.catalogEditor = { kind: "category", value: {} };
    } else if (action === "edit-category") {
      state.catalogEditor = {
        kind: "category",
        value: structuredClone((state.catalog.category_options || []).find((entry) => entry.id === button.dataset.id) || {}),
      };
    } else if (action === "new-product") {
      state.catalogEditor = {
        kind: "product",
        value: { category_id: state.catalog.category_options?.[0]?.id || "", available: true, status: "active" },
      };
    } else if (action === "edit-product") {
      state.catalogEditor = {
        kind: "product",
        value: structuredClone(catalogProducts().find((entry) => entry.id === button.dataset.id) || {}),
      };
    }
    renderPanel();
  }

  async function loadEmporioCatalog() {
    const payload = await adminApi(`/api/v1/admin/emporio/catalog?hotel_id=${encodeURIComponent(state.hotel.hotel_id)}`);
    state.catalog = structuredClone(payload.data || { categories: [], category_options: [] });
    renderPanel();
  }

  async function uploadEmporioMedia(input) {
    const file = input.files?.[0];
    const formElement = input.closest("[data-emporio-form]");
    if (!file || !formElement) return;
    captureProductDraft(formElement);
    input.disabled = true;
    setStatus("Enviando imagem...");
    const form = new FormData();
    form.set("hotel_id", state.hotel.hotel_id);
    form.set("module_key", MODULE_KEY_FOR_CATALOG);
    form.set("file", file);
    try {
      const payload = await adminApi("/api/v1/admin/media", { method: "POST", body: form });
      const asset = payload.data.asset;
      state.media = [asset, ...state.media.filter((entry) => entry.id !== asset.id)];
      state.catalogEditor.value.media_asset_id = asset.id;
      renderPanel();
      setStatus("Imagem enviada e selecionada.", "success");
    } catch (error) {
      setStatus(error.message || "Não foi possível enviar a imagem.", "error");
    }
  }

  async function uploadEmporioCarouselMedia(input) {
    const file = input.files?.[0];
    const index = Number(input.dataset.emporioCarouselUpload);
    if (!file || !Number.isInteger(index)) return;
    input.disabled = true;
    const status = els.panel.querySelector("[data-emporio-carousel-status]");
    if (status) status.textContent = "Enviando imagem...";
    const form = new FormData();
    form.set("hotel_id", state.hotel.hotel_id);
    form.set("module_key", MODULE_KEY_FOR_CATALOG);
    form.set("file", file);
    try {
      const payload = await adminApi("/api/v1/admin/media", { method: "POST", body: form });
      const asset = payload.data.asset;
      state.media = [asset, ...state.media.filter((entry) => entry.id !== asset.id)];
      const slide = emporioCarouselSlides()[index];
      if (slide) slide.media_asset_id = asset.id;
      renderPanel();
      setStatus("Imagem enviada e selecionada.", "success");
    } catch (error) {
      if (status) status.textContent = error.message || "Não foi possível enviar a imagem.";
      input.disabled = false;
    }
  }

  function updateEmporioCarouselField(control) {
    const row = control.closest("[data-emporio-slide-index]");
    const slide = emporioCarouselSlides()[Number(row?.dataset.emporioSlideIndex)];
    if (slide) slide[control.dataset.emporioCarouselField] = control.value;
  }

  function emporioCarouselSlides() {
    const current = state.hotel?.settings?.["emporio.carousel_slides"];
    if (Array.isArray(current)) return current;
    state.hotel.settings["emporio.carousel_slides"] = [];
    return state.hotel.settings["emporio.carousel_slides"];
  }

  async function saveEmporioCarousel() {
    const status = els.panel.querySelector("[data-emporio-carousel-status]");
    const slides = emporioCarouselSlides().map((slide) => ({
      title: String(slide.title || "").trim(),
      media_asset_id: String(slide.media_asset_id || "").trim(),
    }));
    if (slides.some((slide) => !slide.media_asset_id)) {
      if (status) status.textContent = "Selecione uma imagem para cada destaque.";
      return;
    }
    if (status) status.textContent = "Salvando carrossel...";
    try {
      const payload = await adminApi(`/api/v1/admin/hotels/${encodeURIComponent(state.hotel.hotel_id)}/settings`, {
        method: "PATCH",
        body: { "emporio.carousel_slides": slides },
      });
      state.hotel.settings = structuredClone(payload.data.settings || state.hotel.settings);
      renderPanel();
      setStatus("Carrossel do Empório atualizado.", "success");
    } catch (error) {
      if (status) status.textContent = error.message || "Não foi possível salvar o carrossel.";
    }
  }

  function captureProductDraft(form) {
    const data = new FormData(form);
    state.catalogEditor.value = {
      ...state.catalogEditor.value,
      category_id: data.get("category_id"),
      name: data.get("name"),
      description: data.get("description"),
      tag: data.get("tag"),
      price_cents: safeParsePrice(data.get("price")),
      status: data.get("status"),
      sort_order: Number(data.get("sort_order") || 100),
      available: data.get("is_available") === "on",
      availability_label: data.get("availability_label"),
      media_asset_id: data.get("media_asset_id") || "",
    };
  }

  function syncColorPair(control) {
    const path = control.dataset.editorPath;
    const color = validColor(control.value) ? control.value : null;
    if (!color) return;
    for (const peer of els.panel.querySelectorAll(`[data-editor-path="${CSS.escape(path)}"]`)) {
      if (peer !== control) peer.value = color;
    }
  }

  async function uploadMedia(input) {
    const file = input.files?.[0];
    if (!file || !state.hotel) return;
    const path = input.dataset.editorPath;
    input.disabled = true;
    setStatus("Enviando mídia...");
    const form = new FormData();
    form.set("hotel_id", state.hotel.hotel_id);
    form.set("module_key", "guest-portal");
    form.set("file", file);
    try {
      const payload = await adminApi("/api/v1/admin/media", { method: "POST", body: form });
      const asset = payload.data.asset;
      state.media = [asset, ...state.media.filter((item) => item.id !== asset.id)];
      setPath(path, mediaValueForPath(path, asset));
      markDirty();
      renderPanel();
      setStatus("Arquivo enviado. Salve para aplicar ao portal.", "dirty");
    } catch (error) {
      setStatus(error.message || "Não foi possível enviar o arquivo.", "error");
    } finally {
      input.disabled = false;
      input.value = "";
    }
  }

  function setPath(path, value) {
    const [scope, key, field] = path.split(".");
    if (scope === "branding") {
      state.hotel.branding[key] = value;
      return;
    }
    if (scope === "settings") {
      const settingKey = path.slice("settings.".length);
      state.hotel.settings[settingKey] = settingKey === "contact.maps_embed_urls" ? parseMaps(value) : value;
      return;
    }
    if (scope === "modules") {
      const module = ensureModule(key);
      if (field === "enabled") {
        module.enabled = Boolean(value);
        module.is_public = Boolean(value);
      } else if (field === "background_media_asset_id") {
        module.settings = { ...(module.settings || {}), background_media_asset_id: value || null };
      } else {
        module[field] = value;
      }
    }
  }

  function markDirty() {
    state.dirty = true;
    setStatus("Alterações ainda não salvas.", "dirty");
    postPreview();
  }

  function postPreview() {
    if (!state.loaded || !els.preview.contentWindow) return;
    els.preview.contentWindow.postMessage({
      type: "fioreze:guest-portal-preview",
      payload: {
        branding: previewBranding(),
        settings: structuredClone(state.hotel.settings || {}),
        modules: previewModules(),
      },
    }, window.location.origin);
  }

  function previewBranding() {
    const branding = structuredClone(state.hotel.branding || {});
    for (const field of ["logo_url", "horizontal_logo_url", "icon_url", "cover_image_url"]) {
      branding[field] = mediaUrl(branding[field]) || branding[field] || null;
    }
    const cover = mediaByRef(state.hotel.branding?.cover_image_url);
    if (cover) branding.cover_media_type = String(cover.mime_type || "").startsWith("video/") ? "video" : "image";
    return branding;
  }

  function previewModules() {
    return state.modules.map((module) => {
      const background = mediaByRef(module.settings?.background_media_asset_id);
      return {
        ...structuredClone(module),
        background_image_url: background?.public_url || module.background_image_url || null,
      };
    });
  }

  async function save() {
    if (!state.loaded || state.saving || !canSave()) return;
    state.saving = true;
    els.save.disabled = true;
    setStatus("Salvando portal...");
    try {
      const branding = state.hotel.branding || {};
      const settings = state.hotel.settings || {};
      await Promise.all([
        adminApi(`/api/v1/admin/hotels/${encodeURIComponent(state.hotel.hotel_id)}/branding`, {
          method: "PATCH",
          body: {
            logo_url: branding.logo_url || "",
            horizontal_logo_url: branding.horizontal_logo_url || "",
            icon_url: branding.icon_url || "",
            cover_image_url: branding.cover_image_url || "",
            primary_color: branding.primary_color,
            accent_color: branding.accent_color,
            background_color: branding.background_color,
            text_color: branding.text_color,
            font_family: branding.font_family,
            font_asset_id: branding.font_asset_id || "",
          },
        }),
        adminApi(`/api/v1/admin/hotels/${encodeURIComponent(state.hotel.hotel_id)}/settings`, {
          method: "PATCH",
          body: editableSettings(settings),
        }),
        adminApi(`/api/v1/admin/hotels/${encodeURIComponent(state.hotel.hotel_id)}/modules`, {
          method: "PATCH",
          body: { modules: SERVICE_KEYS.map(modulePayload) },
        }),
      ]);
      state.dirty = false;
      setStatus("Portal atualizado.", "success");
      await load();
    } catch (error) {
      setStatus(error.message || "Não foi possível salvar o portal.", "error");
    } finally {
      state.saving = false;
      syncSaveAccess();
    }
  }

  function editableSettings(settings) {
    const keys = [
      "hosting.welcome_text",
      "general.short_description",
      "portal.blog_feed_url",
      "contact.maps_url",
      "contact.maps_embed_urls",
      "emporio.carousel_slides",
      ...SERVICE_KEYS.map((key) => `portal.module.${key}.description`),
    ];
    return Object.fromEntries(keys.map((key) => [
      key,
      settings[key] ?? (["contact.maps_embed_urls", "emporio.carousel_slides"].includes(key) ? [] : ""),
    ]));
  }

  function modulePayload(moduleKey) {
    const module = ensureModule(moduleKey);
    return {
      module_key: moduleKey,
      enabled: Boolean(module.enabled),
      is_public: Boolean(module.enabled),
      public_name: module.public_name || SERVICE_LABELS[moduleKey],
      navigation_label: module.navigation_label || SERVICE_LABELS[moduleKey],
      sort_order: Number(module.sort_order || SERVICE_KEYS.indexOf(moduleKey) * 10 + 20),
      background_media_asset_id: module.settings?.background_media_asset_id || "",
    };
  }

  function moduleByKey(moduleKey) {
    return state.modules.find((module) => module.module_key === moduleKey) || null;
  }

  function ensureModule(moduleKey) {
    let module = moduleByKey(moduleKey);
    if (module) return module;
    module = {
      module_key: moduleKey,
      enabled: false,
      is_public: false,
      public_name: SERVICE_LABELS[moduleKey],
      navigation_label: SERVICE_LABELS[moduleKey],
      sort_order: SERVICE_KEYS.indexOf(moduleKey) * 10 + 20,
      settings: {},
    };
    state.modules.push(module);
    return module;
  }

  function canSave() {
    return [
      PORTALS_HOTELS_BRANDING_PERMISSION,
      PORTALS_HOTELS_SETTINGS_PERMISSION,
      PORTALS_HOTELS_MODULES_PERMISSION,
    ].every((permission) => hasPermission(state.session, permission));
  }

  function syncSaveAccess() {
    els.save.disabled = state.saving || !canSave();
    if (!canSave()) els.save.title = "Seu perfil precisa de permissão para identidade, conteúdo e módulos.";
    else els.save.removeAttribute("title");
  }

  function syncEditorChrome() {
    const catalogMode = state.activeTab === "emporio";
    els.save.hidden = catalogMode;
    els.publicLink.href = catalogMode ? `${publicPortalUrl()}/emporio` : publicPortalUrl();
    els.publicLinkLabel.textContent = catalogMode ? "Abrir Empório" : "Abrir portal";
    const nextPreview = catalogMode ? `${publicPortalUrl()}/emporio?admin_preview=1` : `${publicPortalUrl()}?admin_preview=1`;
    if (els.preview.getAttribute("src") !== nextPreview) els.preview.src = nextPreview;
    els.previewName.textContent = catalogMode ? "Empório" : state.hotel.short_name || state.hotel.name;
  }

  function setStatus(message, kind = "") {
    els.status.textContent = message;
    els.status.className = kind ? `is-${kind}` : "";
  }

  function publicPortalUrl() {
    return `${window.location.origin}/${encodeURIComponent(state.hotel.slug)}`;
  }

  function mediaByRef(value) {
    return state.media.find((asset) => asset.id === value || asset.public_url === value) || null;
  }

  function mediaUrl(value) {
    return mediaByRef(value)?.public_url || "";
  }

  return { open, refresh, dismiss };
}

function mapsValue(value) {
  if (Array.isArray(value)) return value.join("\n");
  return String(value || "");
}

function parseMaps(value) {
  return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 6);
}

function validColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function mediaValueForPath(path, asset) {
  if (String(path || "").endsWith(".font_asset_id")) return asset.id;
  return String(path || "").startsWith("branding.") ? asset.public_url : asset.id;
}

const MODULE_KEY_FOR_CATALOG = "emporio";

function statusOptions(selected) {
  return [
    ["active", "Ativo"],
    ["inactive", "Inativo"],
    ["archived", "Arquivado"],
  ].map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
}

function priceInput(cents) {
  if (cents == null || cents === "") return "";
  return (Number(cents) / 100).toFixed(2).replace(".", ",");
}

function parsePrice(value) {
  const normalized = String(value || "").trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isInteger(cents) || cents < 0) throw new Error("Informe um preço válido.");
  return cents;
}

function safeParsePrice(value) {
  try {
    return parsePrice(value);
  } catch {
    return 0;
  }
}

function formatPrice(cents, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(Number(cents || 0) / 100);
}

function fieldValue(form, name) {
  return form.querySelector(`[data-editor-path="${CSS.escape(name)}"]`)?.value || "";
}

function icon(name) {
  const paths = {
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    hotel: '<path d="M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 20"/>',
    services: '<path d="M5 14h14M7 14a5 5 0 0 1 10 0M12 7V5M4 18h16"/><path d="M10 5h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.image}</svg>`;
}
