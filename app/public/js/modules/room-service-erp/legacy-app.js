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
  received: "Recebido",
  preparing: "Em preparo",
  ready: "Pronto",
  completed: "Concluido",
  cancelled: "Cancelado",
};

const NEXT_STATUS = {
  received: "preparing",
  preparing: "ready",
  ready: "completed",
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
  users: [],
  userPermissions: [],
  operations: null,
  rooms: [],
  media: [],
  catalogCategory: "all",
  settingsView: "home",
};

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
  } finally {
    setLoginBusy(false);
  }
}

async function loadLoginContext() {
  const payload = await getLoginContext();
  state.loginHotels = payload.data.hotels || [];
  const select = byId("loginHotelSelect");
  select.innerHTML = state.loginHotels
    .map((hotel) => `<option value="${escapeAttr(hotel.hotel_id)}">${escapeHtml(hotel.name || hotel.short_name || hotel.hotel_id)}</option>`)
    .join("");
  const requested = new URLSearchParams(window.location.search).get("hotel") || localStorage.getItem("fioreze-rs-login-hotel");
  if (state.loginHotels.some((hotel) => hotel.hotel_id === requested)) select.value = requested;
  handleLoginHotelChange();
}

function handleLoginHotelChange() {
  const hotelId = byId("loginHotelSelect").value;
  if (hotelId) localStorage.setItem("fioreze-rs-login-hotel", hotelId);
  const hotel = state.loginHotels.find((entry) => entry.hotel_id === hotelId);
  if (hotel) applyBranding(hotel.branding, hotel);
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

  const hotelSelect = document.createElement("select");
  hotelSelect.id = "loginHotelSelect";
  hotelSelect.className = "legacy-login-hotel-select";
  hotelSelect.setAttribute("aria-label", "Unidade do ERP");
  hotelSelect.innerHTML = '<option value="">Carregando unidades...</option>';
  loginCode.before(hotelSelect);

  const error = document.createElement("p");
  error.id = "legacyLoginError";
  error.className = "legacy-login-error";
  error.setAttribute("role", "alert");
  byId("btnLogin").before(error);

  installDashboardInterface();
  installCatalogInterface();
  installSettingsInterface();
  installUserModal();
  installOperationalModals();

  document.querySelectorAll("[data-app-version]").forEach((element) => {
    element.textContent = "3.0 Cloudflare";
  });

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
      button.title = "Impressao e exportacao desativadas neste ambiente.";
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
  byId("loginHotelSelect").addEventListener("change", handleLoginHotelChange);
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
  document.querySelector(".quick-tile.print")?.addEventListener("click", () => notify("Impressao desativada neste ambiente."));
  byId("hdrStoreButton")?.addEventListener("click", () => openSettingsView("operation"));
  byId("accountConfigButton")?.addEventListener("click", () => openSettingsView("account"));

  const notificationButton = document.querySelector(".notif-button");
  notificationButton?.addEventListener("click", () => byId("notifDropdown").classList.toggle("hidden"));
  byId("notifList").innerHTML = '<div class="legacy-list-empty">Nenhuma notificacao pendente.</div>';
  updateNotificationBadge(0);

  byId("topSearchInput")?.addEventListener("input", renderActiveRoute);
  byId("pdvMenuSearch")?.addEventListener("input", renderMenu);
  byId("guestSearchInput")?.addEventListener("input", renderGuests);
  byId("menuAdminSearch")?.addEventListener("input", renderCatalog);
  byId("dashDate", false)?.addEventListener("change", renderDashboard);
  byId("histDate", false)?.addEventListener("change", renderOrders);

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      document.body.classList.toggle("sidebar-open");
      return;
    }
    document.body.classList.toggle("sidebar-collapsed");
  };
  byId("sidebarPinButton")?.addEventListener("click", toggleSidebar);
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
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      byId("topSearchInput")?.focus();
    }
  });
}

