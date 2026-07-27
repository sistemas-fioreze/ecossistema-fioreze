import { adminApi } from "./shared/admin-api.js";
import { createAdminAuthView, syncAdminNavigationActiveState } from "./shared/admin-auth-view.js";
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
  PORTALS_LINKS_DELETE_PERMISSION,
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
import { createGuestPortalEditor } from "./guest-portal-editor.js";
import { portalFontOptions } from "../../core/portal-fonts.js";

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
  mediaFolderId: document.getElementById("mediaFolderId"),
  mediaUploadForm: document.getElementById("mediaUploadForm"),
  mediaFile: document.getElementById("mediaFile"),
  mediaAltText: document.getElementById("mediaAltText"),
  mediaUploadButton: document.getElementById("mediaUploadButton"),
  mediaUploadStatus: document.getElementById("mediaUploadStatus"),
  mediaError: document.getElementById("mediaError"),
  mediaItemCount: document.getElementById("mediaItemCount"),
  mediaStorageUsed: document.getElementById("mediaStorageUsed"),
  mediaStorageLimit: document.getElementById("mediaStorageLimit"),
  mediaStorageProgress: document.getElementById("mediaStorageProgress"),
  mediaStorageFiles: document.getElementById("mediaStorageFiles"),
  mediaBreadcrumbs: document.getElementById("mediaBreadcrumbs"),
  mediaNewFolderButton: document.getElementById("mediaNewFolderButton"),
  mediaUploadToggle: document.getElementById("mediaUploadToggle"),
  mediaRootDropTarget: document.getElementById("mediaRootDropTarget"),
  mediaViewGrid: document.getElementById("mediaViewGrid"),
  mediaViewList: document.getElementById("mediaViewList"),
  mediaFolderDialog: document.getElementById("mediaFolderDialog"),
  mediaFolderDialogTitle: document.getElementById("mediaFolderDialogTitle"),
  mediaFolderForm: document.getElementById("mediaFolderForm"),
  mediaFolderName: document.getElementById("mediaFolderName"),
  mediaFolderError: document.getElementById("mediaFolderError"),
  mediaMoveDialog: document.getElementById("mediaMoveDialog"),
  mediaMoveForm: document.getElementById("mediaMoveForm"),
  mediaMoveName: document.getElementById("mediaMoveName"),
  mediaMoveTarget: document.getElementById("mediaMoveTarget"),
  mediaMoveError: document.getElementById("mediaMoveError"),
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
  shortLinkQrPanel: document.getElementById("shortLinkQrPanel"),
  shortLinkQrImage: document.getElementById("shortLinkQrImage"),
  shortLinkQrUrl: document.getElementById("shortLinkQrUrl"),
  shortLinkQrDownload: document.getElementById("shortLinkQrDownload"),
  copyShortLinkQrButton: document.getElementById("copyShortLinkQrButton"),
  shortLinkSharingPanel: document.getElementById("shortLinkSharingPanel"),
  shortLinkSharingForm: document.getElementById("shortLinkSharingForm"),
  shortLinkShareUser: document.getElementById("shortLinkShareUser"),
  shortLinkSharingMessage: document.getElementById("shortLinkSharingMessage"),
  shortLinkSharesList: document.getElementById("shortLinkSharesList"),
  addShortLinkButton: document.getElementById("addShortLinkButton"),
  cancelShortLinkButton: document.getElementById("cancelShortLinkButton"),
  eventsManager: document.getElementById("eventsManager"),
  eventsFilters: document.getElementById("eventsFilters"),
  eventsHotel: document.getElementById("eventsHotel"),
  eventsStatus: document.getElementById("eventsStatus"),
  eventsSearch: document.getElementById("eventsSearch"),
  eventsSummary: document.getElementById("eventsSummary"),
  eventsMessage: document.getElementById("eventsMessage"),
  eventsList: document.getElementById("eventsList"),
  addEventButton: document.getElementById("addEventButton"),
  contentManager: document.getElementById("contentManager"),
  contentHotel: document.getElementById("contentHotel"),
  guestPortalEditor: document.getElementById("guestPortalEditor"),
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
  ["unidades", "Unidades", "Cadastre hotéis, identidade visual e informações institucionais.", "/admin/portais/unidades/"],
  ["media", "Biblioteca de mídia", "Gerencie imagens, vídeos e pastas dos portais e módulos.", "/admin/portais/media/"],
  ["links", "Links e QR Codes", "Crie endereços curtos, QR Codes e acompanhe acessos.", "/admin/portais/links/"],
  ["eventos", "Eventos", "Planeje a agenda e publique experiências em cada unidade.", "/admin/portais/eventos/"],
  ["conteudos", "Portal do Hóspede", "Personalize identidade, capas, conteúdos e serviços no template oficial.", "/admin/portais/portal-hospede/"],
];
const mediaFields = ["logo_url", "horizontal_logo_url", "icon_url", "favicon_url", "cover_image_url", "social_image_url"];
const brandingAssetFields = [...mediaFields, "font_asset_id"];
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
  "contact.maps_embed_urls",
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
  "portal.blog_feed_url",
  "portal.module.room-service.description",
  "portal.module.emporio.description",
  "portal.module.romantic-packages.description",
  "portal.module.spa.description",
  "seo.title",
  "seo.description",
  "seo.social_image_asset_id",
  "seo.canonical_base",
  "seo.share_name",
  "seo.browser_color",
];

let currentSession = null;
let currentAssets = [];
let currentFolders = [];
let currentMediaStorage = { used_bytes: 0, file_count: 0, quota_bytes: 0, percent_used: 0 };
let currentMediaBreadcrumbs = [];
let currentMediaFolderId = null;
let currentMediaView = readMediaView();
let editingMediaFolder = null;
let movingMediaAsset = null;
let currentShortLinks = [];
let currentShortLink = null;
let currentShortLinkPublicBase = "";
let currentShortLinkShareUsers = [];
let currentUnits = [];
let currentUnit = null;
let currentModules = [];
let currentNavigation = [];
let currentEmbed = null;
let currentEvents = [];
let activeUnitTab = "general";
let dirty = false;
let contentType = "pages";
let currentContent = { pages: [], custom_pages: [], events: [], information: [] };
let dedicatedModules = [];
let dedicatedNavigation = [];
let eventMediaAssets = [];
let dialogMediaAssets = [];
const guestPortalEditor = createGuestPortalEditor({
  root: els.guestPortalEditor,
  hotelSelect: els.contentHotel,
  onHeading: setHeading,
});

const auth = createAdminAuthView({
  onAuthenticated(session) {
    currentSession = session;
    renderPortals(session);
  },
  onLoggedOut() {
    currentSession = null;
    currentAssets = [];
    currentFolders = [];
    currentShortLinks = [];
    currentShortLinkPublicBase = "";
    currentUnits = [];
    currentUnit = null;
    currentEvents = [];
  },
});

els.mediaFilters.addEventListener("submit", (event) => {
  event.preventDefault();
  loadMediaLibrary();
});
els.mediaSearch.addEventListener("input", debounce(() => loadMediaLibrary(), 300));
els.mediaHotel.addEventListener("change", () => {
  currentMediaFolderId = null;
  loadMediaLibrary();
});
els.mediaModule.addEventListener("change", () => loadMediaLibrary());
els.mediaStatus.addEventListener("change", () => loadMediaLibrary());
els.mediaUploadForm.addEventListener("submit", handleMediaUpload);
els.mediaGrid.addEventListener("click", handleMediaAction);
els.mediaGrid.addEventListener("click", handleFolderAction);
els.mediaGrid.addEventListener("dragstart", handleMediaDragStart);
els.mediaGrid.addEventListener("dragstart", handleFolderDragStart);
els.mediaGrid.addEventListener("dragover", handleFolderDragOver);
els.mediaGrid.addEventListener("dragleave", handleFolderDragLeave);
els.mediaGrid.addEventListener("drop", handleFolderDrop);
els.mediaBreadcrumbs.addEventListener("click", handleFolderAction);
els.mediaNewFolderButton.addEventListener("click", () => openMediaFolderDialog());
els.mediaUploadToggle.addEventListener("click", toggleMediaUploadPanel);
els.mediaViewGrid.addEventListener("click", () => setMediaView("grid"));
els.mediaViewList.addEventListener("click", () => setMediaView("list"));
els.mediaRootDropTarget.addEventListener("click", () => openMediaFolder(null));
els.mediaRootDropTarget.addEventListener("dragover", handleRootDragOver);
els.mediaRootDropTarget.addEventListener("dragleave", handleRootDragLeave);
els.mediaRootDropTarget.addEventListener("drop", handleRootDrop);
els.mediaUploadForm.addEventListener("dragover", handleUploadDragOver);
els.mediaUploadForm.addEventListener("dragleave", handleUploadDragLeave);
els.mediaUploadForm.addEventListener("drop", handleUploadDrop);
els.mediaFolderForm.addEventListener("submit", saveMediaFolder);
els.mediaFolderDialog.querySelector("[data-media-folder-cancel]").addEventListener("click", closeMediaFolderDialog);
els.mediaMoveForm.addEventListener("submit", saveMediaMove);
els.mediaMoveDialog.querySelector("[data-media-move-cancel]").addEventListener("click", closeMediaMoveDialog);
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
els.copyShortLinkQrButton.addEventListener("click", copyCurrentShortLinkUrl);
els.shortLinkSharingForm.addEventListener("submit", shareCurrentShortLink);
els.shortLinkSharesList.addEventListener("click", revokeCurrentShortLinkShare);
els.eventsFilters.addEventListener("submit", (event) => {
  event.preventDefault();
  renderEventsList();
});
els.eventsHotel.addEventListener("change", loadEventsManager);
els.eventsStatus.addEventListener("change", renderEventsList);
els.eventsSearch.addEventListener("input", debounce(renderEventsList, 250));
els.addEventButton.addEventListener("click", () => openEventEditor());
els.eventsList.addEventListener("click", handleEventAction);

els.unitFilters.addEventListener("submit", (event) => {
  event.preventDefault();
  loadUnits();
});
els.unitSearch.addEventListener("input", debounce(() => loadUnits(), 250));
els.unitStatus.addEventListener("change", () => loadUnits());
els.addUnitButton.addEventListener("click", () => openNewUnit());
els.backToUnitsButton.addEventListener("click", () => {
  if (dirty && !window.confirm("Existem alterações não salvas. Voltar mesmo assim?")) return;
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
els.areasHotel.addEventListener("change", loadDedicatedAreas);
els.areasList.addEventListener("change", saveDedicatedArea);
els.areasList.addEventListener("click", handleAreaImageAction);
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
els.dialog.addEventListener("change", handleInlineMediaUpload);

auth.boot();
document.addEventListener("click", handlePortalNavigation);
window.addEventListener("popstate", handlePortalHistory);

window.addEventListener("fioreze:admin-refresh", (event) => {
  if (!currentSession) return;
  event.preventDefault();
  Promise.resolve(refreshCurrentPortalRoute()).finally(() => event.detail?.complete?.());
});

function refreshCurrentPortalRoute() {
  if (isMediaRoute()) return loadMediaLibrary();
  if (isLinksRoute()) return loadShortLinks();
  if (isEventsRoute()) return loadEventsManager();
  if (isContentRoute()) return guestPortalEditor.refresh();
  if (isAreasRoute() || isNavigationRoute()) return renderContentManager(currentSession);
  if (isAuditRoute()) return loadAudit();
  if (isUnitsRoute()) return currentUnit?.hotel_id ? openExistingUnit(currentUnit.hotel_id) : loadUnits();
  return renderHome(currentSession);
}

function handlePortalNavigation(event) {
  const link = event.target.closest('a[href^="/admin/portais/"]');
  if (
    !link ||
    !currentSession ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link.target ||
    link.hasAttribute("download")
  ) {
    return;
  }
  const target = new URL(link.href, window.location.origin);
  if (target.origin !== window.location.origin || !isPortalsShellPath(target.pathname)) return;
  event.preventDefault();
  navigatePortalRoute(`${target.pathname}${target.search}${target.hash}`);
}

function handlePortalHistory() {
  if (!currentSession || !isPortalsShellPath(window.location.pathname)) return;
  guestPortalEditor.dismiss();
  closeShortLinkEditor();
  closePortalsDialog();
  syncAdminNavigationActiveState();
  renderPortals(currentSession);
  scrollPortalSurfaceToTop();
}

function navigatePortalRoute(path) {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === path) return;
  guestPortalEditor.dismiss();
  closeShortLinkEditor();
  closePortalsDialog();
  window.history.pushState({}, "", path);
  syncAdminNavigationActiveState();
  renderPortals(currentSession);
  scrollPortalSurfaceToTop();
}

function scrollPortalSurfaceToTop() {
  document.querySelector(".admin-portals-surface")?.scrollTo({ top: 0, behavior: "auto" });
  const dashboard = document.querySelector('[data-view="dashboard"]');
  dashboard?.classList.remove("is-menu-open");
  const backdrop = dashboard?.querySelector("[data-admin-backdrop]");
  if (backdrop) backdrop.hidden = true;
}

function isPortalsShellPath(pathname) {
  return pathname === "/admin/portais" || pathname.startsWith("/admin/portais/");
}

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
  if (isEventsRoute()) {
    renderEventsManager(session);
    return;
  }
  if (isContentRoute()) {
    renderContentManager(session);
    return;
  }
  if (isAreasRoute()) {
    navigateSoft("/admin/portais/portal-hospede/");
    renderContentManager(session);
    return;
  }
  if (isNavigationRoute()) {
    navigateSoft("/admin/portais/portal-hospede/");
    renderContentManager(session);
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
    ["Início", "/admin/portais/", true],
    ["Portal do Hóspede", "/admin/portais/portal-hospede/", canAccessContent(session)],
    ["Unidades", "/admin/portais/unidades/", canAccessUnits(session)],
    ["Biblioteca", "/admin/portais/media/", canAccessMediaLibrary(session)],
    ["Links", "/admin/portais/links/", canAccessLinks(session)],
    ["Eventos", "/admin/portais/eventos/", canAccessContent(session)],
  ];
  els.portalsNav.innerHTML = items
    .map(([label, href, enabled]) =>
      enabled
        ? `<a href="${href}" ${portalNavIsCurrent(href) ? 'aria-current="page"' : ""}>${label}</a>`
        : `<span aria-disabled="true">${label}</span>`,
    )
    .join("");
}

