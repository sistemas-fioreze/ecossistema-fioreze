import {
  archiveGuest,
  changeOwnErpPassword,
  createCatalogCategory,
  createCatalogItem,
  createErpUser,
  createPdvOrder,
  createPrinterEnrollment,
  createRoom,
  deleteCatalogItem,
  deleteOwnAvatar,
  deletePrinterDevice,
  getBilling,
  getCatalog,
  getContext,
  getDashboard,
  getGuests,
  getLoginContext,
  getPublicHotelBootstrap,
  identifyLoginUser,
  getOperations,
  getPrinting,
  getOrder,
  getSession,
  listErpPermissions,
  listErpMedia,
  listErpUsers,
  listRooms,
  listOrders,
  login,
  logout,
  resetErpUserPassword,
  reprintOrder,
  setOperationMode,
  submitErpFeedback,
  updateCatalogItem,
  updateErpUser,
  updateOrderStatus,
  updateOrderPreferences,
  updatePrinterDevice,
  updatePrinting,
  updateRoom,
  updateSchedule,
  uploadErpMedia,
  uploadOwnAvatar,
} from "./api.js";
import { desktop } from "./desktop-adapter.js";
import { setupHelpCenter } from "./help.js?v=20260820-5";
import { iconMarkup } from "./icon-system.js";
import { buildInterfaceViewport } from "./interface-viewport.js";
import { bindPdvCheckoutActions, bindPdvDropTarget, bindPdvProductDrag } from "./pdv-actions.js";
import { getErpSearchContext } from "./search-context.js?v=20260820-1";
import { ERP_APP_VERSION } from "./static-config.js";
import { applyBrandTokens } from "./theme.js";
import { evaluateServiceStatus } from "../room-service/service-status.js";

const ROUTES = {
  dashboard: { button: "btnTabDashboard", container: "dashboardContainer" },
  vendas: { button: "btnTabVendas", container: "vendasContainer" },
  hist: { button: "btnTabHist", container: "histContainer" },
  hospedes: { button: "btnTabHospedes", container: "hospedesContainer" },
  faturamento: { button: "btnTabFaturamento", container: "faturamentoContainer" },
  cardapio: { button: "btnTabCardapio", container: "cardapioContainer" },
  admin: { button: "btnTabAdmin", container: "adminContainer" },
};

const STATUS_LABELS = {
  sent: "Enviado",
  printed: "Impresso",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const NEXT_STATUS = {
  sent: "printed",
  printed: "delivered",
};

const state = {
  session: null,
  hotelId: "",
  context: null,
  dashboard: null,
  orders: [],
  catalog: { categories: [] },
  guests: null,
  billing: null,
  route: "dashboard",
  searchQueries: Object.fromEntries(Object.keys(ROUTES).map((route) => [route, ""])),
  cart: new Map(),
  selectedOrderId: null,
  loginHotels: [],
  loginHotel: null,
  loginServiceStatus: undefined,
  hotelSlug: resolveErpHotelSlug(),
  users: [],
  userPermissions: [],
  operations: null,
  printing: null,
  printerEnrollment: null,
  localPrintAgent: null,
  rooms: [],
  media: [],
  catalogCategory: "all",
  settingsView: "home",
  scheduleViewMode: null,
  notifications: [],
  knownOrderIds: new Set(),
  orderPollTimer: null,
  notificationSoundEnabled: localStorage.getItem("fioreze-erp-notification-sound") !== "false",
  notificationVolume: clampNumber(localStorage.getItem("fioreze-erp-notification-volume"), 0, 100, 70),
  interfaceScale: clampNumber(localStorage.getItem("fioreze-erp-interface-scale"), 85, 115, 100),
  feedbackScreenshot: null,
  feedbackPreviewUrl: "",
  applicationVersions: createInitialApplicationVersions(),
  pendingStatusAction: null,
};

const ERP_KEYBOARD_SHORTCUTS = Object.freeze({
  d: "dashboard",
  v: "vendas",
  p: "hist",
  f: "faturamento",
  c: "cardapio",
  s: "admin",
});

let notificationAudioContext = null;
let loginUserLookupTimer = null;
let loginUserLookupSequence = 0;

const toastRegion = document.createElement("div");
toastRegion.className = "legacy-toast-region";
toastRegion.setAttribute("aria-live", "polite");
document.body.append(toastRegion);

prepareStaticInterface();
const helpCenter = setupHelpCenter({
  getRoute: () => state.route,
  getPermissions: () => state.session?.permissions || [],
  isElectron: () => desktop.isElectron,
  isMaster: () => Boolean(state.session?.erp_master),
});
bindStaticActions();
boot();

async function boot() {
  setLoginBusy(true, "Verificando sessao...");
  try {
    await loadLoginContext();
    const payload = await getSession();
    await startSession(payload.data);
  } catch (error) {
    if (error.status !== 401) notify("Nao foi possivel verificar a sessao administrativa.");
    showLogin();
    if (error.status !== 401) {
      byId("legacyLoginError").textContent = error.message || "Unidade indisponivel para o ERP.";
    }
  } finally {
    setLoginBusy(false);
  }
}

async function loadLoginContext() {
  const payload = await getLoginContext();
  state.loginHotels = payload.data.hotels || [];
  state.loginHotel = resolvePinnedHotel(state.loginHotels);
  if (!state.loginHotel) throw new Error("Esta unidade nao possui um ERP Room Service disponivel.");
  state.hotelSlug = state.loginHotel.slug;
  applyBranding(state.loginHotel.branding, state.loginHotel);
  await refreshLoginServiceStatus();
}

function prepareStaticInterface() {
  const loginCode = byId("loginCode");
  loginCode.type = "text";
  loginCode.autocomplete = "username";
  loginCode.inputMode = "text";
  loginCode.placeholder = "Codigo do usuario";
  byId("loginPass").autocomplete = "current-password";
  byId("btnLogin").type = "button";

  installPdvInterface();
  installOrdersInterface();
  installGuestsInterface();

  const error = document.createElement("p");
  error.id = "legacyLoginError";
  error.className = "legacy-login-error";
  error.setAttribute("role", "alert");
  byId("btnLogin").before(error);
  byId("loginNameBadge").classList.add("hidden");
  installLoginComposition();

  installDashboardInterface();
  installBillingInterface();
  installCatalogInterface();
  installSettingsInterface();
  installUserModal();
  installOperationalModals();
  installOrderDetailsInterface();
  installFeedbackInterface();
  installVisualSystem();

  byId("sidebarPinButton", false)?.remove();
  document.querySelector("[data-app-version-button]")?.remove();
  document.querySelector(".login-version-note")?.remove();
  byId("welcomeOverlay", false)?.remove();
  document.querySelector(".sidebar-footer:empty")?.remove();
  byId("quickThemeTile", false)?.remove();
  document.documentElement.classList.remove("dark");
  localStorage.removeItem("fioreze-erp-theme");
  document.querySelectorAll(".side-nav-btn").forEach((button) => {
    button.title = button.querySelector(".side-text")?.textContent?.trim() || "";
  });
  installStoreQuickPanel();
  applyInterfaceScale(state.interfaceScale, false);
  updateNotificationSoundUI();

  configureShortcutHints();
}

function bindStaticActions() {
  byId("btnLogin").addEventListener("click", handleLogin);
  byId("loginPass").addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleLogin();
  });
  byId("loginCode").addEventListener("keydown", (event) => {
    if (byId("loginCode").dataset.loginCredential && isLoginIdentityEditKey(event)) {
      clearLoginIdentity({ clearValue: true });
    }
    if (event.key === "Enter") byId("loginPass").focus();
  });
  byId("loginCode").addEventListener("input", scheduleLoginUserLookup);
  byId("erpUserModalClose")?.addEventListener("click", closeUserModal);
  byId("erpUserModalCancel")?.addEventListener("click", closeUserModal);
  byId("erpUserForm")?.addEventListener("submit", saveErpUser);
  byId("erpUserModal")?.addEventListener("click", (event) => {
    if (event.target === byId("erpUserModal")) closeUserModal();
  });
  byId("catalogItemForm")?.addEventListener("submit", saveCatalogItem);
  byId("deleteCatalogItemButton")?.addEventListener("click", removeCatalogItem);
  byId("catalogCategoryForm")?.addEventListener("submit", saveCatalogCategory);
  byId("roomForm")?.addEventListener("submit", saveRoom);
  document.querySelectorAll("[data-close-erp-modal]").forEach((button) => button.addEventListener("click", () => button.closest(".erp-modal")?.classList.add("hidden")));
  document.querySelectorAll(".erp-modal").forEach((modal) => modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.add("hidden");
  }));

  byId("cardapioContainer").addEventListener("click", handleCatalogClick);
  byId("adminContainer").addEventListener("click", handleSettingsClick);
  byId("adminContainer").addEventListener("submit", handleSettingsSubmit);

  for (const [route, config] of Object.entries(ROUTES)) {
    byId(config.button)?.addEventListener("click", () => switchTab(route));
  }

  const sessionButton = document.querySelector(".top-session");
  sessionButton?.addEventListener("click", () => byId("accountPopover").classList.toggle("hidden"));
  document.querySelector(".quick-tile.logout")?.addEventListener("click", handleLogout);
  byId("hdrStoreButton")?.addEventListener("click", toggleStoreQuickPanel);
  byId("accountConfigButton")?.addEventListener("click", () => openSettingsView("home"));
  document.querySelector(".quick-tile.print")?.addEventListener("click", () => openSettingsView("printing"));
  document.querySelector(".quick-tile.store")?.addEventListener("click", () => openSettingsView("operation"));
  document.querySelector(".quick-tile.password")?.addEventListener("click", () => openSettingsView("account"));

  const notificationButton = document.querySelector(".notif-button");
  notificationButton?.addEventListener("click", () => byId("notifDropdown").classList.toggle("hidden"));
  byId("notifDropdown")?.querySelector("button")?.addEventListener("click", clearNotifications);
  byId("notifList")?.addEventListener("click", (event) => {
    const order = event.target.closest("[data-notification-order]");
    if (order) {
      byId("notifDropdown").classList.add("hidden");
      openOrder(order.dataset.notificationOrder);
    }
  });
  byId("notifList").innerHTML = '<div class="legacy-list-empty">Nenhuma notificacao.</div>';
  updateNotificationBadge(0);

  const topSearch = byId("topSearchInput", false);
  topSearch?.addEventListener("input", handleTopSearchInput);
  topSearch?.addEventListener("focus", handleTopSearchFocus);
  topSearch?.addEventListener("keydown", handleTopSearchKeydown);
  byId("topSearchWrap", false)?.addEventListener("click", (event) => {
    if (!event.target.closest("#topSearchResults")) topSearch?.focus();
  });
  byId("topSearchResults", false)?.addEventListener("click", handleTopSearchClick);
  bindPdvDropTarget({
    target: document.querySelector(".erp-pdv-cart-section"),
    onProductDrop: addToCart,
  });
  byId("roomNumber", false)?.addEventListener("input", renderPdvRoomOptions);
  byId("roomNumber", false)?.addEventListener("focus", openPdvRoomOptions);
  byId("roomNumber", false)?.addEventListener("click", openPdvRoomOptions);
  byId("roomNumber", false)?.addEventListener("keydown", handlePdvRoomKeydown);
  byId("roomOptions", false)?.addEventListener("click", handlePdvRoomSelection);
  byId("roomComboboxToggle", false)?.addEventListener("click", togglePdvRoomOptions);
  byId("dashDate", false)?.addEventListener("change", renderDashboard);
  byId("histDate", false)?.addEventListener("change", renderOrders);
  byId("histFrom", false)?.addEventListener("change", renderBilling);
  byId("histTo", false)?.addEventListener("change", renderBilling);
  byId("billingRefreshButton", false)?.addEventListener("click", renderBilling);
  byId("billingExportButton", false)?.addEventListener("click", exportBillingCsv);
  byId("ordersRefreshButton", false)?.addEventListener("click", refreshAll);
  byId("guestsRefreshButton", false)?.addEventListener("click", refreshAll);
  byId("erpFeedbackButton", false)?.addEventListener("click", openFeedbackDialog);
  byId("erpFeedbackForm", false)?.addEventListener("submit", sendErpFeedback);
  byId("erpFeedbackCapture", false)?.addEventListener("click", captureFeedbackScreenshot);
  document.querySelectorAll("[data-close-feedback]").forEach((button) => button.addEventListener("click", closeFeedbackDialog));

  const scaleRange = byId("interfaceScaleRange", false);
  scaleRange?.addEventListener("input", () => applyInterfaceScale(scaleRange.value, false));
  scaleRange?.addEventListener("change", () => applyInterfaceScale(scaleRange.value, true));
  const volumeRange = byId("notificationVolumeRange", false);
  volumeRange?.addEventListener("input", () => previewNotificationVolume(volumeRange.value));
  volumeRange?.addEventListener("change", () => saveNotificationVolume(volumeRange.value));
  byId("notificationSoundButton", false)?.addEventListener("click", toggleNotificationSound);
  document.addEventListener("pointerdown", unlockNotificationAudio, { once: true });

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 1100px)").matches) {
      document.body.classList.toggle("sidebar-open");
      byId("sidebarToggleButton")?.setAttribute("aria-expanded", String(document.body.classList.contains("sidebar-open")));
      return;
    }
    document.body.classList.toggle("sidebar-collapsed");
  };
  byId("sidebarToggleButton")?.addEventListener("click", toggleSidebar);
  byId("erpSidebarBackdrop", false)?.addEventListener("click", () => {
    document.body.classList.remove("sidebar-open");
    byId("sidebarToggleButton")?.setAttribute("aria-expanded", "false");
  });
  byId("erpSidebarClose", false)?.addEventListener("click", () => {
    document.body.classList.remove("sidebar-open");
    byId("sidebarToggleButton")?.setAttribute("aria-expanded", "false");
  });

  const orderModal = byId("orderModal");
  orderModal.querySelector('button[title="Fechar"]')?.addEventListener("click", () => orderModal.classList.add("hidden"));
  orderModal.addEventListener("click", (event) => {
    if (event.target === orderModal) orderModal.classList.add("hidden");
  });

  document.addEventListener("keydown", handleGlobalKeyboardShortcut);

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#topSearchWrap")) closeTopSearch();
    if (!event.target.closest("#roomCombobox")) closePdvRoomOptions();
    if (!event.target.closest("#hdrStoreButton") && !event.target.closest("#storeQuickPanel")) {
      byId("storeQuickPanel", false)?.classList.add("hidden");
    }
  });
}

function installLoginComposition() {
  const card = document.querySelector(".login-card");
  const logo = card?.querySelector(".login-logo");
  const badge = byId("loginStoreBadge", false);
  const fields = card?.querySelector(".login-fields");
  const error = byId("legacyLoginError", false);
  const button = byId("btnLogin", false);
  if (!card || !logo || !badge || !fields || !error || !button || card.querySelector(".erp-login-brand")) return;

  const brand = document.createElement("section");
  brand.className = "erp-login-brand";
  brand.innerHTML = '<p>ERP Fioreze</p><h1>Operação clara.<br>Atendimento ágil.</h1><span>Pedidos, cardápio e equipe em um único lugar.</span>';
  brand.prepend(logo);

  const form = document.createElement("section");
  form.className = "erp-login-form";
  form.innerHTML = '<header><p>Acesso da unidade</p><h2>Entrar no ERP</h2><span>Use seu código de usuário e senha.</span></header>';

  const codeField = document.createElement("label");
  const passwordField = document.createElement("label");
  codeField.className = "erp-login-field";
  passwordField.className = "erp-login-field";
  codeField.innerHTML = "<span>C&oacute;digo do usu&aacute;rio</span>";
  passwordField.innerHTML = "<span>Senha</span>";
  codeField.append(byId("loginCode"));
  passwordField.append(byId("loginPass"));
  fields.replaceChildren(codeField, passwordField, byId("loginNameBadge"));

  form.append(badge, fields, error, button);
  card.prepend(brand, form);

  renderLoginServiceStatus();
}

async function refreshLoginServiceStatus() {
  try {
    const payload = await getPublicHotelBootstrap(state.loginHotel.slug);
    const bootstrap = payload.data || {};
    state.loginServiceStatus = evaluateServiceStatus({
      serviceHours: bootstrap.service_hours?.["room-service"] || [],
      timezone: bootstrap.timezone || state.loginHotel.timezone,
      operationMode: bootstrap.settings?.["room-service.operation_mode"] || bootstrap.service_status?.room_service || "automatic",
    });
  } catch {
    state.loginServiceStatus = null;
  }
  renderLoginServiceStatus();
}

function renderLoginServiceStatus() {
  const badge = byId("loginStoreBadge", false);
  if (!badge) return;
  const status = state.loginServiceStatus;
  badge.classList.toggle("is-open", Boolean(status?.open));
  badge.classList.toggle("is-closed", status !== undefined && !status?.open);
  badge.classList.toggle("is-pending", status === undefined);
  const dot = document.createElement("span");
  dot.className = "erp-login-status-dot";
  const label = document.createElement("strong");
  label.textContent = status === undefined ? "Verificando atendimento" : status?.open ? "Sistema aberto" : "Sistema fechado";
  badge.replaceChildren(dot, label);
}

function installPdvInterface() {
  const container = byId("vendasContainer", false);
  if (!container) return;
  container.className = "hidden flex-row flex-1 overflow-hidden view-section erp-pdv-workspace";
  container.innerHTML = `
    <main class="erp-pdv-catalog scrollable">
      <header class="pdv-menu-head">
        <div class="erp-pdv-heading">
          <span class="erp-pdv-kicker">Atendimento presencial</span>
          <h2>Pedido direto</h2>
          <p>Escolha os itens e conclua a comanda ao lado.</p>
        </div>
      </header>
      <div class="erp-pdv-catalog-meta"><span id="pdvMenuSummary">Cardápio</span></div>
      <div id="menuContent" class="erp-pdv-content"></div>
    </main>
    <button id="pdvMobileJump" type="button" class="erp-pdv-mobile-jump">${cartIcon()} <span id="pdvMobileJumpLabel">Ver comanda</span></button>
    <aside class="pdv-panel" aria-label="Nova comanda">
      <button id="pdvMobileCatalogReturn" type="button" class="erp-pdv-mobile-return">Voltar ao cardápio</button>
      <section class="erp-pdv-customer">
        <div class="erp-pdv-section-title"><span>1</span><div><strong>Entrega</strong><small>Informe quem receberá o pedido</small></div></div>
        <div class="erp-pdv-field-grid">
          <label class="erp-pdv-field erp-pdv-room"><span>Acomodação</span><div id="roomCombobox" class="erp-room-combobox"><input id="roomNumber" placeholder="Buscar acomodação" aria-label="Acomodação" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="roomOptions" autocomplete="off"><button id="roomComboboxToggle" type="button" aria-label="Mostrar acomodações" tabindex="-1"><i data-lucide="chevron-down" aria-hidden="true"></i></button><div id="roomOptions" class="erp-room-options hidden" role="listbox" aria-label="Acomodações da unidade"></div></div></label>
          <label class="erp-pdv-field"><span>Hóspede</span><input id="guestName" placeholder="Nome do hóspede" autocomplete="off"></label>
        </div>
        <label class="erp-pdv-field"><span>Local de entrega</span><select id="consumptionLocation"><option value="Acomodação">Entregar na acomodação</option><option value="Recepção">Consumo na recepção</option></select></label>
        <label class="erp-pdv-field"><span>Observações do pedido</span><textarea id="orderObs" placeholder="Preferências ou informações importantes"></textarea></label>
      </section>
      <section class="erp-pdv-cart-section" aria-label="Itens da comanda. Solte aqui um item do cardapio para adiciona-lo.">
        <div class="erp-pdv-section-title"><span>2</span><div><strong>Itens da comanda</strong><small>Revise quantidades e valores</small></div></div>
        <div id="cartItems" class="erp-pdv-cart-list scrollable"></div>
      </section>
      <footer class="erp-pdv-checkout">
        <div class="erp-pdv-total-row"><span>Total do pedido</span><div class="erp-pdv-total-value"><span id="cartItemCount" class="erp-pdv-order-count">0 itens</span><strong id="cartTotal">R$ 0,00</strong></div></div>
        <div class="erp-pdv-checkout-actions">
          <button type="button" class="erp-pdv-clear">${trashIcon()} <span>Limpar</span></button>
          <button type="button" class="erp-pdv-submit">${checkIcon()} <span>Enviar pedido direto</span></button>
        </div>
      </footer>
    </aside>`;
}

function installOrdersInterface() {
  const target = byId("histContainer", false);
  if (!target) return;
  target.innerHTML = `<div class="erp-page erp-orders-page">
    <header class="erp-page-header">
      <div><p class="erp-page-eyebrow">Operacao</p><h2>Pedidos</h2><p>Consulte e acompanhe os pedidos da unidade.</p></div>
      <div class="erp-page-actions">
        <label class="erp-date-field"><span>Data</span><input type="date" id="histDate"></label>
        <button id="ordersRefreshButton" type="button" class="erp-icon-text-button">${dashboardIcon("refresh")}<span>Atualizar</span></button>
      </div>
    </header>
    <section class="erp-list-section">
      <div class="erp-section-header"><div><h3>Pedidos do dia</h3><p id="simpleHistMeta">0 pedidos</p></div><span class="erp-section-hint">Mais recentes primeiro</span></div>
      <div id="simpleHistTableBody" class="erp-order-list"></div>
    </section>
  </div>`;
  byId("histDate").value = localDateKey(new Date());
}

function installGuestsInterface() {
  const target = byId("hospedesContainer", false);
  if (!target) return;
  target.innerHTML = `<div class="erp-page erp-guests-page">
    <header class="erp-page-header">
      <div><p class="erp-page-eyebrow">Relacionamento</p><h2>Hospedes</h2><p>Acomodacoes atendidas e atividade recente.</p></div>
      <div class="erp-page-actions">
        <button id="guestsRefreshButton" type="button" class="erp-icon-text-button">${dashboardIcon("refresh")}<span>Atualizar</span></button>
      </div>
    </header>
    <section class="erp-list-section">
      <div class="erp-section-header"><div><h3>Diretorio da unidade</h3><p id="guestDirectoryMeta">0 acomodacoes</p></div><span class="erp-section-hint">Dados operacionais do Room Service</span></div>
      <div id="guestTableBody" class="erp-guest-grid"></div>
    </section>
  </div>`;
}

