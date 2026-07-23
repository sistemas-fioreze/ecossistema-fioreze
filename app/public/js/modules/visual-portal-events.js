const eventRequests = new Map();

document.querySelectorAll("[data-visual-events]").forEach((root) => initializeEventsPage(root));
document.querySelectorAll("[data-visual-event-highlight]").forEach((root) => initializeEventHighlight(root));

async function initializeEventsPage(root) {
  const state = {
    events: [],
    mode: "list",
    filter: "todos",
    selectedId: "",
    calendarDate: new Date(),
    selectedDate: "",
    calendarTab: "stay",
    checkin: "",
    checkout: "",
  };
  try {
    state.events = await loadEvents(root.dataset.hotelSlug);
    renderEventsPage(root, state);
    bindEventsPage(root, state);
  } catch {
    root.innerHTML = renderError();
  }
}

async function initializeEventHighlight(root) {
  try {
    const events = await loadEvents(root.dataset.hotelSlug);
    const requested = events.find((event) => event.id === root.dataset.eventId);
    const selected = requested || events.find(isUpcoming) || events[0];
    if (!selected) {
      root.innerHTML = '<div class="visual-events-empty"><strong>Nenhum evento publicado</strong><span>A programação desta unidade será exibida aqui.</span></div>';
      return;
    }
    root.innerHTML = renderHighlightCard(selected, root);
    root.querySelector("[data-highlight-open]")?.addEventListener("click", () => openStandaloneDetail(root, selected));
  } catch {
    root.innerHTML = renderError("Não foi possível carregar o evento em destaque.");
  }
}

function bindEventsPage(root, state) {
  root.addEventListener("click", (event) => {
    const mode = event.target.closest("[data-events-mode]");
    if (mode) {
      state.mode = mode.dataset.eventsMode;
      renderEventsPage(root, state);
      return;
    }
    const filter = event.target.closest("[data-events-filter]");
    if (filter) {
      state.filter = filter.dataset.eventsFilter;
      renderEventsPage(root, state);
      return;
    }
    const open = event.target.closest("[data-event-open]");
    if (open) {
      state.selectedId = open.dataset.eventOpen;
      renderEventsPage(root, state);
      requestAnimationFrame(() => root.querySelector("[data-event-close]")?.focus());
      return;
    }
    if (event.target.closest("[data-event-close]") || event.target.matches("[data-event-dialog]")) {
      state.selectedId = "";
      renderEventsPage(root, state);
      return;
    }
    const month = event.target.closest("[data-calendar-month]");
    if (month) {
      state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + Number(month.dataset.calendarMonth), 1);
      state.selectedDate = "";
      renderEventsPage(root, state);
      return;
    }
    const calendarTab = event.target.closest("[data-calendar-tab]");
    if (calendarTab) {
      state.calendarTab = calendarTab.dataset.calendarTab;
      renderEventsPage(root, state);
      return;
    }
    if (event.target.closest("[data-stay-clear]")) {
      state.checkin = "";
      state.checkout = "";
      renderEventsPage(root, state);
      return;
    }
    const day = event.target.closest("[data-calendar-day]");
    if (day) {
      state.selectedDate = day.dataset.calendarDay;
      renderEventsPage(root, state);
    }
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selectedId) {
      state.selectedId = "";
      renderEventsPage(root, state);
    }
  });
  root.addEventListener("change", (event) => {
    const field = event.target.closest("[data-stay-field]");
    if (!field) return;
    state[field.dataset.stayField] = field.value;
    renderEventsPage(root, state);
  });
}

