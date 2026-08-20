export function renderCatalog({ outlet, catalog }) {
  const categories = catalog?.categories || [];
  outlet.innerHTML = `
    <section class="rs-panel">
      <p class="rs-kicker">Editor de Cardápio</p>
      <h1>Catálogo Room Service</h1>
      <p class="rs-muted">Categorias, produtos, disponibilidade e imagens lidos do ecossistema.</p>
    </section>
    <section class="rs-panel">
      ${
        categories.length
          ? categories.map((category) => categoryBlock(category)).join("")
          : '<div class="rs-empty">Nenhuma categoria ativa encontrada para esta unidade.</div>'
      }
    </section>
  `;
}

function categoryBlock(category) {
  const items = category.items || [];
  return `
    <article class="rs-catalog-category">
      <div class="rs-panel-heading">
        <h2>${escapeHtml(category.name)}</h2>
        <span class="rs-muted">${items.length} item(ns)</span>
      </div>
      <div class="rs-catalog-items">
        ${items.map(itemRow).join("") || '<div class="rs-empty">Categoria sem produtos ativos.</div>'}
      </div>
    </article>
  `;
}

function itemRow(item) {
  return `
    <div class="rs-detail-row">
      <span>
        <strong>${escapeHtml(item.name)}</strong>
        <small class="rs-muted">${item.available ? "Disponível" : escapeHtml(item.availability_label || "Indisponível")}</small>
      </span>
      <strong>${formatMoney(item.price_cents, item.currency)}</strong>
    </div>
  `;
}

function formatMoney(cents, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(cents || 0) / 100);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