function installDashboardInterface() {
  byId("dashboardContainer").innerHTML = `<div class="erp-v3-shell"><header class="erp-v3-header"><div><p class="admin-kicker">Visao geral</p><h2 class="erp-v3-title">Dashboard</h2><p id="dashSummaryLabel" class="erp-v3-subtitle">Indicadores da unidade</p></div><div id="dashboardOperation" class="erp-operation-card"><span class="erp-operation-dot"></span><span><strong>Carregando funcionamento</strong><small>Sincronizando com a unidade</small></span></div></header><section class="erp-v3-grid"><article class="erp-stat"><span class="erp-stat-icon">${dashboardIcon("orders")}</span><span><small class="erp-stat-label">Pedidos hoje</small><strong id="kpiVendas" class="erp-stat-value">0</strong><small class="erp-stat-meta">Volume recebido</small></span></article><article class="erp-stat"><span class="erp-stat-icon">${dashboardIcon("revenue")}</span><span><small class="erp-stat-label">Receita concluida</small><strong id="kpiReceita" class="erp-stat-value">R$ 0,00</strong><small class="erp-stat-meta">Somente pedidos finalizados</small></span></article><article class="erp-stat"><span class="erp-stat-icon">${dashboardIcon("ticket")}</span><span><small class="erp-stat-label">Ticket medio</small><strong id="kpiTicket" class="erp-stat-value">R$ 0,00</strong><small class="erp-stat-meta">Media dos concluidos</small></span></article><article class="erp-stat"><span class="erp-stat-icon">${dashboardIcon("activity")}</span><span><small class="erp-stat-label">Em andamento</small><strong id="kpiActive" class="erp-stat-value">0</strong><small class="erp-stat-meta">Operacao atual</small></span></article></section><section class="erp-dashboard-layout"><div class="erp-v3-shell"><article class="erp-panel"><div class="erp-panel-head"><strong class="erp-panel-title">Fluxo de pedidos</strong><span id="dashOriginMeta" class="erp-panel-meta">0 pedidos</span></div><div class="erp-chart-row"><div id="dashboardDonut" class="erp-donut"><span class="erp-donut-center"><strong id="dashboardDonutTotal">0</strong><span>pedidos</span></span></div><div id="dashStatusLegend" class="dash-bars"></div></div></article><article class="erp-panel"><div class="erp-panel-head"><strong class="erp-panel-title">Movimento por horario</strong><span class="erp-panel-meta">Distribuicao do periodo</span></div><div id="dashboardHourlyChart" class="erp-modern-bars"></div></article></div><div class="erp-v3-shell"><article class="erp-panel"><div class="erp-panel-head"><strong class="erp-panel-title">Mais vendidos</strong><span class="erp-panel-meta">Quantidade e receita</span></div><div id="dashboardTopItems" class="erp-list"></div></article><article class="erp-panel"><div class="erp-panel-head"><strong class="erp-panel-title">Pedidos recentes</strong><span class="erp-panel-meta">Ultimas entradas</span></div><div id="dashLastOrders" class="erp-list"></div></article></div></section></div>`;
}

function installCatalogInterface() {
  byId("cardapioContainer").innerHTML = `<div class="erp-v3-shell"><header class="erp-v3-header"><div><p class="admin-kicker">Room Service</p><h2 class="erp-v3-title">Editor de cardapio</h2><p id="menuAdminSummary" class="erp-v3-subtitle">0 itens</p></div><div class="erp-v3-actions"><button id="newCatalogCategoryButton" type="button" class="admin-secondary-btn">Nova categoria</button><button id="newCatalogItemButton" type="button" class="admin-primary-btn">Novo item</button></div></header><div class="erp-catalog-toolbar"><input id="menuAdminSearch" class="erp-search" type="search" placeholder="Buscar prato, descricao ou categoria" autocomplete="off"><div id="catalogCategoryTabs" class="erp-category-tabs"></div></div><div id="menuCategoryBoard" class="erp-catalog-grid"></div></div>`;
}

function installSettingsInterface() {
  byId("adminContainer").innerHTML = `<div class="erp-v3-shell"><header class="erp-v3-header"><div><p class="admin-kicker">Preferencias da unidade</p><h2 class="erp-v3-title">Configuracoes</h2><p class="erp-v3-subtitle">Funcionamento, equipe e conta em um unico lugar</p></div></header><div id="settingsContent" class="erp-v3-shell"></div></div>`;
}

