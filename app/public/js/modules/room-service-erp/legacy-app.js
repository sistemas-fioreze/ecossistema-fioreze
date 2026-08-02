import {
  changeOwnErpPassword,
  createCatalogCategory,
  createCatalogItem,
  createErpUser,
  createPdvOrder,
  createRoom,
  deleteOwnAvatar,
  getBilling,
  getCatalog,
  getContext,
  getDashboard,
  getGuests,
  getLoginContext,
  getOperations,
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
  setOperationMode,
  updateCatalogItem,
  updateErpUser,
  updateOrderStatus,
  updateOrderPreferences,
  updateRoom,
  updateSchedule,
  uploadErpMedia,
  uploadOwnAvatar,
} from "./api.js";

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
  cart: new Map(),
  selectedOrderId: null,
  loginHotels: [],
  loginHotel: null,
  hotelSlug: resolveErpHotelSlug(),
  users: [],
  userPermissions: [],
  operations: null,
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
};

let notificationAudioContext = null;

const toastRegion = document.createElement("div");
toastRegion.className = "legacy-toast-region";
toastRegion.setAttribute("aria-live", "polite");
document.body.append(toastRegion);

prepareStaticInterface();
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
}

function prepareStaticInterface() {
  const loginCode = byId("loginCode");
  loginCode.type = "text";
  loginCode.autocomplete = "username";
  loginCode.inputMode = "text";
  loginCode.placeholder = "Codigo do usuario ou e-mail mestre";
  byId("loginPass").autocomplete = "current-password";
  byId("btnLogin").type = "button";

  const roomInput = byId("roomNumber", false);
  if (roomInput && roomInput.tagName !== "SELECT") {
    const roomSelect = document.createElement("select");
    roomSelect.id = "roomNumber";
    roomSelect.className = roomInput.className;
    roomSelect.setAttribute("aria-label", "Acomodacao");
    roomSelect.innerHTML = '<option value="">Apto</option>';
    roomInput.replaceWith(roomSelect);
  }

  const error = document.createElement("p");
  error.id = "legacyLoginError";
  error.className = "legacy-login-error";
  error.setAttribute("role", "alert");
  byId("btnLogin").before(error);

  installDashboardInterface();
  installBillingInterface();
  installCatalogInterface();
  installSettingsInterface();
  installUserModal();
  installOperationalModals();

  byId("sidebarPinButton", false)?.remove();
  document.querySelector("[data-app-version-button]")?.remove();
  document.querySelector(".login-version-note")?.remove();
  byId("welcomeOverlay", false)?.remove();
  document.querySelector(".sidebar-footer:empty")?.remove();
  const themeLabel = byId("quickThemeTile", false)?.querySelector("span");
  if (themeLabel) themeLabel.textContent = "Tema escuro";
  const printTile = document.querySelector(".quick-tile.print");
  if (printTile) {
    printTile.disabled = true;
    printTile.title = "Impressao indisponivel";
  }
  document.querySelectorAll(".side-nav-btn").forEach((button) => {
    button.title = button.querySelector(".side-text")?.textContent?.trim() || "";
  });
  installStoreQuickPanel();
  applyInterfaceScale(state.interfaceScale, false);
  updateNotificationSoundUI();

  for (const id of ["btnEditarPedido", "btnSalvarPedido", "btnSalvarReimprimir", "btnReimprimir"]) {
    const button = byId(id, false);
    if (button) {
      button.hidden = true;
      button.disabled = true;
      button.classList.add("legacy-print-disabled");
    }
  }

  document.querySelectorAll("button").forEach((button) => {
    if (/imprimir|reimprimir|exportar planilha/i.test(button.textContent)) {
      button.disabled = true;
      button.classList.add("legacy-print-disabled");
      button.title = "Impressao indisponivel.";
    }
  });
}

function bindStaticActions() {
  byId("btnLogin").addEventListener("click", handleLogin);
  byId("loginPass").addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleLogin();
  });
  byId("loginCode").addEventListener("keydown", (event) => {
    if (event.key === "Enter") byId("loginPass").focus();
  });
  byId("erpUserModalClose")?.addEventListener("click", closeUserModal);
  byId("erpUserModalCancel")?.addEventListener("click", closeUserModal);
  byId("erpUserForm")?.addEventListener("submit", saveErpUser);
  byId("erpUserModal")?.addEventListener("click", (event) => {
    if (event.target === byId("erpUserModal")) closeUserModal();
  });
  byId("catalogItemForm")?.addEventListener("submit", saveCatalogItem);
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
  byId("quickThemeTile")?.addEventListener("click", toggleTheme);
  byId("hdrStoreButton")?.addEventListener("click", toggleStoreQuickPanel);
  byId("accountConfigButton")?.addEventListener("click", () => openSettingsView("account"));

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
  topSearch?.addEventListener("input", renderTopSearchResults);
  topSearch?.addEventListener("focus", renderTopSearchResults);
  topSearch?.addEventListener("keydown", handleTopSearchKeydown);
  byId("topSearchResults", false)?.addEventListener("click", handleTopSearchClick);
  byId("pdvMenuSearch")?.addEventListener("input", renderMenu);
  bindPdvPanelControls();
  byId("guestSearchInput")?.addEventListener("input", renderGuests);
  byId("menuAdminSearch")?.addEventListener("input", renderCatalog);
  byId("dashDate", false)?.addEventListener("change", renderDashboard);
  byId("histDate", false)?.addEventListener("change", renderOrders);
  byId("histFrom", false)?.addEventListener("change", renderBilling);
  byId("histTo", false)?.addEventListener("change", renderBilling);
  byId("billingRefreshButton", false)?.addEventListener("click", renderBilling);
  byId("billingExportButton", false)?.addEventListener("click", exportBillingCsv);

  const scaleRange = byId("interfaceScaleRange", false);
  scaleRange?.addEventListener("input", () => applyInterfaceScale(scaleRange.value, false));
  scaleRange?.addEventListener("change", () => applyInterfaceScale(scaleRange.value, true));
  const volumeRange = byId("notificationVolumeRange", false);
  volumeRange?.addEventListener("input", () => previewNotificationVolume(volumeRange.value));
  volumeRange?.addEventListener("change", () => saveNotificationVolume(volumeRange.value));
  byId("notificationSoundButton", false)?.addEventListener("click", toggleNotificationSound);
  document.addEventListener("pointerdown", unlockNotificationAudio, { once: true });

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      document.body.classList.toggle("sidebar-open");
      return;
    }
    document.body.classList.toggle("sidebar-collapsed");
  };
  byId("sidebarToggleButton")?.addEventListener("click", toggleSidebar);

  const orderModal = byId("orderModal");
  orderModal.querySelector('button[title="Fechar"]')?.addEventListener("click", () => orderModal.classList.add("hidden"));
  orderModal.addEventListener("click", (event) => {
    if (event.target === orderModal) orderModal.classList.add("hidden");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      byId("orderModal").classList.add("hidden");
      byId("accountPopover").classList.add("hidden");
      byId("notifDropdown").classList.add("hidden");
      byId("storeQuickPanel", false)?.classList.add("hidden");
      closeTopSearch();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      byId("topSearchInput")?.focus();
    }
    if (event.key === "F7") event.preventDefault();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#topSearchWrap")) closeTopSearch();
    if (!event.target.closest("#hdrStoreButton") && !event.target.closest("#storeQuickPanel")) {
      byId("storeQuickPanel", false)?.classList.add("hidden");
    }
  });
}

