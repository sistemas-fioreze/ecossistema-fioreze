import { adminApi } from "./shared/admin-api.js";
import { createAdminAuthView } from "./shared/admin-auth-view.js";
import {
  PORTALS_HOTELS_BRANDING_PERMISSION,
  PORTALS_HOTELS_CREATE_PERMISSION,
  PORTALS_HOTELS_MODULES_PERMISSION,
  PORTALS_HOTELS_NAVIGATION_PERMISSION,
  PORTALS_HOTELS_SETTINGS_PERMISSION,
  PORTALS_HOTELS_UPDATE_PERMISSION,
  PORTALS_EMBED_READ_PERMISSION,
  PORTALS_EMBED_UPDATE_PERMISSION,
  PORTALS_MEDIA_ARCHIVE_PERMISSION,
  PORTALS_MEDIA_UPDATE_PERMISSION,
  PORTALS_MEDIA_UPLOAD_PERMISSION,
  PORTALS_LINKS_ANALYTICS_PERMISSION,
  PORTALS_LINKS_ARCHIVE_PERMISSION,
  PORTALS_LINKS_CREATE_PERMISSION,
  PORTALS_LINKS_UPDATE_PERMISSION,
  canAccessAreas,
  canAccessAudit,
  canAccessContent,
  canAccessLinks,
  canAccessMediaLibrary,
  canAccessNavigation,
  canAccessPortals,
  canAccessUnits,
  getAuthorizedHotels,
  hasPermission,
} from "./shared/admin-session.js";
import { debounce, escapeAttr, escapeHtml, formatDate } from "./shared/format.js";

const els = {
  portalsNav: document.getElementById("portalsNav"),
  sectionEyebrow: document.getElementById("sectionEyebrow"),
  sectionTitle: document.getElementById("sectionTitle"),
  sectionSubtitle: document.getElementById("sectionSubtitle"),
  portalsDenied: document.getElementById("portalsDenied"),
  portalsContent: document.getElementById("portalsContent"),
  portalsHome: document.getElementById("portalsHome"),
  portalsModules: document.getElementById("portalsModules"),
  unitsManager: document.getElementById("unitsManager"),
  unitsListView: document.getElementById("unitsListView"),
  unitEditorView: document.getElementById("unitEditorView"),
  unitFilters: document.getElementById("unitFilters"),
  unitSearch: document.getElementById("unitSearch"),
  unitStatus: document.getElementById("unitStatus"),
  unitsMessage: document.getElementById("unitsMessage"),
  unitsList: document.getElementById("unitsList"),
  addUnitButton: document.getElementById("addUnitButton"),
  backToUnitsButton: document.getElementById("backToUnitsButton"),
  saveUnitButton: document.getElementById("saveUnitButton"),
  unitEditorTitle: document.getElementById("unitEditorTitle"),
  unitEditorCrumb: document.getElementById("unitEditorCrumb"),
  unitDirtyState: document.getElementById("unitDirtyState"),
  unitEditorForm: document.getElementById("unitEditorForm"),
  brandingPreview: document.getElementById("brandingPreview"),
  previewLogo: document.getElementById("previewLogo"),
  previewName: document.getElementById("previewName"),
  mediaLibrary: document.getElementById("mediaLibrary"),
  mediaFilters: document.getElementById("mediaFilters"),
  mediaHotel: document.getElementById("mediaHotel"),
  mediaModule: document.getElementById("mediaModule"),
  mediaStatus: document.getElementById("mediaStatus"),
  mediaSearch: document.getElementById("mediaSearch"),
  mediaUploadForm: document.getElementById("mediaUploadForm"),
  mediaFile: document.getElementById("mediaFile"),
  mediaAltText: document.getElementById("mediaAltText"),
  mediaUploadButton: document.getElementById("mediaUploadButton"),
  mediaUploadStatus: document.getElementById("mediaUploadStatus"),
  mediaError: document.getElementById("mediaError"),
  mediaGrid: document.getElementById("mediaGrid"),
  shortLinksManager: document.getElementById("shortLinksManager"),
  shortLinksFilters: document.getElementById("shortLinksFilters"),
  shortLinksHotel: document.getElementById("shortLinksHotel"),
  shortLinksStatus: document.getElementById("shortLinksStatus"),
  shortLinksSearch: document.getElementById("shortLinksSearch"),
  shortLinksSort: document.getElementById("shortLinksSort"),
  shortLinksMessage: document.getElementById("shortLinksMessage"),
  shortLinksSummary: document.getElementById("shortLinksSummary"),
  shortLinksList: document.getElementById("shortLinksList"),
  shortLinksEditor: document.getElementById("shortLinksEditor"),
  shortLinksEditorTitle: document.getElementById("shortLinksEditorTitle"),
  shortLinksForm: document.getElementById("shortLinksForm"),
  shortLinksPreview: document.getElementById("shortLinksPreview"),
  shortLinksAnalytics: document.getElementById("shortLinksAnalytics"),
  addShortLinkButton: document.getElementById("addShortLinkButton"),
  cancelShortLinkButton: document.getElementById("cancelShortLinkButton"),
  contentManager: document.getElementById("contentManager"),
  contentHotel: document.getElementById("contentHotel"),
  contentMessage: document.getElementById("contentMessage"),
  contentList: document.getElementById("contentList"),
  addContentButton: document.getElementById("addContentButton"),
  areasManager: document.getElementById("areasManager"),
  areasHotel: document.getElementById("areasHotel"),
  areasMessage: document.getElementById("areasMessage"),
  areasList: document.getElementById("areasList"),
  navigationManager: document.getElementById("navigationManager"),
  navigationHotel: document.getElementById("navigationHotel"),
  navigationMessage: document.getElementById("navigationMessage"),
  navigationList: document.getElementById("navigationList"),
  addNavigationButton: document.getElementById("addNavigationButton"),
  auditManager: document.getElementById("auditManager"),
  auditFilters: document.getElementById("auditFilters"),
  auditHotel: document.getElementById("auditHotel"),
  auditAction: document.getElementById("auditAction"),
  auditMessage: document.getElementById("auditMessage"),
  auditList: document.getElementById("auditList"),
  dialog: document.getElementById("portalsEditorDialog"),
  dialogTitle: document.getElementById("portalsDialogTitle"),
  dialogBody: document.getElementById("portalsDialogBody"),
};

const portalCards = [
  ["unidades", "Unidades", "Cadastre hoteis, identidade visual, modulos e navegacao.", "/admin/portais/unidades/"],
  ["media", "Biblioteca de imagens", "Gerencie imagens publicas dos portais e modulos.", "/admin/portais/media/"],
  ["links", "Links personalizados", "Crie enderecos curtos para campanhas, QR Codes e comunicacao.", "/admin/portais/links/"],
  ["conteudos", "Conteudos", "Paginas, eventos e informacoes dos hoteis.", "/admin/portais/conteudos/"],
  ["modulos", "Areas", "Ativacao e ajustes das experiencias.", "/admin/portais/areas/"],
  ["navegacao", "Navegacao", "Menus e caminhos dos portais.", "/admin/portais/navegacao/"],
  ["auditoria", "Auditoria", "Historico das alteracoes administrativas.", "/admin/portais/auditoria/"],
];
const mediaFields = ["logo_url", "horizontal_logo_url", "icon_url", "favicon_url", "cover_image_url", "social_image_url"];
const settingFields = [
  "general.short_description",
  "general.institutional_description",
  "general.opened_at",
  "contact.address",
  "contact.number",
  "contact.complement",
  "contact.district",
  "contact.city",
  "contact.state",
  "contact.postal_code",
  "contact.country",
  "contact.latitude",
  "contact.longitude",
  "contact.phone",
  "contact.whatsapp",
  "contact.email",
  "contact.website",
  "contact.maps_url",
  "hosting.check_in",
  "hosting.check_out",
  "hosting.breakfast_hours",
  "hosting.reception_hours",
  "hosting.parking_info",
  "hosting.wifi_info",
  "hosting.pet_policy",
  "hosting.house_rules",
  "hosting.welcome_text",
  "hosting.emergency_contact",
  "hosting.arrival_instructions",
  "seo.title",
  "seo.description",
  "seo.social_image_asset_id",
  "seo.canonical_base",
  "seo.share_name",
  "seo.browser_color",
];

let currentSession = null;
let currentAssets = [];
let currentShortLinks = [];
let currentShortLink = null;
let currentUnits = [];
let currentUnit = null;
let currentModules = [];
let currentNavigation = [];
let currentEmbed = null;
let activeUnitTab = "general";
let dirty = false;
let contentType = "pages";
let currentContent = { pages: [], events: [], information: [] };
let dedicatedModules = [];
let dedicatedNavigation = [];

const auth = createAdminAuthView({
  onAuthenticated(session) {
    currentSession = session;
    renderPortals(session);
  },
});

els.mediaFilters.addEventListener("submit", (event) => {
  event.preventDefault();
  loadMediaLibrary();
});
els.mediaSearch.addEventListener("input", debounce(() => loadMediaLibrary(), 300));
els.mediaUploadForm.addEventListener("submit", handleMediaUpload);
els.mediaGrid.addEventListener("click", handleMediaAction);
els.shortLinksFilters.addEventListener("submit", (event) => {
  event.preventDefault();
  loadShortLinks();
});
els.shortLinksSearch.addEventListener("input", debounce(() => loadShortLinks(), 300));
els.shortLinksStatus.addEventListener("change", () => loadShortLinks());
els.shortLinksSort.addEventListener("change", () => loadShortLinks());
els.addShortLinkButton.addEventListener("click", () => openShortLinkEditor());
els.cancelShortLinkButton.addEventListener("click", () => closeShortLinkEditor());
els.shortLinksForm.addEventListener("submit", saveShortLink);
els.shortLinksForm.addEventListener("input", updateShortLinkPreview);
els.shortLinksList.addEventListener("click", handleShortLinkAction);

els.unitFilters.addEventListener("submit", (event) => {
  event.preventDefault();
  loadUnits();
});
els.unitSearch.addEventListener("input", debounce(() => loadUnits(), 250));
els.unitStatus.addEventListener("change", () => loadUnits());
els.addUnitButton.addEventListener("click", () => openNewUnit());
els.backToUnitsButton.addEventListener("click", () => {
  if (dirty && !window.confirm("Existem alteracoes nao salvas. Voltar mesmo assim?")) return;
  navigateSoft("/admin/portais/unidades/");
  renderUnitsRoute();
});
els.saveUnitButton.addEventListener("click", saveCurrentUnit);
els.unitEditorForm.addEventListener("input", () => {
  dirty = true;
  updateDirtyState();
  updatePreview();
});
els.unitEditorForm.addEventListener("change", () => {
  dirty = true;
  updateDirtyState();
  updatePreview();
});
els.unitEditorForm.addEventListener("click", handleUnitEditorClick);
els.unitsList.addEventListener("click", handleUnitsListClick);
els.contentHotel.addEventListener("change", loadPortalContent);
els.contentManager.addEventListener("click", handleContentClick);
els.addContentButton.addEventListener("click", () => openContentEditor());
els.areasHotel.addEventListener("change", loadDedicatedAreas);
els.areasList.addEventListener("change", saveDedicatedArea);
els.navigationHotel.addEventListener("change", loadDedicatedNavigation);
els.addNavigationButton.addEventListener("click", () => openNavigationEditor());
els.navigationList.addEventListener("click", handleDedicatedNavigationAction);
els.auditFilters.addEventListener("submit", (event) => {
  event.preventDefault();
  loadAudit();
});
els.dialog.querySelector("[data-dialog-close]").addEventListener("click", closePortalsDialog);
els.dialog.addEventListener("click", (event) => {
  if (event.target === els.dialog) closePortalsDialog();
});

