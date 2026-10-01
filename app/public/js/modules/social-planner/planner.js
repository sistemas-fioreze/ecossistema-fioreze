// social-planner/repository.ts
var base = "/api/v1/admin/social-planner";
async function request(path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, {
    method,
    credentials: "same-origin",
    headers: { accept: "application/json", ...body ? { "content-type": "application/json" } : {}, ...method !== "GET" ? { "x-fioreze-admin-action": "erp-admin" } : {} },
    body: body === void 0 ? void 0 : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "N\xE3o foi poss\xEDvel concluir a opera\xE7\xE3o.");
  return payload.data;
}
var apiStoryRepository = {
  hotels: () => request("/hotels"),
  categories: () => request("/categories"),
  pillars: () => request("/pillars"),
  users: () => request("/users"),
  campaigns: () => request("/campaigns"),
  sequences: () => request("/sequences"),
  stories: (start2, end, filters) => {
    const params2 = new URLSearchParams({ start_date: start2, end_date: end });
    for (const key of ["hotel_id", "status", "category_id", "responsible_user_id", "campaign_id"]) {
      if (filters[key] && filters[key] !== "all") params2.set(key, filters[key]);
    }
    return request(`/stories?${params2}`);
  },
  create: (input) => request("/stories", "POST", input),
  update: (id, input) => request(`/stories/${encodeURIComponent(id)}`, "PATCH", input),
  remove: (id) => request(`/stories/${encodeURIComponent(id)}`, "DELETE"),
  createCampaign: (input) => request("/campaigns", "POST", input),
  updateCampaign: (id, input) => request(`/campaigns/${encodeURIComponent(id)}`, "PATCH", input),
  createSequence: (title) => request("/sequences", "POST", { title }),
  moveSequence: (id, hotel_id, date) => request(`/sequences/${encodeURIComponent(id)}/move`, "PATCH", { hotel_id, date }),
  duplicateSequence: (id) => request(`/sequences/${encodeURIComponent(id)}/duplicate`, "POST", {})
};

