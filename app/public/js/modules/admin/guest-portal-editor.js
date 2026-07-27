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
    previewName: root.querySelector("#guestPortalPreviewName"),
    previewFrame: root.querySelector("#guestPortalPreviewFrame"),
    preview: root.querySelector("#guestPortalPreview"),
  };
  const state = {
    session: null,
    hotel: null,
    modules: [],
    media: [],
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
      ];
      if (hasPermission(state.session, PORTALS_MEDIA_READ_PERMISSION)) {
        requests.push(adminApi(`/api/v1/admin/media?hotel_id=${encodeURIComponent(hotelId)}&status=active`));
      }
      const [hotelPayload, modulesPayload, mediaPayload] = await Promise.all(requests);
      state.hotel = structuredClone(hotelPayload.data.hotel);
      state.modules = structuredClone(modulesPayload.data.modules || []);
      state.media = mediaPayload?.data?.assets || [];
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
    else els.panel.innerHTML = renderContentPanel();
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
        ${textField("Fonte", "branding.font_family", branding.font_family)}
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

  function mediaPicker(label, path, selectedValue, options = {}) {
    const assets = state.media.filter((asset) => {
      const type = String(asset.mime_type || "");
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
            <input type="file" data-guest-media-upload data-editor-path="${escapeAttr(path)}" data-allow-video="${String(Boolean(options.allowVideo))}" accept="${options.allowVideo ? "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" : "image/jpeg,image/png,image/webp,image/avif"}">
            <span>Enviar novo arquivo</span>
          </label>` : ""}
      </fieldset>`;
  }

  function mediaOption(path, asset, checked) {
    const preview = String(asset.mime_type || "").startsWith("video/")
      ? `<video src="${escapeAttr(asset.public_url)}" muted preload="metadata"></video>`
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
      renderPanel();
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
    const control = event.target.closest("[data-editor-path]");
    if (!control || control.type === "file" || control.type === "radio" || control.type === "checkbox") return;
    setPath(control.dataset.editorPath, control.value);
    if (control.type === "color") syncColorPair(control);
    markDirty();
  }

  function handleChange(event) {
    const upload = event.target.closest("[data-guest-media-upload]");
    if (upload) {
      uploadMedia(upload);
      return;
    }
    const control = event.target.closest("[data-editor-path]");
    if (!control || control.type === "file") return;
    setPath(control.dataset.editorPath, control.type === "checkbox" ? control.checked : control.value);
    if (control.matches('input[type="text"][pattern]')) syncColorPair(control);
    markDirty();
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
      ...SERVICE_KEYS.map((key) => `portal.module.${key}.description`),
    ];
    return Object.fromEntries(keys.map((key) => [key, settings[key] ?? (key === "contact.maps_embed_urls" ? [] : "")]));
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
  return String(path || "").startsWith("branding.") ? asset.public_url : asset.id;
}

function icon(name) {
  const paths = {
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    hotel: '<path d="M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 20"/>',
    services: '<path d="M5 14h14M7 14a5 5 0 0 1 10 0M12 7V5M4 18h16"/><path d="M10 5h4"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.image}</svg>`;
}
