export function renderPos({ outlet }) {
  outlet.innerHTML = `
    <section class="rs-panel">
      <p class="rs-kicker">PDV Direto</p>
      <h1>Pedido manual pela equipe</h1>
      <p class="rs-muted">A interface visual foi reservada para o PR operacional. Nenhum pedido offline ou ficticio e criado nesta fase.</p>
    </section>
    <section class="rs-panel">
      <div class="rs-empty">Produtos e carrinho serao carregados do catalogo D1/R2 na proxima etapa.</div>
    </section>
  `;
}
