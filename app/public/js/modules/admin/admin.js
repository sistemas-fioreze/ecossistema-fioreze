const state = {
  session: null,
  hotels: [],
  orders: [],
  selectedOrderId: null,
  selectedOrder: null,
};

const els = {
  app: document.getElementById("adminApp"),
  loginView: document.querySelector('[data-view="login"]'),
  dashboardView: document.querySelector('[data-view="dashboard"]'),
  loadingView: document.querySelector('[data-view="loading"]'),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginButton: document.getElementById("loginButton"),
  loginError: document.getElementById("loginError"),
  sessionUser: document.getElementById("sessionUser"),
  logoutButton: document.getElementById("logoutButton"),
  hotelFilter: document.getElementById("hotelFilter"),
  statusFilter: document.getElementById("statusFilter"),
  searchFilter: document.getElementById("searchFilter"),
  refreshButton: document.getElementById("refreshButton"),
  dashboardError: document.getElementById("dashboardError"),
  ordersList: document.getElementById("ordersList"),
  ordersCount: document.getElementById("ordersCount"),
  orderDetail: document.getElementById("orderDetail"),
};

const STATUS_LABELS = {
  received: "Recebido",
  preparing: "Em preparo",
  ready: "Pronto",
  completed: "Concluido",
  cancelled: "Cancelado",
};

els.loginForm.addEventListener("submit", handleLogin);
els.logoutButton.addEventListener("click", handleLogout);
els.refreshButton.addEventListener("click", () => loadOrders());
els.hotelFilter.addEventListener("change", () => loadOrders());
els.statusFilter.addEventListener("change", () => loadOrders());
els.searchFilter.addEventListener("input", debounce(() => loadOrders(), 260));

boot();

async function boot() {
  showView("loading");
  try {
    const payload = await api("/api/v1/admin/session");
    state.session = payload.data;
    await startDashboard();
  } catch (error) {
    if (error.status === 401) {
      showView("login");
      return;
    }
    showView("login");
    els.loginError.textContent = "Nao foi possivel verificar a sessao administrativa.";
  }
}

async function handleLogin(event) {
  event.preventDefault();
  els.loginError.textContent = "";
  els.loginButton.disabled = true;
  els.loginButton.textContent = "Entrando...";
  try {
    const payload = await api("/api/v1/admin/login", {
      method: "POST",
      body: {
        email: els.loginEmail.value,
        password: els.loginPassword.value,
      },
    });
    state.session = payload.data;
    els.loginPassword.value = "";
    await startDashboard();
  } catch (error) {
    els.loginError.textContent = error.message || "Falha ao entrar.";
  } finally {
    els.loginButton.disabled = false;
    els.loginButton.textContent = "Entrar";
  }
}

async function handleLogout() {
  await api("/api/v1/admin/logout", { method: "POST", body: {} }).catch(() => null);
  state.session = null;
  state.orders = [];
  state.selectedOrder = null;
  state.selectedOrderId = null;
  showView("login");
}

async function startDashboard() {
  showView("dashboard");
  els.sessionUser.textContent = state.session?.user?.display_name || "Usuario";
  state.hotels = state.session?.hotels || [];
  renderHotelFilter();
  await loadOrders();
}

async function loadOrders() {
  els.dashboardError.textContent = "";
  els.ordersList.innerHTML = '<div class="admin-empty">Carregando pedidos...</div>';
  const params = new URLSearchParams();
  if (els.hotelFilter.value) params.set("hotel_id", els.hotelFilter.value);
  if (els.statusFilter.value) params.set("status", els.statusFilter.value);
  if (els.searchFilter.value.trim()) params.set("q", els.searchFilter.value.trim());

  try {
    const payload = await api(`/api/v1/admin/orders?${params.toString()}`);
    state.orders = payload.data.orders || [];
    if (!state.orders.some((order) => order.id === state.selectedOrderId)) {
      state.selectedOrderId = state.orders[0]?.id || null;
    }
    renderOrders();
    if (state.selectedOrderId) await loadOrderDetail(state.selectedOrderId);
    else renderEmptyDetail();
  } catch (error) {
    els.ordersList.innerHTML = '<div class="admin-empty">Nao foi possivel carregar pedidos.</div>';
    els.dashboardError.textContent = error.message || "Erro ao carregar pedidos.";
  }
}

async function loadOrderDetail(orderId) {
  state.selectedOrderId = orderId;
  els.orderDetail.innerHTML = '<div class="admin-detail-empty">Carregando detalhes...</div>';
  renderOrders();
  try {
    const payload = await api(`/api/v1/admin/orders/${encodeURIComponent(orderId)}`);
    state.selectedOrder = payload.data.order;
    renderOrderDetail();
  } catch (error) {
    els.orderDetail.innerHTML = `<div class="admin-detail-empty">${escapeHtml(error.message || "Pedido nao encontrado.")}</div>`;
  }
}

async function updateStatus(orderId, status) {
  let note = "";
  if (status === "cancelled") {
    note = window.prompt("Informe o motivo do cancelamento:");
    if (!note) return;
  }
  if (status === "completed" && !window.confirm("Concluir este pedido?")) return;

  els.dashboardError.textContent = "";
  try {
    const payload = await api(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: "POST",
      body: { status, note },
    });
    state.selectedOrder = payload.data.order;
    await loadOrders();
  } catch (error) {
    els.dashboardError.textContent = error.message || "Nao foi possivel atualizar o status.";
  }
}

function renderHotelFilter() {
  els.hotelFilter.innerHTML = state.hotels
    .map((hotel) => `<option value="${escapeAttr(hotel.hotel_id)}">${escapeHtml(hotel.name)}</option>`)
    .join("");
}

