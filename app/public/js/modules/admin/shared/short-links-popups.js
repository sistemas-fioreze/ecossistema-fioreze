const DIALOG_ID = "adminShortLinksDialog";
const STYLE_ID = "adminShortLinksDialogStyles";

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

  const manager = document.getElementById("shortLinksManager");
  const list = document.getElementById("shortLinksList");
  const addButton = document.getElementById("addShortLinkButton");
  const closeButton = document.getElementById("cancelShortLinkButton");

  list?.addEventListener("click", capturePopupMode, true);
  addButton?.addEventListener("click", () => {
    pendingMode = "edit";
    lastTrigger = addButton;
  }, true);

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

  syncDialogState(dialog, editor);
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
    if (lastTrigger?.isConnected) lastTrigger.focus({ preventScroll: true });
    lastTrigger = null;
    return;
  }

  if (!dialog.open) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  applyPopupMode(dialog, editor, pendingMode);
}

function applyPopupMode(dialog, editor, mode) {
  const normalizedMode = ["edit", "view", "metrics", "qr", "share"].includes(mode) ? mode : "edit";
  dialog.dataset.shortLinkPopupMode = normalizedMode;

  const title = document.getElementById("shortLinksEditorTitle");
  const form = document.getElementById("shortLinksForm");
  const analyticsFilters = document.getElementById("shortLinkAnalyticsFilters");
  const analyticsPanel = document.getElementById("shortLinksAnalytics");

  if (normalizedMode === "metrics" && title) title.textContent = "Métricas do link";
  if (normalizedMode === "qr" && title) title.textContent = "QR Code do link";
  if (normalizedMode === "share" && title) title.textContent = "Compartilhar link";
  if (normalizedMode === "view" && title) title.textContent = "Visualizar link";

  if (normalizedMode === "view" && form) {
    for (const control of form.elements) control.disabled = true;
    form.querySelector('[type="submit"]')?.setAttribute("hidden", "");
  }

  if (normalizedMode === "metrics" && analyticsFilters?.hidden && analyticsPanel) {
    analyticsPanel.innerHTML = '<div class="admin-empty">Você não tem permissão para visualizar as métricas detalhadas deste link.</div>';
  }

  window.requestAnimationFrame(() => {
    editor.scrollTo?.({ top: 0, behavior: "auto" });
  });
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${DIALOG_ID} {
      width: min(1080px, calc(100vw - 32px));
      max-width: 1080px;
      max-height: calc(100vh - 32px);
      margin: auto;
      border: 0;
      border-radius: 14px;
      padding: 0;
      background: transparent;
      color: inherit;
      overflow: hidden;
    }

    #${DIALOG_ID}::backdrop {
      background: rgba(24, 27, 31, 0.46);
      backdrop-filter: blur(4px);
    }

    #${DIALOG_ID} > .admin-short-links-editor {
      width: 100%;
      max-height: calc(100vh - 32px);
      margin: 0;
      overflow: auto;
      border: 1px solid #dfe2e4;
      border-radius: 14px;
      padding: 0 22px 22px;
      background: #fff;
      box-shadow: 0 28px 80px rgba(20, 24, 28, 0.24);
    }

    #${DIALOG_ID} > .admin-short-links-editor > .admin-panel-heading {
      position: sticky;
      top: 0;
      z-index: 4;
      margin: 0 -22px 20px;
      padding: 18px 22px 15px;
      border-bottom: 1px solid #e1e4e7;
      background: #fff;
    }

    #${DIALOG_ID} .admin-link-editor-close {
      min-width: 74px;
    }

    #${DIALOG_ID}[data-short-link-popup-mode="edit"] :is(#shortLinkAnalyticsFilters, #shortLinksAnalytics, #shortLinkSharingPanel, #shortLinkQrPanel),
    #${DIALOG_ID}[data-short-link-popup-mode="view"] :is(#shortLinkAnalyticsFilters, #shortLinksAnalytics, #shortLinkSharingPanel),
    #${DIALOG_ID}[data-short-link-popup-mode="metrics"] :is(#shortLinksForm, #shortLinkQrPanel, #shortLinkSharingPanel),
    #${DIALOG_ID}[data-short-link-popup-mode="qr"] :is(#shortLinksForm, #shortLinkAnalyticsFilters, #shortLinksAnalytics, #shortLinkSharingPanel),
    #${DIALOG_ID}[data-short-link-popup-mode="share"] :is(#shortLinksForm, #shortLinkQrPanel, #shortLinkAnalyticsFilters, #shortLinksAnalytics) {
      display: none !important;
    }

    #${DIALOG_ID}[data-short-link-popup-mode="view"] #shortLinksForm [type="submit"] {
      display: none !important;
    }

    #${DIALOG_ID}[data-short-link-popup-mode="metrics"] #shortLinkAnalyticsFilters,
    #${DIALOG_ID}[data-short-link-popup-mode="metrics"] #shortLinksAnalytics,
    #${DIALOG_ID}[data-short-link-popup-mode="qr"] #shortLinkQrPanel,
    #${DIALOG_ID}[data-short-link-popup-mode="share"] #shortLinkSharingPanel {
      margin-top: 0;
    }

    @media (max-width: 720px) {
      #${DIALOG_ID} {
        width: calc(100vw - 16px);
        max-height: calc(100vh - 16px);
        border-radius: 10px;
      }

      #${DIALOG_ID} > .admin-short-links-editor {
        max-height: calc(100vh - 16px);
        border-radius: 10px;
        padding: 0 14px 16px;
      }

      #${DIALOG_ID} > .admin-short-links-editor > .admin-panel-heading {
        margin-inline: -14px;
        padding-inline: 14px;
      }
    }
  `;
  document.head.append(style);
}

function eyeIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
}

function analyticsIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 19V10M10 19V5M16 19v-7M22 19V8"/></svg>';
}