function bindPdvPanelControls() {
  const container = byId("vendasContainer", false);
  const collapseButton = container?.querySelector(".pdv-collapse-btn");
  const openButton = container?.querySelector(".pdv-floating-tab");
  if (!container || !collapseButton || !openButton) return;

  collapseButton.addEventListener("click", () => {
    container.classList.add("pdv-collapsed");
    openButton.focus();
  });
  openButton.addEventListener("click", () => {
    container.classList.remove("pdv-collapsed");
    collapseButton.focus();
  });
}

function installDashboardInterface() {
  const date = byId("dashDate", false);
  if (date && !date.value) date.value = localDateKey(new Date());
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
  byId("cardapioContainer").innerHTML = `<div class="erp-v3-shell"><header class="erp-v3-header"><div><p class="admin-kicker">Room Service</p><h2 class="erp-v3-title">Editor de cardapio</h2><p id="menuAdminSummary" class="erp-v3-subtitle">0 itens</p></div><div class="erp-v3-actions"><button id="newCatalogCategoryButton" type="button" class="admin-secondary-btn">Nova categoria</button><button id="newCatalogItemButton" type="button" class="admin-primary-btn">Novo item</button></div></header><div class="erp-catalog-toolbar"><input id="menuAdminSearch" class="erp-search" type="search" placeholder="Buscar prato, descricao ou categoria" autocomplete="off"><div id="catalogCategoryTabs" class="erp-category-tabs"></div></div><div id="menuCategoryBoard" class="erp-catalog-grid"></div></div>`;
}

function installSettingsInterface() {
  byId("adminContainer").innerHTML = `<div class="erp-v3-shell"><header class="erp-v3-header"><div><p class="admin-kicker">Preferencias da unidade</p><h2 class="erp-v3-title">Configuracoes</h2><p class="erp-v3-subtitle">Funcionamento, equipe e conta em um unico lugar</p></div></header><div id="settingsContent" class="erp-v3-shell"></div></div>`;
}

function installOperationalModals() {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `<div id="catalogItemModal" class="erp-modal hidden"><div class="erp-modal-card" role="dialog" aria-modal="true"><header class="erp-modal-head"><div><p class="admin-kicker">Cardapio</p><h2 id="catalogItemModalTitle">Novo item</h2></div><button type="button" class="erp-modal-close" data-close-erp-modal aria-label="Fechar">x</button></header><form id="catalogItemForm" class="erp-form"><input id="catalogItemId" type="hidden"><div class="erp-form-grid"><label>Nome<input id="catalogItemName" required maxlength="160"></label><label>Categoria<select id="catalogItemCategory" required></select></label><label>Preco (R$)<input id="catalogItemPrice" required inputmode="decimal" placeholder="0,00"></label><label>Tag do item<input id="catalogItemTag" maxlength="60" placeholder="Ex: Recomendado"></label><label>Ordem<input id="catalogItemSort" type="number" min="0" max="100000" value="100"></label><label>Status<select id="catalogItemStatus"><option value="active">Ativo</option><option value="inactive">Inativo</option><option value="archived">Arquivado</option></select></label><label>Disponibilidade<select id="catalogItemAvailable"><option value="true">Disponivel</option><option value="false">Indisponivel</option></select></label></div><label>Descricao<textarea id="catalogItemDescription" rows="3" maxlength="1000"></textarea></label><label>Mensagem de indisponibilidade<input id="catalogItemAvailabilityLabel" maxlength="120" placeholder="Ex: Indisponivel hoje"></label><input id="catalogItemMediaId" type="hidden"><div><p class="erp-panel-title">Imagem do prato</p><p class="erp-v3-subtitle">Escolha uma imagem da biblioteca ou envie uma nova.</p></div><div id="catalogImagePicker" class="erp-image-picker"></div><div class="erp-upload-row"><input id="catalogMediaFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><button id="catalogUploadButton" type="button" class="admin-secondary-btn">Enviar imagem</button></div><p id="catalogItemFormError" class="legacy-login-error" role="alert"></p><div class="erp-v3-actions"><button type="button" class="admin-secondary-btn" data-close-erp-modal>Cancelar</button><button type="submit" class="admin-primary-btn">Salvar item</button></div></form></div></div><div id="catalogCategoryModal" class="erp-modal hidden"><div class="erp-modal-card" role="dialog" aria-modal="true"><header class="erp-modal-head"><div><p class="admin-kicker">Cardapio</p><h2>Nova categoria</h2></div><button type="button" class="erp-modal-close" data-close-erp-modal aria-label="Fechar">x</button></header><form id="catalogCategoryForm" class="erp-form"><label>Nome<input id="catalogCategoryName" required maxlength="120"></label><label>Descricao<textarea id="catalogCategoryDescription" rows="3" maxlength="500"></textarea></label><label>Ordem<input id="catalogCategorySort" type="number" min="0" max="100000" value="100"></label><p id="catalogCategoryFormError" class="legacy-login-error" role="alert"></p><div class="erp-v3-actions"><button type="button" class="admin-secondary-btn" data-close-erp-modal>Cancelar</button><button type="submit" class="admin-primary-btn">Criar categoria</button></div></form></div></div><div id="roomModal" class="erp-modal hidden"><div class="erp-modal-card" role="dialog" aria-modal="true"><header class="erp-modal-head"><div><p class="admin-kicker">Acomodacoes</p><h2 id="roomModalTitle">Nova acomodacao</h2></div><button type="button" class="erp-modal-close" data-close-erp-modal aria-label="Fechar">x</button></header><form id="roomForm" class="erp-form"><input id="roomId" type="hidden"><div class="erp-form-grid"><label>Codigo<input id="roomCode" required maxlength="24" placeholder="Ex: 101"></label><label>Nome de exibicao<input id="roomLabel" maxlength="120" placeholder="Ex: Suite Jardim"></label><label>Tipo<input id="roomType" maxlength="80" placeholder="Ex: Suite"></label><label>Ordem<input id="roomSort" type="number" min="0" max="100000" value="100"></label><label>Status<select id="roomStatus"><option value="active">Ativa</option><option value="inactive">Inativa</option><option value="archived">Arquivada</option></select></label></div><p id="roomFormError" class="legacy-login-error" role="alert"></p><div class="erp-v3-actions"><button type="button" class="admin-secondary-btn" data-close-erp-modal>Cancelar</button><button type="submit" class="admin-primary-btn">Salvar acomodacao</button></div></form></div></div>`;
  document.body.append(...wrapper.children);
  byId("catalogImagePicker").addEventListener("click", (event) => {
    const button = event.target.closest("[data-media-id]");
    if (!button) return;
    byId("catalogItemMediaId").value = button.dataset.mediaId;
    renderCatalogImagePicker();
  });
  byId("catalogUploadButton").addEventListener("click", uploadCatalogImage);
}

