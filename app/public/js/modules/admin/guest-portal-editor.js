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
import { createSpecialDecorationsEditor } from "./special-decorations-editor.js";

const SERVICE_KEYS = ["room-service", "emporio", "romantic-packages", "spa"];
const SERVICE_LABELS = {
  "room-service": "Room Service",
  emporio: "Empório",
  "romantic-packages": "Decorações especiais",
  spa: "Spa",
};
const SERVICE_DESCRIPTIONS = {
  "room-service": "Refeições e bebidas no conforto da acomodação.",
  emporio: "Produtos selecionados, presentes e lembranças.",
  "romantic-packages": "Decorações e experiências para momentos especiais.",
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
    emporioCatalogDialog: root.querySelector("#emporioCatalogDialog"),
    specialDecorationsDialog: root.querySelector("#specialDecorationsDialog"),
    spaCatalogDialog: root.querySelector("#spaCatalogDialog"),
  };
  const state = {
    session: null,
    hotel: null,
    modules: [],
    media: [],
    catalog: { categories: [], category_options: [] },
    catalogEditor: null,
    spaCatalog: { profile: null, services: [] },
    spaEditor: null,
    activeTab: "identity",
    device: "desktop",
    dirty: false,
    saving: false,
    loaded: false,
  };
  let bound = false;
  const specialDecorationsEditor = createSpecialDecorationsEditor({
    dialog: els.specialDecorationsDialog,
    getHotel: () => state.hotel,
    getMedia: () => state.media,
    getSession: () => state.session,
    onMediaAdded: (asset) => {
      state.media = [asset, ...state.media.filter((entry) => entry.id !== asset.id)];
    },
    onStatus: setStatus,
  });

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
    for (const dialog of [els.emporioCatalogDialog, els.spaCatalogDialog]) {
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        closeCatalogEditor(dialog);
      });
    }
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
      closeCatalogEditor(els.emporioCatalogDialog);
      closeCatalogEditor(els.spaCatalogDialog);
      const requests = [
        adminApi(`/api/v1/admin/hotels/${encodeURIComponent(hotelId)}`),
        adminApi(`/api/v1/admin/hotels/${encodeURIComponent(hotelId)}/modules`),
      ];
      if (hasPermission(state.session, PORTALS_MEDIA_READ_PERMISSION)) {
        requests.push(adminApi(`/api/v1/admin/media?hotel_id=${encodeURIComponent(hotelId)}&status=active`));
      }
      const [hotelPayload, modulesPayload, mediaPayload] = await Promise.all(requests);
      state.hotel = structuredClone(hotelPayload.data.hotel);
      state.modules = structuredClone(modulesPayload.data.modules || []);
      state.catalog = { categories: [], category_options: [] };
      state.spaCatalog = { profile: null, services: [] };
      state.media = mediaPayload?.data?.assets || [];
      state.catalogEditor = null;
      state.spaEditor = null;
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
    else if (state.activeTab === "decorations") els.panel.innerHTML = renderDecorationsPanel();
    else if (state.activeTab === "spa") els.panel.innerHTML = renderSpaPanel();
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
        <header><strong>Menu lateral</strong><span>Escolha o contraste da navegação exibida no celular.</span></header>
        ${choiceSelectField(
          "Fundo do menu",
          "settings.portal.navigation_drawer_theme",
          state.hotel.settings?.["portal.navigation_drawer_theme"] || "light",
          [
            ["light", "Branco"],
            ["dark", "Preto"],
          ],
        )}
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
          ${contentLink("/admin/portais/eventos/", "calendar", "Programação", "Agenda, imagens, períodos e botões de ação")}
          ${contentLink(`/admin/portais/unidades/${encodeURIComponent(state.hotel.hotel_id)}/`, "hotel", "Informações do hotel", "Horários, contatos, mapas e dados da hospedagem")}
          ${contentLink("/admin/portais/media/", "image", "Biblioteca de mídia", "Logos, capas, fotos e vídeos da unidade")}
          ${contentLink("/admin/portais/areas/", "services", "Disponibilidade dos serviços", "Ativação e imagens de Room Service, Empório, Spa e pacotes")}
        </div>
      </section>
      <section class="guest-editor-section">
        <header><strong>Estrutura protegida</strong><span>O Portal do Hóspede usa um único template oficial para todas as unidades.</span></header>
        <p class="guest-editor-help">Início, Serviços, Programação, Hotel e Blog mantêm o mesmo fluxo. A identidade e os conteúdos mudam conforme a unidade selecionada.</p>
      </section>`;
  }

  function renderDecorationsPanel() {
    const module = moduleByKey("romantic-packages");
    return `
      <section class="guest-editor-section">
        <header>
          <strong>Decorações Especiais</strong>
          <span>Gerencie categorias, experiências, adicionais, preços, textos e fotos desta unidade.</span>
        </header>
        <div class="guest-editor-special-decorations-card">
          <span>${icon("sparkle")}</span>
          <div>
            <strong>${escapeHtml(module?.navigation_label || "Decorações Especiais")}</strong>
            <small>O editor abre em uma janela ampla para você trabalhar com mais espaço.</small>
          </div>
          <button class="admin-primary-button" type="button" data-special-decorations-open>Abrir editor</button>
        </div>
      </section>
      <section class="guest-editor-section">
        <header><strong>Publicação por unidade</strong><span>O catálogo exibido depende sempre da unidade selecionada acima.</span></header>
        <p class="guest-editor-help">Fotos enviadas por aqui ficam na Biblioteca de Mídia desta unidade e podem ser trocadas a qualquer momento.</p>
      </section>`;
  }

  function renderSpaPanel() {
    return renderCatalogLauncher({
      key: "spa",
      title: "Spa",
      description: "Gerencie informações, atendimento, serviços, duração, valores e fotos do catálogo compartilhado.",
      note: "O Spa usa um catálogo compartilhado entre as unidades em que o módulo estiver habilitado.",
      iconName: "spa",
    });
  }

  function renderSpaWorkspace() {
    if (state.spaEditor?.kind === "service") return renderSpaServiceForm();
    const profile = state.spaCatalog.profile || {};
    const services = state.spaCatalog.services || [];
    const rules = Array.isArray(profile.usage_rules) ? profile.usage_rules.join("\n") : "";
    return `
      <form class="guest-editor-section spa-editor-form" data-spa-form="profile">
        <header>
          <strong>Identidade e atendimento do Spa</strong>
          <span>Conteúdo compartilhado entre todas as unidades com o módulo Spa habilitado.</span>
        </header>
        <div class="spa-editor-shared-note">${icon("info")}<span>Uma alteração aqui atualiza o catálogo do Spa em todos os hotéis.</span></div>
        <div class="spa-editor-profile-grid">
          <label class="guest-editor-field"><span>Nome do Spa</span><input name="title" maxlength="120" required value="${escapeAttr(profile.title || "")}"></label>
          <label class="guest-editor-field"><span>Frase principal</span><input name="subtitle" maxlength="240" required value="${escapeAttr(profile.subtitle || "")}"></label>
        </div>
        <label class="guest-editor-field"><span>Apresentação curta</span><textarea name="intro_text" maxlength="500" required>${escapeHtml(profile.intro_text || "")}</textarea></label>
        <label class="guest-editor-field"><span>Quem Somos</span><textarea name="about_text" maxlength="4000" required>${escapeHtml(profile.about_text || "")}</textarea></label>
        <div class="spa-editor-profile-grid">
          <label class="guest-editor-field"><span>Título do agendamento</span><input name="booking_title" maxlength="120" required value="${escapeAttr(profile.booking_title || "")}"></label>
          <label class="guest-editor-field"><span>Horário exibido</span><input name="hours_text" maxlength="120" required value="${escapeAttr(profile.hours_text || "")}"></label>
        </div>
        <label class="guest-editor-field"><span>Orientação de agendamento</span><textarea name="booking_text" maxlength="500" required>${escapeHtml(profile.booking_text || "")}</textarea></label>
        <label class="guest-editor-field"><span>WhatsApp</span><input name="whatsapp_number" inputmode="numeric" maxlength="20" required value="${escapeAttr(profile.whatsapp_number || "")}"></label>
        <label class="guest-editor-field"><span>Mensagem com serviço selecionado</span><textarea name="whatsapp_service_message" maxlength="800" required>${escapeHtml(profile.whatsapp_service_message || "")}</textarea></label>
        <label class="guest-editor-field"><span>Mensagem para contato geral</span><textarea name="whatsapp_general_message" maxlength="800" required>${escapeHtml(profile.whatsapp_general_message || "")}</textarea></label>
        <p class="guest-editor-help">Use <strong>{hotel_name}</strong> e <strong>{service_name}</strong> para preencher a mensagem automaticamente.</p>
        <label class="guest-editor-field"><span>Regras de utilização</span><textarea name="usage_rules" rows="9" required>${escapeHtml(rules)}</textarea></label>
        ${spaMediaSelect("Logo do Spa", "logo_media_asset_id", profile.logo_media_asset_id, profile.logo_url)}
        <div class="emporio-editor-form-actions">
          <button class="admin-primary-button" type="submit">Salvar informações do Spa</button>
        </div>
        <p class="guest-editor-help" data-spa-form-status aria-live="polite"></p>
      </form>
      <section class="guest-editor-section emporio-editor-overview">
        <header>
          <strong>Serviços do Spa</strong>
          <span>Massagens, rituais, duração, valores e imagens do catálogo público.</span>
        </header>
        <div class="emporio-editor-summary">
          <span><strong>${services.filter((item) => item.status === "active").length}</strong> ativos</span>
          <span><strong>${services.length}</strong> cadastrados</span>
        </div>
        <div class="emporio-editor-actions">
          <button type="button" data-spa-action="new-service">${icon("plus")} Novo serviço</button>
        </div>
      </section>
      <section class="guest-editor-section">
        <header><strong>Catálogo compartilhado</strong><span>Selecione um serviço para editar.</span></header>
        <div class="emporio-editor-product-list">
          ${services.map(renderSpaServiceRow).join("") || '<p class="guest-editor-help">Nenhum serviço cadastrado.</p>'}
        </div>
      </section>`;
  }

  function renderSpaServiceRow(service) {
    const image = service.image_url || "";
    return `
      <button type="button" data-spa-action="edit-service" data-id="${escapeAttr(service.id)}">
        <span class="emporio-editor-thumb">${image ? `<img src="${escapeAttr(image)}" alt="">` : icon("spa")}</span>
        <span><strong>${escapeHtml(service.name)}</strong><small>${escapeHtml(formatPrice(service.price_cents, service.currency))} · ${escapeHtml(service.duration_label || "Sem duração")} · ${spaStatusLabel(service.status)}</small></span>
        ${icon("edit")}
      </button>`;
  }

  function renderSpaServiceForm() {
    const service = state.spaEditor?.value || {};
    return `
      <form class="guest-editor-section emporio-editor-form spa-editor-form" data-spa-form="service" data-id="${escapeAttr(service.id || "")}">
        <header>
          <strong>${service.id ? "Editar serviço" : "Novo serviço"}</strong>
          <span>As alterações serão publicadas para todas as unidades com Spa ativo.</span>
        </header>
        <label class="guest-editor-field"><span>Nome</span><input name="name" maxlength="160" required value="${escapeAttr(service.name || "")}"></label>
        <label class="guest-editor-field"><span>Descrição</span><textarea name="description" maxlength="3000" required>${escapeHtml(service.description || "")}</textarea></label>
        <div class="spa-editor-profile-grid">
          <label class="guest-editor-field"><span>Duração exibida</span><input name="duration_label" maxlength="80" required value="${escapeAttr(service.duration_label || "")}" placeholder="50 minutos"></label>
          <label class="guest-editor-field"><span>Duração em minutos</span><input name="duration_minutes" type="number" min="1" max="1440" value="${escapeAttr(service.duration_minutes || "")}"></label>
          <label class="guest-editor-field"><span>Preço</span><input name="price" inputmode="decimal" required value="${escapeAttr(priceInput(service.price_cents))}" placeholder="0,00"></label>
          <label class="guest-editor-field"><span>Ordem</span><input name="sort_order" type="number" min="0" max="100000" value="${Number(service.sort_order ?? 100)}"></label>
        </div>
        <label class="guest-editor-field"><span>Status</span><select name="status">${statusOptions(service.status || "active")}</select></label>
        ${spaMediaSelect("Imagem do serviço", "media_asset_id", service.media_asset_id, service.image_url)}
        <div class="emporio-editor-form-actions">
          <button type="button" data-spa-action="cancel">Cancelar</button>
          <button class="admin-primary-button" type="submit">Salvar serviço</button>
        </div>
        <p class="guest-editor-help" data-spa-form-status aria-live="polite"></p>
      </form>`;
  }

  function spaMediaSelect(label, name, selectedId, selectedUrl) {
    const images = state.media.filter((asset) => String(asset.mime_type || "").startsWith("image/"));
    const currentIncluded = selectedId && images.some((asset) => asset.id === selectedId);
    return `
      <label class="guest-editor-field">
        <span>${escapeHtml(label)}</span>
        <select name="${escapeAttr(name)}">
          <option value="">Sem imagem</option>
          ${selectedId && !currentIncluded ? `<option value="${escapeAttr(selectedId)}" selected>Imagem compartilhada atual</option>` : ""}
          ${images.map((asset) => `<option value="${escapeAttr(asset.id)}" ${asset.id === selectedId ? "selected" : ""}>${escapeHtml(asset.original_filename || asset.id)}</option>`).join("")}
        </select>
      </label>
      ${selectedUrl ? `<span class="spa-editor-current-media"><img src="${escapeAttr(selectedUrl)}" alt=""></span>` : ""}
      ${hasPermission(state.session, PORTALS_MEDIA_UPLOAD_PERMISSION) ? `<label class="guest-editor-upload"><input type="file" data-spa-media-upload data-spa-media-target="${escapeAttr(name)}" accept="image/jpeg,image/png,image/webp,image/avif"><span>Enviar nova imagem</span></label>` : ""}`;
  }

  function renderEmporioPanel() {
    return renderCatalogLauncher({
      key: "emporio",
      title: "Empório",
      description: "Gerencie carrossel, categorias, produtos, valores, disponibilidade e fotos desta unidade.",
      note: "O catálogo publicado depende sempre da unidade selecionada acima.",
      iconName: "bag",
    });
  }

  function renderEmporioWorkspace() {
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

  function renderCatalogLauncher({ key, title, description, note, iconName }) {
    const module = moduleByKey(key);
    return `
      <section class="guest-editor-section">
        <header>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(description)}</span>
        </header>
        <div class="guest-editor-special-decorations-card">
          <span>${icon(iconName)}</span>
          <div>
            <strong>${escapeHtml(module?.navigation_label || title)}</strong>
            <small>O editor abre em uma janela ampla para você trabalhar com mais espaço.</small>
          </div>
          <button class="admin-primary-button" type="button" data-catalog-editor-open="${escapeAttr(key)}">Abrir editor</button>
        </div>
      </section>
      <section class="guest-editor-section">
        <header><strong>Publicação e acesso</strong><span>${escapeHtml(note)}</span></header>
        <p class="guest-editor-help">Todos os usuários autorizados para esta área e para a unidade selecionada usam o mesmo editor.</p>
      </section>`;
  }

  async function openCatalogEditor(kind) {
    const dialog = catalogDialog(kind);
    if (!dialog || !state.hotel) return;
    if (!dialog.open) dialog.showModal();
    renderCatalogLoading(kind);
    try {
      if (kind === "emporio") await loadEmporioCatalog({ render: false });
      else await loadSpaCatalog({ render: false });
      renderCatalogDialog(kind);
    } catch (error) {
      renderCatalogError(kind, error.message || "Não foi possível carregar o catálogo.");
    }
  }

  function closeCatalogEditor(dialog) {
    if (dialog?.open) dialog.close();
    state.catalogEditor = null;
    state.spaEditor = null;
  }

  function catalogDialog(kind) {
    return kind === "emporio" ? els.emporioCatalogDialog : els.spaCatalogDialog;
  }

  function renderCatalogLoading(kind) {
    const dialog = catalogDialog(kind);
    dialog.innerHTML = `
      <section class="portal-catalog-editor">
        ${renderCatalogToolbar(kind)}
        <div class="special-decorations-loading"><span aria-hidden="true"></span><p>Preparando o catálogo...</p></div>
      </section>`;
  }

  function renderCatalogError(kind, message) {
    const dialog = catalogDialog(kind);
    dialog.innerHTML = `
      <section class="portal-catalog-editor">
        ${renderCatalogToolbar(kind)}
        <div class="special-decorations-empty">
          <strong>Catálogo indisponível</strong>
          <span>${escapeHtml(message)}</span>
          <button type="button" data-catalog-editor-open="${escapeAttr(kind)}">Tentar novamente</button>
        </div>
      </section>`;
  }

  function renderCatalogDialog(kind) {
    const dialog = catalogDialog(kind);
    if (!dialog?.open) return;
    dialog.innerHTML = `
      <section class="portal-catalog-editor">
        ${renderCatalogToolbar(kind)}
        <main class="portal-catalog-workspace">
          ${kind === "emporio" ? renderEmporioWorkspace() : renderSpaWorkspace()}
        </main>
      </section>`;
  }

  function renderCatalogToolbar(kind) {
    const isEmporio = kind === "emporio";
    const title = isEmporio ? "Empório" : "Spa";
    const publicUrl = `${window.location.origin}/${encodeURIComponent(state.hotel?.slug || "")}/${kind}`;
    const scope = isEmporio
      ? state.hotel?.short_name || state.hotel?.name || "Unidade"
      : "Catálogo compartilhado";
    return `
      <header class="special-decorations-toolbar">
        <div><span>${escapeHtml(title)}</span><strong>${escapeHtml(scope)}</strong></div>
        <div>
          <a href="${escapeAttr(publicUrl)}" target="_blank" rel="noopener noreferrer">${icon("external")} Abrir portal</a>
          <button type="button" data-catalog-editor-close="${escapeAttr(kind)}" aria-label="Fechar editor">${icon("close")}</button>
        </div>
      </header>`;
  }

  function renderEmporioCarouselPanel() {
    const slides = emporioCarouselSlides();
    const images = state.media.filter((asset) => String(asset.mime_type || "").startsWith("image/"));
    const description = state.hotel.settings?.["portal.module.emporio.description"] || SERVICE_DESCRIPTIONS.emporio;
    return `
      <section class="guest-editor-section emporio-carousel-editor">
        <header>
          <strong>Destaques do carrossel</strong>
          <span>${slides.length} de 8 páginas configuradas. A ordem abaixo é a ordem exibida no portal.</span>
        </header>
        <label class="guest-editor-field">
          <span>Descrição abaixo do título do Empório</span>
          <textarea data-emporio-carousel-description maxlength="240" placeholder="Apresente brevemente o que o hóspede encontrará.">${escapeHtml(description)}</textarea>
        </label>
        <label class="guest-editor-field">
          <span>WhatsApp de atendimento da unidade</span>
          <input data-emporio-whatsapp inputmode="tel" autocomplete="tel" maxlength="24" value="${escapeAttr(state.hotel.settings?.["contact.whatsapp"] || "")}" placeholder="Ex.: 55 54 99999-0000">
          <small>Usado nos contatos do Empório e das experiências da unidade.</small>
        </label>
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

  function choiceSelectField(label, path, value, options) {
    return `
      <label class="guest-editor-field">
        <span>${escapeHtml(label)}</span>
        <select data-editor-path="${escapeAttr(path)}">
          ${options.map(([optionValue, optionLabel]) => `<option value="${escapeAttr(optionValue)}" ${optionValue === value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}
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
    const openCatalog = event.target.closest("[data-catalog-editor-open]");
    if (openCatalog) {
      openCatalogEditor(openCatalog.dataset.catalogEditorOpen);
      return;
    }
    const closeCatalog = event.target.closest("[data-catalog-editor-close]");
    if (closeCatalog) {
      closeCatalogEditor(catalogDialog(closeCatalog.dataset.catalogEditorClose));
      return;
    }
    if (event.target.closest("[data-special-decorations-open]")) {
      specialDecorationsEditor.open();
      return;
    }
    const tab = event.target.closest("[data-guest-editor-tab]");
    if (tab) {
      state.activeTab = tab.dataset.guestEditorTab;
      state.catalogEditor = null;
      state.spaEditor = null;
      renderPanel();
      return;
    }
    const spaAction = event.target.closest("[data-spa-action]");
    if (spaAction) {
      handleSpaAction(spaAction);
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
    const emporioWhatsapp = event.target.closest("[data-emporio-whatsapp]");
    if (emporioWhatsapp) {
      state.hotel.settings["contact.whatsapp"] = emporioWhatsapp.value;
      return;
    }
    const carouselDescription = event.target.closest("[data-emporio-carousel-description]");
    if (carouselDescription) {
      state.hotel.settings["portal.module.emporio.description"] = carouselDescription.value;
      return;
    }
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
    const spaUpload = event.target.closest("[data-spa-media-upload]");
    if (spaUpload) {
      uploadSpaMedia(spaUpload);
      return;
    }
    const carouselUpload = event.target.closest("[data-emporio-carousel-upload]");
    if (carouselUpload) {
      uploadEmporioCarouselMedia(carouselUpload);
      return;
    }
    const carouselField = event.target.closest("[data-emporio-carousel-field]");
    if (carouselField) {
      updateEmporioCarouselField(carouselField);
      renderCatalogDialog("emporio");
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
    const spaForm = event.target.closest("[data-spa-form]");
    if (spaForm) {
      event.preventDefault();
      await submitSpaForm(spaForm);
      return;
    }
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
      renderCatalogDialog("emporio");
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
      renderCatalogDialog("emporio");
      return;
    }
    if (action === "save-carousel") {
      saveEmporioCarousel();
      return;
    }
    if (action === "cancel") {
      state.catalogEditor = null;
      renderCatalogDialog("emporio");
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
    renderCatalogDialog("emporio");
  }

  function handleSpaAction(button) {
    const action = button.dataset.spaAction;
    if (action === "cancel") {
      state.spaEditor = null;
    } else if (action === "new-service") {
      state.spaEditor = {
        kind: "service",
        value: {
          status: "active",
          sort_order: (state.spaCatalog.services?.length || 0) * 10 + 10,
          currency: "BRL",
        },
      };
    } else if (action === "edit-service") {
      state.spaEditor = {
        kind: "service",
        value: structuredClone(
          (state.spaCatalog.services || []).find((entry) => entry.id === button.dataset.id) || {},
        ),
      };
    }
    renderCatalogDialog("spa");
  }

  async function submitSpaForm(form) {
    const submit = form.querySelector('[type="submit"]');
    const status = form.querySelector("[data-spa-form-status]");
    const kind = form.dataset.spaForm;
    const id = form.dataset.id;
    submit.disabled = true;
    status.textContent = "Salvando...";
    try {
      if (kind === "profile") {
        const body = spaProfilePayload(form);
        const payload = await adminApi("/api/v1/admin/spa/profile", { method: "PATCH", body });
        state.spaCatalog.profile = structuredClone(payload.data.profile);
        status.textContent = "Informações do Spa atualizadas em todas as unidades.";
      } else {
        const body = spaServicePayload(form);
        await adminApi(
          id
            ? `/api/v1/admin/spa/services/${encodeURIComponent(id)}`
            : "/api/v1/admin/spa/services",
          { method: id ? "PATCH" : "POST", body },
        );
        state.spaEditor = null;
        await loadSpaCatalog();
        setStatus("Catálogo do Spa atualizado.", "success");
        return;
      }
      setStatus("Conteúdo compartilhado do Spa atualizado.", "success");
      submit.disabled = false;
    } catch (error) {
      status.textContent = error.message || "Não foi possível salvar.";
      submit.disabled = false;
    }
  }

  function spaProfilePayload(form) {
    const data = new FormData(form);
    return {
      title: data.get("title"),
      subtitle: data.get("subtitle"),
      intro_text: data.get("intro_text"),
      about_text: data.get("about_text"),
      booking_title: data.get("booking_title"),
      booking_text: data.get("booking_text"),
      whatsapp_number: data.get("whatsapp_number"),
      whatsapp_service_message: data.get("whatsapp_service_message"),
      whatsapp_general_message: data.get("whatsapp_general_message"),
      hours_text: data.get("hours_text"),
      usage_rules: String(data.get("usage_rules") || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
      logo_media_asset_id: data.get("logo_media_asset_id") || "",
      status: state.spaCatalog.profile?.status || "active",
    };
  }

  function spaServicePayload(form, { strict = true } = {}) {
    const data = new FormData(form);
    return {
      name: data.get("name"),
      description: data.get("description"),
      duration_label: data.get("duration_label"),
      duration_minutes: data.get("duration_minutes") || null,
      price_cents: strict ? parsePrice(data.get("price")) : safeParsePrice(data.get("price")),
      currency: state.spaEditor?.value?.currency || "BRL",
      media_asset_id: data.get("media_asset_id") || "",
      status: data.get("status") || "active",
      sort_order: Number(data.get("sort_order") || 100),
    };
  }

  async function loadSpaCatalog({ render = true } = {}) {
    const payload = await adminApi("/api/v1/admin/spa/catalog");
    state.spaCatalog = structuredClone(payload.data || { profile: null, services: [] });
    if (render) renderCatalogDialog("spa");
  }

  async function uploadSpaMedia(input) {
    const file = input.files?.[0];
    const formElement = input.closest("[data-spa-form]");
    if (!file || !formElement) return;
    const kind = formElement.dataset.spaForm;
    if (kind === "profile") {
      state.spaCatalog.profile = {
        ...state.spaCatalog.profile,
        ...spaProfilePayload(formElement),
      };
    } else {
      state.spaEditor.value = {
        ...state.spaEditor.value,
        ...spaServicePayload(formElement, { strict: false }),
      };
    }
    input.disabled = true;
    setStatus("Enviando imagem do Spa...");
    const form = new FormData();
    form.set("hotel_id", state.hotel.hotel_id);
    form.set("module_key", "spa");
    form.set("file", file);
    try {
      const payload = await adminApi("/api/v1/admin/media", { method: "POST", body: form });
      const asset = payload.data.asset;
      state.media = [asset, ...state.media.filter((entry) => entry.id !== asset.id)];
      if (kind === "profile") {
        Object.assign(state.spaCatalog.profile, {
          logo_media_asset_id: asset.id,
          logo_url: asset.public_url,
        });
      } else {
        Object.assign(state.spaEditor.value, {
          media_asset_id: asset.id,
          image_url: asset.public_url,
        });
      }
      renderCatalogDialog("spa");
      setStatus("Imagem enviada e selecionada.", "success");
    } catch (error) {
      setStatus(error.message || "Não foi possível enviar a imagem.", "error");
      input.disabled = false;
    }
  }

  async function loadEmporioCatalog({ render = true } = {}) {
    const payload = await adminApi(`/api/v1/admin/emporio/catalog?hotel_id=${encodeURIComponent(state.hotel.hotel_id)}`);
    state.catalog = structuredClone(payload.data || { categories: [], category_options: [] });
    if (render) renderCatalogDialog("emporio");
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
      renderCatalogDialog("emporio");
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
    const status = els.emporioCatalogDialog.querySelector("[data-emporio-carousel-status]");
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
      renderCatalogDialog("emporio");
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
    const status = els.emporioCatalogDialog.querySelector("[data-emporio-carousel-status]");
    const description = String(
      state.hotel.settings?.["portal.module.emporio.description"] || "",
    ).trim();
    const whatsapp = String(state.hotel.settings?.["contact.whatsapp"] || "").trim();
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
        body: {
          "contact.whatsapp": whatsapp,
          "portal.module.emporio.description": description,
          "emporio.carousel_slides": slides,
        },
      });
      state.hotel.settings = structuredClone(payload.data.settings || state.hotel.settings);
      renderCatalogDialog("emporio");
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
      "portal.navigation_drawer_theme",
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
    const catalogMode = ["emporio", "spa", "decorations"].includes(state.activeTab);
    const modulePath = state.activeTab === "spa"
      ? "spa"
      : state.activeTab === "decorations"
        ? "romantic-packages"
        : "emporio";
    const moduleLabel = state.activeTab === "spa"
      ? "Spa"
      : state.activeTab === "decorations"
        ? "Decorações Especiais"
        : "Empório";
    els.save.hidden = catalogMode;
    els.publicLink.href = catalogMode ? `${publicPortalUrl()}/${modulePath}` : publicPortalUrl();
    els.publicLinkLabel.textContent = catalogMode ? `Abrir ${moduleLabel}` : "Abrir portal";
    const nextPreview = catalogMode ? `${publicPortalUrl()}/${modulePath}?admin_preview=1` : `${publicPortalUrl()}?admin_preview=1`;
    if (els.preview.getAttribute("src") !== nextPreview) els.preview.src = nextPreview;
    els.previewName.textContent = catalogMode ? moduleLabel : state.hotel.short_name || state.hotel.name;
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

function spaStatusLabel(status) {
  return {
    active: "Ativo",
    inactive: "Inativo",
    archived: "Arquivado",
  }[status] || "Ativo";
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
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
    spa: '<path d="M12 20c-4 0-7-2.7-7-6 3.2 0 5.7 1.3 7 3.4C13.3 15.3 15.8 14 19 14c0 3.3-3 6-7 6Z"/><path d="M12 17c-2.4-1.5-4-4.1-4-7 2.9 0 5 1.8 5 4.4M12 17c2.4-1.5 4-4.1 4-7-1.2 0-2.3.3-3.1.9M12 3c1.5 1.4 2 3.1 1.5 5"/>',
    sparkle: '<path d="m12 3 1.3 4.2L17.5 9l-4.2 1.6L12 15l-1.4-4.4L6.5 9l4.1-1.8L12 3Z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.image}</svg>`;
}