function portalNavIsCurrent(href) {
  if (href === "/admin/portais/") return window.location.pathname === href;
  return window.location.pathname.startsWith(href);
}

function renderHome(session) {
  setHeading("Central de Portais Fioreze", "Gerencie unidades, mídia, links e experiências digitais em um só lugar.");
  showPortalSection(els.portalsHome);
  els.portalsModules.innerHTML = portalCards.map(([key, title, body, href]) => renderPortalCard(session, key, title, body, href)).join("");
}

function renderPortalCard(session, key, title, body, href) {
  const enabled =
    (key === "unidades" && canAccessUnits(session)) ||
    (key === "media" && canAccessMediaLibrary(session)) ||
    (key === "links" && canAccessLinks(session)) ||
    (key === "eventos" && canAccessContent(session)) ||
    (key === "conteudos" && canAccessContent(session)) ||
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
  setHeading("Unidades", "Administre os hotéis, marcas, serviços e navegação dos portais.");
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
  setSectionBusy(els.unitsManager, true);
  const params = new URLSearchParams({ sort: "name" });
  if (els.unitSearch.value.trim()) params.set("q", els.unitSearch.value.trim());
  if (els.unitStatus.value) params.set("status", els.unitStatus.value);
  try {
    const payload = await adminApi(`/api/v1/admin/hotels?${params.toString()}`);
    currentUnits = payload.data.hotels || [];
    els.unitsMessage.textContent = `${currentUnits.length} unidade(s) encontrada(s).`;
    renderUnitsList();
  } catch (error) {
    els.unitsMessage.textContent = error.message || "Não foi possível carregar unidades.";
  } finally {
    setSectionBusy(els.unitsManager, false);
  }
}