function renderSettingsHome() {
  const permissions = new Set(state.session?.permissions || []);
  const cards = [
    permissions.has("room-service.settings.manage") ? settingsCard("operation", "clock", "Funcionamento", "Abertura, fechamento e horarios") : "",
    permissions.has("room-service.settings.manage") ? settingsCard("rooms", "rooms", "Acomodacoes", "Quartos disponiveis para atendimento") : "",
    permissions.has("room-service.users.manage") ? settingsCard("users", "users", "Usuarios do ERP", "Acessos e permissoes da equipe") : "",
    settingsCard("account", "account", "Minha conta", "Perfil e senha"),
    settingsCard("appearance", "palette", "Aparencia", "Marca e escala da interface"),
    settingsCard("notifications", "bell", "Notificacoes", "Som e volume dos alertas"),
  ].filter(Boolean);
  return `<div><p class="erp-panel-title">Configuracoes do ERP</p><p class="erp-v3-subtitle">${escapeHtml(displayHotelName(state.context?.hotel))}</p></div><div class="erp-settings-grid">${cards.join("")}</div>`;
}

function renderOperationSettings() {
  if (!state.session?.permissions?.includes("room-service.settings.manage")) return restrictedSettings();
  const operation = state.operations?.operation || state.context?.operation || { mode: "automatic", service_hours: [] };
  const preferences = operation.preferences || { order_scheduling_enabled: false, order_notes_enabled: true };
  const hours = operation.service_hours || [];
  const layout = state.scheduleViewMode || inferScheduleViewMode(hours);
  state.scheduleViewMode = layout;
  const dayNames = ["Domingo", "Segunda-feira", "Terca-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sabado"];
  const rows = dayNames.map((name, day) => {
    const slot = hours.find((entry) => Number(entry.day_of_week) === day && Number(entry.sort_order || 0) === 0) || hours.find((entry) => Number(entry.day_of_week) === day);
    const closed = !slot || Boolean(slot.is_closed);
    return `<div class="erp-schedule-row"><strong>${name}</strong><input type="time" name="opens_${day}" value="${escapeAttr(slot?.opens_at || "16:00")}" ${closed ? "disabled" : ""}><input type="time" name="closes_${day}" value="${escapeAttr(slot?.closes_at || "22:00")}" ${closed ? "disabled" : ""}><label class="erp-switch"><input type="checkbox" name="closed_${day}" ${closed ? "checked" : ""} data-schedule-closed="${day}"> Fechado</label></div>`;
  }).join("");
  const firstOpen = hours.find((entry) => !entry.is_closed) || { opens_at: "16:00", closes_at: "22:00" };
  const scheduleEditor = layout === "same"
    ? `<div class="erp-common-hours"><label>Abre as<input type="time" name="common_opens" value="${escapeAttr(firstOpen.opens_at || "16:00")}" required></label><label>Fecha as<input type="time" name="common_closes" value="${escapeAttr(firstOpen.closes_at || "22:00")}" required></label><span>Todos os dias</span></div>`
    : `<div class="erp-schedule-list">${rows}</div>`;
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div><p class="erp-panel-title">Funcionamento do Room Service</p><p class="erp-v3-subtitle">Defina como a operacao deve funcionar.</p></div><div class="erp-mode-segment">${["automatic", "forced_open", "forced_closed"].map((mode) => `<button type="button" class="erp-mode-button ${operation.mode === mode ? "active" : ""}" data-operation-mode="${mode}">${mode === "automatic" ? "Automatico" : mode === "forced_open" ? "Abrir agora" : "Fechar agora"}</button>`).join("")}</div><form id="orderPreferencesForm" class="erp-order-preferences"><label><span><strong>Agendamento para o mesmo dia</strong><small>Permite que o hospede escolha um horario de entrega.</small></span><input type="checkbox" name="order_scheduling_enabled" ${preferences.order_scheduling_enabled ? "checked" : ""}></label><label><span><strong>Observacoes nos pedidos</strong><small>Exibe observacoes gerais e por item no portal.</small></span><input type="checkbox" name="order_notes_enabled" ${preferences.order_notes_enabled ? "checked" : ""}></label><button type="submit" class="admin-secondary-btn">Salvar preferencias</button></form><form id="operationScheduleForm" class="erp-v3-shell" data-schedule-layout="${layout}"><div class="erp-panel-head"><div><strong class="erp-panel-title">Horario semanal</strong><div class="erp-schedule-layout"><button type="button" class="${layout === "same" ? "active" : ""}" data-schedule-layout-option="same">Mesmo horario todos os dias</button><button type="button" class="${layout === "custom" ? "active" : ""}" data-schedule-layout-option="custom">Horarios por dia</button></div></div><button type="submit" class="admin-primary-btn">Salvar horarios</button></div>${scheduleEditor}</form></section>`;
}

function renderRoomSettings() {
  if (!state.session?.permissions?.includes("room-service.settings.manage")) return restrictedSettings();
  const rooms = state.rooms || [];
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div class="erp-panel-head"><div><p class="erp-panel-title">Acomodacoes da unidade</p><p class="erp-v3-subtitle">Somente acomodacoes ativas aparecem no portal e aceitam pedidos.</p></div><button id="newRoomButton" type="button" class="admin-primary-btn">Nova acomodacao</button></div><div class="erp-rooms-list">${rooms.length ? rooms.map((room) => `<button type="button" class="erp-room-card" data-edit-room="${escapeAttr(room.id)}"><span><strong>${escapeHtml(room.code)}</strong><small>${escapeHtml(displayBusinessText(room.label || room.room_type, "Sem descricao"))}</small></span><span class="erp-chip ${room.status === "active" ? "" : "off"}">${room.status === "active" ? "Ativa" : "Inativa"}</span></button>`).join("") : '<div class="legacy-list-empty">Nenhuma acomodacao cadastrada.</div>'}</div></section>`;
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
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div class="erp-account-card"><div class="erp-profile-avatar">${avatar ? `<img src="${escapeAttr(avatar)}" alt="Foto de perfil" class="erp-profile-avatar">` : escapeHtml(initials)}</div><div><p class="erp-panel-title">${escapeHtml(displayName)}</p><p class="erp-v3-subtitle">${operational ? `Codigo ${Number(user.user_code || 0)} · ${escapeHtml(displayHotelName(state.context?.hotel))}` : "Administrador geral"}</p>${operational ? '<form id="accountAvatarForm" class="erp-upload-row"><input id="accountAvatarFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required><button type="submit" class="admin-primary-btn">Trocar foto</button><button id="removeOwnAvatarButton" type="button" class="admin-secondary-btn">Remover</button></form>' : ""}</div></div>${operational ? '<form id="accountPasswordForm" class="erp-form erp-password-form"><div><p class="erp-panel-title">Alterar senha</p><p class="erp-v3-subtitle">Use no minimo 4 caracteres.</p></div><label>Senha atual<input name="current_password" type="password" required autocomplete="current-password"></label><div class="erp-form-grid"><label>Nova senha<input name="new_password" type="password" required minlength="4" autocomplete="new-password"></label><label>Confirmar nova senha<input name="confirm_password" type="password" required minlength="4" autocomplete="new-password"></label></div><button type="submit" class="admin-primary-btn">Atualizar senha</button></form>' : ""}</section>`;
}

function renderAppearanceSettings() {
  const branding = state.context?.branding || {};
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div><p class="erp-panel-title">Aparencia da unidade</p><p class="erp-v3-subtitle">Identidade visual aplicada ao ERP.</p></div><div class="erp-settings-grid"><article class="erp-panel"><span class="erp-stat-label">Cor primaria</span><div style="width:52px;height:52px;border-radius:8px;background:${isHexColor(branding.primary_color) ? branding.primary_color : "#513b2d"};margin-top:12px"></div></article><article class="erp-panel"><span class="erp-stat-label">Fonte</span><strong class="erp-stat-value" style="font-size:18px;font-family:${escapeAttr(branding.font_family || "system-ui")}">${escapeHtml(branding.font_family || "Fonte padrao")}</strong></article><article class="erp-panel erp-appearance-scale"><span class="erp-stat-label">Escala da interface</span><strong>${state.interfaceScale}%</strong><input id="settingsScaleRange" type="range" min="85" max="115" step="5" value="${state.interfaceScale}"></article></div></section>`;
}

