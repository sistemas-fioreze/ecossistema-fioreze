import { adminApi } from "./shared/admin-api.js";
import { escapeAttr, escapeHtml } from "./shared/format.js";

const state = {
  initialized: false,
  box: "inbox",
  messages: [],
  recipients: [],
  selectedId: null,
  selectedIds: new Set(),
  query: "",
  pendingRecipientId: new URLSearchParams(window.location.search).get("to") || "",
};

const els = {
  manager: document.getElementById("messagesManager"),
  compose: document.getElementById("composeMessageButton"),
  status: document.getElementById("messagesStatus"),
  list: document.getElementById("messagesList"),
  detail: document.getElementById("messageDetail"),
  unread: document.getElementById("messagesUnreadCount"),
  search: document.getElementById("messagesSearch"),
  selectAll: document.getElementById("messagesSelectAll"),
  refresh: document.getElementById("messagesRefresh"),
  archive: document.getElementById("messagesArchive"),
  markRead: document.getElementById("messagesMarkRead"),
  markUnread: document.getElementById("messagesMarkUnread"),
  dialog: document.getElementById("adminEditorDialog"),
  dialogTitle: document.getElementById("adminDialogTitle"),
  dialogBody: document.getElementById("adminDialogBody"),
};

export async function renderMessagesManager() {
  initialize();
  state.pendingRecipientId ||= new URLSearchParams(window.location.search).get("to") || "";
  els.manager?.setAttribute("aria-busy", "true");
  try {
    const [messagesPayload, recipientsPayload] = await Promise.all([
      adminApi(`/api/v1/admin/messages?box=${state.box}`),
      state.recipients.length ? Promise.resolve(null) : adminApi("/api/v1/admin/messages/recipients"),
    ]);
    state.messages = messagesPayload.data.messages || [];
    state.selectedIds = new Set([...state.selectedIds].filter((id) => state.messages.some((message) => message.id === id)));
    if (state.selectedId && !state.messages.some((message) => message.id === state.selectedId)) {
      state.selectedId = null;
      renderEmptyDetail();
    }
    if (recipientsPayload) state.recipients = recipientsPayload.data.recipients || [];
    renderList();
    updateStatus();
    if (state.pendingRecipientId && state.recipients.some((recipient) => recipient.id === state.pendingRecipientId)) {
      const recipientId = state.pendingRecipientId;
      state.pendingRecipientId = "";
      openComposer(null, recipientId);
    }
  } catch (error) {
    els.status.textContent = error.message || "Não foi possível carregar as mensagens.";
    els.list.innerHTML = "";
  } finally {
    els.manager?.removeAttribute("aria-busy");
  }
}

function initialize() {
  if (state.initialized) return;
  state.initialized = true;
  els.manager?.querySelector(".admin-message-boxes")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-message-box]");
    if (!button || button.dataset.messageBox === state.box) return;
    state.box = button.dataset.messageBox;
    state.selectedId = null;
    state.selectedIds.clear();
    for (const item of els.manager.querySelectorAll("[data-message-box]")) {
      item.setAttribute("aria-pressed", String(item === button));
    }
    renderEmptyDetail();
    void renderMessagesManager();
  });
  els.list?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-message-id]");
    if (button) void openMessage(button.dataset.messageId);
  });
  els.list?.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-message-select]");
    if (!checkbox) return;
    if (checkbox.checked) state.selectedIds.add(checkbox.value);
    else state.selectedIds.delete(checkbox.value);
    renderList();
  });
  els.compose?.addEventListener("click", openComposer);
  els.search?.addEventListener("input", () => {
    state.query = els.search.value.trim().toLocaleLowerCase("pt-BR");
    renderList();
    updateStatus();
  });
  els.selectAll?.addEventListener("change", () => {
    const visible = filteredMessages();
    if (els.selectAll.checked) visible.forEach((message) => state.selectedIds.add(message.id));
    else visible.forEach((message) => state.selectedIds.delete(message.id));
    renderList();
  });
  els.refresh?.addEventListener("click", () => void renderMessagesManager());
  els.archive?.addEventListener("click", () => void runBulkAction(state.box === "archived" ? "restore" : "archive"));
  els.markRead?.addEventListener("click", () => void runBulkAction("read"));
  els.markUnread?.addEventListener("click", () => void runBulkAction("unread"));
  els.detail?.addEventListener("click", handleDetailAction);
  els.dialog?.querySelector("[data-dialog-close]")?.addEventListener("click", closeDialog);
}

