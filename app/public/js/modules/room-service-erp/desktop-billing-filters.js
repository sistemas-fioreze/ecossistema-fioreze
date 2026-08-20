const STYLESHEET_HREF = "/css/modules/room-service-erp/desktop-billing-filters.css?v=20260819-3";

export function setupDesktopBillingFilters(root = document) {
  if (!window.fiorezeDesktop?.isElectron) return;

  ensureStyles(root);

  const filters = root.querySelector(".erp-billing-filters");
  if (!filters || filters.dataset.desktopBillingPolished === "true") return;

  filters.dataset.desktopBillingPolished = "true";
  filters.classList.add("erp-billing-toolbar");

  enhanceDateField(root, filters.querySelector("#histFrom"), "De");
  enhanceDateField(root, filters.querySelector("#histTo"), "Até");
  filters.querySelector("#billingRefreshButton")?.classList.add("erp-billing-toolbar-action", "erp-billing-toolbar-refresh");
  filters.querySelector("#billingExportButton")?.classList.add("erp-billing-toolbar-action", "erp-billing-toolbar-export");
}

function enhanceDateField(root, input, labelText) {
  const label = input?.closest("label");
  if (!label) return;

  const caption = root.createElement("span");
  caption.className = "erp-billing-filter-label";
  caption.textContent = labelText;

  const icon = root.createElement("span");
  icon.className = "erp-billing-date-leading-icon";
  icon.innerHTML = '<i data-lucide="calendar-days" aria-hidden="true"></i>';

  label.classList.add("erp-billing-date-field");
  input.classList.add("erp-billing-date-input");
  input.setAttribute("aria-label", `${labelText} do período`);
  label.replaceChildren(caption, icon, input);
}

function ensureStyles(root) {
  if (root.querySelector('link[data-erp-desktop-billing-filters]')) return;

  const link = root.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_HREF;
  link.dataset.erpDesktopBillingFilters = "";
  root.head.append(link);
}
