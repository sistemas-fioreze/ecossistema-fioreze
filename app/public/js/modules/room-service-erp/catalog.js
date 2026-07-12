export function renderCatalog({ outlet }) {
  outlet.innerHTML = `
    <section class="rs-panel">
      <p class="rs-kicker">Editor de Cardapio</p>
      <h1>Catalogo Room Service</h1>
      <p class="rs-muted">Esta fundacao usara categorias, produtos, disponibilidade e imagens da Biblioteca de Imagens.</p>
    </section>
    <section class="rs-panel">
      <div class="rs-empty">URLs externas arbitrarias nao serao aceitas como imagem principal.</div>
    </section>
  `;
}