function renderNotificationSettings() {
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div><p class="erp-panel-title">Notificacoes</p><p class="erp-v3-subtitle">Alertas de novos pedidos.</p></div><article class="erp-panel erp-notification-settings"><div><strong>Som de novo pedido</strong><small>${state.notificationSoundEnabled ? "Ativado" : "Silenciado"}</small></div><button type="button" class="admin-secondary-btn" data-toggle-notification-sound>${state.notificationSoundEnabled ? "Silenciar" : "Ativar"}</button><label>Volume <b>${state.notificationVolume}%</b><input id="settingsNotificationVolume" type="range" min="0" max="100" step="5" value="${state.notificationVolume}"></label><button type="button" class="admin-secondary-btn" data-test-notification-sound>Testar som</button></article></section>`;
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
  switchTab("admin");
  renderAdmin();
}

async function handleCatalogClick(event) {
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
  if (event.target.id === "accountAvatarForm") return saveOwnAvatar(event.target);
  if (event.target.id === "accountPasswordForm") return saveOwnPassword(event.target);
}

async function handleLogin() {
  const credential = byId("loginCode").value.trim();
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
  setNavigationVisibility("btnTabAdmin", true);
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
    const [context, dashboard, orders, catalog, guests, billing, users, userPermissions, operations, media, rooms] = await Promise.all([
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
  if (isHexColor(branding.primary_color)) {
    root.style.setProperty("--accent", branding.primary_color);
    root.style.setProperty("--accent-strong", branding.primary_color);
  }
  if (isHexColor(branding.secondary_color)) root.style.setProperty("--brand-secondary", branding.secondary_color);
  if (isHexColor(branding.background_color)) root.style.setProperty("--canvas", branding.background_color);
  if (isHexColor(branding.text_color)) root.style.setProperty("--ink", branding.text_color);
  if (branding.font_family) root.style.setProperty("--hotel-font", String(branding.font_family).slice(0, 160));
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
  const select = byId("roomNumber", false);
  if (!select || select.tagName !== "SELECT") return;
  const current = select.value;
  const rooms = (state.context?.rooms || state.rooms || []).filter((room) => room.status !== "inactive");
  select.innerHTML = `<option value="">Apto</option>${rooms.map((room) => `<option value="${escapeAttr(room.code)}">${escapeHtml(room.label ? `${room.code} - ${displayBusinessText(room.label)}` : room.code)}</option>`).join("")}`;
  if (rooms.some((room) => room.code === current)) select.value = current;
}

function switchTab(route) {
  if (!ROUTES[route] || byId(ROUTES[route].button).classList.contains("hidden")) {
    route = Object.keys(ROUTES).find((key) => !byId(ROUTES[key].button).classList.contains("hidden")) || "dashboard";
  }
  state.route = route;
  for (const [key, config] of Object.entries(ROUTES)) {
    const active = key === route;
    const button = byId(config.button);
    const container = byId(config.container);
    button.classList.toggle("tab-active", active);
    button.classList.toggle("tab-inactive", !active);
    container.classList.toggle("hidden", !active);
    container.style.display = active ? "flex" : "none";
  }
  if (window.matchMedia("(max-width: 900px)").matches) {
    document.body.classList.remove("sidebar-open");
  }
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
  const orders = filteredOrders(byId("topSearchInput")?.value);
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
    : '<div class="legacy-dashboard-empty">Os itens mais vendidos aparecerao aqui.</div>';

  const recent = state.dashboard?.recent_orders || orders.slice(0, 8);
  byId("dashLastOrders").innerHTML = recent.length
    ? recent.map((order) => `<button type="button" class="erp-list-button" data-order-id="${escapeAttr(order.id)}"><span><strong>${escapeHtml(order.public_id || "Pedido")}</strong><small>${escapeHtml(order.room_code || "Sem acomodacao")} · ${statusLabel(order.status)}</small></span><b>${money(order.total_cents)}</b></button>`).join("")
    : '<div class="legacy-dashboard-empty">Nenhum pedido encontrado.</div>';
  bindOrderButtons(byId("dashLastOrders"));

  setText("dashOriginMeta", `${Object.values(origins).reduce((sum, value) => sum + Number(value), 0)} pedidos`);
}

function renderDashboard() {
  const selectedDate = byId("dashDate", false)?.value || localDateKey(new Date());
  const orders = state.orders.filter((order) => dateKeyInHotelTimezone(order.created_at) === selectedDate);
  const completed = orders.filter((order) => order.status === "delivered");
  const revenue = completed.reduce((total, order) => total + Number(order.total_cents || 0), 0);
  const origins = countBy(orders, (order) => originLabel(order.origin));
  const topItems = state.dashboard?.top_items || [];
  const topItem = topItems[0];
  const peak = peakHour(orders);

  setText("dashSummaryLabel", formatDashboardDate(selectedDate));
  setText("kpiVendas", orders.length);
  setText("kpiReceita", money(revenue));
  setText("kpiTicket", money(completed.length ? Math.round(revenue / completed.length) : 0));
  setText("kpiOnline", orders.filter((order) => originLabel(order.origin) === "Hospedes / site").length);
  setText("kpiRecepcao", orders.filter((order) => originLabel(order.origin) === "Recepcao").length);
  setText("kpiObs", orders.filter((order) => String(order.notes || "").trim()).length);
  byId("kpiReceitaCard", false)?.classList.toggle("hidden", !state.session?.permissions?.includes("room-service.billing.read"));

  renderBars(byId("dashTopItemsList"), topItems.slice(0, 6).map((item) => [displayBusinessText(item.name, "Item do cardapio"), Number(item.quantity || 0)]));
  renderBars(byId("dashChannelBars"), Object.entries(origins));
  setText("dashChannelMeta", `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"}`);

  const recent = orders.slice(0, 8);
  setText("dashLastOrdersMeta", `${recent.length} ${recent.length === 1 ? "item" : "itens"}`);
  byId("dashLastOrders").innerHTML = recent.length
    ? recent.map((order) => `<button type="button" class="dash-list-row" data-order-id="${escapeAttr(order.id)}"><span><strong>${escapeHtml(order.public_id || "Pedido")}</strong><small>${escapeHtml(order.room_code || "Sem acomodacao")} · ${escapeHtml(statusLabel(order.status))}</small></span><b>${money(order.total_cents, order.currency)}</b></button>`).join("")
    : '<div class="legacy-dashboard-empty">Nenhum pedido neste dia.</div>';
  bindOrderButtons(byId("dashLastOrders"));

  setText("dashTopItem", topItem ? displayBusinessText(topItem.name, "Item do cardapio") : "-");
  setText("dashTopItemMeta", topItem ? `${Number(topItem.quantity || 0)} unidades` : "Sem vendas no periodo");
  setText("dashPeakHour", peak?.[0] || "-");
  setText("dashPeakMeta", peak ? `${Number(peak[1])} ${Number(peak[1]) === 1 ? "pedido" : "pedidos"}` : "Sem pedidos no dia");
  byId("chartFuncCard", false)?.classList.add("hidden");
}