auth.boot();

function renderPortals(session) {
  const allowed = canAccessPortals(session);
  els.portalsDenied.hidden = allowed;
  els.portalsContent.hidden = !allowed;
  if (!allowed) return;
  renderNav(session);
  if (isUnitsRoute()) {
    renderUnitsRoute();
    return;
  }
  if (isMediaRoute()) {
    renderMediaLibrary(session);
    return;
  }
  if (isLinksRoute()) {
    renderShortLinksManager(session);
    return;
  }
  if (isContentRoute()) {
    renderContentManager(session);
    return;
  }
  if (isAreasRoute()) {
    renderAreasManager(session);
    return;
  }
  if (isNavigationRoute()) {
    renderNavigationManager(session);
    return;
  }
  if (isAuditRoute()) {
    renderAuditManager(session);
    return;
  }
  renderHome(session);
}

function setHeading(title, subtitle, eyebrow = "Central administrativa") {
  els.sectionEyebrow.textContent = eyebrow;
  els.sectionTitle.textContent = title;
  els.sectionSubtitle.textContent = subtitle;
}

function renderNav(session) {
  const items = [
    ["Inicio", "/admin/portais/", true],
    ["Unidades", "/admin/portais/unidades/", canAccessUnits(session)],
    ["Biblioteca", "/admin/portais/media/", canAccessMediaLibrary(session)],
    ["Links", "/admin/portais/links/", canAccessLinks(session)],
    ["Conteudos", "/admin/portais/conteudos/", canAccessContent(session)],
    ["Areas", "/admin/portais/areas/", canAccessAreas(session)],
    ["Navegacao", "/admin/portais/navegacao/", canAccessNavigation(session)],
    ["Auditoria", "/admin/portais/auditoria/", canAccessAudit(session)],
  ];
  els.portalsNav.innerHTML = items
    .map(([label, href, enabled]) =>
      enabled
        ? `<a href="${href}" ${window.location.pathname.startsWith(href) ? 'aria-current="page"' : ""}>${label}</a>`
        : `<span aria-disabled="true">${label}</span>`,
    )
    .join("");
}

function renderHome(session) {
  setHeading("Central de Portais Fioreze", "Gerencie unidades, experiencias digitais, conteudos e identidade visual.");
  showPortalSection(els.portalsHome);
  els.portalsModules.innerHTML = portalCards.map(([key, title, body, href]) => renderPortalCard(session, key, title, body, href)).join("");
}

function renderPortalCard(session, key, title, body, href) {
  const enabled =
    (key === "unidades" && canAccessUnits(session)) ||
    (key === "media" && canAccessMediaLibrary(session)) ||
    (key === "links" && canAccessLinks(session)) ||
    (key === "conteudos" && canAccessContent(session)) ||
    (key === "modulos" && canAccessAreas(session)) ||
    (key === "navegacao" && canAccessNavigation(session)) ||
    (key === "auditoria" && canAccessAudit(session));
  const tag = !enabled ? "article" : "a";
  const attr = tag === "a" ? `href="${escapeAttr(href)}"` : "";
  return `
    <${tag} class="admin-module-card admin-feature-card ${enabled ? "" : "is-disabled"}" ${attr}>
      <span class="admin-feature-icon" aria-hidden="true">${featureIcon(key)}</span>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
      ${!enabled ? '<em>Acesso restrito</em>' : ""}
    </${tag}>
  `;
}

