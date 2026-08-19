const STYLESHEET_HREF = "/css/modules/admin/admin-downloads.css";
const CARD_MARKER = "data-admin-downloads-card";
const DIALOG_ID = "adminDownloadsDialog";

const PACKAGES = [
  {
    name: "Fioreze ERP",
    description: "Aplicativo desktop do ERP Fioreze para Windows.",
    installer: "/downloads/erp/installer",
    files: "/downloads/erp/download",
    icon: "monitor",
  },
  {
    name: "Fioreze Suite",
    description: "Suite local de serviços e impressão para os computadores das unidades.",
    installer: "/downloads/print-agent/installer",
    files: "/downloads/print-agent/download",
    icon: "package",
  },
];

let installed = false;

export function installAdminDownloads(root = document) {
  if (installed || !root?.querySelector) return;
  installed = true;
  ensureStylesheet(root);
  ensureDialog(root);
  ensureSettingsCard(root);

  const settingsGrid = root.getElementById?.("settingsGrid");
  if (settingsGrid) {
    const observer = new MutationObserver(() => ensureSettingsCard(root));
    observer.observe(settingsGrid, { childList: true });
  }
}

function ensureStylesheet(root) {
  if (root.querySelector(`link[href="${STYLESHEET_HREF}"]`)) return;
  const link = root.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_HREF;
  root.head?.append(link);
}

function ensureSettingsCard(root) {
  const grid = root.getElementById?.("settingsGrid");
  if (!grid || grid.querySelector(`[${CARD_MARKER}]`)) return;

  const button = root.createElement("button");
  button.type = "button";
  button.className = "admin-settings-card admin-downloads-settings-card";
  button.setAttribute(CARD_MARKER, "");
  button.innerHTML = `
    <span class="admin-settings-icon">${downloadIcon()}</span>
    <div><strong>Downloads</strong><p>Baixe os instaladores do Fioreze ERP e Fioreze Suite.</p></div>
    <span class="admin-settings-arrow" aria-hidden="true">›</span>
  `;
  button.addEventListener("click", () => openDialog(root));
  grid.append(button);
}

function ensureDialog(root) {
  if (root.getElementById?.(DIALOG_ID)) return;
  const dialog = root.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "admin-downloads-dialog";
  dialog.setAttribute("aria-labelledby", `${DIALOG_ID}Title`);
  dialog.innerHTML = `
    <div class="admin-downloads-shell">
      <header>
        <div>
          <p>Central Administrativa</p>
          <h2 id="${DIALOG_ID}Title">Downloads</h2>
          <span>Pacotes disponíveis para os computadores da operação.</span>
        </div>
        <button type="button" class="admin-downloads-close" data-admin-downloads-close aria-label="Fechar">${closeIcon()}</button>
      </header>
      <div class="admin-downloads-grid">
        ${PACKAGES.map(renderPackage).join("")}
      </div>
    </div>
  `;
  dialog.querySelector("[data-admin-downloads-close]")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  root.body?.append(dialog);
}

function openDialog(root) {
  const dialog = root.getElementById?.(DIALOG_ID);
  if (!dialog) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function renderPackage(item) {
  return `
    <article class="admin-download-package">
      <span class="admin-download-package-icon">${item.icon === "monitor" ? monitorIcon() : packageIcon()}</span>
      <div class="admin-download-package-copy">
        <strong>${item.name}</strong>
        <p>${item.description}</p>
      </div>
      <div class="admin-download-package-actions">
        <a class="admin-download-primary" href="${item.installer}">${downloadIcon()}<span>Baixar instalador</span></a>
        <a class="admin-download-secondary" href="${item.files}" target="_blank" rel="noopener">Ver arquivos do release</a>
      </div>
    </article>
  `;
}

function svg(paths) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function downloadIcon() {
  return svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>');
}

function monitorIcon() {
  return svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>');
}

function packageIcon() {
  return svg('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4.5 7.8 7.5 4.2 7.5-4.2M12 12v9"/>');
}

function closeIcon() {
  return svg('<path d="m6 6 12 12M18 6 6 18"/>');
}
