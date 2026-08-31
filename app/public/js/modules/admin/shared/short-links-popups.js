const DIALOG_ID = "adminShortLinksDialog";
const STYLE_ID = "adminShortLinksDialogStyles";
const LAYOUT_ID = "adminShortLinksPopupLayout";
const OVERVIEW_ID = "shortLinkPopupOverview";
const SUMMARY_ID = "shortLinkPopupSummary";
const TABS_ID = "shortLinkPopupTabs";

const POPUP_MODES = ["edit", "view", "metrics", "qr", "share"];
const baseDisabledState = new WeakMap();

let pendingMode = "edit";
let lastTrigger = null;

if (typeof document !== "undefined") installShortLinksPopups();

function installShortLinksPopups() {
  const editor = document.getElementById("shortLinksEditor");
  if (!editor || document.getElementById(DIALOG_ID)) return;

  ensureStyles();

  const dialog = document.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "admin-short-links-dialog";
  dialog.setAttribute("aria-labelledby", "shortLinksEditorTitle");
  document.body.append(dialog);
  dialog.append(editor);

  buildPopupLayout(editor, dialog);

  const manager = document.getElementById("shortLinksManager");
  const list = document.getElementById("shortLinksList");
  const addButton = document.getElementById("addShortLinkButton");
  const closeButton = document.getElementById("cancelShortLinkButton");
  const form = document.getElementById("shortLinksForm");
  const preview = document.getElementById("shortLinksPreview");
  const qrUrl = document.getElementById("shortLinkQrUrl");
  const qrImage = document.getElementById("shortLinkQrImage");

  list?.addEventListener("click", capturePopupMode, true);
  addButton?.addEventListener("click", () => {
    pendingMode = "edit";
    lastTrigger = addButton;
  }, true);

  form?.addEventListener("input", () => syncPopupPresentation(dialog, editor));
  form?.addEventListener("change", () => syncPopupPresentation(dialog, editor));

  document.getElementById(TABS_ID)?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-popup-tab]");
    if (!button || button.hidden || button.disabled) return;
    pendingMode = button.dataset.popupTab;
    applyPopupMode(dialog, editor, pendingMode);
  });

  document.getElementById("shortLinkPopupCopyButton")?.addEventListener("click", copyPopupShortUrl);
  document.getElementById("shortLinkPopupOpenButton")?.addEventListener("click", openPopupShortUrl);
  document.getElementById("shortLinkPopupDestinationButton")?.addEventListener("click", openPopupDestination);

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeButton?.click();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeButton?.click();
  });

  const editorObserver = new MutationObserver(() => syncDialogState(dialog, editor));
  editorObserver.observe(editor, { attributes: true, attributeFilter: ["hidden"] });

  if (manager) {
    const managerObserver = new MutationObserver(() => {
      if (manager.hidden && !editor.hidden) closeButton?.click();
    });
    managerObserver.observe(manager, { attributes: true, attributeFilter: ["hidden"] });
  }

  if (list) {
    const listObserver = new MutationObserver(() => enhanceShortLinkRows(list));
    listObserver.observe(list, { childList: true, subtree: true });
    enhanceShortLinkRows(list);
  }

  for (const target of [preview, qrUrl, qrImage, document.getElementById("shortLinkQrPanel"), document.getElementById("shortLinkSharingPanel"), document.getElementById("shortLinkAnalyticsFilters")]) {
    if (!target) continue;
    const observer = new MutationObserver(() => syncPopupPresentation(dialog, editor));
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "hidden"],
    });
  }

  syncDialogState(dialog, editor);
}

