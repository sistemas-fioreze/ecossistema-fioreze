import { STATUS_LABELS } from "./static-config.js";

export function renderDashboard({ outlet, orders, hotel, dashboard }) {
  const todayOrders = dashboard?.recent_orders || orders || [];
  const summary = dashboard?.summary || {};
  const total = summary.revenue_cents ?? todayOrders.reduce((sum, order) => sum + Number(order.total_cents || 0), 0);
  const active = summary.active_orders ?? todayOrders.filter((order) => ["received", "preparing", "ready"].includes(order.status)).length;
  const completed = summary.completed_orders ?? todayOrders.filter((order) => order.status === "completed").length;
  const cancelled = summary.cancelled_orders ?? todayOrders.filter((order) => order.status === "cancelled").length;
  const byStatus = Object.keys(STATUS_LABELS).map((status) => ({
    status,
    label: STATUS_LABELS[status],
    total: dashboard?.by_status?.[status] ?? todayOrders.filter((order) => order.status === status).length,
  }));

  outlet.innerHTML = `
    <section class="rs-panel">
      <p class="rs-kicker">Dashboard</p>
      <h1>${escapeHtml(hotel?.short_name || hotel?.name || "Unidade")}</h1>
      <p class="rs-muted">Resumo inicial calculado a partir dos pedidos disponiveis para a sessao.</p>
    </section>
    <section class="rs-dashboard-grid">
      ${stat("Pedidos", summary.total_orders ?? todayOrders.length)}
      ${stat("Em andamento", active)}
      ${stat("Concluidos", completed)}
      ${stat("Cancelados", cancelled)}
    </section>
    <section class="rs-panel">
      <h2>Faturamento visivel</h2>
      <strong>${formatMoney(total)}</strong>
      <p class="rs-muted">Indicadores calculados pelo Worker para a unidade selecionada.</p>
    </section>
    <section class="rs-panel">
      <h2>Pedidos por status</h2>
      <div class="rs-chart-bars">
        ${byStatus.map((entry) => chartRow(entry, Math.max(todayOrders.length, 1))).join("")}
      </div>
    </section>
  `;
}

function stat(label, value) {
  return `<article class="rs-panel rs-stat-card"><span class="rs-muted">${label}</span><strong>${Number(value || 0)}</strong></article>`;
}

function chartRow(entry, total) {
  const width = Math.max(4, Math.round((entry.total / total) * 100));
  return `<div class="rs-chart-row"><strong>${escapeHtml(entry.label)}</strong><span style="width:${width}%"></span><em>${entry.total}</em></div>`;
}

function formatMoney(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents || 0) / 100);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