function renderList() {
  const unreadCount = state.box === "inbox" ? state.messages.filter((message) => !message.read_at).length : 0;
  els.unread.hidden = unreadCount === 0;
  els.unread.textContent = unreadCount ? String(unreadCount) : "";
  const messages = filteredMessages();
  els.list.innerHTML = messages.length
    ? messages.map(renderMessageRow).join("")
    : `<div class="admin-empty">${state.query ? "Nenhuma mensagem corresponde à busca." : "Nenhuma mensagem nesta caixa."}</div>`;
  const selectedVisible = messages.filter((message) => state.selectedIds.has(message.id)).length;
  els.selectAll.checked = messages.length > 0 && selectedVisible === messages.length;
  els.selectAll.indeterminate = selectedVisible > 0 && selectedVisible < messages.length;
  syncToolbar();
}

function renderMessageRow(message) {
  const incoming = state.box === "inbox" || (state.box === "archived" && message.box === "inbox");
  const unread = incoming && !message.read_at;
  return `
    <article class="admin-message-row${unread ? " is-unread" : ""}${state.selectedId === message.id ? " is-selected" : ""}">
      <label class="admin-message-check" title="Selecionar mensagem">
        <input type="checkbox" data-message-select value="${escapeAttr(message.id)}" ${state.selectedIds.has(message.id) ? "checked" : ""} aria-label="Selecionar ${escapeAttr(message.subject)}">
      </label>
      <button type="button" data-message-id="${escapeAttr(message.id)}">
        <span class="admin-avatar" aria-hidden="true">${escapeHtml(initials(message.counterpart.display_name))}</span>
        <span class="admin-message-row-copy">
          <strong>${escapeHtml(message.counterpart.display_name)}</strong>
          <b>${escapeHtml(message.subject)}</b>
          <small>${escapeHtml(message.body)}</small>
        </span>
        <time datetime="${escapeAttr(message.created_at)}">${escapeHtml(formatDate(message.created_at))}</time>
      </button>
    </article>`;
}

async function openMessage(messageId) {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message) return;
  state.selectedId = message.id;
  if (state.box === "inbox" && !message.read_at) {
    try {
      const payload = await adminApi(`/api/v1/admin/messages/${encodeURIComponent(message.id)}/read`, {
        method: "PATCH",
        body: {},
      });
      message.read_at = payload.data.read_at;
    } catch {
      // A mensagem continua legível mesmo se a confirmação de leitura falhar.
    }
  }
  renderList();
  const incoming = state.box === "inbox" || (state.box === "archived" && message.box === "inbox");
  els.detail.innerHTML = `
    <header>
      <div class="admin-message-detail-actions">
        <button type="button" data-message-detail-action="back">Voltar</button>
        ${incoming ? '<button type="button" data-message-detail-action="reply">Responder</button>' : ""}
        ${incoming && message.read_at ? '<button type="button" data-message-detail-action="unread">Marcar como não lida</button>' : ""}
        <button type="button" data-message-detail-action="${state.box === "archived" ? "restore" : "archive"}">${state.box === "archived" ? "Restaurar" : "Arquivar"}</button>
      </div>
      <div>
        <p class="eyebrow">${incoming ? "De" : "Para"} ${escapeHtml(message.counterpart.display_name)}</p>
        <h3>${escapeHtml(message.subject)}</h3>
        <span>Usuário nº ${escapeHtml(message.counterpart.number || "-")} · ${escapeHtml(message.counterpart.email)}</span>
        <time datetime="${escapeAttr(message.created_at)}">${escapeHtml(formatDateTime(message.created_at))}</time>
      </div>
    </header>
    <div class="admin-message-body">${escapeHtml(message.body).replaceAll("\n", "<br>")}</div>`;
  els.manager?.classList.add("is-reading-message");
}

async function handleDetailAction(event) {
  const button = event.target.closest("[data-message-detail-action]");
  if (!button) return;
  const message = state.messages.find((item) => item.id === state.selectedId);
  if (!message) return;
  const action = button.dataset.messageDetailAction;
  if (action === "back") {
    state.selectedId = null;
    renderEmptyDetail();
    renderList();
    return;
  }
  if (action === "reply") {
    openComposer(message);
    return;
  }
  button.disabled = true;
  try {
    await mutateMessage(message.id, action);
    state.selectedId = null;
    renderEmptyDetail();
    await renderMessagesManager();
  } catch (error) {
    els.status.textContent = error.message || "Não foi possível atualizar a mensagem.";
  } finally {
    button.disabled = false;
  }
}

