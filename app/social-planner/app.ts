import { apiStoryRepository as repository, request as plannerRequest } from "./repository";
import { marketingRepository } from "./marketing-repository";
import { blogDrawer, blogFormInput, blogView, type BlogContext } from "./blog";
import { visitsView, visitDrawer, visitFormInput, type VisitContext } from "./visits";
import { overviewView } from "./overview";
import { asanaCalendarView } from "./asana";
import type { AsanaSetup, AsanaTask, AsanaTaskDetail, AsanaTaskInput, BlogPost, CalendarConnectionStatus, Campaign, Category, ContentPillar, Hotel, SocialChannel, Story, StoryChannelInput, StoryFilters, StoryInput, StorySequence, User, Visit } from "./types";
import { addDays, dateLabel, escapeHtml as e, formatLabels, fromIso, isoDate, objectiveLabels, option, priorityLabels, statusLabels, weekStart } from "./utils";

type View = "overview" | "week" | "calendar" | "pending" | "asana-calendar" | "visits-week" | "visits-calendar" | "visits-history" | "blog-schedule" | "blog-ideas" | "blog-published" | "campaigns" | "assets" | "hotels" | "categories" | "performance" | "users" | "settings";
type PlannerSession = { user: { id: string; display_name: string; email: string }; permissions: string[]; access_level: "viewer" | "editor" | "admin"; auth_source: "social-planner" | "admin-master"; expires_at: string };
type ManagedPlannerUser = { id: string; display_name: string; email: string; access_level: "viewer" | "editor" | "admin"; status: "active" | "disabled"; inherited_from_central: number };
const views: Record<View, string> = { overview: "Visão Geral", week: "Redes · Semana", calendar: "Redes · Calendário", pending: "Redes · Pendências", "asana-calendar": "Calendário do Asana", "visits-week": "Visitas · Semana", "visits-calendar": "Visitas · Calendário", "visits-history": "Visitas · Histórico", "blog-schedule": "Artigos", "blog-ideas": "Artigos", "blog-published": "Artigos", campaigns: "Campanhas", assets: "Banco de conteúdos", hotels: "Hotéis", categories: "Categorias", performance: "Desempenho", users: "Usuários", settings: "Configurações" };
const today = isoDate(new Date());
const CAMPAIGN_TIMELINE_DAYS = 35;
const params = new URLSearchParams(location.search);
const initialWeek = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") || "") ? params.get("week")! : today;
const state = {
  view: (location.pathname.split("/").filter(Boolean).at(-1) || "week") as View,
  week: weekStart(initialWeek), day: /^\d{4}-\d{2}-\d{2}$/.test(params.get("day") || "") ? params.get("day")! : today,
  filters: { hotel_id: params.get("hotel") || "all", status: params.get("status") || "all", category_id: params.get("category") || "all", responsible_user_id: params.get("responsible") || "all", campaign_id: params.get("campaign") || "all", search: params.get("q") || "" } as StoryFilters,
  platformFilter: params.get("platform") || "all",
  campaignStart: /^\d{4}-\d{2}-\d{2}$/.test(params.get("campaign_start") || "") ? weekStart(params.get("campaign_start")!) : weekStart(today),
  hotels: [] as Hotel[], categories: [] as Category[], pillars: [] as ContentPillar[], channels: [] as SocialChannel[], users: [] as User[], campaigns: [] as Campaign[], sequences: [] as StorySequence[], stories: [] as Story[], visits: [] as Visit[], posts: [] as BlogPost[],
  displayName: "Fioreze Marketing Planner", visitFilter: params.get("visit_hotel") || "all", blogFilters: { hotel_id: params.get("blog_hotel") || "all", author_user_id: params.get("blog_author") || "all", document: params.get("blog_document") || "all" } as Record<string, string>, blogMode: "list" as "list" | "calendar",
  calendar: { provider: "google", configured: false, connected: false, connection: null } as CalendarConnectionStatus,
  asanaSetup: null as AsanaSetup | null, asanaTasks: [] as AsanaTask[], asanaTaskDrawer: null as AsanaTaskDetail | null, asanaHotelFilter: params.get("asana_hotel") || "all",
  session: null as PlannerSession | null, managedUsers: [] as ManagedPlannerUser[],
  loading: true, drawer: null as Story | "new" | null, visitDrawer: null as Visit | "new" | null, postDrawer: null as BlogPost | "new" | null, createDate: today, createHotel: "", saving: false,
};
if (!Object.hasOwn(views, state.view)) state.view = "overview";
if (["blog-schedule", "blog-published"].includes(state.view)) state.view = "blog-ideas";
if (!params.get("day") && (state.day < state.week || state.day > addDays(state.week, 6))) state.day = state.week;
if (state.view === "visits-history" && !params.get("day")) state.day = today;
const main = document.querySelector<HTMLElement>("#mainContent")!;
const drawer = document.querySelector<HTMLElement>("#storyDrawer")!;
const backdrop = document.querySelector<HTMLElement>("#drawerBackdrop")!;
const toast = document.querySelector<HTMLElement>("#toast")!;
let toastTimer = 0;
let loadVersion = 0;

function icon(name: string): string {
  const names: Record<string, string> = {
    calendar: "calendar-days", grid: "layout-dashboard", check: "check", image: "image",
    flag: "pin", settings: "settings", hotel: "store", users: "users",
    tag: "bookmark", plus: "plus", left: "chevron-left", right: "chevron-right",
    alert: "triangle-alert", close: "x", asana: "calendar-days", file: "file-text",
  };
  return `<i data-lucide="${names[name] || "layout-dashboard"}" aria-hidden="true"></i>`;
}
function hydrateIcons(root: ParentNode = document) {
  const lucide = (globalThis as typeof globalThis & { FiorezeLucide?: { createIcons(input: unknown): void; icons: unknown } }).FiorezeLucide;
  window.setTimeout(() => lucide?.createIcons({ icons: lucide.icons, root }), 0);
}
function notify(message: string, error = false) {
  toast.textContent = message; toast.classList.toggle("error", error); toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4000);
}
function route(view: View) {
  if (view === "visits-history" && state.view !== view) state.day = today;
  state.view = view; document.querySelector("#sidebar")?.classList.remove("mobile-open"); updateUrl();
  if (view === "asana-calendar") void loadAsanaData();
  else if (["week", "calendar", "pending", "overview", "visits-week", "visits-calendar", "visits-history", "blog-schedule", "blog-ideas", "blog-published"].includes(view)) void loadData();
  else if (view === "users") void loadManagedUsers();
  else render();
}
function updateUrl() {
  const query = new URLSearchParams(); query.set("week", state.week); query.set("day", state.day);
  for (const [key, urlKey] of [["hotel_id", "hotel"], ["status", "status"], ["category_id", "category"], ["responsible_user_id", "responsible"], ["campaign_id", "campaign"], ["search", "q"]] as const) {
    const value = state.filters[key]; if (value && value !== "all") query.set(urlKey, value);
  }
  if (state.platformFilter !== "all") query.set("platform", state.platformFilter);
  if (state.campaignStart !== weekStart(today)) query.set("campaign_start", state.campaignStart);
  if (state.visitFilter !== "all") query.set("visit_hotel", state.visitFilter);
  if (state.asanaHotelFilter !== "all") query.set("asana_hotel", state.asanaHotelFilter);
  for (const [key, urlKey] of [["hotel_id", "blog_hotel"], ["author_user_id", "blog_author"], ["document", "blog_document"]] as const) { if (state.blogFilters[key] && state.blogFilters[key] !== "all") query.set(urlKey, state.blogFilters[key]); }
  history.replaceState({}, "", `/socialplanner/${state.view}?${query}`);
}
function renderNavigation() {
  const groups = [
    ["Trabalho", [["overview", "Visão geral", "grid"]]],
    ["Planejamento", [["week", "Cronograma", "calendar"], ["calendar", "Calendário", "calendar"], ["pending", "Pendências", "alert"], ["asana-calendar", "Calendário do Asana", "asana"]]],
    ["Produção", [["visits-week", "Visitas", "hotel"], ["visits-calendar", "Agenda de visitas", "calendar"], ["visits-history", "Histórico", "check"], ["blog-ideas", "Artigos", "file"]]],
    ["Conteúdo", [["assets", "Banco de conteúdos", "image"], ["campaigns", "Campanhas", "flag"], ["performance", "Desempenho", "grid"]]],
    ["Administração", [["hotels", "Hotéis", "hotel"], ["categories", "Categorias", "tag"], ["users", "Usuários", "users"], ["settings", "Configurações", "settings"]]],
  ] as const;
  const visibleGroups = groups.map(([title, items]) => [title, items.filter(([key]) => key !== "users" || state.session?.permissions.includes("social-planner.users.manage"))] as const);
  document.querySelector<HTMLElement>("#navigation")!.innerHTML = visibleGroups.map(([title, items]) => `<div class="nav-group">${title ? `<span class="nav-heading">${title}</span>` : ""}${items.map(([key, label, symbol]) => `<a class="nav-link ${state.view === key ? "active" : ""}" href="/socialplanner/${key}" data-view="${key}" title="${label}">${icon(symbol)}<span class="nav-label">${label}</span></a>`).join("")}</div>`).join("");
  hydrateIcons(document.querySelector<HTMLElement>("#navigation")!);
}
function dateRange(): [string, string] {
  if (["calendar", "visits-calendar", "blog-schedule"].includes(state.view)) { const date = fromIso(state.day); return [isoDate(new Date(date.getFullYear(), date.getMonth(), 1)), isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))]; }
  if (state.view === "pending") return [addDays(today, -30), addDays(today, 7)];
  if (state.view === "visits-history") return [addDays(state.day, -89), state.day];
  if (state.view === "overview") return [state.week, addDays(state.week, 13)];
  return [state.week, addDays(state.week, 6)];
}
async function loadData() {
  const version = ++loadVersion; state.loading = true; render();
  try {
    const [start, end] = dateRange();
    const needsStories = ["week", "calendar", "pending", "overview"].includes(state.view);
    const needsVisits = ["visits-week", "visits-calendar", "visits-history", "overview", "week", "calendar", "pending"].includes(state.view);
    const needsPosts = state.view.startsWith("blog-") || state.view === "overview";
    const [stories, visits, posts] = await Promise.all([
      needsStories ? repository.stories(start, end, state.filters) : Promise.resolve(state.stories),
      needsVisits ? marketingRepository.visits(start, end) : Promise.resolve(state.visits),
      needsPosts ? marketingRepository.posts(state.view === "blog-schedule" ? start : undefined, state.view === "blog-schedule" ? end : undefined) : Promise.resolve(state.posts),
    ]);
    if (version === loadVersion) { state.stories = stories; state.visits = visits; state.posts = posts; }
  }
  catch (error) { notify((error as Error).message, true); }
  finally { if (version === loadVersion) { state.loading = false; render(); } }
}
async function loadManagedUsers() {
  state.loading = true; render();
  try {
    const result = await plannerRequest<{ users: ManagedPlannerUser[] }>("/user-management");
    state.managedUsers = result.users;
  } catch (error) { notify((error as Error).message, true); }
  finally { state.loading = false; render(); }
}