function renderOrders() {
  els.ordersCount.textContent = String(state.orders.length);
  if (!state.orders.length) {
    els.ordersList.innerHTML = '<div class="admin-empty">Nenhum pedido encontrado.</div>';
    return;
  }
  els.ordersList.innerHTML = state.orders
    .map(
      (order) => `
        <button class="admin-order-card" type="button" data-order-id="${escapeAttr(order.id)}" aria-current="${order.id === state.selectedOrderId}">
          <span class="admin-order-main">
            <strong>${escapeHtml(order.public_id)}</strong>
            <span class="admin-status">${statusLabel(order.status)}</span>
          </span>
          <span class="admin-order-meta">
            <span>${escapeHtml(formatDate(order.created_at, order.timezone))}</span>
            <span>${escapeHtml(order.room_code || "Sem acomodacao")}</span>
          </span>
          <span class="admin-money-row">
            <span>${Number(order.item_count || 0)} itens</span>
            <strong>${formatMoney(order.total_cents, order.currency)}</strong>
          </span>
        </button>
      `,
    )
    .join("");

  for (const button of els.ordersList.querySelectorAll("[data-order-id]")) {
    button.addEventListener("click", () => loadOrderDetail(button.dataset.orderId));
  }
}

function renderOrderDetail() {
  const order = state.selectedOrder;
  if (!order) {
    renderEmptyDetail();
    return;
  }
  els.orderDetail.innerHTML = `
    <div class="admin-detail-content">
      <div class="admin-detail-header">
        <div>
          <p class="eyebrow">${escapeHtml(order.module_key)}</p>
          <h2>${escapeHtml(order.public_id)}</h2>
          <p class="admin-muted">${escapeHtml(formatDate(order.created_at, order.timezone))}</p>
        </div>
        <span class="admin-status">${statusLabel(order.status)}</span>
      </div>

      <div class="admin-detail-grid">
        ${infoBox("Hotel", order.hotel_name)}
        ${infoBox("Origem", order.origin)}
        ${infoBox("Hospede", order.guest_name)}
        ${infoBox("Acomodacao", order.delivery?.room_code || order.room_code)}
        ${infoBox("Local", order.delivery?.location)}
        ${infoBox("Contato", order.delivery?.contact || "Nao informado")}
      </div>

      <section>
        <h3>Itens</h3>
        <div class="admin-items">
          ${order.items.map(renderItem).join("")}
        </div>
      </section>

      <section>
        <h3>Totais</h3>
        <div class="admin-info-box">
          <div class="admin-money-row"><span>Subtotal</span><strong>${formatMoney(order.subtotal_cents, order.currency)}</strong></div>
          <div class="admin-money-row"><span>Total</span><strong>${formatMoney(order.total_cents, order.currency)}</strong></div>
        </div>
      </section>

      <section>
        <h3>Observacao</h3>
        <div class="admin-info-box">${escapeHtml(order.notes || "Sem observacao.")}</div>
      </section>

      <section>
        <h3>Status</h3>
        <div class="admin-status-actions">
          ${statusButton(order, "preparing", "Em preparo")}
          ${statusButton(order, "ready", "Pronto")}
          ${statusButton(order, "completed", "Concluir")}
          ${statusButton(order, "cancelled", "Cancelar", true)}
        </div>
      </section>

      <section>
        <h3>Historico</h3>
        <div class="admin-history">
          ${order.history.map(renderHistory).join("")}
        </div>
      </section>

      <section>
        <h3>Impressao</h3>
        <div class="admin-info-box">${escapeHtml(order.printing?.message || "Impressao desativada neste ambiente.")}</div>
      </section>
    </div>
  `;

  for (const button of els.orderDetail.querySelectorAll("[data-status]")) {
    button.addEventListener("click", () => updateStatus(order.id, button.dataset.status));
  }
}

function renderEmptyDetail() {
  els.orderDetail.innerHTML = '<div class="admin-detail-empty">Selecione um pedido.</div>';
}

function renderItem(item) {
  return `
    <div class="admin-line">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <p class="admin-muted">${Number(item.quantity)} x ${formatMoney(item.unit_price_cents)}</p>
      </div>
      <strong>${formatMoney(item.line_total_cents)}</strong>
    </div>
  `;
}

function renderHistory(entry) {
  return `
    <div class="admin-line">
      <div>
        <strong>${statusLabel(entry.status)}</strong>
        <p class="admin-muted">${escapeHtml(entry.note || "")}</p>
      </div>
      <span class="admin-muted">${escapeHtml(formatDate(entry.created_at, state.selectedOrder?.timezone))}</span>
    </div>
  `;
}

function statusButton(order, status, label, danger = false) {
  const disabled = !nextStatuses(order.status).includes(status);
  return `<button type="button" class="${danger ? "danger" : ""}" data-status="${status}" ${disabled ? "disabled" : ""}>${label}</button>`;
}

function nextStatuses(status) {
  const transitions = {
    received: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["completed", "cancelled"],
  };
  return transitions[status] || [];
}

function infoBox(label, value) {
  return `<div class="admin-info-box"><span>${escapeHtml(label)}</span>${escapeHtml(value || "Nao informado")}</div>`;
}

async function api(path, options = {}) {
  const init = {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  };
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.error?.message || "Falha na API administrativa.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function showView(view) {
  els.loginView.hidden = view !== "login";
  els.dashboardView.hidden = view !== "dashboard";
  els.loadingView.hidden = view !== "loading";
  els.app.dataset.state = view;
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function formatDate(value, timezone = "America/Sao_Paulo") {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone || "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatMoney(cents, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number(cents || 0) / 100);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