function renderUnitsRoute() {
  if (!currentSession || !canAccessUnits(currentSession)) {
    showPortalSection(null);
    els.portalsDenied.hidden = false;
    return;
  }
  setHeading("Unidades", "Administre os hoteis, marcas, servicos e navegacao dos portais.");
  showPortalSection(els.unitsManager);
  const match = window.location.pathname.match(/^\/admin\/portais\/unidades\/([^/]+)\//);
  if (match) {
    openExistingUnit(decodeURIComponent(match[1]));
    return;
  }
  showUnitsList();
  loadUnits();
}

function showUnitsList() {
  currentUnit = null;
  dirty = false;
  els.unitsListView.hidden = false;
  els.unitEditorView.hidden = true;
}

async function loadUnits() {
  if (!canAccessUnits(currentSession)) return;
  els.unitsMessage.textContent = "Carregando unidades...";
  els.unitsList.innerHTML = "";
  const params = new URLSearchParams({ sort: "name" });
  if (els.unitSearch.value.trim()) params.set("q", els.unitSearch.value.trim());
  if (els.unitStatus.value) params.set("status", els.unitStatus.value);
  try {
    const payload = await adminApi(`/api/v1/admin/hotels?${params.toString()}`);
    currentUnits = payload.data.hotels || [];
    els.unitsMessage.textContent = `${currentUnits.length} unidade(s) encontrada(s).`;
    renderUnitsList();
  } catch (error) {
    els.unitsMessage.textContent = error.message || "Nao foi possivel carregar unidades.";
  }
}

function renderUnitsList() {
  if (!currentUnits.length) {
    els.unitsList.innerHTML = '<div class="admin-empty">Nenhuma unidade disponivel para este usuario.</div>';
    return;
  }
  els.unitsList.innerHTML = currentUnits.map(renderUnitRow).join("");
}

function renderUnitRow(unit) {
  return `
    <article class="admin-unit-row">
      <div class="admin-unit-logo">${unit.logo_url ? `<img src="${escapeAttr(unit.logo_url)}" alt="">` : escapeHtml(unit.short_name.slice(0, 2))}</div>
      <div>
        <strong>${escapeHtml(unit.name)}</strong>
        <span>${escapeHtml(unit.short_name)} - ${escapeHtml(unit.slug)}</span>
        <small>${escapeHtml(unit.settings?.["contact.city"] || "Cidade nao informada")}</small>
      </div>
      <span class="admin-status">${escapeHtml(unit.status)}</span>
      <span>${Number(unit.active_module_count || 0)} modulos</span>
      <span>${unit.branding_configured ? "Identidade pronta" : "Identidade pendente"}</span>
      <span>${escapeHtml(formatDate(unit.updated_at, unit.timezone))}</span>
      <button type="button" data-edit-unit="${escapeAttr(unit.hotel_id)}">Editar</button>
    </article>
  `;
}

function handleUnitsListClick(event) {
  const button = event.target.closest("[data-edit-unit]");
  if (!button) return;
  navigateSoft(`/admin/portais/unidades/${encodeURIComponent(button.dataset.editUnit)}/`);
  openExistingUnit(button.dataset.editUnit);
}

function openNewUnit() {
  currentUnit = {
    hotel_id: "",
    name: "",
    short_name: "",
    slug: "",
    timezone: "America/Sao_Paulo",
    locale: "pt-BR",
    currency: "BRL",
    status: "inactive",
    branding: defaultBranding(),
    settings: {},
  };
  currentModules = [];
  currentNavigation = [];
  activeUnitTab = "general";
  dirty = false;
  els.unitsListView.hidden = true;
  els.unitEditorView.hidden = false;
  renderUnitEditor();
}

async function openExistingUnit(hotelId) {
  els.unitsListView.hidden = true;
  els.unitEditorView.hidden = false;
  els.unitEditorTitle.textContent = "Carregando unidade...";
  try {
    const [hotel, modules, navigation, embed] = await Promise.all([
      adminApi(`/api/v1/admin/hotels/${encodeURIComponent(hotelId)}`),
      hasPermission(currentSession, PORTALS_HOTELS_MODULES_PERMISSION)
        ? adminApi(`/api/v1/admin/hotels/${encodeURIComponent(hotelId)}/modules`)
        : Promise.resolve({ data: { modules: [] } }),
      hasPermission(currentSession, PORTALS_HOTELS_NAVIGATION_PERMISSION)
        ? adminApi(`/api/v1/admin/hotels/${encodeURIComponent(hotelId)}/navigation`)
        : Promise.resolve({ data: { navigation: [] } }),
      hasPermission(currentSession, PORTALS_EMBED_READ_PERMISSION)
        ? adminApi(`/api/v1/admin/hotels/${encodeURIComponent(hotelId)}/embed`)
        : Promise.resolve({ data: { embed: null, modules: [] } }),
    ]);
    currentUnit = hotel.data.hotel;
    currentModules = modules.data.modules || [];
    currentNavigation = navigation.data.navigation || [];
    currentEmbed = embed.data;
    dirty = false;
    renderUnitEditor();
  } catch (error) {
    els.unitEditorForm.innerHTML = `<div class="admin-empty">${escapeHtml(error.message || "Unidade indisponivel.")}</div>`;
  }
}

function renderUnitEditor() {
  els.unitEditorTitle.textContent = currentUnit.hotel_id ? currentUnit.name : "Nova unidade";
  els.unitEditorCrumb.textContent = currentUnit.slug || "Nova unidade";
  if (!currentUnit.hotel_id && activeUnitTab !== "general") activeUnitTab = "general";
  updateDirtyState();
  for (const button of els.unitEditorForm.querySelectorAll("[data-unit-tab]")) {
    const blocked = isNewUnitBlockedTab(button.dataset.unitTab);
    button.disabled = blocked;
    button.setAttribute("aria-disabled", String(blocked));
    button.setAttribute("aria-selected", String(button.dataset.unitTab === activeUnitTab));
  }
  for (const panel of els.unitEditorForm.querySelectorAll("[data-tab-panel]")) {
    panel.hidden = panel.dataset.tabPanel !== activeUnitTab;
  }
  renderTabPanels();
  updatePreview();
}

function renderTabPanels() {
  const blockedMessage = '<div class="admin-empty">Salve os dados gerais para continuar.</div>';
  panel("general").innerHTML = `
    ${field("Nome oficial", "name", currentUnit.name, "text", "Hotel Exemplo")}
    ${field("Nome curto", "short_name", currentUnit.short_name, "text", "Hotel Exemplo")}
    ${field("Endereco personalizado", "slug", currentUnit.slug, "text", "hotel-exemplo", currentUnit.hotel_id ? "" : "Define o endereco publico da unidade.")}
    <div class="admin-form-grid">
      ${selectField("Status", "status", currentUnit.status, ["active", "inactive", "archived"])}
      ${field("Timezone", "timezone", currentUnit.timezone || "America/Sao_Paulo")}
      ${field("Locale", "locale", currentUnit.locale || "pt-BR")}
      ${field("Moeda", "currency", currentUnit.currency || "BRL")}
    </div>
    ${textarea("Descricao curta", "general.short_description")}
    ${textarea("Descricao institucional", "general.institutional_description")}
    ${field("Inauguracao", "general.opened_at", setting("general.opened_at"), "date")}
    <button type="button" class="admin-copy-button" data-copy-slug>Copiar slug e URL</button>
  `;
  panel("branding").innerHTML = isNewUnitBlockedTab("branding")
    ? blockedMessage
    : `
    <div class="admin-form-grid">
      ${colorField("Cor primaria", "primary_color")}
      ${colorField("Cor secundaria", "secondary_color")}
      ${colorField("Cor de destaque", "accent_color")}
      ${colorField("Fundo", "background_color")}
      ${colorField("Superficie", "surface_color")}
      ${colorField("Texto principal", "text_color")}
      ${colorField("Texto secundario", "muted_text_color")}
      ${colorField("Cor do navegador", "browser_theme_color")}
    </div>
    <div class="admin-media-picker-grid">
      ${mediaFields.map((name) => mediaPicker(name)).join("")}
    </div>
    ${field("Fonte", "font_family", currentUnit.branding?.font_family || "Effra, Inter, system-ui, sans-serif")}
  `;
  panel("contact").innerHTML = isNewUnitBlockedTab("contact")
    ? blockedMessage
    : `
    <div class="admin-form-grid">
      ${field("Endereco", "contact.address", setting("contact.address"))}
      ${field("Numero", "contact.number", setting("contact.number"))}
      ${field("Complemento", "contact.complement", setting("contact.complement"))}
      ${field("Bairro", "contact.district", setting("contact.district"))}
      ${field("Cidade", "contact.city", setting("contact.city"))}
      ${field("Estado", "contact.state", setting("contact.state"))}
      ${field("CEP", "contact.postal_code", setting("contact.postal_code"))}
      ${field("Pais", "contact.country", setting("contact.country") || "Brasil")}
      ${field("Latitude", "contact.latitude", setting("contact.latitude"), "number")}
      ${field("Longitude", "contact.longitude", setting("contact.longitude"), "number")}
      ${field("Telefone", "contact.phone", setting("contact.phone"))}
      ${field("WhatsApp", "contact.whatsapp", setting("contact.whatsapp"))}
      ${field("E-mail", "contact.email", setting("contact.email"), "email")}
      ${field("Site", "contact.website", setting("contact.website"), "url")}
      ${field("Google Maps ou Place", "contact.maps_url", setting("contact.maps_url"))}
    </div>
  `;
  panel("hosting").innerHTML = isNewUnitBlockedTab("hosting")
    ? blockedMessage
    : `
    <div class="admin-form-grid">
      ${field("Check-in", "hosting.check_in", setting("hosting.check_in"), "time")}
      ${field("Check-out", "hosting.check_out", setting("hosting.check_out"), "time")}
      ${field("Cafe da manha", "hosting.breakfast_hours", setting("hosting.breakfast_hours"))}
      ${field("Recepcao", "hosting.reception_hours", setting("hosting.reception_hours"))}
      ${field("Emergencia", "hosting.emergency_contact", setting("hosting.emergency_contact"))}
    </div>
    ${textarea("Estacionamento", "hosting.parking_info")}
    ${textarea("Wi-Fi", "hosting.wifi_info")}
    ${textarea("Pets", "hosting.pet_policy")}
    ${textarea("Regras da casa", "hosting.house_rules")}
    ${textarea("Boas-vindas", "hosting.welcome_text")}
    ${textarea("Instrucoes de chegada", "hosting.arrival_instructions")}
  `;
  panel("modules").innerHTML = currentModules.length
    ? currentModules.map(renderModuleToggle).join("")
    : '<div class="admin-empty">Salve a unidade antes de gerenciar modulos.</div>';
  panel("navigation").innerHTML = `
    <div class="admin-navigation-list">${currentNavigation.map(renderNavigationItem).join("") || '<div class="admin-empty">Nenhum item cadastrado.</div>'}</div>
    ${currentUnit.hotel_id ? renderNavigationComposer() : ""}
  `;
  panel("embed").innerHTML = isNewUnitBlockedTab("embed")
    ? blockedMessage
    : renderEmbedPanel();
  panel("seo").innerHTML = isNewUnitBlockedTab("seo")
    ? blockedMessage
    : `
    ${field("Titulo do portal", "seo.title", setting("seo.title"))}
    ${textarea("Descricao para buscadores", "seo.description")}
    ${mediaPicker("seo.social_image_asset_id", "Imagem social")}
    ${field("Canonical base", "seo.canonical_base", setting("seo.canonical_base"), "url")}
    ${field("Nome ao compartilhar", "seo.share_name", setting("seo.share_name"))}
    ${colorField("Cor do navegador", "seo.browser_color", setting("seo.browser_color") || branding("browser_theme_color"))}
  `;
}

function handleUnitEditorClick(event) {
  const tab = event.target.closest("[data-unit-tab]");
  if (tab) {
    if (isNewUnitBlockedTab(tab.dataset.unitTab)) {
      setMessage("Salve os dados gerais para continuar.");
      return;
    }
    activeUnitTab = tab.dataset.unitTab;
    renderUnitEditor();
    return;
  }
  const pick = event.target.closest("[data-pick-media]");
  if (pick) {
    openMediaSelector(pick.dataset.pickMedia);
    return;
  }
  const remove = event.target.closest("[data-remove-media]");
  if (remove) {
    setInputValue(remove.dataset.removeMedia, "");
    dirty = true;
    updateDirtyState();
    updatePreview();
    return;
  }
  const copy = event.target.closest("[data-copy-slug]");
  if (copy) {
    const slug = inputValue("slug");
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard?.writeText(`${slug} ${url}`);
    copy.textContent = "Copiado";
    return;
  }
  const navButton = event.target.closest("[data-nav-action]");
  if (navButton) handleNavigationAction(navButton);
  const copyEmbed = event.target.closest("[data-copy-embed]");
  if (copyEmbed) {
    copyEmbedSnippet(copyEmbed.dataset.copyEmbed);
  }
}

async function openMediaSelector(fieldName) {
  if (!currentUnit.hotel_id) {
    setMessage("Salve a unidade antes de selecionar imagens.");
    return;
  }
  const params = new URLSearchParams({ hotel_id: currentUnit.hotel_id, status: "active" });
  const payload = await adminApi(`/api/v1/admin/media?${params.toString()}`);
  const assets = payload.data.assets || [];
  if (!assets.length) {
    setMessage("Nenhuma imagem ativa disponivel para esta unidade.");
    return;
  }
  const selected = assets[0];
  setInputValue(fieldName, selected.id);
  setInputValue(`${fieldName}__preview`, selected.public_url);
  dirty = true;
  setMessage(`Imagem selecionada: ${selected.original_filename || selected.id}`);
  updatePreview();
}

async function saveCurrentUnit() {
  els.saveUnitButton.disabled = true;
  setMessage("Salvando unidade...");
  try {
    if (!currentUnit.hotel_id) {
      const created = await adminApi("/api/v1/admin/hotels", {
        method: "POST",
        body: collectGeneralPayload({ create: true }),
      });
      currentUnit = created.data.hotel;
      navigateSoft(`/admin/portais/unidades/${encodeURIComponent(currentUnit.hotel_id)}/`);
    } else {
      await adminApi(`/api/v1/admin/hotels/${encodeURIComponent(currentUnit.hotel_id)}`, {
        method: "PATCH",
        body: collectGeneralPayload(),
      });
      await saveBranding();
      await saveSettings();
      await saveModules();
      await saveEmbed();
    }
    dirty = false;
    setMessage("Unidade salva com sucesso.");
    if (currentUnit.hotel_id) await openExistingUnit(currentUnit.hotel_id);
  } catch (error) {
    setMessage(error.message || "Nao foi possivel salvar.");
  } finally {
    els.saveUnitButton.disabled = false;
  }
}

function collectGeneralPayload({ create = false } = {}) {
  const payload = {
    name: inputValue("name"),
    short_name: inputValue("short_name"),
    slug: inputValue("slug"),
    timezone: inputValue("timezone"),
    locale: inputValue("locale"),
    currency: inputValue("currency"),
  };
  if (!create) payload.status = inputValue("status");
  return payload;
}

async function saveBranding() {
  if (!hasPermission(currentSession, PORTALS_HOTELS_BRANDING_PERMISSION)) return;
  const body = {};
  for (const fieldName of [
    "primary_color",
    "secondary_color",
    "accent_color",
    "background_color",
    "surface_color",
    "text_color",
    "muted_text_color",
    "browser_theme_color",
    "font_family",
    ...mediaFields,
  ]) {
    const value = inputValue(fieldName);
    if (mediaFields.includes(fieldName)) {
      body[fieldName] = value;
    } else if (value) {
      body[fieldName] = value;
    }
  }
  if (Object.keys(body).length) {
    await adminApi(`/api/v1/admin/hotels/${encodeURIComponent(currentUnit.hotel_id)}/branding`, {
      method: "PATCH",
      body,
    });
  }
}

async function saveSettings() {
  if (!hasPermission(currentSession, PORTALS_HOTELS_SETTINGS_PERMISSION)) return;
  const body = {};
  for (const fieldName of settingFields) {
    const input = els.unitEditorForm.elements[fieldName];
    if (input && input.value.trim() !== "") body[fieldName] = input.value.trim();
  }
  if (Object.keys(body).length) {
    await adminApi(`/api/v1/admin/hotels/${encodeURIComponent(currentUnit.hotel_id)}/settings`, {
      method: "PATCH",
      body,
    });
  }
}

async function saveModules() {
  if (!hasPermission(currentSession, PORTALS_HOTELS_MODULES_PERMISSION) || !currentModules.length) return;
  const modules = currentModules.map((moduleRow) => ({
    module_key: moduleRow.module_key,
    enabled: Boolean(els.unitEditorForm.elements[`module:${moduleRow.module_key}:enabled`]?.checked),
    is_public: Boolean(els.unitEditorForm.elements[`module:${moduleRow.module_key}:public`]?.checked),
    public_name: els.unitEditorForm.elements[`module:${moduleRow.module_key}:name`]?.value || moduleRow.public_name,
    navigation_label: els.unitEditorForm.elements[`module:${moduleRow.module_key}:nav`]?.value || moduleRow.navigation_label,
    sort_order: Number(els.unitEditorForm.elements[`module:${moduleRow.module_key}:sort`]?.value || moduleRow.sort_order || 100),
  }));
  await adminApi(`/api/v1/admin/hotels/${encodeURIComponent(currentUnit.hotel_id)}/modules`, {
    method: "PATCH",
    body: { modules },
  });
}

async function saveEmbed() {
  if (
    !hasPermission(currentSession, PORTALS_EMBED_READ_PERMISSION) ||
    !hasPermission(currentSession, PORTALS_EMBED_UPDATE_PERMISSION) ||
    !currentUnit.hotel_id ||
    !currentEmbed?.embed
  ) {
    return;
  }
  const enabledInput = els.unitEditorForm.elements["embed.enabled"];
  const originsInput = els.unitEditorForm.elements["embed.allowed_origins"];
  const themeInput = els.unitEditorForm.elements["embed.default_theme"];
  const backgroundInput = els.unitEditorForm.elements["embed.default_background"];
  const headerInput = els.unitEditorForm.elements["embed.header"];
  const heightInput = els.unitEditorForm.elements["embed.initial_height"];
  const compactInput = els.unitEditorForm.elements["embed.compact"];
  if (!enabledInput || !originsInput || !themeInput || !backgroundInput || !headerInput || !heightInput || !compactInput) {
    return;
  }
  const modules = [...els.unitEditorForm.querySelectorAll("[name='embed.module']:checked")].map((input) => input.value);
  const body = {
    enabled: enabledInput.checked === true,
    allowed_origins: originsInput.value
      .split(/\n/)
      .map((origin) => origin.trim())
      .filter(Boolean),
    allowed_modules: modules,
    default_theme: themeInput.value || "light",
    default_background: backgroundInput.value || "default",
    header: headerInput.value || "visible",
    initial_height: Number(heightInput.value),
    compact: compactInput.checked === true,
  };
  if (!embedFormChanged(body, currentEmbed.embed)) return;
  await adminApi(`/api/v1/admin/hotels/${encodeURIComponent(currentUnit.hotel_id)}/embed`, {
    method: "PATCH",
    body,
  });
}

function embedFormChanged(next, current) {
  return (
    next.enabled !== Boolean(current.enabled) ||
    !sameStringList(next.allowed_origins, current.allowed_origins || []) ||
    !sameStringList(next.allowed_modules, current.allowed_modules || []) ||
    next.default_theme !== (current.default_theme || "light") ||
    next.default_background !== (current.default_background || "default") ||
    next.header !== (current.header || "visible") ||
    next.initial_height !== Number(current.initial_height || 520) ||
    next.compact !== Boolean(current.compact)
  );
}

function sameStringList(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

async function handleNavigationAction(button) {
  if (!hasPermission(currentSession, PORTALS_HOTELS_NAVIGATION_PERMISSION)) return;
  const action = button.dataset.navAction;
  const id = button.dataset.navId;
  if (action === "archive") {
    if (!window.confirm("Arquivar este item de navegacao?")) return;
    await adminApi(`/api/v1/admin/hotels/${encodeURIComponent(currentUnit.hotel_id)}/navigation/${encodeURIComponent(id)}`, {
      method: "DELETE",
      body: {},
    });
    await openExistingUnit(currentUnit.hotel_id);
  }
  if (action === "create") {
    await adminApi(`/api/v1/admin/hotels/${encodeURIComponent(currentUnit.hotel_id)}/navigation`, {
      method: "POST",
      body: {
        label: inputValue("nav.label"),
        path: inputValue("nav.path"),
        module_key: inputValue("nav.module_key"),
        icon_key: inputValue("nav.icon_key") || "home",
        sort_order: Number(inputValue("nav.sort_order") || 100),
        enabled: true,
        is_public: true,
      },
    });
    await openExistingUnit(currentUnit.hotel_id);
  }
}

function renderShortLinksManager(session) {
  setHeading("Links personalizados", "Crie enderecos curtos para campanhas, QR Codes, WhatsApp, mapas e motores de reserva.");
  const allowed = canAccessLinks(session);
  showPortalSection(allowed ? els.shortLinksManager : null);
  els.portalsDenied.hidden = allowed;
  if (!allowed) return;

  populateShortLinksHotelSelect(session);
  els.addShortLinkButton.hidden = !hasPermission(session, PORTALS_LINKS_CREATE_PERMISSION);
  closeShortLinkEditor();
  loadShortLinks();
}

function populateShortLinksHotelSelect(session) {
  const hotels = getAuthorizedHotels(session);
  els.shortLinksHotel.innerHTML = hotels
    .map((hotel) => `<option value="${escapeAttr(hotel.hotel_id)}">${escapeHtml(hotel.short_name || hotel.name)}</option>`)
    .join("");
}

async function loadShortLinks() {
  if (!currentSession || !canAccessLinks(currentSession) || !els.shortLinksHotel.value) return;
  els.shortLinksMessage.textContent = "Carregando links...";
  els.shortLinksList.innerHTML = "";
  const params = new URLSearchParams({
    hotel_id: els.shortLinksHotel.value,
    sort: els.shortLinksSort.value || "created",
  });
  if (els.shortLinksStatus.value) params.set("status", els.shortLinksStatus.value);
  if (els.shortLinksSearch.value.trim()) params.set("q", els.shortLinksSearch.value.trim());

  try {
    const payload = await adminApi(`/api/v1/admin/short-links?${params.toString()}`);
    currentShortLinks = payload.data.links || [];
    els.shortLinksMessage.textContent = `${currentShortLinks.length} link(s) encontrado(s).`;
    renderShortLinksSummary();
    renderShortLinksList();
  } catch (error) {
    currentShortLinks = [];
    els.shortLinksSummary.innerHTML = "";
    els.shortLinksList.innerHTML = "";
    els.shortLinksMessage.textContent = error.message || "Nao foi possivel carregar os links.";
  }
}

function renderShortLinksSummary() {
  const active = currentShortLinks.filter((link) => link.status === "active").length;
  const paused = currentShortLinks.filter((link) => link.status === "paused").length;
  const archived = currentShortLinks.filter((link) => link.status === "archived").length;
  const clicks = currentShortLinks.reduce((sum, link) => sum + Number(link.total_clicks || 0), 0);
  els.shortLinksSummary.innerHTML = [
    ["Ativos", active],
    ["Pausados", paused],
    ["Arquivados", archived],
    ["Cliques", clicks],
  ]
    .map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></article>`)
    .join("");
}

function renderShortLinksList() {
  if (!currentShortLinks.length) {
    els.shortLinksList.innerHTML = '<div class="admin-empty">Nenhum link personalizado encontrado.</div>';
    return;
  }
  els.shortLinksList.innerHTML = currentShortLinks.map(renderShortLinkRow).join("");
}

function renderShortLinkRow(link) {
  const canUpdate = hasPermission(currentSession, PORTALS_LINKS_UPDATE_PERMISSION) && link.status !== "archived";
  const canArchive = hasPermission(currentSession, PORTALS_LINKS_ARCHIVE_PERMISSION) && link.status !== "archived";
  return `
    <article class="admin-short-link-row">
      <div>
        <strong>${escapeHtml(link.internal_name)}</strong>
        <span>${escapeHtml(link.public_url)}</span>
        <small>${escapeHtml(link.destination_summary || link.destination_scheme)}</small>
      </div>
      <span class="admin-status">${escapeHtml(link.status)}</span>
      <span>${escapeHtml(link.hotel_name || link.hotel_id)}</span>
      <span>${Number(link.total_clicks || 0)} cliques</span>
      <span>${link.last_clicked_at ? escapeHtml(formatDate(link.last_clicked_at, link.hotel_timezone)) : "Sem acesso"}</span>
      <div class="admin-row-actions">
        <button type="button" data-link-action="edit" data-link-id="${escapeAttr(link.id)}">Abrir</button>
        <button type="button" data-link-action="copy" data-link-id="${escapeAttr(link.id)}">Copiar</button>
        ${canUpdate ? `<button type="button" data-link-action="toggle" data-link-id="${escapeAttr(link.id)}">${link.status === "active" ? "Pausar" : "Reativar"}</button>` : ""}
        ${canArchive ? `<button class="danger" type="button" data-link-action="archive" data-link-id="${escapeAttr(link.id)}">Arquivar</button>` : ""}
      </div>
    </article>
  `;
}

function openShortLinkEditor(link = null) {
  currentShortLink = link;
  els.shortLinksEditor.hidden = false;
  els.shortLinksEditorTitle.textContent = link ? "Editar link personalizado" : "Novo link personalizado";
  const form = els.shortLinksForm;
  form.elements.hotel_id.value = link?.hotel_id || els.shortLinksHotel.value || getAuthorizedHotels(currentSession)[0]?.hotel_id || "";
  form.elements.internal_name.value = link?.internal_name || "";
  form.elements.slug.value = link?.slug || "";
  form.elements.slug.disabled = Boolean(link);
  form.elements.destination_url.value = link?.destination_url || "";
  form.elements.status.value = link?.status === "archived" ? "paused" : link?.status || "active";
  form.elements.starts_at.value = toLocalDateTime(link?.starts_at);
  form.elements.expires_at.value = toLocalDateTime(link?.expires_at);
  form.elements.notes.value = link?.notes || "";
  renderShortLinkAnalytics(null);
  updateShortLinkPreview();
  if (link && hasPermission(currentSession, PORTALS_LINKS_ANALYTICS_PERMISSION)) loadShortLinkAnalytics(link.id);
}

function closeShortLinkEditor() {
  currentShortLink = null;
  els.shortLinksEditor.hidden = true;
  els.shortLinksForm.reset();
  els.shortLinksPreview.textContent = "";
  renderShortLinkAnalytics(null);
}

async function saveShortLink(event) {
  event.preventDefault();
  const form = els.shortLinksForm;
  const body = {
    hotel_id: form.elements.hotel_id.value,
    internal_name: form.elements.internal_name.value,
    destination_url: form.elements.destination_url.value,
    status: form.elements.status.value,
    starts_at: fromLocalDateTime(form.elements.starts_at.value),
    expires_at: fromLocalDateTime(form.elements.expires_at.value),
    notes: form.elements.notes.value,
  };
  if (!currentShortLink) body.slug = form.elements.slug.value;

  try {
    await adminApi(currentShortLink ? `/api/v1/admin/short-links/${encodeURIComponent(currentShortLink.id)}` : "/api/v1/admin/short-links", {
      method: currentShortLink ? "PATCH" : "POST",
      body,
    });
    closeShortLinkEditor();
    await loadShortLinks();
  } catch (error) {
    els.shortLinksMessage.textContent = error.message || "Nao foi possivel salvar o link.";
  }
}

async function handleShortLinkAction(event) {
  const button = event.target.closest("[data-link-action]");
  if (!button) return;
  const link = currentShortLinks.find((entry) => entry.id === button.dataset.linkId);
  if (!link) return;
  const action = button.dataset.linkAction;

  if (action === "edit") {
    openShortLinkEditor(link);
    return;
  }
  if (action === "copy") {
    await navigator.clipboard?.writeText(link.public_url);
    button.textContent = "Copiado";
    return;
  }
  if (action === "toggle") {
    await updateShortLinkStatus(link, link.status === "active" ? "paused" : "active");
    return;
  }
  if (action === "archive") {
    if (!window.confirm("Arquivar este link? O historico agregado de cliques sera preservado.")) return;
    await archiveShortLink(link);
  }
}

async function updateShortLinkStatus(link, status) {
  try {
    await adminApi(`/api/v1/admin/short-links/${encodeURIComponent(link.id)}`, {
      method: "PATCH",
      body: { status },
    });
    await loadShortLinks();
  } catch (error) {
    els.shortLinksMessage.textContent = error.message || "Nao foi possivel atualizar o status.";
  }
}

async function archiveShortLink(link) {
  try {
    await adminApi(`/api/v1/admin/short-links/${encodeURIComponent(link.id)}`, {
      method: "DELETE",
      body: {},
    });
    closeShortLinkEditor();
    await loadShortLinks();
  } catch (error) {
    els.shortLinksMessage.textContent = error.message || "Nao foi possivel arquivar o link.";
  }
}

async function loadShortLinkAnalytics(linkId) {
  try {
    const payload = await adminApi(`/api/v1/admin/short-links/${encodeURIComponent(linkId)}/analytics`);
    renderShortLinkAnalytics(payload.data.analytics);
  } catch {
    renderShortLinkAnalytics(null);
  }
}

function renderShortLinkAnalytics(analytics) {
  if (!analytics) {
    els.shortLinksAnalytics.innerHTML = '<div class="admin-empty">Metricas agregadas aparecem aqui apos o primeiro acesso.</div>';
    return;
  }
  els.shortLinksAnalytics.innerHTML = `
    <div class="admin-short-link-analytics">
      <article><span>Total</span><strong>${Number(analytics.total_clicks || 0)}</strong></article>
      <article><span>7 dias</span><strong>${Number(analytics.last_7_days || 0)}</strong></article>
      <article><span>30 dias</span><strong>${Number(analytics.last_30_days || 0)}</strong></article>
      <article><span>Ultimo acesso</span><strong>${analytics.last_clicked_at ? escapeHtml(formatDate(analytics.last_clicked_at)) : "Nenhum"}</strong></article>
    </div>
  `;
}

function updateShortLinkPreview() {
  const slug = currentShortLink?.slug || els.shortLinksForm.elements.slug.value.trim().toLowerCase();
  els.shortLinksPreview.textContent = shortLinkPreviewUrl(slug);
}

function shortLinkPreviewUrl(slug) {
  if (currentShortLink?.public_url && slug === currentShortLink.slug) return currentShortLink.public_url;
  const safeSlug = slug || "seu-link";
  return `${window.location.origin}/go/${safeSlug}`;
}

function renderMediaLibrary(session) {
  setHeading("Biblioteca de imagens", "Organize as imagens utilizadas nos portais e servicos de cada unidade.");
  const allowed = canAccessMediaLibrary(session);
  showPortalSection(allowed ? els.mediaLibrary : null);
  els.portalsDenied.hidden = allowed;
  if (!allowed) return;

  populateHotelSelect(session);
  els.mediaUploadForm.hidden = !hasPermission(session, PORTALS_MEDIA_UPLOAD_PERMISSION);
  loadMediaLibrary();
}

function populateHotelSelect(session) {
  const hotels = getAuthorizedHotels(session);
  els.mediaHotel.innerHTML = hotels
    .map((hotel) => `<option value="${escapeAttr(hotel.hotel_id)}">${escapeHtml(hotel.short_name || hotel.name)}</option>`)
    .join("");
}

async function loadMediaLibrary() {
  if (!currentSession || !canAccessMediaLibrary(currentSession) || !els.mediaHotel.value) return;
  els.mediaError.textContent = "";
  els.mediaGrid.innerHTML = '<div class="admin-empty">Carregando imagens...</div>';
  const params = new URLSearchParams({
    hotel_id: els.mediaHotel.value,
    status: els.mediaStatus.value,
  });
  if (els.mediaModule.value.trim()) params.set("module_key", els.mediaModule.value.trim());
  if (els.mediaSearch.value.trim()) params.set("q", els.mediaSearch.value.trim());

  try {
    const payload = await adminApi(`/api/v1/admin/media?${params.toString()}`);
    currentAssets = payload.data.assets || [];
    renderMediaGrid();
  } catch (error) {
    els.mediaGrid.innerHTML = "";
    els.mediaError.textContent = error.message || "Nao foi possivel carregar a biblioteca.";
  }
}

async function handleMediaUpload(event) {
  event.preventDefault();
  if (!currentSession || !hasPermission(currentSession, PORTALS_MEDIA_UPLOAD_PERMISSION)) return;
  els.mediaError.textContent = "";
  els.mediaUploadStatus.textContent = "Enviando imagem...";
  els.mediaUploadButton.disabled = true;

  const formData = new FormData(els.mediaUploadForm);
  formData.set("hotel_id", els.mediaHotel.value);
  formData.set("module_key", els.mediaModule.value.trim());

  try {
    await adminApi("/api/v1/admin/media", {
      method: "POST",
      body: formData,
    });
    els.mediaFile.value = "";
    els.mediaAltText.value = "";
    els.mediaUploadStatus.textContent = "Imagem enviada.";
    await loadMediaLibrary();
  } catch (error) {
    els.mediaUploadStatus.textContent = "";
    els.mediaError.textContent = error.message || "Falha ao enviar imagem.";
  } finally {
    els.mediaUploadButton.disabled = false;
  }
}

async function handleMediaAction(event) {
  const button = event.target.closest("[data-media-action]");
  if (!button) return;
  const asset = currentAssets.find((entry) => entry.id === button.dataset.mediaId);
  if (!asset) return;

  if (button.dataset.mediaAction === "copy") {
    await copyMediaUrl(asset.public_url);
    button.textContent = "Copiado";
    return;
  }

  if (button.dataset.mediaAction === "edit-alt") {
    await editAltText(asset);
    return;
  }

  if (button.dataset.mediaAction === "archive") {
    await archiveAsset(asset);
  }
}

async function copyMediaUrl(path) {
  const absolute = new URL(path, window.location.origin).toString();
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(absolute);
  }
}

async function editAltText(asset) {
  if (!hasPermission(currentSession, PORTALS_MEDIA_UPDATE_PERMISSION)) return;
  const value = window.prompt("Texto alternativo", asset.alt_text || "");
  if (value == null) return;
  try {
    await adminApi(`/api/v1/admin/media/${encodeURIComponent(asset.id)}`, {
      method: "PATCH",
      body: { alt_text: value },
    });
    await loadMediaLibrary();
  } catch (error) {
    els.mediaError.textContent = error.message || "Nao foi possivel atualizar a imagem.";
  }
}

async function archiveAsset(asset) {
  if (!hasPermission(currentSession, PORTALS_MEDIA_ARCHIVE_PERMISSION)) return;
  if (!window.confirm("Arquivar esta imagem? Ela deixara de aparecer, mas sera preservada.")) return;
  try {
    await adminApi(`/api/v1/admin/media/${encodeURIComponent(asset.id)}`, {
      method: "DELETE",
      body: {},
    });
    await loadMediaLibrary();
  } catch (error) {
    els.mediaError.textContent = error.message || "Nao foi possivel arquivar a imagem.";
  }
}

function renderMediaGrid() {
  if (!currentAssets.length) {
    els.mediaGrid.innerHTML = '<div class="admin-empty">Nenhuma imagem encontrada.</div>';
    return;
  }

  els.mediaGrid.innerHTML = currentAssets.map((asset) => renderMediaCard(asset)).join("");
}

function renderMediaCard(asset) {
  const canUpdate = hasPermission(currentSession, PORTALS_MEDIA_UPDATE_PERMISSION);
  const canArchive = hasPermission(currentSession, PORTALS_MEDIA_ARCHIVE_PERMISSION) && asset.status !== "archived";
  return `
    <article class="admin-media-card">
      <img src="${escapeAttr(asset.public_url)}" alt="${escapeAttr(asset.alt_text || "")}" loading="lazy">
      <div class="admin-media-body">
        <strong>${escapeHtml(asset.original_filename || asset.id)}</strong>
        <span>${escapeHtml(asset.mime_type || "")} - ${escapeHtml(formatBytes(asset.size_bytes))}</span>
        <span>${escapeHtml(asset.module_key || "shared")} - ${escapeHtml(asset.status)}</span>
        <span>${escapeHtml(formatDate(asset.created_at))}</span>
        <p>${escapeHtml(asset.alt_text || "Sem texto alternativo")}</p>
        <div class="admin-media-actions">
          <button type="button" data-media-action="copy" data-media-id="${escapeAttr(asset.id)}">Copiar URL</button>
          ${
            canUpdate
              ? `<button type="button" data-media-action="edit-alt" data-media-id="${escapeAttr(asset.id)}">Editar alt</button>`
              : ""
          }
          ${
            canArchive
              ? `<button class="danger" type="button" data-media-action="archive" data-media-id="${escapeAttr(asset.id)}">Arquivar</button>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderModuleToggle(moduleRow) {
  const key = escapeAttr(moduleRow.module_key);
  return `
    <article class="admin-module-toggle">
      <div>
        <strong>${escapeHtml(moduleRow.name)}</strong>
        <span>${escapeHtml(moduleRow.description || "")}</span>
        <code>${escapeHtml(moduleRow.module_key)}</code>
      </div>
      <label><input name="module:${key}:enabled" type="checkbox" ${moduleRow.enabled ? "checked" : ""}> Ativo</label>
      <label><input name="module:${key}:public" type="checkbox" ${moduleRow.is_public ? "checked" : ""}> Publico</label>
      <input name="module:${key}:name" value="${escapeAttr(moduleRow.public_name || moduleRow.name)}" aria-label="Nome publico">
      <input name="module:${key}:nav" value="${escapeAttr(moduleRow.navigation_label || moduleRow.name)}" aria-label="Rotulo de navegacao">
      <input name="module:${key}:sort" type="number" min="0" max="10000" value="${escapeAttr(moduleRow.sort_order || 100)}" aria-label="Ordem">
    </article>
  `;
}

function renderNavigationItem(item) {
  return `
    <article class="admin-navigation-item">
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.path)} - ${escapeHtml(item.module_key)}</span>
      </div>
      <span class="admin-status">${item.enabled ? "ativo" : "inativo"}</span>
      <button type="button" data-nav-action="archive" data-nav-id="${escapeAttr(item.id)}">Arquivar</button>
    </article>
  `;
}

function renderNavigationComposer() {
  return `
    <div class="admin-navigation-composer">
      ${field("Rotulo", "nav.label", "")}
      ${field("Destino interno", "nav.path", `/${currentUnit.slug}`)}
      ${field("Area do sistema", "nav.module_key", "guest-portal")}
      ${selectField("Icone", "nav.icon_key", "home", ["home", "utensils", "shopping-bag", "sparkles", "calendar", "map-pin", "image", "info", "phone"])}
      ${field("Ordem", "nav.sort_order", "100", "number")}
      <button class="admin-primary-button" type="button" data-nav-action="create">Criar item</button>
    </div>
  `;
}

function renderEmbedPanel() {
  if (!hasPermission(currentSession, PORTALS_EMBED_READ_PERMISSION)) {
    return '<div class="admin-empty">Voce nao tem acesso a esta funcao.</div>';
  }
  const embed = currentEmbed?.embed || {};
  const modules = currentEmbed?.modules || currentModules.filter((moduleRow) => moduleRow.enabled && moduleRow.is_public);
  const selected = new Set(embed.allowed_modules || []);
  const defaultModule = selected.has("room-service") ? "room-service" : modules[0]?.module_key || "guest-portal";
  const baseUrl = `${window.location.origin}/embed/${currentUnit.slug}/${defaultModule}/`;
  const fixed = `<iframe src="${baseUrl}" width="100%" height="${embed.initial_height || 520}" loading="lazy" style="border:0;width:100%;max-width:100%;"></iframe>`;
  const autoHeight = `<iframe data-fioreze-embed data-fioreze-embed-id="fioreze-${currentUnit.slug}-${defaultModule}" src="${baseUrl}" width="100%" height="${embed.initial_height || 520}" loading="lazy" style="border:0;width:100%;max-width:100%;"></iframe>\n<script src="${window.location.origin}/embed/fioreze-embed.js" defer></script>`;
  return `
    <div class="admin-form-grid">
      <label class="admin-field"><span>Permitir incorporacao</span><input name="embed.enabled" type="checkbox" ${embed.enabled ? "checked" : ""}></label>
      ${selectField("Tema padrao", "embed.default_theme", embed.default_theme || "light", ["light", "auto"])}
      ${selectField("Fundo padrao", "embed.default_background", embed.default_background || "default", ["default", "transparent"])}
      ${selectField("Cabecalho", "embed.header", embed.header || "visible", ["visible", "hidden"])}
      ${field("Altura inicial", "embed.initial_height", embed.initial_height || 520, "number")}
      <label class="admin-field"><span>Compacto</span><input name="embed.compact" type="checkbox" ${embed.compact ? "checked" : ""}></label>
    </div>
    <label class="admin-field admin-field-wide">
      <span>Dominios autorizados</span>
      <textarea name="embed.allowed_origins" rows="4" placeholder="https://site-autorizado.example">${escapeHtml((embed.allowed_origins || []).join("\n"))}</textarea>
      <small>Informe origens HTTPS completas, sem caminhos adicionais.</small>
    </label>
    <div class="admin-module-toggle">
      <div>
        <strong>Areas incorporaveis</strong>
        <span>Apenas areas publicas e ativas podem ser selecionadas.</span>
      </div>
      <div class="admin-embed-module-list">
        ${modules
          .map(
            (moduleRow) =>
              `<label><input name="embed.module" type="checkbox" value="${escapeAttr(moduleRow.module_key)}" ${selected.has(moduleRow.module_key) ? "checked" : ""}> ${escapeHtml(moduleRow.navigation_label || moduleRow.name || moduleRow.module_key)}</label>`,
          )
          .join("")}
      </div>
    </div>
    <div class="admin-navigation-composer">
      <strong>Preview</strong>
      <iframe title="Preview de incorporacao" src="${escapeAttr(baseUrl)}" height="${escapeAttr(embed.initial_height || 520)}" loading="lazy"></iframe>
    </div>
    <div class="admin-navigation-composer">
      <strong>Codigo para copiar</strong>
      <textarea readonly rows="3">${escapeHtml(fixed)}</textarea>
      <button type="button" data-copy-embed="fixed">Copiar iframe simples</button>
      <textarea readonly rows="5">${escapeHtml(autoHeight)}</textarea>
      <button type="button" data-copy-embed="auto">Copiar iframe com autoaltura</button>
    </div>
  `;
}

function copyEmbedSnippet(kind) {
  const textareas = [...els.unitEditorForm.querySelectorAll('[data-tab-panel="embed"] textarea[readonly]')];
  const value = kind === "auto" ? textareas[1]?.value : textareas[0]?.value;
  if (!value) return;
  navigator.clipboard?.writeText(value);
  setMessage("Codigo de incorporacao copiado.");
}

function field(label, name, value = "", type = "text", help = "") {
  return `
    <label class="admin-field">
      <span>${escapeHtml(label)}</span>
      <input name="${escapeAttr(name)}" type="${escapeAttr(type)}" value="${escapeAttr(value ?? "")}" ${name === "slug" ? "pattern=\"[a-z0-9-]+\"" : ""}>
      ${help ? `<small>${escapeHtml(help)}</small>` : ""}
    </label>
  `;
}

function textarea(label, name) {
  return `
    <label class="admin-field admin-field-wide">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeAttr(name)}" rows="4">${escapeHtml(setting(name))}</textarea>
    </label>
  `;
}

function selectField(label, name, value, options) {
  return `
    <label class="admin-field">
      <span>${escapeHtml(label)}</span>
      <select name="${escapeAttr(name)}">
        ${options.map((option) => `<option value="${escapeAttr(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function colorField(label, name, value = null) {
  const color = value || branding(name) || "#513b2d";
  return `
    <label class="admin-field">
      <span>${escapeHtml(label)}</span>
      <input name="${escapeAttr(name)}" type="color" value="${escapeAttr(color)}">
    </label>
  `;
}

function mediaPicker(name, label = null) {
  const value = name.startsWith("seo.") ? setting(name) : branding(name);
  const previewUrl = value?.startsWith("/") ? value : "";
  return `
    <div class="admin-media-picker">
      <span>${escapeHtml(label || mediaLabel(name))}</span>
      <input name="${escapeAttr(name)}" value="${escapeAttr(value || "")}" placeholder="media_...">
      <input name="${escapeAttr(`${name}__preview`)}" value="${escapeAttr(previewUrl)}" hidden>
      <div>${previewUrl ? `<img src="${escapeAttr(previewUrl)}" alt="">` : "<em>Sem imagem</em>"}</div>
      <button type="button" data-pick-media="${escapeAttr(name)}">Selecionar da Biblioteca</button>
      <button type="button" data-remove-media="${escapeAttr(name)}">Remover</button>
      ${previewUrl ? `<a href="${escapeAttr(previewUrl)}" target="_blank" rel="noopener">Abrir URL</a>` : ""}
    </div>
  `;
}

function panel(name) {
  return els.unitEditorForm.querySelector(`[data-tab-panel="${name}"]`);
}

function setting(name) {
  return currentUnit?.settings?.[name] ?? "";
}

function branding(name) {
  return currentUnit?.branding?.[name] ?? "";
}

function inputValue(name) {
  return els.unitEditorForm.elements[name]?.value?.trim() || "";
}

function setInputValue(name, value) {
  const input = els.unitEditorForm.elements[name];
  if (input) input.value = value || "";
}

function isNewUnitBlockedTab(tab) {
  return !currentUnit?.hotel_id && !["general", "modules", "navigation"].includes(tab);
}

function setMessage(message) {
  els.unitDirtyState.textContent = message;
}

function updateDirtyState() {
  els.unitDirtyState.textContent = dirty ? "Alteracoes nao salvas." : "Tudo salvo.";
}

function updatePreview() {
  const primary = inputValue("primary_color") || branding("primary_color") || "#513b2d";
  const accent = inputValue("accent_color") || branding("accent_color") || "#c1a94c";
  const background = inputValue("background_color") || branding("background_color") || "#fbf8f4";
  const surface = inputValue("surface_color") || branding("surface_color") || "#ffffff";
  const text = inputValue("text_color") || branding("text_color") || "#202124";
  els.brandingPreview.style.setProperty("--preview-primary", primary);
  els.brandingPreview.style.setProperty("--preview-accent", accent);
  els.brandingPreview.style.setProperty("--preview-background", background);
  els.brandingPreview.style.setProperty("--preview-surface", surface);
  els.brandingPreview.style.setProperty("--preview-text", text);
  els.previewName.textContent = inputValue("short_name") || currentUnit?.short_name || "Unidade Fioreze";
  const logo = inputValue("logo_url") || branding("logo_url");
  els.previewLogo.hidden = !logo || !logo.startsWith("/");
  if (!els.previewLogo.hidden) els.previewLogo.src = logo;
}

function renderContentManager(session) {
  const allowed = canAccessContent(session);
  setHeading("Conteudos", "Gerencie paginas, eventos e informacoes publicas por unidade.");
  showPortalSection(allowed ? els.contentManager : null);
  els.portalsDenied.hidden = allowed;
  if (!allowed) return;
  populateAuthorizedHotels(els.contentHotel, session);
  loadPortalContent();
}

async function loadPortalContent() {
  if (!els.contentHotel.value) return;
  els.contentMessage.textContent = "Carregando conteudos...";
  try {
    const payload = await adminApi(`/api/v1/admin/portal/content?hotel_id=${encodeURIComponent(els.contentHotel.value)}`);
    currentContent = payload.data;
    renderContentList();
  } catch (error) {
    els.contentMessage.textContent = error.message || "Nao foi possivel carregar os conteudos.";
  }
}

function renderContentList() {
  const rows = currentContent[contentType] || [];
  const labels = { pages: "pagina(s)", events: "evento(s)", information: "informacao(oes)" };
  els.contentMessage.textContent = `${rows.length} ${labels[contentType]}.`;
  els.contentList.innerHTML = rows.map((item) => renderContentRow(item, contentType)).join("") || '<p class="admin-empty">Nenhum conteudo cadastrado.</p>';
}

function renderContentRow(item, type) {
  if (type === "pages") {
    return `<article class="admin-data-row admin-content-row"><span class="admin-role-icon">${featureSvg("page")}</span><div class="admin-row-copy"><strong>${escapeHtml(item.title)}</strong><span>/${escapeHtml(item.slug)}</span><small>${Number(item.section_count || 0)} secao(oes) · ordem ${Number(item.sort_order || 0)}</small></div><span class="admin-status-chip" data-status="${escapeAttr(item.status)}">${contentStatus(item.status)}</span><div class="admin-row-actions"><button type="button" data-content-action="sections" data-id="${escapeAttr(item.id)}">Secoes</button><button type="button" data-content-action="edit" data-id="${escapeAttr(item.id)}">Editar</button></div></article>`;
  }
  if (type === "events") {
    return `<article class="admin-data-row admin-content-row"><span class="admin-role-icon">${featureSvg("event")}</span><div class="admin-row-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(formatDate(item.starts_at, item.timezone))}</span><small>${escapeHtml(item.summary || "Sem resumo")}</small></div><span class="admin-status-chip" data-status="${escapeAttr(item.status)}">${contentStatus(item.status)}</span><div class="admin-row-actions"><button type="button" data-content-action="edit" data-id="${escapeAttr(item.id)}">Editar</button></div></article>`;
  }
  return `<article class="admin-data-row admin-content-row"><span class="admin-role-icon">${featureSvg("info")}</span><div class="admin-row-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.info_key)}</span><small>Ordem ${Number(item.sort_order || 0)}</small></div><span class="admin-status-chip" data-status="${item.is_public ? "active" : "disabled"}">${item.is_public ? "Publica" : "Oculta"}</span><div class="admin-row-actions"><button type="button" data-content-action="edit" data-id="${escapeAttr(item.id)}">Editar</button></div></article>`;
}

function handleContentClick(event) {
  const tab = event.target.closest("[data-content-type]");
  if (tab) {
    contentType = tab.dataset.contentType;
    for (const button of els.contentManager.querySelectorAll("[data-content-type]")) button.setAttribute("aria-selected", String(button === tab));
    renderContentList();
    return;
  }
  const action = event.target.closest("[data-content-action]");
  if (!action) return;
  if (action.dataset.contentAction === "sections") return openSectionsEditor(action.dataset.id);
  const item = (currentContent[contentType] || []).find((entry) => entry.id === action.dataset.id);
  if (item) openContentEditor(item);
}

function openContentEditor(item = null) {
  const typeLabel = { pages: "pagina", events: "evento", information: "informacao" }[contentType];
  const article = contentType === "events" ? "Novo" : "Nova";
  els.dialogTitle.textContent = `${item ? "Editar" : article} ${typeLabel}`;
  if (contentType === "pages") {
    els.dialogBody.innerHTML = contentForm("page", `
      ${dialogField("Titulo", "title", item?.title, "text", true)}
      ${dialogField("Endereco", "slug", item?.slug, "text", true, "[a-z0-9-]+")}
      ${dialogTextarea("Resumo", "summary", item?.summary)}
      <div class="admin-form-grid">${dialogSelect("Status", "status", item?.status || "draft", [["draft", "Rascunho"], ["published", "Publicada"], ["archived", "Arquivada"]])}${dialogField("Ordem", "sort_order", item?.sort_order ?? 100, "number", true)}</div>`);
  } else if (contentType === "events") {
    els.dialogBody.innerHTML = contentForm("event", `
      ${dialogField("Titulo", "title", item?.title, "text", true)}
      ${dialogTextarea("Resumo", "summary", item?.summary)}
      <div class="admin-form-grid">${dialogField("Inicio", "starts_at", toLocalDateTime(item?.starts_at), "datetime-local", true)}${dialogField("Termino", "ends_at", toLocalDateTime(item?.ends_at), "datetime-local")}</div>
      <div class="admin-form-grid">${dialogField("Fuso horario", "timezone", item?.timezone || hotelTimezone(els.contentHotel.value), "text", true)}${dialogSelect("Status", "status", item?.status || "draft", [["draft", "Rascunho"], ["published", "Publicado"], ["cancelled", "Cancelado"], ["archived", "Arquivado"]])}</div>`);
  } else {
    els.dialogBody.innerHTML = contentForm("information", `
      ${dialogField("Titulo", "title", item?.title, "text", true)}
      ${dialogField("Identificador", "info_key", item?.info_key, "text", true, "[a-z0-9-]+")}
      ${dialogTextarea("Conteudo", "body", item?.body, true)}
      <div class="admin-form-grid">${dialogField("Ordem", "sort_order", item?.sort_order ?? 100, "number", true)}<label class="admin-choice admin-choice-standalone"><input name="is_public" type="checkbox" ${item?.is_public !== false ? "checked" : ""}><span><strong>Visivel no portal</strong></span></label></div>`);
  }
  openPortalsDialog();
  bindDialogForm((event) => saveContent(event, item));
}

async function saveContent(event, item) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const message = form.querySelector(".admin-dialog-message");
  const body = Object.fromEntries(data.entries());
  if (contentType === "pages") {
    body.sort_order = Number(body.sort_order || 100);
    body.hotel_id = els.contentHotel.value;
  } else if (contentType === "events") {
    body.hotel_id = els.contentHotel.value;
    body.starts_at = fromLocalDateTime(body.starts_at);
    body.ends_at = fromLocalDateTime(body.ends_at);
  } else {
    body.hotel_id = els.contentHotel.value;
    body.sort_order = Number(body.sort_order || 100);
    body.is_public = data.has("is_public");
  }
  const base = { pages: "pages", events: "events", information: "information" }[contentType];
  const path = item ? `/api/v1/admin/portal/${base}/${encodeURIComponent(item.id)}` : `/api/v1/admin/portal/${base}`;
  try {
    message.textContent = "Salvando...";
    await adminApi(path, { method: item ? "PATCH" : "POST", body });
    closePortalsDialog();
    await loadPortalContent();
  } catch (error) {
    message.textContent = error.message || "Nao foi possivel salvar o conteudo.";
  }
}

