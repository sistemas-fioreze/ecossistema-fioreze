export function renderGuests({ outlet, guestsData }) {
  const rooms = guestsData?.rooms || [];
  outlet.innerHTML = `
    <section class="rs-panel">
      <p class="rs-kicker">Hóspedes</p>
      <h1>Hóspedes e acomodações</h1>
      <p class="rs-muted">${escapeHtml(guestsData?.message || "Sem integração PMS nesta fase.")}</p>
    </section>
    <section class="rs-panel">
      <h2>Acomodações ativas</h2>
      <div class="rs-room-grid">
        ${rooms.map((room) => `<span class="rs-status-chip">${escapeHtml(room.code)}</span>`).join("") || '<div class="rs-empty">Nenhuma acomodação cadastrada para esta unidade.</div>'}
      </div>
      <p class="rs-muted">Nenhum dado de hóspede é armazenado localmente.</p>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