function installOperationalModals() {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `<div id="catalogItemModal" class="erp-modal hidden"><div class="erp-modal-card" role="dialog" aria-modal="true"><header class="erp-modal-head"><div><p class="admin-kicker">Cardapio</p><h2 id="catalogItemModalTitle">Novo item</h2></div><button type="button" class="erp-modal-close" data-close-erp-modal aria-label="Fechar">x</button></header><form id="catalogItemForm" class="erp-form"><input id="catalogItemId" type="hidden"><div class="erp-form-grid"><label>Nome<input id="catalogItemName" required maxlength="160"></label><label>Categoria<select id="catalogItemCategory" required></select></label><label>Preco (R$)<input id="catalogItemPrice" required inputmode="decimal" placeholder="0,00"></label><label>Ordem<input id="catalogItemSort" type="number" min="0" max="100000" value="100"></label><label>Status<select id="catalogItemStatus"><option value="active">Ativo</option><option value="inactive">Inativo</option><option value="archived">Arquivado</option></select></label><label>Disponibilidade<select id="catalogItemAvailable"><option value="true">Disponivel</option><option value="false">Indisponivel</option></select></label></div><label>Descricao<textarea id="catalogItemDescription" rows="3" maxlength="1000"></textarea></label><label>Texto de indisponibilidade<input id="catalogItemAvailabilityLabel" maxlength="120" placeholder="Ex: Indisponivel hoje"></label><input id="catalogItemMediaId" type="hidden"><div><p class="erp-panel-title">Imagem do prato</p><p class="erp-v3-subtitle">Selecione uma imagem da biblioteca ou envie uma nova.</p></div><div id="catalogImagePicker" class="erp-image-picker"></div><div class="erp-upload-row"><input id="catalogMediaFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><button id="catalogUploadButton" type="button" class="admin-secondary-btn">Enviar imagem</button></div><p id="catalogItemFormError" class="legacy-login-error" role="alert"></p><div class="erp-v3-actions"><button type="button" class="admin-secondary-btn" data-close-erp-modal>Cancelar</button><button type="submit" class="admin-primary-btn">Salvar item</button></div></form></div></div><div id="catalogCategoryModal" class="erp-modal hidden"><div class="erp-modal-card" role="dialog" aria-modal="true"><header class="erp-modal-head"><div><p class="admin-kicker">Cardapio</p><h2>Nova categoria</h2></div><button type="button" class="erp-modal-close" data-close-erp-modal aria-label="Fechar">x</button></header><form id="catalogCategoryForm" class="erp-form"><label>Nome<input id="catalogCategoryName" required maxlength="120"></label><label>Descricao<textarea id="catalogCategoryDescription" rows="3" maxlength="500"></textarea></label><label>Ordem<input id="catalogCategorySort" type="number" min="0" max="100000" value="100"></label><p id="catalogCategoryFormError" class="legacy-login-error" role="alert"></p><div class="erp-v3-actions"><button type="button" class="admin-secondary-btn" data-close-erp-modal>Cancelar</button><button type="submit" class="admin-primary-btn">Criar categoria</button></div></form></div></div><div id="roomModal" class="erp-modal hidden"><div class="erp-modal-card" role="dialog" aria-modal="true"><header class="erp-modal-head"><div><p class="admin-kicker">Acomodacoes</p><h2 id="roomModalTitle">Nova acomodacao</h2></div><button type="button" class="erp-modal-close" data-close-erp-modal aria-label="Fechar">x</button></header><form id="roomForm" class="erp-form"><input id="roomId" type="hidden"><div class="erp-form-grid"><label>Codigo<input id="roomCode" required maxlength="24" placeholder="Ex: 101"></label><label>Nome amigavel<input id="roomLabel" maxlength="120" placeholder="Ex: Suite Jardim"></label><label>Tipo<input id="roomType" maxlength="80" placeholder="Ex: Suite"></label><label>Ordem<input id="roomSort" type="number" min="0" max="100000" value="100"></label><label>Status<select id="roomStatus"><option value="active">Ativa</option><option value="inactive">Inativa</option><option value="archived">Arquivada</option></select></label></div><p id="roomFormError" class="legacy-login-error" role="alert"></p><div class="erp-v3-actions"><button type="button" class="admin-secondary-btn" data-close-erp-modal>Cancelar</button><button type="submit" class="admin-primary-btn">Salvar acomodacao</button></div></form></div></div>`;
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
    permissions.has("room-service.settings.manage") ? settingsCard("operation", "clock", "Funcionamento", "Horarios automaticos e abertura manual") : "",
    permissions.has("room-service.settings.manage") ? settingsCard("rooms", "rooms", "Acomodacoes", "Quartos validos para pedidos online") : "",
    permissions.has("room-service.users.manage") ? settingsCard("users", "users", "Usuarios do ERP", "Codigos, senhas e modulos permitidos") : "",
    settingsCard("account", "account", "Minha conta", "Foto de perfil e seguranca"),
    settingsCard("appearance", "palette", "Aparencia", "Identidade herdada da unidade"),
    settingsCard("notifications", "bell", "Notificacoes", "Preferencias e alertas do ERP"),
  ].filter(Boolean);
  return `<div><p class="erp-panel-title">Configuracoes do ERP</p><p class="erp-v3-subtitle">Cada ajuste e aplicado somente a ${escapeHtml(state.context?.hotel?.name || "esta unidade")}.</p></div><div class="erp-settings-grid">${cards.join("")}</div>`;
}

