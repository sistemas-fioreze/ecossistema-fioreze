import { apiStoryRepository as repository } from "./repository";
import type { Campaign, Category, ContentPillar, Hotel, Story, StoryFilters, StoryInput, StorySequence, User } from "./types";
import { addDays, dateLabel, escapeHtml as e, formatLabels, fromIso, isoDate, objectiveLabels, option, priorityLabels, statusLabels, weekStart } from "./utils";

type View = "week" | "calendar" | "pending" | "campaigns" | "assets" | "hotels" | "categories" | "performance";
const views: Record<View, string> = { week: "Semana", calendar: "Calendário", pending: "Pendências", campaigns: "Campanhas", assets: "Banco de conteúdos", hotels: "Hotéis", categories: "Categorias", performance: "Desempenho" };
const today = isoDate(new Date());
const params = new URLSearchParams(location.search);
const initialWeek = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") || "") ? params.get("week")! : today;
const state = {
  view: (location.pathname.split("/").filter(Boolean).at(-1) || "week") as View,
  week: weekStart(initialWeek), day: today,
  filters: { hotel_id: params.get("hotel") || "all", status: params.get("status") || "all", category_id: params.get("category") || "all", responsible_user_id: params.get("responsible") || "all", campaign_id: params.get("campaign") || "all", search: params.get("q") || "" } as StoryFilters,
  hotels: [] as Hotel[], categories: [] as Category[], pillars: [] as ContentPillar[], users: [] as User[], campaigns: [] as Campaign[], sequences: [] as StorySequence[], stories: [] as Story[],
  loading: true, drawer: null as Story | "new" | null, createDate: today, createHotel: "", saving: false,
};
if (!Object.hasOwn(views, state.view)) state.view = "week";
if (state.day < state.week || state.day > addDays(state.week, 6)) state.day = state.week;
const main = document.querySelector<HTMLElement>("#mainContent")!;
const drawer = document.querySelector<HTMLElement>("#storyDrawer")!;
const backdrop = document.querySelector<HTMLElement>("#drawerBackdrop")!;
const toast = document.querySelector<HTMLElement>("#toast")!;
let toastTimer = 0;
let loadVersion = 0;

