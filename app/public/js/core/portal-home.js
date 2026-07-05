export function render(container, context) {
  container.innerHTML = `
    <section class="panel">
      <p class="eyebrow">Portal do hospede</p>
      <h2>${context.bootstrap.short_name || context.bootstrap.name}</h2>
      <p>Esta base local ja resolve o hotel, aplica identidade visual e carrega apenas modulos habilitados.</p>
    </section>
  `;
}