function renderOperationSettings() {
  if (!state.session?.permissions?.includes("room-service.settings.manage")) return restrictedSettings();
  const operation = state.operations?.operation || state.context?.operation || { mode: "automatic", service_hours: [] };
  const hours = operation.service_hours || [];
  const dayNames = ["Domingo", "Segunda-feira", "Terca-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sabado"];
  const rows = dayNames.map((name, day) => {
    const slot = hours.find((entry) => Number(entry.day_of_week) === day && Number(entry.sort_order || 0) === 0) || hours.find((entry) => Number(entry.day_of_week) === day);
    const closed = !slot || Boolean(slot.is_closed);
    return `<div class="erp-schedule-row"><strong>${name}</strong><input type="time" name="opens_${day}" value="${escapeAttr(slot?.opens_at || "16:00")}" ${closed ? "disabled" : ""}><input type="time" name="closes_${day}" value="${escapeAttr(slot?.closes_at || "22:00")}" ${closed ? "disabled" : ""}><label class="erp-switch"><input type="checkbox" name="closed_${day}" ${closed ? "checked" : ""} data-schedule-closed="${day}"> Fechado</label></div>`;
  }).join("");
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div><p class="erp-panel-title">Funcionamento do Room Service</p><p class="erp-v3-subtitle">O modo automatico segue os horarios. Uma abertura ou pausa manual prevalece ate voltar ao automatico.</p></div><div class="erp-mode-segment">${["automatic", "forced_open", "forced_closed"].map((mode) => `<button type="button" class="erp-mode-button ${operation.mode === mode ? "active" : ""}" data-operation-mode="${mode}">${mode === "automatic" ? "Automatico" : mode === "forced_open" ? "Abrir agora" : "Fechar agora"}</button>`).join("")}</div><form id="operationScheduleForm" class="erp-v3-shell"><div class="erp-panel-head"><strong class="erp-panel-title">Horario semanal</strong><button type="submit" class="admin-primary-btn">Salvar horarios</button></div><div class="erp-schedule-list">${rows}</div></form></section>`;
}

function renderRoomSettings() {
  if (!state.session?.permissions?.includes("room-service.settings.manage")) return restrictedSettings();
  const rooms = state.rooms || [];
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div class="erp-panel-head"><div><p class="erp-panel-title">Acomodacoes da unidade</p><p class="erp-v3-subtitle">Somente acomodacoes ativas aparecem no portal e aceitam pedidos.</p></div><button id="newRoomButton" type="button" class="admin-primary-btn">Nova acomodacao</button></div><div class="erp-rooms-list">${rooms.length ? rooms.map((room) => `<button type="button" class="erp-room-card" data-edit-room="${escapeAttr(room.id)}"><span><strong>${escapeHtml(room.code)}</strong><small>${escapeHtml(room.label || room.room_type || "Sem descricao")}</small></span><span class="erp-chip ${room.status === "active" ? "" : "off"}">${room.status === "active" ? "Ativa" : "Inativa"}</span></button>`).join("") : '<div class="legacy-list-empty">Nenhuma acomodacao cadastrada.</div>'}</div></section>`;
}