function buildPopupLayout(editor, dialog) {
  if (editor.querySelector(`#${LAYOUT_ID}`)) return;

  const heading = editor.querySelector(":scope > .admin-panel-heading");
  const closeButton = document.getElementById("cancelShortLinkButton");
  const form = document.getElementById("shortLinksForm");
  const qrPanel = document.getElementById("shortLinkQrPanel");
  const sharingPanel = document.getElementById("shortLinkSharingPanel");
  const analyticsFilters = document.getElementById("shortLinkAnalyticsFilters");
  const analyticsPanel = document.getElementById("shortLinksAnalytics");

  if (closeButton) {
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Fechar");
    closeButton.title = "Fechar";
  }

  if (heading) {
    const copy = heading.querySelector(".admin-muted");
    if (copy) {
      copy.dataset.shortLinkDefaultCopy = copy.textContent;
      copy.textContent = "Gerencie o link sem sair da lista. Alterações e métricas ficam organizadas em uma única janela.";
    }
  }

  const tabs = document.createElement("nav");
  tabs.id = TABS_ID;
  tabs.className = "admin-short-links-popup-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Seções do link");
  tabs.innerHTML = [
    popupTab("view", "Visualizar", eyeIcon()),
    popupTab("edit", "Editar", editIcon()),
    popupTab("metrics", "Métricas", analyticsIcon()),
    popupTab("qr", "QR Code", qrIcon()),
    popupTab("share", "Compartilhar", shareIcon()),
  ].join("");

  const layout = document.createElement("div");
  layout.id = LAYOUT_ID;
  layout.className = "admin-short-links-popup-layout";

  const main = document.createElement("main");
  main.className = "admin-short-links-popup-main";

  const overview = document.createElement("section");
  overview.id = OVERVIEW_ID;
  overview.className = "admin-short-links-popup-overview";
  overview.innerHTML = `
    <div class="admin-short-links-overview-hero">
      <span class="admin-short-links-overview-icon" aria-hidden="true">${linkIcon()}</span>
      <div>
        <span>Visualização do link</span>
        <h4 id="shortLinkPopupOverviewName">Link personalizado</h4>
        <p id="shortLinkPopupOverviewUrl">/go/seu-link</p>
      </div>
      <span id="shortLinkPopupOverviewStatus" class="admin-short-links-status-pill">Ativo</span>
    </div>
    <div class="admin-short-links-overview-grid">
      <article>
        <span>Destino</span>
        <strong id="shortLinkPopupOverviewDestination">Ainda não definido</strong>
      </article>
      <article>
        <span>Período</span>
        <strong id="shortLinkPopupOverviewPeriod">Sempre disponível</strong>
      </article>
      <article class="is-wide">
        <span>Notas internas</span>
        <strong id="shortLinkPopupOverviewNotes">Sem notas internas.</strong>
      </article>
    </div>
  `;

  const summary = document.createElement("aside");
  summary.id = SUMMARY_ID;
  summary.className = "admin-short-links-popup-summary";
  summary.innerHTML = `
    <div class="admin-short-links-summary-heading">
      <div>
        <span>Prévia</span>
        <h4>Como este link está agora</h4>
      </div>
      <span id="shortLinkPopupStatus" class="admin-short-links-status-pill">Ativo</span>
    </div>
    <div class="admin-short-links-summary-card">
      <img id="shortLinkPopupSummaryQr" alt="QR Code do link" hidden>
      <span class="admin-short-links-summary-label">Link curto</span>
      <strong id="shortLinkPopupSummaryName">Novo link</strong>
      <button id="shortLinkPopupUrl" class="admin-short-links-summary-url" type="button" title="Copiar link">/go/seu-link</button>
      <div class="admin-short-links-summary-actions">
        <button id="shortLinkPopupCopyButton" type="button">${copyIcon()}<span>Copiar</span></button>
        <button id="shortLinkPopupOpenButton" type="button">${externalIcon()}<span>Abrir link</span></button>
      </div>
    </div>
    <div class="admin-short-links-summary-details">
      <div>
        <span>Destino</span>
        <strong id="shortLinkPopupDestination">Ainda não definido</strong>
      </div>
      <div>
        <span>Disponibilidade</span>
        <strong id="shortLinkPopupPeriod">Sempre disponível</strong>
      </div>
    </div>
    <button id="shortLinkPopupDestinationButton" class="admin-short-links-destination-button" type="button">
      ${externalIcon()}<span>Abrir destino</span>
    </button>
  `;

  main.append(overview);
  for (const element of [form, qrPanel, sharingPanel, analyticsFilters, analyticsPanel]) {
    if (element) main.append(element);
  }
  layout.append(main, summary);

  if (heading) {
    heading.insertAdjacentElement("afterend", tabs);
    tabs.insertAdjacentElement("afterend", layout);
  } else {
    editor.prepend(tabs, layout);
  }

  dialog.dataset.shortLinkPopupEnhanced = "true";
}

