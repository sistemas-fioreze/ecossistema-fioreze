export function renderError(target, title, message) {
  target.innerHTML = `
    <section class="state-screen">
      <div class="panel">
        <p class="eyebrow">Nao foi possivel continuar</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
      </div>
    </section>
  `;
}

export function renderNotFound(target) {
  document.title = "404 | Fioreze";
  document.body.classList.add("has-public-not-found");
  target.className = "app-shell public-not-found-root";
  target.innerHTML = `
    <section class="public-not-found" aria-labelledby="notFoundTitle">
      <span class="public-not-found__logo">
        <img src="/assets/shared/fioreze-central-logo.jpg" alt="Fioreze Hotéis">
      </span>
      <h1 id="notFoundTitle">404</h1>
      <p>A página solicitada não pode ser encontrada.</p>
    </section>
  `;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