function renderUserSettings() {
  const canManage = state.session?.permissions?.includes("room-service.users.manage");
  if (!canManage) return restrictedSettings();
  const cards = [];
  if (state.session.erp_master) cards.push(`<article class="admin-user-card erp-master-card"><div class="erp-user-card-head"><span class="admin-user-avatar">M</span><div><strong>${escapeHtml(state.session.user.display_name || "Administrador dev")}</strong><small>Administrador mestre da plataforma</small></div></div><div class="erp-user-permissions"><span>Acesso total</span><span>Central Administrativa</span></div><span class="legacy-status-chip">Mestre</span></article>`);
  cards.push(...state.users.map((user) => erpUserCard(user)));
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div class="erp-panel-head"><div><p class="erp-panel-title">Usuarios operacionais</p><p class="erp-v3-subtitle">Cada usuario acessa somente esta unidade e os modulos autorizados.</p></div><div class="erp-v3-actions"><button id="refreshErpUsersButton" type="button" class="admin-secondary-btn">Atualizar</button><button id="newErpUserButton" type="button" class="admin-primary-btn">Novo usuario</button></div></div><div id="userList" class="admin-user-list">${cards.length ? cards.join("") : '<div class="legacy-list-empty">Nenhum usuario cadastrado.</div>'}</div></section>`;
}

function renderAccountSettings() {
  const user = state.session?.user || {};
  const initials = String(user.display_name || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const avatar = safeImage(user.avatar);
  const operational = state.session?.auth_source === "erp";
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div class="erp-account-card"><div class="erp-profile-avatar">${avatar ? `<img src="${escapeAttr(avatar)}" alt="Foto de perfil" class="erp-profile-avatar">` : escapeHtml(initials)}</div><div><p class="erp-panel-title">${escapeHtml(user.display_name || "Usuario")}</p><p class="erp-v3-subtitle">${operational ? `Codigo ${Number(user.user_code || 0)} · ${escapeHtml(state.context?.hotel?.name || "Unidade")}` : "Administrador mestre da plataforma"}</p>${operational ? '<form id="accountAvatarForm" class="erp-upload-row"><input id="accountAvatarFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required><button type="submit" class="admin-primary-btn">Trocar foto</button><button id="removeOwnAvatarButton" type="button" class="admin-secondary-btn">Remover</button></form>' : '<p class="erp-v3-subtitle">A foto e a senha do administrador mestre sao gerenciadas na Central Administrativa.</p>'}</div></div>${operational ? '<form id="accountPasswordForm" class="erp-form erp-password-form"><div><p class="erp-panel-title">Alterar senha</p><p class="erp-v3-subtitle">Use no minimo 4 caracteres. A senha permanece somente como hash seguro.</p></div><label>Senha atual<input name="current_password" type="password" required autocomplete="current-password"></label><div class="erp-form-grid"><label>Nova senha<input name="new_password" type="password" required minlength="4" autocomplete="new-password"></label><label>Confirmar nova senha<input name="confirm_password" type="password" required minlength="4" autocomplete="new-password"></label></div><button type="submit" class="admin-primary-btn">Atualizar senha</button></form>' : ""}</section>`;
}

function renderAppearanceSettings() {
  const branding = state.context?.branding || {};
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div><p class="erp-panel-title">Aparencia da unidade</p><p class="erp-v3-subtitle">O ERP aplica automaticamente as logos, a fonte e a cor primaria cadastradas na Central Administrativa.</p></div><div class="erp-settings-grid"><article class="erp-panel"><span class="erp-stat-label">Cor primaria</span><div style="width:52px;height:52px;border-radius:8px;background:${isHexColor(branding.primary_color) ? branding.primary_color : "#513b2d"};margin-top:12px"></div></article><article class="erp-panel"><span class="erp-stat-label">Fonte</span><strong class="erp-stat-value" style="font-size:18px;font-family:${escapeAttr(branding.font_family || "system-ui")}">${escapeHtml(branding.font_family || "Fonte padrao")}</strong></article></div></section>`;
}

function renderNotificationSettings() {
  return `<button type="button" class="erp-back" data-settings-view="home">${settingsIcon("back")} Configuracoes</button><section class="erp-settings-detail"><div><p class="erp-panel-title">Notificacoes</p><p class="erp-v3-subtitle">A contagem aparece no topo somente quando houver pelo menos uma notificacao.</p></div><article class="erp-panel"><div class="legacy-list-empty">Nenhuma notificacao pendente.</div></article></section>`;
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
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  if (event.target.id === "operationScheduleForm") return saveOperationSchedule(event.target);
  if (event.target.id === "accountAvatarForm") return saveOwnAvatar(event.target);
  if (event.target.id === "accountPasswordForm") return saveOwnPassword(event.target);
}