function renderOrders() {
  const query = byId("topSearchInput")?.value;
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
    <div class="min-w-0"><p class="mini-card-title truncate">${escapeHtml(order.guest_name || order.public_id || "Pedido")}</p><p class="mini-card-meta mt-2"><span>Apto ${escapeHtml(order.room_code || "-")}</span><span class="legacy-status-chip" data-status="${escapeAttr(order.status)}">${escapeHtml(statusLabel(order.status))}</span></p></div>
    <div><p class="mini-card-label">Total</p><p class="mini-card-value">${money(order.total_cents)}</p></div>
    <div class="mini-card-actions justify-end"><button type="button" data-order-id="${escapeAttr(order.id)}" class="mini-card-action"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>Ver</button></div>
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
    setText("detDate", `${order.public_id || "Pedido"} - ${formatDate(order.created_at)} · ${preparation}`);
    setText("detLinha", order.id);
    setText("detRoom", order.delivery?.room_code || order.room_code || "-");
    setText("detGuest", displayBusinessText(order.guest_name, "Nao informado"));
    setText("detLocal", order.delivery?.location || "Acomodacao");
    setText("detStaff", order.origin === "admin_pdv" ? "ERP" : "Portal");
    setText("detTotal", money(order.total_cents, order.currency));
    byId("detItems").innerHTML = (order.items || []).map((item) => `<li class="flex justify-between gap-3"><span>${Number(item.quantity || 0)}x ${escapeHtml(displayBusinessText(item.name || item.name_snapshot, "Item"))}${item.selected_options?.note ? `<small class="block text-slate-500 mt-1">Observação: ${escapeHtml(item.selected_options.note)}</small>` : ""}</span><strong>${money(item.line_total_cents, order.currency)}</strong></li>`).join("") || "<li>Sem itens.</li>";
    const notes = order.notes || "";
    byId("detObsBox").classList.toggle("hidden", !notes);
    setText("detObs", notes);
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
  if (next) buttons.push(`<button type="button" class="order-action-primary" data-status-target="${next}">Avancar para ${escapeHtml(statusLabel(next))}</button>`);
  if (!["delivered", "cancelled"].includes(order.status)) buttons.push('<button type="button" class="order-action-secondary" data-status-target="cancelled">Cancelar pedido</button>');
  buttons.push('<button type="button" class="order-action-secondary legacy-print-disabled" disabled>Impressao indisponivel</button>');
  target.innerHTML = `<div class="legacy-status-actions">${buttons.join("")}</div>`;
  target.querySelectorAll("[data-status-target]").forEach((button) => button.addEventListener("click", () => changeOrderStatus(order, button.dataset.statusTarget)));
}