async function runBulkAction(action) {
  const ids = [...state.selectedIds];
  if (!ids.length) return;
  setToolbarDisabled(true);
  els.status.textContent = "Atualizando mensagens...";
  try {
    await Promise.all(ids.map((id) => mutateMessage(id, action)));
    state.selectedIds.clear();
    state.selectedId = null;
    renderEmptyDetail();
    await renderMessagesManager();
  } catch (error) {
    els.status.textContent = error.message || "Não foi possível atualizar as mensagens selecionadas.";
  } finally {
    setToolbarDisabled(false);
  }
}

function mutateMessage(messageId, action) {
  return adminApi(`/api/v1/admin/messages/${encodeURIComponent(messageId)}/${action}`, {
    method: "PATCH",
    body: {},
  });
}

function filteredMessages() {
  if (!state.query) return state.messages;
  return state.messages.filter((message) =>
    [message.counterpart.display_name, message.counterpart.email, message.subject, message.body]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(state.query),
  );
}

function syncToolbar() {
  const selected = state.selectedIds.size;
  const incomingBox = state.box === "inbox";
  els.archive.textContent = state.box === "archived" ? "Restaurar" : "Arquivar";
  els.archive.disabled = selected === 0;
  els.markRead.disabled = selected === 0 || !incomingBox;
  els.markUnread.disabled = selected === 0 || !incomingBox;
}

function setToolbarDisabled(disabled) {
  for (const button of [els.refresh, els.archive, els.markRead, els.markUnread]) {
    if (button) button.disabled = disabled || (button !== els.refresh && state.selectedIds.size === 0);
  }
}

function updateStatus() {
  const visible = filteredMessages().length;
  if (!state.messages.length) {
    els.status.textContent = "Nenhuma mensagem nesta caixa.";
    return;
  }
  els.status.textContent = state.query
    ? `${visible} ${visible === 1 ? "resultado encontrado" : "resultados encontrados"}.`
    : `${state.messages.length} ${state.messages.length === 1 ? "mensagem" : "mensagens"}.`;
}

function renderEmptyDetail() {
  els.detail.innerHTML = '<div class="admin-empty">Selecione uma mensagem para visualizar.</div>';
  els.manager?.classList.remove("is-reading-message");
}

function openComposer(replyTo = null, selectedRecipientId = "") {
  els.dialogTitle.textContent = replyTo ? "Responder mensagem" : "Nova mensagem";
  els.dialogBody.innerHTML = `
    <form id="adminMessageForm" class="admin-form-stack">
      <label><span>Destinatário</span><select name="recipient_user_id" required>
        <option value="">Selecione um usuário</option>
        ${state.recipients.map((recipient) => `<option value="${escapeAttr(recipient.id)}" ${selectedRecipientId === recipient.id || replyTo?.counterpart?.email === recipient.email ? "selected" : ""}>nº ${escapeHtml(recipient.number || "-")} · ${escapeHtml(recipient.display_name)} · ${escapeHtml(recipient.email)}</option>`).join("")}
      </select></label>
      <label><span>Assunto</span><input name="subject" maxlength="160" value="${escapeAttr(replyTo ? `Re: ${replyTo.subject}` : "")}" required></label>
      <label><span>Mensagem</span><textarea name="body" rows="8" maxlength="5000" required></textarea></label>
      <p class="admin-dialog-message" role="status" aria-live="polite"></p>
      <div class="admin-dialog-actions"><button type="button" data-dialog-cancel>Cancelar</button><button class="admin-primary-button" type="submit">Enviar</button></div>
    </form>`;
  if (!els.dialog.open) els.dialog.showModal();
  els.dialogBody.querySelector("[data-dialog-cancel]").addEventListener("click", closeDialog);
  els.dialogBody.querySelector("#adminMessageForm").addEventListener("submit", sendMessage);
}

async function sendMessage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const submit = form.querySelector('[type="submit"]');
  const status = form.querySelector(".admin-dialog-message");
  submit.disabled = true;
  status.textContent = "Enviando...";
  try {
    await adminApi("/api/v1/admin/messages", {
      method: "POST",
      body: {
        recipient_user_id: data.get("recipient_user_id"),
        subject: data.get("subject"),
        body: data.get("body"),
      },
    });
    closeDialog();
    state.box = "sent";
    for (const button of els.manager.querySelectorAll("[data-message-box]")) {
      button.setAttribute("aria-pressed", String(button.dataset.messageBox === "sent"));
    }
    await renderMessagesManager();
  } catch (error) {
    status.textContent = error.message || "Não foi possível enviar a mensagem.";
  } finally {
    submit.disabled = false;
  }
}

function closeDialog() {
  if (els.dialog.open) els.dialog.close();
  els.dialogBody.innerHTML = "";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function initials(name) {
  return String(name || "Usuário").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