async function handleLogin() {
  const credential = byId("loginCode").value.trim();
  const hotelId = byId("loginHotelSelect").value;
  const password = byId("loginPass").value;
  byId("legacyLoginError").textContent = "";
  if (!credential || !password || (!credential.includes("@") && !hotelId)) {
    byId("legacyLoginError").textContent = "Selecione a unidade e informe codigo e senha.";
    return;
  }
  setLoginBusy(true, "Validando usuario e senha");
  try {
    await login({ hotelId, credential, password });
    const payload = await getSession();
    localStorage.setItem("fioreze-rs-hotel", hotelId);
    byId("loginPass").value = "";
    await startSession(payload.data);
  } catch (error) {
    byId("legacyLoginError").textContent = error.message || "Falha ao entrar.";
  } finally {
    setLoginBusy(false);
  }
}

async function handleLogout() {
  await logout();
  state.session = null;
  state.cart.clear();
  showLogin();
}

async function startSession(session) {
  state.session = session;
  const hotels = session?.hotels || [];
  state.hotelId = hotels.some((hotel) => hotel.hotel_id === localStorage.getItem("fioreze-rs-hotel"))
    ? localStorage.getItem("fioreze-rs-hotel")
    : hotels[0]?.hotel_id || "";

  if (!state.hotelId) {
    showLogin();
    byId("legacyLoginError").textContent = "Usuario sem unidade autorizada.";
    return;
  }

  byId("activeStaff").textContent = session?.user?.display_name || "Usuario";
  setImage(byId("topStaffAvatar", false), safeImage(session?.user?.avatar), session?.user?.display_name || "Usuario");
  installHotelSelector(hotels);
  configureAuthorizedNavigation(session?.permissions || []);
  showApplication();
  await refreshAll();
  switchTab(state.route);
}

function installHotelSelector(hotels) {
  const title = document.querySelector("#appShell h1");
  const select = byId("legacyHotelSelect", false) || document.createElement("select");
  if (!select.id) {
    select.id = "legacyHotelSelect";
    select.className = "legacy-hotel-select";
    select.setAttribute("aria-label", "Unidade do ERP");
  }
  select.innerHTML = hotels
    .map((hotel) => `<option value="${escapeAttr(hotel.hotel_id)}">${escapeHtml(hotel.name || hotel.short_name || hotel.hotel_id)}</option>`)
    .join("");
  select.value = state.hotelId;
  select.onchange = async () => {
    state.hotelId = select.value;
    localStorage.setItem("fioreze-rs-hotel", state.hotelId);
    state.cart.clear();
    await refreshAll();
    renderActiveRoute();
  };
  if (title) title.replaceWith(select);
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
    state.catalog = catalog?.data || { categories: [] };
    state.guests = guests?.data || null;
    state.billing = billing?.data || null;
    state.users = users?.data?.users || [];
    state.userPermissions = userPermissions?.data?.permissions || [];
    state.operations = operations?.data || { operation: context.data.operation, rooms: context.data.rooms || [] };
    state.rooms = rooms?.data?.rooms || operations?.data?.rooms || context.data.rooms || [];
    state.media = media?.data?.assets || [];
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
  const name = hotel.name || hotel.short_name || "ERP Room Service Fioreze";
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
  document.title = `${name} | ERP Room Service`;
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
  select.innerHTML = `<option value="">Apto</option>${rooms.map((room) => `<option value="${escapeAttr(room.code)}">${escapeHtml(room.label ? `${room.code} - ${room.label}` : room.code)}</option>`).join("")}`;
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

function renderDashboard() {
  const summary = state.dashboard?.summary || {};
  const orders = filteredOrders(byId("topSearchInput")?.value);
  const completed = orders.filter((order) => order.status === "completed");
  const revenue = summary.revenue_cents ?? completed.reduce((total, order) => total + Number(order.total_cents || 0), 0);
  const origins = countBy(orders, (order) => order.origin || "portal");
  const statuses = countBy(orders, (order) => order.status || "received");
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
    Number(statuses.received || 0),
    Number(statuses.preparing || 0),
    Number(statuses.ready || 0),
    Math.max(0, total - Number(statuses.received || 0) - Number(statuses.preparing || 0) - Number(statuses.ready || 0)),
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
    setText("detDate", `${order.public_id || "Pedido"} - ${formatDate(order.created_at)}`);
    setText("detLinha", order.id);
    setText("detRoom", order.delivery?.room_code || order.room_code || "-");
    setText("detGuest", order.guest_name || "Nao informado");
    setText("detLocal", order.delivery?.location || "Acomodacao");
    setText("detStaff", order.origin === "admin_pdv" ? "ERP" : "Portal");
    setText("detTotal", money(order.total_cents, order.currency));
    byId("detItems").innerHTML = (order.items || []).map((item) => `<li class="flex justify-between gap-3"><span>${Number(item.quantity || 0)}x ${escapeHtml(item.name || item.name_snapshot || "Item")}</span><strong>${money(item.line_total_cents, order.currency)}</strong></li>`).join("") || "<li>Sem itens.</li>";
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
  if (!["completed", "cancelled"].includes(order.status)) buttons.push('<button type="button" class="order-action-secondary" data-status-target="cancelled">Cancelar pedido</button>');
  buttons.push('<button type="button" class="order-action-secondary legacy-print-disabled" disabled>Impressao desativada</button>');
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
    items: (category.items || []).filter((item) => !query || normalize(`${item.name} ${item.description || ""} ${category.name}`).includes(query)),
  })).filter((category) => category.items.length);
  byId("menuContent").innerHTML = categories.length ? categories.map(menuCategory).join("") : '<div class="legacy-list-empty">Nenhum item encontrado.</div>';
  byId("menuContent").querySelectorAll("[data-product-id]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.productId)));
}