async function loadAsanaData() {
  const version = ++loadVersion; state.loading = true; render();
  try {
    const focus = fromIso(state.day);
    const start = isoDate(new Date(focus.getFullYear(), focus.getMonth(), 1));
    const end = isoDate(new Date(focus.getFullYear(), focus.getMonth() + 1, 0));
    const setup = await marketingRepository.asanaSetup();
    if (version === loadVersion) state.asanaSetup = setup;
    let tasks: AsanaTask[] = [];
    if (setup.connected) {
      try { tasks = await marketingRepository.asanaTasks(start, end, state.asanaHotelFilter); }
      catch (error) { notify((error as Error).message, true); }
    }
    if (version === loadVersion) state.asanaTasks = tasks;
  } catch (error) { notify((error as Error).message, true); }
  finally { if (version === loadVersion) { state.loading = false; render(); } }
}
const platformOptions = [
  { id: "all", label: "Todas", short: "ALL" },
  { id: "instagram", label: "Instagram", short: "IG" },
  { id: "tiktok", label: "TikTok", short: "TT" },
  { id: "youtube", label: "YouTube", short: "YT" },
  { id: "facebook", label: "Facebook", short: "FB" },
] as const;
function storyPlatforms(story: Story): string[] {
  const fromChannels = (story.channels || []).map((channel) => channel.platform_key);
  const raw = `${story.channel_ids || ""},${story.channel_names || ""}`.toLocaleLowerCase("pt-BR");
  return [...new Set([...fromChannels, ...platformOptions.filter((item) => item.id !== "all" && raw.includes(item.id)).map((item) => item.id)])];
}
function visibleStories(): Story[] {
  const needle = state.filters.search.trim().toLocaleLowerCase("pt-BR");
  return state.stories.filter((story) => (state.platformFilter === "all" || storyPlatforms(story).includes(state.platformFilter)) && (!needle || [story.title, story.description, story.story_text, story.responsible_name].some((item) => item?.toLocaleLowerCase("pt-BR").includes(needle))))
    .sort((a, b) => a.date.localeCompare(b.date) || a.hotel_id.localeCompare(b.hotel_id) || a.sort_order - b.sort_order || (a.planned_time || "").localeCompare(b.planned_time || ""));
}
function platformSelector(): string {
  return `<div class="platform-selector" role="group" aria-label="Filtrar cronograma por rede">${platformOptions.map((platform) => {
    const count = platform.id === "all" ? state.stories.length : state.stories.filter((story) => storyPlatforms(story).includes(platform.id)).length;
    return `<button type="button" class="platform-option ${state.platformFilter === platform.id ? "active" : ""}" data-platform="${platform.id}" aria-pressed="${state.platformFilter === platform.id}"><span class="platform-mark ${platform.id}">${platform.short}</span><span>${platform.label}</span><strong>${count}</strong></button>`;
  }).join("")}</div>`;
}
function selectedHotels(): Hotel[] { return state.hotels.filter((hotel) => state.filters.hotel_id === "all" || state.filters.hotel_id === hotel.id); }
function filtersHtml(): string {
  const f = state.filters;
  const select = (key: keyof StoryFilters, label: string, values: { id: string; name: string }[]) => `<select data-filter="${key}" aria-label="${label}">${option("all", label, f[key])}${values.map((item) => option(item.id, item.name, f[key])).join("")}</select>`;
  return `<div class="filter-panel">${select("hotel_id", "Todos os hotéis", state.hotels)}${select("status", "Todos os status", Object.entries(statusLabels).map(([id, name]) => ({ id, name })))}${select("category_id", "Todas as categorias", state.categories)}${select("responsible_user_id", "Todos os responsáveis", state.users)}${select("campaign_id", "Todas as campanhas", state.campaigns)}<input type="search" data-filter="search" value="${e(f.search)}" placeholder="Pesquisar conteúdos" aria-label="Pesquisar conteúdos"></div>`;
}
function metricsHtml(stories: Story[]): string {
  const counts = [
    ["Conteúdos planejados", stories.filter((s) => s.status !== "cancelled").length, ""],
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
  return `<div class="page-heading"><div><p class="eyebrow">Social Planner</p><h1>Cronograma de redes</h1><p class="subtle">Planeje, distribua e acompanhe os conteúdos de todas as unidades.</p></div><div class="heading-actions"><div class="week-nav"><button class="icon-button" data-action="prev-week" aria-label="Semana anterior">${icon("left")}</button><span class="week-label">${e(label)}</span><button class="icon-button" data-action="next-week" aria-label="Próxima semana">${icon("right")}</button></div><button class="button" data-action="today">Hoje</button></div></div>`;
}
function card(story: Story): string {
  const category = state.categories.find((item) => item.id === story.category_id)?.name;
  const format = story.format ? formatLabels[story.format] : "";
  const members = story.sequence_group_id ? state.stories.filter((item) => item.sequence_group_id === story.sequence_group_id) : [];
  const sequence = story.sequence_group_id ? `<span class="sequence-badge">${story.sequence_position || members.indexOf(story) + 1}/${members.length}</span>` : "";
  const platforms = storyPlatforms(story).slice(0, 4);
  return `<article class="story-card" data-story-id="${e(story.id)}" data-status="${story.status}" draggable="true" tabindex="0" role="button" aria-label="${e(story.title)}, ${statusLabels[story.status]}"><div class="card-top"><span class="card-time">${e(story.planned_time || "—")}</span><span class="platform-miniatures">${platforms.map((platform) => `<span class="platform-mini ${platform}">${platformOptions.find((item) => item.id === platform)?.short || platform.slice(0, 2).toUpperCase()}</span>`).join("")}</span></div>${story.thumbnail_url ? `<img class="card-thumb" src="${e(story.thumbnail_url)}" alt="">` : ""}<div class="card-title">${e(story.title)}</div><div class="card-meta">${format ? `<span>${e(format)}</span>` : ""}${category ? `<span>${e(category)}</span>` : ""}</div><div class="card-footer"><span class="status-pill" data-status="${story.status}">${statusLabels[story.status]}</span><span>${e(story.responsible_name || "Sem responsável")}</span>${sequence}</div></article>`;
}
function upcomingRail(): string {
  const upcoming = state.stories.filter((story) => story.date >= today && story.status !== "cancelled")
    .sort((a, b) => a.date.localeCompare(b.date) || (a.planned_time || "").localeCompare(b.planned_time || "")).slice(0, 6);
  const visit = state.visits.filter((item) => item.date >= today && !["cancelled", "completed"].includes(item.status))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || "").localeCompare(b.start_time || ""))[0];
  return `<aside class="upcoming-rail" aria-label="Próximos compromissos"><div class="rail-header"><h2>Próximos</h2><button type="button" data-view="calendar">Ver todos</button></div><div class="rail-date">A partir de hoje</div><div class="rail-items">${upcoming.length ? upcoming.map((story) => {
    const hotel = state.hotels.find((item) => item.id === story.hotel_id)?.short_name || "Fioreze";
    const platform = storyPlatforms(story)[0] || "all";
    return `<button type="button" class="rail-item" data-story-id="${e(story.id)}"><span class="rail-time">${e(story.date === today ? story.planned_time || "Hoje" : dateLabel(story.date, { day: "2-digit", month: "short" }))}</span><span class="platform-mini ${platform}">${platformOptions.find((item) => item.id === platform)?.short || "--"}</span><span><strong>${e(story.title)}</strong><small>${e(hotel)}</small></span><span class="status-pill" data-status="${story.status}">${statusLabels[story.status]}</span></button>`;
  }).join("") : '<p class="rail-empty">Nenhum conteúdo futuro neste período.</p>'}</div>${visit ? `<div class="rail-visit"><div class="rail-header"><h2>Visita agendada</h2><button type="button" data-view="visits-calendar">Ver agenda</button></div><button type="button" class="visit-preview" data-visit-id="${e(visit.id)}"><span class="visit-date"><strong>${visit.date.slice(-2)}</strong>${e(dateLabel(visit.date, { month: "short" }))}</span><span><strong>${e(visit.title)}</strong><small>${e(visit.start_time || "Horário livre")} · ${e(visit.hotel_name)}</small></span></button></div>` : ""}</aside>`;
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
  const content = `${filtersHtml()}${metricsHtml(stories)}${alerts.length ? `<div class="notice-bar">${icon("alert")} ${e(alerts.join(" · "))}</div>` : ""}${hotels.length ? `${board}${mobile}` : emptyState("Nenhum hotel corresponde ao filtro.")}`;
  return `${weekHeading()}${platformSelector()}<div class="schedule-layout"><div class="schedule-main">${content}</div>${upcomingRail()}</div>`;
}
function calendarView(): string {
  const date = fromIso(state.day), year = date.getFullYear(), month = date.getMonth();
  const first = new Date(year, month, 1), offset = (first.getDay() + 6) % 7;
  const start = isoDate(new Date(year, month, 1 - offset));
  const stories = visibleStories();
  return `<div class="page-heading"><div><p class="eyebrow">Planejamento editorial</p><h1>Calendário</h1><p class="subtle">${e(dateLabel(isoDate(first), { month: "long", year: "numeric" }))}</p></div><div class="heading-actions"><button class="button" data-action="prev-month">${icon("left")}</button><button class="button" data-action="next-month">${icon("right")}</button><button class="button primary" data-action="new">${icon("plus")} Novo conteúdo</button></div></div>${platformSelector()}${filtersHtml()}<div class="calendar-grid">${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}${Array.from({ length: 42 }, (_, index) => { const current = addDays(start, index), items = stories.filter((s) => s.date === current); return `<div class="calendar-day ${fromIso(current).getMonth() !== month ? "outside" : ""}"><div class="calendar-date ${current === today ? "today" : ""}">${current.slice(-2)}</div>${items.slice(0, 4).map((story) => `<button class="calendar-story" data-story-id="${e(story.id)}" title="${e(story.title)}">${e(story.planned_time || "")} ${e(story.title)}</button>`).join("")}${items.length > 4 ? `<small>+${items.length - 4}</small>` : ""}</div>`; }).join("")}</div>`;
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
  return `<div class="page-heading"><div><p class="eyebrow">Meu trabalho</p><h1>Pendências</h1><p class="subtle">Itens dos últimos 30 dias e próximos 7 dias.</p></div><button class="button primary" data-action="new">${icon("plus")} Novo conteúdo</button></div>${platformSelector()}${filtersHtml()}${sections.map(([title, predicate]) => { const items = stories.filter(predicate); return `<section class="section-card"><h2>${title} <span class="subtle">${items.length}</span></h2><div class="pending-list">${items.length ? items.map((story) => `<button class="pending-row" data-story-id="${e(story.id)}"><strong>${e(story.title)}</strong><small>${e(state.hotels.find((h) => h.id === story.hotel_id)?.short_name)}</small><small>${e(story.date)}</small><span class="status-pill" data-status="${story.status}">${statusLabels[story.status]}</span></button>`).join("") : '<p class="subtle">Nenhum item nesta categoria.</p>'}</div></section>`; }).join("")}`;
}
const campaignStatusLabels: Record<string, string> = { planned: "Planejada", active: "Ativa", completed: "Concluída", cancelled: "Cancelada" };
function campaignDateLabel(value: string, includeYear = false): string {
  return dateLabel(value, { day: "2-digit", month: "short", ...(includeYear ? { year: "numeric" } : {}) }).replaceAll(" de ", " ").replaceAll(".", "");
}
function campaignsView(): string {
  const dates = Array.from({ length: CAMPAIGN_TIMELINE_DAYS }, (_, index) => addDays(state.campaignStart, index));
  const rangeEnd = dates.at(-1)!;
  const scheduled = state.campaigns.filter((campaign) => campaign.start_date && campaign.end_date);
  const visible = scheduled.filter((campaign) => campaign.start_date! <= rangeEnd && campaign.end_date! >= state.campaignStart);
  const unscheduled = state.campaigns.filter((campaign) => !campaign.start_date || !campaign.end_date);
  const header = dates.map((date) => {
    const day = fromIso(date).getDay();
    const classes = ["campaign-date-cell", day === 0 || day === 6 ? "weekend" : "", date === today ? "today" : ""].filter(Boolean).join(" ");
    return `<div class="${classes}" title="${e(dateLabel(date, { dateStyle: "full" }))}"><small>${e(dateLabel(date, { weekday: "short" }).replace(".", ""))}</small><strong>${e(dateLabel(date, { day: "2-digit" }))}</strong></div>`;
  }).join("");
  const rows = visible.map((campaign) => {
    const visibleStart = campaign.start_date! < state.campaignStart ? state.campaignStart : campaign.start_date!;
    const visibleEnd = campaign.end_date! > rangeEnd ? rangeEnd : campaign.end_date!;
    const offset = dates.indexOf(visibleStart);
    const span = dates.indexOf(visibleEnd) - offset + 1;
    const status = Object.hasOwn(campaignStatusLabels, campaign.status) ? campaign.status : "planned";
    const cells = dates.map((date) => { const day = fromIso(date).getDay(); return `<span class="campaign-track-cell ${day === 0 || day === 6 ? "weekend" : ""} ${date === today ? "today" : ""}" aria-hidden="true"></span>`; }).join("");
    const range = `${campaignDateLabel(campaign.start_date!)} – ${campaignDateLabel(campaign.end_date!, true)}`;
    return `<div class="campaign-timeline-row"><button type="button" class="campaign-row-info" data-action="edit-campaign" data-campaign-id="${e(campaign.id)}"><span class="campaign-status-dot" data-status="${e(status)}"></span><span><strong>${e(campaign.name)}</strong><small>${e(range)} · ${campaign.story_count + campaign.visit_count + campaign.article_count} entregas</small></span></button>${cells}<button type="button" class="campaign-period-bar" data-status="${e(status)}" data-action="edit-campaign" data-campaign-id="${e(campaign.id)}" style="--campaign-column:${offset + 2};--campaign-span:${span}" title="${e(`${campaign.name} · ${range}`)}"><span>${e(campaign.name)}</span></button></div>`;
  }).join("");
  const unscheduledList = unscheduled.length ? `<section class="campaign-unscheduled"><div class="section-heading"><div><h2>Sem período definido</h2><p class="subtle">Complete as datas para posicionar estas campanhas na linha do tempo.</p></div></div>${unscheduled.map((campaign) => `<button type="button" class="campaign-unscheduled-row" data-action="edit-campaign" data-campaign-id="${e(campaign.id)}"><span><strong>${e(campaign.name)}</strong><small>${e(campaign.description || "Sem descrição")}</small></span><span>${campaignStatusLabels[campaign.status] || "Planejada"}</span>${icon("right")}</button>`).join("")}</section>` : "";
  const empty = !state.campaigns.length ? '<div class="empty-state"><h2>Nenhuma campanha cadastrada.</h2><p>Crie uma campanha para conectar Stories, visitas e artigos.</p><button class="button primary" data-action="new-campaign">Nova campanha</button></div>' : !visible.length ? '<div class="campaign-range-empty">Nenhuma campanha atravessa este período.</div>' : "";
  return `<div class="page-heading"><div><p class="eyebrow">Conteúdo</p><h1>Campanhas</h1><p class="subtle">Visualize duração, sobreposições e entregas ao longo do calendário.</p></div><button class="button primary" data-action="new-campaign">${icon("plus")} Nova campanha</button></div><section class="campaign-timeline-shell"><div class="campaign-timeline-toolbar"><div><span>Período exibido</span><strong>${e(campaignDateLabel(state.campaignStart))} – ${e(campaignDateLabel(rangeEnd, true))}</strong><small>${visible.length} ${visible.length === 1 ? "campanha visível" : "campanhas visíveis"}</small></div><div class="campaign-range-actions"><button class="icon-button" type="button" data-action="campaign-prev" aria-label="Período anterior" title="Período anterior">${icon("left")}</button><button class="button" type="button" data-action="campaign-today">Hoje</button><button class="icon-button" type="button" data-action="campaign-next" aria-label="Próximo período" title="Próximo período">${icon("right")}</button></div></div><div class="campaign-timeline-scroll"><div class="campaign-timeline-grid"><div class="campaign-timeline-header"><div class="campaign-corner"><span>Campanha</span><small>Status e entregas</small></div>${header}</div>${rows}</div></div>${empty}</section>${unscheduledList}`;
}
function openCampaignDialog(campaign?: Campaign) {
  const existing = document.querySelector<HTMLDialogElement>("#campaignDialog"); existing?.remove();
  const dialog = document.createElement("dialog"); dialog.id = "campaignDialog"; dialog.className = "campaign-dialog";
  dialog.innerHTML = `<form id="campaignForm"><header><h2>${campaign ? "Editar campanha" : "Nova campanha"}</h2><button type="button" class="icon-button" data-action="close-campaign" aria-label="Fechar">${icon("close")}</button></header><div class="form-grid">${field("name", "Nome", campaign?.name, "text", true)}${field("description", "Descrição", campaign?.description, "textarea", true)}${field("start_date", "Início", campaign?.start_date, "date")}${field("end_date", "Término", campaign?.end_date, "date")}${selectField("status", "Status", campaign?.status || "planned", [{ id: "planned", name: "Planejada" }, { id: "active", name: "Ativa" }, { id: "completed", name: "Concluída" }, { id: "cancelled", name: "Cancelada" }])}</div><footer><button type="button" class="button" data-action="close-campaign">Cancelar</button><button class="button primary" type="submit">Salvar campanha</button></footer></form>`;
  dialog.querySelector<HTMLInputElement>("[name=name]")!.required = true;
  dialog.dataset.campaignId = campaign?.id || ""; document.body.append(dialog); hydrateIcons(dialog); dialog.showModal(); dialog.querySelector<HTMLInputElement>("[name=name]")?.focus();
}
function openPlannerUserDialog(user?: ManagedPlannerUser) {
  document.querySelector<HTMLDialogElement>("#plannerUserDialog")?.remove();
  const dialog = document.createElement("dialog"); dialog.id = "plannerUserDialog"; dialog.className = "campaign-dialog";
  dialog.dataset.userId = user?.id || "";
  dialog.innerHTML = `<form id="plannerUserForm"><header><h2>${user ? "Editar usuário" : "Novo usuário"}</h2><button type="button" class="icon-button" data-action="close-planner-user" aria-label="Fechar">${icon("close")}</button></header><div class="form-grid">${field("display_name", "Nome", user?.display_name, "text", true)}${field("email", "E-mail", user?.email, "email", true)}${selectField("access_level", "Acesso", user?.access_level || "editor", [{ id: "viewer", name: "Somente leitura" }, { id: "editor", name: "Editor" }, { id: "admin", name: "Administrador" }], true)}${user ? selectField("status", "Status", user.status, [{ id: "active", name: "Ativo" }, { id: "disabled", name: "Desativado" }], true) : field("password", "Senha inicial", "", "password", true)}</div><footer><button type="button" class="button" data-action="close-planner-user">Cancelar</button><button class="button primary" type="submit">Salvar usuário</button></footer></form>`;
  document.body.append(dialog); hydrateIcons(dialog); dialog.showModal(); dialog.querySelector<HTMLInputElement>("[name=display_name]")?.focus();
}
function openPlannerPasswordDialog(userId: string) {
  document.querySelector<HTMLDialogElement>("#plannerPasswordDialog")?.remove();
  const user = state.managedUsers.find((entry) => entry.id === userId); if (!user) return;
  const dialog = document.createElement("dialog"); dialog.id = "plannerPasswordDialog"; dialog.className = "campaign-dialog"; dialog.dataset.userId = userId;
  dialog.innerHTML = `<form id="plannerPasswordForm"><header><h2>Redefinir senha</h2><button type="button" class="icon-button" data-action="close-planner-password" aria-label="Fechar">${icon("close")}</button></header><p class="subtle">${e(user.display_name)}</p><div class="form-grid">${field("password", "Nova senha", "", "password", true)}</div><footer><button type="button" class="button" data-action="close-planner-password">Cancelar</button><button class="button primary" type="submit">Redefinir senha</button></footer></form>`;
  document.body.append(dialog); hydrateIcons(dialog); dialog.showModal(); dialog.querySelector<HTMLInputElement>("[name=password]")?.focus();
}
function assetsView(): string { return `<div class="page-heading"><div><p class="eyebrow">Conteúdo</p><h1>Banco de conteúdos</h1><p class="subtle">Fotos e vídeos são acessados diretamente pelo editor de Stories.</p></div></div><div class="section-card"><h2>Biblioteca compartilhada</h2><p class="subtle">Ao editar um Story, selecione o hotel e use “Escolher mídia”. O Planner mostra apenas arquivos ativos da unidade escolhida.</p>${state.session?.auth_source === "admin-master" ? '<p><a class="button" href="/admin/portais/media/">Administrar biblioteca na Central</a></p>' : ""}</div>`; }
function hotelsView(): string { return `<div class="page-heading"><div><p class="eyebrow">Administração</p><h1>Hotéis</h1><p class="subtle">Perfis incluídos no planejamento editorial.</p></div></div><div class="section-card"><div class="pending-list">${state.hotels.map((hotel) => `<div class="pending-row"><strong>${e(hotel.name)}</strong><small>${e(hotel.instagram_username)}</small><small>${hotel.active ? "Ativo" : "Inativo"}</small></div>`).join("")}</div></div>`; }
function categoriesView(): string { return `<div class="page-heading"><div><p class="eyebrow">Administração</p><h1>Categorias</h1><p class="subtle">Categorias disponíveis para classificar Stories.</p></div></div><div class="section-card"><div class="category-list">${state.categories.map((category) => `<span>${e(category.name)}</span>`).join("")}</div></div>`; }
function performanceView(): string { return `<div class="page-heading"><div><p class="eyebrow">Análise</p><h1>Desempenho</h1><p class="subtle">Esta área receberá métricas quando a integração de dados do Instagram estiver disponível.</p></div></div><div class="section-card"><h2>Análise em preparação</h2><p class="subtle">O planejamento e os estados de publicação já são registrados. Métricas de alcance e engajamento dependem de uma integração autorizada com o Instagram.</p></div>`; }
function usersView(): string {
  if (!state.session?.permissions.includes("social-planner.users.manage")) return `<div class="empty-state"><h2>Acesso restrito</h2><p>Somente administradores do Planner gerenciam usuários.</p></div>`;
  return `<div class="page-heading"><div><p class="eyebrow">Administração</p><h1>Usuários do Planner</h1><p class="subtle">Estas contas acessam somente o Marketing Planner.</p></div><button class="button primary" data-action="new-planner-user">${icon("plus")} Novo usuário</button></div><section class="section-card"><div class="user-management-list">${state.managedUsers.map((user) => `<div class="user-management-row" data-planner-user-id="${e(user.id)}"><strong>${e(user.display_name)}</strong><small>${e(user.email)}</small><span>${accessLevelLabel(user.access_level)}</span><span>${user.status === "active" ? "Ativo" : "Desativado"}</span><div class="user-management-actions">${user.inherited_from_central ? '<span class="status-pill">Mestre da Central</span>' : `<button class="button" data-action="edit-planner-user" data-user-id="${e(user.id)}">Editar</button><button class="button" data-action="reset-planner-password" data-user-id="${e(user.id)}">Senha</button>`}</div></div>`).join("")}</div></section>`;
}
function settingsView(): string {
  const connection = state.calendar.connection;
  const calendarAction = !state.calendar.configured
    ? '<button class="button" disabled>Configuração pendente</button>'
    : state.calendar.connected
      ? '<button class="button danger" data-action="disconnect-calendar">Desconectar</button>'
      : '<button class="button primary" data-action="connect-calendar">Conectar minha agenda</button>';
  const calendarDescription = !state.calendar.configured
    ? "Adicione as credenciais OAuth do Google no ambiente para liberar a conexão individual."
    : state.calendar.connected
      ? `Agenda conectada a ${e(connection?.account_email || "conta Google")}. Somente visitas atribuídas a você serão sincronizadas.`
      : "Conecte sua conta pessoal. Cada usuário recebe apenas as visitas em que foi marcado como responsável.";
  return `<div class="page-heading"><div><p class="eyebrow">Administração</p><h1>Configurações</h1><p class="subtle">Identidade, sessão e integrações pessoais.</p></div></div><section class="section-card"><h2>Nome da aplicação</h2><form id="plannerSettingsForm" class="settings-form"><label><span>Nome exibido</span><input name="display_name" value="${e(state.displayName)}" maxlength="100" required></label><button class="button primary" type="submit">Salvar nome</button></form></section><section class="section-card calendar-settings"><div><h2>Google Calendar</h2><p class="subtle">${calendarDescription}</p>${connection?.last_error ? `<p class="calendar-error">${e(connection.last_error)}</p>` : ""}</div>${calendarAction}</section><section class="section-card"><h2>Acesso separado</h2><p class="subtle">Usuários comuns entram exclusivamente no Planner. Apenas o administrador mestre pode atravessar a sessão da Central.</p></section>`;
}
function emptyState(message: string): string { return `<div class="empty-state"><h2>${e(message)}</h2><p>Crie um conteúdo e escolha onde ele será publicado.</p><button class="button primary" data-action="new">Novo conteúdo</button></div>`; }
function visitContext(): VisitContext { return { visits: state.visits, hotels: state.hotels, categories: state.categories, users: state.users, campaigns: state.campaigns, week: state.week, day: state.day, today, filter: state.visitFilter, view: state.view as VisitContext["view"] }; }
function blogContext(): BlogContext { return { posts: state.posts, hotels: state.hotels, categories: state.categories, users: state.users, campaigns: state.campaigns, day: state.day, today, view: state.view as BlogContext["view"], mode: state.blogMode, filters: state.blogFilters }; }
function render() {
  renderNavigation();
  const globalSearch = document.querySelector<HTMLInputElement>("#globalPlannerSearch");
  if (globalSearch && globalSearch.value !== state.filters.search) globalSearch.value = state.filters.search;
  if (state.loading) { main.innerHTML = '<div class="loading-shell"><div class="skeleton title"></div><div class="skeleton toolbar"></div><div class="skeleton grid"></div></div>'; hydrateIcons(main); return; }
  if (state.view.startsWith("visits-")) main.innerHTML = visitsView(visitContext());
  else if (state.view.startsWith("blog-")) main.innerHTML = blogView(blogContext());
  else if (state.view === "overview") main.innerHTML = overviewView(state.stories, state.visits, state.posts, state.hotels, today, state.week);
  else if (state.view === "asana-calendar") main.innerHTML = asanaCalendarView({ setup: state.asanaSetup, tasks: state.asanaTasks, hotels: state.hotels, day: state.day, today, hotelFilter: state.asanaHotelFilter, canManage: Boolean(state.asanaSetup?.can_manage_tasks && state.session?.permissions.includes("social-planner.write")) });
  else main.innerHTML = ({ week: weekView, calendar: calendarView, pending: pendingView, campaigns: campaignsView, assets: assetsView, hotels: hotelsView, categories: categoriesView, performance: performanceView, users: usersView, settings: settingsView } as Partial<Record<View, () => string>>)[state.view]?.() || "";
  hydrateIcons(main);
}