function popupTab(mode, label, icon) {
  return `<button type="button" role="tab" data-popup-tab="${mode}" aria-selected="false">${icon}<span>${label}</span></button>`;
}

function capturePopupMode(event) {
  const button = event.target.closest("[data-link-action]");
  if (!button) return;

  const explicitMode = button.dataset.shortLinkPopupMode;
  const action = button.dataset.linkAction;
  const supportedAction = action === "edit" || action === "qr" || action === "share";
  if (!explicitMode && !supportedAction) return;

  pendingMode = explicitMode || ({ qr: "qr", share: "share" }[action] || "edit");
  lastTrigger = button;
}

function enhanceShortLinkRows(list) {
  for (const row of list.querySelectorAll(".admin-short-link-row")) {
    const actions = row.querySelector(".admin-link-card-actions");
    const editButton = actions?.querySelector('[data-link-action="edit"]:not([data-short-link-popup-mode])');
    if (!actions || !editButton) continue;

    const label = editButton.querySelector("span");
    const canManage = label?.textContent.trim() === "Abrir";
    editButton.dataset.shortLinkPopupMode = canManage ? "edit" : "view";
    if (canManage && label) label.textContent = "Editar";

    if (canManage && !actions.querySelector('[data-short-link-popup-mode="view"]')) {
      const viewButton = createPopupActionButton({
        linkId: editButton.dataset.linkId,
        mode: "view",
        label: "Visualizar",
        icon: eyeIcon(),
      });
      actions.insertBefore(viewButton, editButton);
    }

    if (!actions.querySelector('[data-short-link-popup-mode="metrics"]')) {
      const metricsButton = createPopupActionButton({
        linkId: editButton.dataset.linkId,
        mode: "metrics",
        label: "Métricas",
        icon: analyticsIcon(),
      });
      editButton.insertAdjacentElement("afterend", metricsButton);
    }
  }
}

function createPopupActionButton({ linkId, mode, label, icon }) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.linkAction = "edit";
  button.dataset.linkId = linkId || "";
  button.dataset.shortLinkPopupMode = mode;
  button.innerHTML = `${icon}<span>${label}</span>`;
  return button;
}

function syncDialogState(dialog, editor) {
  if (editor.hidden) {
    if (dialog.open) dialog.close();
    dialog.removeAttribute("data-short-link-popup-mode");
    pendingMode = "edit";
    clearBaseDisabledState();
    if (lastTrigger?.isConnected) lastTrigger.focus({ preventScroll: true });
    lastTrigger = null;
    return;
  }

  if (!dialog.open) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  captureBaseDisabledState();
  captureBaseTitle(editor);
  syncPopupPresentation(dialog, editor);
  syncPopupTabs(editor);
  applyPopupMode(dialog, editor, pendingMode);
}

function captureBaseDisabledState() {
  const form = document.getElementById("shortLinksForm");
  if (!form) return;
  for (const control of form.elements) {
    baseDisabledState.set(control, control.disabled);
  }
}

function clearBaseDisabledState() {
  const form = document.getElementById("shortLinksForm");
  if (!form) return;
  for (const control of form.elements) baseDisabledState.delete(control);
}

function captureBaseTitle(editor) {
  const title = document.getElementById("shortLinksEditorTitle");
  if (title) editor.dataset.shortLinkBaseTitle = title.textContent || "Link personalizado";
}