function installVisualSystem() {
  document.body.classList.remove("erp-design-system-v4");
  document.body.classList.add("erp-design-system-v5");
  const nav = byId("navBar", false);
  if (nav && !nav.querySelector(".erp-nav-group-label")) {
    const groups = [
      ["btnTabDashboard", "Operacao"],
      ["btnTabHospedes", "Gestao"],
    ];
    for (const [buttonId, label] of groups) {
      const button = byId(buttonId, false);
      if (!button) continue;
      const heading = document.createElement("span");
      heading.className = "erp-nav-group-label";
      heading.textContent = label;
      button.before(heading);
    }
  }
  document.querySelectorAll(".side-nav-btn").forEach((button) => {
    const label = button.querySelector(".side-text")?.textContent?.trim() || button.title || "Navegacao";
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
  });

  if (!byId("erpSidebarBackdrop", false)) {
    const backdrop = document.createElement("button");
    backdrop.id = "erpSidebarBackdrop";
    backdrop.type = "button";
    backdrop.className = "erp-sidebar-backdrop";
    backdrop.setAttribute("aria-label", "Fechar menu de navegacao");
    byId("appShell").append(backdrop);
  }

  if (!byId("erpSidebarClose", false)) {
    const close = document.createElement("button");
    close.id = "erpSidebarClose";
    close.type = "button";
    close.className = "erp-sidebar-close";
    close.setAttribute("aria-label", "Fechar menu de navegacao");
    close.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
    document.querySelector(".side-brand")?.append(close);
  }

  const sessionButton = document.querySelector(".top-session");
  if (sessionButton && !sessionButton.querySelector(".top-session-icon")) {
    const icon = document.createElement("span");
    icon.className = "top-session-icon";
    icon.innerHTML = '<i data-lucide="user-round" aria-hidden="true"></i>';
    sessionButton.prepend(icon);
  }
}

function installDashboardInterface() {
  const target = byId("dashboardContainer");
  target.innerHTML = `<div class="erp-dashboard-workspace">
    <header class="erp-dashboard-header">
      <div><p class="admin-kicker">Visão geral</p><h2>Dashboard</h2><p id="dashSummaryLabel">Operação de hoje</p></div>
      <label class="erp-dashboard-date" aria-label="Data dos indicadores">${dashboardIcon("calendar")}<input type="date" id="dashDate"></label>
    </header>
    <section class="erp-dashboard-kpis" aria-label="Indicadores principais">
      ${dashboardKpi("orders", "Pedidos", "kpiVendas", "Recebidos no dia")}
      ${dashboardKpi("revenue", "Receita", "kpiReceita", "Pedidos entregues", "kpiReceitaCard")}
      ${dashboardKpi("ticket", "Ticket médio", "kpiTicket", "Média por pedido")}
      ${dashboardKpi("activity", "Em atendimento", "kpiActive", "Enviados ou impressos")}
      ${dashboardKpi("notes", "Com observacao", "kpiObs", "Exigem atencao")}
    </section>
    <section class="erp-dashboard-analytics">
      <article class="erp-dashboard-chart erp-dashboard-hourly">
        <div class="erp-dashboard-section-head"><div><span>Movimento</span><h3>Pedidos por horário</h3></div><strong id="dashPeakHour">-</strong></div>
        <div id="dashboardHourlyChart" class="erp-dashboard-bars" aria-label="Gráfico de pedidos por horário"></div>
      </article>
      <article class="erp-dashboard-chart erp-dashboard-status">
        <div class="erp-dashboard-section-head"><div><span>Fluxo</span><h3>Situação dos pedidos</h3></div></div>
        <div class="erp-dashboard-status-layout"><div id="dashboardDonut" class="erp-dashboard-donut"><span><b id="dashboardDonutTotal">0</b><small>pedidos</small></span></div><div id="dashStatusLegend" class="erp-dashboard-legend"></div></div>
      </article>
    </section>
    <section class="erp-dashboard-lists">
      <article><div class="erp-dashboard-section-head"><div><span>Cardápio</span><h3>Itens mais pedidos</h3></div><small id="dashTopItemMeta">Sem vendas</small></div><div id="dashTopItemsList" class="erp-dashboard-ranking"></div></article>
      <article><div class="erp-dashboard-section-head"><div><span>Atendimento</span><h3>Últimos pedidos</h3></div><small id="dashLastOrdersMeta">0 pedidos</small></div><div id="dashLastOrders" class="erp-dashboard-orders"></div></article>
    </section>
  </div>`;
  const date = byId("dashDate", false);
  if (date) date.value = localDateKey(new Date());
}

function configureShortcutHints() {
  const labels = { dashboard: "D", vendas: "V", hist: "P", faturamento: "F", cardapio: "C", admin: "S" };
  for (const [route, key] of Object.entries(labels)) {
    const button = byId(ROUTES[route]?.button, false);
    if (!button) continue;
    button.setAttribute("aria-keyshortcuts", key);
    const label = button.querySelector(".side-text")?.textContent?.trim() || button.title || route;
    button.title = `${label} (${key})`;
  }
  document.querySelector(".quick-tile.logout")?.setAttribute("aria-keyshortcuts", "L");
}

function handleGlobalKeyboardShortcut(event) {
  if (event.key === "Escape") {
    if (closeTopmostErpLayer()) event.preventDefault();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    byId("topSearchInput")?.focus();
    return;
  }
  if (event.key === "F7") {
    event.preventDefault();
    return;
  }
  if (!state.session || event.ctrlKey || event.metaKey || event.altKey || isEditingTarget(event.target)) return;
  const key = event.key.toLowerCase();
  if (key === "l") {
    event.preventDefault();
    void handleLogout();
    return;
  }
  const route = ERP_KEYBOARD_SHORTCUTS[key];
  if (!route) return;
  const button = byId(ROUTES[route]?.button, false);
  if (!button || button.classList.contains("hidden")) return;
  event.preventDefault();
  switchTab(route);
}

function closeTopmostErpLayer() {
  if (helpCenter.closeIfOpen()) return true;
  const orderStatusDialog = byId("orderStatusDialog", false);
  if (orderStatusDialog && !orderStatusDialog.classList.contains("hidden")) {
    closeOrderStatusDialog();
    return true;
  }
  const visibleModal = [...document.querySelectorAll(".erp-modal:not(.hidden), .erp-user-modal:not(.hidden), #orderModal:not(.hidden)")].at(-1);
  if (visibleModal) {
    visibleModal.classList.add("hidden");
    return true;
  }
  const openLayer = ["accountPopover", "notifDropdown", "storeQuickPanel", "topSearchResults"]
    .map((id) => byId(id, false))
    .find((element) => element && !element.classList.contains("hidden"));
  if (openLayer) {
    openLayer.classList.add("hidden");
    return true;
  }
  if (state.route === "admin" && state.settingsView !== "home") {
    state.settingsView = "home";
    renderAdmin();
    return true;
  }
  if (document.body.classList.contains("sidebar-open")) {
    document.body.classList.remove("sidebar-open");
    return true;
  }
  return false;
}

function isEditingTarget(target) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function dashboardKpi(icon, label, valueId, description, id = "") {
  return `<article ${id ? `id="${id}"` : ""} class="erp-dashboard-kpi"><span class="erp-dashboard-kpi-icon">${dashboardIcon(icon)}</span><span class="erp-dashboard-kpi-copy"><small>${label}</small><strong id="${valueId}">0</strong><em>${description}</em></span></article>`;
}

function installBillingInterface() {
  const target = byId("faturamentoContainer");
  target.innerHTML = `<div class="erp-v3-shell erp-billing-shell"><header class="erp-v3-header"><div><p class="admin-kicker">Resultados</p><h2 class="erp-v3-title">Faturamento</h2><p id="histRangeLabel" class="erp-v3-subtitle">Periodo selecionado</p></div><div class="erp-billing-filters"><label>De<input type="date" id="histFrom"></label><label>Ate<input type="date" id="histTo"></label><button id="billingRefreshButton" type="button" class="admin-secondary-btn">Atualizar</button><button id="billingExportButton" type="button" class="admin-primary-btn">Exportar CSV</button></div></header><section class="erp-v3-grid"><article class="erp-stat"><small class="erp-stat-label">Total faturado</small><strong id="histKpiRevenue" class="erp-stat-value">R$ 0,00</strong><small class="erp-stat-meta">Pedidos entregues</small></article><article class="erp-stat"><small class="erp-stat-label">Pedidos entregues</small><strong id="histKpiOrders" class="erp-stat-value">0</strong><small class="erp-stat-meta">No periodo selecionado</small></article><article class="erp-stat"><small class="erp-stat-label">Ticket medio</small><strong id="histKpiTicket" class="erp-stat-value">R$ 0,00</strong><small class="erp-stat-meta">Media por pedido</small></article><article class="erp-stat"><small class="erp-stat-label">Com observacao</small><strong id="histKpiObs" class="erp-stat-value">0</strong><small class="erp-stat-meta">Pedidos que exigem atencao</small></article></section><section class="erp-billing-overview"><article class="erp-panel"><div class="erp-panel-head"><strong class="erp-panel-title">Faturamento por dia</strong><span id="billingDailyMeta" class="erp-panel-meta">0 dias</span></div><div id="billingDailyChart" class="erp-billing-chart"></div></article><article class="erp-panel"><div class="erp-panel-head"><strong class="erp-panel-title">Situacao dos pedidos</strong><span class="erp-panel-meta">Distribuicao</span></div><div id="histTopItems" class="dash-bars"></div></article><article class="erp-panel"><div class="erp-panel-head"><strong class="erp-panel-title">Locais de entrega</strong><span class="erp-panel-meta">Atendimento</span></div><div id="histLegendLocal" class="dash-bars"></div></article></section><section class="erp-panel erp-billing-table-panel"><div class="erp-panel-head"><div><strong class="erp-panel-title">Pedidos do periodo</strong><p id="histTableMeta" class="erp-v3-subtitle">0 pedidos</p></div></div><div class="erp-billing-table-wrap"><table><thead><tr><th>Data e hora</th><th>Pedido</th><th>Acomodacao</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody id="histTableBody"></tbody></table></div></section></div>`;
  const to = byId("histTo");
  const from = byId("histFrom");
  const today = localDateKey(new Date());
  const start = new Date();
  start.setDate(start.getDate() - 29);
  to.value = today;
  from.value = localDateKey(start);
}

function installCatalogInterface() {
  byId("cardapioContainer").innerHTML = `<div class="erp-v3-shell erp-catalog-page"><header class="erp-v3-header"><div><p class="admin-kicker">Room Service</p><h2 class="erp-v3-title">Editor de cardapio</h2><p id="menuAdminSummary" class="erp-v3-subtitle">0 itens</p></div><div class="erp-v3-actions"><button id="newCatalogCategoryButton" type="button" class="admin-secondary-btn">Nova categoria</button><button id="newCatalogItemButton" type="button" class="admin-primary-btn">Novo item</button></div></header><div class="erp-catalog-toolbar"><div class="erp-category-scroller"><button type="button" class="erp-category-scroll" data-category-scroll="-1" aria-label="Categorias anteriores">${settingsIcon("back")}</button><div id="catalogCategoryTabs" class="erp-category-tabs"></div><button type="button" class="erp-category-scroll next" data-category-scroll="1" aria-label="Proximas categorias">${settingsIcon("chevron")}</button></div></div><div id="menuCategoryBoard" class="erp-catalog-grid"></div></div>`;
}

function installSettingsInterface() {
  byId("adminContainer").innerHTML = `<div class="erp-page-container erp-settings-page"><header class="erp-v3-header"><div><p class="admin-kicker">Preferencias da unidade</p><h2 class="erp-v3-title">Configuracoes</h2><p class="erp-v3-subtitle">Funcionamento, equipe e conta em um unico lugar</p></div></header><div id="settingsContent" class="erp-settings-content"></div></div>`;
}

function installOperationalModals() {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `<div id="catalogItemModal" class="erp-modal hidden"><div class="erp-modal-card" role="dialog" aria-modal="true"><header class="erp-modal-head"><div><p class="admin-kicker">Cardapio</p><h2 id="catalogItemModalTitle">Novo item</h2></div><button type="button" class="erp-modal-close" data-close-erp-modal aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button></header><form id="catalogItemForm" class="erp-form"><input id="catalogItemId" type="hidden"><div class="erp-form-grid"><label>Nome<input id="catalogItemName" required maxlength="160"></label><label>Categoria<select id="catalogItemCategory" required></select></label><label>Preco (R$)<input id="catalogItemPrice" required inputmode="decimal" placeholder="0,00"></label><label>Tag do item<input id="catalogItemTag" maxlength="60" placeholder="Ex: Recomendado"></label><label>Ordem<input id="catalogItemSort" type="number" min="0" max="100000" value="100"></label><label>Status<select id="catalogItemStatus"><option value="active">Ativo</option><option value="inactive">Inativo</option><option value="archived">Arquivado</option></select></label><label>Disponibilidade<select id="catalogItemAvailable"><option value="true">Disponivel</option><option value="false">Indisponivel</option></select></label></div><label>Descricao<textarea id="catalogItemDescription" rows="3" maxlength="1000"></textarea></label><label>Mensagem de indisponibilidade<input id="catalogItemAvailabilityLabel" maxlength="120" placeholder="Ex: Indisponivel hoje"></label><input id="catalogItemMediaId" type="hidden"><div><p class="erp-panel-title">Imagem do prato</p><p class="erp-v3-subtitle">Escolha uma imagem da biblioteca ou envie uma nova.</p></div><div id="catalogImagePicker" class="erp-image-picker"></div><div class="erp-upload-row"><input id="catalogMediaFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><button id="catalogUploadButton" type="button" class="admin-secondary-btn">Enviar imagem</button></div><p id="catalogItemFormError" class="legacy-login-error" role="alert"></p><div class="erp-v3-actions erp-modal-actions"><button id="deleteCatalogItemButton" type="button" class="admin-secondary-btn erp-danger-button" hidden>Excluir item</button><span class="erp-modal-actions-spacer"></span><button type="button" class="admin-secondary-btn" data-close-erp-modal>Cancelar</button><button type="submit" class="admin-primary-btn">Salvar item</button></div></form></div></div><div id="catalogCategoryModal" class="erp-modal hidden"><div class="erp-modal-card" role="dialog" aria-modal="true"><header class="erp-modal-head"><div><p class="admin-kicker">Cardapio</p><h2>Nova categoria</h2></div><button type="button" class="erp-modal-close" data-close-erp-modal aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button></header><form id="catalogCategoryForm" class="erp-form"><label>Nome<input id="catalogCategoryName" required maxlength="120"></label><label>Descricao<textarea id="catalogCategoryDescription" rows="3" maxlength="500"></textarea></label><label>Ordem<input id="catalogCategorySort" type="number" min="0" max="100000" value="100"></label><p id="catalogCategoryFormError" class="legacy-login-error" role="alert"></p><div class="erp-v3-actions"><button type="button" class="admin-secondary-btn" data-close-erp-modal>Cancelar</button><button type="submit" class="admin-primary-btn">Criar categoria</button></div></form></div></div><div id="roomModal" class="erp-modal hidden"><div class="erp-modal-card" role="dialog" aria-modal="true"><header class="erp-modal-head"><div><p class="admin-kicker">Acomodacoes</p><h2 id="roomModalTitle">Nova acomodacao</h2></div><button type="button" class="erp-modal-close" data-close-erp-modal aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button></header><form id="roomForm" class="erp-form"><input id="roomId" type="hidden"><div class="erp-form-grid"><label>Codigo<input id="roomCode" required maxlength="24" placeholder="Ex: 101"></label><label>Nome de exibicao<input id="roomLabel" maxlength="120" placeholder="Ex: Suite Jardim"></label><label>Tipo<input id="roomType" maxlength="80" placeholder="Ex: Suite"></label><label>Ordem<input id="roomSort" type="number" min="0" max="100000" value="100"></label><label>Status<select id="roomStatus"><option value="active">Ativa</option><option value="inactive">Inativa</option><option value="archived">Arquivada</option></select></label></div><p id="roomFormError" class="legacy-login-error" role="alert"></p><div class="erp-v3-actions"><button type="button" class="admin-secondary-btn" data-close-erp-modal>Cancelar</button><button type="submit" class="admin-primary-btn">Salvar acomodacao</button></div></form></div></div>`;
  document.body.append(...wrapper.children);
  byId("catalogImagePicker").addEventListener("click", (event) => {
    const button = event.target.closest("[data-media-id]");
    if (!button) return;
    byId("catalogItemMediaId").value = button.dataset.mediaId;
    renderCatalogImagePicker();
  });
  byId("catalogUploadButton").addEventListener("click", uploadCatalogImage);
}

function installOrderDetailsInterface() {
  const card = byId("orderDetailCard", false);
  if (!card) return;
  card.className = "order-detail-card order-detail-dialog";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "orderDetailTitle");
  card.innerHTML = `
    <header class="order-detail-header">
      <div class="order-detail-heading">
        <div class="min-w-0">
          <h2 id="orderDetailTitle">Pedido</h2>
          <p id="detDate" class="order-detail-date"></p>
        </div>
      </div>
      <div class="order-detail-header-actions">
        <span id="detStatus" class="order-detail-status" data-status="sent">Enviado</span>
        <button type="button" class="order-detail-close" title="Fechar" aria-label="Fechar detalhes">${closeIcon()}</button>
      </div>
    </header>
    <input type="hidden" id="detLinha">
    <div class="order-detail-layout">
      <section class="order-detail-primary" aria-label="Itens e observacoes do pedido">
        <dl class="order-detail-facts">
          <div><dt>Acomodação</dt><dd id="detRoom">-</dd></div>
          <div><dt>Hóspede</dt><dd id="detGuest">Não informado</dd></div>
          <div><dt>Local de entrega</dt><dd id="detLocal">Acomodação</dd></div>
          <div><dt>Preparo</dt><dd id="detPreparation">Imediato</dd></div>
        </dl>
        <article class="order-detail-section order-detail-items-section">
          <header><h3>Itens do pedido</h3><strong id="detItemCount">0 itens</strong></header>
          <div id="detItems" class="order-detail-items"></div>
        </article>
        <article id="detObsBox" class="order-detail-note hidden">
          <span>Observação do pedido</span>
          <p id="detObs"></p>
        </article>
      </section>
      <aside class="order-detail-secondary">
        <article class="order-detail-section order-detail-total-card">
          <header><h3>Atendimento</h3></header>
          <dl>
            <div><dt>Origem</dt><dd id="detStaff">Portal</dd></div>
            <div><dt>Contato</dt><dd id="detContact">Não informado</dd></div>
            <div class="order-detail-total"><dt>Total do pedido</dt><dd id="detTotal">R$ 0,00</dd></div>
          </dl>
        </article>
        <article class="order-detail-section order-detail-printing" data-printing-state="disabled">
          <header><h3>Impressão automática</h3><span id="detPrintAgentStatus" class="order-detail-agent-status">Verificando</span></header>
          <div class="order-detail-print-summary"><strong id="detPrintState">Nenhum comprovante emitido</strong><p id="detPrintMessage"></p></div>
          <dl id="detPrintMeta" class="order-detail-print-meta"></dl>
          <div id="detPrintEvents" class="order-detail-print-events"></div>
        </article>
        <article class="order-detail-section order-detail-history-section">
          <header><h3>Histórico do pedido</h3></header>
          <ol id="detHistory" class="order-detail-history"></ol>
        </article>
      </aside>
    </div>
    <footer class="order-detail-actions"></footer>
    <div id="orderStatusDialog" class="order-status-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="orderStatusDialogTitle">
      <form id="orderStatusDialogForm" class="order-status-dialog-card">
        <span class="order-status-dialog-icon" aria-hidden="true">${clipboardIcon()}</span>
        <h3 id="orderStatusDialogTitle">Confirmar alteracao</h3>
        <p id="orderStatusDialogText"></p>
        <label id="orderStatusNoteField" class="hidden">Motivo do cancelamento<textarea id="orderStatusNote" rows="3" maxlength="500" placeholder="Informe o motivo do cancelamento"></textarea></label>
        <p id="orderStatusDialogError" class="legacy-login-error" role="alert"></p>
        <div><button type="button" class="order-action-secondary" data-order-status-cancel>Voltar</button><button type="submit" class="order-action-primary">Confirmar</button></div>
      </form>
    </div>`;

  byId("orderStatusDialog", false)?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeOrderStatusDialog(false);
  });
  byId("orderStatusDialogForm", false)?.addEventListener("submit", submitOrderStatusDialog);
  card.querySelector("[data-order-status-cancel]")?.addEventListener("click", () => closeOrderStatusDialog(false));
}

function installFeedbackInterface() {
  const storeButton = byId("hdrStoreButton", false);
  if (storeButton && !byId("erpFeedbackButton", false)) {
    const button = document.createElement("button");
    button.id = "erpFeedbackButton";
    button.type = "button";
    button.className = "erp-feedback-trigger";
    button.title = "Relatar um problema";
    button.innerHTML = `${feedbackIcon()}<span>Algum problema?</span>`;
    storeButton.before(button);
  }

  if (byId("erpFeedbackModal", false)) return;
  const modal = document.createElement("div");
  modal.id = "erpFeedbackModal";
  modal.className = "erp-modal hidden";
  modal.innerHTML = `<div class="erp-modal-card erp-feedback-card" role="dialog" aria-modal="true" aria-labelledby="erpFeedbackTitle">
    <header class="erp-modal-head"><div><p class="admin-kicker">Suporte</p><h2 id="erpFeedbackTitle">Conte o que aconteceu</h2><p>O relato será enviado ao Administrador Dev.</p></div><button type="button" class="erp-modal-close" data-close-feedback aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button></header>
    <form id="erpFeedbackForm" class="erp-feedback-form">
      <label>Descrição do problema<textarea id="erpFeedbackDescription" name="description" rows="5" minlength="10" maxlength="3000" required placeholder="Descreva o que você estava fazendo e o resultado esperado."></textarea></label>
      <div id="erpFeedbackPreview" class="erp-feedback-preview is-empty"><div class="erp-feedback-empty-state"><span>${feedbackImageIcon()}</span><p>Nenhuma captura anexada.</p></div><img hidden alt="Captura de tela do ERP"><p class="erp-feedback-attached" hidden>Captura anexada</p></div>
      <p id="erpFeedbackStatus" class="erp-feedback-status" role="status"></p>
      <div class="erp-feedback-actions"><button id="erpFeedbackCapture" type="button" class="admin-secondary-btn">${feedbackImageIcon()} Capturar novamente</button><div class="erp-feedback-submit-actions"><button type="button" class="admin-secondary-btn" data-close-feedback>Cancelar</button><button type="submit" class="admin-primary-btn">Enviar relato</button></div></div>
    </form>
  </div>`;
  document.body.append(modal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeFeedbackDialog();
  });
}