function renderEventsPage(root, state) {
  const filtered = filterEvents(state.events, state.filter);
  const selected = state.events.find((event) => event.id === state.selectedId);
  root.innerHTML = `
    <header class="visual-events-heading">
      <span>${icon("calendar")}</span>
      <div><h1>Eventos</h1><p>Experiências, avisos e novidades durante a sua estadia.</p></div>
    </header>
    <div class="visual-events-controls">
      <div class="visual-events-modes" aria-label="Modo de visualização">
        <button type="button" class="${state.mode === "list" ? "is-active" : ""}" data-events-mode="list">${icon("list")}<span>Lista</span></button>
        <button type="button" class="${state.mode === "calendar" ? "is-active" : ""}" data-events-mode="calendar">${icon("calendar")}<span>Calendário</span></button>
      </div>
      <div class="visual-events-filters" aria-label="Categorias">
        ${eventFilters(state.events).map((filter) => `<button type="button" class="${state.filter === filter.key ? "is-active" : ""}" data-events-filter="${escapeAttr(filter.key)}">${escapeHtml(filter.label)}</button>`).join("")}
      </div>
    </div>
    ${state.mode === "calendar" ? renderCalendar(filtered, state) : renderEventGrid(filtered)}
    ${selected ? renderEventDialog(selected, root.dataset.hotelName) : ""}`;
}

function renderEventGrid(events) {
  if (!events.length) return '<div class="visual-events-empty"><strong>Nenhum evento encontrado</strong><span>Escolha outro filtro para consultar a programação.</span></div>';
  return `<div class="visual-events-grid">${events.map(renderEventCard).join("")}</div>`;
}

function renderEventCard(event) {
  return `
    <button type="button" class="visual-event-card" data-event-open="${escapeAttr(event.id)}">
      <span class="visual-event-card-media">${event.image_url ? `<img src="${escapeAttr(event.image_url)}" alt="${escapeAttr(event.image_alt || "")}" loading="lazy">` : icon("calendar")}</span>
      <span class="visual-event-card-copy">
        <small>EVENTO · ${escapeHtml(formatDate(event.starts_at, event.timezone))}</small>
        <strong>${escapeHtml(event.title)}</strong>
        ${event.summary ? `<span class="visual-event-card-summary">${escapeHtml(event.summary)}</span>` : ""}
        <span class="visual-event-card-foot"><b>${escapeHtml(event.category || "Evento")}${formatTime(event) ? ` · ${escapeHtml(formatTime(event))}` : ""}</b><em>Abrir</em></span>
      </span>
    </button>`;
}

function renderHighlightCard(event, root) {
  const label = root.dataset.label || "Evento em destaque";
  const buttonText = root.dataset.buttonText || "Ver evento";
  const showDate = root.dataset.showDate !== "false";
  const showSummary = root.dataset.showSummary !== "false";
  return `
    <button type="button" class="visual-event-highlight-card${event.image_url ? " has-image" : ""}" data-highlight-open>
      ${event.image_url ? `<img src="${escapeAttr(event.image_url)}" alt="${escapeAttr(event.image_alt || "")}" loading="lazy">` : ""}
      <span class="visual-event-highlight-overlay"></span>
      <span class="visual-event-highlight-copy">
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(event.title)}</strong>
        ${showSummary && event.summary ? `<span>${escapeHtml(event.summary)}</span>` : ""}
        <span class="visual-event-highlight-meta">${showDate ? `<b>${icon("calendar")}${escapeHtml(formatDate(event.starts_at, event.timezone))}</b>` : ""}<em>${escapeHtml(buttonText)} ${icon("arrow")}</em></span>
      </span>
    </button>`;
}

function renderCalendar(events, state) {
  return `
    <div class="visual-events-calendar-tabs" role="tablist" aria-label="Consulta de eventos">
      <button type="button" role="tab" aria-selected="${state.calendarTab === "stay"}" data-calendar-tab="stay">${icon("calendar")}<span>Por período</span></button>
      <button type="button" role="tab" aria-selected="${state.calendarTab === "month"}" data-calendar-tab="month">${icon("calendar")}<span>Mês a mês</span></button>
    </div>
    ${state.calendarTab === "month" ? renderMonthCalendar(events, state) : renderStayCalendar(events, state)}`;
}

