import { createPdvOrder } from "./api.js";

export function renderPos({ outlet, hotel, catalog, erpContext, onOrderCreated }) {
  const products = (catalog?.categories || []).flatMap((category) =>
    (category.items || []).map((item) => ({ ...item, category_name: category.name })),
  );
  const cart = new Map();

  outlet.innerHTML = `
    <section class="rs-panel">
      <p class="rs-kicker">PDV Direto</p>
      <h1>Pedido manual pela equipe</h1>
      <p class="rs-muted">Registre pedidos feitos diretamente pela equipe da unidade.</p>
    </section>
    <section class="rs-pos-layout">
      <div class="rs-panel">
        <h2>Produtos</h2>
        <div class="rs-pos-grid">
          ${products.map(productCard).join("") || '<div class="rs-empty">Nenhum produto ativo para esta unidade.</div>'}
        </div>
      </div>
      <form id="pdvOrderForm" class="rs-panel rs-pdv-form">
        <h2>Carrinho</h2>
        <div id="pdvCart" class="rs-cart-lines"><div class="rs-empty">Selecione produtos do catálogo.</div></div>
        <label><span>Hóspede (opcional)</span><input name="guest_name" maxlength="120"></label>
        <label><span>Acomodação</span>${roomSelect(erpContext?.rooms || [])}</label>
        <label><span>Observação</span><textarea name="notes" maxlength="500"></textarea></label>
        <button class="rs-primary-button" type="submit">Criar pedido PDV</button>
        <p id="pdvMessage" class="rs-muted" role="status" aria-live="polite"></p>
      </form>
    </section>
  `;

  const cartEl = outlet.querySelector("#pdvCart");
  const messageEl = outlet.querySelector("#pdvMessage");

  for (const button of outlet.querySelectorAll("[data-product-id]")) {
    button.addEventListener("click", () => {
      const item = products.find((product) => product.id === button.dataset.productId);
      if (!item || item.available === false) return;
      const current = cart.get(item.id) || { item, quantity: 0 };
      current.quantity += 1;
      cart.set(item.id, current);
      renderCart(cartEl, cart);
    });
  }

  outlet.querySelector("#pdvOrderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!cart.size) {
      messageEl.textContent = "Adicione ao menos um produto.";
      return;
    }
    const form = new FormData(event.currentTarget);
    messageEl.textContent = "Criando pedido...";
    try {
      const created = await createPdvOrder(
        {
          hotel_id: hotel.hotel_id,
          guest_name: form.get("guest_name"),
          room_code: form.get("room_code"),
          notes: form.get("notes"),
          items: [...cart.values()].map(({ item, quantity }) => ({
            catalog_item_id: item.id,
            quantity,
            unit_price_cents: item.price_cents,
          })),
        },
        `admin-pdv-${crypto.randomUUID()}`,
      );
      cart.clear();
      event.currentTarget.reset();
      renderCart(cartEl, cart);
      messageEl.innerHTML = `<img src="/assets/room-service/order-sent.gif" alt="" width="88" height="66"><strong>Pedido enviado</strong><span>${created?.data?.impression?.queued ? "Pedido criado e enviado para impressão." : "Pedido criado com sucesso."}</span>`;
      await onOrderCreated?.();
    } catch (error) {
      messageEl.textContent = error.message || "Não foi possível criar o pedido.";
    }
  });
}

function productCard(item) {
  return `
    <button class="rs-product-card" type="button" data-product-id="${escapeAttr(item.id)}" ${item.available === false ? "disabled" : ""}>
      <span class="rs-muted">${escapeHtml(item.category_name)}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <span>${formatMoney(item.price_cents, item.currency)}</span>
      <small>${item.available === false ? escapeHtml(item.availability_label || "Indisponível") : "Adicionar ao carrinho"}</small>
    </button>
  `;
}

function roomSelect(rooms) {
  return `
    <select name="room_code" required>
      <option value="">Selecione</option>
      ${rooms.map((room) => `<option value="${escapeAttr(room.code)}">${escapeHtml(room.code)}</option>`).join("")}
    </select>
  `;
}

function renderCart(target, cart) {
  const rows = [...cart.values()];
  target.innerHTML = rows.length
    ? rows
        .map(
          ({ item, quantity }) =>
            `<div class="rs-detail-row"><span>${quantity}x ${escapeHtml(item.name)}</span><strong>${formatMoney(item.price_cents * quantity, item.currency)}</strong></div>`,
        )
        .join("")
    : '<div class="rs-empty">Selecione produtos do catálogo.</div>';
}

function formatMoney(cents, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(cents || 0) / 100);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
