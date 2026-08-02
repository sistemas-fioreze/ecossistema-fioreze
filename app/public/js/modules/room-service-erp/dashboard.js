import { STATUS_LABELS } from "./static-config.js";

export function renderDashboard({ outlet, orders, hotel, dashboard }) {
  const todayOrders = dashboard?.recent_orders || orders || [];
  const summary = dashboard?.summary || {};
  const total = summary.revenue_cents ?? todayOrders.reduce((sum, order) => sum + Number(order.total_cents || 0), 0);
  const active = summary.active_orders ?? todayOrders.filter((order) => ["sent", "printed"].includes(order.status)).length;
  const completed = summary.completed_orders ?? todayOrders.filter((order) => order.status === "delivered").length;
  const cancelled = summary.cancelled_orders ?? todayOrders.filter((order) => order.status === "cancelled").length;
  const byStatus = Object.keys(STATUS_LABELS).map((status) => ({
    status,
    label: STATUS_LABELS[status],
    total: dashboard?.by_status?.[status] ?? todayOrders.filter((order) => order.status === status).length,
  }));

  outlet.innerHTML = `
    <section class="rs-dashboard-v2">
      <header class="rs-dashboard-head">
        <div>
          <h1>Dashboard Operacional</h1>
          <p>${escapeHtml(hotel?.short_name || hotel?.name || "Unidade")} · visão do Room Service</p>
        </div>
        <span class="rs-date-pill">${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())}</span>
      </header>
      <section class="rs-dashboard-grid">
        ${stat("Pedidos", summary.total_orders ?? todayOrders.length, "Total registrado")}
        ${stat("Em andamento", active, "Enviado ou impresso")}
        ${stat("Entregues", completed, "Finalizados")}
        ${stat("Cancelados", cancelled, "Interrompidos")}
      </section>
      <section class="rs-dashboard-columns">
        <article class="rs-panel rs-revenue-card">
          <p class="rs-kicker">Faturamento</p>
          <strong>${formatMoney(total)}</strong>
          <span>Indicadores calculados pelo Worker para a unidade selecionada.</span>
        </article>
        <article class="rs-panel">
          <div class="rs-panel-heading">
            <p class="rs-kicker">Status</p>
            <h2>Pedidos por status</h2>
          </div>
          <div class="rs-chart-bars">
            ${byStatus.map((entry) => chartRow(entry, Math.max(todayOrders.length, 1))).join("")}
          </div>
        </article>
      </section>
    </section>
  `;
}

function stat(label, value, meta) {
  return `<article class="rs-panel rs-stat-card"><span>${escapeHtml(label)}</span><strong>${Number(value || 0)}</strong><em>${escapeHtml(meta)}</em></article>`;
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