async function openFeedbackDialog() {
  const modal = byId("erpFeedbackModal");
  await captureFeedbackScreenshot();
  modal.classList.remove("hidden");
  byId("erpFeedbackDescription").focus();
}

async function captureFeedbackScreenshot() {
  const status = byId("erpFeedbackStatus");
  const modal = byId("erpFeedbackModal", false);
  const hideModalForNativeCapture = desktop.isElectron && modal && !modal.classList.contains("hidden");
  status.textContent = desktop.isElectron ? "Capturando a janela do ERP..." : "Selecione esta janela para capturar.";
  if (hideModalForNativeCapture) {
    modal.style.visibility = "hidden";
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  }
  try {
    const blob = await captureVisibleScreen();
    setFeedbackScreenshot(blob);
    status.textContent = "Captura pronta.";
  } catch (error) {
    status.textContent = error?.name === "NotAllowedError"
      ? "Captura cancelada. Você ainda pode enviar o relato."
      : "Não foi possível capturar. Você ainda pode enviar o relato.";
  } finally {
    if (hideModalForNativeCapture) modal.style.removeProperty("visibility");
  }
}

async function captureVisibleScreen() {
  if (desktop.isElectron) {
    const capture = await desktop.capturePage();
    if (!capture?.base64 || capture.mimeType !== "image/png") throw new Error("desktop_capture_failed");
    return new Blob([decodeBase64(capture.base64)], { type: capture.mimeType });
  }
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("screen_capture_unavailable");
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "window" }, audio: false });
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });
    await video.play();
    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / Math.max(1, video.videoWidth));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("capture_failed")), "image/png", 0.92));
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

function decodeBase64(value) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function setFeedbackScreenshot(blob) {
  if (state.feedbackPreviewUrl) URL.revokeObjectURL(state.feedbackPreviewUrl);
  state.feedbackScreenshot = blob;
  state.feedbackPreviewUrl = blob ? URL.createObjectURL(blob) : "";
  const preview = byId("erpFeedbackPreview");
  const image = preview.querySelector("img");
  const emptyState = preview.querySelector(".erp-feedback-empty-state");
  const attached = preview.querySelector(".erp-feedback-attached");
  preview.classList.toggle("is-empty", !blob);
  emptyState.hidden = Boolean(blob);
  attached.hidden = !blob;
  image.hidden = !blob;
  if (blob) image.src = state.feedbackPreviewUrl;
  else image.removeAttribute("src");
}

async function sendErpFeedback(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  const status = byId("erpFeedbackStatus");
  submit.disabled = true;
  status.textContent = "Enviando relato...";
  try {
    const data = new FormData();
    data.set("description", byId("erpFeedbackDescription").value.trim());
    data.set("source_route", `${window.location.pathname}#${state.route}`);
    if (state.feedbackScreenshot) data.set("screenshot", state.feedbackScreenshot, "captura-erp.png");
    await submitErpFeedback(data);
    closeFeedbackDialog();
    notify("Relato enviado ao Administrador Dev.");
  } catch (error) {
    status.textContent = error.message || "Não foi possível enviar o relato.";
  } finally {
    submit.disabled = false;
  }
}

function closeFeedbackDialog() {
  byId("erpFeedbackModal", false)?.classList.add("hidden");
  byId("erpFeedbackForm", false)?.reset();
  byId("erpFeedbackStatus", false).textContent = "";
  setFeedbackScreenshot(null);
}

function renderSettingsHome() {
  const permissions = new Set(state.session?.permissions || []);
  const cards = [
    permissions.has("room-service.settings.manage") ? settingsCard("operation", "clock", "Funcionamento", "Abertura, fechamento e horários") : "",
    permissions.has("room-service.settings.manage") ? settingsCard("rooms", "rooms", "Acomodações", "Quartos disponíveis para atendimento") : "",
    permissions.has("room-service.settings.manage") ? settingsCard("printing", "printer", "Impressão", "Computadores, impressoras e comprovantes") : "",
    permissions.has("room-service.users.manage") ? settingsCard("users", "users", "Usuários do ERP", "Acessos e permissões da equipe") : "",
    settingsCard("account", "account", "Minha conta", "Perfil e senha"),
    settingsCard("appearance", "palette", "Aparência", "Marca e escala da interface"),
    settingsCard("notifications", "bell", "Notificações", "Som e volume dos alertas"),
    settingsCard("version", "version", "Versão do aplicativo", "ERP, Fioreze Suite e atualizações"),
  ].filter(Boolean);
  return `<div><p class="erp-panel-title">Configurações do ERP</p><p class="erp-v3-subtitle">${escapeHtml(displayHotelName(state.context?.hotel))}</p></div><div class="erp-settings-grid">${cards.join("")}</div>`;
}

function settingsToggle(name, checked, title, description) {
  return `<label class="erp-setting-toggle-row"><span class="erp-setting-toggle-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><span class="erp-switch-control"><input type="checkbox" name="${escapeAttr(name)}" ${checked ? "checked" : ""}><span class="erp-switch-track" aria-hidden="true"><span></span></span></span></label>`;
}

function renderOperationSettings() {
  if (!state.session?.permissions?.includes("room-service.settings.manage")) return restrictedSettings();
  const operation = state.operations?.operation || state.context?.operation || { mode: "automatic", service_hours: [] };
  const preferences = operation.preferences || { order_scheduling_enabled: false, order_notes_enabled: true };
  const hours = operation.service_hours || [];
  const layout = state.scheduleViewMode || inferScheduleViewMode(hours);
  state.scheduleViewMode = layout;
  const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const rows = dayNames.map((name, day) => {
    const slot = hours.find((entry) => Number(entry.day_of_week) === day && Number(entry.sort_order || 0) === 0) || hours.find((entry) => Number(entry.day_of_week) === day);
    const closed = !slot || Boolean(slot.is_closed);
    return `<div class="erp-schedule-row"><strong>${name}</strong><input type="time" name="opens_${day}" value="${escapeAttr(slot?.opens_at || "16:00")}" ${closed ? "disabled" : ""}><input type="time" name="closes_${day}" value="${escapeAttr(slot?.closes_at || "22:00")}" ${closed ? "disabled" : ""}><label class="erp-switch"><input type="checkbox" name="closed_${day}" ${closed ? "checked" : ""} data-schedule-closed="${day}"> Fechado</label></div>`;
  }).join("");
  const firstOpen = hours.find((entry) => !entry.is_closed) || { opens_at: "16:00", closes_at: "22:00" };
  const scheduleEditor = layout === "same"
    ? `<div class="erp-common-hours"><label>Abre as<input type="time" name="common_opens" value="${escapeAttr(firstOpen.opens_at || "16:00")}" required></label><label>Fecha as<input type="time" name="common_closes" value="${escapeAttr(firstOpen.closes_at || "22:00")}" required></label><span>Todos os dias</span></div>`
    : `<div class="erp-schedule-list">${rows}</div>`;
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><header class="erp-settings-section-head"><div><p class="erp-panel-title">Funcionamento do Room Service</p><p class="erp-v3-subtitle">Defina como a operacao deve funcionar.</p></div></header><div class="erp-mode-segment" aria-label="Modo de funcionamento">${["automatic", "forced_open", "forced_closed"].map((mode) => `<button type="button" class="erp-mode-button ${operation.mode === mode ? "active" : ""}" data-operation-mode="${mode}">${mode === "automatic" ? "Automatico" : mode === "forced_open" ? "Abrir agora" : "Fechar agora"}</button>`).join("")}</div><form id="orderPreferencesForm" class="erp-order-preferences">${settingsToggle("order_scheduling_enabled", preferences.order_scheduling_enabled, "Agendamento para o mesmo dia", "Permite que o hospede escolha um horario de entrega.")}${settingsToggle("order_notes_enabled", preferences.order_notes_enabled, "Observacoes nos pedidos", "Exibe observacoes gerais e por item no portal.")}<div class="erp-settings-form-actions"><button type="submit" class="admin-secondary-btn">Salvar preferencias</button></div></form><form id="operationScheduleForm" class="erp-schedule-form" data-schedule-layout="${layout}"><div class="erp-schedule-toolbar"><div><strong class="erp-panel-title">Horario semanal</strong><p class="erp-v3-subtitle">Escolha um horario unico ou personalize cada dia.</p></div><div class="erp-schedule-toolbar-actions"><div class="erp-schedule-layout"><button type="button" class="${layout === "same" ? "active" : ""}" data-schedule-layout-option="same">Mesmo horario todos os dias</button><button type="button" class="${layout === "custom" ? "active" : ""}" data-schedule-layout-option="custom">Horarios por dia</button></div><button type="submit" class="admin-primary-btn">Salvar horarios</button></div></div>${scheduleEditor}</form></section>`;
}

function renderRoomSettings() {
  if (!state.session?.permissions?.includes("room-service.settings.manage")) return restrictedSettings();
  const rooms = state.rooms || [];
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div class="erp-panel-head"><div><p class="erp-panel-title">Acomodacoes da unidade</p><p class="erp-v3-subtitle">Somente acomodacoes ativas aparecem no portal e aceitam pedidos.</p></div><button id="newRoomButton" type="button" class="admin-primary-btn">Nova acomodacao</button></div><div class="erp-rooms-list">${rooms.length ? rooms.map((room) => `<button type="button" class="erp-room-card" data-edit-room="${escapeAttr(room.id)}"><span><strong>${escapeHtml(room.code)}</strong><small>${escapeHtml(displayBusinessText(room.label || room.room_type, "Sem descricao"))}</small></span><span class="erp-chip ${room.status === "active" ? "" : "off"}">${room.status === "active" ? "Ativa" : "Inativa"}</span></button>`).join("") : '<div class="legacy-list-empty">Nenhuma acomodacao cadastrada.</div>'}</div></section>`;
}

function renderPrintingSettingsBase() {
  if (!state.session?.permissions?.includes("room-service.settings.manage")) return restrictedSettings();
  const printing = state.printing || { global_enabled: false, unit_enabled: false, effective_enabled: false, templates: [], devices: [] };
  const templates = printing.templates || [];
  const devices = printing.devices || [];
  const defaultTemplate = templates.find((entry) => Number(entry.is_default) === 1)?.id || "";
  const activation = state.printerEnrollment;
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><header class="erp-settings-section-head"><div><p class="erp-panel-title">Impressao automatica</p><p class="erp-v3-subtitle">Vincule o computador da unidade e escolha o modelo do comprovante.</p></div><span class="erp-chip ${printing.effective_enabled ? "" : "off"}">${printing.effective_enabled ? "Ativa" : "Desativada"}</span></header>${!printing.global_enabled ? '<div class="legacy-list-empty">A impressao permanece desativada no ambiente atual. A configuracao pode ser preparada sem enviar nada a uma impressora.</div>' : ""}<form id="printingSettingsForm" class="erp-order-preferences">${settingsToggle("enabled", printing.unit_enabled, "Impressao automatica desta unidade", "Cria uma comanda quando um pedido e recebido.")}<label class="erp-setting-select-row"><span><strong>Modelo do comprovante</strong><small>Cada unidade pode usar o formato adequado a sua impressora.</small></span><select name="template_id">${templates.map((template) => `<option value="${escapeAttr(template.id)}" ${template.id === defaultTemplate ? "selected" : ""}>${escapeHtml(template.name)}</option>`).join("")}</select></label><div class="erp-settings-form-actions"><button type="submit" class="admin-primary-btn">Salvar impressao</button></div></form><article class="erp-panel"><div class="erp-panel-head"><div><strong class="erp-panel-title">Instalar computador</strong><p class="erp-v3-subtitle">Use o Fioreze Suite e informe o codigo abaixo. Ele vale por 15 minutos e uma unica instalacao.</p></div><button id="createPrinterEnrollmentButton" type="button" class="admin-primary-btn">Gerar codigo</button></div>${activation ? `<div class="erp-printer-code"><small>Codigo de conexao</small><strong>${escapeHtml(activation.activation_code)}</strong><div class="erp-printer-code-actions"><span>Expira em ${escapeHtml(formatDate(activation.expires_at))}</span><button id="copyPrinterEnrollmentCode" type="button" class="admin-secondary-btn" aria-label="Copiar codigo de conexao">${settingsIcon("copy")} Copiar codigo</button></div></div>` : ""}</article>${renderLocalPrintAgent()}<div class="erp-panel-head"><div><strong class="erp-panel-title">Computadores vinculados</strong><p class="erp-v3-subtitle">Acompanhe conexao, impressora e modelo de cada computador.</p></div><button id="refreshPrintingButton" type="button" class="admin-secondary-btn">Atualizar</button></div><div class="erp-rooms-list">${devices.length ? devices.map((device) => `<article class="erp-room-card"><span><strong>${escapeHtml(device.name)}</strong><small>${escapeHtml(device.printer_name || "Impressora ainda nao informada")} · ${escapeHtml(device.template_name || "Modelo padrao")} · versao ${escapeHtml(device.app_version || "nao informada")}</small><small>${device.last_seen_at ? `Ultimo contato em ${escapeHtml(formatDate(device.last_seen_at))}` : "Aguardando primeiro contato"}</small></span><span class="erp-v3-actions"><span class="erp-chip ${device.connection_status === "online" ? "" : "off"}">${device.connection_status === "online" ? "Online" : device.connection_status === "offline" ? "Offline" : device.connection_status === "paused" ? "Pausado" : "Revogado"}</span>${device.status !== "revoked" ? `<button type="button" class="admin-secondary-btn" data-printer-device="${escapeAttr(device.id)}" data-printer-status="${device.status === "active" ? "paused" : "active"}">${device.status === "active" ? "Pausar" : "Retomar"}</button><button type="button" class="admin-secondary-btn" data-printer-device="${escapeAttr(device.id)}" data-printer-status="revoked">Revogar</button>` : ""}</span></article>`).join("") : '<div class="legacy-list-empty">Nenhum computador conectado.</div>'}</div></section>`;
}

function renderPrintingSettings() {
  const printing = state.printing || { devices: [] };
  const template = document.createElement("template");
  template.innerHTML = renderPrintingSettingsBase();
  const canCreateEnrollment = printing.can_create_enrollment !== false;
  const enrollmentButton = template.content.querySelector("#createPrinterEnrollmentButton");
  if (enrollmentButton) {
    enrollmentButton.disabled = !canCreateEnrollment;
    if (!canCreateEnrollment) {
      const helper = enrollmentButton.closest(".erp-panel-head")?.querySelector(".erp-v3-subtitle");
      if (helper) helper.textContent = "Revogue o computador vinculado antes de instalar outro servidor de impressao.";
    }
  }
  const cards = template.content.querySelectorAll(".erp-room-card");
  (printing.devices || []).forEach((device, index) => {
    if (device.status !== "revoked") return;
    const actions = cards[index]?.querySelector(".erp-v3-actions");
    if (!actions) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-secondary-btn erp-danger-button";
    button.dataset.deletePrinterDevice = device.id;
    button.textContent = "Excluir";
    actions.append(button);
  });
  return template.innerHTML;
}

function renderLocalPrintAgent() {
  if (!desktop.isElectron) return "";
  const agent = state.localPrintAgent;
  const online = Boolean(agent?.running);
  const status = !agent ? "Verificando" : online ? "Online" : agent.status === "not_installed" ? "Nao instalado" : "Offline";
  const detail = !agent ? "Consultando o agente instalado neste computador." : agent.message || "Sem informacoes locais.";
  return `<article class="erp-panel erp-local-agent"><div><small>Este computador</small><strong>Fioreze Print Agent</strong><span>${escapeHtml(detail)}</span>${agent?.printer_name ? `<span>Impressora: ${escapeHtml(agent.printer_name)}</span>` : ""}</div><div class="erp-v3-actions"><span class="erp-chip ${online ? "" : "off"}">${status}</span><button id="refreshLocalPrintAgentButton" type="button" class="admin-secondary-btn">Atualizar</button><button id="restartLocalPrintAgentButton" type="button" class="admin-primary-btn" ${agent?.status === "not_installed" ? "disabled" : ""}>Reiniciar servidor</button></div></article>`;
}

function renderUserSettings() {
  const canManage = state.session?.permissions?.includes("room-service.users.manage");
  if (!canManage) return restrictedSettings();
  const cards = [];
  if (state.session.erp_master) cards.push(`<article class="admin-user-card erp-master-card"><div class="erp-user-card-head"><span class="admin-user-avatar">M</span><div><strong>${escapeHtml(displayUserName(state.session.user))}</strong><small>Administrador geral</small></div></div><div class="erp-user-permissions"><span>Acesso total</span><span>Todas as unidades</span></div><span class="legacy-status-chip">Mestre</span></article>`);
  cards.push(...state.users.map((user) => erpUserCard(user)));
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div class="erp-panel-head"><div><p class="erp-panel-title">Usuarios operacionais</p><p class="erp-v3-subtitle">Cada usuario acessa somente esta unidade e os modulos autorizados.</p></div><div class="erp-v3-actions"><button id="refreshErpUsersButton" type="button" class="admin-secondary-btn">Atualizar</button><button id="newErpUserButton" type="button" class="admin-primary-btn">Novo usuario</button></div></div><div id="userList" class="admin-user-list">${cards.length ? cards.join("") : '<div class="legacy-list-empty">Nenhum usuario cadastrado.</div>'}</div></section>`;
}

