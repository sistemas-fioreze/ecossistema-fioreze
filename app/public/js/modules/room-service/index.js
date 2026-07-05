import { apiGet, apiPost } from "../../core/api.js";
import { escapeHtml } from "../../core/errors.js";

let selectedItems = new Map();

export async function render(container, context) {
  await loadCss("/css/modules/room-service/room-service.css");
  const products = await apiGet(`/api/v1/public/hotels/${context.bootstrap.slug}/room-service/products`);
  selectedItems = new Map();
  container.innerHTML = `
    <section class="room-service-grid">
      <div class="panel">
        <p class="eyebrow">Room Service</p>
        <h2>Escolha os itens</h2>
        <div class="product-list" data-products>${renderProducts(products.categories)}</div>
      </div>
      <form class="panel" data-order-form>
        <p class="eyebrow">Pedido local</p>
        <label class="field"><span>Nome de demonstracao</span><input name="guest_name" autocomplete="off" required></label>
        <label class="field"><span>Acomodacao ficticia</span><input name="room_code" placeholder="D-101" autocomplete="off" required></label>
        <label class="field"><span>Observacoes</span><textarea name="notes" rows="3"></textarea></label>
        <div class="cart-list" data-cart><p class="status-message">Carrinho vazio.</p></div>
        <button class="primary-button" type="submit">Enviar pedido local</button>
        <p class="status-message" data-order-status hidden></p>
      </form>
    </section>
  `;

  container.querySelector("[data-products]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-item]");
    if (!button) return;
    const item = JSON.parse(button.dataset.addItem);
    const current = selectedItems.get(item.id) || { ...item, quantity: 0 };
    current.quantity += 1;
    selectedItems.set(item.id, current);
    renderCart(container);
  });

  container.querySelector("[data-order-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitOrder(container, context.bootstrap.slug, event.currentTarget);
  });
}

function renderProducts(categories) {
  return categories
    .map(
      (category) => `
        <section>
          <h3 class="category-title">${escapeHtml(category.name)}</h3>
          <div class="product-list">
            ${category.items.map(renderProduct).join("")}
          </div>
        </section>
      `,
    )
    .join("");
}

function renderProduct(item) {
  const payload = JSON.stringify({
    id: item.id,
    name: item.name,
    price_cents: item.price_cents,
    currency: item.currency,
  });
  return `
    <article class="product-card">
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.description || "")}</p>
      <div class="product-meta">
        <span>${formatMoney(item.price_cents, item.currency)}</span>
        ${
          item.available
            ? `<button class="ghost-button" data-add-item='${escapeHtml(payload)}' type="button">Adicionar</button>`
            : `<span>${escapeHtml(item.availability_label || "Indisponivel")}</span>`
        }
      </div>
    </article>
  `;
}

function renderCart(container) {
  const cart = container.querySelector("[data-cart]");
  const items = [...selectedItems.values()];
  if (!items.length) {
    cart.innerHTML = `<p class="status-message">Carrinho vazio.</p>`;
    return;
  }
  cart.innerHTML = items
    .map(
      (item) => `
        <div class="cart-row">
          <span>${escapeHtml(item.name)} x${item.quantity}</span>
          <strong>${formatMoney(item.price_cents * item.quantity, item.currency)}</strong>
        </div>
      `,
    )
    .join("");
}

async function submitOrder(container, slug, form) {
  const status = container.querySelector("[data-order-status]");
  status.hidden = false;
  status.classList.remove("error");
  status.textContent = "Criando pedido local...";

  try {
    const items = [...selectedItems.values()].map((item) => ({
      catalog_item_id: item.id,
      quantity: item.quantity,
    }));
    const data = new FormData(form);
    const order = await apiPost(
      `/api/v1/public/hotels/${slug}/room-service/orders`,
      {
        guest_name: data.get("guest_name"),
        room_code: data.get("room_code"),
        notes: data.get("notes"),
        origin: "public-web",
        items,
      },
      { idempotencyKey: crypto.randomUUID() },
    );
    selectedItems.clear();
    form.reset();
    renderCart(container);
    status.textContent = `Pedido local criado: ${order.public_id}`;
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function formatMoney(cents, currency) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

async function loadCss(path) {
  if (document.querySelector(`link[href="${path}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = path;
  document.head.appendChild(link);
}
