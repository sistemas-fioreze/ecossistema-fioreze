import { adminApi } from "./shared/admin-api.js";
import { createAdminAuthView } from "./shared/admin-auth-view.js";
import { canAccessRoomService } from "./shared/admin-session.js";
import { debounce, escapeAttr, escapeHtml, formatDate, formatMoney } from "./shared/format.js";

const state = {
  session: null,
  hotels: [],
  orders: [],
  selectedOrderId: null,
  selectedOrder: null,
};

const els = {
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

els.refreshButton.addEventListener("click", () => loadOrders());
els.hotelFilter.addEventListener("change", () => loadOrders());
els.statusFilter.addEventListener("change", () => loadOrders());
els.searchFilter.addEventListener("input", debounce(() => loadOrders(), 260));

const auth = createAdminAuthView({
  async onAuthenticated(session) {
    state.session = session;
    await startDashboard();
  },
  onLoggedOut() {
    state.session = null;
    state.hotels = [];
    state.orders = [];
    state.selectedOrderId = null;
    state.selectedOrder = null;
  },
});

auth.boot();

async function startDashboard() {
  state.hotels = state.session?.hotels || [];
  if (!canAccessRoomService(state.session)) {
    els.dashboardError.textContent = "Permissão administrativa insuficiente para o Room Service.";
    els.ordersList.innerHTML = '<div class="admin-empty">Acesso ao Room Service não disponível para este usuário.</div>';
    renderEmptyDetail();
    return;
  }
  renderHotelFilter();
  await loadOrders();
}

async function loadOrders() {
  els.dashboardError.textContent = "";
  els.ordersList.setAttribute("aria-busy", "true");
  const params = new URLSearchParams();
  if (els.hotelFilter.value) params.set("hotel_id", els.hotelFilter.value);
  if (els.statusFilter.value) params.set("status", els.statusFilter.value);
  if (els.searchFilter.value.trim()) params.set("q", els.searchFilter.value.trim());

  try {
    const payload = await adminApi(`/api/v1/admin/orders?${params.toString()}`);
    state.orders = payload.data.orders || [];
    if (!state.orders.some((order) => order.id === state.selectedOrderId)) {
      state.selectedOrderId = state.orders[0]?.id || null;
    }
    renderOrders();
    if (state.selectedOrderId) await loadOrderDetail(state.selectedOrderId);
    else renderEmptyDetail();
  } catch (error) {
    els.ordersList.innerHTML = '<div class="admin-empty">Não foi possível carregar pedidos.</div>';
    els.dashboardError.textContent = error.message || "Erro ao carregar pedidos.";
  } finally {
    els.ordersList.removeAttribute("aria-busy");
  }
}

async function loadOrderDetail(orderId) {
  state.selectedOrderId = orderId;
  els.orderDetail.setAttribute("aria-busy", "true");
  renderOrders();
  try {
    const payload = await adminApi(`/api/v1/admin/orders/${encodeURIComponent(orderId)}`);
    state.selectedOrder = payload.data.order;
    renderOrderDetail();
  } catch (error) {
    els.orderDetail.innerHTML = `<div class="admin-detail-empty">${escapeHtml(error.message || "Pedido não encontrado.")}</div>`;
  } finally {
    els.orderDetail.removeAttribute("aria-busy");
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
    const payload = await adminApi(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: "POST",
      body: { status, note },
    });
    state.selectedOrder = payload.data.order;
    await loadOrders();
  } catch (error) {
    els.dashboardError.textContent = error.message || "Não foi possível atualizar o status.";
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
        ${infoBox("Hóspede", order.guest_name)}
        ${infoBox("Local", order.delivery?.location)}
        ${infoBox("Acomodação", order.delivery?.room_code || order.room_code)}
        ${infoBox("Contato", order.delivery?.contact || "Não informado")}
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
        <div class="admin-info-box">${escapeHtml(order.delivery?.observation || "Sem observacao.")}</div>
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
  return `<div class="admin-info-box"><span>${escapeHtml(label)}</span>${escapeHtml(value || "Não informado")}</div>`;
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}