function renderAccountSettings() {
  const user = state.session?.user || {};
  const displayName = displayUserName(user);
  const initials = String(displayName || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const avatar = safeImage(user.avatar);
  const operational = state.session?.auth_source === "erp";
  return `<nav class="erp-settings-breadcrumb" aria-label="Navegação das configurações"><button type="button" data-settings-view="home">Configurações</button>${settingsIcon("chevron")}<strong>Minha conta</strong></nav><section class="erp-settings-detail erp-account-settings"><article class="erp-account-card"><div class="erp-profile-avatar">${avatar ? `<img src="${escapeAttr(avatar)}" alt="Foto de perfil" class="erp-profile-avatar">` : escapeHtml(initials)}</div><div class="erp-account-summary"><p class="erp-panel-title">${escapeHtml(displayName)}</p><p class="erp-v3-subtitle">${operational ? `Código ${Number(user.user_code || 0)} · ${escapeHtml(displayHotelName(state.context?.hotel))}` : "Administrador geral"}</p>${operational ? '<form id="accountAvatarForm" class="erp-avatar-form"><input id="accountAvatarFile" class="erp-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required><div class="erp-avatar-actions"><label for="accountAvatarFile" class="admin-secondary-btn erp-file-picker">Escolher foto</label><button id="accountAvatarSave" type="submit" class="admin-primary-btn" disabled>Salvar foto</button></div><span id="accountAvatarFileName" class="erp-file-name" hidden></span><button id="removeOwnAvatarButton" type="button" class="erp-remove-avatar">Remover foto atual</button></form>' : ""}</div></article>${operational ? '<form id="accountPasswordForm" class="erp-form erp-password-form"><div><p class="erp-panel-title">Alterar senha</p><p class="erp-v3-subtitle">Use no mínimo 4 caracteres.</p></div><label>Senha atual<input name="current_password" type="password" required autocomplete="current-password"></label><label>Nova senha<input name="new_password" type="password" required minlength="4" autocomplete="new-password"></label><label>Confirmar nova senha<input name="confirm_password" type="password" required minlength="4" autocomplete="new-password"></label><div class="erp-form-actions"><button type="submit" class="admin-primary-btn">Atualizar senha</button></div></form>' : ""}</section>`;
}

function renderAppearanceSettings() {
  const branding = state.context?.branding || {};
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div><p class="erp-panel-title">Aparencia da unidade</p><p class="erp-v3-subtitle">Identidade visual aplicada ao ERP.</p></div><div class="erp-settings-grid"><article class="erp-panel"><span class="erp-stat-label">Cor primaria</span><div style="width:52px;height:52px;border-radius:8px;background:var(--brand-primary);margin-top:12px"></div></article><article class="erp-panel"><span class="erp-stat-label">Tipografia operacional</span><strong class="erp-stat-value erp-ui-font-name">Inter Variable</strong></article><article class="erp-panel erp-appearance-scale"><span class="erp-stat-label">Escala da interface</span><strong>${state.interfaceScale}%</strong><input id="settingsScaleRange" type="range" min="85" max="115" step="5" value="${state.interfaceScale}"></article></div></section>`;
}

function renderNotificationSettings() {
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div><p class="erp-panel-title">Notificacoes</p><p class="erp-v3-subtitle">Alertas de novos pedidos.</p></div><article class="erp-panel erp-notification-settings"><div><strong>Som de novo pedido</strong><small>${state.notificationSoundEnabled ? "Ativado" : "Silenciado"}</small></div><button type="button" class="admin-secondary-btn" data-toggle-notification-sound>${state.notificationSoundEnabled ? "Silenciar" : "Ativar"}</button><label>Volume <b>${state.notificationVolume}%</b><input id="settingsNotificationVolume" type="range" min="0" max="100" step="5" value="${state.notificationVolume}"></label><button type="button" class="admin-secondary-btn" data-test-notification-sound>Testar som</button></article></section>`;
}

function renderApplicationVersionSettings() {
  const versions = state.applicationVersions || createInitialApplicationVersions();
  const checkedAt = versions.checkedAt
    ? `Última verificação em ${formatDate(versions.checkedAt)}`
    : "As versões instaladas são consultadas neste computador.";
  return `<nav class="erp-settings-breadcrumb" aria-label="Navegação das configurações"><button type="button" data-settings-view="home">Configurações</button>${settingsIcon("chevron")}<strong>Versão do aplicativo</strong></nav><section class="erp-settings-detail erp-version-settings"><header class="erp-settings-section-head"><div><p class="erp-panel-title">Versão do aplicativo</p><p class="erp-v3-subtitle">Acompanhe o ERP e o Fioreze Suite instalados neste computador.</p></div><button id="checkApplicationUpdatesButton" type="button" class="admin-primary-btn erp-version-check" ${versions.checking ? 'disabled aria-busy="true"' : ""}>${settingsIcon("refresh")} ${versions.checking ? "Verificando..." : "Verificar atualizações"}</button></header><div class="erp-version-list" aria-live="polite">${applicationVersionCard({ icon: "desktop", title: "Fioreze ERP", product: versions.erp })}${applicationVersionCard({ icon: "suite", title: "Fioreze Suite", product: versions.suite })}</div>${versions.error ? `<p class="erp-version-error" role="status">${escapeHtml(versions.error)}</p>` : ""}<p class="erp-version-last-check">${escapeHtml(checkedAt)}</p></section>`;
}

function applicationVersionCard({ icon, title, product }) {
  const current = product.current || "Não instalado";
  const available = product.available && product.available !== product.current
    ? `<p class="erp-version-available">Versão disponível <strong>${escapeHtml(product.available)}</strong></p>`
    : "";
  return `<article class="erp-version-card" data-version-status="${escapeAttr(product.status)}"><span class="erp-version-product-icon">${settingsIcon(icon)}</span><div class="erp-version-copy"><div class="erp-version-title"><strong>${escapeHtml(title)}</strong><span class="erp-version-badge">${escapeHtml(applicationVersionStatusLabel(product.status))}</span></div><p class="erp-version-current">${escapeHtml(current)}</p><small>${escapeHtml(product.message)}</small>${available}</div></article>`;
}

function createInitialApplicationVersions() {
  return {
    checking: false,
    checkedAt: "",
    error: "",
    erp: {
      current: ERP_APP_VERSION,
      available: "",
      status: desktop.isElectron ? "pending" : "web",
      message: desktop.isElectron ? "Consultando a instalação local." : "A versão web é atualizada automaticamente.",
    },
    suite: {
      current: "",
      available: "",
      status: desktop.isElectron ? "pending" : "not-installed",
      message: desktop.isElectron ? "Consultando o agente de impressão." : "Disponível apenas no aplicativo para Windows.",
    },
  };
}

async function refreshApplicationVersions({ check = false } = {}) {
  if (state.applicationVersions?.checking) return;
  state.applicationVersions = { ...(state.applicationVersions || createInitialApplicationVersions()), checking: true, error: "" };
  if (state.settingsView === "version") renderAdmin();

  const erpRequest = desktop.isElectron
    ? check ? desktop.checkForUpdates() : desktop.updateState()
    : Promise.resolve({ status: "web", currentVersion: ERP_APP_VERSION });
  const suiteRequest = desktop.isElectron ? desktop.printAgentStatus() : Promise.resolve(null);
  const [erpResult, suiteResult, manifestResult] = await Promise.allSettled([
    erpRequest,
    suiteRequest,
    fetchSuiteReleaseManifest(),
  ]);

  const erpState = erpResult.status === "fulfilled" ? erpResult.value || {} : {};
  const localSuite = suiteResult.status === "fulfilled" ? suiteResult.value || null : null;
  const suiteManifest = manifestResult.status === "fulfilled" ? manifestResult.value : null;
  const erpCurrent = normalizeApplicationVersion(erpState.currentVersion) || ERP_APP_VERSION;
  const erpAvailable = normalizeApplicationVersion(erpState.availableVersion);
  const suiteCurrent = normalizeApplicationVersion(localSuite?.app_version);
  const suiteAvailable = normalizeApplicationVersion(suiteManifest?.version);
  const erpStatus = resolveErpVersionStatus(erpState.status, erpAvailable);
  const suiteStatus = resolveSuiteVersionStatus({ localSuite, suiteCurrent, suiteAvailable });
  const errors = [];
  if (erpResult.status === "rejected") errors.push("Não foi possível consultar a atualização do ERP.");
  if (desktop.isElectron && suiteResult.status === "rejected") errors.push("Não foi possível consultar o Fioreze Suite instalado.");
  if (manifestResult.status === "rejected") errors.push("Não foi possível consultar a versão mais recente do Fioreze Suite.");

  state.applicationVersions = {
    checking: false,
    checkedAt: check ? new Date().toISOString() : state.applicationVersions.checkedAt,
    error: errors.join(" "),
    erp: {
      current: erpCurrent,
      available: erpAvailable,
      status: erpStatus,
      message: applicationVersionMessage("erp", erpStatus, erpState.message),
    },
    suite: {
      current: suiteCurrent,
      available: suiteAvailable,
      status: suiteStatus,
      message: applicationVersionMessage("suite", suiteStatus, localSuite?.message),
    },
  };
  if (state.settingsView === "version") renderAdmin();
  if (check) notify(errors.length ? "Verificação concluída com informações indisponíveis." : "Versões verificadas.");
}

async function fetchSuiteReleaseManifest() {
  const response = await fetch("/downloads/print-agent/latest.json", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("suite_manifest_unavailable");
  const payload = await response.json();
  const version = normalizeApplicationVersion(payload?.version);
  if (!version) throw new Error("suite_manifest_invalid");
  return { version };
}

function normalizeApplicationVersion(value) {
  const version = String(value || "").trim();
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version) ? version : "";
}

function compareApplicationVersions(left, right) {
  const first = normalizeApplicationVersion(left).split("-")[0].split(".").map(Number);
  const second = normalizeApplicationVersion(right).split("-")[0].split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if ((first[index] || 0) !== (second[index] || 0)) return (first[index] || 0) - (second[index] || 0);
  }
  return 0;
}

function resolveErpVersionStatus(status, availableVersion) {
  if (!desktop.isElectron) return "web";
  if (["available", "deferred", "downloading", "ready"].includes(status) || availableVersion) return "available";
  if (status === "checking") return "checking";
  if (status === "development") return "development";
  if (status === "error") return "unavailable";
  return "current";
}

function resolveSuiteVersionStatus({ localSuite, suiteCurrent, suiteAvailable }) {
  if (!desktop.isElectron || localSuite?.status === "not_installed" || !localSuite?.installed) return "not-installed";
  if (suiteCurrent && suiteAvailable && compareApplicationVersions(suiteAvailable, suiteCurrent) > 0) return "available";
  if (suiteCurrent && suiteAvailable) return "current";
  return suiteCurrent ? "unavailable" : "pending";
}

function applicationVersionStatusLabel(status) {
  return ({
    available: "Atualização disponível",
    checking: "Verificando",
    current: "Atualizado",
    development: "Modo local",
    "not-installed": "Não instalado",
    pending: "Consultando",
    unavailable: "Indisponível",
    web: "Atualização contínua",
  })[status] || "Indisponível";
}

function applicationVersionMessage(product, status, runtimeMessage = "") {
  if (status === "available") return product === "erp" ? "Uma nova versão pode ser baixada e instalada." : "Abra o Fioreze Suite para baixar e instalar a atualização.";
  if (status === "current") return "Esta é a versão mais recente.";
  if (status === "web") return "A versão web é atualizada automaticamente.";
  if (status === "not-installed") return desktop.isElectron ? "O Fioreze Suite não está instalado neste computador." : "Disponível apenas no aplicativo para Windows.";
  if (status === "development") return runtimeMessage || "A verificação OTA fica desativada no modo local.";
  if (status === "checking" || status === "pending") return "Consultando a versão instalada.";
  return runtimeMessage || "Não foi possível confirmar a versão mais recente.";
}

function settingsCard(view, icon, title, description) {
  return `<button type="button" class="erp-settings-link" data-settings-view="${view}"><span class="erp-settings-icon">${settingsIcon(icon)}</span><span><strong>${title}</strong><small>${description}</small></span><span class="erp-settings-chevron">${settingsIcon("chevron")}</span></button>`;
}

