import { adminApi } from "./shared/admin-api.js";
import { createAdminAuthView } from "./shared/admin-auth-view.js";
import {
  PORTALS_MEDIA_ARCHIVE_PERMISSION,
  PORTALS_MEDIA_UPDATE_PERMISSION,
  PORTALS_MEDIA_UPLOAD_PERMISSION,
  canAccessMediaLibrary,
  canAccessPortals,
  getAuthorizedHotels,
  hasPermission,
} from "./shared/admin-session.js";
import { debounce, escapeAttr, escapeHtml, formatDate } from "./shared/format.js";

const els = {
  portalsDenied: document.getElementById("portalsDenied"),
  portalsContent: document.getElementById("portalsContent"),
  portalsHome: document.getElementById("portalsHome"),
  portalsModules: document.getElementById("portalsModules"),
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
};

const baseModules = ["Visao geral", "Hoteis", "Portais e modulos", "Conteudos", "Usuarios e acessos", "Auditoria"];
let currentSession = null;
let currentAssets = [];

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

auth.boot();

function renderPortals(session) {
  const allowed = canAccessPortals(session);
  els.portalsDenied.hidden = allowed;
  els.portalsContent.hidden = !allowed;
  if (!allowed) return;

  if (isMediaRoute()) {
    renderMediaLibrary(session);
    return;
  }

  els.portalsHome.hidden = false;
  els.mediaLibrary.hidden = true;
  els.portalsModules.innerHTML = [
    ...baseModules.map((moduleName) => placeholderCard(moduleName)),
    mediaModuleCard(session),
  ].join("");
}

function renderMediaLibrary(session) {
  els.portalsHome.hidden = true;
  const allowed = canAccessMediaLibrary(session);
  els.mediaLibrary.hidden = !allowed;
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
  if (!window.confirm("Arquivar esta imagem? O objeto R2 nao sera excluido.")) return;
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

function mediaModuleCard(session) {
  if (!canAccessMediaLibrary(session)) {
    return `
      <article class="admin-module-card">
        <strong>Biblioteca de imagens</strong>
        <span>Permissao pendente para este usuario.</span>
      </article>
    `;
  }
  return `
    <a class="admin-module-card admin-system-card" href="/admin/portais/media/">
      <strong>Biblioteca de imagens</strong>
      <span>Gerencie imagens publicas dos portais e modulos.</span>
    </a>
  `;
}

function placeholderCard(moduleName) {
  return `
    <article class="admin-module-card">
      <strong>${escapeHtml(moduleName)}</strong>
      <span>Modulo preparado para implementacao futura.</span>
    </article>
  `;
}

function isMediaRoute() {
  return window.location.pathname.startsWith("/admin/portais/media/");
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