async function changeOrderStatus(order, targetStatus) {
  const note = targetStatus === "cancelled" ? window.prompt("Informe o motivo do cancelamento:") : "";
  if (targetStatus === "cancelled" && !note?.trim()) return;
  if (!window.confirm(`Confirmar alteracao para ${statusLabel(targetStatus)}?`)) return;
  try {
    await updateOrderStatus(order.id, { status: targetStatus, note: note?.trim() || "" });
    notify(`Pedido atualizado para ${statusLabel(targetStatus)}.`);
    await refreshAll();
    await openOrder(order.id);
  } catch (error) {
    notify(error.message || "Nao foi possivel atualizar o pedido.");
  }
}

function renderMenu() {
  const query = normalize(byId("pdvMenuSearch")?.value || byId("topSearchInput")?.value || "");
  const categories = (state.catalog?.categories || []).map((category) => ({
    ...category,
    items: (category.items || []).map((item) => ({ ...item, category_name: category.name })).filter((item) => !query || normalize(`${item.name} ${item.description || ""} ${item.tag || ""} ${category.name}`).includes(query)),
  })).filter((category) => category.items.length);
  byId("menuContent").innerHTML = categories.length ? categories.map(menuCategory).join("") : '<div class="legacy-list-empty">Nenhum item encontrado.</div>';
  byId("menuContent").querySelectorAll("[data-product-id]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.productId)));
}

function menuCategory(category) {
  return `<section><h2 class="text-xl font-bold mb-4 flex items-center gap-2 dark:text-white uppercase tracking-tighter">${categoryIcon()} ${escapeHtml(displayBusinessText(category.name, "Cardapio"))}</h2><div class="horizontal-scroll">${category.items.map(menuCard).join("")}</div></section>`;
}

function menuCard(item) {
  const disabled = item.available === false;
  const image = safeImage(item.image_url || item.media_url);
  const tag = disabled ? "Indisponivel" : displayBusinessText(item.tag || item.category_name, "Cardapio");
  const name = displayBusinessText(item.name, "Item do cardapio");
  return `<article class="legacy-menu-card erp-pdv-card bg-white dark:bg-gray-800 p-5 rounded-3xl relative card fade-in flex flex-col justify-between" aria-disabled="${disabled}"><div class="erp-pdv-card-top"><span class="erp-product-image erp-pdv-thumb">${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(name)}">` : imagePlaceholderIcon()}</span><div class="erp-pdv-card-copy"><span class="erp-item-tag">${escapeHtml(tag)}</span><h3 class="font-bold text-lg mt-2 dark:text-white">${escapeHtml(name)}</h3><p class="text-xs text-gray-500 mt-2 leading-relaxed italic line-clamp-2">${escapeHtml(displayBusinessText(item.description))}</p></div></div><div class="flex justify-between items-center mt-5 pt-4 border-t"><span class="text-xl font-black text-[#513b2d]">${money(item.price_cents, item.currency)}</span><button type="button" data-product-id="${escapeAttr(item.id)}" ${disabled ? "disabled" : ""} class="bg-[#444746] text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase flex items-center gap-1">${plusIcon()} ${disabled ? "Indisponivel" : "Adicionar"}</button></div></article>`;
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
  target.innerHTML = rows.length ? rows.map(cartLine).join("") : `<div class="h-full flex flex-col items-center justify-center opacity-30 italic text-xs uppercase font-bold text-gray-400">${cartIcon()}<p>Carrinho Vazio</p></div>`;
  target.querySelectorAll("[data-cart-change]").forEach((button) => button.addEventListener("click", () => changeCart(button.dataset.cartChange, Number(button.dataset.delta))));
  setText("cartTotal", money(rows.reduce((total, line) => total + Number(line.item.price_cents || 0) * line.quantity, 0)));
  bindPdvActions();
}

function cartLine(line) {
  return `<div class="bg-gray-50 p-3 rounded-xl flex justify-between items-center border fade-in shadow-sm"><div class="min-w-0 pr-2"><p class="text-[12px] font-bold truncate uppercase tracking-tighter">${escapeHtml(displayBusinessText(line.item.name, "Item do cardapio"))}</p><p class="text-[10px] text-[#513b2d] font-black">${money(line.item.price_cents * line.quantity, line.item.currency)}</p></div><div class="flex gap-2 items-center bg-white border rounded-lg shrink-0 px-1 py-1"><button type="button" data-cart-change="${escapeAttr(line.item.id)}" data-delta="-1" class="text-red-500 font-bold px-2">-</button><span class="text-xs font-bold">${line.quantity}</span><button type="button" data-cart-change="${escapeAttr(line.item.id)}" data-delta="1" class="text-green-500 font-bold px-2">+</button></div></div>`;
}

function bindPdvActions() {
  const container = byId("vendasContainer");
  const send = [...container.querySelectorAll("button")].find((button) => button.textContent.includes("ENVIAR PEDIDO DIRETO"));
  const clear = [...container.querySelectorAll("button")].find((button) => button.textContent.trim().startsWith("Limpar"));
  if (send && !send.dataset.bound) {
    send.dataset.bound = "true";
    send.addEventListener("click", submitPdvOrder);
  }
  if (clear && !clear.dataset.bound) {
    clear.dataset.bound = "true";
    clear.addEventListener("click", () => {
      state.cart.clear();
      renderCart();
    });
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
  const query = normalize(byId("guestSearchInput")?.value || byId("topSearchInput")?.value || "");
  const rooms = (state.guests?.rooms || []).filter((room) => !query || normalize(room.code).includes(query));
  byId("guestTableBody").innerHTML = rooms.length
    ? `<section class="guest-letter-section"><div class="guest-letter-title">Acomodacoes</div><div class="guest-letter-grid">${rooms.map(roomCard).join("")}</div></section>`
    : '<div class="loose-list-empty">Nenhuma acomodacao encontrada.</div>';
  byId("guestTableBody").querySelectorAll("[data-room-code]").forEach((button) => button.addEventListener("click", () => {
    byId("roomNumber").value = button.dataset.roomCode;
    switchTab("vendas");
  }));
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
  byId("histTableBody").innerHTML = state.orders.map((order) => `<tr><td class="p-4">${escapeHtml(formatDate(order.created_at))}</td><td class="p-4">${escapeHtml(order.room_code || "-")}</td><td class="p-4">${escapeHtml(order.guest_name || "-")}</td><td class="p-4">${money(order.total_cents, order.currency)}</td><td class="p-4 text-center"><button type="button" data-order-id="${escapeAttr(order.id)}" class="mini-card-action">Ver</button></td></tr>`).join("");
  bindOrderButtons(byId("histTableBody"));
  renderBars(byId("histLegendLocal"), Object.entries(countBy(state.orders, (order) => order.delivery_location || "Acomodacao")));
  renderBars(byId("histTopItems"), Object.entries(countBy(state.orders, (order) => statusLabel(order.status))));
  byId("histQuickStats").innerHTML = `<p>${state.orders.length} pedidos no periodo</p><p>${money(summary.revenue_cents || 0)} faturados</p><p>Impressao desativada</p>`;
}

function renderBilling() {
  const from = byId("histFrom", false)?.value || "0000-01-01";
  const to = byId("histTo", false)?.value || "9999-12-31";
  const orders = state.orders.filter((order) => {
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
    ? orders.map((order) => `<tr><td>${escapeHtml(formatDate(order.created_at))}</td><td>${escapeHtml(order.public_id || "-")}</td><td>${escapeHtml(order.room_code || "-")}</td><td><span class="legacy-status-chip" data-status="${escapeAttr(order.status)}">${escapeHtml(statusLabel(order.status))}</span></td><td><strong>${money(order.total_cents, order.currency)}</strong></td><td><button type="button" data-order-id="${escapeAttr(order.id)}" class="mini-card-action">Ver</button></td></tr>`).join("")
    : '<tr><td colspan="6"><div class="legacy-dashboard-empty">Nenhum pedido no periodo.</div></td></tr>';
  bindOrderButtons(byId("histTableBody"));
}

function exportBillingCsv() {
  const from = byId("histFrom").value;
  const to = byId("histTo").value;
  const orders = state.orders.filter((order) => {
    const date = dateKeyInHotelTimezone(order.created_at);
    return date >= from && date <= to;
  });
  const lines = [
    ["Data e hora", "Pedido", "Acomodacao", "Status", "Total"],
    ...orders.map((order) => [formatDate(order.created_at), order.public_id || "", order.room_code || "", statusLabel(order.status), (Number(order.total_cents || 0) / 100).toFixed(2).replace(".", ",")]),
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
  const query = normalize(byId("menuAdminSearch")?.value || byId("topSearchInput")?.value || "");
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
  if (state.settingsView === "home") target.innerHTML = renderSettingsHome();
  if (state.settingsView === "operation") target.innerHTML = renderOperationSettings();
  if (state.settingsView === "rooms") target.innerHTML = renderRoomSettings();
  if (state.settingsView === "users") target.innerHTML = renderUserSettings();
  if (state.settingsView === "account") target.innerHTML = renderAccountSettings();
  if (state.settingsView === "appearance") target.innerHTML = renderAppearanceSettings();
  if (state.settingsView === "notifications") target.innerHTML = renderNotificationSettings();
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
  modal.innerHTML = `<div class="erp-user-modal-card" role="dialog" aria-modal="true" aria-labelledby="erpUserModalTitle"><div class="erp-user-modal-head"><div><p class="admin-kicker">Equipe da unidade</p><h2 id="erpUserModalTitle" class="admin-title">Novo usuario</h2></div><button id="erpUserModalClose" type="button" class="erp-user-modal-close" aria-label="Fechar">x</button></div><form id="erpUserForm"><input id="erpUserId" type="hidden"><label>Nome<input id="erpUserName" required minlength="2" maxlength="120" autocomplete="off"></label><label>Senha <small id="erpUserPasswordHint">Minimo de 4 caracteres</small><input id="erpUserPassword" type="password" minlength="4" maxlength="300" autocomplete="new-password"></label><label>Status<select id="erpUserStatus"><option value="active">Ativo</option><option value="disabled">Desativado</option></select></label><fieldset><legend>Modulos permitidos</legend><div id="erpUserPermissionGrid" class="erp-user-permission-grid"></div></fieldset><p id="erpUserFormError" class="legacy-login-error" role="alert"></p><div class="erp-user-modal-actions"><button id="erpUserModalCancel" type="button" class="admin-secondary-btn">Cancelar</button><button type="submit" class="admin-primary-btn">Salvar usuario</button></div></form></div>`;
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
  document.documentElement.style.setProperty("--interface-scale", String(factor));
  document.documentElement.style.setProperty("--interface-inverse", String(1 / factor));
  document.documentElement.style.setProperty("--interface-width", `${100 / factor}vw`);
  document.documentElement.style.setProperty("--interface-height", `${100 / factor}vh`);
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
      detail: `${order.public_id || "Pedido"} - ${order.room_code || "Sem acomodacao"}`,
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
  const query = normalize(input.value);
  const suggestions = buildSearchSuggestions().filter((entry) => !query || normalize(`${entry.label} ${entry.meta}`).includes(query)).slice(0, 8);
  target.innerHTML = suggestions.length
    ? suggestions.map((entry, index) => `<button type="button" class="top-search-item ${index === 0 ? "active" : ""}" data-search-kind="${escapeAttr(entry.kind)}" data-search-value="${escapeAttr(entry.value)}"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M5 12h14M13 5l7 7-7 7"/></svg><span><span class="top-search-title">${escapeHtml(entry.label)}</span><span class="top-search-meta">${escapeHtml(entry.meta)}</span></span></button>`).join("")
    : '<p class="erp-search-empty">Nenhum resultado encontrado.</p>';
  target.classList.remove("hidden");
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
  const orders = state.orders.slice(0, 20).map((order) => ({ kind: "order", value: order.id, label: order.public_id || "Pedido", meta: `${order.room_code || "Sem acomodacao"} · ${statusLabel(order.status)}` }));
  const items = allCatalogItems().slice(0, 30).map((item) => ({ kind: "catalog", value: item.id, label: displayBusinessText(item.name, "Item do cardapio"), meta: displayBusinessText(item.tag, "Item do cardapio") }));
  return [...routes, ...orders, ...items];
}

