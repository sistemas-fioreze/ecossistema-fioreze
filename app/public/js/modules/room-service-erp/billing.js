export function renderBilling({ outlet, orders, billing }) {
  const summary = billing?.summary || {};
  const total = summary.revenue_cents ?? (orders || []).reduce((sum, order) => sum + Number(order.total_cents || 0), 0);
  outlet.innerHTML = `
    <section class="rs-panel">
      <p class="rs-kicker">Faturamento</p>
      <h1>Resumo financeiro</h1>
      <p class="rs-muted">Resumo calculado pelo Worker para a unidade selecionada.</p>
    </section>
    <section class="rs-report-grid">
      <article class="rs-panel"><span class="rs-muted">Total visivel</span><strong>${formatMoney(total)}</strong></article>
      <article class="rs-panel"><span class="rs-muted">Pedidos entregues</span><strong>${summary.completed_orders ?? 0}</strong></article>
      <article class="rs-panel"><span class="rs-muted">Ticket medio</span><strong>${formatMoney(summary.average_ticket_cents)}</strong></article>
    </section>
    <section class="rs-panel"><div class="rs-empty">${escapeHtml(billing?.exports?.message || "Exportacoes ainda nao habilitadas.")}</div></section>
  `;
}

function formatMoney(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents || 0) / 100);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