function menuCategory(category) {
  return `<section><h2 class="text-xl font-bold mb-4 flex items-center gap-2 dark:text-white uppercase tracking-tighter">${categoryIcon()} ${escapeHtml(category.name)}</h2><div class="horizontal-scroll">${category.items.map(menuCard).join("")}</div></section>`;
}

function menuCard(item) {
  const disabled = item.available === false;
  const image = safeImage(item.image_url || item.media_url);
  return `<article class="legacy-menu-card bg-white dark:bg-gray-800 p-5 rounded-3xl relative card fade-in flex flex-col justify-between" aria-disabled="${disabled}"><div>${image ? `<div class="absolute top-5 right-5 w-16 h-16 rounded-xl overflow-hidden shadow-sm border"><img src="${escapeAttr(image)}" alt="" class="legacy-menu-image"></div>` : ""}<div class="${image ? "pr-20" : ""}"><span class="bg-[#f7f5ef] text-[#513b2d] text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wide">${disabled ? "INDISPONIVEL" : "ITEM"}</span><h3 class="font-bold text-lg mt-2 dark:text-white">${escapeHtml(item.name)}</h3><p class="text-xs text-gray-500 mt-2 leading-relaxed italic line-clamp-2">${escapeHtml(item.description || "")}</p></div><div class="h-10"></div></div><div class="flex justify-between items-center mt-5 pt-4 border-t"><span class="text-xl font-black text-[#513b2d]">${money(item.price_cents, item.currency)}</span><button type="button" data-product-id="${escapeAttr(item.id)}" ${disabled ? "disabled" : ""} class="bg-[#444746] text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase flex items-center gap-1">${plusIcon()} ${disabled ? "INDISPONIVEL" : "ADD"}</button></div></article>`;
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
  return `<div class="bg-gray-50 p-3 rounded-xl flex justify-between items-center border fade-in shadow-sm"><div class="min-w-0 pr-2"><p class="text-[12px] font-bold truncate uppercase tracking-tighter">${escapeHtml(line.item.name)}</p><p class="text-[10px] text-[#513b2d] font-black">${money(line.item.price_cents * line.quantity, line.item.currency)}</p></div><div class="flex gap-2 items-center bg-white border rounded-lg shrink-0 px-1 py-1"><button type="button" data-cart-change="${escapeAttr(line.item.id)}" data-delta="-1" class="text-red-500 font-bold px-2">-</button><span class="text-xs font-bold">${line.quantity}</span><button type="button" data-cart-change="${escapeAttr(line.item.id)}" data-delta="1" class="text-green-500 font-bold px-2">+</button></div></div>`;
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
  return `<article class="guest-mini-card"><div class="mini-card-top"><div><p class="mini-card-label">Integracao PMS</p><p class="text-[11px] font-black text-gray-500 uppercase">Nao conectada</p></div><div class="mini-room-badge">Apto ${escapeHtml(room.code)}</div></div><div><p class="mini-card-title">Acomodacao ${escapeHtml(room.code)}</p><p class="text-[11px] font-bold text-gray-500 mt-2">Sem dados pessoais carregados</p></div><div class="mini-card-actions"><button type="button" data-room-code="${escapeAttr(room.code)}" class="mini-card-action orange">${cartIcon()} Vender</button></div></article>`;
}

