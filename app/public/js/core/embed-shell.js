export async function initFiorezeEmbed(runtime) {
  const root = document.getElementById("embedRoot");
  if (!root) return;
  try {
    const configResponse = await fetch(runtime.config_url, { headers: { accept: "application/json" } });
    const configPayload = await configResponse.json();
    if (!configResponse.ok || configPayload.ok === false) {
      throw new Error(configPayload.error?.message || "Nao foi possivel carregar a incorporacao.");
    }
    const config = { ...configPayload.data, embed_id: runtime.embed_id };
    applyTheme(root, config);
    await renderModule(root, config, runtime);
    setupPostMessage(config);
  } catch (error) {
    root.innerHTML = `<section class="embed-error" role="alert">${escapeHtml(error.message || "Erro ao carregar incorporacao.")}</section>`;
    setupPostMessage({
      embed_id: runtime.embed_id,
      hotel_slug: runtime.hotel_slug,
      module_key: runtime.module_key,
    });
  }
}

async function renderModule(root, config, runtime) {
  const shell = document.createElement("section");
  shell.className = "embed-shell";
  shell.dataset.background = config.options.background;
  shell.dataset.compact = String(config.options.compact);
  shell.style.setProperty("--brand-primary", config.branding.primary_color || "#17594a");
  shell.style.setProperty("--brand-accent", config.branding.accent_color || "#f2b84b");
  shell.style.setProperty("--brand-bg", config.branding.background_color || "#f7f4ee");
  shell.style.setProperty("--brand-text", config.branding.text_color || "#202124");
  shell.innerHTML = renderHeader(config);

  if (config.module_key === "room-service") {
    const products = await loadProducts(runtime.products_url);
    shell.insertAdjacentHTML("beforeend", renderRoomService(config, products));
  } else {
    shell.insertAdjacentHTML(
      "beforeend",
      `<article class="embed-card"><div class="embed-empty">Modulo publico preparado para incorporacao.</div></article>`,
    );
  }
  root.replaceChildren(shell);
}

async function loadProducts(productsUrl) {
  if (!productsUrl) return { categories: [] };
  const response = await fetch(productsUrl, { headers: { accept: "application/json" } });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.error?.message || "Cardapio indisponivel.");
  return payload.data;
}

function renderHeader(config) {
  const logo = config.branding.logo_url || config.branding.icon_url || "";
  return `
    <header class="embed-header" ${config.options.header === "hidden" ? "hidden" : ""}>
      ${logo ? `<img class="embed-logo" src="${escapeAttr(logo)}" alt="">` : ""}
      <div>
        <p class="embed-eyebrow">${escapeHtml(config.hotel.short_name || config.hotel.name)}</p>
        <h1 class="embed-title">${escapeHtml(config.module_name)}</h1>
      </div>
    </header>
  `;
}

function renderRoomService(config, products) {
  const categories = Array.isArray(products.categories) ? products.categories : [];
  if (!categories.length) return '<article class="embed-card"><div class="embed-empty">Cardapio indisponivel no momento.</div></article>';
  return `
    <article class="embed-card" aria-label="Cardapio do Room Service">
      ${categories.map(renderCategory).join("")}
    </article>
    <div class="embed-actions">
      <button class="embed-button" type="button" disabled aria-disabled="true">
        ${config.service_status === "open" ? "Abra no portal para finalizar" : "Room Service fechado"}
      </button>
    </div>
  `;
}

function renderCategory(category) {
  return `
    <section class="embed-section">
      <h2 class="embed-category-title">${escapeHtml(category.name)}</h2>
      <div class="embed-products">
        ${(category.items || []).map(renderProduct).join("")}
      </div>
    </section>
  `;
}

function renderProduct(item) {
  return `
    <div class="embed-product">
      <strong>${escapeHtml(item.name)}</strong>
      <span class="embed-price">${formatMoney(item.price_cents, item.currency || "BRL")}</span>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
      ${item.is_available ? "" : `<span class="embed-unavailable">${escapeHtml(item.availability_label || "Indisponivel")}</span>`}
    </div>
  `;
}

function setupPostMessage(config) {
  const send = (type, extra = {}) => {
    window.parent?.postMessage(
      {
        type,
        embed_id: config.embed_id,
        module_key: config.module_key,
        hotel_slug: config.hotel_slug,
        ...extra,
      },
      "*",
    );
  };
  send("fioreze:embed:ready");
  let scheduled = 0;
  const publishSize = () => {
    cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(() => {
      const height = Math.max(240, Math.min(2000, Math.ceil(document.documentElement.scrollHeight)));
      send("fioreze:embed:resize", { height });
    });
  };
  if ("ResizeObserver" in window) {
    new ResizeObserver(publishSize).observe(document.documentElement);
  }
  window.addEventListener("load", publishSize, { once: true });
  publishSize();
}

function applyTheme(root, config) {
  root.dataset.theme = config.options.theme;
}

function formatMoney(cents, currency) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(cents || 0) / 100);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
