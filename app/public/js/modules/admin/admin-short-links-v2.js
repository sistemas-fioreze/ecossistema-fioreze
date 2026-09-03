const STYLESHEET_HREF = "/css/modules/admin/admin-short-links-v2.css?v=20260903-1";
const SECONDARY_ACTIONS = new Set(["share", "toggle", "archive", "delete"]);
let syncFrame = 0;

export function setupAdminShortLinksV2(root = document) {
  const manager = root.getElementById("shortLinksManager");
  if (!manager) return;
  ensureStyles(root);
  manager.dataset.linksDesign = "v2";

  const scheduleSync = () => {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(() => syncShortLinks(manager, root));
  };

  scheduleSync();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(manager, { childList: true, subtree: true, characterData: true });

  const hotel = root.getElementById("shortLinksHotel");
  if (hotel && hotel.dataset.linksAutoFilter !== "true") {
    hotel.dataset.linksAutoFilter = "true";
    hotel.addEventListener("change", () => root.getElementById("shortLinksFilters")?.requestSubmit());
  }

  manager.addEventListener("click", handleManagerClick);
  document.addEventListener("click", (event) => {
    if (event.target.closest(".admin-links-overflow")) return;
    closeOverflowMenus(manager);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeOverflowMenus(manager);
  });
}

function syncShortLinks(manager, root) {
  enhanceSummary(manager, root);
  for (const card of manager.querySelectorAll(".admin-short-link-row.admin-link-card")) enhanceCardActions(card, root);
}

function enhanceSummary(manager, root) {
  const summary = manager.querySelector("#shortLinksSummary");
  const status = root.getElementById("shortLinksStatus");
  if (!summary || !status) return;

  const filters = ["active", "paused", "archived", ""];
  [...summary.querySelectorAll(":scope > article")].forEach((article, index) => {
    if (index > 2) return;
    article.dataset.linksSummaryFilter = filters[index];
    article.tabIndex = 0;
    article.setAttribute("role", "button");
    const label = article.querySelector("span")?.textContent?.trim() || "status";
    article.setAttribute("aria-label", `Filtrar por ${label.toLowerCase()}`);
  });
}

function enhanceCardActions(card, root) {
  const actions = card.querySelector(".admin-link-card-actions");
  if (!actions || actions.dataset.linksV2 === "true") return;
  actions.dataset.linksV2 = "true";

  const buttons = [...actions.querySelectorAll(":scope > button[data-link-action]")];
  const secondary = buttons.filter((button) => SECONDARY_ACTIONS.has(button.dataset.linkAction));
  if (!secondary.length) return;

  const overflow = root.createElement("div");
  overflow.className = "admin-links-overflow";
  overflow.innerHTML = `
    <button class="admin-links-overflow-trigger" type="button" aria-expanded="false" aria-label="Mais ações" title="Mais ações">•••</button>
    <div class="admin-links-overflow-menu" role="menu"></div>
  `;
  const menu = overflow.querySelector(".admin-links-overflow-menu");
  for (const button of secondary) {
    button.setAttribute("role", "menuitem");
    menu.append(button);
  }
  actions.append(overflow);
}

function handleManagerClick(event) {
  const summaryFilter = event.target.closest("[data-links-summary-filter]");
  if (summaryFilter) {
    const status = document.getElementById("shortLinksStatus");
    if (status) {
      status.value = summaryFilter.dataset.linksSummaryFilter || "";
      status.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return;
  }

  const trigger = event.target.closest(".admin-links-overflow-trigger");
  if (trigger) {
    event.preventDefault();
    event.stopPropagation();
    const overflow = trigger.closest(".admin-links-overflow");
    const willOpen = !overflow.classList.contains("is-open");
    closeOverflowMenus(event.currentTarget);
    overflow.classList.toggle("is-open", willOpen);
    trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    return;
  }

  if (event.target.closest(".admin-links-overflow-menu [data-link-action]")) {
    closeOverflowMenus(event.currentTarget);
  }
}

function closeOverflowMenus(scope) {
  for (const overflow of scope.querySelectorAll(".admin-links-overflow.is-open")) {
    overflow.classList.remove("is-open");
    overflow.querySelector(".admin-links-overflow-trigger")?.setAttribute("aria-expanded", "false");
  }
}

function ensureStyles(root) {
  if (root.querySelector('link[data-admin-short-links-v2]')) return;
  const link = root.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET_HREF;
  link.dataset.adminShortLinksV2 = "";
  root.head.append(link);
}

if (typeof document !== "undefined") setupAdminShortLinksV2();
