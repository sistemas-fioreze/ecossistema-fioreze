export function renderBilling({ outlet, orders }) {
  const total = (orders || []).reduce((sum, order) => sum + Number(order.total_cents || 0), 0);
  outlet.innerHTML = `
    <section class="rs-panel">
      <p class="rs-kicker">Faturamento</p>
      <h1>Resumo financeiro</h1>
      <p class="rs-muted">Relatorios completos, filtros e exportacao entram no PR operacional.</p>
    </section>
    <section class="rs-report-grid">
      <article class="rs-panel"><span class="rs-muted">Total visivel</span><strong>${formatMoney(total)}</strong></article>
      <article class="rs-panel"><span class="rs-muted">Pedidos</span><strong>${(orders || []).length}</strong></article>
    </section>
  `;
}

function formatMoney(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents || 0) / 100);
}