function renderBilling() {
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

function renderCatalog() {
  const query = normalize(byId("menuAdminSearch")?.value || byId("topSearchInput")?.value || "");
  const sourceCategories = state.catalog?.categories || [];
  const categories = sourceCategories
    .filter((category) => state.catalogCategory === "all" || category.id === state.catalogCategory)
    .map((category) => ({ ...category, items: (category.items || []).filter((item) => !query || normalize(`${item.name} ${item.description || ""} ${category.name}`).includes(query)) }))
    .filter((category) => category.items.length);
  const total = categories.reduce((sum, category) => sum + category.items.length, 0);
  setText("menuAdminSummary", `${total} itens encontrados`);
  byId("catalogCategoryTabs").innerHTML = [{ id: "all", name: "Todos" }, ...sourceCategories]
    .map((category) => `<button type="button" class="erp-category-tab ${state.catalogCategory === category.id ? "active" : ""}" data-catalog-category="${escapeAttr(category.id)}">${escapeHtml(category.name)}${category.id === "all" ? "" : ` · ${(category.items || []).length}`}</button>`)
    .join("");
  byId("menuCategoryBoard").innerHTML = categories.length
    ? categories.flatMap((category) => category.items.map((item) => `<button type="button" class="erp-product-card" data-edit-catalog-item="${escapeAttr(item.id)}"><span class="erp-product-image">${safeImage(item.image_url) ? `<img src="${escapeAttr(item.image_url)}" alt="">` : imagePlaceholderIcon()}</span><span class="erp-product-body"><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description || category.name)}</p><span class="erp-product-footer"><b class="erp-product-price">${money(item.price_cents, item.currency)}</b><span class="erp-chip ${item.available === false ? "off" : ""}">${item.available === false ? "Indisponivel" : "Disponivel"}</span></span></span></button>`)).join("")
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
}

function erpUserCard(user) {
  const labels = new Map(state.userPermissions.map((permission) => [permission.key, permission.label]));
  const initials = String(user.display_name || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return `<article class="admin-user-card"><div class="erp-user-card-head"><span class="admin-user-avatar">${escapeHtml(initials)}</span><div><strong>${escapeHtml(user.display_name)}</strong><small>Codigo ${Number(user.user_code)}</small></div></div><div class="erp-user-permissions">${(user.permissions || []).map((key) => `<span>${escapeHtml(labels.get(key) || key)}</span>`).join("")}</div><div class="erp-user-card-actions"><span class="legacy-status-chip">${user.status === "active" ? "Ativo" : "Desativado"}</span><button type="button" class="admin-secondary-btn" data-edit-erp-user="${escapeAttr(user.id)}">Editar</button></div></article>`;
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
  setPageBusy(true, "Enviando imagem para o R2...");
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
  const days = Array.from({ length: 7 }, (_, day) => ({
    day_of_week: day,
    is_closed: form.elements[`closed_${day}`].checked,
    opens_at: form.elements[`opens_${day}`].value,
    closes_at: form.elements[`closes_${day}`].value,
  }));
  setPageBusy(true, "Salvando horario semanal...");
  try {
    await updateSchedule({ hotel_id: state.hotelId, days });
    const payload = await getOperations({ hotelId: state.hotelId });
    state.operations = payload.data;
    state.context.operation = payload.data.operation;
    state.context.service_hours = payload.data.operation.service_hours;
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

async function saveOwnAvatar(form) {
  const file = form.querySelector("input[type=file]").files?.[0];
  if (!file) return;
  setPageBusy(true, "Atualizando foto de perfil...");
  try {
    const payload = new FormData();
    payload.set("file", file);
    const response = await uploadOwnAvatar(payload);
    state.session.user.avatar = response.data.asset.public_url;
    setImage(byId("topStaffAvatar", false), state.session.user.avatar, state.session.user.display_name);
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
    setImage(byId("topStaffAvatar", false), "", state.session.user.display_name);
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
  setText("loginStoreMode", "D1");
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

function peakHour(orders) {
  return Object.entries(countBy(orders, (order) => String(order.created_at || "").slice(11, 13) ? `${String(order.created_at).slice(11, 13)}h` : "" )).sort((a, b) => b[1] - a[1])[0];
}

function allCatalogItems() {
  return (state.catalog?.categories || []).flatMap((category) => category.items || []);
}

function notify(message) {
  const toast = document.createElement("div");
  toast.className = "legacy-toast";
  toast.textContent = message;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
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