function accessLevelLabel(level: ManagedPlannerUser["access_level"]): string {
  return ({ viewer: "Leitura", editor: "Editor", admin: "Administrador" })[level];
}

function openDrawer(story: Story | "new", date = today, hotel = "") {
  state.visitDrawer = null; state.postDrawer = null; state.asanaTaskDrawer = null;
  state.drawer = story; state.createDate = date; state.createHotel = hotel;
  renderDrawer(); hydrateIcons(drawer); drawer.hidden = false; backdrop.hidden = false;
  document.body.style.overflow = "hidden"; drawer.querySelector<HTMLInputElement>("input[name=title]")?.focus();
}
function closeDrawer() { state.drawer = null; state.visitDrawer = null; state.postDrawer = null; state.asanaTaskDrawer = null; drawer.hidden = true; backdrop.hidden = true; document.body.style.overflow = ""; }
function visitDrawerContent(visit: Visit | null): string {
  const related = visit?.stories?.length ? `<section class="drawer-section"><h3>Stories da visita</h3><div class="pending-list">${visit.stories.map((story) => `<button type="button" class="pending-row" data-action="open-linked-story" data-linked-story-id="${e(story.id)}"><strong>${e(story.title)}</strong><small>${e(story.date)}</small><span>${statusLabels[story.status]}</span></button>`).join("")}</div></section>` : "";
  return visitDrawer(visit, visitContext(), state.createDate).replace('<div id="deleteConfirm"></div>', `${related}<div id="deleteConfirm"></div>`);
}
async function openVisit(id?: string, date = today) {
  try {
    state.drawer = null; state.postDrawer = null; state.asanaTaskDrawer = null; state.createDate = date;
    state.visitDrawer = id ? await marketingRepository.visit(id) : "new";
    drawer.innerHTML = visitDrawerContent(state.visitDrawer === "new" ? null : state.visitDrawer); hydrateIcons(drawer);
    drawer.hidden = false; backdrop.hidden = false; document.body.style.overflow = "hidden";
    drawer.querySelector<HTMLInputElement>("[name=title]")?.focus();
  } catch (error) { notify((error as Error).message, true); }
}
function openPost(post?: BlogPost) {
  state.drawer = null; state.visitDrawer = null; state.asanaTaskDrawer = null; state.postDrawer = post || "new";
  drawer.innerHTML = blogDrawer(post || null, blogContext()); hydrateIcons(drawer); drawer.hidden = false; backdrop.hidden = false; document.body.style.overflow = "hidden";
  drawer.querySelector<HTMLInputElement>("[name=title]")?.focus();
}
function renderAsanaTaskDrawer(task: AsanaTaskDetail) {
  const editable = Boolean(state.asanaSetup?.can_manage_tasks && state.session?.permissions.includes("social-planner.write"));
  const disabled = editable ? "" : "disabled";
  const startOn = task.start_on || (task.has_start_date ? task.start_date : "") || "";
  const dueOn = task.due_on || task.end_date || "";
  const updated = task.modified_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.modified_at)) : "Não informado";
  drawer.innerHTML = `<div class="drawer-header"><div><small>Tarefa do Asana</small><h2 id="drawerTitle">${e(task.name)}</h2></div><button class="icon-button" type="button" data-action="close-drawer" aria-label="Fechar">${icon("close")}</button></div><form id="asanaTaskForm"><div class="drawer-body"><section class="drawer-section asana-task-context"><span>${e(task.hotel_name)}</span><strong>${e(task.project_name)}</strong>${task.section_name ? `<small>${e(task.section_name)}</small>` : ""}</section><section class="drawer-section"><h3>Conteúdo</h3><div class="form-grid"><label class="full"><span>Título *</span><input name="name" value="${e(task.name)}" maxlength="500" required ${disabled}></label><label class="full"><span>Descrição</span><textarea name="notes" maxlength="50000" ${disabled}>${e(task.notes)}</textarea></label></div></section><section class="drawer-section"><h3>Planejamento</h3><div class="form-grid"><label><span>Data inicial</span><input name="start_on" type="date" value="${e(startOn)}" ${disabled}></label><label><span>Data final</span><input name="due_on" type="date" value="${e(dueOn)}" ${disabled}></label><label class="asana-completed-toggle full"><input name="completed" type="checkbox" ${task.completed ? "checked" : ""} ${disabled}><span>Marcar tarefa como concluída</span></label></div></section><section class="drawer-section asana-task-metadata"><h3>Informações do Asana</h3><dl><div><dt>Responsável</dt><dd>${e(task.assignee_name || "Não atribuído")}</dd></div><div><dt>Última alteração</dt><dd>${e(updated)}</dd></div></dl></section>${!editable ? '<p class="calendar-error">Reconecte sua conta com permissão de edição ou solicite perfil de Editor no Planner.</p>' : ""}</div><div class="drawer-actions">${task.permalink_url ? `<a class="button" href="${e(task.permalink_url)}" target="_blank" rel="noopener noreferrer">Abrir no Asana</a>` : ""}${editable ? '<button type="submit" class="button primary">Salvar tarefa</button>' : ""}</div></form>`;
  hydrateIcons(drawer);
}
async function openAsanaTask(taskGid: string) {
  try {
    state.drawer = null; state.visitDrawer = null; state.postDrawer = null;
    drawer.innerHTML = '<div class="drawer-body"><div class="loading-shell"><div class="skeleton title"></div><div class="skeleton grid"></div></div></div>';
    drawer.hidden = false; backdrop.hidden = false; document.body.style.overflow = "hidden";
    state.asanaTaskDrawer = await marketingRepository.asanaTask(taskGid);
    renderAsanaTaskDrawer(state.asanaTaskDrawer);
  } catch (error) { closeDrawer(); notify((error as Error).message, true); }
}
function mergeAsanaTask(task: AsanaTaskDetail) {
  state.asanaTasks = state.asanaTasks.map((entry) => entry.gid === task.gid ? { ...entry, ...task } : entry);
  state.asanaTaskDrawer = task;
}
async function saveAsanaTaskForm(event: SubmitEvent) {
  event.preventDefault();
  const task = state.asanaTaskDrawer; if (!task) return;
  const form = event.target as HTMLFormElement; const data = new FormData(form);
  const input: AsanaTaskInput = {
    name: String(data.get("name") || "").trim(), notes: String(data.get("notes") || ""),
    start_on: String(data.get("start_on") || "") || null, due_on: String(data.get("due_on") || "") || null,
    completed: data.get("completed") === "on",
  };
  if (input.start_on && !input.due_on) { notify("Informe a data final quando houver data inicial.", true); return; }
  try {
    const saved = await marketingRepository.updateAsanaTask(task.gid, input); mergeAsanaTask(saved); render(); renderAsanaTaskDrawer(saved); notify("Tarefa atualizada no Asana.");
  } catch (error) { notify((error as Error).message, true); }
}
async function moveAsanaTaskToDate(taskGid: string, targetDate: string) {
  const task = state.asanaTasks.find((entry) => entry.gid === taskGid);
  if (!task || !/^\d{4}-\d{2}-\d{2}$/u.test(targetDate)) return;
  const duration = task.start_date && task.end_date ? Math.max(0, Math.round((fromIso(task.end_date).getTime() - fromIso(task.start_date).getTime()) / 86_400_000)) : 0;
  const dueOn = addDays(targetDate, duration);
  const input: AsanaTaskInput = task.has_start_date ? { start_on: targetDate, due_on: dueOn } : { due_on: targetDate };
  const previous = state.asanaTasks.map((entry) => ({ ...entry }));
  state.asanaTasks = state.asanaTasks.map((entry) => entry.gid === taskGid ? { ...entry, start_date: targetDate, end_date: dueOn } : entry);
  render();
  try { mergeAsanaTask(await marketingRepository.updateAsanaTask(taskGid, input)); render(); notify("Tarefa movida no Asana."); }
  catch (error) { state.asanaTasks = previous; render(); notify(`Movimento revertido: ${(error as Error).message}`, true); }
}
function field(name: string, label: string, value: unknown, kind: "text" | "date" | "time" | "textarea" | "url" | "email" | "password" = "text", full = false): string {
  const escaped = e(value); const required = ["title", "hotel_id", "date"].includes(name) ? "required" : "";
  return `<label class="${full ? "full" : ""}"><span>${label}${required ? " *" : ""}</span>${kind === "textarea" ? `<textarea name="${name}">${escaped}</textarea>` : `<input name="${name}" type="${kind}" value="${escaped}" ${required}>`}</label>`;
}
function selectField(name: string, label: string, value: string | null, values: { id: string; name: string }[], required = false): string {
  return `<label><span>${label}${required ? " *" : ""}</span><select name="${name}" ${required ? "required" : ""}>${required ? option("", "Selecione", value || "") : option("", "Não definido", value || "")}${value && !values.some((item) => item.id === value) ? option(value, "Vínculo existente", value) : ""}${values.map((item) => option(item.id, item.name, value || "")).join("")}</select></label>`;
}
function channelPlanner(story: Story | null): string {
  const existing = new Map((story?.channels || []).map((channel) => [channel.channel_id, channel]));
  const defaultId = story ? null : "instagram-feed";
  const statusOptions = Object.entries(statusLabels).map(([id, name]) => ({ id, name }));
  const sourceOptions = state.channels.map((channel) => ({ id: channel.id, name: channel.display_name }));
  return `<section class="drawer-section"><div class="section-heading"><div><h3>Canais e reaproveitamento</h3><p class="drawer-hint">Selecione os destinos e adapte somente o que mudar em cada rede.</p></div></div><div class="channel-planner">${state.channels.map((channel) => {
    const linked = existing.get(channel.id);
    const selected = Boolean(linked || channel.id === defaultId);
    const plannedAt = linked?.planned_at || (selected && story?.date ? `${story.date}T${story.planned_time || "12:00"}` : "");
    return `<article class="channel-row" data-channel-row="${e(channel.id)}"><label class="channel-toggle"><input type="checkbox" name="channel_selected" value="${e(channel.id)}" ${selected ? "checked" : ""}><span><strong>${e(channel.display_name)}</strong><small>${e(channel.platform_name)} · ${e(channel.placement_key)}</small></span></label><div class="channel-fields"><label><span>Agendar</span><input type="datetime-local" name="channel_planned_${e(channel.id)}" value="${e(plannedAt)}"></label><label><span>Status</span><select name="channel_status_${e(channel.id)}">${statusOptions.map((item) => option(item.id, item.name, linked?.status || story?.status || "idea")).join("")}</select></label><label><span>Reaproveitar de</span><select name="channel_source_${e(channel.id)}">${option("", "Conteúdo original", linked?.source_channel_id || "")}${sourceOptions.filter((item) => item.id !== channel.id).map((item) => option(item.id, item.name, linked?.source_channel_id || "")).join("")}</select></label><label class="full"><span>Texto adaptado</span><textarea name="channel_text_${e(channel.id)}" placeholder="Use somente quando este canal precisar de outra legenda ou roteiro">${e(linked?.adapted_text)}</textarea></label></div></article>`;
  }).join("")}</div></section>`;
}
function channelFormInput(form: HTMLFormElement): StoryChannelInput[] {
  const data = new FormData(form);
  const selected = new Set(data.getAll("channel_selected").map(String));
  return [...selected].map((id) => {
    const text = (name: string) => String(data.get(`${name}_${id}`) || "").trim() || null;
    const source = text("channel_source");
    return {
      channel_id: id,
      source_channel_id: source && selected.has(source) ? source : null,
      adapted_text: text("channel_text"),
      planned_at: text("channel_planned"),
      status: (text("channel_status") || "idea") as StoryChannelInput["status"],
      published_at: null,
      published_url: null,
    };
  });
}
function renderDrawer() {
  const story = state.drawer === "new" ? null : state.drawer;
  if (!state.drawer) return;
  const formatOptions = Object.entries(formatLabels).map(([id, name]) => ({ id, name }));
  const objectiveOptions = Object.entries(objectiveLabels).map(([id, name]) => ({ id, name }));
  const statusOptions = Object.entries(statusLabels).map(([id, name]) => ({ id, name }));
  const priorityOptions = Object.entries(priorityLabels).map(([id, name]) => ({ id, name }));
  drawer.innerHTML = `<div class="drawer-header"><div><small>${story ? "Editar conteúdo" : "Novo conteúdo"}</small><h2 id="drawerTitle">${e(story?.title || "Planejar conteúdo")}</h2></div><button class="icon-button" data-action="close-drawer" aria-label="Fechar">${icon("close")}</button></div><form id="storyForm"><div class="drawer-body"><section class="drawer-section"><h3>Planejamento</h3><div class="form-grid">${selectField("hotel_id", "Hotel", story?.hotel_id || state.createHotel, state.hotels, true)}${field("date", "Data", story?.date || state.createDate, "date")}${field("planned_time", "Horário planejado", story?.planned_time, "time")}${selectField("status", "Status geral", story?.status || "idea", statusOptions)}${selectField("priority", "Prioridade", story?.priority || "normal", priorityOptions)}</div></section><section class="drawer-section"><h3>Conteúdo-base</h3><div class="form-grid">${field("title", "Título interno", story?.title, "text", true)}${field("description", "Descrição / ideia", story?.description, "textarea", true)}${field("story_text", "Texto ou roteiro principal", story?.story_text, "textarea", true)}${selectField("category_id", "Categoria", story?.category_id || null, state.categories)}${selectField("content_pillar_id", "Pilar de conteúdo", story?.content_pillar_id || null, state.pillars)}${selectField("format", "Formato", story?.format || null, formatOptions)}${selectField("objective", "Objetivo", story?.objective || null, objectiveOptions)}${field("cta", "CTA", story?.cta)}${field("link", "Link", story?.link, "url", true)}</div></section>${channelPlanner(story)}<section class="drawer-section"><h3>Mídia</h3><div class="form-grid">${field("media_asset_id", "ID da mídia na biblioteca", story?.media_asset_id, "text", true)}</div><p class="drawer-hint">O mesmo arquivo pode ser reaproveitado nos destinos selecionados.</p>${story?.thumbnail_url ? `<img src="${e(story.thumbnail_url)}" alt="Prévia da mídia" style="max-height:100px;border-radius:7px;margin-top:10px">` : ""}</section><section class="drawer-section"><h3>Responsável</h3><div class="form-grid">${selectField("responsible_user_id", "Pessoa responsável", story?.responsible_user_id || null, state.users)}</div></section><section class="drawer-section"><h3>Publicação principal</h3><div class="form-grid">${selectField("campaign_id", "Campanha", story?.campaign_id || null, state.campaigns)}${field("published_at", "Publicado em (ISO)", story?.published_at)}${field("published_url", "URL publicada", story?.published_url, "url", true)}</div></section><section class="drawer-section"><h3>Sequência</h3><div class="form-grid">${selectField("sequence_group_id", "Grupo", story?.sequence_group_id || null, state.sequences.map((sequence) => ({ id: sequence.id, name: sequence.title })))}${field("sequence_position", "Posição", story?.sequence_position)}</div><button type="button" class="button" data-action="new-sequence" style="margin-top:10px">Criar sequência</button></section><section class="drawer-section"><h3>Origem</h3><div class="form-grid">${selectField("source_visit_id", "Visita de captação", story?.source_visit_id || null, state.visits.filter((visit) => visit.hotel_id === (story?.hotel_id || state.createHotel)).map((visit) => ({ id: visit.id, name: `${visit.date} · ${visit.title}` })))}</div></section><section class="drawer-section"><h3>Informações adicionais</h3><div class="form-grid">${field("notes", "Observações", story?.notes, "textarea", true)}</div></section><div id="deleteConfirm"></div></div><div class="drawer-actions">${story ? `<button type="button" class="button" data-action="duplicate">Duplicar</button><button type="button" class="button" data-action="mark-ready">Pronto</button><button type="button" class="button" data-action="mark-published">Publicado</button><button type="button" class="button danger" data-action="delete">Excluir</button>` : ""}<button type="submit" class="button primary">${state.saving ? "Salvando..." : "Salvar conteúdo"}</button></div></form>`;
  const mediaSection = drawer.querySelector<HTMLElement>(".drawer-section:nth-of-type(3)");
  mediaSection?.insertAdjacentHTML("beforeend", '<button type="button" class="button" data-action="choose-media" style="margin-top:10px">Escolher da biblioteca</button><div id="mediaChoices"></div>');
  if (story?.sequence_group_id) drawer.querySelector(".drawer-actions")?.insertAdjacentHTML("afterbegin", '<button type="button" class="button" data-action="duplicate-sequence">Duplicar sequência</button>');
  if (story) drawer.querySelector(".drawer-actions")?.insertAdjacentHTML("afterbegin", '<button type="button" class="button" data-action="move">Mover</button>');
  hydrateIcons(drawer);
}
function formInput(): StoryInput {
  const form = drawer.querySelector<HTMLFormElement>("#storyForm")!; const data = new FormData(form);
  const fields = ["hotel_id", "date", "planned_time", "title", "description", "story_text", "category_id", "content_pillar_id", "format", "objective", "status", "priority", "cta", "link", "responsible_user_id", "campaign_id", "media_asset_id", "sequence_group_id", "sequence_position", "source_visit_id", "notes", "published_at", "published_url"];
  const input: Record<string, unknown> = {}; for (const key of fields) input[key] = String(data.get(key) || "").trim() || null;
  input.sequence_position = input.sequence_position ? Number(input.sequence_position) : null;
  if (input.published_at) input.published_at = new Date(String(input.published_at)).toISOString();
  return input as StoryInput;
}
async function saveDrawer(event: SubmitEvent) {
  event.preventDefault(); if (state.saving) return;
  const form = event.target as HTMLFormElement; if (!form.reportValidity()) return;
  state.saving = true; const existing = state.drawer && state.drawer !== "new" ? state.drawer : null;
  try {
    const channels = channelFormInput(form);
    if (!channels.length) throw new Error("Selecione pelo menos um canal de publicação.");
    const baseSaved = existing ? await repository.update(existing.id, formInput()) : await repository.create(formInput());
    const saved = await repository.saveChannels(baseSaved.id, channels);
    state.stories = existing ? state.stories.map((story) => story.id === saved.id ? saved : story) : [...state.stories, saved];
    if (existing?.campaign_id || saved.campaign_id) { try { state.campaigns = await repository.campaigns(); } catch { /* refresh on next visit */ } }
    closeDrawer(); render(); notify(existing ? "Conteúdo atualizado." : "Conteúdo criado.");
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
function upsertVisit(visit: Visit) { state.visits = [visit, ...state.visits.filter((item) => item.id !== visit.id)]; render(); }
function upsertPost(post: BlogPost) { state.posts = [post, ...state.posts.filter((item) => item.id !== post.id)]; render(); }
async function refreshVisitDrawer() {
  if (!state.visitDrawer || state.visitDrawer === "new") return;
  state.visitDrawer = await marketingRepository.visit(state.visitDrawer.id);
  upsertVisit(state.visitDrawer);
  drawer.innerHTML = visitDrawerContent(state.visitDrawer);
  hydrateIcons(drawer);
}
async function saveVisitForm(event: SubmitEvent) {
  event.preventDefault(); if (state.saving) return;
  const form = event.target as HTMLFormElement; if (!form.reportValidity()) return;
  state.saving = true;
  try {
    const existing = state.visitDrawer && state.visitDrawer !== "new" ? state.visitDrawer : null;
    const saved = existing ? await marketingRepository.updateVisit(existing.id, visitFormInput(form)) : await marketingRepository.createVisit(visitFormInput(form));
    upsertVisit(saved); closeDrawer(); notify(existing ? "Visita atualizada." : "Visita agendada.");
  } catch (error) { notify((error as Error).message, true); }
  finally { state.saving = false; }
}
async function savePostForm(event: SubmitEvent) {
  event.preventDefault(); if (state.saving) return;
  const form = event.target as HTMLFormElement; if (!form.reportValidity()) return;
  state.saving = true;
  try {
    const existing = state.postDrawer && state.postDrawer !== "new" ? state.postDrawer : null;
    let saved = existing ? await marketingRepository.updatePost(existing.id, blogFormInput(form)) : await marketingRepository.createPost(blogFormInput(form));
    upsertPost(saved);
    const file = form.querySelector<HTMLInputElement>("[name=article_file]")?.files?.[0];
    if (file) {
      try { saved = await marketingRepository.uploadPostDocument(saved.id, file); upsertPost(saved); }
      catch (error) { state.postDrawer = saved; openPost(saved); notify(`A pauta foi salva, mas o arquivo não foi enviado: ${(error as Error).message}`, true); return; }
    }
    closeDrawer(); notify(file ? "Pauta e artigo salvos." : existing ? "Pauta atualizada." : "Pauta criada.");
  } catch (error) { notify((error as Error).message, true); }
  finally { state.saving = false; }
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
  const platform = target.closest<HTMLButtonElement>("[data-platform]"); if (platform) { state.platformFilter = platform.dataset.platform || "all"; updateUrl(); render(); return; }
  const day = target.closest<HTMLButtonElement>("[data-day]"); if (day) { state.day = day.dataset.day!; updateUrl(); render(); return; }
  const visitElement = target.closest<HTMLElement>("[data-visit-id]"); if (visitElement && !target.closest("[data-action]")) { await openVisit(visitElement.dataset.visitId); return; }
  const postElement = target.closest<HTMLElement>("[data-post-id]"); if (postElement && !target.closest("[data-action]")) { const post = state.posts.find((item) => item.id === postElement.dataset.postId); if (post) openPost(post); return; }
  const storyElement = target.closest<HTMLElement>("[data-story-id]"); if (storyElement && !target.closest("[data-action]")) { try { openDrawer(await repository.story(storyElement.dataset.storyId!)); } catch (error) { notify((error as Error).message, true); } return; }
  const button = target.closest<HTMLElement>("[data-action]"); if (!button) return;
  const action = button.dataset.action;
  if (action === "open-asana-task") { await openAsanaTask(button.dataset.asanaTaskId || ""); return; }
  if (action === "new-planner-user") { openPlannerUserDialog(); return; }
  if (action === "edit-planner-user") { const user = state.managedUsers.find((entry) => entry.id === button.dataset.userId); if (user) openPlannerUserDialog(user); return; }
  if (action === "reset-planner-password") { openPlannerPasswordDialog(button.dataset.userId || ""); return; }
  if (action === "close-planner-user") { document.querySelector<HTMLDialogElement>("#plannerUserDialog")?.close(); return; }
  if (action === "close-planner-password") { document.querySelector<HTMLDialogElement>("#plannerPasswordDialog")?.close(); return; }
  if (action === "connect-calendar") { try { const result = await marketingRepository.connectCalendar(); location.assign(result.authorization_url); } catch (error) { notify((error as Error).message, true); } return; }
  if (action === "disconnect-calendar") { if (!window.confirm("Desconectar sua agenda do Google Calendar?")) return; try { await marketingRepository.disconnectCalendar(); state.calendar = await marketingRepository.calendarStatus(); render(); notify("Agenda desconectada."); } catch (error) { notify((error as Error).message, true); } return; }
  if (action === "connect-asana") { try { const result = await marketingRepository.connectAsana(); location.assign(result.authorization_url); } catch (error) { notify((error as Error).message, true); } return; }
  if (action === "disconnect-asana") { if (!window.confirm("Desconectar sua conta do Asana deste Planner?")) return; try { await marketingRepository.disconnectAsana(); state.asanaSetup = await marketingRepository.asanaSetup(); state.asanaTasks = []; render(); notify("Conta do Asana desconectada."); } catch (error) { notify((error as Error).message, true); } return; }
  if (["asana-prev-month", "asana-next-month", "asana-today"].includes(action || "")) { const date = action === "asana-today" ? fromIso(today) : fromIso(state.day); if (action !== "asana-today") { date.setDate(1); date.setMonth(date.getMonth() + (action === "asana-prev-month" ? -1 : 1)); } state.day = isoDate(date); state.week = weekStart(state.day); updateUrl(); void loadAsanaData(); return; }
  if (action === "close-drawer") closeDrawer();
  if (action === "open-linked-story") { try { const story = await repository.story(button.dataset.linkedStoryId!); openDrawer(story); } catch (error) { notify((error as Error).message, true); } return; }
  if (action === "new-visit" || action === "new-visit-day") { await openVisit(undefined, button.dataset.date || today); return; }
  if (action === "new-post") { openPost(); return; }
  if (action === "visits-prev-week" || action === "visits-next-week" || action === "visits-today") { state.week = action === "visits-today" ? weekStart(today) : addDays(state.week, action === "visits-prev-week" ? -7 : 7); state.day = state.week; updateUrl(); void loadData(); return; }
  if (action === "visits-older" || action === "visits-newer") { state.day = addDays(state.day, action === "visits-older" ? -90 : 90); if (state.day > today) state.day = today; updateUrl(); void loadData(); return; }
  if (["visits-prev-month", "visits-next-month", "blog-prev-month", "blog-next-month"].includes(action || "")) { const date = fromIso(state.day); date.setDate(1); date.setMonth(date.getMonth() + (action?.includes("prev") ? -1 : 1)); state.day = isoDate(date); state.week = weekStart(state.day); updateUrl(); void loadData(); return; }
  if (action === "blog-list" || action === "blog-calendar") { state.blogMode = action === "blog-list" ? "list" : "calendar"; render(); return; }
  const currentVisit = state.visitDrawer && state.visitDrawer !== "new" ? state.visitDrawer : null;
  if (currentVisit && action === "add-visit-item") {
    const title = drawer.querySelector<HTMLInputElement>("[name=new_item_title]")?.value.trim(); if (!title) { notify("Informe o item de captação.", true); return; }
    try { await marketingRepository.createItem(currentVisit.id, { title, content_type: drawer.querySelector<HTMLInputElement>("[name=new_item_type]")?.value.trim() || null, category_id: drawer.querySelector<HTMLSelectElement>("[name=new_item_category]")?.value || null }); await refreshVisitDrawer(); notify("Item adicionado."); } catch (error) { notify((error as Error).message, true); } return;
  }
  if (currentVisit && action === "delete-visit-item") { if (!window.confirm("Excluir este item do checklist?")) return; try { await marketingRepository.deleteItem(currentVisit.id, button.dataset.itemId!); await refreshVisitDrawer(); notify("Item excluído."); } catch (error) { notify((error as Error).message, true); } return; }
  if (currentVisit && action === "link-visit-media") { const id = drawer.querySelector<HTMLInputElement>("[name=new_media_id]")?.value.trim(); if (!id) return; try { await marketingRepository.linkMedia(currentVisit.id, id); await refreshVisitDrawer(); notify("Mídia vinculada."); } catch (error) { notify((error as Error).message, true); } return; }
  if (currentVisit && action === "unlink-visit-media") { try { await marketingRepository.unlinkMedia(currentVisit.id, button.dataset.mediaId!); await refreshVisitDrawer(); notify("Vínculo removido."); } catch (error) { notify((error as Error).message, true); } return; }
  if (currentVisit && action === "sync-visit-calendar") { try { const result = await marketingRepository.syncVisitCalendar(currentVisit.id); await refreshVisitDrawer(); notify(`${result.synced} agenda(s) sincronizada(s).${result.skipped ? ` ${result.skipped} responsável(is) sem conexão.` : ""}`); } catch (error) { notify((error as Error).message, true); } return; }
  if (currentVisit && action === "delete-visit") { drawer.querySelector<HTMLElement>("#deleteConfirm")!.innerHTML = `<div class="dialog-inline">Excluir esta visita e seu checklist?<br><button type="button" class="button danger" data-action="confirm-delete-visit">Confirmar exclusão</button><button type="button" class="button" data-action="cancel-marketing-delete">Cancelar</button></div>`; return; }
  if (currentVisit && action === "confirm-delete-visit") { try { await marketingRepository.deleteVisit(currentVisit.id); state.visits = state.visits.filter((item) => item.id !== currentVisit.id); closeDrawer(); render(); notify("Visita excluída."); } catch (error) { notify((error as Error).message, true); } return; }
  const currentPost = state.postDrawer && state.postDrawer !== "new" ? state.postDrawer : null;
  if (currentPost && action === "remove-post-document") { if (!window.confirm("Remover o arquivo anexado desta pauta?")) return; try { const updated = await marketingRepository.removePostDocument(currentPost.id); upsertPost(updated); openPost(updated); notify("Arquivo removido."); } catch (error) { notify((error as Error).message, true); } return; }
  if (currentPost && action === "archive-post") { try { const updated = await marketingRepository.updatePost(currentPost.id, { status: "archived" }); upsertPost(updated); closeDrawer(); notify("Artigo arquivado."); } catch (error) { notify((error as Error).message, true); } return; }
  if (currentPost && action === "delete-post") { drawer.querySelector<HTMLElement>("#deleteConfirm")!.innerHTML = `<div class="dialog-inline">Excluir este artigo?<br><button type="button" class="button danger" data-action="confirm-delete-post">Confirmar exclusão</button><button type="button" class="button" data-action="cancel-marketing-delete">Cancelar</button></div>`; return; }
  if (currentPost && action === "confirm-delete-post") { try { await marketingRepository.deletePost(currentPost.id); state.posts = state.posts.filter((item) => item.id !== currentPost.id); closeDrawer(); render(); notify("Artigo excluído."); } catch (error) { notify((error as Error).message, true); } return; }
  if (action === "cancel-marketing-delete") { drawer.querySelector<HTMLElement>("#deleteConfirm")!.innerHTML = ""; return; }
  if (action === "new") openDrawer("new", state.view === "week" && (today < state.week || today > addDays(state.week, 6)) ? state.week : today);
  if (action === "new-cell") openDrawer("new", button.dataset.date!, button.dataset.hotel!);
  if (action === "campaign-prev" || action === "campaign-next" || action === "campaign-today") { state.campaignStart = action === "campaign-today" ? weekStart(today) : addDays(state.campaignStart, action === "campaign-prev" ? -28 : 28); updateUrl(); render(); return; }
  if (action === "prev-week" || action === "next-week" || action === "today") { state.week = action === "today" ? weekStart(today) : addDays(state.week, action === "prev-week" ? -7 : 7); state.day = state.week; updateUrl(); void loadData(); }
  if (action === "prev-month" || action === "next-month") { const d = fromIso(state.day); d.setDate(1); d.setMonth(d.getMonth() + (action === "prev-month" ? -1 : 1)); state.day = isoDate(d); state.week = weekStart(state.day); updateUrl(); void loadData(); }
  const current = state.drawer && state.drawer !== "new" ? state.drawer : null;
  if (current && action === "mark-ready") await patchStory(current, { status: "ready" }, "Marcado como pronto.");
  if (current && action === "mark-published") await patchStory(current, { status: "published", published_at: new Date().toISOString() }, "Marcado como publicado.");
  if (current && action === "duplicate") { const copy = { ...current, title: `${current.title} (cópia)`, status: "idea" as const, published_at: null, published_url: null, sequence_group_id: null, sequence_position: null }; try { const created = await repository.create(copy); const saved = await repository.saveChannels(created.id, (current.channels || []).map((channel) => ({ ...channel, status: "idea", published_at: null, published_url: null }))); state.stories.push(saved); render(); notify("Conteúdo duplicado."); openDrawer(saved); } catch (error) { notify((error as Error).message, true); } }
  if (current && action === "duplicate-sequence" && current.sequence_group_id) { try { const result = await repository.duplicateSequence(current.sequence_group_id); state.sequences.push(result.sequence); state.stories.push(...result.stories); render(); notify("Sequência duplicada."); closeDrawer(); } catch (error) { notify((error as Error).message, true); } }
  if (current && action === "move") { drawer.querySelector<HTMLInputElement>("[name=date]")?.focus(); drawer.scrollTo({ top: 0, behavior: "smooth" }); }
  if (action === "choose-media") {
    const hotelId = drawer.querySelector<HTMLSelectElement>("[name=hotel_id]")?.value;
    const choices = drawer.querySelector<HTMLElement>("#mediaChoices")!;
    if (!hotelId) { notify("Selecione um hotel primeiro.", true); return; }
    choices.innerHTML = '<p class="drawer-hint">Carregando mídia...</p>';
    try {
      const response = await fetch(`/api/v1/social-planner/media?hotel_id=${encodeURIComponent(hotelId)}`, { credentials: "same-origin" });
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
document.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (target.name === "article_file" && target instanceof HTMLInputElement) {
    const file = target.files?.[0];
    if (file && file.size > 15 * 1024 * 1024) { target.value = ""; notify("O artigo deve ter no máximo 15 MB.", true); return; }
    const label = target.closest<HTMLElement>(".article-file-picker")?.querySelector<HTMLElement>("strong");
    if (label && file) label.textContent = file.name;
    return;
  }
  if (target.id === "asanaHotelFilter") { state.asanaHotelFilter = target.value; updateUrl(); void loadAsanaData(); return; }
  if (target.dataset.visitFilter) { state.visitFilter = target.value; updateUrl(); render(); return; }
  if (target.dataset.blogFilter) { state.blogFilters[target.dataset.blogFilter] = target.value; updateUrl(); render(); return; }
  if (target.dataset.itemToggle && state.visitDrawer && state.visitDrawer !== "new") {
    const visitId = state.visitDrawer.id, checked = (target as HTMLInputElement).checked;
    void marketingRepository.updateItem(visitId, target.dataset.itemToggle, { completed: checked ? 1 : 0 }).then(() => refreshVisitDrawer()).catch((error) => { (target as HTMLInputElement).checked = !checked; notify((error as Error).message, true); }); return;
  }
  if (target.name === "hotel_id" && state.drawer) { const select = drawer.querySelector<HTMLSelectElement>("[name=source_visit_id]"); if (select) { select.innerHTML = option("", "Não definido") + state.visits.filter((v) => v.hotel_id === target.value).map((v) => option(v.id, `${v.date} · ${v.title}`)).join(""); } }
  if (!target.dataset.filter || target.dataset.filter === "search") return;
  (state.filters as unknown as Record<string, string>)[target.dataset.filter] = target.value; updateUrl(); void loadData();
});
document.addEventListener("input", (event) => { const target = event.target as HTMLInputElement; if (target.dataset.filter !== "search") return; state.filters.search = target.value; updateUrl(); const active = document.activeElement as HTMLInputElement; const cursor = active.selectionStart; render(); const replacement = main.querySelector<HTMLInputElement>("[data-filter=search]"); replacement?.focus(); if (cursor !== null) replacement?.setSelectionRange(cursor, cursor); });
document.querySelector<HTMLInputElement>("#globalPlannerSearch")!.addEventListener("input", (event) => {
  state.filters.search = (event.target as HTMLInputElement).value;
  if (!["week", "calendar", "pending"].includes(state.view)) { state.view = "week"; updateUrl(); void loadData(); return; }
  updateUrl(); render(); document.querySelector<HTMLInputElement>("#globalPlannerSearch")?.focus();
});
drawer.addEventListener("submit", (event) => { const id = (event.target as HTMLElement).id; if (id === "storyForm") void saveDrawer(event); if (id === "visitForm") void saveVisitForm(event); if (id === "blogForm") void savePostForm(event); if (id === "asanaTaskForm") void saveAsanaTaskForm(event); });
document.addEventListener("submit", async (event) => {
  if ((event.target as HTMLElement).id === "plannerSettingsForm") { event.preventDefault(); const form = event.target as HTMLFormElement; const name = String(new FormData(form).get("display_name") || "").trim(); try { const saved = await marketingRepository.saveSettings(name); state.displayName = saved.display_name; document.querySelector<HTMLElement>("#plannerName")!.textContent = saved.display_name; document.title = saved.display_name; render(); notify("Nome atualizado."); } catch (error) { notify((error as Error).message, true); } return; }
  if ((event.target as HTMLElement).id === "asanaWorkspaceForm") {
    event.preventDefault(); const form = event.target as HTMLFormElement; const workspace = String(new FormData(form).get("workspace_gid") || "");
    try { state.asanaSetup = await marketingRepository.selectAsanaWorkspace(workspace); notify("Workspace do Asana atualizado."); await loadAsanaData(); } catch (error) { notify((error as Error).message, true); } return;
  }
  if ((event.target as HTMLElement).id === "asanaProjectForm") {
    event.preventDefault(); const form = event.target as HTMLFormElement;
    const mappings = [...form.querySelectorAll<HTMLSelectElement>("[data-asana-hotel]")].map((select) => ({ hotel_id: select.dataset.asanaHotel || "", project_gid: select.value || null }));
    try { state.asanaSetup = await marketingRepository.saveAsanaProjects(mappings); notify("Projetos das unidades atualizados."); await loadAsanaData(); } catch (error) { notify((error as Error).message, true); } return;
  }
  if ((event.target as HTMLElement).id === "plannerUserForm") {
    event.preventDefault(); const form = event.target as HTMLFormElement; const dialog = form.closest<HTMLDialogElement>("dialog")!; const data = new FormData(form);
    const input = { display_name: String(data.get("display_name") || ""), email: String(data.get("email") || ""), access_level: String(data.get("access_level") || "editor"), status: String(data.get("status") || "active"), password: String(data.get("password") || "") };
    try { dialog.dataset.userId ? await plannerRequest(`/user-management/${encodeURIComponent(dialog.dataset.userId)}`, "PATCH", input) : await plannerRequest("/user-management", "POST", input); dialog.close(); await loadManagedUsers(); notify("Usuário salvo."); } catch (error) { notify((error as Error).message, true); } return;
  }
  if ((event.target as HTMLElement).id === "plannerPasswordForm") {
    event.preventDefault(); const form = event.target as HTMLFormElement; const dialog = form.closest<HTMLDialogElement>("dialog")!; const password = String(new FormData(form).get("password") || "");
    try { await plannerRequest(`/user-management/${encodeURIComponent(dialog.dataset.userId || "")}/password`, "PATCH", { password }); dialog.close(); notify("Senha redefinida e sessões anteriores encerradas."); } catch (error) { notify((error as Error).message, true); } return;
  }
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
document.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector<HTMLInputElement>("#globalPlannerSearch")?.focus(); } if (event.key === "Escape" && (state.drawer || state.visitDrawer || state.postDrawer || state.asanaTaskDrawer)) closeDrawer(); if ((event.key === "Enter" || event.key === " ") && (event.target as HTMLElement).matches(".story-card")) { event.preventDefault(); const id = (event.target as HTMLElement).dataset.storyId; if (id) void repository.story(id).then(openDrawer).catch((error) => notify((error as Error).message, true)); } });
document.addEventListener("dragstart", (event) => {
  const target = event.target as HTMLElement;
  const asanaTask = target.closest<HTMLElement>(".asana-task");
  if (asanaTask?.dataset.asanaTaskId) { event.dataTransfer?.setData("application/x-fioreze-asana", asanaTask.dataset.asanaTaskId); event.dataTransfer!.effectAllowed = "move"; asanaTask.classList.add("dragging"); return; }
  const blog = target.closest<HTMLElement>(".kanban-card"); if (blog) { event.dataTransfer?.setData("application/x-fioreze-blog", blog.dataset.postId || ""); event.dataTransfer!.effectAllowed = "move"; return; }
  const card = target.closest<HTMLElement>(".story-card"); if (!card) return; event.dataTransfer?.setData("text/plain", card.dataset.storyId || ""); event.dataTransfer!.effectAllowed = "move"; card.classList.add("dragging");
});
document.addEventListener("dragend", (event) => { (event.target as HTMLElement).closest<HTMLElement>(".story-card, .asana-task")?.classList.remove("dragging"); document.querySelectorAll(".drag-over").forEach((item) => item.classList.remove("drag-over")); });
document.addEventListener("dragover", (event) => { const cell = (event.target as HTMLElement).closest<HTMLElement>(".day-cell, .kanban-column, .asana-calendar-day"); if (!cell) return; event.preventDefault(); cell.classList.add("drag-over"); });
document.addEventListener("dragleave", (event) => { const cell = (event.target as HTMLElement).closest<HTMLElement>(".day-cell, .kanban-column, .asana-calendar-day"); if (cell && !cell.contains(event.relatedTarget as Node)) cell.classList.remove("drag-over"); });
document.addEventListener("drop", (event) => {
  const element = event.target as HTMLElement;
  const asanaDay = element.closest<HTMLElement>(".asana-calendar-day"); const asanaTaskId = event.dataTransfer?.getData("application/x-fioreze-asana");
  if (asanaDay && asanaTaskId) { event.preventDefault(); asanaDay.classList.remove("drag-over"); void moveAsanaTaskToDate(asanaTaskId, asanaDay.dataset.asanaDate || ""); return; }
  const blogColumn = element.closest<HTMLElement>(".kanban-column"); if (blogColumn) { event.preventDefault(); blogColumn.classList.remove("drag-over"); const id = event.dataTransfer?.getData("application/x-fioreze-blog"), post = state.posts.find((p) => p.id === id); if (post && blogColumn.dataset.blogStatus && post.status !== blogColumn.dataset.blogStatus) { const previous = state.posts.map((p) => ({ ...p })); post.status = blogColumn.dataset.blogStatus as BlogPost["status"]; render(); void marketingRepository.updatePost(post.id, { status: post.status }).then((saved) => { upsertPost(saved); notify("Etapa do artigo atualizada."); }).catch((error) => { state.posts = previous; render(); notify(`Alteração revertida: ${(error as Error).message}`, true); }); } return; }
  const cell = element.closest<HTMLElement>(".day-cell"); if (!cell) return; event.preventDefault(); cell.classList.remove("drag-over"); const id = event.dataTransfer?.getData("text/plain"); const over = element.closest<HTMLElement>(".story-card"); const before = over ? event.clientY < over.getBoundingClientRect().top + over.getBoundingClientRect().height / 2 : false; if (id) void handleDrop(cell, id, over?.dataset.storyId || null, before);
});
document.querySelector<HTMLElement>("#collapseSidebar")!.addEventListener("click", () => document.querySelector("#sidebar")!.classList.toggle("collapsed"));
document.querySelector<HTMLElement>("#openSidebar")!.addEventListener("click", () => document.querySelector("#sidebar")!.classList.toggle("mobile-open"));

const plannerApp = document.querySelector<HTMLElement>("#plannerApp")!;
const plannerLogin = document.querySelector<HTMLElement>("#plannerLogin")!;
const plannerLoginForm = document.querySelector<HTMLFormElement>("#plannerLoginForm")!;
const plannerLoginError = document.querySelector<HTMLElement>("#plannerLoginError")!;

plannerLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); plannerLoginError.hidden = true;
  const submit = plannerLoginForm.querySelector<HTMLButtonElement>("button[type=submit]")!; submit.disabled = true;
  const data = new FormData(plannerLoginForm);
  try {
    const response = await fetch("/api/v1/social-planner/login", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-fioreze-admin-action": "erp-admin" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password"), remember_me: data.get("remember_me") === "on" }) });
    const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Não foi possível entrar.");
    state.session = payload.data as PlannerSession; await initializePlanner();
  } catch (error) { plannerLoginError.textContent = (error as Error).message; plannerLoginError.hidden = false; }
  finally { submit.disabled = false; }
});