function restrictedSettings() {
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><div class="legacy-list-empty">Seu usuario nao possui permissao para este ajuste.</div>`;
}

function openSettingsView(view) {
  state.settingsView = view;
  byId("accountPopover")?.classList.add("hidden");
  switchTab("admin", { allowHidden: true });
  renderAdmin();
  byId("adminContainer")?.scrollTo({ top: 0, left: 0 });
  if (view === "printing" && desktop.isElectron) void refreshLocalPrintAgentStatus();
  if (view === "version") void refreshApplicationVersions();
}

async function handleCatalogClick(event) {
  const scrollButton = event.target.closest("[data-category-scroll]");
  if (scrollButton) {
    const tabs = byId("catalogCategoryTabs");
    tabs.scrollBy({ left: Number(scrollButton.dataset.categoryScroll) * Math.max(280, tabs.clientWidth * 0.72), behavior: "smooth" });
    return;
  }
  const category = event.target.closest("[data-catalog-category]");
  if (category) {
    state.catalogCategory = category.dataset.catalogCategory;
    renderCatalog();
    return;
  }
  if (event.target.closest("#newCatalogItemButton")) return openCatalogItemModal();
  if (event.target.closest("#newCatalogCategoryButton")) return openCategoryModal();
  const itemButton = event.target.closest("[data-edit-catalog-item]");
  if (itemButton) openCatalogItemModal(allCatalogItems().find((item) => item.id === itemButton.dataset.editCatalogItem));
}

async function handleSettingsClick(event) {
  const view = event.target.closest("[data-settings-view]");
  if (view) return openSettingsView(view.dataset.settingsView);
  const mode = event.target.closest("[data-operation-mode]");
  if (mode) return changeOperationMode(mode.dataset.operationMode);
  const scheduleLayout = event.target.closest("[data-schedule-layout-option]");
  if (scheduleLayout) {
    state.scheduleViewMode = scheduleLayout.dataset.scheduleLayoutOption;
    renderAdmin();
    return;
  }
  const closedToggle = event.target.closest("[data-schedule-closed]");
  if (closedToggle) {
    const day = closedToggle.dataset.scheduleClosed;
    const form = byId("operationScheduleForm");
    form.elements[`opens_${day}`].disabled = closedToggle.checked;
    form.elements[`closes_${day}`].disabled = closedToggle.checked;
    return;
  }
  if (event.target.closest("#newRoomButton")) return openRoomModal();
  if (event.target.closest("#createPrinterEnrollmentButton")) return generatePrinterEnrollment();
  if (event.target.closest("#copyPrinterEnrollmentCode")) return copyPrinterEnrollmentCode();
  if (event.target.closest("#refreshPrintingButton")) return refreshPrinting();
  if (event.target.closest("#refreshLocalPrintAgentButton")) return refreshLocalPrintAgentStatus();
  if (event.target.closest("#restartLocalPrintAgentButton")) return restartLocalPrintAgent();
  if (event.target.closest("#checkApplicationUpdatesButton")) return refreshApplicationVersions({ check: true });
  const deleteDevice = event.target.closest("[data-delete-printer-device]");
  if (deleteDevice) return removePrinterDevice(deleteDevice.dataset.deletePrinterDevice);
  const printerDevice = event.target.closest("[data-printer-device]");
  if (printerDevice) return changePrinterDeviceStatus(printerDevice.dataset.printerDevice, printerDevice.dataset.printerStatus);
  const room = event.target.closest("[data-edit-room]");
  if (room) return openRoomModal(state.rooms.find((entry) => entry.id === room.dataset.editRoom));
  if (event.target.closest("#newErpUserButton")) return openUserModal();
  if (event.target.closest("#refreshErpUsersButton")) return refreshUsers();
  const user = event.target.closest("[data-edit-erp-user]");
  if (user) return openUserModal(state.users.find((entry) => entry.id === user.dataset.editErpUser));
  if (event.target.closest("#removeOwnAvatarButton")) return removeOwnAvatar();
  if (event.target.closest("[data-toggle-notification-sound]")) {
    toggleNotificationSound();
    renderAdmin();
    return;
  }
  if (event.target.closest("[data-test-notification-sound]")) return playNotificationSound(true);
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  if (event.target.id === "operationScheduleForm") return saveOperationSchedule(event.target);
  if (event.target.id === "orderPreferencesForm") return saveOrderPreferences(event.target);
  if (event.target.id === "printingSettingsForm") return savePrintingSettings(event.target);
  if (event.target.id === "accountAvatarForm") return saveOwnAvatar(event.target);
  if (event.target.id === "accountPasswordForm") return saveOwnPassword(event.target);
}

async function handleLogin() {
  const loginCode = byId("loginCode");
  const credential = loginCode.dataset.loginCredential || loginCode.value.trim();
  const hotelId = state.loginHotel?.hotel_id || "";
  const password = byId("loginPass").value;
  byId("legacyLoginError").textContent = "";
  if (!credential || !password || (!credential.includes("@") && !hotelId)) {
    byId("legacyLoginError").textContent = "Informe o codigo do usuario e a senha.";
    return;
  }
  setLoginBusy(true, "Validando usuario e senha");
  try {
    await login({ hotelId, credential, password });
    const payload = await getSession();
    byId("loginPass").value = "";
    await startSession(payload.data);
  } catch (error) {
    byId("legacyLoginError").textContent = error.message || "Falha ao entrar.";
  } finally {
    setLoginBusy(false);
  }
}

function scheduleLoginUserLookup() {
  const input = byId("loginCode");
  if (input.dataset.loginCredential) clearLoginIdentity();
  const code = input.value.trim();
  const hotelId = state.loginHotel?.hotel_id || "";
  const sequence = ++loginUserLookupSequence;
  window.clearTimeout(loginUserLookupTimer);
  if (!hotelId || !/^\d{1,9}$/.test(code)) return;

  loginUserLookupTimer = window.setTimeout(async () => {
    try {
      const payload = await identifyLoginUser({ hotelId, userCode: code });
      if (sequence !== loginUserLookupSequence || input.value.trim() !== code) return;
      const displayName = String(payload.data?.display_name || "").trim();
      if (!payload.data?.found || !displayName) return;
      input.dataset.loginCredential = code;
      input.dataset.loginDisplayName = displayName;
      input.value = displayName;
      input.classList.add("login-resolved");
      input.setAttribute("aria-label", `Codigo do usuario: ${displayName}`);
    } catch {
      if (sequence === loginUserLookupSequence) clearLoginIdentity();
    }
  }, 180);
}

function clearLoginIdentity({ clearValue = false } = {}) {
  const input = byId("loginCode", false);
  if (!input) return;
  delete input.dataset.loginCredential;
  delete input.dataset.loginDisplayName;
  input.classList.remove("login-resolved");
  input.removeAttribute("aria-label");
  if (clearValue) input.value = "";
}

function isLoginIdentityEditKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key === "Backspace" || event.key === "Delete" || event.key.length === 1;
}

async function handleLogout() {
  stopOrderPolling();
  await logout();
  state.session = null;
  state.cart.clear();
  showLogin();
}

async function startSession(session) {
  state.session = session;
  const hotels = session?.hotels || [];
  const pinnedHotel = resolvePinnedHotel(hotels);
  state.hotelId = pinnedHotel?.hotel_id || "";

  if (!state.hotelId) {
    showLogin();
    byId("legacyLoginError").textContent = "Usuario sem acesso a esta unidade.";
    return;
  }

  const displayName = displayUserName(session?.user);
  byId("activeStaff").textContent = displayName;
  setImage(byId("topStaffAvatar", false), safeImage(session?.user?.avatar), displayName);
  renderHotelIdentity(pinnedHotel);
  configureAuthorizedNavigation(session?.permissions || []);
  showApplication();
  await refreshAll();
  switchTab(state.route);
  startOrderPolling();
}

function renderHotelIdentity(hotel) {
  const title = document.querySelector("#appShell h1");
  if (title) title.textContent = displayHotelName(hotel);
}

function configureAuthorizedNavigation(permissions) {
  const allowed = new Set(permissions);
  const canRead = allowed.has("room-service.orders.read");
  const canWrite = allowed.has("room-service.orders.write");
  const canDashboard = allowed.has("room-service.dashboard.read") || canRead;
  const canGuests = allowed.has("room-service.guests.read") || canRead;
  const canBilling = allowed.has("room-service.billing.read") || canRead;
  const canCatalog = allowed.has("room-service.catalog.read") || canRead || canWrite;
  setNavigationVisibility("btnTabDashboard", canDashboard);
  setNavigationVisibility("btnTabVendas", canWrite);
  setNavigationVisibility("btnTabHist", canRead);
  setNavigationVisibility("btnTabHospedes", canGuests);
  setNavigationVisibility("btnTabFaturamento", canBilling);
  setNavigationVisibility("btnTabCardapio", canCatalog);
  setNavigationVisibility("btnTabAdmin", false);
  byId("accountConfigButton").classList.remove("hidden");
}

function setNavigationVisibility(id, visible) {
  const button = byId(id);
  button.classList.toggle("hidden", !visible);
  button.hidden = !visible;
  button.style.display = visible ? "flex" : "none";
}

async function refreshAll() {
  setPageBusy(true, "Sincronizando...");
  try {
    const hotelId = state.hotelId;
    const permissions = new Set(state.session?.permissions || []);
    const canRead = permissions.has("room-service.orders.read");
    const canWrite = permissions.has("room-service.orders.write");
    const canManageUsers = permissions.has("room-service.users.manage");
    const canManageCatalog = permissions.has("room-service.catalog.manage");
    const canManageSettings = permissions.has("room-service.settings.manage");
    const [context, dashboard, orders, catalog, guests, billing, users, userPermissions, operations, media, rooms, printing] = await Promise.all([
      getContext({ hotelId }),
      permissions.has("room-service.dashboard.read") || canRead ? getDashboard({ hotelId }) : null,
      canRead ? listOrders({ hotelId }) : null,
      permissions.has("room-service.catalog.read") || canRead || canWrite ? getCatalog({ hotelId }) : null,
      permissions.has("room-service.guests.read") || canRead ? getGuests({ hotelId }) : null,
      permissions.has("room-service.billing.read") || canRead ? getBilling({ hotelId }) : null,
      canManageUsers ? listErpUsers({ hotelId }) : null,
      canManageUsers ? listErpPermissions() : null,
      canManageSettings ? getOperations({ hotelId }) : null,
      canManageCatalog ? listErpMedia({ hotelId }) : null,
      canManageSettings ? listRooms({ hotelId }) : null,
      canManageSettings ? getPrinting({ hotelId }) : null,
    ]);
    state.context = context.data;
    state.dashboard = dashboard?.data || null;
    state.orders = orders?.data?.orders || [];
    state.knownOrderIds = new Set(state.orders.map((order) => order.id));
    state.catalog = catalog?.data || { categories: [] };
    state.guests = guests?.data || null;
    state.billing = billing?.data || null;
    state.users = users?.data?.users || [];
    state.userPermissions = userPermissions?.data?.permissions || [];
    state.operations = operations?.data || { operation: context.data.operation, rooms: context.data.rooms || [] };
    state.rooms = rooms?.data?.rooms || operations?.data?.rooms || context.data.rooms || [];
    state.media = media?.data?.assets || [];
    state.printing = printing?.data || null;
    state.printerEnrollment = null;
    state.scheduleViewMode = null;
    updateBranding();
    updateHeaderState();
    renderAll();
  } catch (error) {
    if (error.status === 401) {
      showLogin();
      return;
    }
    notify(error.message || "Nao foi possivel carregar o ERP.");
  } finally {
    setPageBusy(false);
  }
}

function updateBranding() {
  applyBranding(state.context?.branding, state.context?.hotel);
}

function applyBranding(branding = {}, hotel = {}) {
  const horizontalLogo = safeImage(branding.horizontal_logo_url) || safeImage(branding.logo_url);
  const reducedLogo = safeImage(branding.icon_url) || horizontalLogo;
  const name = displayHotelName(hotel);
  setImage(document.querySelector(".login-logo"), horizontalLogo, name);
  setImage(document.querySelector(".side-brand-logo"), horizontalLogo, name);
  setImage(document.querySelector(".side-brand-logo-seal"), reducedLogo, name);

  const root = document.documentElement;
  applyBrandTokens(root, branding.primary_color, branding.secondary_color);
  if (isHexColor(branding.background_color)) root.style.setProperty("--canvas", branding.background_color);
  if (isHexColor(branding.text_color)) root.style.setProperty("--ink", branding.text_color);
  root.style.removeProperty("--hotel-font");
  root.style.setProperty("--header-logo-scale", String(normalizeLogoScale(branding.header_logo_scale)));
  syncErpFavicon(safeImage(branding.favicon_url) || reducedLogo || horizontalLogo);
  document.title = `${name} | ERP Room Service`;
}

function resolveErpHotelSlug() {
  const match = window.location.pathname.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/admin\/erp(?:\/|$)/);
  return match?.[1] || new URLSearchParams(window.location.search).get("hotel") || "";
}

function resolvePinnedHotel(hotels) {
  const entries = Array.isArray(hotels) ? hotels : [];
  const requested = state.hotelSlug || state.loginHotel?.slug || "";
  if (requested) {
    return entries.find((hotel) => hotel.slug === requested || hotel.hotel_id === requested) || null;
  }
  return entries.length === 1 ? entries[0] : null;
}

function syncErpFavicon(url) {
  if (!url) return;
  let link = document.head.querySelector('link[rel="icon"][data-hotel-favicon]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.dataset.hotelFavicon = "";
    document.head.append(link);
  }
  link.href = url;
}

function normalizeLogoScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale >= 0.5 && scale <= 3 ? scale : 1;
}

function renderAll() {
  renderDashboard();
  renderOrders();
  renderMenu();
  renderCart();
  renderGuests();
  renderBilling();
  renderCatalog();
  renderAdmin();
  renderPdvRoomOptions();
}

function renderPdvRoomOptions() {
  const input = byId("roomNumber", false);
  const target = byId("roomOptions", false);
  if (!input || !target) return;
  const query = normalize(input.value);
  const rooms = (state.context?.rooms || state.rooms || []).filter((room) => room.status !== "inactive");
  const visibleRooms = rooms.filter((room) => !query || normalize(`${room.code} ${room.label || ""} ${room.room_type || ""}`).includes(query));
  const groups = visibleRooms.reduce((result, room) => {
    const label = roomFloorLabel(room.code);
    if (!result.has(label)) result.set(label, []);
    result.get(label).push(room);
    return result;
  }, new Map());
  target.innerHTML = visibleRooms.length
    ? [...groups.entries()].map(([label, entries]) => `<section class="erp-room-option-group"><p>${escapeHtml(label)}</p>${entries.map((room) => `<button type="button" role="option" data-room-option="${escapeAttr(room.code)}"><strong>${escapeHtml(room.code)}</strong><span>${escapeHtml(displayBusinessText(room.label, "Acomodação"))}</span></button>`).join("")}</section>`).join("")
    : '<p class="erp-room-option-empty">Nenhuma acomodação encontrada.</p>';
}

function roomFloorLabel(code) {
  const value = String(code || "").trim();
  if (/^\d{3,}$/.test(value)) return `${value.slice(0, -2)}º andar`;
  return "Acomodações";
}

function openPdvRoomOptions() {
  const input = byId("roomNumber", false);
  const target = byId("roomOptions", false);
  if (!input || !target) return;
  renderPdvRoomOptions();
  target.classList.remove("hidden");
  input.setAttribute("aria-expanded", "true");
}

function closePdvRoomOptions() {
  byId("roomOptions", false)?.classList.add("hidden");
  byId("roomNumber", false)?.setAttribute("aria-expanded", "false");
}

function togglePdvRoomOptions() {
  const target = byId("roomOptions", false);
  if (!target) return;
  if (target.classList.contains("hidden")) {
    byId("roomNumber", false)?.focus();
    openPdvRoomOptions();
  } else {
    closePdvRoomOptions();
  }
}

function handlePdvRoomSelection(event) {
  const option = event.target.closest("[data-room-option]");
  if (!option) return;
  byId("roomNumber").value = option.dataset.roomOption;
  closePdvRoomOptions();
  byId("guestName", false)?.focus();
}

function handlePdvRoomKeydown(event) {
  if (event.key === "Escape") return closePdvRoomOptions();
  if (event.key === "ArrowDown") {
    event.preventDefault();
    openPdvRoomOptions();
    byId("roomOptions", false)?.querySelector("[data-room-option]")?.focus();
  }
}

function switchTab(route, { allowHidden = false } = {}) {
  if (!ROUTES[route] || (!allowHidden && byId(ROUTES[route].button).classList.contains("hidden"))) {
    route = Object.keys(ROUTES).find((key) => !byId(ROUTES[key].button).classList.contains("hidden")) || "dashboard";
  }
  saveCurrentSearchQuery();
  state.route = route;
  document.body.dataset.erpRoute = route;
  for (const [key, config] of Object.entries(ROUTES)) {
    const active = key === route;
    const button = byId(config.button);
    const container = byId(config.container);
    button.classList.toggle("tab-active", active);
    button.classList.toggle("tab-inactive", !active);
    button.setAttribute("aria-current", active ? "page" : "false");
    container.classList.toggle("hidden", !active);
    container.style.display = active ? "flex" : "none";
  }
  if (window.matchMedia("(max-width: 1100px)").matches) {
    document.body.classList.remove("sidebar-open");
  }
  syncContextualSearch(route);
  renderActiveRoute();
}

function renderActiveRoute() {
  if (state.route === "dashboard") renderDashboard();
  if (state.route === "hist") renderOrders();
  if (state.route === "vendas") renderMenu();
  if (state.route === "hospedes") renderGuests();
  if (state.route === "faturamento") renderBilling();
  if (state.route === "cardapio") renderCatalog();
  if (state.route === "admin") renderAdmin();
}

function renderDashboardV3() {
  const summary = state.dashboard?.summary || {};
  const orders = filteredOrders("");
  const completed = orders.filter((order) => order.status === "delivered");
  const revenue = summary.revenue_cents ?? completed.reduce((total, order) => total + Number(order.total_cents || 0), 0);
  const origins = countBy(orders, (order) => order.origin || "portal");
  const statuses = countBy(orders, (order) => order.status || "sent");
  setText("dashSummaryLabel", `${state.context?.hotel?.name || "Unidade"} - indicadores em tempo real`);
  setText("kpiVendas", summary.today_orders ?? orders.length);
  setText("kpiReceita", money(revenue));
  setText("kpiTicket", money(summary.average_ticket_cents || 0));
  setText("kpiActive", summary.active_orders || 0);

  const operation = state.operations?.operation || state.context?.operation || {};
  const operationCard = byId("dashboardOperation", false);
  if (operationCard) {
    operationCard.classList.toggle("open", Boolean(operation.open));
    operationCard.innerHTML = `<span class="erp-operation-dot"></span><span><strong>${operation.open ? "Room Service aberto" : "Room Service fechado"}</strong><small>${operation.mode === "automatic" ? "Controle automatico por horario" : "Controle manual ativo"}</small></span>`;
  }

  const total = Math.max(1, orders.length);
  const slices = [
    Number(statuses.sent || 0),
    Number(statuses.printed || 0),
    Number(statuses.delivered || 0),
    Math.max(0, total - Number(statuses.sent || 0) - Number(statuses.printed || 0) - Number(statuses.delivered || 0)),
  ];
  const points = slices.reduce((result, value, index) => {
    const start = index ? result[index - 1] : 0;
    result.push(start + (value / total) * 100);
    return result;
  }, []);
  const donut = byId("dashboardDonut", false);
  if (donut) donut.style.background = `conic-gradient(var(--accent) 0 ${points[0]}%, #d7a44a ${points[0]}% ${points[1]}%, #4a966f ${points[1]}% ${points[2]}%, #e6e8eb ${points[2]}% 100%)`;
  setText("dashboardDonutTotal", orders.length);
  renderBars(byId("dashStatusLegend"), Object.entries(statuses).map(([key, value]) => [statusLabel(key), value]));

  const hours = Object.entries(state.dashboard?.by_hour || countBy(orders, (order) => `${String(order.created_at || "").slice(11, 13) || "00"}:00`)).sort((a, b) => a[0].localeCompare(b[0]));
  const maxHour = Math.max(1, ...hours.map((entry) => Number(entry[1])));
  byId("dashboardHourlyChart").innerHTML = hours.length
    ? hours.map(([hour, value]) => `<div class="erp-modern-bar" title="${Number(value)} pedidos"><i style="height:${Math.max(5, Math.round((Number(value) / maxHour) * 100))}%"></i><small>${escapeHtml(hour.slice(0, 2))}h</small></div>`).join("")
    : '<div class="legacy-dashboard-empty">Sem dados no periodo.</div>';

  const topItems = state.dashboard?.top_items || [];
  byId("dashboardTopItems").innerHTML = topItems.length
    ? topItems.map((item) => `<div class="erp-list-button"><span><strong>${escapeHtml(item.name)}</strong><small>${Number(item.quantity)} unidades</small></span><b>${money(item.revenue_cents)}</b></div>`).join("")
    : '<div class="legacy-dashboard-empty">Os itens mais vendidos aparecerão aqui.</div>';

  const recent = state.dashboard?.recent_orders || orders.slice(0, 8);
  byId("dashLastOrders").innerHTML = recent.length
    ? recent.map((order) => `<button type="button" class="erp-list-button" data-order-id="${escapeAttr(order.id)}"><span><strong>${escapeHtml(orderDisplayLabel(order))}</strong><small>${escapeHtml(order.room_code || "Sem acomodacao")} · ${statusLabel(order.status)}</small></span><b>${money(order.total_cents)}</b></button>`).join("")
    : '<div class="legacy-dashboard-empty">Nenhum pedido encontrado.</div>';
  bindOrderButtons(byId("dashLastOrders"));

  setText("dashOriginMeta", `${Object.values(origins).reduce((sum, value) => sum + Number(value), 0)} pedidos`);
}

function renderDashboard() {
  const selectedDate = byId("dashDate", false)?.value || localDateKey(new Date());
  const orders = state.orders.filter((order) => dateKeyInHotelTimezone(order.created_at) === selectedDate);
  const completed = orders.filter((order) => order.status === "delivered");
  const revenue = completed.reduce((total, order) => total + Number(order.total_cents || 0), 0);
  const topItems = state.dashboard?.top_items || [];
  const peak = peakHour(orders);
  const statuses = countBy(orders, (order) => order.status || "sent");
  const activeOrders = orders.filter((order) => ["sent", "printed"].includes(order.status)).length;

  setText("dashSummaryLabel", formatDashboardDate(selectedDate));
  setText("kpiVendas", orders.length);
  setText("kpiReceita", money(revenue));
  setText("kpiTicket", money(completed.length ? Math.round(revenue / completed.length) : 0));
  setText("kpiActive", activeOrders);
  setText("kpiObs", orders.filter((order) => String(order.notes || "").trim()).length);
  byId("kpiReceitaCard", false)?.classList.toggle("hidden", !state.session?.permissions?.includes("room-service.billing.read"));

  const hours = Object.entries(countBy(orders, (order) => {
    const raw = new Date(order.created_at);
    if (Number.isNaN(raw.getTime())) return "00:00";
    const hour = new Intl.DateTimeFormat("pt-BR", {
      timeZone: state.context?.hotel?.timezone || "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(raw);
    return `${hour.replace(/\D/g, "").padStart(2, "0")}:00`;
  })).sort((a, b) => a[0].localeCompare(b[0]));
  const maxHour = Math.max(1, ...hours.map((entry) => Number(entry[1] || 0)));
  byId("dashboardHourlyChart").innerHTML = hours.length
    ? hours.map(([hour, value]) => `<div class="erp-dashboard-bar" title="${Number(value)} ${Number(value) === 1 ? "pedido" : "pedidos"} às ${escapeAttr(hour)}"><span><i style="height:${Math.max(8, Math.round((Number(value) / maxHour) * 100))}%"></i></span><small>${escapeHtml(hour.slice(0, 2))}h</small></div>`).join("")
    : '<div class="erp-dashboard-empty">O movimento do dia aparecerá aqui.</div>';

  const statusEntries = ["sent", "printed", "delivered", "cancelled"].map((status) => ({ status, value: Number(statuses[status] || 0) }));
  const total = Math.max(1, orders.length);
  let cursor = 0;
  const palette = ["var(--accent)", "var(--accent-soft-strong)", "#32a36c", "#c8cdd4"];
  const stops = statusEntries.map((entry, index) => {
    const start = cursor;
    cursor += (entry.value / total) * 100;
    return `${palette[index]} ${start}% ${cursor}%`;
  });
  byId("dashboardDonut").style.background = orders.length ? `conic-gradient(${stops.join(",")})` : "#edf0f2";
  setText("dashboardDonutTotal", orders.length);
  byId("dashStatusLegend").innerHTML = statusEntries.map((entry, index) => `<div><i style="--legend-color:${palette[index]}"></i><span>${escapeHtml(statusLabel(entry.status))}</span><b>${entry.value}</b></div>`).join("");

  const maxItem = Math.max(1, ...topItems.map((item) => Number(item.quantity || 0)));
  byId("dashTopItemsList").innerHTML = topItems.length
    ? topItems.slice(0, 6).map((item, index) => `<div class="erp-dashboard-rank"><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${escapeHtml(displayBusinessText(item.name, "Item do cardapio"))}</strong><i><em style="width:${Math.max(7, Math.round((Number(item.quantity || 0) / maxItem) * 100))}%"></em></i></span><small>${Number(item.quantity || 0)}</small></div>`).join("")
    : '<div class="erp-dashboard-empty">Os itens mais pedidos aparecerão aqui.</div>';
  setText("dashTopItemMeta", topItems[0] ? `${Number(topItems[0].quantity || 0)} unidades` : "Sem vendas");

  const recent = orders.slice(0, 8);
  setText("dashLastOrdersMeta", `${recent.length} ${recent.length === 1 ? "pedido" : "pedidos"}`);
  byId("dashLastOrders").innerHTML = recent.length
    ? recent.map((order) => `<button type="button" class="erp-dashboard-order" data-order-id="${escapeAttr(order.id)}"><time>${escapeHtml(formatDate(order.created_at, { hour: "2-digit", minute: "2-digit" }))}</time><span><strong>${escapeHtml(orderDisplayLabel(order))}</strong><small>${escapeHtml(order.room_code || "Sem acomodacao")}</small></span><em data-status="${escapeAttr(order.status)}">${escapeHtml(statusLabel(order.status))}</em><b>${money(order.total_cents, order.currency)}</b></button>`).join("")
    : '<div class="erp-dashboard-empty">Nenhum pedido neste dia.</div>';
  bindOrderButtons(byId("dashLastOrders"));

  setText("dashPeakHour", peak?.[0] || "-");
}

function renderOrders() {
  const query = currentSearchQuery();
  const orders = filteredOrders(query);
  setText("simpleHistMeta", `${orders.length} pedidos`);
  const target = byId("simpleHistTableBody");
  target.innerHTML = orders.length
    ? orders.map(orderMiniCard).join("")
    : '<div class="loose-list-empty">Nenhum pedido encontrado nesse dia.</div>';
  bindOrderButtons(target);
}

function orderMiniCard(order) {
  const time = formatDate(order.created_at, { hour: "2-digit", minute: "2-digit" });
  return `<article class="order-mini-card">
    <div><p class="mini-card-label">Hora</p><p class="mini-card-value text-sm">${escapeHtml(time)}</p></div>
    <div class="min-w-0"><p class="mini-card-title truncate">${escapeHtml(displayGuestName(order.guest_name))}</p><p class="mini-card-meta"><span>${escapeHtml(orderDisplayLabel(order))} · Apto ${escapeHtml(order.room_code || "-")}</span><span class="legacy-status-chip" data-status="${escapeAttr(order.status)}">${escapeHtml(statusLabel(order.status))}</span></p></div>
    <div><p class="mini-card-label">Total</p><p class="mini-card-value">${money(order.total_cents)}</p></div>
    <div class="mini-card-actions justify-end"><button type="button" data-order-id="${escapeAttr(order.id)}" class="mini-card-action"><i data-lucide="eye" class="w-4 h-4" aria-hidden="true"></i>Ver</button></div>
  </article>`;
}

async function openOrder(orderId) {
  try {
    setPageBusy(true, "Carregando pedido...");
    const payload = await getOrder(orderId);
    const order = payload.data.order;
    state.selectedOrderId = order.id;
    const preparation = order.preparation_mode === "scheduled" && order.scheduled_for
      ? `Agendado para ${formatDate(order.scheduled_for, { hour: "2-digit", minute: "2-digit" })}`
      : "Preparo imediato";
    setText("orderDetailTitle", orderDisplayLabel(order));
    setText("detDate", formatOrderDate(order.created_at));
    setText("detLinha", order.id);
    setText("detRoom", order.delivery?.room_code || order.room_code || "-");
    setText("detGuest", displayGuestName(order.guest_name));
    setText("detLocal", displayBusinessText(order.delivery?.location, "Acomodacao"));
    setText("detContact", displayBusinessText(order.delivery?.contact, "Nao informado"));
    setText("detPreparation", preparation);
    setText("detStaff", order.origin === "admin_pdv" ? "ERP" : "Portal");
    setText("detTotal", money(order.total_cents, order.currency));
    const status = byId("detStatus");
    status.dataset.status = order.status;
    status.textContent = `Status do pedido: ${statusLabel(order.status)}`;
    const items = order.items || [];
    const quantity = items.reduce((total, item) => total + Number(item.quantity || 0), 0);
    setText("detItemCount", `${quantity} ${quantity === 1 ? "item" : "itens"}`);
    byId("detItems").innerHTML = items.length
      ? items.map((item) => `<article class="order-detail-item">
          <div><h4>${escapeHtml(displayBusinessText(item.name || item.name_snapshot, "Item"))}</h4><span>${Number(item.quantity || 0)} × ${money(item.unit_price_cents, order.currency)}</span>${formatOrderItemOptions(item.selected_options)}</div>
          <b>${money(item.line_total_cents, order.currency)}</b>
        </article>`).join("")
      : '<div class="order-detail-empty">Este pedido nao possui itens.</div>';
    const notes = order.delivery?.observation || "";
    byId("detObsBox").classList.toggle("hidden", !notes);
    setText("detObs", notes);
    renderOrderHistory(order.history || []);
    renderOrderPrinting(order.printing || {});
    renderStatusActions(order);
    byId("orderModal").classList.remove("hidden");
  } catch (error) {
    notify(error.message || "Nao foi possivel abrir o pedido.");
  } finally {
    setPageBusy(false);
  }
}

function renderStatusActions(order) {
  const target = document.querySelector(".order-detail-actions");
  const next = NEXT_STATUS[order.status];
  const buttons = [];
  const canWrite = (state.session?.permissions || []).includes("room-service.orders.write");
  if (canWrite && order.printing?.can_reprint) {
    buttons.push(`<button type="button" class="order-action-secondary order-action-print" data-order-reprint>${printIcon()} Imprimir novamente</button>`);
  }
  if (canWrite && !["delivered", "cancelled"].includes(order.status)) buttons.push('<button type="button" class="order-action-secondary order-action-danger" data-status-target="cancelled">Cancelar pedido</button>');
  if (canWrite && next) buttons.push(`<button type="button" class="order-action-primary" data-status-target="${next}">${escapeHtml(orderStatusActionLabel(next))}</button>`);
  target.innerHTML = `<div class="legacy-status-actions">${buttons.join("")}</div>`;
  target.querySelectorAll("[data-status-target]").forEach((button) => button.addEventListener("click", () => changeOrderStatus(order, button.dataset.statusTarget)));
  target.querySelector("[data-order-reprint]")?.addEventListener("click", (event) => queueOrderReprint(order, event.currentTarget));
}

async function changeOrderStatus(order, targetStatus) {
  state.pendingStatusAction = { order, targetStatus };
  const cancelled = targetStatus === "cancelled";
  setText("orderStatusDialogTitle", cancelled ? "Cancelar pedido" : orderStatusActionLabel(targetStatus));
  setText("orderStatusDialogText", cancelled
    ? "O pedido sera cancelado e permanecera registrado no historico."
    : `Confirme a alteracao do pedido para ${statusLabel(targetStatus)}.`);
  byId("orderStatusNoteField").classList.toggle("hidden", !cancelled);
  byId("orderStatusNote").value = "";
  setText("orderStatusDialogError", "");
  byId("orderStatusDialog").classList.remove("hidden");
  if (cancelled) byId("orderStatusNote").focus();
}

async function submitOrderStatusDialog(event) {
  event.preventDefault();
  const action = state.pendingStatusAction;
  if (!action) return closeOrderStatusDialog();
  const note = action.targetStatus === "cancelled" ? byId("orderStatusNote").value.trim() : "";
  if (action.targetStatus === "cancelled" && !note) {
    setText("orderStatusDialogError", "Informe o motivo do cancelamento.");
    byId("orderStatusNote").focus();
    return;
  }
  const submit = event.currentTarget.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await updateOrderStatus(action.order.id, { status: action.targetStatus, note });
    const orderId = action.order.id;
    const targetStatus = action.targetStatus;
    closeOrderStatusDialog();
    notify(`Pedido atualizado para ${statusLabel(targetStatus)}.`);
    await refreshAll();
    await openOrder(orderId);
  } catch (error) {
    setText("orderStatusDialogError", error.message || "Nao foi possivel atualizar o pedido.");
  } finally {
    submit.disabled = false;
  }
}

function closeOrderStatusDialog() {
  byId("orderStatusDialog", false)?.classList.add("hidden");
  state.pendingStatusAction = null;
}

async function queueOrderReprint(order, button) {
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    await reprintOrder(order.id);
    notify("Pedido adicionado a fila de impressao.");
    await openOrder(order.id);
  } catch (error) {
    notify(error.message || "Nao foi possivel adicionar o pedido a fila de impressao.");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

function renderOrderHistory(history) {
  byId("detHistory").innerHTML = history.length
    ? [...history].reverse().map((entry) => `<li data-status="${escapeAttr(entry.status)}"><i aria-hidden="true"></i><div><strong>${escapeHtml(statusLabel(entry.status))}</strong><span>${escapeHtml(formatDate(entry.created_at))}</span>${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}</div></li>`).join("")
    : '<li class="order-detail-empty">Nenhuma movimentacao registrada.</li>';
}

function renderOrderPrinting(printing) {
  const section = document.querySelector(".order-detail-printing");
  const latest = printing.latest_event;
  const connection = printing.device?.connection_status || "not_configured";
  const stateKey = !printing.enabled ? "disabled" : !printing.configured ? "unconfigured" : connection === "online" ? "online" : "queued";
  section.dataset.printingState = stateKey;
  setText("detPrintState", printStateTitle(printing, latest));
  setText("detPrintMessage", printing.message || "Configuracao de impressao nao encontrada.");
  const agentStatus = byId("detPrintAgentStatus");
  agentStatus.dataset.status = stateKey;
  agentStatus.textContent = printAgentStatusLabel(printing, connection);
  byId("detPrintMeta").innerHTML = [
    printing.device?.name ? `<div><dt>Computador</dt><dd>${escapeHtml(printing.device.name)}</dd></div>` : "",
    printing.device?.printer_name ? `<div><dt>Impressora</dt><dd>${escapeHtml(printing.device.printer_name)}</dd></div>` : "",
    printing.template?.name ? `<div><dt>Modelo do comprovante</dt><dd>${escapeHtml(printing.template.name)}</dd></div>` : "",
  ].filter(Boolean).join("");
  const events = (printing.events || []).slice(-3).reverse();
  byId("detPrintEvents").innerHTML = events.length
    ? events.map((entry) => `<div data-print-status="${escapeAttr(entry.status)}"><i aria-hidden="true"></i><span><strong>${escapeHtml(printEventLabel(entry.status, entry.job_kind))}</strong><small>${escapeHtml(formatDate(entry.requested_at || entry.created_at))}${Number(entry.attempts || 0) ? ` · ${Number(entry.attempts)} tentativa${Number(entry.attempts) === 1 ? "" : "s"}` : ""}</small>${entry.last_error ? `<em>${escapeHtml(entry.last_error)}</em>` : ""}</span></div>`).join("")
    : '<p class="order-detail-print-empty">Nenhuma impressao solicitada para este pedido.</p>';
}

function printStateTitle(printing, latest) {
  if (latest?.status === "printed") return "Último comprovante impresso";
  if (latest?.status === "printing") return "Comprovante em impressão";
  if (latest?.status === "queued") return "Comprovante aguardando impressão";
  if (latest?.status === "failed") return "Falha no último comprovante";
  if (!printing.enabled) return "Impressão desativada para esta unidade";
  if (!printing.configured) return "Impressão ainda não configurada";
  return "Nenhum comprovante emitido";
}

function printAgentStatusLabel(printing, connection) {
  if (!printing.enabled) return "Desativada";
  if (!printing.configured) return "Não configurado";
  if (connection === "online") return "Agente online";
  if (connection === "paused") return "Agente pausado";
  return "Agente offline";
}

function printEventLabel(status, jobKind) {
  const labels = { queued: "Na fila", printing: "Imprimindo", printed: "Impresso", failed: "Falhou", cancelled: "Cancelado", disabled: "Desativado" };
  const kind = jobKind === "reprint" ? "Reimpressao" : "Impressao";
  return `${kind}: ${labels[status] || status}`;
}

function formatOrderItemOptions(options) {
  if (!options || typeof options !== "object") return "";
  const details = Object.entries(options)
    .filter(([, value]) => value != null && String(value).trim())
    .map(([key, value]) => `${key === "note" ? "Observacao" : displayBusinessText(key.replaceAll("_", " "), key)}: ${String(value)}`);
  return details.length ? `<p>${details.map(escapeHtml).join(" · ")}</p>` : "";
}

function renderMenu() {
  const query = normalize(currentSearchQuery());
  const categories = (state.catalog?.categories || []).map((category) => ({
    ...category,
    items: (category.items || []).map((item) => ({ ...item, category_name: category.name })).filter((item) => !query || normalize(`${item.name} ${item.description || ""} ${item.tag || ""} ${category.name}`).includes(query)),
  })).filter((category) => category.items.length);
  const itemCount = categories.reduce((total, category) => total + category.items.length, 0);
  setText("pdvMenuSummary", query ? `${itemCount} resultado${itemCount === 1 ? "" : "s"}` : `${itemCount} ${itemCount === 1 ? "item" : "itens"} no cardápio`);
  byId("menuContent").innerHTML = categories.length ? categories.map(menuCategory).join("") : '<div class="erp-pdv-empty-search"><strong>Nenhum item encontrado</strong><span>Tente buscar por outro nome ou categoria.</span></div>';
  byId("menuContent").querySelectorAll("[data-product-id]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.productId)));
  byId("menuContent").querySelectorAll("[data-drag-product-id]").forEach((card) => bindPdvProductDrag({
    element: card,
    productId: card.dataset.dragProductId,
  }));
}

function menuCategory(category) {
  return `<section class="erp-pdv-category"><h2>${categoryIcon()} <span>${escapeHtml(stripDecorativeEmoji(displayBusinessText(category.name, "Cardápio")))}</span><small>${category.items.length} ${category.items.length === 1 ? "item" : "itens"}</small></h2><div class="erp-pdv-list">${category.items.map(menuCard).join("")}</div></section>`;
}

function stripDecorativeEmoji(value) {
  return String(value || "").replace(/\p{Extended_Pictographic}|\uFE0F/gu, "").replace(/\s{2,}/g, " ").trim();
}

function menuCard(item) {
  const disabled = item.available === false;
  const image = safeImage(item.image_url || item.media_url);
  const tag = disabled ? "Indisponivel" : displayBusinessText(item.tag || item.category_name, "Cardapio");
  const name = displayBusinessText(item.name, "Item do cardapio");
  const description = displayBusinessText(item.description, "Sem descrição");
  return `<article class="erp-pdv-card fade-in" aria-disabled="${disabled}" ${disabled ? "" : `draggable="true" data-drag-product-id="${escapeAttr(item.id)}"`}><span class="erp-pdv-thumb">${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(name)}">` : imagePlaceholderIcon()}</span><div class="erp-pdv-card-copy"><span class="erp-item-tag">${escapeHtml(tag)}</span><h3>${escapeHtml(name)}</h3><p title="${escapeAttr(description)}">${escapeHtml(description)}</p></div><div class="erp-pdv-card-action"><strong class="erp-pdv-price">${money(item.price_cents, item.currency)}</strong><button type="button" data-product-id="${escapeAttr(item.id)}" ${disabled ? "disabled" : ""} class="erp-pdv-add" aria-label="${disabled ? "Item indisponível" : `Adicionar ${escapeAttr(name)}`}">${plusIcon()} <span>${disabled ? "Indisponível" : "Adicionar"}</span></button></div></article>`;
}

function addToCart(productId) {
  const item = allCatalogItems().find((entry) => entry.id === productId);
  if (!item || item.available === false) return;
  const line = state.cart.get(item.id) || { item, quantity: 0 };
  line.quantity += 1;
  state.cart.set(item.id, line);
  renderCart();
}

function renderCart() {
  const target = byId("cartItems");
  const rows = [...state.cart.values()];
  const quantity = rows.reduce((total, line) => total + line.quantity, 0);
  target.innerHTML = rows.length ? rows.map(cartLine).join("") : `<div class="erp-pdv-cart-empty"><span>${cartIcon()}</span><strong>Comanda vazia</strong><small>Os itens escolhidos aparecerão aqui.</small></div>`;
  target.querySelectorAll("[data-cart-change]").forEach((button) => button.addEventListener("click", () => changeCart(button.dataset.cartChange, Number(button.dataset.delta))));
  setText("cartTotal", money(rows.reduce((total, line) => total + Number(line.item.price_cents || 0) * line.quantity, 0)));
  setText("cartItemCount", `${quantity} ${quantity === 1 ? "item" : "itens"}`);
  setText("pdvMobileJumpLabel", quantity ? "Comanda · " + quantity + " " + (quantity === 1 ? "item" : "itens") : "Ver comanda");
  bindPdvActions();
}

function cartLine(line) {
  const image = safeImage(line.item.image_url || line.item.media_url);
  const name = displayBusinessText(line.item.name, "Item do cardápio");
  return `<article class="erp-cart-line fade-in"><span class="erp-cart-thumb">${image ? `<img src="${escapeAttr(image)}" alt="">` : imagePlaceholderIcon()}</span><div class="erp-cart-copy"><strong>${escapeHtml(name)}</strong><small>${money(line.item.price_cents, line.item.currency)} por unidade</small><div class="erp-cart-stepper"><button type="button" data-cart-change="${escapeAttr(line.item.id)}" data-delta="-1" aria-label="Remover uma unidade">−</button><span>${line.quantity}</span><button type="button" data-cart-change="${escapeAttr(line.item.id)}" data-delta="1" aria-label="Adicionar uma unidade">+</button></div></div><b>${money(line.item.price_cents * line.quantity, line.item.currency)}</b></article>`;
}

function bindPdvActions() {
  const container = byId("vendasContainer");
  const jump = byId("pdvMobileJump", false);
  const back = byId("pdvMobileCatalogReturn", false);
  bindPdvCheckoutActions({
    container,
    empty: state.cart.size === 0,
    onSubmit: submitPdvOrder,
    onClear: () => {
      state.cart.clear();
      renderCart();
    },
  });
  if (jump && !jump.dataset.bound) {
    jump.dataset.bound = "true";
    jump.addEventListener("click", () => container.querySelector(".pdv-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  if (back && !back.dataset.bound) {
    back.dataset.bound = "true";
    back.addEventListener("click", () => container.querySelector("main")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function changeCart(productId, delta) {
  const line = state.cart.get(productId);
  if (!line) return;
  line.quantity += delta;
  if (line.quantity <= 0) state.cart.delete(productId);
  renderCart();
}

async function submitPdvOrder() {
  if (!state.cart.size) return notify("Adicione ao menos um produto.");
  const guestName = byId("guestName").value.trim();
  const roomCode = byId("roomNumber").value.trim();
  if (!guestName || !roomCode) return notify("Informe hospede e acomodacao.");
  const roomExists = (state.context?.rooms || state.rooms || []).some((room) => room.status !== "inactive" && String(room.code) === roomCode);
  if (!roomExists) return notify("Selecione uma acomodacao cadastrada.");
  try {
    setPageBusy(true, "Criando pedido...");
    await createPdvOrder({
      hotel_id: state.hotelId,
      guest_name: guestName,
      room_code: roomCode,
      notes: `Local de entrega: ${byId("consumptionLocation").value}\n${byId("orderObs").value.trim()}`.trim(),
      items: [...state.cart.values()].map(({ item, quantity }) => ({ catalog_item_id: item.id, quantity, unit_price_cents: item.price_cents })),
    }, `admin-pdv-${crypto.randomUUID()}`);
    state.cart.clear();
    byId("guestName").value = "";
    byId("roomNumber").value = "";
    byId("orderObs").value = "";
    notify("Pedido criado sem acionar impressao.");
    await refreshAll();
    switchTab("hist");
  } catch (error) {
    notify(error.message || "Nao foi possivel criar o pedido.");
  } finally {
    setPageBusy(false);
  }
}

function renderGuests() {
  const query = normalize(currentSearchQuery());
  const guests = (state.guests?.guests || []).filter((guest) => !query || [guest.guest_name, guest.room_code, guest.phone]
    .some((value) => normalize(value || "").includes(query)));
  const occupiedRooms = new Set((state.guests?.guests || []).map((guest) => String(guest.room_code)));
  const rooms = (state.guests?.rooms || []).filter((room) => !occupiedRooms.has(String(room.code)) && (!query || normalize(room.code).includes(query)));
  setText("guestDirectoryMeta", `${guests.length} ${guests.length === 1 ? "hospede" : "hospedes"} · ${rooms.length} ${rooms.length === 1 ? "acomodacao livre" : "acomodacoes livres"}`);
  byId("guestTableBody").innerHTML = guests.length || rooms.length
    ? `${guests.length ? `<section class="guest-letter-section"><div class="guest-letter-title">Hospedes recentes</div><div class="guest-letter-grid">${guests.map(guestDirectoryCard).join("")}</div></section>` : ""}
       ${rooms.length ? `<section class="guest-letter-section"><div class="guest-letter-title">Acomodacoes livres</div><div class="guest-letter-grid">${rooms.map(roomCard).join("")}</div></section>` : ""}`
    : '<div class="loose-list-empty">Nenhum hospede ou acomodacao encontrado.</div>';
  byId("guestTableBody").querySelectorAll("[data-room-code]").forEach((button) => button.addEventListener("click", () => {
    byId("roomNumber").value = button.dataset.roomCode;
    if (button.dataset.guestName) byId("guestName").value = button.dataset.guestName;
    switchTab("vendas");
  }));
  byId("guestTableBody").querySelectorAll("[data-archive-guest]").forEach((button) => button.addEventListener("click", () => archiveGuestStay(button)));
}

function guestDirectoryCard(guest) {
  const phone = String(guest.phone || "").trim();
  const canArchive = Boolean(state.context?.permissions?.can_write_orders);
  const guestName = displayGuestName(guest.guest_name);
  const reusableGuestName = displayGuestName(guest.guest_name, "");
  return `<article class="guest-mini-card"><div class="mini-card-top"><div><p class="mini-card-label">Hospede</p><p class="text-[11px] font-black text-gray-500 uppercase">Ultima atividade ${escapeHtml(formatDate(guest.last_seen_at))}</p></div><div class="mini-room-badge">Apto ${escapeHtml(guest.room_code)}</div></div><div><p class="mini-card-title">${escapeHtml(guestName)}</p><p class="text-[11px] font-bold text-gray-500 mt-2">${phone ? escapeHtml(phone) : "Contato nao informado"}</p></div><div class="mini-card-actions"><button type="button" data-room-code="${escapeAttr(guest.room_code)}" data-guest-name="${escapeAttr(reusableGuestName)}" class="mini-card-action orange">${cartIcon()} Novo pedido</button>${canArchive ? `<button type="button" data-archive-guest="${escapeAttr(guest.id)}" class="mini-card-action">Encerrar estadia</button>` : ""}</div></article>`;
}

async function archiveGuestStay(button) {
  if (!window.confirm("Encerrar esta estadia no diretorio? Os pedidos continuarao preservados.")) return;
  button.disabled = true;
  try {
    await archiveGuest(button.dataset.archiveGuest, { hotelId: state.hotelId });
    state.guests = await getGuests({ hotelId: state.hotelId });
    renderGuests();
    notify("Estadia encerrada no diretorio.");
  } catch (error) {
    notify(error.message || "Nao foi possivel encerrar a estadia.");
    button.disabled = false;
  }
}

function roomCard(room) {
  return `<article class="guest-mini-card"><div class="mini-card-top"><div><p class="mini-card-label">Acomodacao</p><p class="text-[11px] font-black text-gray-500 uppercase">Disponivel</p></div><div class="mini-room-badge">Apto ${escapeHtml(room.code)}</div></div><div><p class="mini-card-title">${escapeHtml(displayBusinessText(room.label, `Acomodacao ${room.code}`))}</p><p class="text-[11px] font-bold text-gray-500 mt-2">${escapeHtml(displayBusinessText(room.room_type, "Atendimento no quarto"))}</p></div><div class="mini-card-actions"><button type="button" data-room-code="${escapeAttr(room.code)}" class="mini-card-action orange">${cartIcon()} Novo pedido</button></div></article>`;
}

function renderBillingLegacy() {
  const summary = state.billing?.summary || {};
  setText("histKpiRevenue", money(summary.revenue_cents || 0));
  setText("histKpiOrders", summary.completed_orders || 0);
  setText("histKpiTicket", money(summary.average_ticket_cents || 0));
  setText("histKpiObs", state.orders.filter((order) => order.notes).length);
  setText("histTableMeta", `${state.orders.length} pedidos`);
  byId("histTableBody").innerHTML = state.orders.map((order) => `<tr><td class="p-4">${escapeHtml(formatDate(order.created_at))}</td><td class="p-4">${escapeHtml(order.room_code || "-")}</td><td class="p-4">${escapeHtml(displayGuestName(order.guest_name))}</td><td class="p-4">${money(order.total_cents, order.currency)}</td><td class="p-4 text-center"><button type="button" data-order-id="${escapeAttr(order.id)}" class="mini-card-action">Ver</button></td></tr>`).join("");
  bindOrderButtons(byId("histTableBody"));
  renderBars(byId("histLegendLocal"), Object.entries(countBy(state.orders, (order) => order.delivery_location || "Acomodacao")));
  renderBars(byId("histTopItems"), Object.entries(countBy(state.orders, (order) => statusLabel(order.status))));
  const printingSummary = state.context?.printing?.message || "Configuracao de impressao nao consultada";
  byId("histQuickStats").innerHTML = `<p>${state.orders.length} pedidos no periodo</p><p>${money(summary.revenue_cents || 0)} faturados</p><p>${escapeHtml(printingSummary)}</p>`;
}

function renderBilling() {
  const from = byId("histFrom", false)?.value || "0000-01-01";
  const to = byId("histTo", false)?.value || "9999-12-31";
  const orders = filteredOrders(currentSearchQuery()).filter((order) => {
    const date = dateKeyInHotelTimezone(order.created_at);
    return date >= from && date <= to;
  });
  const completed = orders.filter((order) => order.status === "delivered");
  const revenue = completed.reduce((total, order) => total + Number(order.total_cents || 0), 0);
  const daily = countMoneyBy(completed, (order) => dateKeyInHotelTimezone(order.created_at));
  const dateEntries = Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));
  const maxRevenue = Math.max(1, ...dateEntries.map(([, value]) => Number(value)));

  setText("histRangeLabel", `${formatShortDate(from)} a ${formatShortDate(to)}`);
  setText("histKpiRevenue", money(revenue));
  setText("histKpiOrders", completed.length);
  setText("histKpiTicket", money(completed.length ? Math.round(revenue / completed.length) : 0));
  setText("histKpiObs", orders.filter((order) => String(order.notes || "").trim()).length);
  setText("histTableMeta", `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"}`);
  setText("billingDailyMeta", `${dateEntries.length} ${dateEntries.length === 1 ? "dia" : "dias"}`);

  byId("billingDailyChart").innerHTML = dateEntries.length
    ? dateEntries.map(([date, value]) => `<div class="erp-billing-bar" title="${escapeAttr(`${formatShortDate(date)}: ${money(value)}`)}"><i style="height:${Math.max(5, Math.round((Number(value) / maxRevenue) * 100))}%"></i><small>${escapeHtml(date.slice(8, 10))}</small></div>`).join("")
    : '<div class="legacy-dashboard-empty">Sem faturamento no periodo.</div>';

  renderBars(byId("histTopItems"), Object.entries(countBy(orders, (order) => statusLabel(order.status))));
  renderBars(byId("histLegendLocal"), Object.entries(countBy(orders, (order) => (order.delivery_location || order.room_code) ? "Acomodacao" : "Outro")));
  byId("histTableBody").innerHTML = orders.length
    ? orders.map((order) => `<tr><td>${escapeHtml(formatDate(order.created_at))}</td><td>${escapeHtml(orderDisplayLabel(order))}</td><td>${escapeHtml(order.room_code || "-")}</td><td><span class="legacy-status-chip" data-status="${escapeAttr(order.status)}">${escapeHtml(statusLabel(order.status))}</span></td><td><strong>${money(order.total_cents, order.currency)}</strong></td><td><button type="button" data-order-id="${escapeAttr(order.id)}" class="mini-card-action">Ver</button></td></tr>`).join("")
    : '<tr><td colspan="6"><div class="legacy-dashboard-empty">Nenhum pedido no periodo.</div></td></tr>';
  bindOrderButtons(byId("histTableBody"));
}

function exportBillingCsv() {
  const from = byId("histFrom").value;
  const to = byId("histTo").value;
  const orders = filteredOrders(currentSearchQuery()).filter((order) => {
    const date = dateKeyInHotelTimezone(order.created_at);
    return date >= from && date <= to;
  });
  const lines = [
    ["Data e hora", "Pedido", "Acomodacao", "Status", "Total"],
    ...orders.map((order) => [formatDate(order.created_at), orderDisplayLabel(order), order.room_code || "", statusLabel(order.status), (Number(order.total_cents || 0) / 100).toFixed(2).replace(".", ",")]),
  ];
  const csv = lines.map((line) => line.map(csvCell).join(";")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
  link.download = `faturamento-${state.hotelId}-${from}-${to}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  notify("Relatorio exportado.");
}

function renderCatalog() {
  const query = normalize(currentSearchQuery());
  const sourceCategories = state.catalog?.categories || [];
  const categories = sourceCategories
    .filter((category) => state.catalogCategory === "all" || category.id === state.catalogCategory)
    .map((category) => ({ ...category, items: (category.items || []).filter((item) => !query || normalize(`${item.name} ${item.description || ""} ${item.tag || ""} ${category.name}`).includes(query)) }))
    .filter((category) => category.items.length);
  const total = categories.reduce((sum, category) => sum + category.items.length, 0);
  setText("menuAdminSummary", `${total} itens encontrados`);
  byId("catalogCategoryTabs").innerHTML = [{ id: "all", name: "Todos" }, ...sourceCategories]
    .map((category) => `<button type="button" class="erp-category-tab ${state.catalogCategory === category.id ? "active" : ""}" data-catalog-category="${escapeAttr(category.id)}">${escapeHtml(displayBusinessText(category.name, "Cardapio"))}${category.id === "all" ? "" : ` · ${(category.items || []).length}`}</button>`)
    .join("");
  byId("menuCategoryBoard").innerHTML = categories.length
    ? categories.flatMap((category) => category.items.map((item) => { const name = displayBusinessText(item.name, "Item do cardapio"); return `<button type="button" class="erp-product-card" data-edit-catalog-item="${escapeAttr(item.id)}"><span class="erp-product-image">${safeImage(item.image_url) ? `<img src="${escapeAttr(item.image_url)}" alt="${escapeAttr(name)}">` : imagePlaceholderIcon()}</span><span class="erp-product-body">${item.tag ? `<span class="erp-item-tag">${escapeHtml(displayBusinessText(item.tag))}</span>` : ""}<strong>${escapeHtml(name)}</strong><p>${escapeHtml(displayBusinessText(item.description || category.name, "Sem descricao"))}</p><span class="erp-product-footer"><b class="erp-product-price">${money(item.price_cents, item.currency)}</b><span class="erp-chip ${item.available === false ? "off" : ""}">${item.available === false ? "Indisponivel" : "Disponivel"}</span></span></span></button>`; })).join("")
    : '<div class="legacy-list-empty">Nenhum item encontrado.</div>';
}

function renderAdmin() {
  const target = byId("settingsContent");
  if (state.settingsView === "home") target.innerHTML = renderFilteredSettingsHome();
  if (state.settingsView === "operation") target.innerHTML = renderOperationSettings();
  if (state.settingsView === "rooms") target.innerHTML = renderRoomSettings();
  if (state.settingsView === "printing") target.innerHTML = renderPrintingSettings();
  if (state.settingsView === "users") target.innerHTML = renderUserSettings();
  if (state.settingsView === "account") target.innerHTML = renderAccountSettings();
  if (state.settingsView === "appearance") target.innerHTML = renderAppearanceSettings();
  if (state.settingsView === "notifications") target.innerHTML = renderNotificationSettings();
  if (state.settingsView === "version") target.innerHTML = renderApplicationVersionSettings();
  const settingsScale = byId("settingsScaleRange", false);
  settingsScale?.addEventListener("input", () => applyInterfaceScale(settingsScale.value, false));
  settingsScale?.addEventListener("change", () => {
    applyInterfaceScale(settingsScale.value, true);
    renderAdmin();
  });
  const settingsVolume = byId("settingsNotificationVolume", false);
  settingsVolume?.addEventListener("input", () => previewNotificationVolume(settingsVolume.value));
  settingsVolume?.addEventListener("change", () => {
    saveNotificationVolume(settingsVolume.value);
    renderAdmin();
  });
  const accountAvatarFile = byId("accountAvatarFile", false);
  accountAvatarFile?.addEventListener("change", () => {
    const file = accountAvatarFile.files?.[0];
    const fileName = byId("accountAvatarFileName", false);
    const saveButton = byId("accountAvatarSave", false);
    if (fileName) {
      fileName.textContent = file?.name || "";
      fileName.hidden = !file;
    }
    if (saveButton) saveButton.disabled = !file;
  });
}

function erpUserCard(user) {
  const labels = new Map(state.userPermissions.map((permission) => [permission.key, permission.label]));
  const displayName = displayUserName(user);
  const initials = String(displayName || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return `<article class="admin-user-card"><div class="erp-user-card-head"><span class="admin-user-avatar">${escapeHtml(initials)}</span><div><strong>${escapeHtml(displayName)}</strong><small>Codigo ${Number(user.user_code)}</small></div></div><div class="erp-user-permissions">${(user.permissions || []).map((key) => `<span>${escapeHtml(labels.get(key) || key)}</span>`).join("")}</div><div class="erp-user-card-actions"><span class="legacy-status-chip">${user.status === "active" ? "Ativo" : "Desativado"}</span><button type="button" class="admin-secondary-btn" data-edit-erp-user="${escapeAttr(user.id)}">Editar</button></div></article>`;
}

async function refreshUsers() {
  if (!state.hotelId) return;
  setPageBusy(true, "Atualizando equipe...");
  try {
    const payload = await listErpUsers({ hotelId: state.hotelId });
    state.users = payload.data.users || [];
    renderAdmin();
  } catch (error) {
    notify(error.message || "Nao foi possivel atualizar a equipe.");
  } finally {
    setPageBusy(false);
  }
}

function installUserModal() {
  const modal = document.createElement("div");
  modal.id = "erpUserModal";
  modal.className = "erp-user-modal hidden";
  modal.innerHTML = `<div class="erp-user-modal-card" role="dialog" aria-modal="true" aria-labelledby="erpUserModalTitle"><div class="erp-user-modal-head"><div><p class="admin-kicker">Equipe da unidade</p><h2 id="erpUserModalTitle" class="admin-title">Novo usuario</h2></div><button id="erpUserModalClose" type="button" class="erp-user-modal-close" aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button></div><form id="erpUserForm"><input id="erpUserId" type="hidden"><label>Nome<input id="erpUserName" required minlength="2" maxlength="120" autocomplete="off"></label><label>Senha <small id="erpUserPasswordHint">Minimo de 4 caracteres</small><input id="erpUserPassword" type="password" minlength="4" maxlength="300" autocomplete="new-password"></label><label>Status<select id="erpUserStatus"><option value="active">Ativo</option><option value="disabled">Desativado</option></select></label><fieldset><legend>Modulos permitidos</legend><div id="erpUserPermissionGrid" class="erp-user-permission-grid"></div></fieldset><p id="erpUserFormError" class="legacy-login-error" role="alert"></p><div class="erp-user-modal-actions"><button id="erpUserModalCancel" type="button" class="admin-secondary-btn">Cancelar</button><button type="submit" class="admin-primary-btn">Salvar usuario</button></div></form></div>`;
  document.body.append(modal);
}

function openUserModal(user = null) {
  byId("erpUserId").value = user?.id || "";
  byId("erpUserName").value = user?.display_name || "";
  byId("erpUserPassword").value = "";
  byId("erpUserPassword").required = !user;
  byId("erpUserStatus").value = user?.status || "active";
  byId("erpUserModalTitle").textContent = user ? `Usuario ${Number(user.user_code)}` : "Novo usuario";
  byId("erpUserPasswordHint").textContent = user ? "Deixe vazio para manter a senha atual" : "Minimo de 4 caracteres";
  byId("erpUserFormError").textContent = "";
  const selected = new Set(user?.permissions || ["room-service.dashboard.read", "room-service.orders.read"]);
  byId("erpUserPermissionGrid").innerHTML = state.userPermissions.map((permission) => `<label><input type="checkbox" value="${escapeAttr(permission.key)}" ${selected.has(permission.key) ? "checked" : ""}><span>${escapeHtml(permission.label)}</span></label>`).join("");
  byId("erpUserModal").classList.remove("hidden");
  byId("erpUserName").focus();
}

function closeUserModal() {
  byId("erpUserModal").classList.add("hidden");
  byId("erpUserForm").reset();
}

async function saveErpUser(event) {
  event.preventDefault();
  const userId = byId("erpUserId").value;
  const password = byId("erpUserPassword").value;
  const permissionKeys = [...byId("erpUserPermissionGrid").querySelectorAll("input:checked")].map((input) => input.value);
  byId("erpUserFormError").textContent = "";
  if (!permissionKeys.length) {
    byId("erpUserFormError").textContent = "Selecione pelo menos um modulo.";
    return;
  }
  const body = {
    hotel_id: state.hotelId,
    display_name: byId("erpUserName").value.trim(),
    status: byId("erpUserStatus").value,
    permission_keys: permissionKeys,
  };
  setPageBusy(true, "Salvando usuario...");
  try {
    if (userId) {
      await updateErpUser(userId, body);
      if (password) await resetErpUserPassword(userId, { hotel_id: state.hotelId, password });
    } else {
      await createErpUser({ ...body, password });
    }
    closeUserModal();
    await refreshUsers();
    notify(userId ? "Usuario atualizado." : "Usuario criado com codigo sequencial.");
  } catch (error) {
    byId("erpUserFormError").textContent = error.message || "Nao foi possivel salvar o usuario.";
  } finally {
    setPageBusy(false);
  }
}

function openCatalogItemModal(item = null) {
  if (!state.session?.permissions?.includes("room-service.catalog.manage")) return notify("Seu usuario possui acesso somente de leitura ao cardapio.");
  byId("catalogItemId").value = item?.id || "";
  byId("catalogItemModalTitle").textContent = item ? "Editar item" : "Novo item";
  byId("catalogItemName").value = item?.name || "";
  byId("catalogItemDescription").value = item?.description || "";
  byId("catalogItemTag").value = item?.tag || "";
  byId("catalogItemPrice").value = item ? (Number(item.price_cents || 0) / 100).toFixed(2).replace(".", ",") : "";
  byId("catalogItemSort").value = item?.sort_order || 100;
  byId("catalogItemStatus").value = item?.status || "active";
  byId("catalogItemAvailable").value = item?.available === false ? "false" : "true";
  byId("catalogItemAvailabilityLabel").value = item?.availability_label || "";
  byId("catalogItemMediaId").value = item?.media_asset_id || "";
  byId("catalogItemFormError").textContent = "";
  byId("deleteCatalogItemButton").hidden = !item;
  const categories = state.catalog?.category_options || state.catalog?.categories || [];
  byId("catalogItemCategory").innerHTML = categories.map((category) => `<option value="${escapeAttr(category.id)}">${escapeHtml(category.name)}</option>`).join("");
  if (item?.category_id) byId("catalogItemCategory").value = item.category_id;
  renderCatalogImagePicker();
  byId("catalogItemModal").classList.remove("hidden");
  byId("catalogItemName").focus();
}

function renderCatalogImagePicker() {
  const selected = byId("catalogItemMediaId").value;
  byId("catalogImagePicker").innerHTML = `<button type="button" class="erp-image-option ${selected ? "" : "selected"}" data-media-id="">${imagePlaceholderIcon()}</button>${state.media.map((asset) => `<button type="button" class="erp-image-option ${selected === asset.id ? "selected" : ""}" data-media-id="${escapeAttr(asset.id)}"><img src="${escapeAttr(asset.public_url)}" alt="${escapeAttr(asset.alt_text || "Imagem da biblioteca")}"></button>`).join("")}`;
}

async function uploadCatalogImage() {
  const file = byId("catalogMediaFile").files?.[0];
  if (!file) return notify("Selecione uma imagem para enviar.");
  setPageBusy(true, "Enviando imagem...");
  try {
    const form = new FormData();
    form.set("hotel_id", state.hotelId);
    form.set("alt_text", byId("catalogItemName").value.trim() || "Imagem de item do cardapio");
    form.set("file", file);
    const payload = await uploadErpMedia(form);
    const asset = payload.data.asset;
    state.media.unshift(asset);
    byId("catalogItemMediaId").value = asset.id;
    byId("catalogMediaFile").value = "";
    renderCatalogImagePicker();
    notify("Imagem enviada e selecionada.");
  } catch (error) {
    byId("catalogItemFormError").textContent = error.message || "Nao foi possivel enviar a imagem.";
  } finally {
    setPageBusy(false);
  }
}

async function saveCatalogItem(event) {
  event.preventDefault();
  const itemId = byId("catalogItemId").value;
  const priceCents = parseMoneyToCents(byId("catalogItemPrice").value);
  byId("catalogItemFormError").textContent = "";
  if (priceCents == null) {
    byId("catalogItemFormError").textContent = "Informe um preco valido.";
    return;
  }
  const body = {
    hotel_id: state.hotelId,
    category_id: byId("catalogItemCategory").value,
    name: byId("catalogItemName").value.trim(),
    description: byId("catalogItemDescription").value.trim(),
    tag: byId("catalogItemTag").value.trim(),
    price_cents: priceCents,
    currency: state.context?.hotel?.currency || "BRL",
    sort_order: Number(byId("catalogItemSort").value || 100),
    status: byId("catalogItemStatus").value,
    is_available: byId("catalogItemAvailable").value === "true",
    availability_label: byId("catalogItemAvailabilityLabel").value.trim(),
    media_asset_id: byId("catalogItemMediaId").value || null,
  };
  setPageBusy(true, "Salvando cardapio...");
  try {
    if (itemId) await updateCatalogItem(itemId, body);
    else await createCatalogItem(body);
    byId("catalogItemModal").classList.add("hidden");
    await refreshCatalogData();
    notify(itemId ? "Item atualizado." : "Item criado.");
  } catch (error) {
    byId("catalogItemFormError").textContent = error.message || "Nao foi possivel salvar o item.";
  } finally {
    setPageBusy(false);
  }
}

async function removeCatalogItem() {
  const itemId = byId("catalogItemId").value;
  const itemName = byId("catalogItemName").value.trim();
  if (!itemId) return;
  if (!window.confirm(`Excluir definitivamente o item "${itemName}" do cardapio?`)) return;
  setPageBusy(true, "Excluindo item...");
  try {
    await deleteCatalogItem(itemId, { hotel_id: state.hotelId });
    byId("catalogItemModal").classList.add("hidden");
    await refreshCatalogData();
    notify("Item excluido do cardapio.");
  } catch (error) {
    byId("catalogItemFormError").textContent = error.message || "Nao foi possivel excluir o item.";
  } finally {
    setPageBusy(false);
  }
}

function openCategoryModal() {
  if (!state.session?.permissions?.includes("room-service.catalog.manage")) return notify("Seu usuario possui acesso somente de leitura ao cardapio.");
  byId("catalogCategoryForm").reset();
  byId("catalogCategorySort").value = 100;
  byId("catalogCategoryFormError").textContent = "";
  byId("catalogCategoryModal").classList.remove("hidden");
  byId("catalogCategoryName").focus();
}

async function saveCatalogCategory(event) {
  event.preventDefault();
  setPageBusy(true, "Criando categoria...");
  try {
    await createCatalogCategory({
      hotel_id: state.hotelId,
      name: byId("catalogCategoryName").value.trim(),
      description: byId("catalogCategoryDescription").value.trim(),
      sort_order: Number(byId("catalogCategorySort").value || 100),
    });
    byId("catalogCategoryModal").classList.add("hidden");
    await refreshCatalogData();
    notify("Categoria criada.");
  } catch (error) {
    byId("catalogCategoryFormError").textContent = error.message || "Nao foi possivel criar a categoria.";
  } finally {
    setPageBusy(false);
  }
}

async function refreshCatalogData() {
  const [catalog, media] = await Promise.all([getCatalog({ hotelId: state.hotelId }), listErpMedia({ hotelId: state.hotelId })]);
  state.catalog = catalog.data;
  state.media = media.data.assets || [];
  if (state.catalogCategory !== "all" && !state.catalog.categories.some((category) => category.id === state.catalogCategory)) state.catalogCategory = "all";
  renderCatalog();
  renderMenu();
}

function openRoomModal(room = null) {
  byId("roomId").value = room?.id || "";
  byId("roomModalTitle").textContent = room ? "Editar acomodacao" : "Nova acomodacao";
  byId("roomCode").value = room?.code || "";
  byId("roomLabel").value = room?.label || "";
  byId("roomType").value = room?.room_type || "";
  byId("roomSort").value = room?.sort_order || 100;
  byId("roomStatus").value = room?.status || "active";
  byId("roomFormError").textContent = "";
  byId("roomModal").classList.remove("hidden");
  byId("roomCode").focus();
}

async function saveRoom(event) {
  event.preventDefault();
  const roomId = byId("roomId").value;
  const body = {
    hotel_id: state.hotelId,
    code: byId("roomCode").value.trim(),
    label: byId("roomLabel").value.trim(),
    room_type: byId("roomType").value.trim(),
    sort_order: Number(byId("roomSort").value || 100),
    status: byId("roomStatus").value,
  };
  setPageBusy(true, "Salvando acomodacao...");
  try {
    if (roomId) await updateRoom(roomId, body);
    else await createRoom(body);
    const payload = await listRooms({ hotelId: state.hotelId });
    state.rooms = payload.data.rooms || [];
    state.operations.rooms = state.rooms;
    if (state.context) state.context.rooms = state.rooms.filter((room) => room.status === "active");
    byId("roomModal").classList.add("hidden");
    renderAdmin();
    renderPdvRoomOptions();
    notify(roomId ? "Acomodacao atualizada." : "Acomodacao criada.");
  } catch (error) {
    byId("roomFormError").textContent = error.message || "Nao foi possivel salvar a acomodacao.";
  } finally {
    setPageBusy(false);
  }
}

async function changeOperationMode(mode) {
  setPageBusy(true, "Atualizando funcionamento...");
  try {
    const payload = await setOperationMode({ hotel_id: state.hotelId, mode });
    state.operations.operation = payload.data.operation;
    state.context.operation = payload.data.operation;
    updateHeaderState();
    renderDashboard();
    renderAdmin();
    notify(mode === "automatic" ? "Controle automatico ativado." : mode === "forced_open" ? "Room Service aberto manualmente." : "Room Service fechado manualmente.");
  } catch (error) {
    notify(error.message || "Nao foi possivel alterar o funcionamento.");
  } finally {
    setPageBusy(false);
  }
}

async function saveOperationSchedule(form) {
  const sameEveryDay = form.dataset.scheduleLayout === "same";
  const days = Array.from({ length: 7 }, (_, day) => sameEveryDay ? {
    day_of_week: day,
    is_closed: false,
    opens_at: form.elements.common_opens.value,
    closes_at: form.elements.common_closes.value,
  } : {
    day_of_week: day,
    is_closed: form.elements[`closed_${day}`].checked,
    opens_at: form.elements[`opens_${day}`].value,
    closes_at: form.elements[`closes_${day}`].value,
  });
  setPageBusy(true, "Salvando horario semanal...");
  try {
    await updateSchedule({ hotel_id: state.hotelId, days });
    const payload = await getOperations({ hotelId: state.hotelId });
    state.operations = payload.data;
    state.context.operation = payload.data.operation;
    state.context.service_hours = payload.data.operation.service_hours;
    state.scheduleViewMode = sameEveryDay ? "same" : "custom";
    updateHeaderState();
    renderDashboard();
    renderAdmin();
    notify("Horario semanal atualizado.");
  } catch (error) {
    notify(error.message || "Nao foi possivel salvar os horarios.");
  } finally {
    setPageBusy(false);
  }
}

async function saveOrderPreferences(form) {
  setPageBusy(true, "Salvando preferencias...");
  try {
    const payload = await updateOrderPreferences({
      hotel_id: state.hotelId,
      order_scheduling_enabled: form.elements.order_scheduling_enabled.checked,
      order_notes_enabled: form.elements.order_notes_enabled.checked,
    });
    const preferences = payload.data.preferences;
    state.operations.operation.preferences = preferences;
    state.context.operation.preferences = preferences;
    renderAdmin();
    notify("Preferencias de pedidos atualizadas.");
  } catch (error) {
    notify(error.message || "Nao foi possivel salvar as preferencias.");
  } finally {
    setPageBusy(false);
  }
}

async function refreshPrinting() {
  setPageBusy(true, "Atualizando impressao...");
  try {
    state.printing = (await getPrinting({ hotelId: state.hotelId })).data;
    if (state.printing.can_create_enrollment === false) state.printerEnrollment = null;
    renderAdmin();
  } catch (error) {
    notify(error.message || "Nao foi possivel atualizar a impressao.");
  } finally {
    setPageBusy(false);
  }
}

async function savePrintingSettings(form) {
  setPageBusy(true, "Salvando impressao...");
  try {
    await updatePrinting({ hotel_id: state.hotelId, enabled: form.elements.enabled.checked, template_id: form.elements.template_id.value });
    await refreshPrinting();
    notify("Configuracao de impressao atualizada.");
  } catch (error) {
    notify(error.message || "Nao foi possivel salvar a impressao.");
  } finally {
    setPageBusy(false);
  }
}

async function generatePrinterEnrollment() {
  setPageBusy(true, "Gerando codigo...");
  try {
    state.printerEnrollment = (await createPrinterEnrollment({ hotel_id: state.hotelId })).data;
    renderAdmin();
    notify("Codigo de conexao criado.");
  } catch (error) {
    notify(error.message || "Nao foi possivel gerar o codigo.");
  } finally {
    setPageBusy(false);
  }
}

async function copyPrinterEnrollmentCode() {
  const code = state.printerEnrollment?.activation_code;
  if (!code) return notify("Gere um codigo de conexao primeiro.");
  try {
    await copyTextToClipboard(code);
    notify("Codigo de conexao copiado.");
  } catch {
    notify("Nao foi possivel copiar o codigo.");
  }
}

async function refreshLocalPrintAgentStatus() {
  if (!desktop.isElectron) return;
  try {
    state.localPrintAgent = await desktop.printAgentStatus();
  } catch {
    state.localPrintAgent = { running: false, status: "offline", message: "Nao foi possivel consultar o agente local." };
  }
  if (state.settingsView === "printing") renderAdmin();
}

async function restartLocalPrintAgent() {
  if (!desktop.isElectron) return;
  const button = byId("restartLocalPrintAgentButton", false);
  if (button) button.disabled = true;
  try {
    const result = await desktop.restartPrintAgent();
    if (!result?.ok) {
      notify(result?.action === "not_installed" ? "Fioreze Suite nao esta instalado neste computador." : "Nao foi possivel iniciar o agente de impressao.");
      return;
    }
    notify(result.action === "started" ? "Servidor de impressao iniciado." : "Reinicio do servidor solicitado.", { progress: true });
    window.setTimeout(() => void refreshLocalPrintAgentStatus(), 2500);
  } catch {
    notify("Nao foi possivel reiniciar o servidor de impressao.");
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

async function changePrinterDeviceStatus(deviceId, status) {
  setPageBusy(true, "Atualizando computador...");
  try {
    await updatePrinterDevice(deviceId, { hotel_id: state.hotelId, status });
    await refreshPrinting();
    notify(status === "revoked" ? "Computador revogado." : status === "paused" ? "Computador pausado." : "Computador reativado.");
  } catch (error) {
    notify(error.message || "Nao foi possivel atualizar o computador.");
  } finally {
    setPageBusy(false);
  }
}

async function removePrinterDevice(deviceId) {
  if (!window.confirm("Excluir este computador revogado do historico de dispositivos?")) return;
  setPageBusy(true, "Excluindo computador...");
  try {
    await deletePrinterDevice(deviceId, { hotel_id: state.hotelId });
    await refreshPrinting();
    notify("Computador revogado excluido.");
  } catch (error) {
    notify(error.message || "Nao foi possivel excluir o computador.");
  } finally {
    setPageBusy(false);
  }
}
async function saveOwnAvatar(form) {
  const file = form.querySelector("input[type=file]").files?.[0];
  if (!file) return;
  setPageBusy(true, "Atualizando foto de perfil...");
  try {
    const payload = new FormData();
    payload.set("file", file);
    const response = await uploadOwnAvatar(payload);
    state.session.user.avatar = response.data.asset.public_url;
    setImage(byId("topStaffAvatar", false), state.session.user.avatar, displayUserName(state.session.user));
    renderAdmin();
    notify("Foto de perfil atualizada.");
  } catch (error) {
    notify(error.message || "Nao foi possivel atualizar a foto.");
  } finally {
    setPageBusy(false);
  }
}

async function removeOwnAvatar() {
  setPageBusy(true, "Removendo foto de perfil...");
  try {
    await deleteOwnAvatar();
    state.session.user.avatar = null;
    setImage(byId("topStaffAvatar", false), "", displayUserName(state.session.user));
    renderAdmin();
    notify("Foto de perfil removida.");
  } catch (error) {
    notify(error.message || "Nao foi possivel remover a foto.");
  } finally {
    setPageBusy(false);
  }
}

async function saveOwnPassword(form) {
  const data = new FormData(form);
  const next = String(data.get("new_password") || "");
  if (next !== String(data.get("confirm_password") || "")) return notify("A confirmacao da nova senha nao confere.");
  setPageBusy(true, "Atualizando senha...");
  try {
    await changeOwnErpPassword({ current_password: String(data.get("current_password") || ""), new_password: next });
    form.reset();
    notify("Senha atualizada com seguranca.");
  } catch (error) {
    notify(error.message || "Nao foi possivel atualizar a senha.");
  } finally {
    setPageBusy(false);
  }
}

function parseMoneyToCents(value) {
  const normalized = String(value || "").trim().replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function installStoreQuickPanel() {
  const panel = document.createElement("div");
  panel.id = "storeQuickPanel";
  panel.className = "erp-store-quick hidden";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Funcionamento do Room Service");
  panel.addEventListener("click", (event) => {
    const mode = event.target.closest("[data-quick-operation-mode]");
    if (mode) changeOperationMode(mode.dataset.quickOperationMode);
    if (event.target.closest("[data-open-operation-settings]")) {
      panel.classList.add("hidden");
      openSettingsView("operation");
    }
  });
  document.body.append(panel);
}

function toggleStoreQuickPanel(event) {
  event?.stopPropagation();
  const panel = byId("storeQuickPanel", false);
  if (!panel) return;
  renderStoreQuickPanel();
  panel.classList.toggle("hidden");
  byId("accountPopover", false)?.classList.add("hidden");
  byId("notifDropdown", false)?.classList.add("hidden");
}

function renderStoreQuickPanel() {
  const panel = byId("storeQuickPanel", false);
  if (!panel || !state.context) return;
  const service = currentServiceState();
  const canManage = state.session?.permissions?.includes("room-service.settings.manage");
  panel.innerHTML = `<div class="erp-store-quick-head"><span class="erp-operation-dot ${service.open ? "open" : ""}"></span><div><strong>Room Service ${service.open ? "aberto" : "fechado"}</strong><small>${service.mode === "automatic" ? "Horario automatico" : "Controle manual"}</small></div></div>${canManage ? `<div class="erp-store-quick-actions"><button type="button" class="${service.mode === "automatic" ? "active" : ""}" data-quick-operation-mode="automatic">Automatico</button><button type="button" class="${service.mode === "forced_open" ? "active" : ""}" data-quick-operation-mode="forced_open">Abrir agora</button><button type="button" class="${service.mode === "forced_closed" ? "active" : ""}" data-quick-operation-mode="forced_closed">Fechar agora</button></div><button type="button" class="erp-store-settings-link" data-open-operation-settings>Editar horarios</button>` : '<p class="erp-store-quick-note">Somente usuarios autorizados podem alterar o funcionamento.</p>'}`;
}

function applyInterfaceScale(value, persist = false) {
  const scale = clampNumber(value, 85, 115, 100);
  const factor = scale / 100;
  const shell = byId("appShell", false);
  const viewport = buildInterfaceViewport(factor, { isElectron: desktop.isElectron });
  document.documentElement.style.setProperty("--interface-scale", String(factor));
  document.documentElement.style.setProperty("--interface-inverse", String(1 / factor));
  document.documentElement.style.setProperty("--interface-width", viewport.width);
  document.documentElement.style.setProperty("--interface-height", viewport.height);
  if (shell && globalThis.CSS?.supports?.("zoom", "1")) {
    shell.style.zoom = String(factor);
    shell.style.setProperty("transform", "none", "important");
    shell.style.setProperty("width", viewport.width, "important");
    shell.style.setProperty("height", viewport.height, "important");
  } else if (shell) {
    shell.style.removeProperty("zoom");
    shell.style.setProperty("transform", `scale(${factor})`, "important");
    shell.style.setProperty("width", viewport.width, "important");
    shell.style.setProperty("height", viewport.height, "important");
  }
  state.interfaceScale = scale;
  const headerRange = byId("interfaceScaleRange", false);
  const headerLabel = byId("interfaceScaleLabel", false);
  const settingsRange = byId("settingsScaleRange", false);
  if (headerRange) headerRange.value = String(scale);
  if (settingsRange) settingsRange.value = String(scale);
  if (headerLabel) headerLabel.textContent = `${scale}%`;
  if (persist) localStorage.setItem("fioreze-erp-interface-scale", String(scale));
}

function updateNotificationSoundUI() {
  const range = byId("notificationVolumeRange", false);
  const label = byId("notificationVolumeLabel", false);
  const button = byId("notificationSoundButton", false);
  const icon = byId("notificationSoundIcon", false);
  if (range) range.value = String(state.notificationVolume);
  if (label) label.textContent = `${state.notificationVolume}%`;
  button?.classList.toggle("is-muted", !state.notificationSoundEnabled);
  button?.setAttribute("aria-pressed", String(state.notificationSoundEnabled));
  if (icon) icon.innerHTML = state.notificationSoundEnabled
    ? '<path stroke-width="2" d="M11 5L6 9H3v6h3l5 4V5zM15 9a4 4 0 010 6M18 6a8 8 0 010 12"/>'
    : '<path stroke-width="2" d="M11 5L6 9H3v6h3l5 4V5zM17 9l4 4M21 9l-4 4"/>';
}

function toggleNotificationSound() {
  state.notificationSoundEnabled = !state.notificationSoundEnabled;
  localStorage.setItem("fioreze-erp-notification-sound", String(state.notificationSoundEnabled));
  updateNotificationSoundUI();
  if (state.notificationSoundEnabled) playNotificationSound(true);
}

function previewNotificationVolume(value) {
  state.notificationVolume = clampNumber(value, 0, 100, 70);
  if (state.notificationVolume > 0) state.notificationSoundEnabled = true;
  updateNotificationSoundUI();
  const settingsLabel = byId("settingsNotificationVolume", false)?.closest("label")?.querySelector("b");
  if (settingsLabel) settingsLabel.textContent = `${state.notificationVolume}%`;
}

function saveNotificationVolume(value) {
  previewNotificationVolume(value);
  localStorage.setItem("fioreze-erp-notification-volume", String(state.notificationVolume));
  localStorage.setItem("fioreze-erp-notification-sound", String(state.notificationSoundEnabled));
  playNotificationSound(true);
}

function unlockNotificationAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  notificationAudioContext ||= new AudioContext();
  if (notificationAudioContext.state === "suspended") notificationAudioContext.resume().catch(() => {});
}

function playNotificationSound(force = false) {
  if ((!state.notificationSoundEnabled && !force) || state.notificationVolume <= 0) return;
  unlockNotificationAudio();
  if (!notificationAudioContext) return;
  const now = notificationAudioContext.currentTime;
  const gain = notificationAudioContext.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, state.notificationVolume / 180), now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  gain.connect(notificationAudioContext.destination);
  [659.25, 783.99].forEach((frequency, index) => {
    const oscillator = notificationAudioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(now + index * 0.12);
    oscillator.stop(now + 0.42 + index * 0.12);
  });
}

function startOrderPolling() {
  stopOrderPolling();
  if (!state.session?.permissions?.includes("room-service.orders.read")) return;
  state.orderPollTimer = window.setInterval(pollNewOrders, 15000);
}

function stopOrderPolling() {
  if (state.orderPollTimer) window.clearInterval(state.orderPollTimer);
  state.orderPollTimer = null;
}

async function pollNewOrders() {
  if (document.hidden || !state.session || !state.hotelId) return;
  try {
    const payload = await listOrders({ hotelId: state.hotelId });
    const nextOrders = payload.data.orders || [];
    const newOrders = nextOrders.filter((order) => !state.knownOrderIds.has(order.id));
    state.orders = nextOrders;
    state.knownOrderIds = new Set(nextOrders.map((order) => order.id));
    if (!newOrders.length) return;
    state.notifications.unshift(...newOrders.map((order) => ({
      id: crypto.randomUUID(),
      orderId: order.id,
      title: "Novo pedido",
      detail: `${orderDisplayLabel(order)} - ${order.room_code || "Sem acomodacao"}`,
      createdAt: order.created_at,
    })));
    state.notifications = state.notifications.slice(0, 20);
    renderNotifications();
    playNotificationSound();
    notify(`${newOrders.length} ${newOrders.length === 1 ? "novo pedido recebido" : "novos pedidos recebidos"}.`, { duration: 5000, progress: true });
    const [dashboard, billing] = await Promise.all([getDashboard({ hotelId: state.hotelId }), getBilling({ hotelId: state.hotelId })]);
    state.dashboard = dashboard.data;
    state.billing = billing.data;
    renderActiveRoute();
  } catch (error) {
    if (error.status === 401) stopOrderPolling();
  }
}

function renderNotifications() {
  const list = byId("notifList", false);
  if (!list) return;
  list.innerHTML = state.notifications.length
    ? state.notifications.map((notification) => `<button type="button" class="erp-notification-row" data-notification-order="${escapeAttr(notification.orderId)}"><span class="erp-notification-dot"></span><span><strong>${escapeHtml(notification.title)}</strong><small>${escapeHtml(notification.detail)}</small></span><time>${escapeHtml(formatDate(notification.createdAt, { hour: "2-digit", minute: "2-digit" }))}</time></button>`).join("")
    : '<div class="legacy-list-empty">Nenhuma notificacao.</div>';
  updateNotificationBadge(state.notifications.length);
}

function clearNotifications() {
  state.notifications = [];
  renderNotifications();
}

function renderTopSearchResults() {
  const input = byId("topSearchInput", false);
  const target = byId("topSearchResults", false);
  if (!input || !target || !state.session) return;
  if (getErpSearchContext(state.route).mode !== "navigation") return closeTopSearch();
  const query = normalize(input.value);
  const suggestions = buildSearchSuggestions().filter((entry) => !query || normalize(`${entry.label} ${entry.meta}`).includes(query)).slice(0, 7);
  const groups = suggestions.reduce((result, entry) => {
    const group = searchSuggestionGroup(entry.kind);
    if (!result.has(group)) result.set(group, []);
    result.get(group).push(entry);
    return result;
  }, new Map());
  let resultIndex = 0;
  target.innerHTML = suggestions.length
    ? [...groups.entries()].map(([group, entries]) => `<section class="top-search-group"><p>${escapeHtml(group)}</p>${entries.map((entry) => `<button type="button" class="top-search-item ${resultIndex++ === 0 ? "active" : ""}" data-search-kind="${escapeAttr(entry.kind)}" data-search-value="${escapeAttr(entry.value)}">${searchSuggestionIcon(entry.kind)}<span><span class="top-search-title">${escapeHtml(entry.label)}</span><span class="top-search-meta">${escapeHtml(entry.meta)}</span></span></button>`).join("")}</section>`).join("")
    : '<p class="erp-search-empty">Nenhum resultado encontrado.</p>';
  target.classList.remove("hidden");
  document.body.classList.add("erp-search-open");
}

function searchSuggestionGroup(kind) {
  if (kind === "order") return "Pedidos";
  if (kind === "catalog") return "Cardápio";
  return "Navegação";
}

function searchSuggestionIcon(kind) {
  if (kind === "order") return iconMarkup("bookmark");
  if (kind === "catalog") return iconMarkup("list");
  return iconMarkup("chevron-right");
}

function feedbackIcon() {
  return iconMarkup("triangle-alert");
}

function feedbackImageIcon() {
  return iconMarkup("image");
}

function buildSearchSuggestions() {
  const routeLabels = {
    dashboard: ["Dashboard", "Visao geral da operacao"],
    vendas: ["Novo pedido", "Abrir pedido direto"],
    hist: ["Pedidos", "Consultar historico"],
    hospedes: ["Acomodacoes", "Consultar quartos"],
    faturamento: ["Faturamento", "Consultar resultados"],
    cardapio: ["Cardapio", "Editar produtos e categorias"],
    admin: ["Configuracoes", "Ajustes do ERP"],
  };
  const routes = Object.entries(routeLabels).filter(([route]) => !byId(ROUTES[route].button).classList.contains("hidden")).map(([route, [label, meta]]) => ({ kind: "route", value: route, label, meta }));
  const orders = state.orders.slice(0, 20).map((order) => ({ kind: "order", value: order.id, label: order.room_code ? `Pedido da acomodação ${order.room_code}` : "Pedido sem acomodação", meta: `${statusLabel(order.status)} · ${formatDate(order.created_at, { hour: "2-digit", minute: "2-digit" })}` }));
  const items = allCatalogItems().slice(0, 30).map((item) => ({ kind: "catalog", value: item.id, label: displayBusinessText(item.name, "Item do cardapio"), meta: displayBusinessText(item.tag, "Item do cardapio") }));
  return [...routes, ...orders, ...items];
}

function handleTopSearchClick(event) {
  const item = event.target.closest("[data-search-kind]");
  if (item) runSearchSuggestion(item.dataset.searchKind, item.dataset.searchValue);
}

function handleTopSearchInput() {
  saveCurrentSearchQuery();
  if (getErpSearchContext(state.route).mode === "navigation") {
    renderTopSearchResults();
    return;
  }
  if (state.route === "admin" && state.settingsView !== "home") state.settingsView = "home";
  closeTopSearch();
  renderActiveRoute();
}

function handleTopSearchFocus() {
  if (getErpSearchContext(state.route).mode === "navigation") renderTopSearchResults();
  else closeTopSearch();
}

function handleTopSearchKeydown(event) {
  if (event.key === "Escape") {
    if (getErpSearchContext(state.route).mode === "navigation") return closeTopSearch();
    if (!event.currentTarget.value) return;
    event.preventDefault();
    event.currentTarget.value = "";
    saveCurrentSearchQuery();
    renderActiveRoute();
    return;
  }
  if (getErpSearchContext(state.route).mode !== "navigation") return;
  if (event.key !== "Enter") return;
  event.preventDefault();
  const first = byId("topSearchResults", false)?.querySelector("[data-search-kind]");
  if (first) runSearchSuggestion(first.dataset.searchKind, first.dataset.searchValue);
}

function runSearchSuggestion(kind, value) {
  closeTopSearch();
  byId("topSearchInput").value = "";
  state.searchQueries.dashboard = "";
  if (kind === "route") switchTab(value);
  if (kind === "order") openOrder(value);
  if (kind === "catalog") {
    switchTab("cardapio");
    openCatalogItemModal(allCatalogItems().find((item) => item.id === value));
  }
}

function closeTopSearch() {
  byId("topSearchResults", false)?.classList.add("hidden");
  document.body.classList.remove("erp-search-open");
}

function currentSearchQuery() {
  return byId("topSearchInput", false)?.value || "";
}

function saveCurrentSearchQuery() {
  if (!state.route) return;
  state.searchQueries[state.route] = currentSearchQuery();
}

function syncContextualSearch(route = state.route) {
  const input = byId("topSearchInput", false);
  if (!input) return;
  const context = getErpSearchContext(route);
  input.placeholder = context.placeholder;
  input.setAttribute("aria-label", context.placeholder);
  input.value = state.searchQueries[route] || "";
  byId("topSearchWrap", false)?.setAttribute("data-search-mode", context.mode);
  if (context.mode !== "navigation") closeTopSearch();
}

function renderFilteredSettingsHome() {
  const query = normalize(currentSearchQuery());
  const markup = renderSettingsHome();
  if (!query) return markup;
  const template = document.createElement("template");
  template.innerHTML = markup;
  const grid = template.content.querySelector(".erp-settings-grid");
  const cards = [...(grid?.querySelectorAll("[data-settings-view]") || [])];
  for (const card of cards) {
    if (!normalize(card.textContent).includes(query)) card.remove();
  }
  if (grid && !grid.children.length) grid.innerHTML = '<div class="legacy-list-empty">Nenhuma configuração encontrada.</div>';
  return template.innerHTML;
}

function updateNotificationBadge(count) {
  const badge = document.querySelector(".notif-badge");
  if (!badge) return;
  const visible = Number(count) > 0;
  badge.hidden = !visible;
  badge.classList.toggle("hidden", !visible);
  badge.textContent = visible ? String(count) : "";
}

function updateHeaderState() {
  const service = currentServiceState();
  const button = byId("hdrStoreButton");
  button.classList.remove("hidden");
  button.classList.toggle("store-open", service.open);
  button.classList.toggle("store-closed", !service.open);
  setText("hdrStoreStatus", service.label);
  setText("hdrStoreMode", service.mode === "automatic" ? "Automatico" : "Manual");
  renderStoreQuickPanel();
}

function currentServiceState() {
  const operation = state.operations?.operation || state.context?.operation;
  if (!operation) return { label: "SEM HORARIO", open: false, mode: "automatic" };
  return { label: operation.open ? "ABERTO" : "FECHADO", open: Boolean(operation.open), mode: operation.mode || "automatic" };
}

function setLoginBusy(busy, message = "Validando usuario e senha") {
  byId("btnLogin").disabled = busy;
  document.querySelector(".login-card")?.classList.toggle("is-loading", busy);
  byId("loginLoadingScreen").classList.toggle("hidden", !busy);
  setText("loginLoadingText", message);
}

function setPageBusy(busy, message = "Sincronizando...") {
  setText("loadingText", message);
  byId("loadingOverlay").classList.toggle("hidden", !busy);
}

function showLogin() {
  stopOrderPolling();
  document.body.classList.remove("erp-authenticated");
  document.body.classList.add("erp-login");
  byId("loginOverlay").classList.remove("hidden");
  byId("accountPopover").classList.add("hidden");
}

function showApplication() {
  document.body.classList.remove("erp-login");
  document.body.classList.add("erp-authenticated");
  byId("loginOverlay").classList.add("hidden");
  byId("appShell").style.display = "flex";
}

function bindOrderButtons(container) {
  container.querySelectorAll("[data-order-id]").forEach((button) => button.addEventListener("click", () => openOrder(button.dataset.orderId)));
}

function filteredOrders(query) {
  const normalized = normalize(query || "");
  return state.orders.filter((order) => !normalized || normalize([
    order.public_id,
    order.display_number,
    orderDisplayLabel(order),
    order.guest_name,
    order.room_code,
    order.delivery_location,
    order.status,
    statusLabel(order.status),
    money(order.total_cents, order.currency),
  ].filter(Boolean).join(" ")).includes(normalized));
}

function renderBars(target, entries) {
  const max = Math.max(1, ...entries.map((entry) => Number(entry[1] || 0)));
  target.innerHTML = entries.length ? entries.map(([label, value]) => `<div class="dash-bar-row"><span>${escapeHtml(label)}</span><div><i style="width:${Math.max(5, Math.round((Number(value) / max) * 100))}%"></i></div><b>${Number(value)}</b></div>`).join("") : '<div class="legacy-dashboard-empty">Sem dados.</div>';
}

function countBy(rows, selector) {
  return rows.reduce((result, row) => {
    const key = selector(row) || "Outro";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function countMoneyBy(rows, selector) {
  return rows.reduce((result, row) => {
    const key = selector(row) || "Outro";
    result[key] = (result[key] || 0) + Number(row.total_cents || 0);
    return result;
  }, {});
}

function peakHour(orders) {
  return Object.entries(countBy(orders, (order) => String(order.created_at || "").slice(11, 13) ? `${String(order.created_at).slice(11, 13)}h` : "" )).sort((a, b) => b[1] - a[1])[0];
}

function allCatalogItems() {
  return (state.catalog?.categories || []).flatMap((category) => category.items || []);
}

function notify(message, { duration = 4200, progress = false } = {}) {
  const toast = document.createElement("div");
  toast.className = `legacy-toast${progress ? " has-progress" : ""}`;
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(text);
  if (progress) {
    const bar = document.createElement("i");
    bar.style.setProperty("--toast-duration", `${duration}ms`);
    toast.append(bar);
  }
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), duration);
}

function byId(id, required = true) {
  const element = document.getElementById(id);
  if (!element && required) throw new Error(`Elemento obrigatorio ausente: ${id}`);
  return element;
}

function setText(id, value) {
  const element = byId(id, false);
  if (element) element.textContent = String(value ?? "");
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function clampNumber(value, minimum, maximum, fallback) {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
}

function displayUserName(user = {}) {
  const cleaned = String(user.display_name || "")
    .replace(/\b(demo|dev|desenvolvimento)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || (state.session?.erp_master ? "Administrador Geral Fioreze" : "Usuario");
}

function displayHotelName(hotel = {}) {
  const raw = hotel.name || hotel.short_name || hotel.hotel_id || "ERP Room Service Fioreze";
  const cleaned = String(raw)
    .replace(/\b(demo|desenvolvimento)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || "Unidade Fioreze";
}

function displayBusinessText(value, fallback = "") {
  const cleaned = String(value || "")
    .replace(/\b(demo|dev|desenvolvimento|ficticio|ficticia)\b/gi, "")
    .replace(/\b(?:somente\s+)?para teste local\b/gi, "")
    .replace(/\busado em teste de disponibilidade\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, "")
    .trim();
  return cleaned || fallback;
}

function displayGuestName(value, fallback = "Hóspede não informado") {
  const cleaned = displayBusinessText(value);
  const letters = cleaned.replace(/[^\p{L}]/gu, "");
  return letters.length >= 2 ? cleaned : fallback;
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateKeyInHotelTimezone(value) {
  if (!value) return "";
  const timezone = state.context?.hotel?.timezone || "America/Sao_Paulo";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  } catch {
    return String(value).slice(0, 10);
  }
}

function formatDashboardDate(value) {
  if (!value) return "Visao operacional do dia";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(year, month - 1, day));
}

function formatShortDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function inferScheduleViewMode(hours) {
  const primary = Array.from({ length: 7 }, (_, day) => hours.find((entry) => Number(entry.day_of_week) === day && Number(entry.sort_order || 0) === 0) || hours.find((entry) => Number(entry.day_of_week) === day));
  if (primary.some((entry) => !entry || entry.is_closed)) return "custom";
  return primary.every((entry) => entry.opens_at === primary[0].opens_at && entry.closes_at === primary[0].closes_at) ? "same" : "custom";
}

function money(cents, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(Number(cents || 0) / 100);
}

function formatDate(value, options = {}) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: options.hour ? undefined : "short", timeStyle: options.hour ? undefined : "short", ...options }).format(new Date(value));
}

function formatOrderDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  const datePart = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .format(date)
    .replaceAll(".", "");
  const timePart = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${datePart} · ${timePart}`;
}

function orderDisplayLabel(order) {
  const displayNumber = Number(order?.display_number || 0);
  if (displayNumber > 0) return `Pedido #${displayNumber}`;
  const legacyNumber = String(order?.public_id || "").match(/(?:^|[-_])(\d{1,8})$/)?.[1];
  return legacyNumber ? `Pedido #${legacyNumber}` : "Pedido";
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
}

function orderStatusActionLabel(status) {
  if (status === "printed") return "Marcar como impresso";
  if (status === "delivered") return "Marcar como entregue";
  return `Atualizar para ${statusLabel(status)}`;
}

function originLabel(origin) {
  return origin === "admin_pdv" ? "Recepcao" : origin === "public" || origin === "portal" || origin === "web" ? "Hospedes / site" : origin || "Outro";
}

function safeImage(value) {
  const url = String(value || "");
  return url.startsWith("/media/") || url.startsWith("/assets/") || url.startsWith("/api/v1/admin/") ? url : "";
}

function setImage(image, source, alt) {
  if (!image) return;
  if (source) {
    image.src = source;
    image.hidden = false;
  } else {
    image.removeAttribute("src");
    image.hidden = true;
  }
  image.alt = alt;
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function timeToMinute(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function categoryIcon() {
  return iconMarkup("list", "w-5 h-5");
}

function dashboardIcon(type) {
  const icons = {
    orders: "clipboard-list",
    revenue: "circle-dollar-sign",
    ticket: "ticket",
    activity: "activity",
    notes: "notebook-text",
    calendar: "calendar-days",
    refresh: "refresh-cw",
    search: "search",
  };
  return iconMarkup(icons[type] || icons.orders);
}

function settingsIcon(type) {
  const icons = {
    clock: "clock-3",
    rooms: "bed-double",
    users: "users",
    account: "user-round",
    palette: "palette",
    bell: "bell",
    printer: "printer",
    version: "history",
    desktop: "monitor",
    suite: "package",
    refresh: "refresh-cw",
    copy: "copy",
    chevron: "chevron-right",
    back: "arrow-left",
  };
  return iconMarkup(icons[type] || icons.chevron);
}

function imagePlaceholderIcon() {
  return iconMarkup("image");
}

function plusIcon() {
  return iconMarkup("plus", "w-3 h-3");
}

function cartIcon() {
  return iconMarkup("shopping-cart", "w-4 h-4");
}

function clipboardIcon() {
  return iconMarkup("clipboard-list");
}

function closeIcon() {
  return iconMarkup("x");
}

function printIcon() {
  return iconMarkup("printer");
}

function trashIcon() {
  return iconMarkup("trash-2", "w-4 h-4");
}

function checkIcon() {
  return iconMarkup("check", "w-4 h-4");
}