function applyPopupMode(dialog, editor, mode) {
  const normalizedMode = POPUP_MODES.includes(mode) ? mode : "edit";
  const availableButton = document.querySelector(`#${TABS_ID} [data-popup-tab="${normalizedMode}"]:not([hidden])`);
  const resolvedMode = availableButton ? normalizedMode : firstAvailableMode();

  pendingMode = resolvedMode;
  dialog.dataset.shortLinkPopupMode = resolvedMode;

  const title = document.getElementById("shortLinksEditorTitle");
  const form = document.getElementById("shortLinksForm");
  const analyticsFilters = document.getElementById("shortLinkAnalyticsFilters");
  const analyticsPanel = document.getElementById("shortLinksAnalytics");

  restoreFormDisabledState(form);

  if (resolvedMode === "metrics" && title) title.textContent = "Métricas do link";
  if (resolvedMode === "qr" && title) title.textContent = "QR Code do link";
  if (resolvedMode === "share" && title) title.textContent = "Compartilhar link";
  if (resolvedMode === "view" && title) title.textContent = "Visualizar link";
  if (resolvedMode === "edit" && title) title.textContent = editor.dataset.shortLinkBaseTitle || "Editar link personalizado";

  if (resolvedMode === "view" && form) {
    for (const control of form.elements) control.disabled = true;
    form.querySelector('[type="submit"]')?.setAttribute("hidden", "");
  } else {
    form?.querySelector('[type="submit"]')?.removeAttribute("hidden");
  }

  if (resolvedMode === "metrics" && analyticsFilters?.hidden && analyticsPanel) {
    analyticsPanel.innerHTML = '<div class="admin-empty">Você não tem permissão para visualizar as métricas detalhadas deste link.</div>';
  }

  for (const button of document.querySelectorAll(`#${TABS_ID} [data-popup-tab]`)) {
    const selected = button.dataset.popupTab === resolvedMode;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }

  syncPopupPresentation(dialog, editor);

  window.requestAnimationFrame(() => {
    document.querySelector(".admin-short-links-popup-main")?.scrollTo?.({ top: 0, behavior: "auto" });
  });
}

function restoreFormDisabledState(form) {
  if (!form) return;
  for (const control of form.elements) {
    if (baseDisabledState.has(control)) control.disabled = baseDisabledState.get(control);
  }
}

function syncPopupTabs(editor) {
  const form = document.getElementById("shortLinksForm");
  const slug = form?.elements?.slug;
  const destination = form?.elements?.destination_url;
  const qrPanel = document.getElementById("shortLinkQrPanel");
  const sharingPanel = document.getElementById("shortLinkSharingPanel");
  const analyticsFilters = document.getElementById("shortLinkAnalyticsFilters");

  const isNew = Boolean(slug && !slug.disabled);
  const canEdit = !destination || baseDisabledState.get(destination) !== true;

  setPopupTabHidden("view", isNew);
  setPopupTabHidden("edit", !canEdit && !isNew);
  setPopupTabHidden("metrics", isNew || Boolean(analyticsFilters?.hidden));
  setPopupTabHidden("qr", isNew || Boolean(qrPanel?.hidden));
  setPopupTabHidden("share", isNew || Boolean(sharingPanel?.hidden));

  editor.dataset.shortLinkPopupNew = String(isNew);
}

function setPopupTabHidden(mode, hidden) {
  const button = document.querySelector(`#${TABS_ID} [data-popup-tab="${mode}"]`);
  if (button) button.hidden = hidden;
}

function firstAvailableMode() {
  const button = document.querySelector(`#${TABS_ID} [data-popup-tab]:not([hidden])`);
  return button?.dataset.popupTab || "edit";
}

function syncPopupPresentation(dialog, editor) {
  if (!dialog || !editor || editor.hidden) return;

  const form = document.getElementById("shortLinksForm");
  if (!form) return;

  const name = form.elements.internal_name?.value.trim() || "Novo link";
  const destination = form.elements.destination_url?.value.trim() || "";
  const status = form.elements.status?.value || "active";
  const startsAt = form.elements.starts_at?.value || "";
  const expiresAt = form.elements.expires_at?.value || "";
  const notes = form.elements.notes?.value.trim() || "";
  const shortUrl = currentPopupShortUrl();
  const period = formatAvailability(startsAt, expiresAt);

  setText("shortLinkPopupSummaryName", name);
  setText("shortLinkPopupUrl", shortUrl || "/go/seu-link");
  setText("shortLinkPopupDestination", destination || "Ainda não definido");
  setText("shortLinkPopupPeriod", period);
  setText("shortLinkPopupOverviewName", name);
  setText("shortLinkPopupOverviewUrl", shortUrl || "/go/seu-link");
  setText("shortLinkPopupOverviewDestination", destination || "Ainda não definido");
  setText("shortLinkPopupOverviewPeriod", period);
  setText("shortLinkPopupOverviewNotes", notes || "Sem notas internas.");

  syncStatusPill(document.getElementById("shortLinkPopupStatus"), status);
  syncStatusPill(document.getElementById("shortLinkPopupOverviewStatus"), status);
  syncSummaryQr();

  const copyButton = document.getElementById("shortLinkPopupCopyButton");
  const openButton = document.getElementById("shortLinkPopupOpenButton");
  const destinationButton = document.getElementById("shortLinkPopupDestinationButton");
  if (copyButton) copyButton.disabled = !shortUrl;
  if (openButton) openButton.disabled = !shortUrl;
  if (destinationButton) destinationButton.disabled = !destination;

  syncPopupTabs(editor);
}

