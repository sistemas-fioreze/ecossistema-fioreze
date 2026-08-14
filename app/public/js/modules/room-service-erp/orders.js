import { getOrder, listOrders } from "./api.js";
import { STATUS_LABELS } from "./static-config.js";
import { formatDate, formatMoney } from "../admin/shared/format.js";

export async function loadOrdersForHotel({ hotelId, status = "", q = "" }) {
  const payload = await listOrders({ hotelId, status, q });
  return payload.data.orders || [];
}

export function renderOrders({ outlet, orders, selectedOrder, onSelect }) {
  outlet.innerHTML = `
    <section class="rs-orders-shell">
      <header class="rs-orders-head">
        <div>
          <p class="rs-kicker">Pedidos</p>
          <h1>Fila operacional</h1>
          <span>Lista oficial do Room Service · impressão desativada neste ambiente</span>
        </div>
        <strong>${orders.length} pedido(s)</strong>
      </header>
      <section class="rs-orders-layout">
      <div class="rs-panel rs-orders-list-panel">
        <h2>Pedidos recentes</h2>
        <div class="rs-order-list">
          ${orders.length ? orders.map((order) => orderCard(order, selectedOrder?.id)).join("") : '<div class="rs-empty">Nenhum pedido encontrado.</div>'}
        </div>
      </div>
      <aside class="rs-panel rs-order-detail-panel" id="orderDetailPanel">
        ${selectedOrder ? renderOrderDetail(selectedOrder) : '<div class="rs-empty">Selecione um pedido.</div>'}
      </aside>
      </section>
    </section>
  `;

  for (const button of outlet.querySelectorAll("[data-order-id]")) {
    button.addEventListener("click", () => onSelect(button.dataset.orderId));
  }
}

export async function fetchOrderDetail(orderId) {
  const payload = await getOrder(orderId);
  return payload.data.order;
}

function orderCard(order, selectedId) {
  return `
    <button class="rs-order-card" type="button" data-order-id="${escapeAttr(order.id)}" aria-current="${order.id === selectedId}">
      <span class="rs-order-row"><strong>${escapeHtml(orderDisplayLabel(order))}</strong><span class="rs-status-chip">${statusLabel(order.status)}</span></span>
      <span class="rs-order-row"><span>${escapeHtml(order.room_code || "Sem acomodacao")}</span><span>${formatMoney(order.total_cents, order.currency)}</span></span>
      <small class="rs-muted">${escapeHtml(formatDate(order.created_at, order.timezone))} - ${Number(order.item_count || 0)} item(ns)</small>
    </button>
  `;
}

function renderOrderDetail(order) {
  return `
    <p class="rs-kicker">Detalhes</p>
    <h2>${escapeHtml(orderDisplayLabel(order))}</h2>
    <div class="rs-detail-grid">
      ${detail("Status", statusLabel(order.status))}
      ${detail("Hotel", order.hotel_name)}
      ${detail("Hospede", order.guest_name || "Nao informado")}
      ${detail("Acomodacao", order.delivery?.room_code || order.room_code || "Nao informada")}
      ${detail("Origem", order.origin)}
      ${detail("Total", formatMoney(order.total_cents, order.currency))}
    </div>
    <h3>Itens</h3>
    ${(order.items || []).map((item) => `<div class="rs-detail-row"><span>${escapeHtml(item.quantity)}x ${escapeHtml(item.name)}${item.selected_options?.note ? `<small class="rs-muted">Observação: ${escapeHtml(item.selected_options.note)}</small>` : ""}</span><strong>${formatMoney(item.line_total_cents, order.currency)}</strong></div>`).join("") || '<div class="rs-empty">Sem itens.</div>'}
    <h3>Historico</h3>
    ${(order.history || []).map((entry) => `<div class="rs-detail-row"><span>${statusLabel(entry.status)}</span><small>${escapeHtml(formatDate(entry.created_at, order.timezone))}</small></div>`).join("") || '<div class="rs-empty">Sem historico.</div>'}
    <h3>Impressao</h3>
    <p class="rs-muted">${escapeHtml(order.printing?.message || "Impressao desativada neste ambiente.")}</p>
  `;
}

function detail(label, value) {
  return `<div class="rs-panel"><span class="rs-muted">${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></div>`;
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
}

function orderDisplayLabel(order) {
  const displayNumber = Number(order?.display_number || 0);
  if (displayNumber > 0) return `Pedido #${displayNumber}`;
  const legacyNumber = String(order?.public_id || "").match(/(?:^|[-_])(\d{1,8})$/)?.[1];
  return legacyNumber ? `Pedido #${legacyNumber}` : "Pedido";
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
