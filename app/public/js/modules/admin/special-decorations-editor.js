import { adminApi } from "./shared/admin-api.js";
import { hasPermission, PORTALS_MEDIA_UPLOAD_PERMISSION } from "./shared/admin-session.js";
import { escapeAttr, escapeHtml } from "./shared/format.js";

const MODULE_KEY = "romantic-packages";

export function createSpecialDecorationsEditor({
  dialog,
  getHotel,
  getMedia,
  getSession,
  onMediaAdded,
  onStatus,
}) {
  const state = {
    catalog: { categories: [], items: [] },
    activeCategoryId: "",
    editor: null,
    loading: false,
  };
  let bound = false;

  function bind() {
    if (bound) return;
    bound = true;
    dialog.addEventListener("click", handleClick);
    dialog.addEventListener("submit", handleSubmit);
    dialog.addEventListener("change", handleChange);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
  }

  async function open() {
    bind();
    if (!dialog.open) dialog.showModal();
    state.editor = null;
    renderLoading();
    await load();
  }

  function close() {
    if (dialog.open) dialog.close();
    state.editor = null;
  }

  async function load() {
    const hotel = getHotel();
    if (!hotel) return;
    state.loading = true;
    try {
      const payload = await adminApi(
        `/api/v1/admin/special-decorations/catalog?hotel_id=${encodeURIComponent(hotel.hotel_id)}`,
      );
      state.catalog = payload.data || { categories: [], items: [] };
      if (!state.catalog.categories.some((category) => category.id === state.activeCategoryId)) {
        state.activeCategoryId = state.catalog.categories[0]?.id || "";
      }
      render();
    } catch (error) {
      renderError(error.message || "Não foi possível carregar o catálogo.");
    } finally {
      state.loading = false;
    }
  }

  function renderLoading() {
    const hotel = getHotel();
    dialog.innerHTML = `
      <section class="special-decorations-editor">
        ${renderToolbar(hotel)}
        <div class="special-decorations-loading"><span aria-hidden="true"></span><p>Preparando o catálogo...</p></div>
      </section>`;
  }

  function renderError(message) {
    dialog.innerHTML = `
      <section class="special-decorations-editor">
        ${renderToolbar(getHotel())}
        <div class="special-decorations-empty">
          <strong>Catálogo indisponível</strong>
          <span>${escapeHtml(message)}</span>
          <button type="button" data-special-action="retry">Tentar novamente</button>
        </div>
      </section>`;
  }

  function render() {
    const hotel = getHotel();
    const categories = state.catalog.categories || [];
    const selected = categories.find((category) => category.id === state.activeCategoryId) || null;
    dialog.innerHTML = `
      <section class="special-decorations-editor">
        ${renderToolbar(hotel)}
        <div class="special-decorations-workspace">
          <aside class="special-decorations-sidebar">
            <header>
              <div><strong>Categorias</strong><span>${categories.length} cadastrada(s)</span></div>
              <button type="button" data-special-action="new-category" aria-label="Nova categoria">${icon("plus")}</button>
            </header>
            <nav aria-label="Categorias de decorações">
              ${categories.map((category) => `
                <button type="button" data-special-category="${escapeAttr(category.id)}" aria-current="${category.id === state.activeCategoryId ? "true" : "false"}">
                  <span><strong>${escapeHtml(category.name)}</strong><small>${itemCount(category.id)} item(ns)</small></span>
                  ${icon("chevron")}
                </button>`).join("") || '<p>Crie a primeira categoria para organizar o catálogo.</p>'}
            </nav>
            ${selected ? `<button class="special-decorations-edit-category" type="button" data-special-action="edit-category" data-id="${escapeAttr(selected.id)}">${icon("edit")} Editar categoria</button>` : ""}
          </aside>
          <main class="special-decorations-main">
            ${state.editor ? renderEditor() : renderCatalog(selected)}
          </main>
        </div>
      </section>`;
  }

  function renderToolbar(hotel) {
    const publicUrl = hotel ? `${window.location.origin}/${encodeURIComponent(hotel.slug)}/romantic-packages` : "#";
    return `
      <header class="special-decorations-toolbar">
        <div>
          <span>Decorações Especiais</span>
          <strong>${escapeHtml(hotel?.short_name || hotel?.name || "Unidade")}</strong>
        </div>
        <div>
          <a href="${escapeAttr(publicUrl)}" target="_blank" rel="noopener noreferrer">${icon("external")} Abrir portal</a>
          <button type="button" data-special-action="close" aria-label="Fechar editor">${icon("close")}</button>
        </div>
      </header>`;
  }

  function renderCatalog(category) {
    const items = categoryItems(category?.id);
    const packages = items.filter((item) => item.item_type !== "add-on");
    const addOns = items.filter((item) => item.item_type === "add-on");
    return `
      <header class="special-decorations-main-heading">
        <div>
          <span>${escapeHtml(category?.description || "Experiências e adicionais desta unidade.")}</span>
          <h2>${escapeHtml(category?.name || "Catálogo")}</h2>
        </div>
        <button type="button" data-special-action="new-item" ${category ? "" : "disabled"}>${icon("plus")} Novo item</button>
      </header>
      <section class="special-decorations-summary">
        <span><strong>${packages.length}</strong> experiências</span>
        <span><strong>${addOns.length}</strong> adicionais</span>
        <span><strong>${items.filter((item) => item.status === "active").length}</strong> publicados</span>
      </section>
      ${renderItemGroup("Experiências", packages)}
      ${renderItemGroup("Adicionais", addOns)}`;
  }

  function renderItemGroup(title, items) {
    return `
      <section class="special-decorations-item-section">
        <header><h3>${escapeHtml(title)}</h3><span>${items.length} item(ns)</span></header>
        <div class="special-decorations-item-grid">
          ${items.map(renderItemCard).join("") || '<p class="special-decorations-item-empty">Nenhum item nesta seção.</p>'}
        </div>
      </section>`;
  }

  function renderItemCard(item) {
    return `
      <button type="button" class="special-decorations-item-card" data-special-action="edit-item" data-id="${escapeAttr(item.id)}">
        <span class="special-decorations-item-media">
          ${item.image_url ? `<img src="${escapeAttr(item.image_url)}" alt="">` : icon("image")}
        </span>
        <span>
          <small>${item.item_type === "add-on" ? "Adicional" : "Experiência"} · ${statusLabel(item.status)}</small>
          <strong>${escapeHtml(item.name)}</strong>
          <em>${formatPrice(item.price_cents, item.currency)}</em>
        </span>
        ${icon("edit")}
      </button>`;
  }

  function renderEditor() {
    if (state.editor.kind === "category") return renderCategoryForm();
    return renderItemForm();
  }

  function renderCategoryForm() {
    const category = state.editor.value || {};
    return `
      <form class="special-decorations-form" data-special-form="category" data-id="${escapeAttr(category.id || "")}">
        ${renderFormHeading(category.id ? "Editar categoria" : "Nova categoria", "Organize experiências e adicionais em grupos claros.")}
        <label><span>Nome</span><input name="name" maxlength="120" required value="${escapeAttr(category.name || "")}"></label>
        <label><span>Descrição curta</span><textarea name="description" maxlength="500">${escapeHtml(category.description || "")}</textarea></label>
        <div class="special-decorations-form-grid">
          <label><span>Ordem</span><input name="sort_order" type="number" min="0" max="100000" value="${Number(category.sort_order ?? 100)}"></label>
          ${category.id ? `<label><span>Status</span><select name="status">${statusOptions(category.status)}</select></label>` : ""}
        </div>
        ${renderFormActions("Salvar categoria")}
      </form>`;
  }

  function renderItemForm() {
    const item = state.editor.value || {};
    const categories = (state.catalog.categories || []).filter((category) => category.status !== "archived");
    return `
      <form class="special-decorations-form" data-special-form="item" data-id="${escapeAttr(item.id || "")}">
        ${renderFormHeading(item.id ? "Editar item" : "Novo item", "Altere livremente a apresentação publicada no portal.")}
        <div class="special-decorations-form-grid">
          <label><span>Categoria</span><select name="category_id" required>${categories.map((category) => `<option value="${escapeAttr(category.id)}" ${category.id === (item.category_id || state.activeCategoryId) ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}</select></label>
          <label><span>Tipo</span><select name="item_type"><option value="package" ${item.item_type !== "add-on" ? "selected" : ""}>Experiência</option><option value="add-on" ${item.item_type === "add-on" ? "selected" : ""}>Adicional</option></select></label>
        </div>
        <label><span>Nome</span><input name="name" maxlength="160" required value="${escapeAttr(item.name || "")}"></label>
        <label><span>Descrição</span><textarea name="description" maxlength="3000">${escapeHtml(item.description || "")}</textarea></label>
        <label><span>Itens inclusos</span><textarea name="included_items" rows="8" placeholder="Informe um item por linha">${escapeHtml((item.included_items || []).join("\n"))}</textarea><small>Um item por linha.</small></label>
        <div class="special-decorations-form-grid">
          <label><span>Preço</span><input name="price" inputmode="decimal" placeholder="Preço sob consulta" value="${escapeAttr(priceInput(item.price_cents))}"></label>
          <label><span>Ordem</span><input name="sort_order" type="number" min="0" max="100000" value="${Number(item.sort_order ?? 100)}"></label>
          <label><span>Status</span><select name="status">${statusOptions(item.status || "active")}</select></label>
        </div>
        ${renderMediaPicker(item.media_asset_id)}
        ${renderFormActions("Salvar item")}
      </form>`;
  }

  function renderFormHeading(title, description) {
    return `
      <header>
        <button type="button" data-special-action="back">${icon("arrow")}</button>
        <div><h2>${escapeHtml(title)}</h2><span>${escapeHtml(description)}</span></div>
      </header>`;
  }

  function renderFormActions(label) {
    return `
      <footer>
        <p data-special-form-status role="status" aria-live="polite"></p>
        <div>
          <button type="button" data-special-action="back">Cancelar</button>
          <button class="admin-primary-button" type="submit">${escapeHtml(label)}</button>
        </div>
      </footer>`;
  }

  function renderMediaPicker(selectedId) {
    const images = getMedia().filter((asset) => String(asset.mime_type || "").startsWith("image/"));
    return `
      <fieldset class="special-decorations-media-picker">
        <legend>Foto</legend>
        <div>
          <label class="is-empty"><input type="radio" name="media_asset_id" value="" ${selectedId ? "" : "checked"}><span>${icon("image")}<small>Sem foto</small></span></label>
          ${images.map((asset) => `
            <label>
              <input type="radio" name="media_asset_id" value="${escapeAttr(asset.id)}" ${asset.id === selectedId ? "checked" : ""}>
              <span><img src="${escapeAttr(asset.public_url)}" alt=""><small>${escapeHtml(asset.original_filename || "Imagem")}</small></span>
            </label>`).join("")}
        </div>
        ${hasPermission(getSession(), PORTALS_MEDIA_UPLOAD_PERMISSION)
          ? '<label class="special-decorations-upload"><input type="file" data-special-media-upload accept="image/jpeg,image/png,image/webp,image/avif"><span>Enviar e selecionar nova foto</span></label>'
          : ""}
      </fieldset>`;
  }

  function handleClick(event) {
    const categoryButton = event.target.closest("[data-special-category]");
    if (categoryButton) {
      state.activeCategoryId = categoryButton.dataset.specialCategory;
      state.editor = null;
      render();
      return;
    }
    const button = event.target.closest("[data-special-action]");
    if (!button) return;
    const action = button.dataset.specialAction;
    if (action === "close") close();
    else if (action === "retry") load();
    else if (action === "back") {
      state.editor = null;
      render();
    } else if (action === "new-category") {
      state.editor = { kind: "category", value: { sort_order: nextSortOrder(state.catalog.categories) } };
      render();
    } else if (action === "edit-category") {
      state.editor = {
        kind: "category",
        value: structuredClone(state.catalog.categories.find((entry) => entry.id === button.dataset.id) || {}),
      };
      render();
    } else if (action === "new-item") {
      state.editor = {
        kind: "item",
        value: {
          category_id: state.activeCategoryId,
          item_type: "package",
          status: "active",
          sort_order: nextSortOrder(categoryItems(state.activeCategoryId)),
          currency: getHotel()?.currency || "BRL",
        },
      };
      render();
    } else if (action === "edit-item") {
      state.editor = {
        kind: "item",
        value: structuredClone(state.catalog.items.find((entry) => entry.id === button.dataset.id) || {}),
      };
      render();
    }
  }

  async function handleSubmit(event) {
    const form = event.target.closest("[data-special-form]");
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const status = form.querySelector("[data-special-form-status]");
    const data = new FormData(form);
    const id = form.dataset.id;
    const kind = form.dataset.specialForm;
    submit.disabled = true;
    status.textContent = "Salvando...";
    try {
      if (kind === "category") {
        await adminApi(
          id
            ? `/api/v1/admin/special-decorations/catalog/categories/${encodeURIComponent(id)}`
            : "/api/v1/admin/special-decorations/catalog/categories",
          {
            method: id ? "PATCH" : "POST",
            body: {
              hotel_id: getHotel().hotel_id,
              name: data.get("name"),
              description: data.get("description"),
              sort_order: Number(data.get("sort_order") || 100),
              ...(id ? { status: data.get("status") || "active" } : {}),
            },
          },
        );
      } else {
        await adminApi(
          id
            ? `/api/v1/admin/special-decorations/catalog/items/${encodeURIComponent(id)}`
            : "/api/v1/admin/special-decorations/catalog/items",
          {
            method: id ? "PATCH" : "POST",
            body: itemPayload(data),
          },
        );
      }
      state.editor = null;
      await load();
      onStatus?.("Catálogo de Decorações Especiais atualizado.", "success");
    } catch (error) {
      status.textContent = error.message || "Não foi possível salvar.";
      submit.disabled = false;
    }
  }

  async function handleChange(event) {
    const input = event.target.closest("[data-special-media-upload]");
    if (!input) return;
    const file = input.files?.[0];
    const formElement = input.closest("[data-special-form='item']");
    if (!file || !formElement) return;
    captureItemDraft(formElement);
    input.disabled = true;
    const status = formElement.querySelector("[data-special-form-status]");
    status.textContent = "Enviando foto...";
    const body = new FormData();
    body.set("hotel_id", getHotel().hotel_id);
    body.set("module_key", MODULE_KEY);
    body.set("file", file);
    try {
      const payload = await adminApi("/api/v1/admin/media", { method: "POST", body });
      const asset = payload.data.asset;
      onMediaAdded?.(asset);
      state.editor.value.media_asset_id = asset.id;
      render();
      dialog.querySelector("[data-special-form-status]").textContent = "Foto enviada e selecionada.";
    } catch (error) {
      status.textContent = error.message || "Não foi possível enviar a foto.";
      input.disabled = false;
    }
  }

  function captureItemDraft(form) {
    const data = new FormData(form);
    state.editor.value = {
      ...state.editor.value,
      category_id: data.get("category_id"),
      item_type: data.get("item_type"),
      name: data.get("name"),
      description: data.get("description"),
      included_items: lines(data.get("included_items")),
      price_cents: safePrice(data.get("price")),
      sort_order: Number(data.get("sort_order") || 100),
      status: data.get("status") || "active",
      media_asset_id: data.get("media_asset_id") || "",
    };
  }

  function itemPayload(data) {
    return {
      hotel_id: getHotel().hotel_id,
      category_id: data.get("category_id"),
      item_type: data.get("item_type"),
      name: data.get("name"),
      description: data.get("description"),
      included_items: lines(data.get("included_items")),
      price_cents: parseOptionalPrice(data.get("price")),
      currency: getHotel().currency || "BRL",
      sort_order: Number(data.get("sort_order") || 100),
      status: data.get("status") || "active",
      media_asset_id: data.get("media_asset_id") || "",
    };
  }

  function categoryItems(categoryId) {
    return (state.catalog.items || []).filter((item) => item.category_id === categoryId);
  }

  function itemCount(categoryId) {
    return categoryItems(categoryId).length;
  }

  return { open, close, load };
}

function nextSortOrder(items) {
  const highest = Math.max(0, ...items.map((entry) => Number(entry.sort_order || 0)));
  return Math.ceil(highest / 10) * 10 + 10;
}

function lines(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseOptionalPrice(value) {
  if (!String(value || "").trim()) return null;
  const normalized = String(value).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isInteger(cents) || cents < 0) throw new Error("Informe um preço válido.");
  return cents;
}

function safePrice(value) {
  try {
    return parseOptionalPrice(value);
  } catch {
    return null;
  }
}

function priceInput(cents) {
  if (cents == null || cents === "") return "";
  return (Number(cents) / 100).toFixed(2).replace(".", ",");
}

function formatPrice(cents, currency = "BRL") {
  if (cents == null) return "Preço sob consulta";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" })
    .format(Number(cents) / 100);
}

function statusOptions(selected) {
  return [
    ["active", "Publicado"],
    ["draft", "Rascunho"],
    ["inactive", "Inativo"],
    ["archived", "Arquivado"],
  ].map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("");
}

function statusLabel(status) {
  return {
    active: "Publicado",
    draft: "Rascunho",
    inactive: "Inativo",
    archived: "Arquivado",
  }[status] || status;
}

function icon(name) {
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    external: '<path d="M14 5h5v5M19 5l-9 9"/><path d="M19 14v5H5V5h5"/>',
    arrow: '<path d="m15 18-6-6 6-6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 20"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.image}</svg>`;
}