async function openSectionsEditor(pageId) {
  els.dialogTitle.textContent = "Secoes da pagina";
  els.dialogBody.innerHTML = '<p class="admin-muted">Carregando secoes...</p>';
  openPortalsDialog();
  try {
    const payload = await adminApi(`/api/v1/admin/portal/pages/${encodeURIComponent(pageId)}`);
    const sections = payload.data.sections || [];
    els.dialogBody.innerHTML = `
      <div class="admin-section-editor-list">${sections.map((section) => `<button type="button" data-edit-section="${escapeAttr(section.id)}"><strong>${escapeHtml(section.title || section.section_key)}</strong><span>${escapeHtml(section.body || "Sem texto")}</span></button>`).join("") || '<p class="admin-empty">Nenhuma secao cadastrada.</p>'}</div>
      <button class="admin-primary-button" type="button" data-new-section>Nova secao</button>`;
    els.dialogBody.querySelector("[data-new-section]").addEventListener("click", () => openSectionForm(pageId));
    els.dialogBody.querySelectorAll("[data-edit-section]").forEach((button) => button.addEventListener("click", () => openSectionForm(pageId, sections.find((item) => item.id === button.dataset.editSection))));
  } catch (error) {
    els.dialogBody.innerHTML = `<p class="admin-error">${escapeHtml(error.message || "Nao foi possivel carregar as secoes.")}</p>`;
  }
}