function renderUnitsList() {
  if (!currentUnits.length) {
    els.unitsList.innerHTML = '<div class="admin-empty">Nenhuma unidade disponível para este usuário.</div>';
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
        <small>${escapeHtml(unit.settings?.["contact.city"] || "Cidade não informada")}</small>
      </div>
      <span class="admin-status">${escapeHtml(unit.status)}</span>
      <span>${Number(unit.active_module_count || 0)} módulos</span>
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
  setSectionBusy(els.unitsManager, true);
  try {
    const [hotel, embed] = await Promise.all([
      adminApi(`/api/v1/admin/hotels/${encodeURIComponent(hotelId)}`),
      hasPermission(currentSession, PORTALS_EMBED_READ_PERMISSION)
        ? adminApi(`/api/v1/admin/hotels/${encodeURIComponent(hotelId)}/embed`)
        : Promise.resolve({ data: { embed: null, modules: [] } }),
    ]);
    currentUnit = hotel.data.hotel;
    currentModules = [];
    currentNavigation = [];
    currentEmbed = embed.data;
    dirty = false;
    renderUnitEditor();
  } catch (error) {
    els.unitEditorForm.innerHTML = `<div class="admin-empty">${escapeHtml(error.message || "Unidade indisponível.")}</div>`;
  } finally {
    setSectionBusy(els.unitsManager, false);
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
    ${field("Endereço personalizado", "slug", currentUnit.slug, "text", "hotel-exemplo", currentUnit.hotel_id ? "" : "Define o endereço público da unidade.")}
    <div class="admin-form-grid">
      ${selectField("Status", "status", currentUnit.status, ["active", "inactive", "archived"])}
      ${field("Timezone", "timezone", currentUnit.timezone || "America/Sao_Paulo")}
      ${field("Locale", "locale", currentUnit.locale || "pt-BR")}
      ${field("Moeda", "currency", currentUnit.currency || "BRL")}
    </div>
    ${textarea("Descrição curta", "general.short_description")}
    ${textarea("Descrição institucional", "general.institutional_description")}
    ${field("Feed do blog", "portal.blog_feed_url", setting("portal.blog_feed_url"), "url", "https://blog.hoteisfioreze.com.br/wp-json/wp/v2/posts")}
    ${field("Inauguração", "general.opened_at", setting("general.opened_at"), "date")}
    <button type="button" class="admin-copy-button" data-copy-slug>Copiar slug e URL</button>
  `;
  panel("branding").innerHTML = isNewUnitBlockedTab("branding")
    ? blockedMessage
    : `
    <div class="admin-form-grid">
      ${colorField("Cor primária", "primary_color")}
      ${colorField("Cor secundária", "secondary_color")}
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
    ${fontSelectField("Fonte dos portais", "font_family", currentUnit.branding?.font_family)}
    ${mediaPicker("font_asset_id", "Fonte personalizada")}
  `;
  panel("contact").innerHTML = isNewUnitBlockedTab("contact")
    ? blockedMessage
    : `
    <div class="admin-form-grid">
      ${field("Endereço", "contact.address", setting("contact.address"))}
      ${field("Número", "contact.number", setting("contact.number"))}
      ${field("Complemento", "contact.complement", setting("contact.complement"))}
      ${field("Bairro", "contact.district", setting("contact.district"))}
      ${field("Cidade", "contact.city", setting("contact.city"))}
      ${field("Estado", "contact.state", setting("contact.state"))}
      ${field("CEP", "contact.postal_code", setting("contact.postal_code"))}
      ${field("País", "contact.country", setting("contact.country") || "Brasil")}
      ${field("Latitude", "contact.latitude", setting("contact.latitude"), "number")}
      ${field("Longitude", "contact.longitude", setting("contact.longitude"), "number")}
      ${field("Telefone", "contact.phone", setting("contact.phone"))}
      ${field("WhatsApp", "contact.whatsapp", setting("contact.whatsapp"))}
      ${field("E-mail", "contact.email", setting("contact.email"), "email")}
      ${field("Site", "contact.website", setting("contact.website"), "url")}
      ${field("Google Maps ou Place", "contact.maps_url", setting("contact.maps_url"))}
    </div>
    ${mapsEmbedField()}
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
    : '<div class="admin-empty">Salve a unidade antes de gerenciar módulos.</div>';
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
    ${field("Título do portal", "seo.title", setting("seo.title"))}
    ${textarea("Descrição para buscadores", "seo.description")}
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
    renderTabTransition(() => {
      activeUnitTab = tab.dataset.unitTab;
      renderUnitEditor();
    });
    return;
  }
  const pick = event.target.closest("[data-pick-media]");
  if (pick) {
    openMediaSelector(pick.dataset.pickMedia);
    return;
  }
  const remove = event.target.closest("[data-remove-media]");
  if (remove) {
    const fieldName = remove.dataset.removeMedia;
    setInputValue(fieldName, "");
    setInputValue(`${fieldName}__preview`, "");
    setInputValue(`${fieldName}__mime`, "");
    updateMediaPickerSelection(fieldName, null);
    dirty = true;
    updateDirtyState();
    updatePreview();
    return;
  }
  const addMap = event.target.closest("[data-add-map-embed]");
  if (addMap) {
    const list = els.unitEditorForm.querySelector("[data-map-embed-list]");
    const index = list?.querySelectorAll("[data-map-embed-row]").length || 0;
    if (index >= 6) {
      setMessage("Cada unidade pode ter ate 6 mapas incorporados.");
      return;
    }
    list?.insertAdjacentHTML("beforeend", renderMapEmbedRow("", index));
    dirty = true;
    updateDirtyState();
    list?.querySelector("[data-map-embed-row]:last-child input")?.focus();
    return;
  }
  const removeMap = event.target.closest("[data-remove-map-embed]");
  if (removeMap) {
    const list = els.unitEditorForm.querySelector("[data-map-embed-list]");
    const rows = [...(list?.querySelectorAll("[data-map-embed-row]") || [])];
    const row = removeMap.closest("[data-map-embed-row]");
    if (rows.length > 1) row?.remove();
    else if (row) row.querySelector("input").value = "";
    renumberMapEmbedRows(list);
    dirty = true;
    updateDirtyState();
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
    setMessage("Salve a unidade antes de selecionar arquivos.");
    return;
  }
  const params = new URLSearchParams({ hotel_id: currentUnit.hotel_id, status: "active" });
  const payload = await adminApi(`/api/v1/admin/media?${params.toString()}`);
  const allowVideo = fieldName === "cover_image_url";
  const fontOnly = fieldName === "font_asset_id";
  const assets = (payload.data.assets || []).filter((asset) => {
    const mimeType = String(asset.mime_type || "");
    if (fontOnly) return mimeType === "font/woff" || mimeType === "font/woff2";
    return mimeType.startsWith("image/") || (allowVideo && mimeType.startsWith("video/"));
  });
  dialogMediaAssets = assets;
  const currentRef = inputValue(fieldName);
  els.dialogTitle.textContent = `Selecionar ${mediaLabel(fieldName).toLowerCase()}`;
  els.dialogBody.innerHTML = contentForm("identity-media", `
    <fieldset class="admin-content-media-picker admin-identity-media-picker">
      <legend>Biblioteca de Mídia</legend>
      <p>${fontOnly ? "Escolha uma fonte WOFF ou WOFF2." : allowVideo ? "Escolha uma imagem ou vídeo. Vídeos serão exibidos somente no portal desktop." : "Escolha uma imagem ativa desta unidade."} Você também pode enviar um novo arquivo agora.</p>
      ${inlineMediaUploadControl({ context: "identity", hotelId: currentUnit.hotel_id, allowVideo, fontOnly })}
      <div data-inline-media-options>
        <label class="admin-content-media-option no-media">
          <input type="radio" name="media_asset_id" value="" ${currentRef ? "" : "checked"}>
          <span>${featureSvg("image")}<strong>Sem arquivo</strong></span>
        </label>
        ${assets.map((asset) => renderIdentityMediaOption(asset, currentRef)).join("")}
      </div>
    </fieldset>`);
  openPortalsDialog();
  bindDialogForm((event) => {
    event.preventDefault();
    const selectedId = new FormData(event.currentTarget).get("media_asset_id") || "";
    const selected = dialogMediaAssets.find((asset) => asset.id === selectedId) || null;
    setInputValue(fieldName, selected?.id || "");
    setInputValue(`${fieldName}__preview`, selected?.public_url || "");
    setInputValue(`${fieldName}__mime`, selected?.mime_type || "");
    updateMediaPickerSelection(fieldName, selected);
    dirty = true;
    updateDirtyState();
    updatePreview();
    setMessage(selected ? `Arquivo selecionado: ${selected.original_filename || selected.id}` : "Arquivo removido da identidade.");
    closePortalsDialog();
  });
}

function renderIdentityMediaOption(asset, currentRef) {
  const mimeType = String(asset.mime_type || "");
  const isVideo = mimeType.startsWith("video/");
  const isFont = mimeType.startsWith("font/");
  const checked = asset.id === currentRef || asset.public_url === currentRef;
  const preview = isFont
    ? `<span class="admin-font-file-preview">Aa</span>`
    : isVideo
    ? `<video src="${escapeAttr(asset.public_url)}" muted playsinline preload="metadata"></video>`
    : `<img src="${escapeAttr(asset.public_url)}" alt="" loading="lazy" decoding="async">`;
  return `<label class="admin-content-media-option"><input type="radio" name="media_asset_id" value="${escapeAttr(asset.id)}" ${checked ? "checked" : ""}><span>${preview}<strong>${escapeHtml(asset.original_filename || (isFont ? "Fonte" : isVideo ? "Vídeo" : "Imagem"))}</strong></span></label>`;
}

function inlineMediaUploadControl({ context, hotelId, moduleKey = "guest-portal", allowVideo = false, fontOnly = false }) {
  if (!hasPermission(currentSession, PORTALS_MEDIA_UPLOAD_PERMISSION)) return "";
  const accept = fontOnly
    ? ".woff,.woff2,font/woff,font/woff2"
    : allowVideo
    ? "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime"
    : "image/jpeg,image/png,image/webp,image/avif";
  return `
    <div class="admin-inline-media-upload">
      <label>
        <input
          type="file"
          data-inline-media-upload
          data-upload-context="${escapeAttr(context)}"
          data-upload-hotel="${escapeAttr(hotelId)}"
          data-upload-module="${escapeAttr(moduleKey)}"
          accept="${accept}"
        >
        <span>${featureSvg("upload")} Enviar novo arquivo</span>
      </label>
      <small data-inline-media-status>O arquivo será salvo na Biblioteca de Mídia desta unidade.</small>
    </div>`;
}

async function handleInlineMediaUpload(event) {
  const input = event.target.closest("[data-inline-media-upload]");
  const file = input?.files?.[0];
  if (!input || !file || !hasPermission(currentSession, PORTALS_MEDIA_UPLOAD_PERMISSION)) return;
  const status = input.closest(".admin-inline-media-upload")?.querySelector("[data-inline-media-status]");
  const context = input.dataset.uploadContext;
  const form = new FormData();
  form.set("hotel_id", input.dataset.uploadHotel);
  form.set("module_key", input.dataset.uploadModule || "guest-portal");
  form.set("file", file);
  input.disabled = true;
  if (status) status.textContent = "Enviando arquivo...";
  try {
    const payload = await adminApi("/api/v1/admin/media", { method: "POST", body: form });
    const asset = payload.data.asset;
    dialogMediaAssets = [asset, ...dialogMediaAssets.filter((item) => item.id !== asset.id)];
    if (context === "event") {
      eventMediaAssets = [asset, ...eventMediaAssets.filter((item) => item.id !== asset.id)];
      const picker = input.closest(".admin-content-media-picker");
      if (picker) picker.outerHTML = renderEventMediaPicker(asset.id);
      return;
    }
    const options = els.dialogBody.querySelector("[data-inline-media-options]");
    options?.querySelectorAll('input[name="media_asset_id"]').forEach((radio) => {
      radio.checked = false;
    });
    options?.insertAdjacentHTML("beforeend", renderIdentityMediaOption(asset, asset.id));
    if (status) status.textContent = "Arquivo enviado e selecionado.";
  } catch (error) {
    if (status) status.textContent = error.message || "Não foi possível enviar o arquivo.";
  } finally {
    input.disabled = false;
    input.value = "";
  }
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
      await saveEmbed();
    }
    dirty = false;
    setMessage("Unidade salva com sucesso.");
    if (currentUnit.hotel_id) await openExistingUnit(currentUnit.hotel_id);
  } catch (error) {
    setMessage(error.message || "Não foi possível salvar.");
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
    ...brandingAssetFields,
  ]) {
    const value = inputValue(fieldName);
    if (brandingAssetFields.includes(fieldName)) {
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
    if (fieldName === "contact.maps_embed_urls") continue;
    const input = els.unitEditorForm.elements[fieldName];
    if (input && input.value.trim() !== "") body[fieldName] = input.value.trim();
  }
  const mapsEmbedUrls = [...els.unitEditorForm.querySelectorAll('[name="contact.maps_embed_url"]')]
    .map((input) => extractMapEmbedUrl(input.value))
    .filter(Boolean);
  const currentMaps = Array.isArray(setting("contact.maps_embed_urls")) ? setting("contact.maps_embed_urls") : [];
  if (JSON.stringify(mapsEmbedUrls) !== JSON.stringify(currentMaps)) {
    body["contact.maps_embed_urls"] = mapsEmbedUrls;
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
    if (!window.confirm("Arquivar este item de navegação?")) return;
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
  setHeading("Links e QR Codes", "Centralize endereços curtos, QR Codes e métricas de acesso das unidades.");
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
  setSectionBusy(els.shortLinksManager, true);
  const params = new URLSearchParams({
    hotel_id: els.shortLinksHotel.value,
    sort: els.shortLinksSort.value || "created",
  });
  if (els.shortLinksStatus.value) params.set("status", els.shortLinksStatus.value);
  if (els.shortLinksSearch.value.trim()) params.set("q", els.shortLinksSearch.value.trim());

  try {
    const payload = await adminApi(`/api/v1/admin/short-links?${params.toString()}`);
    currentShortLinks = payload.data.links || [];
    currentShortLinkPublicBase = String(payload.data.public_url_base || "").replace(/\/$/, "");
    els.shortLinksMessage.textContent = `${currentShortLinks.length} link(s) encontrado(s).`;
    renderShortLinksSummary();
    renderShortLinksList();
  } catch (error) {
    currentShortLinks = [];
    currentShortLinkPublicBase = "";
    els.shortLinksSummary.innerHTML = "";
    els.shortLinksList.innerHTML = "";
    els.shortLinksMessage.textContent = error.message || "Não foi possível carregar os links.";
  } finally {
    setSectionBusy(els.shortLinksManager, false);
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
    els.shortLinksList.innerHTML = '<div class="admin-empty">Nenhum link encontrado para estes filtros.</div>';
    return;
  }
  els.shortLinksList.innerHTML = currentShortLinks.map(renderShortLinkRow).join("");
}

function renderShortLinkRow(link) {
  const canManage = link.can_manage === true;
  const canUpdate = canManage && hasPermission(currentSession, PORTALS_LINKS_UPDATE_PERMISSION) && link.status !== "archived";
  const canArchive = canManage && hasPermission(currentSession, PORTALS_LINKS_ARCHIVE_PERMISSION) && link.status !== "archived";
  const canDelete = canManage && hasPermission(currentSession, PORTALS_LINKS_DELETE_PERMISSION) && link.status === "archived";
  return `
    <article class="admin-short-link-row admin-link-card">
      <span class="admin-link-card-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/></svg>
      </span>
      <div class="admin-link-card-copy">
        <div class="admin-link-card-heading"><strong>${escapeHtml(link.internal_name)}</strong><span class="admin-status" data-status="${escapeAttr(link.status)}">${escapeHtml(shortLinkStatus(link.status))}</span><span class="admin-link-access-badge" data-access="${escapeAttr(link.access_level)}">${canManage ? "Criado por você" : "Compartilhado com você"}</span></div>
        <a href="${escapeAttr(link.public_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.public_url)}</a>
        <small>Destino: ${escapeHtml(link.destination_summary || link.destination_scheme)}</small>
      </div>
      <div class="admin-link-card-metrics">
        <span><strong>${Number(link.total_clicks || 0)}</strong> cliques</span>
        <span>${link.last_clicked_at ? `Último acesso ${escapeHtml(formatDate(link.last_clicked_at, link.hotel_timezone))}` : "Ainda sem acessos"}</span>
        <small>${escapeHtml(link.hotel_name || link.hotel_id)}</small>
      </div>
      <div class="admin-row-actions admin-link-card-actions">
        ${shortLinkActionButton("edit", link.id, canManage ? "Abrir" : "Visualizar")}
        ${shortLinkActionButton("copy", link.id, "Copiar")}
        ${shortLinkActionButton("qr", link.id, "QR Code")}
        ${canUpdate ? shortLinkActionButton("share", link.id, "Compartilhar") : ""}
        ${canUpdate ? shortLinkActionButton("toggle", link.id, link.status === "active" ? "Pausar" : "Reativar", link.status === "active" ? "pause" : "play") : ""}
        ${canArchive ? shortLinkActionButton("archive", link.id, "Arquivar", "archive", true) : ""}
        ${canDelete ? shortLinkActionButton("delete", link.id, "Excluir", "delete", true) : ""}
      </div>
    </article>
  `;
}

function shortLinkActionButton(action, linkId, label, icon = action, danger = false) {
  const paths = {
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 14h2v2h-2zM18 14h2v4h-2zM14 18h4v2h-4z"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    archive: '<path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/>',
    delete: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  };
  return `<button class="${danger ? "danger" : ""}" type="button" data-link-action="${escapeAttr(action)}" data-link-id="${escapeAttr(linkId)}"><svg aria-hidden="true" viewBox="0 0 24 24">${paths[icon] || paths.edit}</svg><span>${escapeHtml(label)}</span></button>`;
}

function openShortLinkEditor(link = null, defaults = {}) {
  currentShortLink = link;
  document.documentElement.classList.add("short-link-editor-open");
  els.shortLinksEditor.hidden = false;
  const canManage = !link || link.can_manage === true;
  els.shortLinksEditorTitle.textContent = link ? (canManage ? "Editar link personalizado" : "Detalhes do link compartilhado") : "Novo link personalizado";
  const form = els.shortLinksForm;
  form.elements.hotel_id.value = link?.hotel_id || defaults.hotel_id || els.shortLinksHotel.value || getAuthorizedHotels(currentSession)[0]?.hotel_id || "";
  form.elements.internal_name.value = link?.internal_name || defaults.internal_name || "";
  form.elements.slug.value = link?.slug || defaults.slug || "";
  form.elements.slug.disabled = Boolean(link) || !canManage;
  form.elements.destination_url.value = link?.destination_url || defaults.destination_url || "";
  form.elements.status.value = link?.status === "archived" ? "paused" : link?.status || "active";
  form.elements.starts_at.value = toLocalDateTime(link?.starts_at);
  form.elements.expires_at.value = toLocalDateTime(link?.expires_at);
  form.elements.notes.value = link?.notes || "";
  for (const control of form.elements) {
    if (!control.name || control.name === "hotel_id" || control.name === "slug") continue;
    control.disabled = !canManage;
  }
  form.querySelector('[type="submit"]').hidden = !canManage;
  renderShortLinkAnalytics(null);
  renderShortLinkQr(link);
  resetShortLinkSharing();
  updateShortLinkPreview();
  if (link && hasPermission(currentSession, PORTALS_LINKS_ANALYTICS_PERMISSION)) loadShortLinkAnalytics(link.id);
  if (link && canManage && hasPermission(currentSession, PORTALS_LINKS_UPDATE_PERMISSION)) loadShortLinkShares(link.id);
  window.requestAnimationFrame(() => els.shortLinksEditor.scrollTo({ top: 0, behavior: "auto" }));
}

function closeShortLinkEditor() {
  currentShortLink = null;
  document.documentElement.classList.remove("short-link-editor-open");
  els.shortLinksEditor.hidden = true;
  els.shortLinksForm.reset();
  els.shortLinksPreview.textContent = "";
  for (const control of els.shortLinksForm.elements) control.disabled = false;
  els.shortLinksForm.querySelector('[type="submit"]').hidden = false;
  renderShortLinkQr(null);
  renderShortLinkAnalytics(null);
  resetShortLinkSharing();
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
    els.shortLinksMessage.textContent = error.message || "Não foi possível salvar o link.";
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
  if (action === "qr") {
    openShortLinkEditor(link);
    els.shortLinkQrPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  if (action === "share") {
    openShortLinkEditor(link);
    els.shortLinkSharingPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  if (action === "toggle") {
    await updateShortLinkStatus(link, link.status === "active" ? "paused" : "active");
    return;
  }
  if (action === "archive") {
    if (!window.confirm("Arquivar este link? O histórico agregado de cliques será preservado.")) return;
    await archiveShortLink(link);
    return;
  }
  if (action === "delete") {
    const confirmation = window.prompt(`Digite ${link.slug} para excluir este link definitivamente.`);
    if (confirmation !== link.slug) return;
    await deleteShortLink(link);
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
    els.shortLinksMessage.textContent = error.message || "Não foi possível atualizar o status.";
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
    els.shortLinksMessage.textContent = error.message || "Não foi possível arquivar o link.";
  }
}

async function deleteShortLink(link) {
  try {
    await adminApi(`/api/v1/admin/short-links/${encodeURIComponent(link.id)}/permanent`, {
      method: "DELETE",
      body: {},
    });
    closeShortLinkEditor();
    await loadShortLinks();
  } catch (error) {
    els.shortLinksMessage.textContent = error.message || "Não foi possível excluir o link.";
  }
}

function renderShortLinkQr(link) {
  els.shortLinkQrPanel.hidden = !link;
  if (!link) {
    els.shortLinkQrImage.removeAttribute("src");
    els.shortLinkQrDownload.href = "#";
    els.shortLinkQrUrl.textContent = "";
    return;
  }
  const endpoint = `/api/v1/admin/short-links/${encodeURIComponent(link.id)}/qrcode.svg`;
  els.shortLinkQrImage.src = endpoint;
  els.shortLinkQrDownload.href = `${endpoint}?download=1`;
  els.shortLinkQrUrl.textContent = link.public_url;
}

async function copyCurrentShortLinkUrl() {
  if (!currentShortLink?.public_url) return;
  await navigator.clipboard?.writeText(currentShortLink.public_url);
  els.copyShortLinkQrButton.textContent = "Endereço copiado";
  window.setTimeout(() => {
    els.copyShortLinkQrButton.textContent = "Copiar endereço";
  }, 1600);
}

async function loadShortLinkShares(linkId) {
  els.shortLinkSharingPanel.hidden = false;
  els.shortLinkSharingPanel.setAttribute("aria-busy", "true");
  try {
    const payload = await adminApi(`/api/v1/admin/short-links/${encodeURIComponent(linkId)}/shares`);
    currentShortLinkShareUsers = payload.data.users || [];
    renderShortLinkShares();
    els.shortLinkSharingMessage.textContent = "";
  } catch (error) {
    currentShortLinkShareUsers = [];
    renderShortLinkShares();
    els.shortLinkSharingMessage.textContent = error.message || "Não foi possível carregar o compartilhamento.";
  } finally {
    els.shortLinkSharingPanel.removeAttribute("aria-busy");
  }
}

function renderShortLinkShares() {
  const available = currentShortLinkShareUsers.filter((user) => !user.shared);
  const shared = currentShortLinkShareUsers.filter((user) => user.shared);
  els.shortLinkShareUser.innerHTML = available.length
    ? `<option value="">Selecione uma pessoa</option>${available.map((user) => `<option value="${escapeAttr(user.id)}">${escapeHtml(user.display_name)} · ${escapeHtml(maskEmail(user.email))}</option>`).join("")}`
    : '<option value="">Todos os usuários disponíveis já têm acesso</option>';
  els.shortLinkShareUser.disabled = available.length === 0;
  els.shortLinkSharingForm.querySelector('button[type="submit"]').disabled = available.length === 0;
  els.shortLinkSharesList.innerHTML = shared.length
    ? shared.map((user) => `<article><span class="admin-link-share-avatar">${escapeHtml(initials(user.display_name))}</span><div><strong>${escapeHtml(user.display_name)}</strong><small>${escapeHtml(maskEmail(user.email))} · Pode visualizar</small></div><button type="button" data-share-revoke="${escapeAttr(user.id)}">Remover acesso</button></article>`).join("")
    : '<div class="admin-empty">Este link ainda não foi compartilhado.</div>';
}

async function shareCurrentShortLink(event) {
  event.preventDefault();
  if (!currentShortLink?.can_manage || !els.shortLinkShareUser.value) return;
  try {
    await adminApi(`/api/v1/admin/short-links/${encodeURIComponent(currentShortLink.id)}/shares`, {
      method: "POST",
      body: { user_id: els.shortLinkShareUser.value },
    });
    els.shortLinkSharingMessage.textContent = "Acesso compartilhado.";
    await loadShortLinkShares(currentShortLink.id);
  } catch (error) {
    els.shortLinkSharingMessage.textContent = error.message || "Não foi possível compartilhar o link.";
  }
}

async function revokeCurrentShortLinkShare(event) {
  const button = event.target.closest("[data-share-revoke]");
  if (!button || !currentShortLink?.can_manage) return;
  try {
    await adminApi(`/api/v1/admin/short-links/${encodeURIComponent(currentShortLink.id)}/shares/${encodeURIComponent(button.dataset.shareRevoke)}`, {
      method: "DELETE",
      body: {},
    });
    els.shortLinkSharingMessage.textContent = "Acesso removido.";
    await loadShortLinkShares(currentShortLink.id);
  } catch (error) {
    els.shortLinkSharingMessage.textContent = error.message || "Não foi possível remover o acesso.";
  }
}

function resetShortLinkSharing() {
  currentShortLinkShareUsers = [];
  els.shortLinkSharingPanel.hidden = true;
  els.shortLinkSharingMessage.textContent = "";
  els.shortLinkShareUser.innerHTML = "";
  els.shortLinkSharesList.innerHTML = "";
}

function maskEmail(email) {
  const [name = "", domain = ""] = String(email || "").split("@");
  return `${name.slice(0, 2)}${name.length > 2 ? "•••" : ""}${domain ? `@${domain}` : ""}`;
}

function initials(name) {
  return String(name || "U").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function shortLinkStatus(status) {
  return ({ active: "Ativo", paused: "Pausado", archived: "Arquivado" })[status] || status;
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
    els.shortLinksAnalytics.innerHTML = '<div class="admin-empty">Métricas agregadas aparecem aqui após o primeiro acesso.</div>';
    return;
  }
  els.shortLinksAnalytics.innerHTML = `
    <div class="admin-short-link-analytics">
      <article><span>Total</span><strong>${Number(analytics.total_clicks || 0)}</strong></article>
      <article><span>7 dias</span><strong>${Number(analytics.last_7_days || 0)}</strong></article>
      <article><span>30 dias</span><strong>${Number(analytics.last_30_days || 0)}</strong></article>
      <article><span>Último acesso</span><strong>${analytics.last_clicked_at ? escapeHtml(formatDate(analytics.last_clicked_at)) : "Nenhum"}</strong></article>
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
  const base = currentShortLinkPublicBase || `${window.location.origin}/go`;
  return `${base}/${safeSlug}`;
}

function renderMediaLibrary(session) {
  setHeading("Biblioteca de mídia", "Organize e reutilize imagens, vídeos e fontes de cada unidade.");
  const allowed = canAccessMediaLibrary(session);
  showPortalSection(allowed ? els.mediaLibrary : null);
  els.portalsDenied.hidden = allowed;
  if (!allowed) return;

  populateHotelSelect(session);
  els.mediaUploadToggle.hidden = !hasPermission(session, PORTALS_MEDIA_UPLOAD_PERMISSION);
  els.mediaNewFolderButton.hidden = !hasPermission(session, PORTALS_MEDIA_UPDATE_PERMISSION);
  els.mediaUploadForm.hidden = true;
  setMediaView(currentMediaView, false);
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
  setSectionBusy(els.mediaLibrary, true);
  const params = new URLSearchParams({
    hotel_id: els.mediaHotel.value,
    status: els.mediaStatus.value,
    folder_id: currentMediaFolderId || "root",
  });
  if (els.mediaModule.value.trim()) params.set("module_key", els.mediaModule.value.trim());
  if (els.mediaSearch.value.trim()) params.set("q", els.mediaSearch.value.trim());
  const folderParams = new URLSearchParams({ hotel_id: els.mediaHotel.value });
  if (currentMediaFolderId) folderParams.set("parent_id", currentMediaFolderId);

  try {
    const [assetPayload, folderPayload] = await Promise.all([
      adminApi(`/api/v1/admin/media?${params.toString()}`),
      adminApi(`/api/v1/admin/media-folders?${folderParams.toString()}`),
    ]);
    currentAssets = assetPayload.data.assets || [];
    currentFolders = folderPayload.data.folders || [];
    currentMediaStorage = assetPayload.data.storage || currentMediaStorage;
    currentMediaBreadcrumbs = folderPayload.data.breadcrumbs || [];
    els.mediaFolderId.value = currentMediaFolderId || "";
    renderMediaBreadcrumbs();
    renderMediaStorage();
    renderMediaItems();
  } catch (error) {
    currentAssets = [];
    currentFolders = [];
    els.mediaGrid.innerHTML = "";
    els.mediaError.textContent = error.message || "Não foi possível carregar a biblioteca.";
  } finally {
    setSectionBusy(els.mediaLibrary, false);
  }
}

async function handleMediaUpload(event) {
  event.preventDefault();
  if (!currentSession || !hasPermission(currentSession, PORTALS_MEDIA_UPLOAD_PERMISSION)) return;
  els.mediaError.textContent = "";
  els.mediaUploadStatus.textContent = "Enviando arquivo...";
  els.mediaUploadButton.disabled = true;

  const formData = new FormData(els.mediaUploadForm);
  formData.set("hotel_id", els.mediaHotel.value);
  formData.set("module_key", els.mediaModule.value.trim());
  formData.set("folder_id", currentMediaFolderId || "");

  try {
    await adminApi("/api/v1/admin/media", {
      method: "POST",
      body: formData,
    });
    els.mediaFile.value = "";
    els.mediaAltText.value = "";
    els.mediaUploadStatus.textContent = "Arquivo enviado.";
    await loadMediaLibrary();
  } catch (error) {
    els.mediaUploadStatus.textContent = "";
    els.mediaError.textContent = error.message || "Falha ao enviar arquivo.";
  } finally {
    els.mediaUploadButton.disabled = false;
  }
}

async function handleMediaAction(event) {
  const button = event.target.closest("[data-media-action]");
  const card = event.target.closest("[data-media-id]");
  if (!button) {
    if (card) card.classList.toggle("is-selected");
    return;
  }
  const asset = currentAssets.find((entry) => entry.id === button.dataset.mediaId);
  if (!asset) return;

  if (button.dataset.mediaAction === "copy") {
    await copyMediaUrl(asset.public_url);
    button.title = "URL copiada";
    button.setAttribute("aria-label", "URL copiada");
    return;
  }

  if (button.dataset.mediaAction === "open") {
    window.open(asset.public_url, "_blank", "noopener,noreferrer");
    return;
  }

  if (button.dataset.mediaAction === "edit-alt") {
    await editAltText(asset);
    return;
  }

  if (button.dataset.mediaAction === "move") {
    await openMediaMoveDialog(asset);
    return;
  }

  if (button.dataset.mediaAction === "archive") {
    await archiveAsset(asset);
  }
}

function toggleMediaUploadPanel() {
  if (!hasPermission(currentSession, PORTALS_MEDIA_UPLOAD_PERMISSION)) return;
  els.mediaUploadForm.hidden = !els.mediaUploadForm.hidden;
  els.mediaUploadToggle.setAttribute("aria-expanded", String(!els.mediaUploadForm.hidden));
  if (!els.mediaUploadForm.hidden) els.mediaFile.focus();
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
    els.mediaError.textContent = error.message || "Não foi possível atualizar o arquivo.";
  }
}

async function archiveAsset(asset) {
  if (!hasPermission(currentSession, PORTALS_MEDIA_ARCHIVE_PERMISSION)) return;
  if (!window.confirm("Excluir este arquivo da biblioteca? Ele será preservado para recuperação.")) return;
  try {
    await adminApi(`/api/v1/admin/media/${encodeURIComponent(asset.id)}`, {
      method: "DELETE",
      body: {},
    });
    await loadMediaLibrary();
  } catch (error) {
    els.mediaError.textContent = error.message || "Não foi possível excluir o arquivo.";
  }
}

function renderMediaItems() {
  const totalItems = currentFolders.length + currentAssets.length;
  els.mediaItemCount.textContent = `${totalItems} ${totalItems === 1 ? "item" : "itens"}`;
  if (!totalItems) {
    els.mediaGrid.innerHTML = `<div class="admin-media-empty">${driveIcon("media")}<strong>Nenhum arquivo nesta pasta</strong><span>Crie uma pasta ou envie uma imagem, vídeo ou fonte.</span></div>`;
    return;
  }

  els.mediaGrid.innerHTML = `${currentFolders.map(renderMediaFolderCard).join("")}${currentAssets.map(renderMediaCard).join("")}`;
}

function renderMediaCard(asset) {
  const canUpdate = hasPermission(currentSession, PORTALS_MEDIA_UPDATE_PERMISSION);
  const canArchive = hasPermission(currentSession, PORTALS_MEDIA_ARCHIVE_PERMISSION) && asset.status !== "archived";
  const mimeType = String(asset.mime_type || "");
  const isVideo = mimeType.startsWith("video/");
  const isFont = mimeType.startsWith("font/");
  const preview = isFont
    ? `<span class="admin-media-font-preview" aria-label="Prévia da fonte">Aa</span>`
    : isVideo
      ? `<video src="${escapeAttr(asset.public_url)}" aria-label="${escapeAttr(asset.alt_text || asset.original_filename || "Vídeo")}" muted playsinline preload="metadata"></video>`
      : `<img src="${escapeAttr(asset.public_url)}" alt="${escapeAttr(asset.alt_text || "")}" loading="lazy" decoding="async">`;
  return `
    <article class="admin-media-card" data-media-id="${escapeAttr(asset.id)}" draggable="${canUpdate}">
      <div class="admin-media-preview">
        ${preview}
        <span>${driveIcon(isFont ? "font" : isVideo ? "video" : "image")}</span>
      </div>
      <div class="admin-media-body">
        <strong>${escapeHtml(asset.original_filename || asset.id)}</strong>
        <span>${escapeHtml(formatBytes(asset.size_bytes))} · ${escapeHtml(asset.module_key || "Compartilhado")}</span>
        <p>${escapeHtml(asset.alt_text || "Sem descrição")}</p>
        <div class="admin-media-actions">
          <button type="button" data-media-action="open" data-media-id="${escapeAttr(asset.id)}" aria-label="Abrir arquivo" title="Abrir">${driveIcon("external")}</button>
          <button type="button" data-media-action="copy" data-media-id="${escapeAttr(asset.id)}" aria-label="Copiar URL" title="Copiar URL">${driveIcon("copy")}</button>
          ${
            canUpdate
              ? `<button type="button" data-media-action="move" data-media-id="${escapeAttr(asset.id)}" aria-label="Mover arquivo" title="Mover">${driveIcon("move")}</button>
                 <button type="button" data-media-action="edit-alt" data-media-id="${escapeAttr(asset.id)}" aria-label="Editar descrição" title="Editar descrição">${driveIcon("edit")}</button>`
              : ""
          }
          ${
            canArchive
              ? `<button class="danger" type="button" data-media-action="archive" data-media-id="${escapeAttr(asset.id)}" aria-label="Excluir arquivo" title="Excluir">${driveIcon("trash")}</button>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderMediaFolderCard(folder) {
  const canUpdate = hasPermission(currentSession, PORTALS_MEDIA_UPDATE_PERMISSION);
  return `
    <article class="admin-media-folder-card" data-folder-id="${escapeAttr(folder.id)}" draggable="${canUpdate}">
      <button type="button" data-folder-action="open" data-folder-id="${escapeAttr(folder.id)}">
        <span class="admin-folder-icon">${driveIcon("folder")}</span>
        <span><strong>${escapeHtml(folder.name)}</strong><small>${Number(folder.item_count || 0)} arquivo(s) · ${Number(folder.child_count || 0)} subpasta(s)</small></span>
      </button>
      ${
        canUpdate
          ? `<div class="admin-folder-actions">
              <button type="button" data-folder-action="rename" data-folder-id="${escapeAttr(folder.id)}" aria-label="Renomear ${escapeAttr(folder.name)}" title="Renomear">${driveIcon("edit")}</button>
              <button type="button" data-folder-action="archive" data-folder-id="${escapeAttr(folder.id)}" aria-label="Excluir ${escapeAttr(folder.name)}" title="Excluir">${driveIcon("trash")}</button>
            </div>`
          : ""
      }
    </article>`;
}

function renderMediaStorage() {
  const used = Number(currentMediaStorage.used_bytes || 0);
  const quota = Number(currentMediaStorage.quota_bytes || 0);
  const percent = Number(currentMediaStorage.percent_used || 0);
  els.mediaStorageUsed.textContent = formatBytes(used);
  els.mediaStorageLimit.textContent = quota ? formatBytes(quota) : "limite não informado";
  els.mediaStorageProgress.value = Math.min(100, Math.max(0, percent));
  els.mediaStorageProgress.setAttribute("aria-valuetext", `${percent.toFixed(2)}% utilizado`);
  const files = Number(currentMediaStorage.file_count || 0);
  els.mediaStorageFiles.textContent = `${files} ${files === 1 ? "arquivo armazenado" : "arquivos armazenados"}`;
}

function renderMediaBreadcrumbs() {
  const entries = [{ id: null, name: "Minha biblioteca" }, ...currentMediaBreadcrumbs];
  els.mediaBreadcrumbs.innerHTML = entries
    .map(
      (entry, index) =>
        `<button type="button" data-folder-action="breadcrumb" data-folder-id="${escapeAttr(entry.id || "root")}" ${
          index === entries.length - 1 ? 'aria-current="page"' : ""
        }>${index === 0 ? driveIcon("home") : ""}${escapeHtml(entry.name)}</button>${index < entries.length - 1 ? driveIcon("chevron") : ""}`,
    )
    .join("");
  els.mediaRootDropTarget.setAttribute("aria-current", String(currentMediaFolderId == null));
}

function handleFolderAction(event) {
  const action = event.target.closest("[data-folder-action]");
  if (!action) return;
  const folderId = action.dataset.folderId === "root" ? null : action.dataset.folderId;
  if (action.dataset.folderAction === "open" || action.dataset.folderAction === "breadcrumb") {
    openMediaFolder(folderId);
    return;
  }
  const folder = currentFolders.find((entry) => entry.id === folderId);
  if (!folder) return;
  if (action.dataset.folderAction === "rename") openMediaFolderDialog(folder);
  if (action.dataset.folderAction === "archive") void archiveMediaFolder(folder);
}

function openMediaFolder(folderId) {
  currentMediaFolderId = folderId || null;
  loadMediaLibrary();
}

function openMediaFolderDialog(folder = null) {
  if (!hasPermission(currentSession, PORTALS_MEDIA_UPDATE_PERMISSION)) return;
  editingMediaFolder = folder;
  els.mediaFolderDialogTitle.textContent = folder ? "Renomear pasta" : "Nova pasta";
  els.mediaFolderName.value = folder?.name || "";
  els.mediaFolderError.textContent = "";
  els.mediaFolderDialog.showModal();
  els.mediaFolderName.focus();
}

function closeMediaFolderDialog() {
  editingMediaFolder = null;
  els.mediaFolderDialog.close();
}

async function openMediaMoveDialog(asset) {
  if (!hasPermission(currentSession, PORTALS_MEDIA_UPDATE_PERMISSION)) return;
  movingMediaAsset = asset;
  els.mediaMoveName.textContent = asset.original_filename || asset.id;
  els.mediaMoveError.textContent = "";
  els.mediaMoveTarget.innerHTML = '<option value="">Selecione uma pasta</option>';
  els.mediaMoveTarget.disabled = true;
  els.mediaMoveDialog.showModal();
  try {
    const params = new URLSearchParams({ hotel_id: els.mediaHotel.value, all: "1" });
    const payload = await adminApi(`/api/v1/admin/media-folders?${params.toString()}`);
    const folders = payload.data.folders || [];
    const folderPaths = buildFolderPaths(folders);
    els.mediaMoveTarget.innerHTML = [
      '<option value="root">Minha biblioteca</option>',
      ...folders.map((folder) => `<option value="${escapeAttr(folder.id)}">${escapeHtml(folderPaths.get(folder.id) || folder.name)}</option>`),
    ].join("");
    els.mediaMoveTarget.value = asset.folder_id || "root";
    els.mediaMoveTarget.disabled = false;
    els.mediaMoveTarget.focus();
  } catch (error) {
    els.mediaMoveError.textContent = error.message || "Não foi possível carregar as pastas.";
  }
}

function closeMediaMoveDialog() {
  movingMediaAsset = null;
  if (els.mediaMoveDialog.open) els.mediaMoveDialog.close();
}

async function saveMediaMove(event) {
  event.preventDefault();
  if (!movingMediaAsset) return;
  const target = els.mediaMoveTarget.value === "root" ? null : els.mediaMoveTarget.value;
  els.mediaMoveError.textContent = "";
  try {
    await moveMediaAsset(movingMediaAsset.id, target, { reload: false });
    closeMediaMoveDialog();
    await loadMediaLibrary();
  } catch (error) {
    els.mediaMoveError.textContent = error.message || "Não foi possível mover o arquivo.";
  }
}

function buildFolderPaths(folders) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const paths = new Map();
  for (const folder of folders) {
    const names = [folder.name];
    const visited = new Set([folder.id]);
    let parentId = folder.parent_id;
    while (parentId && byId.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      names.unshift(parent.name);
      parentId = parent.parent_id;
    }
    paths.set(folder.id, names.join(" / "));
  }
  return paths;
}

async function saveMediaFolder(event) {
  event.preventDefault();
  const name = els.mediaFolderName.value.trim();
  if (!name) return;
  els.mediaFolderError.textContent = "";
  try {
    if (editingMediaFolder) {
      await adminApi(`/api/v1/admin/media-folders/${encodeURIComponent(editingMediaFolder.id)}`, {
        method: "PATCH",
        body: { name },
      });
    } else {
      await adminApi("/api/v1/admin/media-folders", {
        method: "POST",
        body: { hotel_id: els.mediaHotel.value, parent_id: currentMediaFolderId, name },
      });
    }
    closeMediaFolderDialog();
    await loadMediaLibrary();
  } catch (error) {
    els.mediaFolderError.textContent = error.message || "Não foi possível salvar a pasta.";
  }
}

async function archiveMediaFolder(folder) {
  if (!window.confirm(`Excluir a pasta "${folder.name}"? A pasta precisa estar vazia.`)) return;
  try {
    await adminApi(`/api/v1/admin/media-folders/${encodeURIComponent(folder.id)}`, { method: "DELETE", body: {} });
    await loadMediaLibrary();
  } catch (error) {
    els.mediaError.textContent = error.message || "Não foi possível excluir a pasta.";
  }
}

function handleMediaDragStart(event) {
  const card = event.target.closest("[data-media-id]");
  if (!card || !hasPermission(currentSession, PORTALS_MEDIA_UPDATE_PERMISSION)) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-fioreze-media-id", card.dataset.mediaId);
  card.classList.add("is-dragging");
  card.addEventListener("dragend", () => card.classList.remove("is-dragging"), { once: true });
}

function handleFolderDragStart(event) {
  const folder = event.target.closest("[data-folder-id]");
  if (!folder || !hasPermission(currentSession, PORTALS_MEDIA_UPDATE_PERMISSION)) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-fioreze-folder-id", folder.dataset.folderId);
  folder.classList.add("is-dragging");
  folder.addEventListener("dragend", () => folder.classList.remove("is-dragging"), { once: true });
}

function handleFolderDragOver(event) {
  const folder = event.target.closest("[data-folder-id]");
  const hasMedia = event.dataTransfer.types.includes("application/x-fioreze-media-id");
  const hasFolder = event.dataTransfer.types.includes("application/x-fioreze-folder-id");
  if (!folder || (!hasMedia && !hasFolder)) return;
  if (hasFolder && event.dataTransfer.getData("application/x-fioreze-folder-id") === folder.dataset.folderId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  folder.classList.add("is-drop-target");
}

function handleFolderDragLeave(event) {
  const folder = event.target.closest("[data-folder-id]");
  if (folder && !folder.contains(event.relatedTarget)) folder.classList.remove("is-drop-target");
}

function handleFolderDrop(event) {
  const folder = event.target.closest("[data-folder-id]");
  if (!folder) return;
  event.preventDefault();
  folder.classList.remove("is-drop-target");
  const assetId = event.dataTransfer.getData("application/x-fioreze-media-id");
  const draggedFolderId = event.dataTransfer.getData("application/x-fioreze-folder-id");
  if (assetId) void moveMediaAsset(assetId, folder.dataset.folderId);
  if (draggedFolderId) void moveMediaFolder(draggedFolderId, folder.dataset.folderId);
}

function handleRootDragOver(event) {
  if (
    !event.dataTransfer.types.includes("application/x-fioreze-media-id") &&
    !event.dataTransfer.types.includes("application/x-fioreze-folder-id")
  ) return;
  event.preventDefault();
  els.mediaRootDropTarget.classList.add("is-drop-target");
}

function handleRootDragLeave() {
  els.mediaRootDropTarget.classList.remove("is-drop-target");
}

function handleRootDrop(event) {
  event.preventDefault();
  els.mediaRootDropTarget.classList.remove("is-drop-target");
  const assetId = event.dataTransfer.getData("application/x-fioreze-media-id");
  const folderId = event.dataTransfer.getData("application/x-fioreze-folder-id");
  if (assetId) void moveMediaAsset(assetId, null);
  if (folderId) void moveMediaFolder(folderId, null);
}

async function moveMediaAsset(assetId, folderId, { reload = true } = {}) {
  const asset = currentAssets.find((entry) => entry.id === assetId);
  if (!asset || (asset.folder_id || null) === (folderId || null)) return;
  try {
    await adminApi(`/api/v1/admin/media/${encodeURIComponent(assetId)}`, {
      method: "PATCH",
      body: { folder_id: folderId },
    });
    if (reload) await loadMediaLibrary();
  } catch (error) {
    if (reload) els.mediaError.textContent = error.message || "Não foi possível mover o arquivo.";
    else throw error;
  }
}

async function moveMediaFolder(folderId, parentId) {
  if (!folderId || folderId === parentId) return;
  try {
    await adminApi(`/api/v1/admin/media-folders/${encodeURIComponent(folderId)}`, {
      method: "PATCH",
      body: { parent_id: parentId },
    });
    await loadMediaLibrary();
  } catch (error) {
    els.mediaError.textContent = error.message || "Não foi possível mover a pasta.";
  }
}

function handleUploadDragOver(event) {
  if (![...event.dataTransfer.items].some((item) => item.kind === "file")) return;
  event.preventDefault();
  els.mediaUploadForm.classList.add("is-file-over");
}

function handleUploadDragLeave(event) {
  if (!els.mediaUploadForm.contains(event.relatedTarget)) els.mediaUploadForm.classList.remove("is-file-over");
}

function handleUploadDrop(event) {
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  event.preventDefault();
  els.mediaUploadForm.classList.remove("is-file-over");
  const transfer = new DataTransfer();
  transfer.items.add(file);
  els.mediaFile.files = transfer.files;
  els.mediaUploadStatus.textContent = `${file.name} pronto para envio.`;
}

function setMediaView(view, persist = true) {
  currentMediaView = view === "list" ? "list" : "grid";
  els.mediaGrid.classList.toggle("is-list-view", currentMediaView === "list");
  els.mediaViewGrid.setAttribute("aria-pressed", String(currentMediaView === "grid"));
  els.mediaViewList.setAttribute("aria-pressed", String(currentMediaView === "list"));
  if (persist) {
    try {
      localStorage.setItem("fioreze-media-view", currentMediaView);
    } catch {
      // Visualizacao continua funcional sem armazenamento local.
    }
  }
}

function readMediaView() {
  try {
    return localStorage.getItem("fioreze-media-view") === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function driveIcon(name) {
  const paths = {
    folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
    move: '<path d="M3 6h7l2 2h9v11H3z"/><path d="m9 14 3-3 3 3M12 11v6"/>',
    image: '<path d="M4 5h16v14H4z"/><path d="m6 16 4-4 3 3 2-2 3 3"/><circle cx="9" cy="9" r="1"/>',
    media: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 16 4-4 3 3 2-2 2 2"/><path d="m10 8 5 3-5 3z"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    font: '<path d="M5 5h14M12 5v14M8 19h8"/><path d="M7 5v3M17 5v3"/>',
    home: '<path d="m4 11 8-7 8 7"/><path d="M6 10v10h12V10"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    copy: '<rect x="8" y="8" width="11" height="11"/><path d="M16 8V5H5v11h3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    archive: '<path d="M4 7h16v13H4zM3 4h18v3H3z"/><path d="M9 11h6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
    external: '<path d="M14 5h5v5M19 5l-9 9"/><path d="M19 14v5H5V5h5"/>',
  };
  return `<svg class="admin-drive-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.image}</svg>`;
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
      <input name="module:${key}:nav" value="${escapeAttr(moduleRow.navigation_label || moduleRow.name)}" aria-label="Rótulo de navegação">
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
      ${field("Área do sistema", "nav.module_key", "guest-portal")}
      ${selectField("Ícone", "nav.icon_key", "home", ["home", "utensils", "shopping-bag", "sparkles", "calendar", "map-pin", "image", "info", "phone"])}
      ${field("Ordem", "nav.sort_order", "100", "number")}
      <button class="admin-primary-button" type="button" data-nav-action="create">Criar item</button>
    </div>
  `;
}

function renderEmbedPanel() {
  if (!hasPermission(currentSession, PORTALS_EMBED_READ_PERMISSION)) {
    return '<div class="admin-empty">Você não tem acesso a esta função.</div>';
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
        <strong>Áreas incorporáveis</strong>
        <span>Apenas áreas públicas e ativas podem ser selecionadas.</span>
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
      <input name="${escapeAttr(name)}" type="${escapeAttr(type)}" value="${escapeAttr(value ?? "")}" ${name === "slug" ? "pattern=\"[a-z0-9]+(?:-[a-z0-9]+)*\"" : ""}>
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

function mapsEmbedField() {
  const configured = setting("contact.maps_embed_urls");
  const urls = Array.isArray(configured) ? configured : [];
  const rows = urls.length ? urls : [""];
  const previews = urls.map(sanitizeMapEmbedUrl).filter(Boolean);
  return `
    <section class="admin-map-embeds admin-field-wide">
      <div class="admin-map-embeds-heading">
        <div><strong>Mapas incorporados</strong><p>Adicione um ou mais mapas para a seção Como chegar do Portal do Hóspede.</p></div>
        <button type="button" data-add-map-embed>Adicionar mapa</button>
      </div>
      <div class="admin-map-embed-list" data-map-embed-list>${rows.map(renderMapEmbedRow).join("")}</div>
      <small>Cole o endereço de incorporação do Google Maps (o valor src do iframe). Códigos HTML e chaves de API não são armazenados.</small>
      ${previews.length ? `<div class="admin-map-preview-grid">${previews.map((url, index) => `<iframe src="${escapeAttr(url)}" title="Prévia do mapa ${index + 1}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`).join("")}</div>` : ""}
    </section>`;
}

function renderMapEmbedRow(url, index) {
  return `
    <label class="admin-map-embed-row" data-map-embed-row>
      <span>Mapa ${Number(index) + 1}</span>
      <input name="contact.maps_embed_url" type="url" value="${escapeAttr(url || "")}" placeholder="https://www.google.com/maps/embed?...">
      <button type="button" data-remove-map-embed aria-label="Remover este mapa">Remover</button>
    </label>`;
}

function renumberMapEmbedRows(list) {
  [...(list?.querySelectorAll("[data-map-embed-row]") || [])].forEach((row, index) => {
    const label = row.querySelector("span");
    if (label) label.textContent = `Mapa ${index + 1}`;
  });
}

function extractMapEmbedUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const iframeSource = text.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];
  return iframeSource || text;
}

function sanitizeMapEmbedUrl(value) {
  try {
    const url = new URL(extractMapEmbedUrl(value));
    const allowedHosts = new Set(["www.google.com", "maps.google.com", "www.google.com.br", "maps.google.com.br"]);
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || !url.pathname.startsWith("/maps/embed")) return "";
    if (url.username || url.password || url.searchParams.has("key")) return "";
    return url.toString();
  } catch {
    return "";
  }
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

function fontSelectField(label, name, value) {
  return `
    <label class="admin-field">
      <span>${escapeHtml(label)}</span>
      <select name="${escapeAttr(name)}">
        ${portalFontOptions(value).map((option) => `<option value="${escapeAttr(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
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
  const isFont = name === "font_asset_id";
  const previewUrl = isFont ? branding("font_asset_url") : value?.startsWith("/") ? value : "";
  const mediaType = isFont
    ? branding("font_asset_mime_type") || "font/woff2"
    : name === "cover_image_url" && branding("cover_media_type") === "video"
      ? "video"
      : "image";
  return `
    <div class="admin-media-picker" data-media-field="${escapeAttr(name)}">
      <span class="admin-media-picker-copy"><strong>${escapeHtml(label || mediaLabel(name))}</strong><small data-media-selection-label>${value ? "Arquivo selecionado" : "Nenhum arquivo selecionado"}</small></span>
      <input name="${escapeAttr(name)}" value="${escapeAttr(value || "")}" hidden>
      <input name="${escapeAttr(`${name}__preview`)}" value="${escapeAttr(previewUrl)}" hidden>
      <input name="${escapeAttr(`${name}__mime`)}" value="${escapeAttr(mediaType)}" hidden>
      <div class="admin-media-picker-preview" data-media-preview>${renderIdentityMediaPreview(previewUrl, mediaType)}</div>
      <button type="button" data-pick-media="${escapeAttr(name)}">Selecionar arquivo</button>
      <button type="button" data-remove-media="${escapeAttr(name)}">Remover</button>
      ${previewUrl ? `<a href="${escapeAttr(previewUrl)}" target="_blank" rel="noopener">Abrir URL</a>` : ""}
    </div>
  `;
}

function renderIdentityMediaPreview(url, mediaType) {
  if (!url) return "<em>Sem arquivo</em>";
  if (String(mediaType || "").startsWith("font/")) {
    return '<span class="admin-font-file-preview">Aa</span>';
  }
  if (String(mediaType || "").startsWith("video")) {
    return `<video src="${escapeAttr(url)}" muted playsinline preload="metadata"></video>`;
  }
  return `<img src="${escapeAttr(url)}" alt="" loading="lazy" decoding="async">`;
}

function updateMediaPickerSelection(fieldName, asset) {
  const picker = [...els.unitEditorForm.querySelectorAll("[data-media-field]")]
    .find((element) => element.dataset.mediaField === fieldName);
  if (!picker) return;
  const preview = picker.querySelector("[data-media-preview]");
  const label = picker.querySelector("[data-media-selection-label]");
  if (preview) preview.innerHTML = renderIdentityMediaPreview(asset?.public_url || "", asset?.mime_type || "");
  if (label) label.textContent = asset?.original_filename || (asset ? "Arquivo selecionado" : "Nenhum arquivo selecionado");
  const link = picker.querySelector("a");
  if (link) link.remove();
  if (asset?.public_url) {
    picker.insertAdjacentHTML("beforeend", `<a href="${escapeAttr(asset.public_url)}" target="_blank" rel="noopener">Abrir URL</a>`);
  }
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
  els.unitDirtyState.textContent = dirty ? "Alterações não salvas." : "Tudo salvo.";
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

function renderEventsManager(session) {
  const allowed = canAccessContent(session);
  setHeading("Eventos", "Planeje e publique a agenda de cada unidade.");
  showPortalSection(allowed ? els.eventsManager : null);
  els.portalsDenied.hidden = allowed;
  if (!allowed) return;
  const selectedHotel = els.eventsHotel.value;
  populateAuthorizedHotels(els.eventsHotel, session);
  if (selectedHotel && [...els.eventsHotel.options].some((option) => option.value === selectedHotel)) {
    els.eventsHotel.value = selectedHotel;
  }
  loadEventsManager();
}

async function loadEventsManager() {
  const hotelId = els.eventsHotel.value;
  if (!hotelId) return;
  setSectionBusy(els.eventsManager, true);
  try {
    const payload = await adminApi(`/api/v1/admin/portal/content?hotel_id=${encodeURIComponent(hotelId)}`);
    currentEvents = payload.data.events || [];
    els.eventsMessage.textContent = "";
    renderEventsList();
  } catch (error) {
    currentEvents = [];
    els.eventsSummary.innerHTML = "";
    els.eventsMessage.textContent = error.message || "Não foi possível carregar os eventos.";
  } finally {
    setSectionBusy(els.eventsManager, false);
  }
}

function renderEventsList() {
  const query = normalizeSearch(els.eventsSearch.value);
  const status = els.eventsStatus.value;
  const rows = currentEvents.filter((event) => {
    if (status && event.status !== status) return false;
    if (!query) return true;
    return [event.title, event.summary, event.location, event.category, ...(event.tags || [])]
      .some((value) => normalizeSearch(value).includes(query));
  });
  const published = currentEvents.filter((event) => event.status === "published").length;
  const upcoming = currentEvents.filter((event) => event.status === "published" && Date.parse(event.ends_at || event.starts_at) >= Date.now()).length;
  els.eventsSummary.innerHTML = `
    <article><strong>${currentEvents.length}</strong><span>eventos cadastrados</span></article>
    <article><strong>${published}</strong><span>publicados</span></article>
    <article><strong>${upcoming}</strong><span>na programação</span></article>`;
  els.eventsMessage.textContent = `${rows.length} evento(s) encontrado(s).`;
  els.eventsList.innerHTML = rows.map(renderEventManagerCard).join("") || `
    <div class="admin-events-empty">
      ${featureSvg("event")}
      <strong>Nenhum evento encontrado</strong>
      <span>Cadastre uma experiência ou ajuste os filtros desta lista.</span>
    </div>`;
}

function renderEventManagerCard(event) {
  const date = eventDateParts(event.starts_at, event.timezone);
  const period = formatEventManagerPeriod(event);
  const image = event.image_url
    ? `<img src="${escapeAttr(event.image_url)}" alt="${escapeAttr(event.image_alt || "")}" loading="lazy">`
    : `<span class="admin-event-placeholder">${featureSvg("event")}</span>`;
  return `
    <article class="admin-event-card" data-event-id="${escapeAttr(event.id)}">
      <div class="admin-event-card-media">${image}<span class="admin-status-chip" data-status="${escapeAttr(event.status)}">${contentStatus(event.status)}</span></div>
      <div class="admin-event-card-body">
        <time datetime="${escapeAttr(event.starts_at)}"><strong>${escapeHtml(date.day)}</strong><span>${escapeHtml(date.month)}</span></time>
        <div>
          <small>${escapeHtml(event.category || "Evento")}</small>
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(event.summary || "Sem descrição curta.")}</p>
          <dl>
            <div>${featureSvg("calendar")}<span>${escapeHtml(period)}</span></div>
            ${event.location ? `<div>${featureSvg("pin")}<span>${escapeHtml(event.location)}</span></div>` : ""}
            ${event.action_url ? `<div>${featureSvg("external")}<span>Botão de ação configurado</span></div>` : ""}
          </dl>
        </div>
      </div>
      <footer>
        ${event.is_permanent ? `<span class="admin-event-permanent">${featureSvg("calendar")} Permanente no portal</span>` : ""}
        <button type="button" data-event-action="edit" data-event-id="${escapeAttr(event.id)}">${featureSvg("edit")} Editar evento</button>
      </footer>
    </article>`;
}

function handleEventAction(event) {
  const button = event.target.closest("[data-event-action]");
  if (!button) return;
  const item = currentEvents.find((entry) => entry.id === button.dataset.eventId);
  if (item && button.dataset.eventAction === "edit") openEventEditor(item);
}

async function openEventEditor(item = null) {
  const hotelId = els.eventsHotel.value;
  els.dialogTitle.textContent = item ? "Editar evento" : "Novo evento";
  els.dialogBody.innerHTML = '<p class="admin-muted">Preparando o evento...</p>';
  openPortalsDialog();
  eventMediaAssets = await loadEventMediaAssets(hotelId);
  const timezone = item?.timezone || hotelTimezone(hotelId);
  els.dialogBody.innerHTML = contentForm("event", `
    <div class="admin-event-form-intro">
      <span>${featureSvg("event")}</span>
      <div><strong>${item ? "Atualize a experiência" : "Crie uma nova experiência"}</strong><small>A programação publicada aparece automaticamente nos portais desta unidade.</small></div>
    </div>
    ${dialogField("Título do evento", "title", item?.title, "text", true)}
    ${dialogTextarea("Descrição curta", "summary", item?.summary, true)}
    ${dialogTextarea("Descrição completa", "content", item?.content)}
    <div class="admin-form-grid">${dialogField("Local do evento", "location", item?.location, "text")}${dialogField("Categoria", "category", item?.category || "Evento", "text")}</div>
    ${dialogField("Etiquetas", "tags", (item?.tags || []).join(", "), "text")}
    ${renderEventMediaPicker(item?.media_asset_id)}
    <fieldset class="admin-event-schedule">
      <legend>Data e horário</legend>
      <div class="admin-event-schedule-grid">
        ${dialogField("Data de início", "start_date", eventDateInput(item?.starts_at, timezone), "date", true)}
        ${dialogField("Horário de início", "start_time", eventTimeInput(item?.starts_at, timezone), "time", true)}
        ${dialogField("Data de término", "end_date", eventDateInput(item?.ends_at, timezone), "date")}
        ${dialogField("Horário de término", "end_time", eventTimeInput(item?.ends_at, timezone), "time")}
      </div>
      <small>O término é opcional. Quando informado, preencha data e horário.</small>
    </fieldset>
    <label class="admin-choice admin-choice-standalone admin-event-permanence">
      <input name="is_permanent" type="checkbox" ${item?.is_permanent ? "checked" : ""}>
      <span><strong>Manter permanentemente no portal</strong><small>Quando desativado, o evento é arquivado automaticamente após a data programada.</small></span>
    </label>
    <fieldset class="admin-event-action-fields">
      <legend>Botão de ação opcional</legend>
      <p>Use para inscrições, reservas ou outras páginas externas.</p>
      <div class="admin-form-grid">${dialogField("Texto do botão", "action_text", item?.action_text, "text")}${dialogField("Endereço HTTPS", "action_url", item?.action_url, "url")}</div>
    </fieldset>
    <div class="admin-form-grid">
      ${dialogSelect("Status", "status", item?.status || "draft", [["draft", "Rascunho"], ["published", "Publicado"], ["cancelled", "Cancelado"], ["archived", "Arquivado"]])}
      <label><span>Fuso horário</span><input name="timezone" value="${escapeAttr(timezone)}" readonly></label>
    </div>`);
  bindDialogForm((event) => saveManagedEvent(event, item));
}

async function saveManagedEvent(event, item) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const message = form.querySelector(".admin-dialog-message");
  const body = Object.fromEntries(data.entries());
  if (Boolean(body.end_date) !== Boolean(body.end_time)) {
    message.textContent = "Informe a data e o horário de término, ou deixe os dois campos vazios.";
    return;
  }
  try {
    body.hotel_id = els.eventsHotel.value;
    body.starts_at = zonedDateTimeToIso(body.start_date, body.start_time, body.timezone);
    body.ends_at = body.end_date ? zonedDateTimeToIso(body.end_date, body.end_time, body.timezone) : "";
    body.tags = String(body.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
    body.is_permanent = data.has("is_permanent");
    delete body.start_date;
    delete body.start_time;
    delete body.end_date;
    delete body.end_time;
    message.textContent = "Salvando evento...";
    await adminApi(item ? `/api/v1/admin/portal/events/${encodeURIComponent(item.id)}` : "/api/v1/admin/portal/events", {
      method: item ? "PATCH" : "POST",
      body,
    });
    closePortalsDialog();
    await loadEventsManager();
  } catch (error) {
    message.textContent = error.message || "Não foi possível salvar o evento.";
  }
}

function renderContentManager(session) {
  const allowed = canAccessContent(session);
  setHeading("Portal do Hóspede", "Personalize o template oficial da unidade sem alterar sua estrutura.");
  showPortalSection(allowed ? els.contentManager : null);
  els.portalsDenied.hidden = allowed;
  if (!allowed) return;
  return guestPortalEditor.open(session);
}

async function loadPortalContent() {
  return guestPortalEditor.refresh();
}

function renderContentList() {
  const rows = currentContent[contentType] || [];
  return rows.map((item) => renderContentRow(item, contentType));
}

function renderContentRow(item, type) {
  if (type === "pages") {
    return `<article class="admin-data-row admin-content-row"><span class="admin-role-icon">${featureSvg("page")}</span><div class="admin-row-copy"><strong>${escapeHtml(item.title)}</strong><span>/${escapeHtml(item.slug)}</span><small>${Number(item.section_count || 0)} seção(ões) · ordem ${Number(item.sort_order || 0)}</small></div><span class="admin-status-chip" data-status="${escapeAttr(item.status)}">${contentStatus(item.status)}</span><div class="admin-row-actions"><button type="button" data-content-action="sections" data-id="${escapeAttr(item.id)}">Seções</button><button type="button" data-content-action="edit" data-id="${escapeAttr(item.id)}">Editar</button></div></article>`;
  }
  if (type === "custom_pages") {
    const canEdit = hasPermission(currentSession, PORTALS_HOTELS_SETTINGS_PERMISSION) && item.status !== "archived";
    const canCreateLink = item.status === "published" && hasPermission(currentSession, PORTALS_LINKS_CREATE_PERMISSION);
    return `<article class="admin-data-row admin-content-row admin-custom-page-row"><span class="admin-role-icon">${featureSvg("code")}</span><div class="admin-row-copy"><strong>${escapeHtml(item.title)}</strong><a href="${escapeAttr(item.public_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.public_url)}</a><small>HTML sanitizado · atualizado em ${escapeHtml(formatDate(item.updated_at))}</small></div><span class="admin-status-chip" data-status="${escapeAttr(item.status)}">${contentStatus(item.status)}</span><div class="admin-row-actions">${canEdit ? `<button type="button" data-content-action="edit" data-id="${escapeAttr(item.id)}">Editar</button>` : ""}${canCreateLink ? `<button type="button" data-content-action="create-link" data-id="${escapeAttr(item.id)}">Criar link e QR</button>` : ""}${canEdit ? `<button class="danger" type="button" data-content-action="archive-custom" data-id="${escapeAttr(item.id)}">Arquivar</button>` : ""}</div></article>`;
  }
  if (type === "events") {
    const media = item.image_url
      ? `<img class="admin-event-row-media" src="${escapeAttr(item.image_url)}" alt="">`
      : `<span class="admin-role-icon">${featureSvg("event")}</span>`;
    return `<article class="admin-data-row admin-content-row admin-event-row">${media}<div class="admin-row-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(formatDate(item.starts_at, item.timezone))}</span><small>${escapeHtml(item.summary || "Sem resumo")}</small></div><span class="admin-status-chip" data-status="${escapeAttr(item.status)}">${contentStatus(item.status)}</span><div class="admin-row-actions"><button type="button" data-content-action="edit" data-id="${escapeAttr(item.id)}">Editar</button></div></article>`;
  }
  return `<article class="admin-data-row admin-content-row"><span class="admin-role-icon">${featureSvg("info")}</span><div class="admin-row-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.info_key)}</span><small>Ordem ${Number(item.sort_order || 0)}</small></div><span class="admin-status-chip" data-status="${item.is_public ? "active" : "disabled"}">${item.is_public ? "Pública" : "Oculta"}</span><div class="admin-row-actions"><button type="button" data-content-action="edit" data-id="${escapeAttr(item.id)}">Editar</button></div></article>`;
}

function handleContentClick(event) {
  const tab = event.target.closest("[data-content-type]");
  if (tab) {
    renderTabTransition(() => {
      contentType = tab.dataset.contentType;
      for (const button of els.contentManager.querySelectorAll("[data-content-type]")) button.setAttribute("aria-selected", String(button === tab));
      renderContentList();
    });
    return;
  }
  const action = event.target.closest("[data-content-action]");
  if (!action) return;
  if (action.dataset.contentAction === "sections") return openSectionsEditor(action.dataset.id);
  const item = (currentContent[contentType] || []).find((entry) => entry.id === action.dataset.id);
  if (!item) return;
  if (action.dataset.contentAction === "create-link") return createShortLinkFromCustomPage(item);
  if (action.dataset.contentAction === "archive-custom") return archiveCustomPage(item);
  openContentEditor(item);
}

async function openContentEditor(item = null) {
  if (contentType === "custom_pages") {
    openCustomPageEditor(item);
    return;
  }
  const typeLabel = { pages: "página", events: "evento", information: "informação" }[contentType];
  const article = contentType === "events" ? "Novo" : "Nova";
  els.dialogTitle.textContent = `${item ? "Editar" : article} ${typeLabel}`;
  if (contentType === "pages") {
    els.dialogBody.innerHTML = contentForm("page", `
      ${dialogField("Título", "title", item?.title, "text", true)}
      ${dialogField("Endereço", "slug", item?.slug, "text", true, "[a-z0-9]+(?:-[a-z0-9]+)*")}
      ${dialogTextarea("Resumo", "summary", item?.summary)}
      <div class="admin-form-grid">${dialogSelect("Status", "status", item?.status || "draft", [["draft", "Rascunho"], ["published", "Publicada"], ["archived", "Arquivada"]])}${dialogField("Ordem", "sort_order", item?.sort_order ?? 100, "number", true)}</div>`);
  } else if (contentType === "events") {
    eventMediaAssets = await loadEventMediaAssets();
    els.dialogBody.innerHTML = contentForm("event", `
      ${dialogField("Título", "title", item?.title, "text", true)}
      ${dialogTextarea("Resumo", "summary", item?.summary)}
      ${dialogTextarea("Descrição completa", "content", item?.content)}
      <div class="admin-form-grid">${dialogField("Local do evento", "location", item?.location, "text")}${dialogField("Categoria", "category", item?.category, "text")}</div>
      ${dialogField("Etiquetas", "tags", (item?.tags || []).join(", "), "text", false)}
      <div class="admin-form-grid">${dialogField("Texto do botão", "action_text", item?.action_text, "text")}${dialogField("URL do botão", "action_url", item?.action_url, "url")}</div>
      ${renderEventMediaPicker(item?.media_asset_id)}
      <div class="admin-form-grid">${dialogField("Início", "starts_at", toLocalDateTime(item?.starts_at), "datetime-local", true)}${dialogField("Término", "ends_at", toLocalDateTime(item?.ends_at), "datetime-local")}</div>
      <label class="admin-choice admin-choice-standalone admin-event-permanence"><input name="is_permanent" type="checkbox" ${item?.is_permanent ? "checked" : ""}><span><strong>Manter permanentemente no portal</strong><small>Quando desativado, o evento é arquivado automaticamente após a data programada.</small></span></label>
      <div class="admin-form-grid">${dialogField("Fuso horário", "timezone", item?.timezone || hotelTimezone(els.contentHotel.value), "text", true)}${dialogSelect("Status", "status", item?.status || "draft", [["draft", "Rascunho"], ["published", "Publicado"], ["cancelled", "Cancelado"], ["archived", "Arquivado"]])}</div>`);
  } else {
    els.dialogBody.innerHTML = contentForm("information", `
      ${dialogField("Título", "title", item?.title, "text", true)}
      ${dialogField("Identificador", "info_key", item?.info_key, "text", true, "[a-z0-9]+(?:-[a-z0-9]+)*")}
      ${dialogTextarea("Conteúdo", "body", item?.body, true)}
      <div class="admin-form-grid">${dialogField("Ordem", "sort_order", item?.sort_order ?? 100, "number", true)}<label class="admin-choice admin-choice-standalone"><input name="is_public" type="checkbox" ${item?.is_public !== false ? "checked" : ""}><span><strong>Visível no portal</strong></span></label></div>`);
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
  } else if (contentType === "custom_pages") {
    if (!item) body.hotel_id = els.contentHotel.value;
  } else if (contentType === "events") {
    body.hotel_id = els.contentHotel.value;
    body.starts_at = fromLocalDateTime(body.starts_at);
    body.ends_at = fromLocalDateTime(body.ends_at);
    body.tags = String(body.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
    body.is_permanent = data.has("is_permanent");
  } else {
    body.hotel_id = els.contentHotel.value;
    body.sort_order = Number(body.sort_order || 100);
    body.is_public = data.has("is_public");
  }
  const base = { pages: "pages", events: "events", information: "information" }[contentType];
  const path = contentType === "custom_pages"
    ? item
      ? `/api/v1/admin/custom-portal-pages/${encodeURIComponent(item.id)}`
      : "/api/v1/admin/custom-portal-pages"
    : item
      ? `/api/v1/admin/portal/${base}/${encodeURIComponent(item.id)}`
      : `/api/v1/admin/portal/${base}`;
  try {
    message.textContent = "Salvando...";
    await adminApi(path, { method: item ? "PATCH" : "POST", body });
    closePortalsDialog();
    await loadPortalContent();
  } catch (error) {
    message.textContent = error.message || "Não foi possível salvar o conteúdo.";
  }
}

async function loadEventMediaAssets(hotelId = els.contentHotel.value) {
  try {
    const params = new URLSearchParams({ hotel_id: hotelId, status: "active" });
    const payload = await adminApi(`/api/v1/admin/media?${params.toString()}`);
    return (payload.data.assets || []).filter((asset) => String(asset.mime_type || "").startsWith("image/"));
  } catch {
    return [];
  }
}

function renderEventMediaPicker(selectedId) {
  const choices = [
    `<label class="admin-content-media-option no-media"><input type="radio" name="media_asset_id" value="" ${selectedId ? "" : "checked"}><span>${featureSvg("image")}<strong>Sem imagem</strong></span></label>`,
    ...eventMediaAssets.map((asset) => `<label class="admin-content-media-option"><input type="radio" name="media_asset_id" value="${escapeAttr(asset.id)}" ${asset.id === selectedId ? "checked" : ""}><span><img src="${escapeAttr(asset.public_url)}" alt=""><strong>${escapeHtml(asset.original_filename || "Imagem")}</strong></span></label>`),
  ];
  return `<fieldset class="admin-content-media-picker"><legend>Imagem do evento</legend><p>Selecione uma imagem da Biblioteca de Mídia ou envie uma nova.</p>${inlineMediaUploadControl({ context: "event", hotelId: els.eventsHotel.value })}<div data-inline-media-options>${choices.join("")}</div></fieldset>`;
}

async function openCustomPageEditor(item = null) {
  els.dialogTitle.textContent = item ? "Editar página HTML" : "Nova página HTML";
  setSectionBusy(els.contentManager, true);
  try {
    let page = item;
    if (item) {
      const payload = await adminApi(`/api/v1/admin/custom-portal-pages/${encodeURIComponent(item.id)}`);
      page = payload.data.page;
    }
    openPortalsDialog();
    els.dialogBody.innerHTML = contentForm("custom-page", `
      <div class="admin-form-grid">${dialogField("Título", "title", page?.title, "text", true)}${dialogField("Endereço", "slug", page?.slug, "text", true, "[a-z0-9]+(?:-[a-z0-9]+)*")}</div>
      ${dialogSelect("Status", "status", page?.status === "archived" ? "draft" : page?.status || "draft", [["draft", "Rascunho"], ["published", "Publicada"]])}
      <label class="admin-html-editor-field"><span>HTML personalizado</span><textarea name="html" rows="18" maxlength="250000" spellcheck="false" required>${escapeHtml(page?.html || "")}</textarea><small>Scripts, formulários, iframes, eventos e endereços inseguros são removidos automaticamente. Use estilos inline para personalizar o conteúdo.</small></label>
      <aside class="admin-sanitization-note"><strong>Publicação protegida</strong><span>O conteúdo é exibido isolado da sessão administrativa e não recebe acesso às APIs internas.</span></aside>`);
    bindDialogForm((event) => saveContent(event, item));
  } catch (error) {
    openPortalsDialog();
    els.dialogBody.innerHTML = `<p class="admin-error">${escapeHtml(error.message || "Não foi possível abrir a página HTML.")}</p>`;
  } finally {
    setSectionBusy(els.contentManager, false);
  }
}

async function archiveCustomPage(item) {
  if (!window.confirm("Arquivar esta página HTML? O endereço público deixará de responder.")) return;
  try {
    await adminApi(`/api/v1/admin/custom-portal-pages/${encodeURIComponent(item.id)}`, { method: "DELETE", body: {} });
    await loadPortalContent();
  } catch (error) {
    els.contentMessage.textContent = error.message || "Não foi possível arquivar a página HTML.";
  }
}

function createShortLinkFromCustomPage(item) {
  navigateSoft("/admin/portais/links/");
  renderPortals(currentSession);
  els.shortLinksHotel.value = item.hotel_id;
  openShortLinkEditor(null, {
    hotel_id: item.hotel_id,
    internal_name: item.title,
    destination_url: item.public_url,
  });
}

async function openSectionsEditor(pageId) {
  els.dialogTitle.textContent = "Seções da página";
  setSectionBusy(els.contentManager, true);
  try {
    const payload = await adminApi(`/api/v1/admin/portal/pages/${encodeURIComponent(pageId)}`);
    const sections = payload.data.sections || [];
    openPortalsDialog();
    els.dialogBody.innerHTML = `
      <div class="admin-section-editor-list">${sections.map((section) => `<button type="button" data-edit-section="${escapeAttr(section.id)}"><strong>${escapeHtml(section.title || section.section_key)}</strong><span>${escapeHtml(section.body || "Sem texto")}</span></button>`).join("") || '<p class="admin-empty">Nenhuma seção cadastrada.</p>'}</div>
      <button class="admin-primary-button" type="button" data-new-section>Nova seção</button>`;
    els.dialogBody.querySelector("[data-new-section]").addEventListener("click", () => openSectionForm(pageId));
    els.dialogBody.querySelectorAll("[data-edit-section]").forEach((button) => button.addEventListener("click", () => openSectionForm(pageId, sections.find((item) => item.id === button.dataset.editSection))));
  } catch (error) {
    openPortalsDialog();
    els.dialogBody.innerHTML = `<p class="admin-error">${escapeHtml(error.message || "Não foi possível carregar as seções.")}</p>`;
  } finally {
    setSectionBusy(els.contentManager, false);
  }
}

function openSectionForm(pageId, section = null) {
  els.dialogTitle.textContent = section ? "Editar seção" : "Nova seção";
  els.dialogBody.innerHTML = contentForm("section", `
    ${dialogField("Título", "title", section?.title)}
    ${dialogField("Identificador", "section_key", section?.section_key, "text", true, "[a-z0-9]+(?:-[a-z0-9]+)*")}
    ${dialogTextarea("Conteúdo", "body", section?.body)}
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
    form.querySelector(".admin-dialog-message").textContent = error.message || "Não foi possível salvar a seção.";
  }
}

function renderAreasManager(session) {
  const allowed = canAccessAreas(session);
  setHeading("Áreas", "Ative as experiências disponíveis em cada unidade.");
  showPortalSection(allowed ? els.areasManager : null);
  els.portalsDenied.hidden = allowed;
  if (!allowed) return;
  populateAuthorizedHotels(els.areasHotel, session);
  loadDedicatedAreas();
}

async function loadDedicatedAreas() {
  if (!els.areasHotel.value) return;
  setSectionBusy(els.areasManager, true);
  try {
    const payload = await adminApi(`/api/v1/admin/hotels/${encodeURIComponent(els.areasHotel.value)}/modules`);
    dedicatedModules = payload.data.modules || [];
    const activeCount = dedicatedModules.filter((item) => item.enabled).length;
    els.areasMessage.textContent = `${activeCount} ${activeCount === 1 ? "área ativa" : "áreas ativas"}.`;
    els.areasList.innerHTML = dedicatedModules.map(renderAreaCard).join("");
  } catch (error) {
    els.areasMessage.textContent = error.message || "Não foi possível carregar as áreas.";
  } finally {
    setSectionBusy(els.areasManager, false);
  }
}

function renderAreaCard(module) {
  const image = module.background_image_url
    ? `<img class="admin-area-cover" src="${escapeAttr(module.background_image_url)}" alt="">`
    : `<span class="admin-area-cover is-empty">${featureIcon("media")}</span>`;
  return `<article class="admin-area-card">${image}<label><input type="checkbox" data-area-key="${escapeAttr(module.module_key)}" ${module.enabled ? "checked" : ""}><span class="admin-feature-icon">${featureIcon(module.module_key === "guest-portal" ? "conteudos" : "modulos")}</span><span><strong>${escapeHtml(module.public_name || module.name)}</strong><small>${escapeHtml(module.description || module.module_key)}</small></span><em>${module.enabled ? "Ativa" : "Inativa"}</em></label><button type="button" data-area-image="${escapeAttr(module.module_key)}">${module.background_image_url ? "Trocar capa" : "Escolher capa"}</button></article>`;
}

async function saveDedicatedArea(event) {
  const input = event.target.closest("[data-area-key]");
  if (!input) return;
  dedicatedModules = dedicatedModules.map((module) => module.module_key === input.dataset.areaKey ? { ...module, enabled: input.checked } : module);
  els.areasMessage.textContent = "Salvando área...";
  try {
    await persistDedicatedModules();
    await loadDedicatedAreas();
  } catch (error) {
    input.checked = !input.checked;
    els.areasMessage.textContent = error.message || "Não foi possível salvar a área.";
  }
}

async function handleAreaImageAction(event) {
  const button = event.target.closest("[data-area-image]");
  if (!button) return;
  const module = dedicatedModules.find((item) => item.module_key === button.dataset.areaImage);
  if (!module) return;
  const params = new URLSearchParams({ hotel_id: els.areasHotel.value, status: "active" });
  const payload = await adminApi(`/api/v1/admin/media?${params.toString()}`);
  const assets = (payload.data.assets || []).filter((asset) => String(asset.mime_type || "").startsWith("image/"));
  dialogMediaAssets = assets;
  els.dialogTitle.textContent = `Capa de ${module.public_name || module.name}`;
  els.dialogBody.innerHTML = contentForm("area-media", `<fieldset class="admin-content-media-picker"><legend>Imagem do serviço</legend><p>A capa será usada no botão público deste serviço. Se preferir, envie uma nova imagem agora.</p>${inlineMediaUploadControl({ context: "area", hotelId: els.areasHotel.value, moduleKey: module.module_key })}<div data-inline-media-options><label class="admin-content-media-option no-media"><input type="radio" name="media_asset_id" value="" ${module.settings?.background_media_asset_id ? "" : "checked"}><span>${featureSvg("image")}<strong>Sem imagem</strong></span></label>${assets.map((asset) => renderIdentityMediaOption(asset, module.settings?.background_media_asset_id)).join("")}</div></fieldset>`);
  openPortalsDialog();
  bindDialogForm(async (submitEvent) => {
    submitEvent.preventDefault();
    const form = submitEvent.currentTarget;
    const selectedId = new FormData(form).get("media_asset_id") || "";
    const selected = dialogMediaAssets.find((asset) => asset.id === selectedId);
    dedicatedModules = dedicatedModules.map((item) => item.module_key === module.module_key
      ? { ...item, settings: { ...(item.settings || {}), background_media_asset_id: selectedId || null }, background_image_url: selected?.public_url || null }
      : item);
    try {
      form.querySelector(".admin-dialog-message").textContent = "Salvando capa...";
      await persistDedicatedModules();
      closePortalsDialog();
      await loadDedicatedAreas();
    } catch (error) {
      form.querySelector(".admin-dialog-message").textContent = error.message || "Não foi possível salvar a capa.";
    }
  });
}

function persistDedicatedModules() {
  const modules = dedicatedModules.map((module) => ({
    module_key: module.module_key,
    enabled: module.enabled,
    is_public: module.is_public,
    public_name: module.public_name,
    navigation_label: module.navigation_label,
    sort_order: module.sort_order,
    background_media_asset_id: module.settings?.background_media_asset_id || "",
  }));
  return adminApi(`/api/v1/admin/hotels/${encodeURIComponent(els.areasHotel.value)}/modules`, { method: "PATCH", body: { modules } });
}

function renderNavigationManager(session) {
  const allowed = canAccessNavigation(session);
  setHeading("Navegação", "Organize os caminhos exibidos no portal de cada unidade.");
  showPortalSection(allowed ? els.navigationManager : null);
  els.portalsDenied.hidden = allowed;
  if (!allowed) return;
  populateAuthorizedHotels(els.navigationHotel, session);
  loadDedicatedNavigation();
}

async function loadDedicatedNavigation() {
  if (!els.navigationHotel.value) return;
  setSectionBusy(els.navigationManager, true);
  try {
    const [navigation, modules] = await Promise.all([
      adminApi(`/api/v1/admin/hotels/${encodeURIComponent(els.navigationHotel.value)}/navigation`),
      adminApi(`/api/v1/admin/hotels/${encodeURIComponent(els.navigationHotel.value)}/modules`),
    ]);
    dedicatedNavigation = navigation.data.navigation || [];
    dedicatedModules = modules.data.modules || [];
    els.navigationMessage.textContent = `${dedicatedNavigation.length} item(ns) configurado(s).`;
    els.navigationList.innerHTML = dedicatedNavigation.map((item) => `<article class="admin-data-row admin-content-row"><span class="admin-role-icon">${featureSvg("navigation")}</span><div class="admin-row-copy"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.path)}</span><small>${escapeHtml(item.module_key)} · ordem ${Number(item.sort_order || 0)}</small></div><span class="admin-status-chip" data-status="${item.enabled ? "active" : "disabled"}">${item.enabled ? "Visível" : "Oculto"}</span><div class="admin-row-actions"><button type="button" data-navigation-action="edit" data-id="${escapeAttr(item.id)}">Editar</button><button type="button" data-navigation-action="archive" data-id="${escapeAttr(item.id)}">Ocultar</button></div></article>`).join("") || '<p class="admin-empty">Nenhum item de navegação cadastrado.</p>';
  } catch (error) {
    els.navigationMessage.textContent = error.message || "Não foi possível carregar a navegação.";
  } finally {
    setSectionBusy(els.navigationManager, false);
  }
}

function handleDedicatedNavigationAction(event) {
  const button = event.target.closest("[data-navigation-action]");
  if (!button) return;
  const item = dedicatedNavigation.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.navigationAction === "edit") return openNavigationEditor(item);
  if (!window.confirm(`Ocultar ${item.label} da navegação?`)) return;
  adminApi(`/api/v1/admin/hotels/${encodeURIComponent(els.navigationHotel.value)}/navigation/${encodeURIComponent(item.id)}`, { method: "DELETE", body: {} })
    .then(loadDedicatedNavigation)
    .catch((error) => { els.navigationMessage.textContent = error.message || "Não foi possível ocultar o item."; });
}

function openNavigationEditor(item = null) {
  els.dialogTitle.textContent = item ? "Editar item de navegação" : "Novo item de navegação";
  els.dialogBody.innerHTML = contentForm("navigation", `
    ${dialogField("Nome", "label", item?.label, "text", true)}
    ${dialogField("Caminho", "path", item?.path || "/", "text", true)}
    <div class="admin-form-grid">${dialogSelect("Área", "module_key", item?.module_key || dedicatedModules[0]?.module_key || "guest-portal", dedicatedModules.map((module) => [module.module_key, module.public_name || module.name]))}${dialogField("Ícone", "icon_key", item?.icon_key || "home")}</div>
    <div class="admin-form-grid">${dialogField("Ordem", "sort_order", item?.sort_order ?? 100, "number", true)}<label class="admin-choice admin-choice-standalone"><input name="enabled" type="checkbox" ${item?.enabled !== false ? "checked" : ""}><span><strong>Visível no portal</strong></span></label></div>`);
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
    form.querySelector(".admin-dialog-message").textContent = error.message || "Não foi possível salvar o item.";
  }
}

function renderAuditManager(session) {
  const allowed = canAccessAudit(session);
  setHeading("Auditoria", "Consulte as alterações realizadas na Central Administrativa.");
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
  setSectionBusy(els.auditManager, true);
  try {
    const payload = await adminApi(`/api/v1/admin/audit?${params}`);
    const entries = payload.data.entries || [];
    els.auditMessage.textContent = `${entries.length} registro(s) encontrado(s).`;
    els.auditList.innerHTML = entries.map((entry) => `<article class="admin-data-row admin-audit-row"><span class="admin-role-icon">${featureSvg("history")}</span><div class="admin-row-copy"><strong>${escapeHtml(auditActionLabel(entry.action))}</strong><span>${escapeHtml(entry.actor_name)} · ${escapeHtml(entry.hotel_id || "Administração geral")}</span><small>${escapeHtml(entry.entity_type || "registro")} · ${escapeHtml(formatDate(entry.created_at))}</small></div><code>${escapeHtml(entry.action)}</code></article>`).join("") || '<p class="admin-empty">Nenhuma alteração encontrada.</p>';
  } catch (error) {
    els.auditMessage.textContent = error.message || "Não foi possível carregar a auditoria.";
  } finally {
    setSectionBusy(els.auditManager, false);
  }
}

function setSectionBusy(section, busy) {
  if (!section) return;
  section.toggleAttribute("aria-busy", busy);
  section.classList.toggle("is-refreshing", busy);
}

function showPortalSection(active) {
  for (const section of [els.portalsHome, els.unitsManager, els.shortLinksManager, els.mediaLibrary, els.eventsManager, els.contentManager, els.areasManager, els.navigationManager, els.auditManager]) {
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
  return `<label><span>${escapeHtml(label)}</span><select name="${escapeAttr(name)}">${optionsHtml(options, value)}</select></label>`;
}

function optionsHtml(options, value) {
  return options.map(([key, text]) => `<option value="${escapeAttr(key)}" ${key === value ? "selected" : ""}>${escapeHtml(text)}</option>`).join("");
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
    "portal-page.create": "Página criada",
    "portal-page.update": "Página atualizada",
    "portal-section.create": "Seção criada",
    "portal-section.update": "Seção atualizada",
    "portal-event.create": "Evento criado",
    "portal-event.update": "Evento atualizado",
    "hotel-information.create": "Informação criada",
    "hotel-information.update": "Informação atualizada",
    "hotel.modules.update": "Áreas atualizadas",
    "hotel.navigation.create": "Item de navegação criado",
    "hotel.navigation.update": "Item de navegação atualizado",
    "hotel.navigation.archive": "Item de navegação ocultado",
  };
  return labels[action] || action.replaceAll("-", " ").replaceAll(".", " · ");
}

function featureSvg(type) {
  const paths = {
    page: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    event: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    external: '<path d="M14 5h5v5M19 5l-9 9"/><path d="M19 14v5H5V5h5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    navigation: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-6 2 2-6z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 14v6h14v-6"/>',
    code: '<path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/>',
  };
  return `<svg class="admin-svg-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[type] || paths.page}</svg>`;
}

function navigateSoft(path) {
  window.history.pushState({}, "", path);
}

function renderTabTransition(render) {
  render();
}

function isMediaRoute() {
  return window.location.pathname.startsWith("/admin/portais/media/");
}

function isLinksRoute() {
  return window.location.pathname.startsWith("/admin/portais/links/");
}

function isEventsRoute() {
  return window.location.pathname.startsWith("/admin/portais/eventos/");
}

function isUnitsRoute() {
  return window.location.pathname.startsWith("/admin/portais/unidades/");
}

function isContentRoute() {
  return window.location.pathname.startsWith("/admin/portais/portal-hospede/") ||
    window.location.pathname.startsWith("/admin/portais/conteudos/");
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
    eventos: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M8 14h3M8 17h6"/>',
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
    cover_image_url: "Capa do portal (imagem ou vídeo)",
    social_image_url: "Imagem social",
    font_asset_id: "Fonte personalizada",
  }[name] || name;
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function normalizeSearch(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function eventDateParts(value, timezone = "America/Sao_Paulo") {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return { day: "--", month: "---" };
  const parts = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: timezone }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { day: values.day || "--", month: String(values.month || "---").replace(".", "").toUpperCase() };
}

function formatEventManagerPeriod(event) {
  const timezone = event.timezone || "America/Sao_Paulo";
  const start = new Date(event.starts_at || "");
  if (Number.isNaN(start.getTime())) return "Data a confirmar";
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: timezone }).format(start);
  const startTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(start);
  const end = new Date(event.ends_at || "");
  if (Number.isNaN(end.getTime())) return `${date}, às ${startTime}`;
  const endDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: timezone }).format(end);
  const endTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(end);
  return date === endDate ? `${date}, das ${startTime} às ${endTime}` : `${date}, ${startTime} até ${endDate}, ${endTime}`;
}

function eventDateInput(value, timezone) {
  return zonedInputParts(value, timezone).date;
}

function eventTimeInput(value, timezone) {
  return zonedInputParts(value, timezone).time;
}

function zonedInputParts(value, timezone) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

function zonedDateTimeToIso(dateValue, timeValue, timezone) {
  const match = `${dateValue}T${timeValue}`.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return "";
  const desired = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let epoch = desired;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    }).formatToParts(new Date(epoch));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const observed = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
    epoch += desired - observed;
  }
  return new Date(epoch).toISOString();
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
