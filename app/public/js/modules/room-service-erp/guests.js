export function renderGuests({ outlet, guestsData }) {
  const rooms = guestsData?.rooms || [];
  outlet.innerHTML = `
    <section class="rs-panel">
      <p class="rs-kicker">Hospedes</p>
      <h1>Hospedes e acomodacoes</h1>
      <p class="rs-muted">${escapeHtml(guestsData?.message || "Sem integracao PMS nesta fase.")}</p>
    </section>
    <section class="rs-panel">
      <h2>Acomodacoes ativas</h2>
      <div class="rs-room-grid">
        ${rooms.map((room) => `<span class="rs-status-chip">${escapeHtml(room.code)}</span>`).join("") || '<div class="rs-empty">Nenhuma acomodacao cadastrada para esta unidade.</div>'}
      </div>
      <p class="rs-muted">Nenhum dado de hospede e armazenado localmente.</p>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