function openSectionForm(pageId, section = null) {
  els.dialogTitle.textContent = section ? "Editar secao" : "Nova secao";
  els.dialogBody.innerHTML = contentForm("section", `
    ${dialogField("Titulo", "title", section?.title)}
    ${dialogField("Identificador", "section_key", section?.section_key, "text", true, "[a-z0-9-]+")}
    ${dialogTextarea("Conteudo", "body", section?.body)}
    ${dialogField("Ordem", "sort_order", section?.sort_order ?? 100, "number", true)}`);
  bindDialogForm((event) => saveSection(event, pageId, section));
}

async function saveSection(event, pageId, section) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  data.sort_order = Number(data.sort_order || 100);
  const path = section ? `/api/v1/admin/portal/sections/${encodeURIComponent(section.id)}` : `/api/v1/admin/portal/pages/${encodeURIComponent(pageId)}/sections`;
  try {
    form.querySelector(".admin-dialog-message").textContent = "Salvando...";
    await adminApi(path, { method: section ? "PATCH" : "POST", body: data });
    await openSectionsEditor(pageId);
    await loadPortalContent();
  } catch (error) {
    form.querySelector(".admin-dialog-message").textContent = error.message || "Nao foi possivel salvar a secao.";
  }
}

function renderAreasManager(session) {
  const allowed = canAccessAreas(session);
  setHeading("Areas", "Ative as experiencias disponiveis em cada unidade.");
  showPortalSection(allowed ? els.areasManager : null);
  els.portalsDenied.hidden = allowed;
  if (!allowed) return;
  populateAuthorizedHotels(els.areasHotel, session);
  loadDedicatedAreas();
}

