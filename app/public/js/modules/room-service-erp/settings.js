export function renderSettings({ outlet, preferences }) {
  outlet.innerHTML = `
    <section class="rs-panel">
      <p class="rs-kicker">Configuracoes</p>
      <h1>Preferencias do ERP</h1>
      <p class="rs-muted">Somente preferencias visuais e a unidade preferida ficam no navegador.</p>
    </section>
    <section class="rs-settings-grid">
      <article class="rs-panel"><span class="rs-muted">Tema</span><strong>${preferences.theme}</strong></article>
      <article class="rs-panel"><span class="rs-muted">Modo compacto</span><strong>${preferences.compact ? "Ativo" : "Inativo"}</strong></article>
      <article class="rs-panel"><span class="rs-muted">Som</span><strong>${preferences.sound ? "Ativo" : "Inativo"}</strong></article>
    </section>
  `;
}
