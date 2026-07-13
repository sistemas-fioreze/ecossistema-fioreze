import {
  createPdvOrder,
  getBilling,
  getCatalog,
  getContext,
  getDashboard,
  getGuests,
  getOrder,
  getSession,
  listOrders,
  login,
  logout,
  updateOrderStatus,
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
    const payload = await getSession();
    await startSession(payload.data);
  } catch (error) {
    if (error.status !== 401) notify("Nao foi possivel verificar a sessao administrativa.");
    showLogin();
  } finally {
    setLoginBusy(false);
  }
}

function prepareStaticInterface() {
  const loginCode = byId("loginCode");
  loginCode.type = "email";
  loginCode.autocomplete = "username";
  loginCode.placeholder = "E-mail administrativo";
  byId("loginPass").autocomplete = "current-password";
  byId("btnLogin").type = "button";

  const error = document.createElement("p");
  error.id = "legacyLoginError";
  error.className = "legacy-login-error";
  error.setAttribute("role", "alert");
  byId("btnLogin").before(error);

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

  for (const [route, config] of Object.entries(ROUTES)) {
    byId(config.button)?.addEventListener("click", () => switchTab(route));
  }

  const sessionButton = document.querySelector(".top-session");
  sessionButton?.addEventListener("click", () => byId("accountPopover").classList.toggle("hidden"));
  document.querySelector(".quick-tile.logout")?.addEventListener("click", handleLogout);
  byId("quickThemeTile")?.addEventListener("click", toggleTheme);
  document.querySelector(".quick-tile.print")?.addEventListener("click", () => notify("Impressao desativada neste ambiente."));
  byId("hdrStoreButton")?.addEventListener("click", () => notify("Funcionamento lido da configuracao da unidade."));

  const notificationButton = document.querySelector(".notif-button");
  notificationButton?.addEventListener("click", () => byId("notifDropdown").classList.toggle("hidden"));
  byId("notifList").innerHTML = '<div class="legacy-list-empty">Nenhuma notificacao pendente.</div>';

  byId("topSearchInput")?.addEventListener("input", renderActiveRoute);
  byId("pdvMenuSearch")?.addEventListener("input", renderMenu);
  byId("guestSearchInput")?.addEventListener("input", renderGuests);
  byId("menuAdminSearch")?.addEventListener("input", renderCatalog);
  byId("dashDate")?.addEventListener("change", renderDashboard);
  byId("histDate")?.addEventListener("change", renderOrders);

  byId("sidebarPinButton")?.addEventListener("click", () => document.body.classList.toggle("sidebar-compact"));
  byId("sidebarToggleButton")?.addEventListener("click", () => document.body.classList.toggle("sidebar-compact"));

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

async function handleLogin() {
  const email = byId("loginCode").value.trim();
  const password = byId("loginPass").value;
  byId("legacyLoginError").textContent = "";
  if (!email || !password) {
    byId("legacyLoginError").textContent = "Informe e-mail e senha.";
    return;
  }
  setLoginBusy(true, "Validando usuario e senha");
  try {
    const payload = await login({ email, password });
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
  installHotelSelector(hotels);
  configureAuthorizedNavigation(session?.permissions || []);
  showApplication();
  await refreshAll();
  switchTab(state.route);
}

function installHotelSelector(hotels) {
  const title = document.querySelector("#appShell h1");
  if (!title) return;
  const select = document.createElement("select");
  select.id = "legacyHotelSelect";
  select.className = "legacy-hotel-select";
  select.setAttribute("aria-label", "Unidade do ERP");
  select.innerHTML = hotels
    .map((hotel) => `<option value="${escapeAttr(hotel.hotel_id)}">${escapeHtml(hotel.name || hotel.short_name || hotel.hotel_id)}</option>`)
    .join("");
  select.value = state.hotelId;
  select.addEventListener("change", async () => {
    state.hotelId = select.value;
    localStorage.setItem("fioreze-rs-hotel", state.hotelId);
    state.cart.clear();
    await refreshAll();
    renderActiveRoute();
  });
  title.replaceWith(select);
}

function configureAuthorizedNavigation(permissions) {
  const allowed = new Set(permissions);
  const canRead = allowed.has("room-service.orders.read");
  const canWrite = allowed.has("room-service.orders.write");
  setNavigationVisibility("btnTabVendas", canWrite);
  setNavigationVisibility("btnTabFaturamento", canRead);
  setNavigationVisibility("btnTabCardapio", canRead);
  setNavigationVisibility("btnTabAdmin", canRead);
  byId("accountConfigButton").classList.toggle("hidden", !canRead);
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
    const [context, dashboard, orders, catalog, guests, billing] = await Promise.all([
      getContext({ hotelId }),
      getDashboard({ hotelId }),
      listOrders({ hotelId }),
      getCatalog({ hotelId }),
      getGuests({ hotelId }),
      getBilling({ hotelId }),
    ]);
    state.context = context.data;
    state.dashboard = dashboard.data;
    state.orders = orders.data.orders || [];
    state.catalog = catalog.data || { categories: [] };
    state.guests = guests.data;
    state.billing = billing.data;
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
  const logo = safeImage(state.context?.branding?.logo_url);
  if (!logo) return;
  document.querySelectorAll(".side-brand-logo, .side-brand-logo-seal").forEach((image) => {
    image.src = logo;
    image.alt = state.context?.hotel?.name || "Unidade Fioreze";
  });
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
}

function switchTab(route) {
  if (!ROUTES[route] || byId(ROUTES[route].button).classList.contains("hidden")) route = "dashboard";
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
  renderActiveRoute();
}

function renderActiveRoute() {
  if (state.route === "dashboard") renderDashboard();
  if (state.route === "hist") renderOrders();
  if (state.route === "vendas") renderMenu();
  if (state.route === "hospedes") renderGuests();
  if (state.route === "faturamento") renderBilling();
  if (state.route === "cardapio") renderCatalog();
}

function renderDashboard() {
  const summary = state.dashboard?.summary || {};
  const orders = filteredOrders(byId("topSearchInput")?.value);
  const completed = orders.filter((order) => order.status === "completed");
  const revenue = summary.revenue_cents ?? completed.reduce((total, order) => total + Number(order.total_cents || 0), 0);
  const origins = countBy(orders, (order) => order.origin || "portal");
  const statuses = countBy(orders, (order) => order.status || "received");

  setText("dashSummaryLabel", `${state.context?.hotel?.name || "Unidade"} - visao operacional`);
  setText("kpiVendas", summary.today_orders ?? orders.length);
  byId("kpiReceitaCard").classList.remove("hidden");
  setText("kpiReceita", money(revenue));
  setText("kpiTicket", money(summary.average_ticket_cents || 0));
  setText("kpiOnline", origins.public || origins.portal || origins.web || 0);
  setText("kpiRecepcao", origins.admin_pdv || 0);
  setText("kpiObs", orders.filter((order) => order.notes).length);
  setText("dashChannelMeta", `${orders.length} pedidos`);

  renderBars(byId("dashTopItemsList"), Object.entries(statuses).map(([key, value]) => [STATUS_LABELS[key] || key, value]));
  renderBars(byId("dashChannelBars"), Object.entries(origins).map(([key, value]) => [originLabel(key), value]));

  const recent = state.dashboard?.recent_orders || orders.slice(0, 8);
  setText("dashLastOrdersMeta", `${recent.length} itens`);
  byId("dashLastOrders").innerHTML = recent.length
    ? recent.map((order) => `<button type="button" class="dash-list-item" data-order-id="${escapeAttr(order.id)}"><span><strong>${escapeHtml(order.public_id || "Pedido")}</strong><small>Apto ${escapeHtml(order.room_code || "-")}</small></span><span>${money(order.total_cents)}<small>${statusLabel(order.status)}</small></span></button>`).join("")
    : '<div class="legacy-dashboard-empty">Nenhum pedido encontrado.</div>';
  bindOrderButtons(byId("dashLastOrders"));

  const topStatus = Object.entries(statuses).sort((a, b) => b[1] - a[1])[0];
  setText("dashTopItem", topStatus ? statusLabel(topStatus[0]) : "-");
  setText("dashTopItemMeta", topStatus ? `${topStatus[1]} pedidos` : "Sem pedidos ainda");
  const peak = peakHour(orders);
  setText("dashPeakHour", peak?.[0] || "-");
  setText("dashPeakMeta", peak ? `${peak[1]} pedidos` : "Sem pedidos ainda");
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
  const categories = (state.catalog?.categories || []).map((category) => ({ ...category, items: (category.items || []).filter((item) => !query || normalize(`${item.name} ${category.name}`).includes(query)) })).filter((category) => category.items.length);
  const total = categories.reduce((sum, category) => sum + category.items.length, 0);
  setText("menuAdminSummary", `${total} itens - leitura da base Cloudflare`);
  byId("menuCategoryBoard").innerHTML = categories.length ? categories.map((category) => `<section class="menu-category-column"><div class="menu-category-head"><strong>${escapeHtml(category.name)}</strong><span>${category.items.length}</span></div><div class="menu-category-list">${category.items.map((item) => `<article class="menu-admin-card"><div><strong>${escapeHtml(item.name)}</strong><small>${item.available === false ? "Indisponivel" : "Disponivel"}</small></div><b>${money(item.price_cents, item.currency)}</b></article>`).join("")}</div></section>`).join("") : '<div class="legacy-list-empty">Nenhum item encontrado.</div>';
  document.querySelectorAll("#cardapioContainer .admin-primary-btn, #cardapioContainer .admin-secondary-btn").forEach((button) => {
    button.disabled = true;
    button.title = "Edicao de catalogo sera habilitada em uma etapa controlada.";
  });
}

function renderAdmin() {
  const user = state.session?.user;
  setText("adminUserCount", user ? "1 sessao ativa" : "0 usuarios");
  byId("userList").innerHTML = user ? `<article class="admin-user-row"><div><strong>${escapeHtml(user.display_name || "Usuario")}</strong><small>${escapeHtml(user.email || "Sessao administrativa")}</small></div><span class="legacy-status-chip">Ativo</span></article>` : '<div class="legacy-list-empty">Nenhuma sessao ativa.</div>';
  document.querySelectorAll("#adminContainer button").forEach((button) => {
    button.disabled = true;
    button.title = "Gestao completa disponivel na Central Administrativa.";
  });
}

function updateHeaderState() {
  const service = currentServiceState();
  byId("hdrStoreButton").classList.remove("hidden");
  setText("hdrStoreStatus", service.label);
  setText("hdrStoreMode", "D1");
  setText("loginStoreStatus", service.label);
  setText("loginStoreMode", "D1");
}

function currentServiceState() {
  const hours = state.context?.service_hours || [];
  if (!hours.length) return { label: "SEM HORARIO" };
  const now = new Date();
  const timezone = state.context?.hotel?.timezone || "America/Sao_Paulo";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now).map((part) => [part.type, part.value]));
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const rows = hours.filter((row) => Number(row.day_of_week) === dayMap[parts.weekday] && !row.is_closed);
  const open = rows.some((row) => minute >= timeToMinute(row.opens_at) && minute <= timeToMinute(row.closes_at));
  return { label: open ? "ABERTO" : "FECHADO" };
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
  return url.startsWith("/media/") || url.startsWith("/assets/") ? url : "";
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

function plusIcon() {
  return '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M12 4v16m8-8H4"/></svg>';
}

function cartIcon() {
  return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13H17"/></svg>';
}