document.querySelector<HTMLElement>("#plannerLogout")!.addEventListener("click", async () => {
  if (state.session?.auth_source === "admin-master") { location.assign("/admin/"); return; }
  await fetch("/api/v1/social-planner/logout", { method: "POST", credentials: "same-origin", headers: { "x-fioreze-admin-action": "erp-admin" } });
  state.session = null; plannerApp.hidden = true; plannerLogin.hidden = false; plannerLoginForm.reset();
});

async function start() {
  hydrateIcons(document);
  try {
    const response = await fetch("/api/v1/social-planner/session", { credentials: "same-origin" });
    if (response.status === 401) {
      plannerApp.hidden = true; plannerLogin.hidden = false;
      return;
    }
    const payload = await response.json();
    if (!payload.ok || !payload.data.permissions.includes("social-planner.read")) throw new Error("Acesso ao Marketing Planner não liberado.");
    state.session = payload.data as PlannerSession; await initializePlanner();
  } catch (error) { state.loading = false; main.innerHTML = `<div class="empty-state"><h2>Não foi possível abrir o planner</h2><p>${e((error as Error).message)}</p><a class="button" href="/socialplanner/overview">Tentar novamente</a></div>`; }
}

async function initializePlanner() {
  plannerLogin.hidden = true; plannerApp.hidden = false;
  document.querySelector<HTMLElement>("#currentUser")!.textContent = state.session?.user.display_name || "Marketing";
  document.querySelector<HTMLElement>(".user-avatar")!.textContent = (state.session?.user.display_name || "M").slice(0, 1).toUpperCase();
  document.querySelector<HTMLElement>("#centralAdminLink")!.hidden = state.session?.auth_source !== "admin-master";
  if (state.view === "users" && !state.session?.permissions.includes("social-planner.users.manage")) state.view = "overview";
  [state.hotels, state.categories, state.pillars, state.channels, state.users, state.campaigns, state.sequences, { display_name: state.displayName }, state.calendar] = await Promise.all([repository.hotels(), repository.categories(), repository.pillars(), repository.channels(), repository.users(), repository.campaigns(), repository.sequences(), marketingRepository.settings(), marketingRepository.calendarStatus()]);
  document.querySelector<HTMLElement>("#plannerName")!.textContent = state.displayName; document.title = state.displayName;
  if (state.view === "users") await loadManagedUsers(); else if (state.view === "asana-calendar") await loadAsanaData(); else await loadData();
  if (params.get("calendar") === "connected") notify("Google Calendar conectado à sua conta.");
  if (params.get("calendar") === "error") notify("Não foi possível concluir a conexão com o Google Calendar.", true);
  if (params.get("asana") === "connected") notify("Asana conectado à sua conta.");
  if (params.get("asana") === "error") notify("Não foi possível concluir a conexão com o Asana.", true);
  if (planningAlerts()) notify(`${planningAlerts()} Story(s) de hoje ainda estão como Ideia.`);
}
void start();