function handleTopSearchClick(event) {
  const item = event.target.closest("[data-search-kind]");
  if (item) runSearchSuggestion(item.dataset.searchKind, item.dataset.searchValue);
}

function handleTopSearchKeydown(event) {
  if (event.key === "Escape") return closeTopSearch();
  if (event.key !== "Enter") return;
  event.preventDefault();
  const first = byId("topSearchResults", false)?.querySelector("[data-search-kind]");
  if (first) runSearchSuggestion(first.dataset.searchKind, first.dataset.searchValue);
}

function runSearchSuggestion(kind, value) {
  closeTopSearch();
  byId("topSearchInput").value = "";
  if (kind === "route") switchTab(value);
  if (kind === "order") openOrder(value);
  if (kind === "catalog") {
    switchTab("cardapio");
    openCatalogItemModal(allCatalogItems().find((item) => item.id === value));
  }
}

function closeTopSearch() {
  byId("topSearchResults", false)?.classList.add("hidden");
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
  setText("loginStoreStatus", service.label);
  setText("loginStoreMode", "Room Service");
  renderStoreQuickPanel();
}

function currentServiceState() {
  const operation = state.operations?.operation || state.context?.operation;
  if (!operation) return { label: "SEM HORARIO", open: false, mode: "automatic" };
  return { label: operation.open ? "ABERTO" : "FECHADO", open: Boolean(operation.open), mode: operation.mode || "automatic" };
}