async function loadDedicatedAreas() {
  if (!els.areasHotel.value) return;
  els.areasMessage.textContent = "Carregando areas...";
  try {
    const payload = await adminApi(`/api/v1/admin/hotels/${encodeURIComponent(els.areasHotel.value)}/modules`);
    dedicatedModules = payload.data.modules || [];
    els.areasMessage.textContent = `${dedicatedModules.filter((item) => item.enabled).length} area(s) ativa(s).`;
    els.areasList.innerHTML = dedicatedModules.map((module) => `<label class="admin-area-card"><input type="checkbox" data-area-key="${escapeAttr(module.module_key)}" ${module.enabled ? "checked" : ""}><span class="admin-feature-icon">${featureIcon(module.module_key === "guest-portal" ? "conteudos" : "modulos")}</span><span><strong>${escapeHtml(module.public_name || module.name)}</strong><small>${escapeHtml(module.description || module.module_key)}</small></span><em>${module.enabled ? "Ativa" : "Inativa"}</em></label>`).join("");
  } catch (error) {
    els.areasMessage.textContent = error.message || "Nao foi possivel carregar as areas.";
  }
}

async function saveDedicatedArea(event) {
  const input = event.target.closest("[data-area-key]");
  if (!input) return;
  const selected = dedicatedModules.map((module) => ({
    module_key: module.module_key,
    enabled: module.module_key === input.dataset.areaKey ? input.checked : module.enabled,
    is_public: module.is_public,
    public_name: module.public_name,
    navigation_label: module.navigation_label,
    sort_order: module.sort_order,
  }));
  els.areasMessage.textContent = "Salvando area...";
  try {
    await adminApi(`/api/v1/admin/hotels/${encodeURIComponent(els.areasHotel.value)}/modules`, { method: "PATCH", body: { modules: selected } });
    await loadDedicatedAreas();
  } catch (error) {
    input.checked = !input.checked;
    els.areasMessage.textContent = error.message || "Nao foi possivel salvar a area.";
  }
}

