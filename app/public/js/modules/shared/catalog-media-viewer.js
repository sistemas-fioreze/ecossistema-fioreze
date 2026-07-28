import { escapeHtml } from "../../core/errors.js";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.5;

export function renderZoomableCatalogMedia({
  image,
  alt,
  placeholder,
  label = "Ampliar imagem",
}) {
  if (!image) return placeholder;
  return `
    <button
      class="catalog-detail-media-button"
      type="button"
      data-catalog-media-open
      data-catalog-media-src="${escapeHtml(image)}"
      data-catalog-media-alt="${escapeHtml(alt)}"
      aria-label="${escapeHtml(label)}"
    >
      <img src="${escapeHtml(image)}" alt="${escapeHtml(alt)}">
      <span class="catalog-detail-media-hint">${icon("zoom-in")}<span>Ampliar</span></span>
    </button>`;
}

export function renderCatalogMediaViewer() {
  return `
    <section
      class="catalog-media-viewer"
      data-catalog-media-viewer
      role="dialog"
      aria-modal="true"
      aria-label="Visualização ampliada"
      hidden
    >
      <div class="catalog-media-viewer-toolbar">
        <button type="button" data-catalog-media-action="close" aria-label="Fechar imagem">${icon("close")}</button>
        <div class="catalog-media-viewer-zoom" aria-label="Controles de zoom">
          <button type="button" data-catalog-media-action="zoom-out" aria-label="Diminuir zoom">${icon("minus")}</button>
          <button class="catalog-media-viewer-reset" type="button" data-catalog-media-action="reset" aria-label="Restaurar zoom">
            <span data-catalog-media-zoom-label>100%</span>
          </button>
          <button type="button" data-catalog-media-action="zoom-in" aria-label="Aumentar zoom">${icon("plus")}</button>
        </div>
      </div>
      <button class="catalog-media-viewer-backdrop" type="button" data-catalog-media-action="close" aria-label="Fechar imagem"></button>
      <div class="catalog-media-viewer-stage" data-catalog-media-stage>
        <img data-catalog-media-image src="" alt="">
      </div>
    </section>`;
}

export function bindCatalogMediaViewer(container) {
  const viewer = container.querySelector("[data-catalog-media-viewer]");
  if (!viewer) return () => {};

  const image = viewer.querySelector("[data-catalog-media-image]");
  const stage = viewer.querySelector("[data-catalog-media-stage]");
  const label = viewer.querySelector("[data-catalog-media-zoom-label]");
  const zoomOut = viewer.querySelector('[data-catalog-media-action="zoom-out"]');
  const zoomIn = viewer.querySelector('[data-catalog-media-action="zoom-in"]');
  let zoom = MIN_ZOOM;
  let previousFocus = null;

  const setZoom = (value) => {
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    image.style.setProperty("--catalog-media-zoom", String(zoom));
    label.textContent = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoom <= MIN_ZOOM;
    zoomIn.disabled = zoom >= MAX_ZOOM;
    stage.classList.toggle("is-zoomed", zoom > MIN_ZOOM);
    if (zoom === MIN_ZOOM) {
      stage.scrollTo({ top: 0, left: 0 });
    }
  };

  const close = () => {
    if (viewer.hidden) return;
    viewer.hidden = true;
    viewer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("catalog-media-viewer-open");
    image.src = "";
    image.alt = "";
    setZoom(MIN_ZOOM);
    previousFocus?.focus?.({ preventScroll: true });
    previousFocus = null;
  };

  const open = (trigger) => {
    const source = String(trigger.dataset.catalogMediaSrc || "").trim();
    if (!source) return;
    previousFocus = trigger;
    image.src = source;
    image.alt = String(trigger.dataset.catalogMediaAlt || "");
    viewer.hidden = false;
    viewer.setAttribute("aria-hidden", "false");
    document.body.classList.add("catalog-media-viewer-open");
    setZoom(MIN_ZOOM);
    viewer.querySelector('[data-catalog-media-action="close"]')?.focus({ preventScroll: true });
  };

  const handleClick = (event) => {
    const trigger = event.target.closest("[data-catalog-media-open]");
    if (trigger && container.contains(trigger)) {
      open(trigger);
      return;
    }
    const action = event.target.closest("[data-catalog-media-action]")?.dataset.catalogMediaAction;
    if (!action || !viewer.contains(event.target)) return;
    if (action === "close") close();
    if (action === "zoom-in") setZoom(zoom + ZOOM_STEP);
    if (action === "zoom-out") setZoom(zoom - ZOOM_STEP);
    if (action === "reset") setZoom(MIN_ZOOM);
  };

  const handleImageClick = (event) => {
    if (event.target !== image) return;
    setZoom(zoom === MIN_ZOOM ? 2 : MIN_ZOOM);
  };

  const handleKeydown = (event) => {
    if (viewer.hidden) return;
    if (event.key === "Escape") close();
    if (event.key === "+" || event.key === "=") setZoom(zoom + ZOOM_STEP);
    if (event.key === "-") setZoom(zoom - ZOOM_STEP);
    if (event.key === "0") setZoom(MIN_ZOOM);
  };

  container.addEventListener("click", handleClick);
  image.addEventListener("click", handleImageClick);
  document.addEventListener("keydown", handleKeydown);
  setZoom(MIN_ZOOM);

  return () => {
    close();
    container.removeEventListener("click", handleClick);
    image.removeEventListener("click", handleImageClick);
    document.removeEventListener("keydown", handleKeydown);
  };
}

function icon(name) {
  const paths = {
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    "zoom-in": '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

export const catalogMediaViewerInternalsForTests = {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
};
