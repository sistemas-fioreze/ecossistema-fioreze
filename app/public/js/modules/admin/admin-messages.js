import { adminApi } from "./shared/admin-api.js";
import { escapeAttr, escapeHtml } from "./shared/format.js";

const state = {
  initialized: false,
  box: "inbox",
  messages: [],
  recipients: [],
  selectedId: null,
  pendingRecipientId: new URLSearchParams(window.location.search).get("to") || "",
};

const els = {
  manager: document.getElementById("messagesManager"),
  compose: document.getElementById("composeMessageButton"),
  status: document.getElementById("messagesStatus"),
  list: document.getElementById("messagesList"),
  detail: document.getElementById("messageDetail"),
  unread: document.getElementById("messagesUnreadCount"),
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
    if (recipientsPayload) state.recipients = recipientsPayload.data.recipients || [];
    renderList();
    els.status.textContent = state.messages.length
      ? `${state.messages.length} mensagem(ns) na caixa.`
      : "Nenhuma mensagem nesta caixa.";
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
    for (const item of els.manager.querySelectorAll("[data-message-box]")) {
      item.setAttribute("aria-pressed", String(item === button));
    }
    els.detail.innerHTML = '<div class="admin-empty">Selecione uma mensagem para visualizar.</div>';
    void renderMessagesManager();
  });
  els.list?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-message-id]");
    if (button) void openMessage(button.dataset.messageId);
  });
  els.compose?.addEventListener("click", openComposer);
  els.dialog?.querySelector("[data-dialog-close]")?.addEventListener("click", closeDialog);
}

function renderList() {
  const unreadCount = state.box === "inbox" ? state.messages.filter((message) => !message.read_at).length : 0;
  els.unread.hidden = unreadCount === 0;
  els.unread.textContent = unreadCount ? String(unreadCount) : "";
  els.list.innerHTML = state.messages.length
    ? state.messages.map(renderMessageRow).join("")
    : '<div class="admin-empty">Nenhuma mensagem nesta caixa.</div>';
}

function renderMessageRow(message) {
  const unread = state.box === "inbox" && !message.read_at;
  return `
    <button class="admin-message-row${unread ? " is-unread" : ""}${state.selectedId === message.id ? " is-selected" : ""}"
      type="button" data-message-id="${escapeAttr(message.id)}">
      <span class="admin-avatar" aria-hidden="true">${escapeHtml(initials(message.counterpart.display_name))}</span>
      <span>
        <strong>${escapeHtml(message.counterpart.display_name)}</strong>
        <b>${escapeHtml(message.subject)}</b>
        <small>${escapeHtml(message.body)}</small>
      </span>
      <time datetime="${escapeAttr(message.created_at)}">${escapeHtml(formatDate(message.created_at))}</time>
    </button>`;
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
  els.detail.innerHTML = `
    <header>
      <p class="eyebrow">${state.box === "inbox" ? "De" : "Para"} ${escapeHtml(message.counterpart.display_name)}</p>
      <h3>${escapeHtml(message.subject)}</h3>
      <span>Usuário nº ${escapeHtml(message.counterpart.number || "-")} · ${escapeHtml(message.counterpart.email)}</span>
      <time datetime="${escapeAttr(message.created_at)}">${escapeHtml(formatDateTime(message.created_at))}</time>
    </header>
    <div class="admin-message-body">${escapeHtml(message.body).replaceAll("\n", "<br>")}</div>
    ${state.box === "inbox" ? '<button class="admin-secondary-button" type="button" data-reply-message>Responder</button>' : ""}`;
  els.detail.querySelector("[data-reply-message]")?.addEventListener("click", () => openComposer(message));
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