function renderNavigationManager(session) {
  const allowed = canAccessNavigation(session);
  setHeading("Navegacao", "Organize os caminhos exibidos no portal de cada unidade.");
  showPortalSection(allowed ? els.navigationManager : null);
  els.portalsDenied.hidden = allowed;
  if (!allowed) return;
  populateAuthorizedHotels(els.navigationHotel, session);
  loadDedicatedNavigation();
}

async function loadDedicatedNavigation() {
  if (!els.navigationHotel.value) return;
  els.navigationMessage.textContent = "Carregando navegacao...";
  try {
    const [navigation, modules] = await Promise.all([
      adminApi(`/api/v1/admin/hotels/${encodeURIComponent(els.navigationHotel.value)}/navigation`),
      adminApi(`/api/v1/admin/hotels/${encodeURIComponent(els.navigationHotel.value)}/modules`),
    ]);
    dedicatedNavigation = navigation.data.navigation || [];
    dedicatedModules = modules.data.modules || [];
    els.navigationMessage.textContent = `${dedicatedNavigation.length} item(ns) configurado(s).`;
    els.navigationList.innerHTML = dedicatedNavigation.map((item) => `<article class="admin-data-row admin-content-row"><span class="admin-role-icon">${featureSvg("navigation")}</span><div class="admin-row-copy"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.path)}</span><small>${escapeHtml(item.module_key)} · ordem ${Number(item.sort_order || 0)}</small></div><span class="admin-status-chip" data-status="${item.enabled ? "active" : "disabled"}">${item.enabled ? "Visivel" : "Oculto"}</span><div class="admin-row-actions"><button type="button" data-navigation-action="edit" data-id="${escapeAttr(item.id)}">Editar</button><button type="button" data-navigation-action="archive" data-id="${escapeAttr(item.id)}">Ocultar</button></div></article>`).join("") || '<p class="admin-empty">Nenhum item de navegacao cadastrado.</p>';
  } catch (error) {
    els.navigationMessage.textContent = error.message || "Nao foi possivel carregar a navegacao.";
  }
}