// social-planner/utils.ts
var statusLabels = {
  idea: "Ideia",
  to_produce: "A produzir",
  producing: "Em produ\xE7\xE3o",
  approval: "Aguardando aprova\xE7\xE3o",
  ready: "Pronto",
  scheduled: "Programado",
  published: "Publicado",
  cancelled: "Cancelado"
};
var formatLabels = { photo: "Foto", video: "V\xEDdeo", repost: "Repost", art: "Arte", text: "Texto", boomerang: "Boomerang", other: "Outro" };
var objectiveLabels = { engagement: "Engajamento", relationship: "Relacionamento", conversion: "Convers\xE3o", information: "Informa\xE7\xE3o", institutional: "Institucional", traffic: "Tr\xE1fego", promotion: "Divulga\xE7\xE3o" };
var priorityLabels = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}
function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function fromIso(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function addDays(value, amount) {
  const date = fromIso(value);
  date.setDate(date.getDate() + amount);
  return isoDate(date);
}
function weekStart(value) {
  const date = fromIso(value);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return isoDate(date);
}
function dateLabel(value, options) {
  return new Intl.DateTimeFormat("pt-BR", options).format(fromIso(value));
}
function option(value, label, selected = "") {
  return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

// social-planner/app.ts
var views = { week: "Semana", calendar: "Calend\xE1rio", pending: "Pend\xEAncias", campaigns: "Campanhas", assets: "Banco de conte\xFAdos", hotels: "Hot\xE9is", categories: "Categorias", performance: "Desempenho" };
var today = isoDate(/* @__PURE__ */ new Date());
var params = new URLSearchParams(location.search);
var initialWeek = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") || "") ? params.get("week") : today;
var state = {
  view: location.pathname.split("/").filter(Boolean).at(-1) || "week",
  week: weekStart(initialWeek),
  day: today,
  filters: { hotel_id: params.get("hotel") || "all", status: params.get("status") || "all", category_id: params.get("category") || "all", responsible_user_id: params.get("responsible") || "all", campaign_id: params.get("campaign") || "all", search: params.get("q") || "" },
  hotels: [],
  categories: [],
  pillars: [],
  users: [],
  campaigns: [],
  sequences: [],
  stories: [],
  loading: true,
  drawer: null,
  createDate: today,
  createHotel: "",
  saving: false
};
if (!Object.hasOwn(views, state.view)) state.view = "week";
if (state.day < state.week || state.day > addDays(state.week, 6)) state.day = state.week;
var main = document.querySelector("#mainContent");
var drawer = document.querySelector("#storyDrawer");
var backdrop = document.querySelector("#drawerBackdrop");
var toast = document.querySelector("#toast");
var toastTimer = 0;
var loadVersion = 0;
function icon(name) {
  const paths = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
    flag: '<path d="M4 21V4m0 1c5-4 11 4 16 0v11c-5 4-11-4-16 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
    hotel: '<path d="M4 21V5l8-3 8 3v16M4 21h16M9 21v-5h6v5M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8M18 15a6 6 0 0 1 4 6"/>',
    tag: '<path d="M3 3h9l9 9-9 9-9-9V3Z"/><circle cx="8" cy="8" r="1"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
    close: '<path d="M5 5l14 14M19 5 5 19"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}
function notify(message, error = false) {
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4e3);
}
function route(view) {
  state.view = view;
  updateUrl();
  if (["week", "calendar", "pending"].includes(view)) void loadStories();
  else render();
}
function updateUrl() {
  const query = new URLSearchParams();
  query.set("week", state.week);
  for (const [key, urlKey] of [["hotel_id", "hotel"], ["status", "status"], ["category_id", "category"], ["responsible_user_id", "responsible"], ["campaign_id", "campaign"], ["search", "q"]]) {
    const value = state.filters[key];
    if (value && value !== "all") query.set(urlKey, value);
  }
  history.replaceState({}, "", `/admin/social-planner/${state.view}?${query}`);
}
function renderNavigation() {
  const groups = [
    ["Planejamento", [["week", "Semana", "grid"], ["calendar", "Calend\xE1rio", "calendar"], ["pending", "Pend\xEAncias", "alert"]]],
    ["Conte\xFAdo", [["assets", "Banco de conte\xFAdos", "image"], ["campaigns", "Campanhas", "flag"]]],
    ["An\xE1lise", [["performance", "Desempenho", "grid"]]],
    ["Administra\xE7\xE3o", [["hotels", "Hot\xE9is", "hotel"], ["categories", "Categorias", "tag"], ["users", "Usu\xE1rios", "users"], ["settings", "Configura\xE7\xF5es", "settings"]]]
  ];
  const targets = { users: "/admin/usuarios/", settings: "/admin/configuracoes/" };
  document.querySelector("#navigation").innerHTML = groups.map(([title, items]) => `<div class="nav-group"><span class="nav-heading">${title}</span>${items.map(([key, label, symbol]) => `<a class="nav-link ${state.view === key ? "active" : ""}" href="${targets[key] || `/admin/social-planner/${key}`}" ${targets[key] ? "" : `data-view="${key}"`} title="${label}">${icon(symbol)}<span class="nav-label">${label}</span></a>`).join("")}</div>`).join("");
  document.querySelector("#viewTitle").textContent = views[state.view];
}
function dateRange() {
  if (state.view === "calendar") {
    const date = fromIso(state.day);
    return [isoDate(new Date(date.getFullYear(), date.getMonth(), 1)), isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))];
  }
  if (state.view === "pending") return [addDays(today, -30), addDays(today, 7)];
  return [state.week, addDays(state.week, 6)];
}
async function loadStories() {
  const version = ++loadVersion;
  state.loading = true;
  render();
  try {
    const [start2, end] = dateRange();
    const stories = await apiStoryRepository.stories(start2, end, state.filters);
    if (version === loadVersion) state.stories = stories;
  } catch (error) {
    notify(error.message, true);
  } finally {
    if (version === loadVersion) {
      state.loading = false;
      render();
    }
  }
}
function visibleStories() {
  const needle = state.filters.search.trim().toLocaleLowerCase("pt-BR");
  return state.stories.filter((story) => !needle || [story.title, story.description, story.story_text, story.responsible_name].some((item) => item?.toLocaleLowerCase("pt-BR").includes(needle))).sort((a, b) => a.date.localeCompare(b.date) || a.hotel_id.localeCompare(b.hotel_id) || a.sort_order - b.sort_order || (a.planned_time || "").localeCompare(b.planned_time || ""));
}
function selectedHotels() {
  return state.hotels.filter((hotel) => state.filters.hotel_id === "all" || state.filters.hotel_id === hotel.id);
}
function filtersHtml() {
  const f = state.filters;
  const select = (key, label, values) => `<select data-filter="${key}" aria-label="${label}">${option("all", label, f[key])}${values.map((item) => option(item.id, item.name, f[key])).join("")}</select>`;
  return `<div class="filter-panel">${select("hotel_id", "Todos os hot\xE9is", state.hotels)}${select("status", "Todos os status", Object.entries(statusLabels).map(([id, name]) => ({ id, name })))}${select("category_id", "Todas as categorias", state.categories)}${select("responsible_user_id", "Todos os respons\xE1veis", state.users)}${select("campaign_id", "Todas as campanhas", state.campaigns)}<input type="search" data-filter="search" value="${escapeHtml(f.search)}" placeholder="Pesquisar stories" aria-label="Pesquisar stories"></div>`;
}
function metricsHtml(stories) {
  const counts = [
    ["Stories planejados", stories.filter((s) => s.status !== "cancelled").length, ""],
    ["Prontos", stories.filter((s) => s.status === "ready" || s.status === "scheduled").length, "ready"],
    ["Em produ\xE7\xE3o", stories.filter((s) => s.status === "producing").length, "producing"],
    ["Pendentes", stories.filter((s) => ["idea", "to_produce", "approval"].includes(s.status)).length, "pending"],
    ["Publicados", stories.filter((s) => s.status === "published").length, "published"]
  ];
  return `<div class="metrics">${counts.map(([label, count, cls]) => `<div class="metric ${cls}"><small>${label}</small><strong>${count}</strong></div>`).join("")}</div>`;
}
function weekHeading() {
  const end = addDays(state.week, 6);
  const label = `${dateLabel(state.week, { day: "2-digit", month: "short" })} \u2014 ${dateLabel(end, { day: "2-digit", month: "short" })}`;
  return `<div class="page-heading"><div><p class="eyebrow">Planejamento editorial</p><h1>Semana</h1><p class="subtle">Stories planejados para cada perfil da rede.</p></div><div class="heading-actions"><div class="week-nav"><button class="icon-button" data-action="prev-week" aria-label="Semana anterior">${icon("left")}</button><span class="week-label">${escapeHtml(label)}</span><button class="icon-button" data-action="next-week" aria-label="Pr\xF3xima semana">${icon("right")}</button></div><button class="button" data-action="today">Hoje</button><button class="button primary" data-action="new">${icon("plus")} Novo story</button></div></div>`;
}
function card(story) {
  const category = state.categories.find((item) => item.id === story.category_id)?.name;
  const format = story.format ? formatLabels[story.format] : "";
  const members = story.sequence_group_id ? state.stories.filter((item) => item.sequence_group_id === story.sequence_group_id) : [];
  const sequence = story.sequence_group_id ? `<span class="sequence-badge">${story.sequence_position || members.indexOf(story) + 1}/${members.length}</span>` : "";
  return `<article class="story-card" data-story-id="${escapeHtml(story.id)}" data-status="${story.status}" draggable="true" tabindex="0" role="button" aria-label="${escapeHtml(story.title)}, ${statusLabels[story.status]}"><div class="card-top"><span class="card-time">${escapeHtml(story.planned_time || "\u2014")}</span><span class="status-pill" data-status="${story.status}">${statusLabels[story.status]}</span></div>${story.thumbnail_url ? `<img class="card-thumb" src="${escapeHtml(story.thumbnail_url)}" alt="">` : ""}<div class="card-title">${escapeHtml(story.title)}</div><div class="card-meta">${format ? `<span>${escapeHtml(format)}</span>` : ""}${category ? `<span>${escapeHtml(category)}</span>` : ""}</div><div class="card-footer"><span>${escapeHtml(story.responsible_name || "Sem respons\xE1vel")}</span>${sequence}</div></article>`;
}
function weekView() {
  const stories = visibleStories();
  const hotels = selectedHotels();
  const gaps = hotels.reduce((count, hotel) => count + Array.from({ length: 7 }, (_, n) => !stories.some((s) => s.hotel_id === hotel.id && s.date === addDays(state.week, n) && s.status !== "cancelled") ? 1 : 0).filter(Boolean).length, 0);
  const alerts = [];
  if (gaps) alerts.push(`${gaps} lacuna${gaps === 1 ? "" : "s"} na semana`);
  const ideasToday = stories.filter((s) => s.date === today && s.status === "idea").length;
  if (ideasToday) alerts.push(`${ideasToday} ideia${ideasToday === 1 ? "" : "s"} para hoje`);
  const noOwner = stories.filter((s) => !s.responsible_user_id && s.status !== "cancelled").length;
  if (noOwner) alerts.push(`${noOwner} sem respons\xE1vel`);
  const noMediaSoon = stories.filter((s) => !s.media_asset_id && s.date <= addDays(today, 1) && s.date >= today && ["ready", "scheduled"].includes(s.status)).length;
  if (noMediaSoon) alerts.push(`${noMediaSoon} pronto${noMediaSoon === 1 ? "" : "s"} sem m\xEDdia at\xE9 amanh\xE3`);
  const excess = hotels.flatMap((hotel) => Array.from({ length: 7 }, (_, n) => stories.filter((s) => s.hotel_id === hotel.id && s.date === addDays(state.week, n) && s.status !== "cancelled").length)).filter((count) => count >= 4 && count > Math.max(3, stories.length / Math.max(hotels.length * 7, 1) * 1.8)).length;
  if (excess) alerts.push(`${excess} dia${excess === 1 ? "" : "s"} com volume alto`);
  const dayNames = ["SEG", "TER", "QUA", "QUI", "SEX", "S\xC1B", "DOM"];
  const fullDays = ["Segunda", "Ter\xE7a", "Quarta", "Quinta", "Sexta", "S\xE1bado", "Domingo"];
  const board = `<div class="board-scroll"><div class="week-grid"><div class="grid-head hotel-head">Perfil / Hotel</div>${fullDays.map((name, index) => {
    const date = addDays(state.week, index);
    return `<div class="grid-head ${date === today ? "today" : ""}"><span>${name}</span><strong>${date.slice(-2)}</strong></div>`;
  }).join("")}${hotels.map((hotel) => `<div class="hotel-cell"><span class="avatar">${escapeHtml(hotel.short_name.slice(0, 2).toUpperCase())}</span><strong>${escapeHtml(hotel.short_name)}</strong><small>${escapeHtml(hotel.instagram_username)}</small></div>${dayNames.map((_, index) => {
    const date = addDays(state.week, index);
    const items = stories.filter((s) => s.hotel_id === hotel.id && s.date === date);
    return `<div class="day-cell ${date === today ? "today" : ""} ${items.length ? "" : "empty"}" data-hotel="${escapeHtml(hotel.id)}" data-date="${date}">${items.map(card).join("")}<button class="cell-add" data-action="new-cell" data-hotel="${escapeHtml(hotel.id)}" data-date="${date}" aria-label="Adicionar story para ${escapeHtml(hotel.short_name)} em ${date}" title="Novo story">+</button></div>`;
  }).join("")}`).join("")}</div></div>`;
  const mobile = `<div class="mobile-days">${dayNames.map((name, index) => {
    const date = addDays(state.week, index);
    return `<button class="${date === state.day ? "active" : ""}" data-day="${date}">${name}<br><strong>${date.slice(-2)}</strong></button>`;
  }).join("")}</div><div class="mobile-board">${hotels.map((hotel) => {
    const items = stories.filter((s) => s.hotel_id === hotel.id && s.date === state.day);
    return `<section class="mobile-hotel"><h3>${escapeHtml(hotel.short_name)} \xB7 ${escapeHtml(hotel.instagram_username)}</h3>${items.length ? items.map(card).join("") : '<p class="subtle">Nenhum story planejado.</p>'}<button class="cell-add" data-action="new-cell" data-hotel="${escapeHtml(hotel.id)}" data-date="${state.day}" aria-label="Adicionar story">+ Adicionar</button></section>`;
  }).join("")}</div>`;
  return `${weekHeading()}${filtersHtml()}${metricsHtml(stories)}${alerts.length ? `<div class="notice-bar">${icon("alert")} ${escapeHtml(alerts.join(" \xB7 "))}</div>` : ""}${hotels.length ? `${board}${mobile}` : emptyState("Nenhum hotel corresponde ao filtro.")}`;
}
function calendarView() {
  const date = fromIso(state.day), year = date.getFullYear(), month = date.getMonth();
  const first = new Date(year, month, 1), offset = (first.getDay() + 6) % 7;
  const start2 = isoDate(new Date(year, month, 1 - offset));
  const stories = visibleStories();
  return `<div class="page-heading"><div><p class="eyebrow">Vis\xE3o mensal</p><h1>Calend\xE1rio</h1><p class="subtle">${escapeHtml(dateLabel(isoDate(first), { month: "long", year: "numeric" }))}</p></div><div class="heading-actions"><button class="button" data-action="prev-month">${icon("left")}</button><button class="button" data-action="next-month">${icon("right")}</button><button class="button primary" data-action="new">${icon("plus")} Novo story</button></div></div>${filtersHtml()}<div class="calendar-grid">${["Seg", "Ter", "Qua", "Qui", "Sex", "S\xE1b", "Dom"].map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}${Array.from({ length: 42 }, (_, index) => {
    const current = addDays(start2, index), items = stories.filter((s) => s.date === current);
    return `<div class="calendar-day ${fromIso(current).getMonth() !== month ? "outside" : ""}"><div class="calendar-date ${current === today ? "today" : ""}">${current.slice(-2)}</div>${items.slice(0, 4).map((story) => `<button class="calendar-story" data-story-id="${escapeHtml(story.id)}" title="${escapeHtml(story.title)}">${escapeHtml(story.planned_time || "")} ${escapeHtml(story.title)}</button>`).join("")}${items.length > 4 ? `<small>+${items.length - 4}</small>` : ""}</div>`;
  }).join("")}</div>`;
}
function pendingView() {
  const stories = visibleStories();
  const sections = [
    ["Stories atrasados", (s) => s.date < today && !["published", "cancelled"].includes(s.status)],
    ["Em produ\xE7\xE3o", (s) => s.status === "producing"],
    ["Aguardando aprova\xE7\xE3o", (s) => s.status === "approval"],
    ["Sem m\xEDdia", (s) => !s.media_asset_id && !["cancelled", "published"].includes(s.status)],
    ["Sem respons\xE1vel", (s) => !s.responsible_user_id && s.status !== "cancelled"],
    ["Programados para hoje", (s) => s.date === today && s.status === "scheduled"]
  ];
  return `<div class="page-heading"><div><p class="eyebrow">Acompanhamento</p><h1>Pend\xEAncias</h1><p class="subtle">Itens dos \xFAltimos 30 dias e pr\xF3ximos 7 dias.</p></div><button class="button primary" data-action="new">${icon("plus")} Novo story</button></div>${filtersHtml()}${sections.map(([title, predicate]) => {
    const items = stories.filter(predicate);
    return `<section class="section-card"><h2>${title} <span class="subtle">${items.length}</span></h2><div class="pending-list">${items.length ? items.map((story) => `<button class="pending-row" data-story-id="${escapeHtml(story.id)}"><strong>${escapeHtml(story.title)}</strong><small>${escapeHtml(state.hotels.find((h) => h.id === story.hotel_id)?.short_name)}</small><small>${escapeHtml(story.date)}</small><span class="status-pill" data-status="${story.status}">${statusLabels[story.status]}</span></button>`).join("") : '<p class="subtle">Nenhum item nesta categoria.</p>'}</div></section>`;
  }).join("")}`;
}
function campaignsView() {
  return `<div class="page-heading"><div><p class="eyebrow">Conte\xFAdo</p><h1>Campanhas</h1><p class="subtle">Agrupe Stories de diferentes hot\xE9is em uma iniciativa.</p></div><button class="button primary" data-action="new-campaign">${icon("plus")} Nova campanha</button></div><div class="campaign-grid">${state.campaigns.map((campaign) => `<article class="campaign-card"><h2>${escapeHtml(campaign.name)}</h2><p>${escapeHtml(campaign.description || "Sem descri\xE7\xE3o")}</p><p>${escapeHtml(campaign.start_date || "Sem in\xEDcio")} \u2014 ${escapeHtml(campaign.end_date || "Sem fim")}</p><div class="campaign-stats"><span>${campaign.story_count} stories</span><span>${campaign.published_count} publicados</span><span>${campaign.hotel_count} hot\xE9is</span></div><button type="button" class="button" data-action="edit-campaign" data-campaign-id="${escapeHtml(campaign.id)}" style="margin-top:14px">Editar campanha</button></article>`).join("")}</div>${!state.campaigns.length ? '<div class="empty-state"><h2>Nenhuma campanha cadastrada.</h2><p>Crie uma campanha para organizar Stories de v\xE1rios hot\xE9is.</p><button class="button primary" data-action="new-campaign">Nova campanha</button></div>' : ""}`;
}
function openCampaignDialog(campaign) {
  const existing = document.querySelector("#campaignDialog");
  existing?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "campaignDialog";
  dialog.className = "campaign-dialog";
  dialog.innerHTML = `<form id="campaignForm"><header><h2>${campaign ? "Editar campanha" : "Nova campanha"}</h2><button type="button" class="icon-button" data-action="close-campaign" aria-label="Fechar">${icon("close")}</button></header><div class="form-grid">${field("name", "Nome", campaign?.name, "text", true)}${field("description", "Descri\xE7\xE3o", campaign?.description, "textarea", true)}${field("start_date", "In\xEDcio", campaign?.start_date, "date")}${field("end_date", "T\xE9rmino", campaign?.end_date, "date")}${selectField("status", "Status", campaign?.status || "planned", [{ id: "planned", name: "Planejada" }, { id: "active", name: "Ativa" }, { id: "completed", name: "Conclu\xEDda" }, { id: "cancelled", name: "Cancelada" }])}</div><footer><button type="button" class="button" data-action="close-campaign">Cancelar</button><button class="button primary" type="submit">Salvar campanha</button></footer></form>`;
  dialog.querySelector("[name=name]").required = true;
  dialog.dataset.campaignId = campaign?.id || "";
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector("[name=name]")?.focus();
}
function assetsView() {
  return `<div class="page-heading"><div><p class="eyebrow">Conte\xFAdo</p><h1>Banco de conte\xFAdos</h1><p class="subtle">A biblioteca de m\xEDdia existente permite reutilizar fotos e v\xEDdeos.</p></div></div><div class="section-card"><h2>Biblioteca de m\xEDdia</h2><p class="subtle">Escolha arquivos na Central de Portais e associe o ID da m\xEDdia ao Story no painel de edi\xE7\xE3o.</p><p><a class="button" href="/admin/portais/media/">Abrir biblioteca de m\xEDdia</a></p></div>`;
}
function hotelsView() {
  return `<div class="page-heading"><div><p class="eyebrow">Administra\xE7\xE3o</p><h1>Hot\xE9is</h1><p class="subtle">Perfis inclu\xEDdos no planejamento editorial.</p></div></div><div class="section-card"><div class="pending-list">${state.hotels.map((hotel) => `<div class="pending-row"><strong>${escapeHtml(hotel.name)}</strong><small>${escapeHtml(hotel.instagram_username)}</small><small>${hotel.active ? "Ativo" : "Inativo"}</small></div>`).join("")}</div></div>`;
}
function categoriesView() {
  return `<div class="page-heading"><div><p class="eyebrow">Administra\xE7\xE3o</p><h1>Categorias</h1><p class="subtle">Categorias dispon\xEDveis para classificar Stories.</p></div></div><div class="section-card"><div class="category-list">${state.categories.map((category) => `<span>${escapeHtml(category.name)}</span>`).join("")}</div></div>`;
}
function performanceView() {
  return `<div class="page-heading"><div><p class="eyebrow">An\xE1lise</p><h1>Desempenho</h1><p class="subtle">Esta \xE1rea receber\xE1 m\xE9tricas quando a integra\xE7\xE3o de dados do Instagram estiver dispon\xEDvel.</p></div></div><div class="section-card"><h2>An\xE1lise em prepara\xE7\xE3o</h2><p class="subtle">O planejamento e os estados de publica\xE7\xE3o j\xE1 s\xE3o registrados. M\xE9tricas de alcance e engajamento dependem de uma integra\xE7\xE3o autorizada com o Instagram.</p></div>`;
}
function emptyState(message) {
  return `<div class="empty-state"><h2>${escapeHtml(message)}</h2><p>Crie um Story para come\xE7ar o planejamento.</p><button class="button primary" data-action="new">Novo story</button></div>`;
}
function render() {
  renderNavigation();
  if (state.loading) {
    main.innerHTML = '<div class="loading-shell"><div class="skeleton title"></div><div class="skeleton toolbar"></div><div class="skeleton grid"></div></div>';
    return;
  }
  main.innerHTML = { week: weekView, calendar: calendarView, pending: pendingView, campaigns: campaignsView, assets: assetsView, hotels: hotelsView, categories: categoriesView, performance: performanceView }[state.view]();
}
function openDrawer(story, date = today, hotel = "") {
  state.drawer = story;
  state.createDate = date;
  state.createHotel = hotel;
  renderDrawer();
  drawer.hidden = false;
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  drawer.querySelector("input[name=title]")?.focus();
}
function closeDrawer() {
  state.drawer = null;
  drawer.hidden = true;
  backdrop.hidden = true;
  document.body.style.overflow = "";
}
function field(name, label, value, kind = "text", full = false) {
  const escaped = escapeHtml(value);
  const required = ["title", "hotel_id", "date"].includes(name) ? "required" : "";
  return `<label class="${full ? "full" : ""}"><span>${label}${required ? " *" : ""}</span>${kind === "textarea" ? `<textarea name="${name}">${escaped}</textarea>` : `<input name="${name}" type="${kind}" value="${escaped}" ${required}>`}</label>`;
}
function selectField(name, label, value, values, required = false) {
  return `<label><span>${label}${required ? " *" : ""}</span><select name="${name}" ${required ? "required" : ""}>${required ? option("", "Selecione", value || "") : option("", "N\xE3o definido", value || "")}${values.map((item) => option(item.id, item.name, value || "")).join("")}</select></label>`;
}
function renderDrawer() {
  const story = state.drawer === "new" ? null : state.drawer;
  if (!state.drawer) return;
  const formatOptions = Object.entries(formatLabels).map(([id, name]) => ({ id, name }));
  const objectiveOptions = Object.entries(objectiveLabels).map(([id, name]) => ({ id, name }));
  const statusOptions = Object.entries(statusLabels).map(([id, name]) => ({ id, name }));
  const priorityOptions = Object.entries(priorityLabels).map(([id, name]) => ({ id, name }));
  drawer.innerHTML = `<div class="drawer-header"><div><small>${story ? "Editar story" : "Novo story"}</small><h2 id="drawerTitle">${escapeHtml(story?.title || "Planejar Story")}</h2></div><button class="icon-button" data-action="close-drawer" aria-label="Fechar">${icon("close")}</button></div><form id="storyForm"><div class="drawer-body"><section class="drawer-section"><h3>Planejamento</h3><div class="form-grid">${selectField("hotel_id", "Hotel", story?.hotel_id || state.createHotel, state.hotels, true)}${field("date", "Data", story?.date || state.createDate, "date")}${field("planned_time", "Hor\xE1rio planejado", story?.planned_time, "time")}${selectField("status", "Status", story?.status || "idea", statusOptions)}${selectField("priority", "Prioridade", story?.priority || "normal", priorityOptions)}</div></section><section class="drawer-section"><h3>Conte\xFAdo</h3><div class="form-grid">${field("title", "T\xEDtulo interno", story?.title, "text", true)}${field("description", "Descri\xE7\xE3o / ideia", story?.description, "textarea", true)}${field("story_text", "Texto sugerido", story?.story_text, "textarea", true)}${selectField("category_id", "Categoria", story?.category_id || null, state.categories)}${selectField("content_pillar_id", "Pilar de conte\xFAdo", story?.content_pillar_id || null, state.pillars)}${selectField("format", "Formato", story?.format || null, formatOptions)}${selectField("objective", "Objetivo", story?.objective || null, objectiveOptions)}${field("cta", "CTA", story?.cta)}${field("link", "Link", story?.link, "url", true)}</div></section><section class="drawer-section"><h3>M\xEDdia</h3><div class="form-grid">${field("media_asset_id", "ID da m\xEDdia na biblioteca", story?.media_asset_id, "text", true)}</div><p class="drawer-hint">O arquivo \xE9 armazenado na biblioteca R2 existente e pode ser reutilizado em outros Stories.</p>${story?.thumbnail_url ? `<img src="${escapeHtml(story.thumbnail_url)}" alt="Pr\xE9via da m\xEDdia" style="max-height:100px;border-radius:7px;margin-top:10px">` : ""}</section><section class="drawer-section"><h3>Respons\xE1vel</h3><div class="form-grid">${selectField("responsible_user_id", "Pessoa respons\xE1vel", story?.responsible_user_id || null, state.users)}</div></section><section class="drawer-section"><h3>Publica\xE7\xE3o</h3><div class="form-grid">${selectField("campaign_id", "Campanha", story?.campaign_id || null, state.campaigns)}${field("published_at", "Publicado em (ISO)", story?.published_at)}${field("published_url", "URL publicada", story?.published_url, "url", true)}</div></section><section class="drawer-section"><h3>Sequ\xEAncia</h3><div class="form-grid">${selectField("sequence_group_id", "Grupo", story?.sequence_group_id || null, state.sequences.map((sequence) => ({ id: sequence.id, name: sequence.title })))}${field("sequence_position", "Posi\xE7\xE3o", story?.sequence_position)}</div><button type="button" class="button" data-action="new-sequence" style="margin-top:10px">Criar sequ\xEAncia</button></section><section class="drawer-section"><h3>Informa\xE7\xF5es adicionais</h3><div class="form-grid">${field("notes", "Observa\xE7\xF5es", story?.notes, "textarea", true)}</div></section><div id="deleteConfirm"></div></div><div class="drawer-actions">${story ? `<button type="button" class="button" data-action="duplicate">Duplicar</button><button type="button" class="button" data-action="mark-ready">Pronto</button><button type="button" class="button" data-action="mark-published">Publicado</button><button type="button" class="button danger" data-action="delete">Excluir</button>` : ""}<button type="submit" class="button primary">${state.saving ? "Salvando..." : "Salvar story"}</button></div></form>`;
  const mediaSection = drawer.querySelector(".drawer-section:nth-of-type(3)");
  mediaSection?.insertAdjacentHTML("beforeend", '<button type="button" class="button" data-action="choose-media" style="margin-top:10px">Escolher da biblioteca</button><div id="mediaChoices"></div>');
  if (story?.sequence_group_id) drawer.querySelector(".drawer-actions")?.insertAdjacentHTML("afterbegin", '<button type="button" class="button" data-action="duplicate-sequence">Duplicar sequ\xEAncia</button>');
  if (story) drawer.querySelector(".drawer-actions")?.insertAdjacentHTML("afterbegin", '<button type="button" class="button" data-action="move">Mover</button>');
}
function formInput() {
  const form = drawer.querySelector("#storyForm");
  const data = new FormData(form);
  const fields = ["hotel_id", "date", "planned_time", "title", "description", "story_text", "category_id", "content_pillar_id", "format", "objective", "status", "priority", "cta", "link", "responsible_user_id", "campaign_id", "media_asset_id", "sequence_group_id", "sequence_position", "notes", "published_at", "published_url"];
  const input = {};
  for (const key of fields) input[key] = String(data.get(key) || "").trim() || null;
  input.sequence_position = input.sequence_position ? Number(input.sequence_position) : null;
  if (input.published_at) input.published_at = new Date(String(input.published_at)).toISOString();
  return input;
}
async function saveDrawer(event) {
  event.preventDefault();
  if (state.saving) return;
  const form = event.target;
  if (!form.reportValidity()) return;
  state.saving = true;
  const existing = state.drawer && state.drawer !== "new" ? state.drawer : null;
  try {
    const saved = existing ? await apiStoryRepository.update(existing.id, formInput()) : await apiStoryRepository.create(formInput());
    state.stories = existing ? state.stories.map((story) => story.id === saved.id ? saved : story) : [...state.stories, saved];
    if (existing?.campaign_id || saved.campaign_id) {
      try {
        state.campaigns = await apiStoryRepository.campaigns();
      } catch {
      }
    }
    closeDrawer();
    render();
    notify(existing ? "Story atualizado." : "Story criado.");
  } catch (error) {
    notify(error.message, true);
  } finally {
    state.saving = false;
  }
}
async function patchStory(story, patch, success) {
  const previous = state.stories.map((item) => ({ ...item }));
  state.stories = state.stories.map((item) => item.id === story.id ? { ...item, ...patch } : item);
  render();
  try {
    const saved = await apiStoryRepository.update(story.id, patch);
    state.stories = state.stories.map((item) => item.id === saved.id ? saved : item);
    if (story.campaign_id || saved.campaign_id) {
      try {
        state.campaigns = await apiStoryRepository.campaigns();
      } catch {
      }
    }
    render();
    notify(success);
    if (state.drawer && state.drawer !== "new" && state.drawer.id === story.id) {
      state.drawer = saved;
      renderDrawer();
    }
  } catch (error) {
    state.stories = previous;
    render();
    notify(`Altera\xE7\xE3o revertida: ${error.message}`, true);
  }
}
async function handleDrop(target, sourceId, overId, before) {
  const story = state.stories.find((item) => item.id === sourceId);
  if (!story) return;
  const hotel_id = target.dataset.hotel, date = target.dataset.date;
  const ordered = visibleStories().filter((item) => item.hotel_id === hotel_id && item.date === date && item.id !== sourceId);
  let index = overId ? ordered.findIndex((item) => item.id === overId) : ordered.length;
  if (index < 0) index = ordered.length;
  if (overId && !before) index += 1;
  const previous = ordered[index - 1]?.sort_order;
  const next = ordered[index]?.sort_order;
  const sort_order = previous != null && next != null ? (previous + next) / 2 : previous != null ? previous + 100 : next != null ? next - 100 : 1e3;
  if (story.sequence_group_id && window.confirm("Mover toda a sequ\xEAncia para este dia e hotel? Clique em Cancelar para mover apenas este Story.")) {
    const previous2 = state.stories.map((item) => ({ ...item }));
    state.stories = state.stories.map((item) => item.sequence_group_id === story.sequence_group_id ? { ...item, hotel_id, date } : item);
    render();
    try {
      await apiStoryRepository.moveSequence(story.sequence_group_id, hotel_id, date);
      notify("Sequ\xEAncia movida.");
    } catch (error) {
      state.stories = previous2;
      render();
      notify(error.message, true);
    }
  } else await patchStory(story, { hotel_id, date, sort_order }, "Story movido.");
}
function planningAlerts() {
  return visibleStories().filter((s) => s.date === today && s.status === "idea").length;
}
document.addEventListener("click", async (event) => {
  const target = event.target;
  const nav = target.closest("[data-view]");
  if (nav) {
    event.preventDefault();
    route(nav.dataset.view);
    return;
  }
  const day = target.closest("[data-day]");
  if (day) {
    state.day = day.dataset.day;
    render();
    return;
  }
  const storyElement = target.closest("[data-story-id]");
  if (storyElement && !target.closest("[data-action]")) {
    const story = state.stories.find((item) => item.id === storyElement.dataset.storyId);
    if (story) openDrawer(story);
    return;
  }
  const button = target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "close-drawer") closeDrawer();
  if (action === "new") openDrawer("new", state.view === "week" && (today < state.week || today > addDays(state.week, 6)) ? state.week : today);
  if (action === "new-cell") openDrawer("new", button.dataset.date, button.dataset.hotel);
  if (action === "prev-week" || action === "next-week" || action === "today") {
    state.week = action === "today" ? weekStart(today) : addDays(state.week, action === "prev-week" ? -7 : 7);
    state.day = state.week;
    updateUrl();
    void loadStories();
  }
  if (action === "prev-month" || action === "next-month") {
    const d = fromIso(state.day);
    d.setDate(1);
    d.setMonth(d.getMonth() + (action === "prev-month" ? -1 : 1));
    state.day = isoDate(d);
    state.week = weekStart(state.day);
    updateUrl();
    void loadStories();
  }
  const current = state.drawer && state.drawer !== "new" ? state.drawer : null;
  if (current && action === "mark-ready") await patchStory(current, { status: "ready" }, "Marcado como pronto.");
  if (current && action === "mark-published") await patchStory(current, { status: "published", published_at: (/* @__PURE__ */ new Date()).toISOString() }, "Marcado como publicado.");
  if (current && action === "duplicate") {
    const copy = { ...current, title: `${current.title} (c\xF3pia)`, status: "idea", published_at: null, published_url: null, sequence_group_id: null, sequence_position: null };
    try {
      const created = await apiStoryRepository.create(copy);
      state.stories.push(created);
      render();
      notify("Story duplicado.");
      openDrawer(created);
    } catch (error) {
      notify(error.message, true);
    }
  }
  if (current && action === "duplicate-sequence" && current.sequence_group_id) {
    try {
      const result = await apiStoryRepository.duplicateSequence(current.sequence_group_id);
      state.sequences.push(result.sequence);
      state.stories.push(...result.stories);
      render();
      notify("Sequ\xEAncia duplicada.");
      closeDrawer();
    } catch (error) {
      notify(error.message, true);
    }
  }
  if (current && action === "move") {
    drawer.querySelector("[name=date]")?.focus();
    drawer.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (action === "choose-media") {
    const hotelId = drawer.querySelector("[name=hotel_id]")?.value;
    const choices = drawer.querySelector("#mediaChoices");
    if (!hotelId) {
      notify("Selecione um hotel primeiro.", true);
      return;
    }
    choices.innerHTML = '<p class="drawer-hint">Carregando m\xEDdia...</p>';
    try {
      const response = await fetch(`/api/v1/admin/media?hotel_id=${encodeURIComponent(hotelId)}&limit=24`, { credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Biblioteca indispon\xEDvel para este hotel.");
      const assets = payload.data.assets;
      choices.innerHTML = assets.length ? `<div class="media-choices">${assets.map((asset) => `<button type="button" class="media-choice" data-action="select-media" data-media-id="${escapeHtml(asset.id)}">${asset.mime_type.startsWith("image/") ? `<img src="${escapeHtml(asset.public_url)}" alt="">` : icon("image")}<span>${escapeHtml(asset.alt_text || asset.original_filename || asset.id)}</span></button>`).join("")}</div>` : '<p class="drawer-hint">Nenhum arquivo dispon\xEDvel para este hotel.</p>';
    } catch (error) {
      choices.innerHTML = `<p class="drawer-hint">${escapeHtml(error.message)}</p>`;
    }
  }
  if (action === "select-media") {
    const input = drawer.querySelector("[name=media_asset_id]");
    if (input) input.value = button.dataset.mediaId || "";
    drawer.querySelector("#mediaChoices").innerHTML = "";
    notify("M\xEDdia selecionada.");
  }
  if (current && action === "delete") {
    document.querySelector("#deleteConfirm").innerHTML = `<div class="dialog-inline">Excluir \u201C${escapeHtml(current.title)}\u201D permanentemente?<br><button type="button" class="button danger" data-action="confirm-delete">Confirmar exclus\xE3o</button><button type="button" class="button" data-action="cancel-delete">Cancelar</button></div>`;
  }
  if (action === "cancel-delete") document.querySelector("#deleteConfirm").innerHTML = "";
  if (current && action === "confirm-delete") {
    try {
      await apiStoryRepository.remove(current.id);
      state.stories = state.stories.filter((item) => item.id !== current.id);
      if (current.campaign_id) {
        try {
          state.campaigns = await apiStoryRepository.campaigns();
        } catch {
        }
      }
      closeDrawer();
      render();
      notify("Story exclu\xEDdo.");
    } catch (error) {
      notify(error.message, true);
    }
  }
  if (action === "new-sequence") {
    const title = window.prompt("Nome da sequ\xEAncia");
    if (title?.trim()) {
      try {
        const sequence = await apiStoryRepository.createSequence(title.trim());
        state.sequences.push(sequence);
        const select = drawer.querySelector("[name=sequence_group_id]");
        if (select) {
          select.insertAdjacentHTML("beforeend", option(sequence.id, sequence.title));
          select.value = sequence.id;
        }
        notify("Sequ\xEAncia criada.");
      } catch (error) {
        notify(error.message, true);
      }
    }
  }
  if (action === "new-campaign") openCampaignDialog();
  if (action === "edit-campaign") openCampaignDialog(state.campaigns.find((campaign) => campaign.id === button.dataset.campaignId));
  if (action === "close-campaign") document.querySelector("#campaignDialog")?.close();
});
document.addEventListener("change", (event) => {
  const target = event.target;
  if (!target.dataset.filter || target.dataset.filter === "search") return;
  state.filters[target.dataset.filter] = target.value;
  updateUrl();
  void loadStories();
});
document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.filter !== "search") return;
  state.filters.search = target.value;
  updateUrl();
  const active = document.activeElement;
  const cursor = active.selectionStart;
  render();
  const replacement = main.querySelector("[data-filter=search]");
  replacement?.focus();
  if (cursor !== null) replacement?.setSelectionRange(cursor, cursor);
});
drawer.addEventListener("submit", (event) => {
  if (event.target.id === "storyForm") void saveDrawer(event);
});
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "campaignForm") return;
  event.preventDefault();
  const dialog = document.querySelector("#campaignDialog");
  const data = new FormData(event.target);
  const input = { name: String(data.get("name") || ""), description: String(data.get("description") || ""), start_date: String(data.get("start_date") || ""), end_date: String(data.get("end_date") || ""), status: String(data.get("status") || "planned") };
  try {
    dialog.dataset.campaignId ? await apiStoryRepository.updateCampaign(dialog.dataset.campaignId, input) : await apiStoryRepository.createCampaign(input);
    state.campaigns = await apiStoryRepository.campaigns();
    dialog.close();
    dialog.remove();
    render();
    notify("Campanha salva.");
  } catch (error) {
    notify(error.message, true);
  }
});
backdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.drawer) closeDrawer();
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".story-card")) {
    event.preventDefault();
    const story = state.stories.find((item) => item.id === event.target.dataset.storyId);
    if (story) openDrawer(story);
  }
});
document.addEventListener("dragstart", (event) => {
  const card2 = event.target.closest(".story-card");
  if (!card2) return;
  event.dataTransfer?.setData("text/plain", card2.dataset.storyId || "");
  event.dataTransfer.effectAllowed = "move";
  card2.classList.add("dragging");
});
document.addEventListener("dragend", (event) => {
  event.target.closest(".story-card")?.classList.remove("dragging");
  document.querySelectorAll(".drag-over").forEach((item) => item.classList.remove("drag-over"));
});
document.addEventListener("dragover", (event) => {
  const cell = event.target.closest(".day-cell");
  if (!cell) return;
  event.preventDefault();
  cell.classList.add("drag-over");
});
document.addEventListener("dragleave", (event) => {
  const cell = event.target.closest(".day-cell");
  if (cell && !cell.contains(event.relatedTarget)) cell.classList.remove("drag-over");
});
document.addEventListener("drop", (event) => {
  const element = event.target;
  const cell = element.closest(".day-cell");
  if (!cell) return;
  event.preventDefault();
  cell.classList.remove("drag-over");
  const id = event.dataTransfer?.getData("text/plain");
  const over = element.closest(".story-card");
  const before = over ? event.clientY < over.getBoundingClientRect().top + over.getBoundingClientRect().height / 2 : false;
  if (id) void handleDrop(cell, id, over?.dataset.storyId || null, before);
});
document.querySelector("#collapseSidebar").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("collapsed"));
document.querySelector("#openSidebar").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("mobile-open"));
async function start() {
  try {
    const response = await fetch("/api/v1/admin/session", { credentials: "same-origin" });
    if (response.status === 401) {
      location.href = "/admin/";
      return;
    }
    const payload = await response.json();
    if (!payload.ok || !payload.data.permissions.includes("social-planner.read")) throw new Error("Acesso ao Social Planner n\xE3o liberado para este usu\xE1rio.");
    document.querySelector("#currentUser").textContent = payload.data.user?.display_name || "Marketing";
    [state.hotels, state.categories, state.pillars, state.users, state.campaigns, state.sequences] = await Promise.all([apiStoryRepository.hotels(), apiStoryRepository.categories(), apiStoryRepository.pillars(), apiStoryRepository.users(), apiStoryRepository.campaigns(), apiStoryRepository.sequences()]);
    await loadStories();
    if (planningAlerts()) notify(`${planningAlerts()} Story(s) de hoje ainda est\xE3o como Ideia.`);
  } catch (error) {
    state.loading = false;
    main.innerHTML = `<div class="empty-state"><h2>N\xE3o foi poss\xEDvel abrir o planner</h2><p>${escapeHtml(error.message)}</p><a class="button" href="/admin/">Voltar \xE0 Central</a></div>`;
  }
}
void start();