function setLoginBusy(busy, message = "Validando usuario e senha") {
  byId("btnLogin").disabled = busy;
  byId("loginLoadingScreen").classList.toggle("hidden", !busy);
  setText("loginLoadingText", message);
}

function setPageBusy(busy, message = "Sincronizando...") {
  setText("loadingText", message);
  byId("loadingOverlay").classList.toggle("hidden", !busy);
}

function showLogin() {
  stopOrderPolling();
  document.body.classList.add("erp-login");
  byId("loginOverlay").classList.remove("hidden");
  byId("accountPopover").classList.add("hidden");
}

function showApplication() {
  document.body.classList.remove("erp-login");
  byId("loginOverlay").classList.add("hidden");
  byId("appShell").style.display = "flex";
}

function toggleTheme() {
  document.documentElement.classList.toggle("dark");
  const dark = document.documentElement.classList.contains("dark");
  byId("quickThemeTile").querySelector("span").firstChild.textContent = dark ? "Tema claro " : "Tema escuro ";
}

function bindOrderButtons(container) {
  container.querySelectorAll("[data-order-id]").forEach((button) => button.addEventListener("click", () => openOrder(button.dataset.orderId)));
}

function filteredOrders(query) {
  const normalized = normalize(query || "");
  return state.orders.filter((order) => !normalized || normalize(`${order.public_id || ""} ${order.guest_name || ""} ${order.room_code || ""} ${order.status || ""}`).includes(normalized));
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

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
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
  return '<svg class="w-5 h-5 text-[#513b2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>';
}

function dashboardIcon(type) {
  const paths = {
    orders: '<path d="M7 3h10v4H7zM5 5H3v16h18V5h-2M8 12h8M8 16h5"/>',
    revenue: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 000 7H15a3.5 3.5 0 010 7H6"/>',
    ticket: '<path d="M3 7a2 2 0 002-2h14v4a2 2 0 000 4v4H5a2 2 0 00-2-2V7zM12 7v10"/>',
    activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
  };
  return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">${paths[type] || paths.orders}</svg>`;
}

function settingsIcon(type) {
  const paths = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    rooms: '<path d="M3 20V5h18v15M3 14h18M7 9h3M14 9h3"/>',
    users: '<path d="M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 10a4 4 0 100-8 4 4 0 000 8zM22 20v-2a4 4 0 00-3-3.87M16 2.13a4 4 0 010 7.75"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0116 0"/>',
    palette: '<path d="M12 3a9 9 0 100 18h1.5a2 2 0 001.5-3.3 2 2 0 011.5-3.3H18A3 3 0 0021 11a8 8 0 00-9-8z"/><circle cx="7.5" cy="11" r=".5"/><circle cx="10" cy="7" r=".5"/><circle cx="15" cy="7" r=".5"/>',
    bell: '<path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  };
  return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">${paths[type] || paths.chevron}</svg>`;
}

function imagePlaceholderIcon() {
  return '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M3 17l5-5 4 4 3-3 6 6"/></svg>';
}

function plusIcon() {
  return '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M12 4v16m8-8H4"/></svg>';
}

function cartIcon() {
  return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13H17"/></svg>';
}