function syncSummaryQr() {
  const source = document.getElementById("shortLinkQrImage");
  const summary = document.getElementById("shortLinkPopupSummaryQr");
  if (!summary) return;
  const src = source?.getAttribute("src") || "";
  if (src) {
    summary.src = src;
    summary.hidden = false;
  } else {
    summary.removeAttribute("src");
    summary.hidden = true;
  }
}

function syncStatusPill(element, status) {
  if (!element) return;
  const normalized = status === "paused" ? "paused" : status === "archived" ? "archived" : "active";
  element.dataset.status = normalized;
  element.textContent = normalized === "paused" ? "Pausado" : normalized === "archived" ? "Arquivado" : "Ativo";
}

function currentPopupShortUrl() {
  const qrUrl = document.getElementById("shortLinkQrUrl")?.textContent?.trim();
  if (qrUrl) return qrUrl;
  return document.getElementById("shortLinksPreview")?.textContent?.trim() || "";
}

function absolutePopupShortUrl() {
  const value = currentPopupShortUrl();
  if (!value) return "";
  try {
    return new URL(value, window.location.origin).href;
  } catch {
    return "";
  }
}

function formatAvailability(startsAt, expiresAt) {
  if (!startsAt && !expiresAt) return "Sempre disponível";
  const start = startsAt ? formatLocalDate(startsAt) : "agora";
  const end = expiresAt ? formatLocalDate(expiresAt) : "sem expiração";
  return `${start} até ${end}`;
}

function formatLocalDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function copyPopupShortUrl() {
  const value = absolutePopupShortUrl();
  if (!value) return;
  const button = document.getElementById("shortLinkPopupCopyButton");
  try {
    await navigator.clipboard?.writeText(value);
    if (button) {
      const label = button.querySelector("span");
      if (label) label.textContent = "Copiado";
      window.setTimeout(() => {
        if (label) label.textContent = "Copiar";
      }, 1400);
    }
  } catch {
    // The original editor copy action remains available as a fallback.
  }
}

function openPopupShortUrl() {
  const value = absolutePopupShortUrl();
  if (value) window.open(value, "_blank", "noopener,noreferrer");
}

function openPopupDestination() {
  const destination = document.getElementById("shortLinksForm")?.elements?.destination_url?.value?.trim();
  if (!destination) return;
  try {
    const url = new URL(destination);
    if (url.protocol === "http:" || url.protocol === "https:") {
      window.open(url.href, "_blank", "noopener,noreferrer");
    }
  } catch {
    // Invalid values remain highlighted by the native URL input validation.
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const stylesheet = document.createElement("link");
  stylesheet.id = STYLE_ID;
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/css/modules/admin/short-links-popup.css?v=20260831-1";
  document.head.append(stylesheet);
}

function eyeIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
}

function editIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>';
}

function analyticsIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 19V10M10 19V5M16 19v-7M22 19V8"/></svg>';
}

function qrIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 14h2v2h-2zM18 14h2v4h-2zM14 18h4v2h-4z"/></svg>';
}

function shareIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.9 7.4-4.4M8.3 13.1l7.4 4.4"/></svg>';
}

function linkIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/></svg>';
}

function copyIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/></svg>';
}

function externalIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14 5h5v5M19 5l-8 8"/><path d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"/></svg>';
}