function renderStayCalendar(events, state) {
  const filtered = state.checkin && state.checkout
    ? events.filter((event) => {
      const key = eventDateKey(event);
      return key && key >= state.checkin && key <= state.checkout;
    })
    : [];
  return `
    <section class="visual-events-stay">
      <header>${icon("calendar")}<strong>Veja os eventos conforme sua estadia</strong></header>
      <div>
        <label><span>CHECK-IN</span><input type="date" data-stay-field="checkin" value="${escapeAttr(state.checkin)}"></label>
        <label><span>CHECK-OUT</span><input type="date" data-stay-field="checkout" value="${escapeAttr(state.checkout)}"></label>
      </div>
      ${state.checkin || state.checkout ? `<button type="button" data-stay-clear>Limpar datas</button>` : ""}
    </section>
    ${state.checkin && state.checkout
      ? renderEventGrid(filtered)
      : '<div class="visual-events-empty"><strong>Informe o período da estadia</strong><span>Escolha as datas de check-in e check-out para consultar a programação.</span></div>'}`;
}

function renderMonthCalendar(events, state) {
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const dateKeys = new Set(events.map(eventDateKey).filter(Boolean));
  const cells = Array.from({ length: firstDay }, () => '<span class="is-blank"></span>');
  for (let day = 1; day <= totalDays; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(`<button type="button" class="${dateKeys.has(key) ? "has-events" : ""}${state.selectedDate === key ? " is-selected" : ""}" data-calendar-day="${key}">${day}</button>`);
  }
  const selected = state.selectedDate ? events.filter((event) => eventDateKey(event) === state.selectedDate) : [];
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(state.calendarDate);
  return `
    <div class="visual-events-calendar-layout">
      <section class="visual-events-calendar">
        <header><button type="button" data-calendar-month="-1" aria-label="Mês anterior">${icon("back")}</button><h2>${escapeHtml(capitalize(monthName))}</h2><button type="button" data-calendar-month="1" aria-label="Próximo mês">${icon("arrow")}</button></header>
        <div class="visual-events-weekdays">${["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((day) => `<span>${day}</span>`).join("")}</div>
        <div class="visual-events-days">${cells.join("")}</div>
        <footer><span><i></i>Eventos no dia</span><span><i></i>Dia selecionado</span></footer>
      </section>
      <section class="visual-events-calendar-results">
        ${state.selectedDate ? renderEventGrid(selected) : '<div class="visual-events-empty"><strong>Escolha uma data</strong><span>Os dias marcados possuem eventos publicados.</span></div>'}
      </section>
    </div>`;
}