function icon(name: string): string {
  const paths: Record<string, string> = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
    check: '<path d="m4 12 5 5L20 6"/>', image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
    flag: '<path d="M4 21V4m0 1c5-4 11 4 16 0v11c-5 4-11-4-16 0"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
    hotel: '<path d="M4 21V5l8-3 8 3v16M4 21h16M9 21v-5h6v5M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8M18 15a6 6 0 0 1 4 6"/>',
    tag: '<path d="M3 3h9l9 9-9 9-9-9V3Z"/><circle cx="8" cy="8" r="1"/>', plus: '<path d="M12 4v16M4 12h16"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/>', close: '<path d="M5 5l14 14M19 5 5 19"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}
function notify(message: string, error = false) {
  toast.textContent = message; toast.classList.toggle("error", error); toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4000);
}
function route(view: View) {
  state.view = view; updateUrl(); if (["week", "calendar", "pending"].includes(view)) void loadStories(); else render();
}
function updateUrl() {
  const query = new URLSearchParams(); query.set("week", state.week);
  for (const [key, urlKey] of [["hotel_id", "hotel"], ["status", "status"], ["category_id", "category"], ["responsible_user_id", "responsible"], ["campaign_id", "campaign"], ["search", "q"]] as const) {
    const value = state.filters[key]; if (value && value !== "all") query.set(urlKey, value);
  }
  history.replaceState({}, "", `/admin/social-planner/${state.view}?${query}`);
}
function renderNavigation() {
  const groups = [
    ["Planejamento", [["week", "Semana", "grid"], ["calendar", "Calendário", "calendar"], ["pending", "Pendências", "alert"]]],
    ["Conteúdo", [["assets", "Banco de conteúdos", "image"], ["campaigns", "Campanhas", "flag"]]],
    ["Análise", [["performance", "Desempenho", "grid"]]],
    ["Administração", [["hotels", "Hotéis", "hotel"], ["categories", "Categorias", "tag"], ["users", "Usuários", "users"], ["settings", "Configurações", "settings"]]],
  ] as const;
  const targets: Record<string, string> = { users: "/admin/usuarios/", settings: "/admin/configuracoes/" };
  document.querySelector<HTMLElement>("#navigation")!.innerHTML = groups.map(([title, items]) => `<div class="nav-group"><span class="nav-heading">${title}</span>${items.map(([key, label, symbol]) => `<a class="nav-link ${state.view === key ? "active" : ""}" href="${targets[key] || `/admin/social-planner/${key}`}" ${targets[key] ? "" : `data-view="${key}"`} title="${label}">${icon(symbol)}<span class="nav-label">${label}</span></a>`).join("")}</div>`).join("");
  document.querySelector<HTMLElement>("#viewTitle")!.textContent = views[state.view];
}
function dateRange(): [string, string] {
  if (state.view === "calendar") { const date = fromIso(state.day); return [isoDate(new Date(date.getFullYear(), date.getMonth(), 1)), isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))]; }
  if (state.view === "pending") return [addDays(today, -30), addDays(today, 7)];
  return [state.week, addDays(state.week, 6)];
}
async function loadStories() {
  const version = ++loadVersion; state.loading = true; render();
  try { const [start, end] = dateRange(); const stories = await repository.stories(start, end, state.filters); if (version === loadVersion) state.stories = stories; }
  catch (error) { notify((error as Error).message, true); }
  finally { if (version === loadVersion) { state.loading = false; render(); } }
}
function visibleStories(): Story[] {
  const needle = state.filters.search.trim().toLocaleLowerCase("pt-BR");
  return state.stories.filter((story) => !needle || [story.title, story.description, story.story_text, story.responsible_name].some((item) => item?.toLocaleLowerCase("pt-BR").includes(needle)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.hotel_id.localeCompare(b.hotel_id) || a.sort_order - b.sort_order || (a.planned_time || "").localeCompare(b.planned_time || ""));
}
function selectedHotels(): Hotel[] { return state.hotels.filter((hotel) => state.filters.hotel_id === "all" || state.filters.hotel_id === hotel.id); }
function filtersHtml(): string {
  const f = state.filters;
  const select = (key: keyof StoryFilters, label: string, values: { id: string; name: string }[]) => `<select data-filter="${key}" aria-label="${label}">${option("all", label, f[key])}${values.map((item) => option(item.id, item.name, f[key])).join("")}</select>`;
  return `<div class="filter-panel">${select("hotel_id", "Todos os hotéis", state.hotels)}${select("status", "Todos os status", Object.entries(statusLabels).map(([id, name]) => ({ id, name })))}${select("category_id", "Todas as categorias", state.categories)}${select("responsible_user_id", "Todos os responsáveis", state.users)}${select("campaign_id", "Todas as campanhas", state.campaigns)}<input type="search" data-filter="search" value="${e(f.search)}" placeholder="Pesquisar stories" aria-label="Pesquisar stories"></div>`;
}
function metricsHtml(stories: Story[]): string {
  const counts = [
    ["Stories planejados", stories.filter((s) => s.status !== "cancelled").length, ""],
    ["Prontos", stories.filter((s) => s.status === "ready" || s.status === "scheduled").length, "ready"],
    ["Em produção", stories.filter((s) => s.status === "producing").length, "producing"],
    ["Pendentes", stories.filter((s) => ["idea", "to_produce", "approval"].includes(s.status)).length, "pending"],
    ["Publicados", stories.filter((s) => s.status === "published").length, "published"],
  ];
  return `<div class="metrics">${counts.map(([label, count, cls]) => `<div class="metric ${cls}"><small>${label}</small><strong>${count}</strong></div>`).join("")}</div>`;
}
function weekHeading(): string {
  const end = addDays(state.week, 6);
  const label = `${dateLabel(state.week, { day: "2-digit", month: "short" })} — ${dateLabel(end, { day: "2-digit", month: "short" })}`;
  return `<div class="page-heading"><div><p class="eyebrow">Planejamento editorial</p><h1>Semana</h1><p class="subtle">Stories planejados para cada perfil da rede.</p></div><div class="heading-actions"><div class="week-nav"><button class="icon-button" data-action="prev-week" aria-label="Semana anterior">${icon("left")}</button><span class="week-label">${e(label)}</span><button class="icon-button" data-action="next-week" aria-label="Próxima semana">${icon("right")}</button></div><button class="button" data-action="today">Hoje</button><button class="button primary" data-action="new">${icon("plus")} Novo story</button></div></div>`;
}
function card(story: Story): string {
  const category = state.categories.find((item) => item.id === story.category_id)?.name;
  const format = story.format ? formatLabels[story.format] : "";
  const members = story.sequence_group_id ? state.stories.filter((item) => item.sequence_group_id === story.sequence_group_id) : [];
  const sequence = story.sequence_group_id ? `<span class="sequence-badge">${story.sequence_position || members.indexOf(story) + 1}/${members.length}</span>` : "";
  return `<article class="story-card" data-story-id="${e(story.id)}" data-status="${story.status}" draggable="true" tabindex="0" role="button" aria-label="${e(story.title)}, ${statusLabels[story.status]}"><div class="card-top"><span class="card-time">${e(story.planned_time || "—")}</span><span class="status-pill" data-status="${story.status}">${statusLabels[story.status]}</span></div>${story.thumbnail_url ? `<img class="card-thumb" src="${e(story.thumbnail_url)}" alt="">` : ""}<div class="card-title">${e(story.title)}</div><div class="card-meta">${format ? `<span>${e(format)}</span>` : ""}${category ? `<span>${e(category)}</span>` : ""}</div><div class="card-footer"><span>${e(story.responsible_name || "Sem responsável")}</span>${sequence}</div></article>`;
}
function weekView(): string {
  const stories = visibleStories(); const hotels = selectedHotels();
  const gaps = hotels.reduce((count, hotel) => count + Array.from({ length: 7 }, (_, n) => !stories.some((s) => s.hotel_id === hotel.id && s.date === addDays(state.week, n) && s.status !== "cancelled") ? 1 : 0).filter(Boolean).length, 0);
  const alerts: string[] = [];
  if (gaps) alerts.push(`${gaps} lacuna${gaps === 1 ? "" : "s"} na semana`);
  const ideasToday = stories.filter((s) => s.date === today && s.status === "idea").length;
  if (ideasToday) alerts.push(`${ideasToday} ideia${ideasToday === 1 ? "" : "s"} para hoje`);
  const noOwner = stories.filter((s) => !s.responsible_user_id && s.status !== "cancelled").length;
  if (noOwner) alerts.push(`${noOwner} sem responsável`);
  const noMediaSoon = stories.filter((s) => !s.media_asset_id && s.date <= addDays(today, 1) && s.date >= today && ["ready", "scheduled"].includes(s.status)).length;
  if (noMediaSoon) alerts.push(`${noMediaSoon} pronto${noMediaSoon === 1 ? "" : "s"} sem mídia até amanhã`);
  const excess = hotels.flatMap((hotel) => Array.from({ length: 7 }, (_, n) => stories.filter((s) => s.hotel_id === hotel.id && s.date === addDays(state.week, n) && s.status !== "cancelled").length)).filter((count) => count >= 4 && count > Math.max(3, stories.length / Math.max(hotels.length * 7, 1) * 1.8)).length;
  if (excess) alerts.push(`${excess} dia${excess === 1 ? "" : "s"} com volume alto`);
  const dayNames = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
  const fullDays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const board = `<div class="board-scroll"><div class="week-grid"><div class="grid-head hotel-head">Perfil / Hotel</div>${fullDays.map((name, index) => { const date = addDays(state.week, index); return `<div class="grid-head ${date === today ? "today" : ""}"><span>${name}</span><strong>${date.slice(-2)}</strong></div>`; }).join("")}${hotels.map((hotel) => `<div class="hotel-cell"><span class="avatar">${e(hotel.short_name.slice(0, 2).toUpperCase())}</span><strong>${e(hotel.short_name)}</strong><small>${e(hotel.instagram_username)}</small></div>${dayNames.map((_, index) => { const date = addDays(state.week, index); const items = stories.filter((s) => s.hotel_id === hotel.id && s.date === date); return `<div class="day-cell ${date === today ? "today" : ""} ${items.length ? "" : "empty"}" data-hotel="${e(hotel.id)}" data-date="${date}">${items.map(card).join("")}<button class="cell-add" data-action="new-cell" data-hotel="${e(hotel.id)}" data-date="${date}" aria-label="Adicionar story para ${e(hotel.short_name)} em ${date}" title="Novo story">+</button></div>`; }).join("")}`).join("")}</div></div>`;
  const mobile = `<div class="mobile-days">${dayNames.map((name, index) => { const date = addDays(state.week, index); return `<button class="${date === state.day ? "active" : ""}" data-day="${date}">${name}<br><strong>${date.slice(-2)}</strong></button>`; }).join("")}</div><div class="mobile-board">${hotels.map((hotel) => { const items = stories.filter((s) => s.hotel_id === hotel.id && s.date === state.day); return `<section class="mobile-hotel"><h3>${e(hotel.short_name)} · ${e(hotel.instagram_username)}</h3>${items.length ? items.map(card).join("") : '<p class="subtle">Nenhum story planejado.</p>'}<button class="cell-add" data-action="new-cell" data-hotel="${e(hotel.id)}" data-date="${state.day}" aria-label="Adicionar story">+ Adicionar</button></section>`; }).join("")}</div>`;
  return `${weekHeading()}${filtersHtml()}${metricsHtml(stories)}${alerts.length ? `<div class="notice-bar">${icon("alert")} ${e(alerts.join(" · "))}</div>` : ""}${hotels.length ? `${board}${mobile}` : emptyState("Nenhum hotel corresponde ao filtro.")}`;
}
function calendarView(): string {
  const date = fromIso(state.day), year = date.getFullYear(), month = date.getMonth();
  const first = new Date(year, month, 1), offset = (first.getDay() + 6) % 7;
  const start = isoDate(new Date(year, month, 1 - offset));
  const stories = visibleStories();
  return `<div class="page-heading"><div><p class="eyebrow">Visão mensal</p><h1>Calendário</h1><p class="subtle">${e(dateLabel(isoDate(first), { month: "long", year: "numeric" }))}</p></div><div class="heading-actions"><button class="button" data-action="prev-month">${icon("left")}</button><button class="button" data-action="next-month">${icon("right")}</button><button class="button primary" data-action="new">${icon("plus")} Novo story</button></div></div>${filtersHtml()}<div class="calendar-grid">${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}${Array.from({ length: 42 }, (_, index) => { const current = addDays(start, index), items = stories.filter((s) => s.date === current); return `<div class="calendar-day ${fromIso(current).getMonth() !== month ? "outside" : ""}"><div class="calendar-date ${current === today ? "today" : ""}">${current.slice(-2)}</div>${items.slice(0, 4).map((story) => `<button class="calendar-story" data-story-id="${e(story.id)}" title="${e(story.title)}">${e(story.planned_time || "")} ${e(story.title)}</button>`).join("")}${items.length > 4 ? `<small>+${items.length - 4}</small>` : ""}</div>`; }).join("")}</div>`;
}
function pendingView(): string {
  const stories = visibleStories();
  const sections: [string, (story: Story) => boolean][] = [
    ["Stories atrasados", (s) => s.date < today && !["published", "cancelled"].includes(s.status)],
    ["Em produção", (s) => s.status === "producing"], ["Aguardando aprovação", (s) => s.status === "approval"],
    ["Sem mídia", (s) => !s.media_asset_id && !["cancelled", "published"].includes(s.status)],
    ["Sem responsável", (s) => !s.responsible_user_id && s.status !== "cancelled"],
    ["Programados para hoje", (s) => s.date === today && s.status === "scheduled"],
  ];
  return `<div class="page-heading"><div><p class="eyebrow">Acompanhamento</p><h1>Pendências</h1><p class="subtle">Itens dos últimos 30 dias e próximos 7 dias.</p></div><button class="button primary" data-action="new">${icon("plus")} Novo story</button></div>${filtersHtml()}${sections.map(([title, predicate]) => { const items = stories.filter(predicate); return `<section class="section-card"><h2>${title} <span class="subtle">${items.length}</span></h2><div class="pending-list">${items.length ? items.map((story) => `<button class="pending-row" data-story-id="${e(story.id)}"><strong>${e(story.title)}</strong><small>${e(state.hotels.find((h) => h.id === story.hotel_id)?.short_name)}</small><small>${e(story.date)}</small><span class="status-pill" data-status="${story.status}">${statusLabels[story.status]}</span></button>`).join("") : '<p class="subtle">Nenhum item nesta categoria.</p>'}</div></section>`; }).join("")}`;
}
function campaignsView(): string {
  return `<div class="page-heading"><div><p class="eyebrow">Conteúdo</p><h1>Campanhas</h1><p class="subtle">Agrupe Stories de diferentes hotéis em uma iniciativa.</p></div><button class="button primary" data-action="new-campaign">${icon("plus")} Nova campanha</button></div><div class="campaign-grid">${state.campaigns.map((campaign) => `<article class="campaign-card"><h2>${e(campaign.name)}</h2><p>${e(campaign.description || "Sem descrição")}</p><p>${e(campaign.start_date || "Sem início")} — ${e(campaign.end_date || "Sem fim")}</p><div class="campaign-stats"><span>${campaign.story_count} stories</span><span>${campaign.published_count} publicados</span><span>${campaign.hotel_count} hotéis</span></div><button type="button" class="button" data-action="edit-campaign" data-campaign-id="${e(campaign.id)}" style="margin-top:14px">Editar campanha</button></article>`).join("")}</div>${!state.campaigns.length ? '<div class="empty-state"><h2>Nenhuma campanha cadastrada.</h2><p>Crie uma campanha para organizar Stories de vários hotéis.</p><button class="button primary" data-action="new-campaign">Nova campanha</button></div>' : ""}`;
}
function openCampaignDialog(campaign?: Campaign) {
  const existing = document.querySelector<HTMLDialogElement>("#campaignDialog"); existing?.remove();
  const dialog = document.createElement("dialog"); dialog.id = "campaignDialog"; dialog.className = "campaign-dialog";
  dialog.innerHTML = `<form id="campaignForm"><header><h2>${campaign ? "Editar campanha" : "Nova campanha"}</h2><button type="button" class="icon-button" data-action="close-campaign" aria-label="Fechar">${icon("close")}</button></header><div class="form-grid">${field("name", "Nome", campaign?.name, "text", true)}${field("description", "Descrição", campaign?.description, "textarea", true)}${field("start_date", "Início", campaign?.start_date, "date")}${field("end_date", "Término", campaign?.end_date, "date")}${selectField("status", "Status", campaign?.status || "planned", [{ id: "planned", name: "Planejada" }, { id: "active", name: "Ativa" }, { id: "completed", name: "Concluída" }, { id: "cancelled", name: "Cancelada" }])}</div><footer><button type="button" class="button" data-action="close-campaign">Cancelar</button><button class="button primary" type="submit">Salvar campanha</button></footer></form>`;
  dialog.querySelector<HTMLInputElement>("[name=name]")!.required = true;
  dialog.dataset.campaignId = campaign?.id || ""; document.body.append(dialog); dialog.showModal(); dialog.querySelector<HTMLInputElement>("[name=name]")?.focus();
}
function assetsView(): string { return `<div class="page-heading"><div><p class="eyebrow">Conteúdo</p><h1>Banco de conteúdos</h1><p class="subtle">A biblioteca de mídia existente permite reutilizar fotos e vídeos.</p></div></div><div class="section-card"><h2>Biblioteca de mídia</h2><p class="subtle">Escolha arquivos na Central de Portais e associe o ID da mídia ao Story no painel de edição.</p><p><a class="button" href="/admin/portais/media/">Abrir biblioteca de mídia</a></p></div>`; }
function hotelsView(): string { return `<div class="page-heading"><div><p class="eyebrow">Administração</p><h1>Hotéis</h1><p class="subtle">Perfis incluídos no planejamento editorial.</p></div></div><div class="section-card"><div class="pending-list">${state.hotels.map((hotel) => `<div class="pending-row"><strong>${e(hotel.name)}</strong><small>${e(hotel.instagram_username)}</small><small>${hotel.active ? "Ativo" : "Inativo"}</small></div>`).join("")}</div></div>`; }
function categoriesView(): string { return `<div class="page-heading"><div><p class="eyebrow">Administração</p><h1>Categorias</h1><p class="subtle">Categorias disponíveis para classificar Stories.</p></div></div><div class="section-card"><div class="category-list">${state.categories.map((category) => `<span>${e(category.name)}</span>`).join("")}</div></div>`; }
function performanceView(): string { return `<div class="page-heading"><div><p class="eyebrow">Análise</p><h1>Desempenho</h1><p class="subtle">Esta área receberá métricas quando a integração de dados do Instagram estiver disponível.</p></div></div><div class="section-card"><h2>Análise em preparação</h2><p class="subtle">O planejamento e os estados de publicação já são registrados. Métricas de alcance e engajamento dependem de uma integração autorizada com o Instagram.</p></div>`; }
function emptyState(message: string): string { return `<div class="empty-state"><h2>${e(message)}</h2><p>Crie um Story para começar o planejamento.</p><button class="button primary" data-action="new">Novo story</button></div>`; }
function render() {
  renderNavigation();
  if (state.loading) { main.innerHTML = '<div class="loading-shell"><div class="skeleton title"></div><div class="skeleton toolbar"></div><div class="skeleton grid"></div></div>'; return; }
  main.innerHTML = ({ week: weekView, calendar: calendarView, pending: pendingView, campaigns: campaignsView, assets: assetsView, hotels: hotelsView, categories: categoriesView, performance: performanceView }[state.view])();
}

function openDrawer(story: Story | "new", date = today, hotel = "") {
  state.drawer = story; state.createDate = date; state.createHotel = hotel;
  renderDrawer(); drawer.hidden = false; backdrop.hidden = false;
  document.body.style.overflow = "hidden"; drawer.querySelector<HTMLInputElement>("input[name=title]")?.focus();
}
function closeDrawer() { state.drawer = null; drawer.hidden = true; backdrop.hidden = true; document.body.style.overflow = ""; }
function field(name: string, label: string, value: unknown, kind: "text" | "date" | "time" | "textarea" | "url" = "text", full = false): string {
  const escaped = e(value); const required = ["title", "hotel_id", "date"].includes(name) ? "required" : "";
  return `<label class="${full ? "full" : ""}"><span>${label}${required ? " *" : ""}</span>${kind === "textarea" ? `<textarea name="${name}">${escaped}</textarea>` : `<input name="${name}" type="${kind}" value="${escaped}" ${required}>`}</label>`;
}
function selectField(name: string, label: string, value: string | null, values: { id: string; name: string }[], required = false): string {
  return `<label><span>${label}${required ? " *" : ""}</span><select name="${name}" ${required ? "required" : ""}>${required ? option("", "Selecione", value || "") : option("", "Não definido", value || "")}${values.map((item) => option(item.id, item.name, value || "")).join("")}</select></label>`;
}
function renderDrawer() {
  const story = state.drawer === "new" ? null : state.drawer;
  if (!state.drawer) return;
  const formatOptions = Object.entries(formatLabels).map(([id, name]) => ({ id, name }));
  const objectiveOptions = Object.entries(objectiveLabels).map(([id, name]) => ({ id, name }));
  const statusOptions = Object.entries(statusLabels).map(([id, name]) => ({ id, name }));
  const priorityOptions = Object.entries(priorityLabels).map(([id, name]) => ({ id, name }));
  drawer.innerHTML = `<div class="drawer-header"><div><small>${story ? "Editar story" : "Novo story"}</small><h2 id="drawerTitle">${e(story?.title || "Planejar Story")}</h2></div><button class="icon-button" data-action="close-drawer" aria-label="Fechar">${icon("close")}</button></div><form id="storyForm"><div class="drawer-body"><section class="drawer-section"><h3>Planejamento</h3><div class="form-grid">${selectField("hotel_id", "Hotel", story?.hotel_id || state.createHotel, state.hotels, true)}${field("date", "Data", story?.date || state.createDate, "date")}${field("planned_time", "Horário planejado", story?.planned_time, "time")}${selectField("status", "Status", story?.status || "idea", statusOptions)}${selectField("priority", "Prioridade", story?.priority || "normal", priorityOptions)}</div></section><section class="drawer-section"><h3>Conteúdo</h3><div class="form-grid">${field("title", "Título interno", story?.title, "text", true)}${field("description", "Descrição / ideia", story?.description, "textarea", true)}${field("story_text", "Texto sugerido", story?.story_text, "textarea", true)}${selectField("category_id", "Categoria", story?.category_id || null, state.categories)}${selectField("content_pillar_id", "Pilar de conteúdo", story?.content_pillar_id || null, state.pillars)}${selectField("format", "Formato", story?.format || null, formatOptions)}${selectField("objective", "Objetivo", story?.objective || null, objectiveOptions)}${field("cta", "CTA", story?.cta)}${field("link", "Link", story?.link, "url", true)}</div></section><section class="drawer-section"><h3>Mídia</h3><div class="form-grid">${field("media_asset_id", "ID da mídia na biblioteca", story?.media_asset_id, "text", true)}</div><p class="drawer-hint">O arquivo é armazenado na biblioteca R2 existente e pode ser reutilizado em outros Stories.</p>${story?.thumbnail_url ? `<img src="${e(story.thumbnail_url)}" alt="Prévia da mídia" style="max-height:100px;border-radius:7px;margin-top:10px">` : ""}</section><section class="drawer-section"><h3>Responsável</h3><div class="form-grid">${selectField("responsible_user_id", "Pessoa responsável", story?.responsible_user_id || null, state.users)}</div></section><section class="drawer-section"><h3>Publicação</h3><div class="form-grid">${selectField("campaign_id", "Campanha", story?.campaign_id || null, state.campaigns)}${field("published_at", "Publicado em (ISO)", story?.published_at)}${field("published_url", "URL publicada", story?.published_url, "url", true)}</div></section><section class="drawer-section"><h3>Sequência</h3><div class="form-grid">${selectField("sequence_group_id", "Grupo", story?.sequence_group_id || null, state.sequences.map((sequence) => ({ id: sequence.id, name: sequence.title })))}${field("sequence_position", "Posição", story?.sequence_position)}</div><button type="button" class="button" data-action="new-sequence" style="margin-top:10px">Criar sequência</button></section><section class="drawer-section"><h3>Informações adicionais</h3><div class="form-grid">${field("notes", "Observações", story?.notes, "textarea", true)}</div></section><div id="deleteConfirm"></div></div><div class="drawer-actions">${story ? `<button type="button" class="button" data-action="duplicate">Duplicar</button><button type="button" class="button" data-action="mark-ready">Pronto</button><button type="button" class="button" data-action="mark-published">Publicado</button><button type="button" class="button danger" data-action="delete">Excluir</button>` : ""}<button type="submit" class="button primary">${state.saving ? "Salvando..." : "Salvar story"}</button></div></form>`;
  const mediaSection = drawer.querySelector<HTMLElement>(".drawer-section:nth-of-type(3)");
  mediaSection?.insertAdjacentHTML("beforeend", '<button type="button" class="button" data-action="choose-media" style="margin-top:10px">Escolher da biblioteca</button><div id="mediaChoices"></div>');
  if (story?.sequence_group_id) drawer.querySelector(".drawer-actions")?.insertAdjacentHTML("afterbegin", '<button type="button" class="button" data-action="duplicate-sequence">Duplicar sequência</button>');
  if (story) drawer.querySelector(".drawer-actions")?.insertAdjacentHTML("afterbegin", '<button type="button" class="button" data-action="move">Mover</button>');
}
function formInput(): StoryInput {
  const form = drawer.querySelector<HTMLFormElement>("#storyForm")!; const data = new FormData(form);
  const fields = ["hotel_id", "date", "planned_time", "title", "description", "story_text", "category_id", "content_pillar_id", "format", "objective", "status", "priority", "cta", "link", "responsible_user_id", "campaign_id", "media_asset_id", "sequence_group_id", "sequence_position", "notes", "published_at", "published_url"];
  const input: Record<string, unknown> = {}; for (const key of fields) input[key] = String(data.get(key) || "").trim() || null;
  input.sequence_position = input.sequence_position ? Number(input.sequence_position) : null;
  if (input.published_at) input.published_at = new Date(String(input.published_at)).toISOString();
  return input as StoryInput;
}
async function saveDrawer(event: SubmitEvent) {
  event.preventDefault(); if (state.saving) return;
  const form = event.target as HTMLFormElement; if (!form.reportValidity()) return;
  state.saving = true; const existing = state.drawer && state.drawer !== "new" ? state.drawer : null;
  try { const saved = existing ? await repository.update(existing.id, formInput()) : await repository.create(formInput());
    state.stories = existing ? state.stories.map((story) => story.id === saved.id ? saved : story) : [...state.stories, saved];
    if (existing?.campaign_id || saved.campaign_id) { try { state.campaigns = await repository.campaigns(); } catch { /* refresh on next visit */ } }
    closeDrawer(); render(); notify(existing ? "Story atualizado." : "Story criado.");
  } catch (error) { notify((error as Error).message, true); }
  finally { state.saving = false; }
}
async function patchStory(story: Story, patch: StoryInput, success: string) {
  const previous = state.stories.map((item) => ({ ...item }));
  state.stories = state.stories.map((item) => item.id === story.id ? { ...item, ...patch } : item);
  render();
  try { const saved = await repository.update(story.id, patch); state.stories = state.stories.map((item) => item.id === saved.id ? saved : item); if (story.campaign_id || saved.campaign_id) { try { state.campaigns = await repository.campaigns(); } catch { /* refresh on next visit */ } } render(); notify(success); if (state.drawer && state.drawer !== "new" && state.drawer.id === story.id) { state.drawer = saved; renderDrawer(); } }
  catch (error) { state.stories = previous; render(); notify(`Alteração revertida: ${(error as Error).message}`, true); }
}
async function handleDrop(target: HTMLElement, sourceId: string, overId: string | null, before: boolean) {
  const story = state.stories.find((item) => item.id === sourceId); if (!story) return;
  const hotel_id = target.dataset.hotel!, date = target.dataset.date!;
  const ordered = visibleStories().filter((item) => item.hotel_id === hotel_id && item.date === date && item.id !== sourceId);
  let index = overId ? ordered.findIndex((item) => item.id === overId) : ordered.length;
  if (index < 0) index = ordered.length;
  if (overId && !before) index += 1;
  const previous = ordered[index - 1]?.sort_order;
  const next = ordered[index]?.sort_order;
  const sort_order = previous != null && next != null ? (previous + next) / 2 : previous != null ? previous + 100 : next != null ? next - 100 : 1000;
  if (story.sequence_group_id && window.confirm("Mover toda a sequência para este dia e hotel? Clique em Cancelar para mover apenas este Story.")) {
    const previous = state.stories.map((item) => ({ ...item }));
    state.stories = state.stories.map((item) => item.sequence_group_id === story.sequence_group_id ? { ...item, hotel_id, date } : item); render();
    try { await repository.moveSequence(story.sequence_group_id, hotel_id, date); notify("Sequência movida."); }
    catch (error) { state.stories = previous; render(); notify((error as Error).message, true); }
  } else await patchStory(story, { hotel_id, date, sort_order }, "Story movido.");
}
function planningAlerts(): number { return visibleStories().filter((s) => s.date === today && s.status === "idea").length; }

document.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  const nav = target.closest<HTMLAnchorElement>("[data-view]"); if (nav) { event.preventDefault(); route(nav.dataset.view as View); return; }
  const day = target.closest<HTMLButtonElement>("[data-day]"); if (day) { state.day = day.dataset.day!; render(); return; }
  const storyElement = target.closest<HTMLElement>("[data-story-id]"); if (storyElement && !target.closest("[data-action]")) { const story = state.stories.find((item) => item.id === storyElement.dataset.storyId); if (story) openDrawer(story); return; }
  const button = target.closest<HTMLElement>("[data-action]"); if (!button) return;
  const action = button.dataset.action;
  if (action === "close-drawer") closeDrawer();
  if (action === "new") openDrawer("new", state.view === "week" && (today < state.week || today > addDays(state.week, 6)) ? state.week : today);
  if (action === "new-cell") openDrawer("new", button.dataset.date!, button.dataset.hotel!);
  if (action === "prev-week" || action === "next-week" || action === "today") { state.week = action === "today" ? weekStart(today) : addDays(state.week, action === "prev-week" ? -7 : 7); state.day = state.week; updateUrl(); void loadStories(); }
  if (action === "prev-month" || action === "next-month") { const d = fromIso(state.day); d.setDate(1); d.setMonth(d.getMonth() + (action === "prev-month" ? -1 : 1)); state.day = isoDate(d); state.week = weekStart(state.day); updateUrl(); void loadStories(); }
  const current = state.drawer && state.drawer !== "new" ? state.drawer : null;
  if (current && action === "mark-ready") await patchStory(current, { status: "ready" }, "Marcado como pronto.");
  if (current && action === "mark-published") await patchStory(current, { status: "published", published_at: new Date().toISOString() }, "Marcado como publicado.");
  if (current && action === "duplicate") { const copy = { ...current, title: `${current.title} (cópia)`, status: "idea" as const, published_at: null, published_url: null, sequence_group_id: null, sequence_position: null }; try { const created = await repository.create(copy); state.stories.push(created); render(); notify("Story duplicado."); openDrawer(created); } catch (error) { notify((error as Error).message, true); } }
  if (current && action === "duplicate-sequence" && current.sequence_group_id) { try { const result = await repository.duplicateSequence(current.sequence_group_id); state.sequences.push(result.sequence); state.stories.push(...result.stories); render(); notify("Sequência duplicada."); closeDrawer(); } catch (error) { notify((error as Error).message, true); } }
  if (current && action === "move") { drawer.querySelector<HTMLInputElement>("[name=date]")?.focus(); drawer.scrollTo({ top: 0, behavior: "smooth" }); }
  if (action === "choose-media") {
    const hotelId = drawer.querySelector<HTMLSelectElement>("[name=hotel_id]")?.value;
    const choices = drawer.querySelector<HTMLElement>("#mediaChoices")!;
    if (!hotelId) { notify("Selecione um hotel primeiro.", true); return; }
    choices.innerHTML = '<p class="drawer-hint">Carregando mídia...</p>';
    try {
      const response = await fetch(`/api/v1/admin/media?hotel_id=${encodeURIComponent(hotelId)}&limit=24`, { credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Biblioteca indisponível para este hotel.");
      const assets = payload.data.assets as { id: string; public_url: string; alt_text: string | null; original_filename: string | null; mime_type: string }[];
      choices.innerHTML = assets.length ? `<div class="media-choices">${assets.map((asset) => `<button type="button" class="media-choice" data-action="select-media" data-media-id="${e(asset.id)}">${asset.mime_type.startsWith("image/") ? `<img src="${e(asset.public_url)}" alt="">` : icon("image")}<span>${e(asset.alt_text || asset.original_filename || asset.id)}</span></button>`).join("")}</div>` : '<p class="drawer-hint">Nenhum arquivo disponível para este hotel.</p>';
    } catch (error) { choices.innerHTML = `<p class="drawer-hint">${e((error as Error).message)}</p>`; }
  }
  if (action === "select-media") { const input = drawer.querySelector<HTMLInputElement>("[name=media_asset_id]"); if (input) input.value = button.dataset.mediaId || ""; drawer.querySelector<HTMLElement>("#mediaChoices")!.innerHTML = ""; notify("Mídia selecionada."); }
  if (current && action === "delete") { document.querySelector<HTMLElement>("#deleteConfirm")!.innerHTML = `<div class="dialog-inline">Excluir “${e(current.title)}” permanentemente?<br><button type="button" class="button danger" data-action="confirm-delete">Confirmar exclusão</button><button type="button" class="button" data-action="cancel-delete">Cancelar</button></div>`; }
  if (action === "cancel-delete") document.querySelector<HTMLElement>("#deleteConfirm")!.innerHTML = "";
  if (current && action === "confirm-delete") { try { await repository.remove(current.id); state.stories = state.stories.filter((item) => item.id !== current.id); if (current.campaign_id) { try { state.campaigns = await repository.campaigns(); } catch { /* refresh on next visit */ } } closeDrawer(); render(); notify("Story excluído."); } catch (error) { notify((error as Error).message, true); } }
  if (action === "new-sequence") { const title = window.prompt("Nome da sequência"); if (title?.trim()) { try { const sequence = await repository.createSequence(title.trim()); state.sequences.push(sequence); const select = drawer.querySelector<HTMLSelectElement>("[name=sequence_group_id]"); if (select) { select.insertAdjacentHTML("beforeend", option(sequence.id, sequence.title)); select.value = sequence.id; } notify("Sequência criada."); } catch (error) { notify((error as Error).message, true); } } }
  if (action === "new-campaign") openCampaignDialog();
  if (action === "edit-campaign") openCampaignDialog(state.campaigns.find((campaign) => campaign.id === button.dataset.campaignId));
  if (action === "close-campaign") document.querySelector<HTMLDialogElement>("#campaignDialog")?.close();
});
document.addEventListener("change", (event) => { const target = event.target as HTMLInputElement | HTMLSelectElement; if (!target.dataset.filter || target.dataset.filter === "search") return; (state.filters as unknown as Record<string, string>)[target.dataset.filter] = target.value; updateUrl(); void loadStories(); });
document.addEventListener("input", (event) => { const target = event.target as HTMLInputElement; if (target.dataset.filter !== "search") return; state.filters.search = target.value; updateUrl(); const active = document.activeElement as HTMLInputElement; const cursor = active.selectionStart; render(); const replacement = main.querySelector<HTMLInputElement>("[data-filter=search]"); replacement?.focus(); if (cursor !== null) replacement?.setSelectionRange(cursor, cursor); });
drawer.addEventListener("submit", (event) => { if ((event.target as HTMLElement).id === "storyForm") void saveDrawer(event); });
document.addEventListener("submit", async (event) => {
  if ((event.target as HTMLElement).id !== "campaignForm") return;
  event.preventDefault();
  const dialog = document.querySelector<HTMLDialogElement>("#campaignDialog")!;
  const data = new FormData(event.target as HTMLFormElement);
  const input = { name: String(data.get("name") || ""), description: String(data.get("description") || ""), start_date: String(data.get("start_date") || ""), end_date: String(data.get("end_date") || ""), status: String(data.get("status") || "planned") };
  try { dialog.dataset.campaignId ? await repository.updateCampaign(dialog.dataset.campaignId, input) : await repository.createCampaign(input);
    state.campaigns = await repository.campaigns();
    dialog.close(); dialog.remove(); render(); notify("Campanha salva.");
  } catch (error) { notify((error as Error).message, true); }
});
backdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && state.drawer) closeDrawer(); if ((event.key === "Enter" || event.key === " ") && (event.target as HTMLElement).matches(".story-card")) { event.preventDefault(); const story = state.stories.find((item) => item.id === (event.target as HTMLElement).dataset.storyId); if (story) openDrawer(story); } });
document.addEventListener("dragstart", (event) => { const card = (event.target as HTMLElement).closest<HTMLElement>(".story-card"); if (!card) return; event.dataTransfer?.setData("text/plain", card.dataset.storyId || ""); event.dataTransfer!.effectAllowed = "move"; card.classList.add("dragging"); });
document.addEventListener("dragend", (event) => { (event.target as HTMLElement).closest<HTMLElement>(".story-card")?.classList.remove("dragging"); document.querySelectorAll(".drag-over").forEach((item) => item.classList.remove("drag-over")); });
document.addEventListener("dragover", (event) => { const cell = (event.target as HTMLElement).closest<HTMLElement>(".day-cell"); if (!cell) return; event.preventDefault(); cell.classList.add("drag-over"); });
document.addEventListener("dragleave", (event) => { const cell = (event.target as HTMLElement).closest<HTMLElement>(".day-cell"); if (cell && !cell.contains(event.relatedTarget as Node)) cell.classList.remove("drag-over"); });
document.addEventListener("drop", (event) => { const element = event.target as HTMLElement; const cell = element.closest<HTMLElement>(".day-cell"); if (!cell) return; event.preventDefault(); cell.classList.remove("drag-over"); const id = event.dataTransfer?.getData("text/plain"); const over = element.closest<HTMLElement>(".story-card"); const before = over ? event.clientY < over.getBoundingClientRect().top + over.getBoundingClientRect().height / 2 : false; if (id) void handleDrop(cell, id, over?.dataset.storyId || null, before); });
document.querySelector<HTMLElement>("#collapseSidebar")!.addEventListener("click", () => document.querySelector("#sidebar")!.classList.toggle("collapsed"));
document.querySelector<HTMLElement>("#openSidebar")!.addEventListener("click", () => document.querySelector("#sidebar")!.classList.toggle("mobile-open"));

async function start() {
  try {
    const response = await fetch("/api/v1/admin/session", { credentials: "same-origin" });
    if (response.status === 401) { location.href = "/admin/"; return; }
    const payload = await response.json();
    if (!payload.ok || !payload.data.permissions.includes("social-planner.read")) throw new Error("Acesso ao Social Planner não liberado para este usuário.");
    document.querySelector<HTMLElement>("#currentUser")!.textContent = payload.data.user?.display_name || "Marketing";
    [state.hotels, state.categories, state.pillars, state.users, state.campaigns, state.sequences] = await Promise.all([repository.hotels(), repository.categories(), repository.pillars(), repository.users(), repository.campaigns(), repository.sequences()]);
    await loadStories();
    if (planningAlerts()) notify(`${planningAlerts()} Story(s) de hoje ainda estão como Ideia.`);
  } catch (error) { state.loading = false; main.innerHTML = `<div class="empty-state"><h2>Não foi possível abrir o planner</h2><p>${e((error as Error).message)}</p><a class="button" href="/admin/">Voltar à Central</a></div>`; }
}
void start();
