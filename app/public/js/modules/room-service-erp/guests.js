export function renderGuests({ outlet }) {
  outlet.innerHTML = `
    <section class="rs-panel">
      <p class="rs-kicker">Hospedes</p>
      <h1>Hospedes e acomodacoes</h1>
      <p class="rs-muted">Sem integracao PMS nesta fase. A tela permanece pronta para dados autorizados do ecossistema.</p>
    </section>
    <section class="rs-panel"><div class="rs-empty">Nenhum dado de hospede e armazenado localmente.</div></section>
  `;
}
