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

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