function handleDedicatedNavigationAction(event) {
  const button = event.target.closest("[data-navigation-action]");
  if (!button) return;
  const item = dedicatedNavigation.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.navigationAction === "edit") return openNavigationEditor(item);
  if (!window.confirm(`Ocultar ${item.label} da navegacao?`)) return;
  adminApi(`/api/v1/admin/hotels/${encodeURIComponent(els.navigationHotel.value)}/navigation/${encodeURIComponent(item.id)}`, { method: "DELETE", body: {} })
    .then(loadDedicatedNavigation)
    .catch((error) => { els.navigationMessage.textContent = error.message || "Nao foi possivel ocultar o item."; });
}

function openNavigationEditor(item = null) {
  els.dialogTitle.textContent = item ? "Editar item de navegacao" : "Novo item de navegacao";
  els.dialogBody.innerHTML = contentForm("navigation", `
    ${dialogField("Nome", "label", item?.label, "text", true)}
    ${dialogField("Caminho", "path", item?.path || "/", "text", true)}
    <div class="admin-form-grid">${dialogSelect("Area", "module_key", item?.module_key || dedicatedModules[0]?.module_key || "guest-portal", dedicatedModules.map((module) => [module.module_key, module.public_name || module.name]))}${dialogField("Icone", "icon_key", item?.icon_key || "home")}</div>
    <div class="admin-form-grid">${dialogField("Ordem", "sort_order", item?.sort_order ?? 100, "number", true)}<label class="admin-choice admin-choice-standalone"><input name="enabled" type="checkbox" ${item?.enabled !== false ? "checked" : ""}><span><strong>Visivel no portal</strong></span></label></div>`);
  openPortalsDialog();
  bindDialogForm((event) => saveNavigation(event, item));
}

async function saveNavigation(event, item) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const body = Object.fromEntries(data.entries());
  body.sort_order = Number(body.sort_order || 100);
  body.enabled = data.has("enabled");
  body.is_public = true;
  const base = `/api/v1/admin/hotels/${encodeURIComponent(els.navigationHotel.value)}/navigation`;
  try {
    form.querySelector(".admin-dialog-message").textContent = "Salvando...";
    await adminApi(item ? `${base}/${encodeURIComponent(item.id)}` : base, { method: item ? "PATCH" : "POST", body });
    closePortalsDialog();
    await loadDedicatedNavigation();
  } catch (error) {
    form.querySelector(".admin-dialog-message").textContent = error.message || "Nao foi possivel salvar o item.";
  }
}

function renderAuditManager(session) {
  const allowed = canAccessAudit(session);
  setHeading("Auditoria", "Consulte as alteracoes realizadas na Central Administrativa.");
  showPortalSection(allowed ? els.auditManager : null);
  els.portalsDenied.hidden = allowed;
  if (!allowed) return;
  populateAuthorizedHotels(els.auditHotel, session, true);
  loadAudit();
}

async function loadAudit() {
  const params = new URLSearchParams({ limit: "150" });
  if (els.auditHotel.value) params.set("hotel_id", els.auditHotel.value);
  if (els.auditAction.value.trim()) params.set("action", els.auditAction.value.trim());
  els.auditMessage.textContent = "Carregando auditoria...";
  try {
    const payload = await adminApi(`/api/v1/admin/audit?${params}`);
    const entries = payload.data.entries || [];
    els.auditMessage.textContent = `${entries.length} registro(s) encontrado(s).`;
    els.auditList.innerHTML = entries.map((entry) => `<article class="admin-data-row admin-audit-row"><span class="admin-role-icon">${featureSvg("history")}</span><div class="admin-row-copy"><strong>${escapeHtml(auditActionLabel(entry.action))}</strong><span>${escapeHtml(entry.actor_name)} · ${escapeHtml(entry.hotel_id || "Administracao geral")}</span><small>${escapeHtml(entry.entity_type || "registro")} · ${escapeHtml(formatDate(entry.created_at))}</small></div><code>${escapeHtml(entry.action)}</code></article>`).join("") || '<p class="admin-empty">Nenhuma alteracao encontrada.</p>';
  } catch (error) {
    els.auditMessage.textContent = error.message || "Nao foi possivel carregar a auditoria.";
  }
}

function showPortalSection(active) {
  for (const section of [els.portalsHome, els.unitsManager, els.shortLinksManager, els.mediaLibrary, els.contentManager, els.areasManager, els.navigationManager, els.auditManager]) {
    section.hidden = section !== active;
  }
}

function populateAuthorizedHotels(select, session, includeAll = false) {
  const options = getAuthorizedHotels(session).map((hotel) => `<option value="${escapeAttr(hotel.hotel_id)}">${escapeHtml(hotel.short_name || hotel.name)}</option>`).join("");
  select.innerHTML = `${includeAll ? '<option value="">Todas as unidades</option>' : ""}${options}`;
}

function contentForm(name, fields) {
  return `<form id="portal-${escapeAttr(name)}-form" class="admin-form-stack">${fields}<p class="admin-dialog-message" role="status"></p><div class="admin-dialog-actions"><button type="button" data-dialog-cancel>Cancelar</button><button class="admin-primary-button" type="submit">Salvar</button></div></form>`;
}

function bindDialogForm(handler) {
  const form = els.dialogBody.querySelector("form");
  form.addEventListener("submit", handler);
  form.querySelector("[data-dialog-cancel]").addEventListener("click", closePortalsDialog);
}

function dialogField(label, name, value = "", type = "text", required = false, pattern = "") {
  return `<label><span>${escapeHtml(label)}</span><input name="${escapeAttr(name)}" type="${escapeAttr(type)}" value="${escapeAttr(value ?? "")}" ${required ? "required" : ""} ${pattern ? `pattern="${escapeAttr(pattern)}"` : ""}></label>`;
}

function dialogTextarea(label, name, value = "", required = false) {
  return `<label><span>${escapeHtml(label)}</span><textarea name="${escapeAttr(name)}" rows="5" ${required ? "required" : ""}>${escapeHtml(value || "")}</textarea></label>`;
}

function dialogSelect(label, name, value, options) {
  return `<label><span>${escapeHtml(label)}</span><select name="${escapeAttr(name)}">${options.map(([key, text]) => `<option value="${escapeAttr(key)}" ${key === value ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></label>`;
}

function openPortalsDialog() {
  if (!els.dialog.open) els.dialog.showModal();
}

function closePortalsDialog() {
  if (els.dialog.open) els.dialog.close();
  els.dialogBody.innerHTML = "";
}

function hotelTimezone(hotelId) {
  return getAuthorizedHotels(currentSession).find((hotel) => hotel.hotel_id === hotelId)?.timezone || "America/Sao_Paulo";
}

function contentStatus(status) {
  return ({ draft: "Rascunho", published: "Publicado", archived: "Arquivado", cancelled: "Cancelado" })[status] || status;
}

function auditActionLabel(action) {
  const labels = {
    "portal-page.create": "Pagina criada",
    "portal-page.update": "Pagina atualizada",
    "portal-section.create": "Secao criada",
    "portal-section.update": "Secao atualizada",
    "portal-event.create": "Evento criado",
    "portal-event.update": "Evento atualizado",
    "hotel-information.create": "Informacao criada",
    "hotel-information.update": "Informacao atualizada",
    "hotel.modules.update": "Areas atualizadas",
    "hotel.navigation.create": "Item de navegacao criado",
    "hotel.navigation.update": "Item de navegacao atualizado",
    "hotel.navigation.archive": "Item de navegacao ocultado",
  };
  return labels[action] || action.replaceAll("-", " ").replaceAll(".", " · ");
}

function featureSvg(type) {
  const paths = {
    page: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    event: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    navigation: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-6 2 2-6z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  };
  return `<svg class="admin-svg-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[type] || paths.page}</svg>`;
}

function navigateSoft(path) {
  window.history.pushState({}, "", path);
}

function isMediaRoute() {
  return window.location.pathname.startsWith("/admin/portais/media/");
}

function isLinksRoute() {
  return window.location.pathname.startsWith("/admin/portais/links/");
}

function isUnitsRoute() {
  return window.location.pathname.startsWith("/admin/portais/unidades/");
}

function isContentRoute() {
  return window.location.pathname.startsWith("/admin/portais/conteudos/");
}

function isAreasRoute() {
  return window.location.pathname.startsWith("/admin/portais/areas/");
}

function isNavigationRoute() {
  return window.location.pathname.startsWith("/admin/portais/navegacao/");
}

function isAuditRoute() {
  return window.location.pathname.startsWith("/admin/portais/auditoria/");
}

function defaultBranding() {
  return {
    primary_color: "#513b2d",
    secondary_color: "#f4f1ef",
    accent_color: "#c1a94c",
    background_color: "#fbf8f4",
    surface_color: "#ffffff",
    text_color: "#202124",
    muted_text_color: "#667085",
    browser_theme_color: "#513b2d",
    font_family: "Effra, Inter, system-ui, sans-serif",
  };
}

function featureIcon(key) {
  const paths = {
    unidades: '<path d="M5 20V8l7-4 7 4v12"/><path d="M9 20v-6h6v6"/>',
    media: '<path d="M5 5h14v14H5z"/><path d="m7 16 4-4 3 3 2-2 3 3"/><circle cx="9" cy="9" r="1"/>',
    links: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
    conteudos: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    modulos: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
    navegacao: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-6 2 2-6z"/>',
    auditoria: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  };
  return `<svg class="admin-svg-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[key] || paths.modulos}</svg>`;
}

function mediaLabel(name) {
  return {
    logo_url: "Logo principal",
    horizontal_logo_url: "Logo horizontal",
    icon_url: "Logo reduzida",
    favicon_url: "Favicon",
    cover_image_url: "Imagem de capa",
    social_image_url: "Imagem social",
  }[name] || name;
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