function renderEventDialog(event, hotelName = "") {
  const actionUrl = safeHttpsUrl(event.action_url);
  const content = String(event.content || "").split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
  return `
    <div class="visual-event-dialog" data-event-dialog role="dialog" aria-modal="true" aria-label="Detalhes do evento">
      <article class="visual-event-detail">
        <button type="button" class="visual-event-detail-close" data-event-close aria-label="Fechar">${icon("close")}</button>
        <div class="visual-event-detail-layout">
          <section>
            <div class="visual-event-detail-media">
              ${event.image_url ? `<img src="${escapeAttr(event.image_url)}" alt="${escapeAttr(event.image_alt || "")}">` : icon("calendar")}
              <span></span><h1>${escapeHtml(event.title)}</h1>
            </div>
            <p class="visual-event-detail-date">${escapeHtml(formatDate(event.starts_at, event.timezone).toUpperCase())}${formatTime(event) ? ` · ${escapeHtml(formatTime(event).toUpperCase())}` : ""}</p>
            ${event.summary ? `<p class="visual-event-detail-summary">${escapeHtml(event.summary)}</p>` : ""}
            ${content.length ? `<div class="visual-event-detail-body">${content.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div>` : ""}
            ${actionUrl && event.action_text ? `<a class="visual-event-action" href="${escapeAttr(actionUrl)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(event.action_text)}</span>${icon("external")}</a>` : ""}
            ${(event.tags || []).length ? `<div class="visual-event-tags">${event.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
          </section>
          <aside>
            <h2>DETALHES</h2>
            <dl>
              <div><dt>LOCAL DO EVENTO</dt><dd>${escapeHtml(event.location || hotelName || "Unidade")}</dd></div>
              <div><dt>TIPO / CATEGORIA</dt><dd>Evento · ${escapeHtml(event.category || "Evento")}</dd></div>
              <div><dt>DATA E HORA DO EVENTO</dt><dd>${escapeHtml([formatDate(event.starts_at, event.timezone), formatTime(event)].filter(Boolean).join(" · "))}</dd></div>
            </dl>
          </aside>
        </div>
      </article>
    </div>`;
}

function openStandaloneDetail(root, event) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderEventDialog(event);
  const dialog = wrapper.firstElementChild;
  const styles = getComputedStyle(root);
  dialog.style.setProperty("--events-primary", styles.getPropertyValue("--events-primary"));
  dialog.style.setProperty("--events-accent", styles.getPropertyValue("--events-accent"));
  document.body.append(dialog);
  document.body.classList.add("visual-event-dialog-open");
  const close = () => {
    dialog.remove();
    document.body.classList.remove("visual-event-dialog-open");
  };
  dialog.addEventListener("click", (clickEvent) => {
    if (clickEvent.target === dialog || clickEvent.target.closest("[data-event-close]")) close();
  });
  dialog.addEventListener("keydown", (keyEvent) => {
    if (keyEvent.key === "Escape") close();
  });
  dialog.querySelector("[data-event-close]")?.focus();
}

function loadEvents(hotelSlug) {
  if (!eventRequests.has(hotelSlug)) {
    eventRequests.set(hotelSlug, fetch(`/api/v1/public/hotels/${encodeURIComponent(hotelSlug)}/portal/events`, {
      headers: { Accept: "application/json" },
    }).then(async (response) => {
      if (!response.ok) throw new Error("events_unavailable");
      const payload = await response.json();
      return Array.isArray(payload?.data?.events) ? payload.data.events : [];
    }));
  }
  return eventRequests.get(hotelSlug);
}

function filterEvents(events, filter) {
  if (filter === "todos" || filter === "evento") return events;
  return events.filter((event) => [event.category, ...(event.tags || [])].some((value) => slugify(value) === filter));
}

function eventFilters(events) {
  const filters = new Map([["todos", "Todos"], ["evento", "Evento"]]);
  for (const event of events) {
    for (const value of [event.category, ...(event.tags || [])]) {
      const label = String(value || "").trim();
      if (label && !filters.has(slugify(label))) filters.set(slugify(label), label);
    }
  }
  return [...filters].map(([key, label]) => ({ key, label }));
}

function isUpcoming(event) {
  return Date.parse(event.ends_at || event.starts_at) >= Date.now();
}

function eventDateKey(event) {
  const date = new Date(event.starts_at || "");
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: event.timezone || "America/Sao_Paulo" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(value, timezone) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "Data a confirmar" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: timezone || "America/Sao_Paulo" }).format(date);
}

function formatTime(event) {
  const start = new Date(event.starts_at || "");
  if (Number.isNaN(start.getTime())) return "";
  const options = { hour: "2-digit", minute: "2-digit", timeZone: event.timezone || "America/Sao_Paulo" };
  const from = new Intl.DateTimeFormat("pt-BR", options).format(start);
  const end = new Date(event.ends_at || "");
  return Number.isNaN(end.getTime()) ? `Às ${from}` : `Das ${from} às ${new Intl.DateTimeFormat("pt-BR", options).format(end)}`;
}

function renderError(message = "Não foi possível carregar os eventos.") {
  return `<div class="visual-events-empty"><strong>Programação indisponível</strong><span>${escapeHtml(message)}</span></div>`;
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function slugify(value) {
  return String(value || "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function capitalize(value) {
  return String(value || "").replace(/^./, (letter) => letter.toUpperCase());
}

function icon(name) {
  const paths = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r=".6"/><circle cx="4" cy="12" r=".6"/><circle cx="4" cy="18" r=".6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    external: '<path d="M14 5h5v5M19 5l-9 9"/><path d="M19 14v5H5V5h5"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.calendar}</svg>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
