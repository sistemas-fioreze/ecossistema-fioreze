// social-planner/repository.ts
var base = "/api/v1/social-planner";
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
  channels: () => request("/channels"),
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
  story: (id) => request(`/stories/${encodeURIComponent(id)}`),
  create: (input) => request("/stories", "POST", input),
  update: (id, input) => request(`/stories/${encodeURIComponent(id)}`, "PATCH", input),
  remove: (id) => request(`/stories/${encodeURIComponent(id)}`, "DELETE"),
  saveChannels: (id, channels) => request(`/stories/${encodeURIComponent(id)}/channels`, "PATCH", { channels }),
  createCampaign: (input) => request("/campaigns", "POST", input),
  updateCampaign: (id, input) => request(`/campaigns/${encodeURIComponent(id)}`, "PATCH", input),
  createSequence: (title) => request("/sequences", "POST", { title }),
  moveSequence: (id, hotel_id, date) => request(`/sequences/${encodeURIComponent(id)}/move`, "PATCH", { hotel_id, date }),
  duplicateSequence: (id) => request(`/sequences/${encodeURIComponent(id)}/duplicate`, "POST", {})
};

// social-planner/marketing-repository.ts
function range(path, start2, end, filters = {}) {
  const query = new URLSearchParams();
  if (start2 && end) {
    query.set("start_date", start2);
    query.set("end_date", end);
  }
  for (const [key, value] of Object.entries(filters)) if (value && value !== "all") query.set(key, value);
  return `${path}${query.size ? `?${query}` : ""}`;
}
var marketingRepository = {
  settings: () => request("/settings"),
  saveSettings: (display_name) => request("/settings", "PATCH", { display_name }),
  visits: (start2, end, filters = {}) => request(range("/visits", start2, end, filters)),
  visit: (id) => request(`/visits/${encodeURIComponent(id)}`),
  createVisit: (input) => request("/visits", "POST", input),
  updateVisit: (id, input) => request(`/visits/${encodeURIComponent(id)}`, "PATCH", input),
  deleteVisit: (id) => request(`/visits/${encodeURIComponent(id)}`, "DELETE"),
  createItem: (visitId, input) => request(`/visits/${encodeURIComponent(visitId)}/items`, "POST", input),
  updateItem: (visitId, id, input) => request(`/visits/${encodeURIComponent(visitId)}/items/${encodeURIComponent(id)}`, "PATCH", input),
  deleteItem: (visitId, id) => request(`/visits/${encodeURIComponent(visitId)}/items/${encodeURIComponent(id)}`, "DELETE"),
  linkMedia: (visitId, media_asset_id) => request(`/visits/${encodeURIComponent(visitId)}/media`, "POST", { media_asset_id }),
  unlinkMedia: (visitId, mediaId) => request(`/visits/${encodeURIComponent(visitId)}/media/${encodeURIComponent(mediaId)}`, "DELETE"),
  calendarStatus: () => request("/calendar/status"),
  connectCalendar: () => request("/calendar/google/connect", "POST", {}),
  disconnectCalendar: () => request("/calendar/google/connection", "DELETE"),
  syncVisitCalendar: (visitId) => request(`/visits/${encodeURIComponent(visitId)}/calendar-sync`, "POST", {}),
  asanaSetup: () => request("/asana/setup"),
  connectAsana: () => request("/asana/connect", "POST", {}),
  disconnectAsana: () => request("/asana/connection", "DELETE"),
  selectAsanaWorkspace: (workspace_gid) => request("/asana/workspace", "PATCH", { workspace_gid }),
  saveAsanaProjects: (mappings) => request("/asana/projects", "PATCH", { mappings }),
  asanaTasks: (start2, end, hotelId = "all") => request(range("/asana/tasks", start2, end, { hotel_id: hotelId })),
  asanaTask: (id) => request(`/asana/tasks/${encodeURIComponent(id)}`),
  updateAsanaTask: (id, input) => request(`/asana/tasks/${encodeURIComponent(id)}`, "PATCH", input),
  posts: (start2, end, filters = {}) => request(range("/blog-posts", start2, end, filters)),
  post: (id) => request(`/blog-posts/${encodeURIComponent(id)}`),
  createPost: (input) => request("/blog-posts", "POST", input),
  updatePost: (id, input) => request(`/blog-posts/${encodeURIComponent(id)}`, "PATCH", input),
  deletePost: (id) => request(`/blog-posts/${encodeURIComponent(id)}`, "DELETE")
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

// social-planner/marketing-ui.ts
function inputField(name, label, value, kind = "text", full = false, required = false) {
  return `<label class="${full ? "full" : ""}"><span>${label}${required ? " *" : ""}</span>${kind === "textarea" ? `<textarea name="${name}" ${required ? "required" : ""}>${escapeHtml(value)}</textarea>` : `<input name="${name}" type="${kind}" value="${escapeHtml(value)}" ${required ? "required" : ""}>`}</label>`;
}
function selectField(name, label, value, values, required = false) {
  return `<label><span>${label}${required ? " *" : ""}</span><select name="${name}" ${required ? "required" : ""}>${option("", required ? "Selecione" : "N\xE3o definido", value || "")}${values.map((item) => option(item.id, item.name, value || "")).join("")}</select></label>`;
}
function formValues(form, keys) {
  const data = new FormData(form);
  const result = {};
  for (const key of keys) result[key] = String(data.get(key) || "").trim() || null;
  return result;
}
function heading(eyebrow, title, subtitle, action, label) {
  return `<div class="page-heading"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(subtitle)}</p></div><button class="button primary" data-action="${action}">+ ${escapeHtml(label)}</button></div>`;
}

// social-planner/blog.ts
var blogLabels = { idea: "Ideia", briefing: "Pauta", writing: "Redigindo", review: "Em revis\xE3o", ready: "Pronto", scheduled: "Agendado", published: "Publicado", archived: "Arquivado" };
function filterBar(ctx) {
  const select = (key, label, options) => `<select data-blog-filter="${key}" aria-label="${label}">${option("all", label, ctx.filters[key] || "all")}${options.map((i) => option(i.id, i.name, ctx.filters[key] || "all")).join("")}</select>`;
  return `<div class="filter-panel">${select("hotel_id", "Todos os hot\xE9is", ctx.hotels)}${select("status", "Todos os status", Object.entries(blogLabels).map(([id, name]) => ({ id, name })))}${select("category_id", "Todas as categorias", ctx.categories)}${select("author_user_id", "Todos os autores", ctx.users)}${select("campaign_id", "Todas as campanhas", ctx.campaigns)}</div>`;
}
function postButton(post) {
  return `<button class="blog-row" data-post-id="${escapeHtml(post.id)}"><span>${escapeHtml(post.planned_publish_date || "Sem data")}</span><strong>${escapeHtml(post.title)}</strong><span>${escapeHtml(post.hotel_name || "Toda a rede")}</span><span>${escapeHtml(post.author_name || "Sem autor")}</span><span class="status-pill" data-status="${post.status}">${blogLabels[post.status]}</span></button>`;
}
function blogView(ctx) {
  const posts = ctx.posts.filter((p) => Object.entries(ctx.filters).every(([key, value]) => !value || value === "all" || String(p[key] || "") === value));
  if (ctx.view === "blog-ideas") {
    const statuses = Object.entries(blogLabels).filter(([key]) => key !== "archived");
    return `${heading("Blog", "Pautas", "Arraste artigos entre etapas do fluxo editorial.", "new-post", "Nova pauta")}${filterBar(ctx)}<div class="blog-kanban">${statuses.map(([status, label]) => {
      const group = posts.filter((p) => p.status === status);
      return `<section class="kanban-column" data-blog-status="${status}"><h2>${label} <small>${group.length}</small></h2>${group.map((p) => `<button class="kanban-card" draggable="true" data-post-id="${escapeHtml(p.id)}"><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(p.planned_publish_date || "Sem data")} \xB7 ${escapeHtml(p.hotel_name || "Toda a rede")}</small></button>`).join("")}${!group.length ? '<p class="subtle">Nenhum artigo.</p>' : ""}</section>`;
    }).join("")}</div>`;
  }
  if (ctx.view === "blog-published") {
    const published = posts.filter((p) => p.status === "published");
    return `${heading("Blog", "Publicados", "Artigos publicados e seus links.", "new-post", "Novo artigo")}${filterBar(ctx)}<div class="blog-list">${published.length ? published.map(postButton).join("") : '<div class="empty-state"><h2>Nenhum artigo publicado neste filtro.</h2></div>'}</div>`;
  }
  const d = fromIso(ctx.day), month = d.getMonth(), first = isoDate(new Date(d.getFullYear(), month, 1));
  const scheduled = posts.filter((p) => p.planned_publish_date && p.planned_publish_date.slice(0, 7) === first.slice(0, 7));
  const toolbar = `<div class="heading-actions"><button class="button" data-action="blog-prev-month">M\xEAs anterior</button><strong>${escapeHtml(dateLabel(first, { month: "long", year: "numeric" }))}</strong><button class="button" data-action="blog-next-month">Pr\xF3ximo m\xEAs</button><button class="button" data-action="blog-list">Lista</button><button class="button" data-action="blog-calendar">Calend\xE1rio</button></div>`;
  if (ctx.mode === "list") return `${heading("Blog", "Cronograma editorial", "Artigos planejados por data de publica\xE7\xE3o.", "new-post", "Novo artigo")}${toolbar}${filterBar(ctx)}<div class="blog-list"><div class="blog-row blog-table-head"><span>Data</span><strong>T\xEDtulo</strong><span>Hotel</span><span>Autor</span><span>Status</span></div>${scheduled.length ? scheduled.map(postButton).join("") : '<div class="empty-state"><h2>Sem artigos neste m\xEAs.</h2><p>Crie uma pauta ou navegue para outro m\xEAs.</p></div>'}</div>`;
  const start2 = addDays(first, -(new Date(d.getFullYear(), month, 1).getDay() + 6) % 7);
  return `${heading("Blog", "Cronograma editorial", "Visualiza\xE7\xE3o mensal das publica\xE7\xF5es.", "new-post", "Novo artigo")}${toolbar}${filterBar(ctx)}<div class="calendar-grid">${["Seg", "Ter", "Qua", "Qui", "Sex", "S\xE1b", "Dom"].map((s) => `<div class="calendar-weekday">${s}</div>`).join("")}${Array.from({ length: 42 }, (_, i) => {
    const day = addDays(start2, i), items = scheduled.filter((p) => p.planned_publish_date === day);
    return `<div class="calendar-day ${fromIso(day).getMonth() !== month ? "outside" : ""}"><div class="calendar-date ${day === ctx.today ? "today" : ""}">${day.slice(-2)}</div>${items.map((p) => `<button class="calendar-story" data-post-id="${escapeHtml(p.id)}">${escapeHtml(p.title)}</button>`).join("")}</div>`;
  }).join("")}</div>`;
}
function blogDrawer(post, ctx) {
  const statuses = Object.entries(blogLabels).map(([id, name]) => ({ id, name }));
  return `<div class="drawer-header"><div><small>${post ? "Editar artigo" : "Nova pauta"}</small><h2 id="drawerTitle">${escapeHtml(post?.title || "Planejar artigo")}</h2></div><button class="icon-button" data-action="close-drawer" aria-label="Fechar">\xD7</button></div><form id="blogForm"><div class="drawer-body"><section class="drawer-section"><h3>Planejamento</h3><div class="form-grid">${inputField("title", "T\xEDtulo", post?.title, "text", true, true)}${inputField("slug", "Slug", post?.slug, "text", true, true)}${inputField("planned_publish_date", "Data prevista", post?.planned_publish_date || ctx.today, "date")}${selectField("status", "Status", post?.status || "idea", statuses, true)}${selectField("category_id", "Categoria", post?.category_id, ctx.categories)}${selectField("hotel_id", "Hotel", post?.hotel_id, ctx.hotels)}${selectField("campaign_id", "Campanha", post?.campaign_id, ctx.campaigns)}${selectField("author_user_id", "Autor", post?.author_user_id, ctx.users)}</div></section><section class="drawer-section"><h3>SEO</h3><div class="form-grid">${inputField("main_keyword", "Palavra-chave principal", post?.main_keyword)}${inputField("secondary_keywords", "Palavras-chave secund\xE1rias", post?.secondary_keywords, "textarea", true)}${inputField("meta_description", "Meta description", post?.meta_description, "textarea", true)}</div></section><section class="drawer-section"><h3>Conte\xFAdo</h3><div class="form-grid">${inputField("briefing", "Briefing", post?.briefing, "textarea", true)}${inputField("summary", "Resumo", post?.summary, "textarea", true)}${inputField("notes", "Observa\xE7\xF5es", post?.notes, "textarea", true)}</div></section><section class="drawer-section"><h3>Publica\xE7\xE3o</h3><div class="form-grid">${inputField("published_url", "URL publicada", post?.published_url, "url", true)}</div></section><div id="deleteConfirm"></div></div><div class="drawer-actions">${post ? '<button type="button" class="button" data-action="duplicate-post">Duplicar</button><button type="button" class="button" data-action="archive-post">Arquivar</button><button type="button" class="button danger" data-action="delete-post">Excluir</button>' : ""}<button type="submit" class="button primary">Salvar artigo</button></div></form>`;
}
function blogFormInput(form) {
  return formValues(form, ["title", "slug", "summary", "briefing", "category_id", "hotel_id", "campaign_id", "author_user_id", "main_keyword", "secondary_keywords", "meta_description", "planned_publish_date", "status", "published_url", "notes"]);
}

// social-planner/visits.ts
var visitLabels = { planned: "Planejada", confirmed: "Confirmada", in_progress: "Em andamento", completed: "Conclu\xEDda", cancelled: "Cancelada" };
function visitCard(visit) {
  return `<button class="visit-card" data-visit-id="${escapeHtml(visit.id)}"><span class="visit-time">${escapeHtml(visit.start_time || "Hor\xE1rio livre")}${visit.end_time ? `\u2013${escapeHtml(visit.end_time)}` : ""}</span><strong>${escapeHtml(visit.hotel_name)}</strong><span>${escapeHtml(visit.title)}</span><small>${escapeHtml(visit.responsible_names || visit.responsible_name || "Sem respons\xE1veis")} \xB7 ${visitLabels[visit.status]}</small>${visit.item_count ? `<small>Checklist ${visit.completed_item_count}/${visit.item_count}</small>` : ""}</button>`;
}
function filterBar2(ctx) {
  return `<div class="filter-panel"><select data-visit-filter="hotel" aria-label="Filtrar hotel">${option("all", "Todos os hot\xE9is", ctx.filter)}${ctx.hotels.map((h) => option(h.id, h.short_name, ctx.filter)).join("")}</select></div>`;
}
function visitsView(ctx) {
  const selected = ctx.visits.filter((v) => ctx.filter === "all" || v.hotel_id === ctx.filter);
  if (ctx.view === "visits-history") {
    const completed = selected.filter((v) => v.status === "completed" || v.status === "cancelled" || v.date < ctx.today);
    return `${heading("Agenda de hot\xE9is", "Hist\xF3rico", "Visitas anteriores e seus checklists.", "new-visit", "Nova visita")}<div class="heading-actions"><button class="button" data-action="visits-older">90 dias anteriores</button><span class="subtle">At\xE9 ${escapeHtml(ctx.day)}</span><button class="button" data-action="visits-newer" ${ctx.day >= ctx.today ? "disabled" : ""}>90 dias seguintes</button></div>${filterBar2(ctx)}<div class="section-card"><div class="pending-list">${completed.length ? completed.map((v) => `<button class="pending-row" data-visit-id="${escapeHtml(v.id)}"><strong>${escapeHtml(v.title)}</strong><small>${escapeHtml(v.hotel_name)}</small><small>${escapeHtml(v.date)}</small><span>${visitLabels[v.status]}</span></button>`).join("") : '<p class="subtle">Nenhuma visita no per\xEDodo.</p>'}</div></div>`;
  }
  if (ctx.view === "visits-calendar") {
    const d = fromIso(ctx.day), month = d.getMonth(), first = isoDate(new Date(d.getFullYear(), month, 1));
    const start2 = addDays(first, -(new Date(d.getFullYear(), month, 1).getDay() + 6) % 7);
    return `${heading("Agenda de hot\xE9is", "Calend\xE1rio de visitas", dateLabel(first, { month: "long", year: "numeric" }), "new-visit", "Nova visita")}<div class="heading-actions"><button class="button" data-action="visits-prev-month">M\xEAs anterior</button><button class="button" data-action="visits-next-month">Pr\xF3ximo m\xEAs</button></div>${filterBar2(ctx)}<div class="calendar-grid">${["Seg", "Ter", "Qua", "Qui", "Sex", "S\xE1b", "Dom"].map((s) => `<div class="calendar-weekday">${s}</div>`).join("")}${Array.from({ length: 42 }, (_, i) => {
      const date = addDays(start2, i);
      const items = selected.filter((v) => v.date === date);
      return `<div class="calendar-day ${fromIso(date).getMonth() !== month ? "outside" : ""}"><div class="calendar-date ${date === ctx.today ? "today" : ""}">${date.slice(-2)}</div>${items.map((v) => `<button class="calendar-story" data-visit-id="${escapeHtml(v.id)}">${escapeHtml(v.start_time || "")} ${escapeHtml(v.hotel_name)} \xB7 ${escapeHtml(v.title)}</button>`).join("")}</div>`;
    }).join("")}</div>`;
  }
  return `${heading("Agenda de hot\xE9is", "Semana de capta\xE7\xE3o", "Visitas, respons\xE1veis e objetivos em uma \xFAnica agenda.", "new-visit", "Nova visita")}<div class="heading-actions"><button class="button" data-action="visits-prev-week">Semana anterior</button><strong>${escapeHtml(dateLabel(ctx.week, { day: "2-digit", month: "short" }))} \u2014 ${escapeHtml(dateLabel(addDays(ctx.week, 6), { day: "2-digit", month: "short" }))}</strong><button class="button" data-action="visits-next-week">Pr\xF3xima semana</button><button class="button" data-action="visits-today">Hoje</button></div>${filterBar2(ctx)}<div class="visit-week">${Array.from({ length: 7 }, (_, i) => {
    const day = addDays(ctx.week, i), items = selected.filter((v) => v.date === day);
    return `<section class="visit-day ${day === ctx.today ? "today" : ""}"><h2>${escapeHtml(dateLabel(day, { weekday: "long", day: "2-digit", month: "short" }))}</h2>${items.length ? items.map(visitCard).join("") : '<p class="subtle">Sem visita planejada.</p>'}<button class="cell-add" data-action="new-visit-day" data-date="${day}">+ Agendar visita</button></section>`;
  }).join("")}</div>`;
}
function visitDrawer(visit, ctx, createDate) {
  const statuses = Object.entries(visitLabels).map(([id, name]) => ({ id, name }));
  const priorities = [{ id: "low", name: "Baixa" }, { id: "normal", name: "Normal" }, { id: "high", name: "Alta" }, { id: "urgent", name: "Urgente" }];
  const items = visit?.items || [];
  const selected = new Set(visit?.responsible_user_ids || []);
  const assignees = `<fieldset class="assignee-picker"><legend>Respons\xE1veis</legend><p class="drawer-hint">A visita entra na agenda conectada de cada pessoa selecionada.</p><div class="assignee-grid">${ctx.users.map((user) => `<label><input type="checkbox" name="responsible_user_ids" value="${escapeHtml(user.id)}" ${selected.has(user.id) ? "checked" : ""}><span>${escapeHtml(user.name)}</span></label>`).join("") || '<p class="subtle">Nenhum usu\xE1rio ativo.</p>'}</div></fieldset>`;
  const calendarRows = (visit?.calendar_events || []).map((event) => `<li><span><strong>${escapeHtml(event.user_name)}</strong><small>${escapeHtml(event.last_synced_at ? `Atualizado em ${new Date(event.last_synced_at).toLocaleString("pt-BR")}` : "Aguardando sincroniza\xE7\xE3o")}</small></span><span class="calendar-sync-status ${escapeHtml(event.sync_status)}">${escapeHtml(event.sync_status === "synced" ? "Sincronizado" : event.sync_status === "failed" ? "Falhou" : event.sync_status === "removed" ? "Removido" : "Pendente")}</span>${event.last_error ? `<small class="calendar-error">${escapeHtml(event.last_error)}</small>` : ""}</li>`).join("");
  const calendar = visit ? `<section class="drawer-section"><div class="section-heading"><div><h3>Agendas dos respons\xE1veis</h3><p class="drawer-hint">Somente usu\xE1rios com Google Calendar conectado recebem o evento.</p></div><button type="button" class="button" data-action="sync-visit-calendar">Sincronizar agora</button></div>${calendarRows ? `<ul class="calendar-sync-list">${calendarRows}</ul>` : '<p class="subtle">Nenhuma agenda sincronizada ainda.</p>'}</section>` : "";
  return `<div class="drawer-header"><div><small>${visit ? "Editar visita" : "Nova visita"}</small><h2 id="drawerTitle">${escapeHtml(visit?.title || "Agendar capta\xE7\xE3o")}</h2></div><button class="icon-button" data-action="close-drawer" aria-label="Fechar">\xD7</button></div><form id="visitForm"><div class="drawer-body"><section class="drawer-section"><h3>Planejamento</h3><div class="form-grid">${inputField("title", "Objetivo principal / t\xEDtulo", visit?.title, "text", true, true)}${selectField("hotel_id", "Hotel", visit?.hotel_id, ctx.hotels, true)}${inputField("date", "Data", visit?.date || createDate, "date", false, true)}${inputField("start_time", "In\xEDcio", visit?.start_time, "time")}${inputField("end_time", "T\xE9rmino", visit?.end_time, "time")}${selectField("status", "Status", visit?.status || "planned", statuses, true)}${selectField("priority", "Prioridade", visit?.priority || "normal", priorities, true)}${selectField("campaign_id", "Campanha", visit?.campaign_id, ctx.campaigns)}</div>${assignees}</section><section class="drawer-section"><h3>Detalhes</h3><div class="form-grid">${inputField("description", "Descri\xE7\xE3o", visit?.description, "textarea", true)}${inputField("notes", "Observa\xE7\xF5es", visit?.notes, "textarea", true)}</div></section>${calendar}${visit ? `<section class="drawer-section"><h3>Checklist de capta\xE7\xE3o <span class="subtle">${visit.completed_item_count}/${visit.item_count}</span></h3><div class="visit-checklist">${items.map((item) => `<div class="checklist-row"><label><input type="checkbox" data-item-toggle="${escapeHtml(item.id)}" ${item.completed ? "checked" : ""}><span>${escapeHtml(item.title)}</span></label><small>${escapeHtml(item.content_type || "")}${item.required ? " \xB7 Necess\xE1rio" : ""}</small><button type="button" class="icon-button" data-action="delete-visit-item" data-item-id="${escapeHtml(item.id)}" aria-label="Excluir item">\xD7</button></div>`).join("") || '<p class="subtle">Adicione o que precisa ser captado.</p>'}</div><div class="form-grid compact">${inputField("new_item_title", "Novo item", "", "text", true)}${inputField("new_item_type", "Tipo de conte\xFAdo", "")}${selectField("new_item_category", "Categoria", null, ctx.categories)}</div><button type="button" class="button" data-action="add-visit-item">+ Adicionar item</button></section><section class="drawer-section"><h3>M\xEDdias captadas</h3><div class="visit-media">${(visit.media_assets || []).map((asset) => `<div class="media-link"><a href="${escapeHtml(asset.public_url)}" target="_blank" rel="noopener">${escapeHtml(asset.alt_text || asset.id)}</a><button type="button" class="icon-button" data-action="unlink-visit-media" data-media-id="${escapeHtml(asset.id)}" aria-label="Remover v\xEDnculo">\xD7</button></div>`).join("") || '<p class="subtle">Nenhuma m\xEDdia vinculada.</p>'}</div>${inputField("new_media_id", "ID da m\xEDdia existente", "", "text", true)}<button type="button" class="button" data-action="link-visit-media">Vincular m\xEDdia</button></section>` : '<p class="drawer-hint">Salve a visita para criar o checklist e vincular m\xEDdias.</p>'}<div id="deleteConfirm"></div></div><div class="drawer-actions">${visit ? '<button type="button" class="button danger" data-action="delete-visit">Excluir</button>' : ""}<button type="submit" class="button primary">Salvar visita</button></div></form>`;
}
function visitFormInput(form) {
  const input = formValues(form, ["hotel_id", "date", "start_time", "end_time", "title", "description", "status", "priority", "campaign_id", "notes"]);
  input.responsible_user_ids = new FormData(form).getAll("responsible_user_ids").map(String);
  return input;
}

// social-planner/overview.ts
function overviewView(stories, visits, posts, hotels, today2, week) {
  const weekEnd = addDays(week, 6);
  const weekStories = stories.filter((s) => s.date >= week && s.date <= weekEnd);
  const weekVisits = visits.filter((v) => v.date >= week && v.date <= weekEnd);
  const weekPosts = posts.filter((p) => p.planned_publish_date && p.planned_publish_date >= week && p.planned_publish_date <= weekEnd);
  const duePosts = posts.filter((p) => p.planned_publish_date && p.planned_publish_date >= today2 && p.planned_publish_date <= addDays(today2, 7) && p.status !== "published" && p.status !== "archived");
  const nextVisit = visits.filter((v) => v.date >= today2 && v.status !== "cancelled" && v.status !== "completed").sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || "").localeCompare(b.start_time || ""))[0];
  const todayStories = stories.filter((s) => s.date === today2 && s.status !== "cancelled");
  const actions = [];
  for (const s of todayStories.filter((s2) => !s2.media_asset_id && s2.status !== "published")) actions.push({ title: "Story de hoje sem m\xEDdia", detail: s.title, view: "pending" });
  for (const s of todayStories.filter((s2) => s2.status === "idea")) actions.push({ title: "Story de hoje ainda \xE9 ideia", detail: s.title, view: "week" });
  for (const hotel of hotels) {
    const upcoming = stories.filter((s) => s.hotel_id === hotel.id && s.date >= today2 && s.date <= addDays(today2, 2) && s.status !== "cancelled").length;
    if (!upcoming) actions.push({ title: "Hotel sem Stories nos pr\xF3ximos 3 dias", detail: hotel.short_name, view: "week" });
  }
  for (const v of visits.filter((v2) => v2.date === today2 && v2.status !== "cancelled" && v2.status !== "completed")) actions.push({ title: "Visita marcada para hoje", detail: `${v.hotel_name} \xB7 ${v.start_time || "Hor\xE1rio livre"}`, view: "visits-week" });
  for (const v of visits.filter((v2) => v2.date <= addDays(today2, 1) && v2.date >= today2 && v2.item_count > v2.completed_item_count && v2.status !== "cancelled")) actions.push({ title: "Checklist de visita incompleto", detail: `${v.hotel_name} \xB7 ${v.completed_item_count}/${v.item_count}`, view: "visits-week" });
  for (const p of posts.filter((p2) => p2.status === "review")) actions.push({ title: "Artigo aguardando revis\xE3o", detail: p.title, view: "blog-ideas" });
  for (const p of duePosts) actions.push({ title: "Publica\xE7\xE3o do blog pr\xF3xima", detail: `${p.title} \xB7 ${p.planned_publish_date}`, view: "blog-schedule" });
  const stat = (title, value, detail) => `<div class="metric"><small>${escapeHtml(title)}</small><strong>${escapeHtml(value)}</strong><span class="subtle">${escapeHtml(detail)}</span></div>`;
  return `<div class="page-heading"><div><p class="eyebrow">Fioreze Marketing Planner</p><h1>Vis\xE3o geral</h1><p class="subtle">O que precisa de aten\xE7\xE3o no Marketing da Rede Fioreze.</p></div></div><h2 class="section-title">Hoje</h2><div class="overview-metrics">${stat("Stories", String(todayStories.length), `${todayStories.filter((s) => s.status !== "published" && s.status !== "ready").length} ainda pendentes`)}${stat("Pr\xF3xima visita", nextVisit ? nextVisit.hotel_name : "\u2014", nextVisit ? `${nextVisit.date} \xB7 ${nextVisit.item_count - nextVisit.completed_item_count} tarefas abertas` : "Nenhuma visita pr\xF3xima")}${stat("Blog nos pr\xF3ximos 7 dias", String(duePosts.length), `${posts.filter((p) => p.status === "review").length} em revis\xE3o`)}</div><h2 class="section-title">Esta semana</h2><div class="overview-metrics">${stat("Stories", `${weekStories.length} / ${weekStories.filter((s) => s.status === "published").length}`, "planejados / publicados")}${stat("Visitas", `${weekVisits.length} / ${weekVisits.filter((v) => v.status === "completed").length}`, "planejadas / realizadas")}${stat("Artigos", `${weekPosts.length} / ${weekPosts.filter((p) => p.status === "published").length}`, "planejados / publicados")}</div><section class="section-card"><h2>Pr\xF3ximas a\xE7\xF5es <span class="subtle">${actions.length}</span></h2><div class="action-list">${actions.length ? actions.slice(0, 20).map((a) => `<button class="action-row" data-view="${a.view}"><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.detail)}</span><span aria-hidden="true">\u2192</span></button>`).join("") : '<p class="subtle">Nenhuma a\xE7\xE3o urgente neste per\xEDodo.</p>'}</div></section>`;
}

// social-planner/asana.ts
function asanaCalendarView(context) {
  const setup = context.setup;
  const heading2 = `<div class="page-heading"><div><p class="eyebrow">Integra\xE7\xF5es</p><h1>Calend\xE1rio do Asana</h1><p class="subtle">Tarefas das unidades organizadas no calend\xE1rio de marketing.</p></div></div>`;
  if (!setup?.configured) return `${heading2}${connectionState("Configura\xE7\xE3o pendente", "Cadastre o aplicativo OAuth do Asana para liberar a conex\xE3o individual de cada usu\xE1rio.", false)}`;
  if (!setup.connected) return `${heading2}${connectionState("Conecte sua conta do Asana", "Cada usu\xE1rio autoriza a pr\xF3pria conta. O Planner nunca recebe sua senha e respeita exatamente os projetos que voc\xEA pode acessar.", true)}`;
  const focus = fromIso(context.day);
  const monthStart = isoDate(new Date(focus.getFullYear(), focus.getMonth(), 1));
  const monthEnd = isoDate(new Date(focus.getFullYear(), focus.getMonth() + 1, 0));
  const gridStart = weekStart(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const monthName = dateLabel(monthStart, { month: "long", year: "numeric" });
  const mappedCount = setup.units.filter((unit) => unit.project_gid).length;
  const calendar = days.map((day) => {
    const inside = day >= monthStart && day <= monthEnd;
    const tasks = context.tasks.filter((task) => task.start_date && task.end_date && day >= task.start_date && day <= task.end_date);
    const visible = tasks.slice(0, 3);
    const taskItems = visible.map((task) => `<button class="asana-task ${task.completed ? "completed" : ""}" type="button" data-action="open-asana-task" data-asana-task-id="${escapeHtml(task.gid)}" data-hotel="${escapeHtml(task.hotel_id)}" ${context.canManage ? 'draggable="true"' : ""} title="${escapeHtml(`${task.project_name} \xB7 ${task.name}`)}"><span>${escapeHtml(task.name)}</span>${task.assignee_name ? `<small>${escapeHtml(task.assignee_name)}</small>` : ""}</button>`).join("");
    const more = tasks.length > visible.length ? `<span class="asana-task-more">+${tasks.length - visible.length} tarefas</span>` : "";
    return `<div class="asana-calendar-day ${inside ? "" : "outside"} ${day === context.today ? "today" : ""}" data-asana-date="${day}"><time datetime="${day}">${Number(day.slice(-2))}</time><div class="asana-day-tasks">${taskItems}${more}</div></div>`;
  }).join("");
  const unitOptions = context.hotels.filter((hotel) => setup.units.some((unit) => unit.hotel_id === hotel.id)).map((hotel) => option(hotel.id, hotel.short_name, context.hotelFilter)).join("");
  const mappingRows = setup.units.map((unit) => `<label class="asana-mapping-row"><span><strong>${escapeHtml(unit.expected_project_name)}</strong><small>${unit.project_gid ? "Projeto conectado" : "Projeto ainda n\xE3o localizado"}</small></span><select data-asana-hotel="${escapeHtml(unit.hotel_id)}"><option value="">N\xE3o vinculado</option>${setup.projects.map((project) => option(project.gid, project.name, unit.project_gid || "")).join("")}</select></label>`).join("");
  const workspaceOptions = setup.workspaces.map((workspace) => option(workspace.gid, workspace.name, setup.connection?.workspace_gid || "")).join("");
  const permission = setup.can_manage_tasks ? "" : `<section class="asana-permission-notice"><i data-lucide="pencil-line" aria-hidden="true"></i><div><strong>Libere a edi\xE7\xE3o das tarefas</strong><p>Reconecte sua conta uma vez para editar detalhes e mover tarefas pelo calend\xE1rio.</p></div><button class="button primary" type="button" data-action="connect-asana">Reconectar</button></section>`;
  const integration = `<details class="asana-integration"><summary><span><strong>${escapeHtml(setup.connection?.account_name || setup.connection?.account_email || "Conta Asana")}</strong><small>${escapeHtml(setup.connection?.workspace_name || "Selecione o workspace")} \xB7 ${mappedCount}/6 unidades conectadas</small></span><i data-lucide="chevron-down" aria-hidden="true"></i></summary><div class="asana-integration-body">${setup.error ? `<p class="calendar-error">${escapeHtml(setup.error)}</p>` : ""}<form id="asanaWorkspaceForm" class="asana-workspace-form"><label><span>Workspace</span><select name="workspace_gid" required>${workspaceOptions}</select></label><button class="button" type="submit">Usar workspace</button></form><form id="asanaProjectForm" class="asana-mapping-list"><div class="section-heading"><div><h2>Projetos das unidades</h2><p class="subtle">Os nomes oficiais s\xE3o reconhecidos automaticamente. Ajuste somente quando o projeto usar outro nome no Asana.</p></div></div>${mappingRows}<div class="asana-mapping-actions"><button class="button primary" type="submit">Salvar v\xEDnculos</button><button class="button danger" type="button" data-action="disconnect-asana">Desconectar Asana</button></div></form></div></details>`;
  const toolbar = `<div class="asana-calendar-toolbar"><div class="asana-calendar-title"><button class="icon-button" type="button" data-action="asana-prev-month" aria-label="M\xEAs anterior"><i data-lucide="chevron-left"></i></button><h2>${escapeHtml(monthName)}</h2><button class="icon-button" type="button" data-action="asana-next-month" aria-label="Pr\xF3ximo m\xEAs"><i data-lucide="chevron-right"></i></button><button class="button" type="button" data-action="asana-today">Hoje</button></div><label class="asana-unit-filter"><span>Unidade</span><select id="asanaHotelFilter"><option value="all">Todas as unidades</option>${unitOptions}</select></label></div>`;
  return `${heading2}${permission}${integration}<section class="asana-calendar-shell">${toolbar}<div class="asana-weekdays">${["Seg", "Ter", "Qua", "Qui", "Sex", "S\xE1b", "Dom"].map((label) => `<span>${label}</span>`).join("")}</div><div class="asana-calendar-grid">${calendar}</div></section>`;
}
function connectionState(title, description, canConnect) {
  return `<section class="asana-connect-state"><span class="asana-connect-icon"><i data-lucide="calendar-days" aria-hidden="true"></i></span><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>${canConnect ? '<button class="button primary" type="button" data-action="connect-asana">Conectar com o Asana</button>' : ""}</section>`;
}

// social-planner/app.ts
var views = { overview: "Vis\xE3o Geral", week: "Redes \xB7 Semana", calendar: "Redes \xB7 Calend\xE1rio", pending: "Redes \xB7 Pend\xEAncias", "asana-calendar": "Calend\xE1rio do Asana", "visits-week": "Visitas \xB7 Semana", "visits-calendar": "Visitas \xB7 Calend\xE1rio", "visits-history": "Visitas \xB7 Hist\xF3rico", "blog-schedule": "Blog \xB7 Cronograma", "blog-ideas": "Blog \xB7 Pautas", "blog-published": "Blog \xB7 Publicados", campaigns: "Campanhas", assets: "Banco de conte\xFAdos", hotels: "Hot\xE9is", categories: "Categorias", performance: "Desempenho", users: "Usu\xE1rios", settings: "Configura\xE7\xF5es" };
var today = isoDate(/* @__PURE__ */ new Date());
var CAMPAIGN_TIMELINE_DAYS = 35;
var params = new URLSearchParams(location.search);
var initialWeek = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") || "") ? params.get("week") : today;
var state = {
  view: location.pathname.split("/").filter(Boolean).at(-1) || "week",
  week: weekStart(initialWeek),
  day: /^\d{4}-\d{2}-\d{2}$/.test(params.get("day") || "") ? params.get("day") : today,
  filters: { hotel_id: params.get("hotel") || "all", status: params.get("status") || "all", category_id: params.get("category") || "all", responsible_user_id: params.get("responsible") || "all", campaign_id: params.get("campaign") || "all", search: params.get("q") || "" },
  platformFilter: params.get("platform") || "all",
  campaignStart: /^\d{4}-\d{2}-\d{2}$/.test(params.get("campaign_start") || "") ? weekStart(params.get("campaign_start")) : weekStart(today),
  hotels: [],
  categories: [],
  pillars: [],
  channels: [],
  users: [],
  campaigns: [],
  sequences: [],
  stories: [],
  visits: [],
  posts: [],
  displayName: "Fioreze Marketing Planner",
  visitFilter: params.get("visit_hotel") || "all",
  blogFilters: { hotel_id: params.get("blog_hotel") || "all", status: params.get("blog_status") || "all", category_id: params.get("blog_category") || "all", author_user_id: params.get("blog_author") || "all", campaign_id: params.get("blog_campaign") || "all" },
  blogMode: "list",
  calendar: { provider: "google", configured: false, connected: false, connection: null },
  asanaSetup: null,
  asanaTasks: [],
  asanaTaskDrawer: null,
  asanaHotelFilter: params.get("asana_hotel") || "all",
  session: null,
  managedUsers: [],
  loading: true,
  drawer: null,
  visitDrawer: null,
  postDrawer: null,
  createDate: today,
  createHotel: "",
  saving: false
};
if (!Object.hasOwn(views, state.view)) state.view = "overview";
if (!params.get("day") && (state.day < state.week || state.day > addDays(state.week, 6))) state.day = state.week;
if (state.view === "visits-history" && !params.get("day")) state.day = today;
var main = document.querySelector("#mainContent");
var drawer = document.querySelector("#storyDrawer");
var backdrop = document.querySelector("#drawerBackdrop");
var toast = document.querySelector("#toast");
var toastTimer = 0;
var loadVersion = 0;
function icon(name) {
  const names = {
    calendar: "calendar-days",
    grid: "layout-dashboard",
    check: "check",
    image: "image",
    flag: "pin",
    settings: "settings",
    hotel: "store",
    users: "users",
    tag: "bookmark",
    plus: "plus",
    left: "chevron-left",
    right: "chevron-right",
    alert: "triangle-alert",
    close: "x",
    asana: "calendar-range"
  };
  return `<i data-lucide="${names[name] || "layout-dashboard"}" aria-hidden="true"></i>`;
}
function hydrateIcons(root = document) {
  const lucide = globalThis.FiorezeLucide;
  window.setTimeout(() => lucide?.createIcons({ icons: lucide.icons, root }), 0);
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
  if (view === "visits-history" && state.view !== view) state.day = today;
  state.view = view;
  document.querySelector("#sidebar")?.classList.remove("mobile-open");
  updateUrl();
  if (view === "asana-calendar") void loadAsanaData();
  else if (["week", "calendar", "pending", "overview", "visits-week", "visits-calendar", "visits-history", "blog-schedule", "blog-ideas", "blog-published"].includes(view)) void loadData();
  else if (view === "users") void loadManagedUsers();
  else render();
}
function updateUrl() {
  const query = new URLSearchParams();
  query.set("week", state.week);
  query.set("day", state.day);
  for (const [key, urlKey] of [["hotel_id", "hotel"], ["status", "status"], ["category_id", "category"], ["responsible_user_id", "responsible"], ["campaign_id", "campaign"], ["search", "q"]]) {
    const value = state.filters[key];
    if (value && value !== "all") query.set(urlKey, value);
  }
  if (state.platformFilter !== "all") query.set("platform", state.platformFilter);
  if (state.campaignStart !== weekStart(today)) query.set("campaign_start", state.campaignStart);
  if (state.visitFilter !== "all") query.set("visit_hotel", state.visitFilter);
  if (state.asanaHotelFilter !== "all") query.set("asana_hotel", state.asanaHotelFilter);
  for (const [key, urlKey] of [["hotel_id", "blog_hotel"], ["status", "blog_status"], ["category_id", "blog_category"], ["author_user_id", "blog_author"], ["campaign_id", "blog_campaign"]]) {
    if (state.blogFilters[key] && state.blogFilters[key] !== "all") query.set(urlKey, state.blogFilters[key]);
  }
  history.replaceState({}, "", `/socialplanner/${state.view}?${query}`);
}
function renderNavigation() {
  const groups = [
    ["Trabalho", [["overview", "Vis\xE3o geral", "grid"]]],
    ["Planejamento", [["week", "Cronograma", "calendar"], ["calendar", "Calend\xE1rio", "calendar"], ["pending", "Pend\xEAncias", "alert"], ["asana-calendar", "Calend\xE1rio do Asana", "asana"]]],
    ["Produ\xE7\xE3o", [["visits-week", "Visitas", "hotel"], ["visits-calendar", "Agenda de visitas", "calendar"], ["visits-history", "Hist\xF3rico", "check"], ["blog-schedule", "Blog", "calendar"], ["blog-ideas", "Pautas", "grid"], ["blog-published", "Publicados", "check"]]],
    ["Conte\xFAdo", [["assets", "Banco de conte\xFAdos", "image"], ["campaigns", "Campanhas", "flag"], ["performance", "Desempenho", "grid"]]],
    ["Administra\xE7\xE3o", [["hotels", "Hot\xE9is", "hotel"], ["categories", "Categorias", "tag"], ["users", "Usu\xE1rios", "users"], ["settings", "Configura\xE7\xF5es", "settings"]]]
  ];
  const visibleGroups = groups.map(([title, items]) => [title, items.filter(([key]) => key !== "users" || state.session?.permissions.includes("social-planner.users.manage"))]);
  document.querySelector("#navigation").innerHTML = visibleGroups.map(([title, items]) => `<div class="nav-group">${title ? `<span class="nav-heading">${title}</span>` : ""}${items.map(([key, label, symbol]) => `<a class="nav-link ${state.view === key ? "active" : ""}" href="/socialplanner/${key}" data-view="${key}" title="${label}">${icon(symbol)}<span class="nav-label">${label}</span></a>`).join("")}</div>`).join("");
  hydrateIcons(document.querySelector("#navigation"));
}
function dateRange() {
  if (["calendar", "visits-calendar", "blog-schedule"].includes(state.view)) {
    const date = fromIso(state.day);
    return [isoDate(new Date(date.getFullYear(), date.getMonth(), 1)), isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))];
  }
  if (state.view === "pending") return [addDays(today, -30), addDays(today, 7)];
  if (state.view === "visits-history") return [addDays(state.day, -89), state.day];
  if (state.view === "overview") return [state.week, addDays(state.week, 13)];
  return [state.week, addDays(state.week, 6)];
}
async function loadData() {
  const version = ++loadVersion;
  state.loading = true;
  render();
  try {
    const [start2, end] = dateRange();
    const needsStories = ["week", "calendar", "pending", "overview"].includes(state.view);
    const needsVisits = ["visits-week", "visits-calendar", "visits-history", "overview", "week", "calendar", "pending"].includes(state.view);
    const needsPosts = state.view.startsWith("blog-") || state.view === "overview";
    const [stories, visits, posts] = await Promise.all([
      needsStories ? apiStoryRepository.stories(start2, end, state.filters) : Promise.resolve(state.stories),
      needsVisits ? marketingRepository.visits(start2, end) : Promise.resolve(state.visits),
      needsPosts ? marketingRepository.posts(state.view === "blog-schedule" ? start2 : void 0, state.view === "blog-schedule" ? end : void 0) : Promise.resolve(state.posts)
    ]);
    if (version === loadVersion) {
      state.stories = stories;
      state.visits = visits;
      state.posts = posts;
    }
  } catch (error) {
    notify(error.message, true);
  } finally {
    if (version === loadVersion) {
      state.loading = false;
      render();
    }
  }
}
async function loadManagedUsers() {
  state.loading = true;
  render();
  try {
    const result = await request("/user-management");
    state.managedUsers = result.users;
  } catch (error) {
    notify(error.message, true);
  } finally {
    state.loading = false;
    render();
  }
}
async function loadAsanaData() {
  const version = ++loadVersion;
  state.loading = true;
  render();
  try {
    const focus = fromIso(state.day);
    const start2 = isoDate(new Date(focus.getFullYear(), focus.getMonth(), 1));
    const end = isoDate(new Date(focus.getFullYear(), focus.getMonth() + 1, 0));
    const setup = await marketingRepository.asanaSetup();
    if (version === loadVersion) state.asanaSetup = setup;
    let tasks = [];
    if (setup.connected) {
      try {
        tasks = await marketingRepository.asanaTasks(start2, end, state.asanaHotelFilter);
      } catch (error) {
        notify(error.message, true);
      }
    }
    if (version === loadVersion) state.asanaTasks = tasks;
  } catch (error) {
    notify(error.message, true);
  } finally {
    if (version === loadVersion) {
      state.loading = false;
      render();
    }
  }
}
var platformOptions = [
  { id: "all", label: "Todas", short: "ALL" },
  { id: "instagram", label: "Instagram", short: "IG" },
  { id: "tiktok", label: "TikTok", short: "TT" },
  { id: "youtube", label: "YouTube", short: "YT" },
  { id: "facebook", label: "Facebook", short: "FB" }
];
function storyPlatforms(story) {
  const fromChannels = (story.channels || []).map((channel) => channel.platform_key);
  const raw = `${story.channel_ids || ""},${story.channel_names || ""}`.toLocaleLowerCase("pt-BR");
  return [.../* @__PURE__ */ new Set([...fromChannels, ...platformOptions.filter((item) => item.id !== "all" && raw.includes(item.id)).map((item) => item.id)])];
}
function visibleStories() {
  const needle = state.filters.search.trim().toLocaleLowerCase("pt-BR");
  return state.stories.filter((story) => (state.platformFilter === "all" || storyPlatforms(story).includes(state.platformFilter)) && (!needle || [story.title, story.description, story.story_text, story.responsible_name].some((item) => item?.toLocaleLowerCase("pt-BR").includes(needle)))).sort((a, b) => a.date.localeCompare(b.date) || a.hotel_id.localeCompare(b.hotel_id) || a.sort_order - b.sort_order || (a.planned_time || "").localeCompare(b.planned_time || ""));
}
function platformSelector() {
  return `<div class="platform-selector" role="group" aria-label="Filtrar cronograma por rede">${platformOptions.map((platform) => {
    const count = platform.id === "all" ? state.stories.length : state.stories.filter((story) => storyPlatforms(story).includes(platform.id)).length;
    return `<button type="button" class="platform-option ${state.platformFilter === platform.id ? "active" : ""}" data-platform="${platform.id}" aria-pressed="${state.platformFilter === platform.id}"><span class="platform-mark ${platform.id}">${platform.short}</span><span>${platform.label}</span><strong>${count}</strong></button>`;
  }).join("")}</div>`;
}
function selectedHotels() {
  return state.hotels.filter((hotel) => state.filters.hotel_id === "all" || state.filters.hotel_id === hotel.id);
}
function filtersHtml() {
  const f = state.filters;
  const select = (key, label, values) => `<select data-filter="${key}" aria-label="${label}">${option("all", label, f[key])}${values.map((item) => option(item.id, item.name, f[key])).join("")}</select>`;
  return `<div class="filter-panel">${select("hotel_id", "Todos os hot\xE9is", state.hotels)}${select("status", "Todos os status", Object.entries(statusLabels).map(([id, name]) => ({ id, name })))}${select("category_id", "Todas as categorias", state.categories)}${select("responsible_user_id", "Todos os respons\xE1veis", state.users)}${select("campaign_id", "Todas as campanhas", state.campaigns)}<input type="search" data-filter="search" value="${escapeHtml(f.search)}" placeholder="Pesquisar conte\xFAdos" aria-label="Pesquisar conte\xFAdos"></div>`;
}
function metricsHtml(stories) {
  const counts = [
    ["Conte\xFAdos planejados", stories.filter((s) => s.status !== "cancelled").length, ""],
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
  return `<div class="page-heading"><div><p class="eyebrow">Social Planner</p><h1>Cronograma de redes</h1><p class="subtle">Planeje, distribua e acompanhe os conte\xFAdos de todas as unidades.</p></div><div class="heading-actions"><div class="week-nav"><button class="icon-button" data-action="prev-week" aria-label="Semana anterior">${icon("left")}</button><span class="week-label">${escapeHtml(label)}</span><button class="icon-button" data-action="next-week" aria-label="Pr\xF3xima semana">${icon("right")}</button></div><button class="button" data-action="today">Hoje</button></div></div>`;
}
function card(story) {
  const category = state.categories.find((item) => item.id === story.category_id)?.name;
  const format = story.format ? formatLabels[story.format] : "";
  const members = story.sequence_group_id ? state.stories.filter((item) => item.sequence_group_id === story.sequence_group_id) : [];
  const sequence = story.sequence_group_id ? `<span class="sequence-badge">${story.sequence_position || members.indexOf(story) + 1}/${members.length}</span>` : "";
  const platforms = storyPlatforms(story).slice(0, 4);
  return `<article class="story-card" data-story-id="${escapeHtml(story.id)}" data-status="${story.status}" draggable="true" tabindex="0" role="button" aria-label="${escapeHtml(story.title)}, ${statusLabels[story.status]}"><div class="card-top"><span class="card-time">${escapeHtml(story.planned_time || "\u2014")}</span><span class="platform-miniatures">${platforms.map((platform) => `<span class="platform-mini ${platform}">${platformOptions.find((item) => item.id === platform)?.short || platform.slice(0, 2).toUpperCase()}</span>`).join("")}</span></div>${story.thumbnail_url ? `<img class="card-thumb" src="${escapeHtml(story.thumbnail_url)}" alt="">` : ""}<div class="card-title">${escapeHtml(story.title)}</div><div class="card-meta">${format ? `<span>${escapeHtml(format)}</span>` : ""}${category ? `<span>${escapeHtml(category)}</span>` : ""}</div><div class="card-footer"><span class="status-pill" data-status="${story.status}">${statusLabels[story.status]}</span><span>${escapeHtml(story.responsible_name || "Sem respons\xE1vel")}</span>${sequence}</div></article>`;
}
function upcomingRail() {
  const upcoming = state.stories.filter((story) => story.date >= today && story.status !== "cancelled").sort((a, b) => a.date.localeCompare(b.date) || (a.planned_time || "").localeCompare(b.planned_time || "")).slice(0, 6);
  const visit = state.visits.filter((item) => item.date >= today && !["cancelled", "completed"].includes(item.status)).sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || "").localeCompare(b.start_time || ""))[0];
  return `<aside class="upcoming-rail" aria-label="Pr\xF3ximos compromissos"><div class="rail-header"><h2>Pr\xF3ximos</h2><button type="button" data-view="calendar">Ver todos</button></div><div class="rail-date">A partir de hoje</div><div class="rail-items">${upcoming.length ? upcoming.map((story) => {
    const hotel = state.hotels.find((item) => item.id === story.hotel_id)?.short_name || "Fioreze";
    const platform = storyPlatforms(story)[0] || "all";
    return `<button type="button" class="rail-item" data-story-id="${escapeHtml(story.id)}"><span class="rail-time">${escapeHtml(story.date === today ? story.planned_time || "Hoje" : dateLabel(story.date, { day: "2-digit", month: "short" }))}</span><span class="platform-mini ${platform}">${platformOptions.find((item) => item.id === platform)?.short || "--"}</span><span><strong>${escapeHtml(story.title)}</strong><small>${escapeHtml(hotel)}</small></span><span class="status-pill" data-status="${story.status}">${statusLabels[story.status]}</span></button>`;
  }).join("") : '<p class="rail-empty">Nenhum conte\xFAdo futuro neste per\xEDodo.</p>'}</div>${visit ? `<div class="rail-visit"><div class="rail-header"><h2>Visita agendada</h2><button type="button" data-view="visits-calendar">Ver agenda</button></div><button type="button" class="visit-preview" data-visit-id="${escapeHtml(visit.id)}"><span class="visit-date"><strong>${visit.date.slice(-2)}</strong>${escapeHtml(dateLabel(visit.date, { month: "short" }))}</span><span><strong>${escapeHtml(visit.title)}</strong><small>${escapeHtml(visit.start_time || "Hor\xE1rio livre")} \xB7 ${escapeHtml(visit.hotel_name)}</small></span></button></div>` : ""}</aside>`;
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
  const content = `${filtersHtml()}${metricsHtml(stories)}${alerts.length ? `<div class="notice-bar">${icon("alert")} ${escapeHtml(alerts.join(" \xB7 "))}</div>` : ""}${hotels.length ? `${board}${mobile}` : emptyState("Nenhum hotel corresponde ao filtro.")}`;
  return `${weekHeading()}${platformSelector()}<div class="schedule-layout"><div class="schedule-main">${content}</div>${upcomingRail()}</div>`;
}
function calendarView() {
  const date = fromIso(state.day), year = date.getFullYear(), month = date.getMonth();
  const first = new Date(year, month, 1), offset = (first.getDay() + 6) % 7;
  const start2 = isoDate(new Date(year, month, 1 - offset));
  const stories = visibleStories();
  return `<div class="page-heading"><div><p class="eyebrow">Planejamento editorial</p><h1>Calend\xE1rio</h1><p class="subtle">${escapeHtml(dateLabel(isoDate(first), { month: "long", year: "numeric" }))}</p></div><div class="heading-actions"><button class="button" data-action="prev-month">${icon("left")}</button><button class="button" data-action="next-month">${icon("right")}</button><button class="button primary" data-action="new">${icon("plus")} Novo conte\xFAdo</button></div></div>${platformSelector()}${filtersHtml()}<div class="calendar-grid">${["Seg", "Ter", "Qua", "Qui", "Sex", "S\xE1b", "Dom"].map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}${Array.from({ length: 42 }, (_, index) => {
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
  return `<div class="page-heading"><div><p class="eyebrow">Meu trabalho</p><h1>Pend\xEAncias</h1><p class="subtle">Itens dos \xFAltimos 30 dias e pr\xF3ximos 7 dias.</p></div><button class="button primary" data-action="new">${icon("plus")} Novo conte\xFAdo</button></div>${platformSelector()}${filtersHtml()}${sections.map(([title, predicate]) => {
    const items = stories.filter(predicate);
    return `<section class="section-card"><h2>${title} <span class="subtle">${items.length}</span></h2><div class="pending-list">${items.length ? items.map((story) => `<button class="pending-row" data-story-id="${escapeHtml(story.id)}"><strong>${escapeHtml(story.title)}</strong><small>${escapeHtml(state.hotels.find((h) => h.id === story.hotel_id)?.short_name)}</small><small>${escapeHtml(story.date)}</small><span class="status-pill" data-status="${story.status}">${statusLabels[story.status]}</span></button>`).join("") : '<p class="subtle">Nenhum item nesta categoria.</p>'}</div></section>`;
  }).join("")}`;
}
var campaignStatusLabels = { planned: "Planejada", active: "Ativa", completed: "Conclu\xEDda", cancelled: "Cancelada" };
function campaignDateLabel(value, includeYear = false) {
  return dateLabel(value, { day: "2-digit", month: "short", ...includeYear ? { year: "numeric" } : {} }).replaceAll(" de ", " ").replaceAll(".", "");
}
function campaignsView() {
  const dates = Array.from({ length: CAMPAIGN_TIMELINE_DAYS }, (_, index) => addDays(state.campaignStart, index));
  const rangeEnd = dates.at(-1);
  const scheduled = state.campaigns.filter((campaign) => campaign.start_date && campaign.end_date);
  const visible = scheduled.filter((campaign) => campaign.start_date <= rangeEnd && campaign.end_date >= state.campaignStart);
  const unscheduled = state.campaigns.filter((campaign) => !campaign.start_date || !campaign.end_date);
  const header = dates.map((date) => {
    const day = fromIso(date).getDay();
    const classes = ["campaign-date-cell", day === 0 || day === 6 ? "weekend" : "", date === today ? "today" : ""].filter(Boolean).join(" ");
    return `<div class="${classes}" title="${escapeHtml(dateLabel(date, { dateStyle: "full" }))}"><small>${escapeHtml(dateLabel(date, { weekday: "short" }).replace(".", ""))}</small><strong>${escapeHtml(dateLabel(date, { day: "2-digit" }))}</strong></div>`;
  }).join("");
  const rows = visible.map((campaign) => {
    const visibleStart = campaign.start_date < state.campaignStart ? state.campaignStart : campaign.start_date;
    const visibleEnd = campaign.end_date > rangeEnd ? rangeEnd : campaign.end_date;
    const offset = dates.indexOf(visibleStart);
    const span = dates.indexOf(visibleEnd) - offset + 1;
    const status = Object.hasOwn(campaignStatusLabels, campaign.status) ? campaign.status : "planned";
    const cells = dates.map((date) => {
      const day = fromIso(date).getDay();
      return `<span class="campaign-track-cell ${day === 0 || day === 6 ? "weekend" : ""} ${date === today ? "today" : ""}" aria-hidden="true"></span>`;
    }).join("");
    const range2 = `${campaignDateLabel(campaign.start_date)} \u2013 ${campaignDateLabel(campaign.end_date, true)}`;
    return `<div class="campaign-timeline-row"><button type="button" class="campaign-row-info" data-action="edit-campaign" data-campaign-id="${escapeHtml(campaign.id)}"><span class="campaign-status-dot" data-status="${escapeHtml(status)}"></span><span><strong>${escapeHtml(campaign.name)}</strong><small>${escapeHtml(range2)} \xB7 ${campaign.story_count + campaign.visit_count + campaign.article_count} entregas</small></span></button>${cells}<button type="button" class="campaign-period-bar" data-status="${escapeHtml(status)}" data-action="edit-campaign" data-campaign-id="${escapeHtml(campaign.id)}" style="--campaign-column:${offset + 2};--campaign-span:${span}" title="${escapeHtml(`${campaign.name} \xB7 ${range2}`)}"><span>${escapeHtml(campaign.name)}</span></button></div>`;
  }).join("");
  const unscheduledList = unscheduled.length ? `<section class="campaign-unscheduled"><div class="section-heading"><div><h2>Sem per\xEDodo definido</h2><p class="subtle">Complete as datas para posicionar estas campanhas na linha do tempo.</p></div></div>${unscheduled.map((campaign) => `<button type="button" class="campaign-unscheduled-row" data-action="edit-campaign" data-campaign-id="${escapeHtml(campaign.id)}"><span><strong>${escapeHtml(campaign.name)}</strong><small>${escapeHtml(campaign.description || "Sem descri\xE7\xE3o")}</small></span><span>${campaignStatusLabels[campaign.status] || "Planejada"}</span>${icon("right")}</button>`).join("")}</section>` : "";
  const empty = !state.campaigns.length ? '<div class="empty-state"><h2>Nenhuma campanha cadastrada.</h2><p>Crie uma campanha para conectar Stories, visitas e artigos.</p><button class="button primary" data-action="new-campaign">Nova campanha</button></div>' : !visible.length ? '<div class="campaign-range-empty">Nenhuma campanha atravessa este per\xEDodo.</div>' : "";
  return `<div class="page-heading"><div><p class="eyebrow">Conte\xFAdo</p><h1>Campanhas</h1><p class="subtle">Visualize dura\xE7\xE3o, sobreposi\xE7\xF5es e entregas ao longo do calend\xE1rio.</p></div><button class="button primary" data-action="new-campaign">${icon("plus")} Nova campanha</button></div><section class="campaign-timeline-shell"><div class="campaign-timeline-toolbar"><div><span>Per\xEDodo exibido</span><strong>${escapeHtml(campaignDateLabel(state.campaignStart))} \u2013 ${escapeHtml(campaignDateLabel(rangeEnd, true))}</strong><small>${visible.length} ${visible.length === 1 ? "campanha vis\xEDvel" : "campanhas vis\xEDveis"}</small></div><div class="campaign-range-actions"><button class="icon-button" type="button" data-action="campaign-prev" aria-label="Per\xEDodo anterior" title="Per\xEDodo anterior">${icon("left")}</button><button class="button" type="button" data-action="campaign-today">Hoje</button><button class="icon-button" type="button" data-action="campaign-next" aria-label="Pr\xF3ximo per\xEDodo" title="Pr\xF3ximo per\xEDodo">${icon("right")}</button></div></div><div class="campaign-timeline-scroll"><div class="campaign-timeline-grid"><div class="campaign-timeline-header"><div class="campaign-corner"><span>Campanha</span><small>Status e entregas</small></div>${header}</div>${rows}</div></div>${empty}</section>${unscheduledList}`;
}
function openCampaignDialog(campaign) {
  const existing = document.querySelector("#campaignDialog");
  existing?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "campaignDialog";
  dialog.className = "campaign-dialog";
  dialog.innerHTML = `<form id="campaignForm"><header><h2>${campaign ? "Editar campanha" : "Nova campanha"}</h2><button type="button" class="icon-button" data-action="close-campaign" aria-label="Fechar">${icon("close")}</button></header><div class="form-grid">${field("name", "Nome", campaign?.name, "text", true)}${field("description", "Descri\xE7\xE3o", campaign?.description, "textarea", true)}${field("start_date", "In\xEDcio", campaign?.start_date, "date")}${field("end_date", "T\xE9rmino", campaign?.end_date, "date")}${selectField2("status", "Status", campaign?.status || "planned", [{ id: "planned", name: "Planejada" }, { id: "active", name: "Ativa" }, { id: "completed", name: "Conclu\xEDda" }, { id: "cancelled", name: "Cancelada" }])}</div><footer><button type="button" class="button" data-action="close-campaign">Cancelar</button><button class="button primary" type="submit">Salvar campanha</button></footer></form>`;
  dialog.querySelector("[name=name]").required = true;
  dialog.dataset.campaignId = campaign?.id || "";
  document.body.append(dialog);
  hydrateIcons(dialog);
  dialog.showModal();
  dialog.querySelector("[name=name]")?.focus();
}
function openPlannerUserDialog(user) {
  document.querySelector("#plannerUserDialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "plannerUserDialog";
  dialog.className = "campaign-dialog";
  dialog.dataset.userId = user?.id || "";
  dialog.innerHTML = `<form id="plannerUserForm"><header><h2>${user ? "Editar usu\xE1rio" : "Novo usu\xE1rio"}</h2><button type="button" class="icon-button" data-action="close-planner-user" aria-label="Fechar">${icon("close")}</button></header><div class="form-grid">${field("display_name", "Nome", user?.display_name, "text", true)}${field("email", "E-mail", user?.email, "email", true)}${selectField2("access_level", "Acesso", user?.access_level || "editor", [{ id: "viewer", name: "Somente leitura" }, { id: "editor", name: "Editor" }, { id: "admin", name: "Administrador" }], true)}${user ? selectField2("status", "Status", user.status, [{ id: "active", name: "Ativo" }, { id: "disabled", name: "Desativado" }], true) : field("password", "Senha inicial", "", "password", true)}</div><footer><button type="button" class="button" data-action="close-planner-user">Cancelar</button><button class="button primary" type="submit">Salvar usu\xE1rio</button></footer></form>`;
  document.body.append(dialog);
  hydrateIcons(dialog);
  dialog.showModal();
  dialog.querySelector("[name=display_name]")?.focus();
}
function openPlannerPasswordDialog(userId) {
  document.querySelector("#plannerPasswordDialog")?.remove();
  const user = state.managedUsers.find((entry) => entry.id === userId);
  if (!user) return;
  const dialog = document.createElement("dialog");
  dialog.id = "plannerPasswordDialog";
  dialog.className = "campaign-dialog";
  dialog.dataset.userId = userId;
  dialog.innerHTML = `<form id="plannerPasswordForm"><header><h2>Redefinir senha</h2><button type="button" class="icon-button" data-action="close-planner-password" aria-label="Fechar">${icon("close")}</button></header><p class="subtle">${escapeHtml(user.display_name)}</p><div class="form-grid">${field("password", "Nova senha", "", "password", true)}</div><footer><button type="button" class="button" data-action="close-planner-password">Cancelar</button><button class="button primary" type="submit">Redefinir senha</button></footer></form>`;
  document.body.append(dialog);
  hydrateIcons(dialog);
  dialog.showModal();
  dialog.querySelector("[name=password]")?.focus();
}
function assetsView() {
  return `<div class="page-heading"><div><p class="eyebrow">Conte\xFAdo</p><h1>Banco de conte\xFAdos</h1><p class="subtle">Fotos e v\xEDdeos s\xE3o acessados diretamente pelo editor de Stories.</p></div></div><div class="section-card"><h2>Biblioteca compartilhada</h2><p class="subtle">Ao editar um Story, selecione o hotel e use \u201CEscolher m\xEDdia\u201D. O Planner mostra apenas arquivos ativos da unidade escolhida.</p>${state.session?.auth_source === "admin-master" ? '<p><a class="button" href="/admin/portais/media/">Administrar biblioteca na Central</a></p>' : ""}</div>`;
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
function usersView() {
  if (!state.session?.permissions.includes("social-planner.users.manage")) return `<div class="empty-state"><h2>Acesso restrito</h2><p>Somente administradores do Planner gerenciam usu\xE1rios.</p></div>`;
  return `<div class="page-heading"><div><p class="eyebrow">Administra\xE7\xE3o</p><h1>Usu\xE1rios do Planner</h1><p class="subtle">Estas contas acessam somente o Marketing Planner.</p></div><button class="button primary" data-action="new-planner-user">${icon("plus")} Novo usu\xE1rio</button></div><section class="section-card"><div class="user-management-list">${state.managedUsers.map((user) => `<div class="user-management-row" data-planner-user-id="${escapeHtml(user.id)}"><strong>${escapeHtml(user.display_name)}</strong><small>${escapeHtml(user.email)}</small><span>${accessLevelLabel(user.access_level)}</span><span>${user.status === "active" ? "Ativo" : "Desativado"}</span><div class="user-management-actions">${user.inherited_from_central ? '<span class="status-pill">Mestre da Central</span>' : `<button class="button" data-action="edit-planner-user" data-user-id="${escapeHtml(user.id)}">Editar</button><button class="button" data-action="reset-planner-password" data-user-id="${escapeHtml(user.id)}">Senha</button>`}</div></div>`).join("")}</div></section>`;
}
function settingsView() {
  const connection = state.calendar.connection;
  const calendarAction = !state.calendar.configured ? '<button class="button" disabled>Configura\xE7\xE3o pendente</button>' : state.calendar.connected ? '<button class="button danger" data-action="disconnect-calendar">Desconectar</button>' : '<button class="button primary" data-action="connect-calendar">Conectar minha agenda</button>';
  const calendarDescription = !state.calendar.configured ? "Adicione as credenciais OAuth do Google no ambiente para liberar a conex\xE3o individual." : state.calendar.connected ? `Agenda conectada a ${escapeHtml(connection?.account_email || "conta Google")}. Somente visitas atribu\xEDdas a voc\xEA ser\xE3o sincronizadas.` : "Conecte sua conta pessoal. Cada usu\xE1rio recebe apenas as visitas em que foi marcado como respons\xE1vel.";
  return `<div class="page-heading"><div><p class="eyebrow">Administra\xE7\xE3o</p><h1>Configura\xE7\xF5es</h1><p class="subtle">Identidade, sess\xE3o e integra\xE7\xF5es pessoais.</p></div></div><section class="section-card"><h2>Nome da aplica\xE7\xE3o</h2><form id="plannerSettingsForm" class="settings-form"><label><span>Nome exibido</span><input name="display_name" value="${escapeHtml(state.displayName)}" maxlength="100" required></label><button class="button primary" type="submit">Salvar nome</button></form></section><section class="section-card calendar-settings"><div><h2>Google Calendar</h2><p class="subtle">${calendarDescription}</p>${connection?.last_error ? `<p class="calendar-error">${escapeHtml(connection.last_error)}</p>` : ""}</div>${calendarAction}</section><section class="section-card"><h2>Acesso separado</h2><p class="subtle">Usu\xE1rios comuns entram exclusivamente no Planner. Apenas o administrador mestre pode atravessar a sess\xE3o da Central.</p></section>`;
}
function emptyState(message) {
  return `<div class="empty-state"><h2>${escapeHtml(message)}</h2><p>Crie um conte\xFAdo e escolha onde ele ser\xE1 publicado.</p><button class="button primary" data-action="new">Novo conte\xFAdo</button></div>`;
}
function visitContext() {
  return { visits: state.visits, hotels: state.hotels, categories: state.categories, users: state.users, campaigns: state.campaigns, week: state.week, day: state.day, today, filter: state.visitFilter, view: state.view };
}
function blogContext() {
  return { posts: state.posts, hotels: state.hotels, categories: state.categories, users: state.users, campaigns: state.campaigns, day: state.day, today, view: state.view, mode: state.blogMode, filters: state.blogFilters };
}
function render() {
  renderNavigation();
  const globalSearch = document.querySelector("#globalPlannerSearch");
  if (globalSearch && globalSearch.value !== state.filters.search) globalSearch.value = state.filters.search;
  if (state.loading) {
    main.innerHTML = '<div class="loading-shell"><div class="skeleton title"></div><div class="skeleton toolbar"></div><div class="skeleton grid"></div></div>';
    hydrateIcons(main);
    return;
  }
  if (state.view.startsWith("visits-")) main.innerHTML = visitsView(visitContext());
  else if (state.view.startsWith("blog-")) main.innerHTML = blogView(blogContext());
  else if (state.view === "overview") main.innerHTML = overviewView(state.stories, state.visits, state.posts, state.hotels, today, state.week);
  else if (state.view === "asana-calendar") main.innerHTML = asanaCalendarView({ setup: state.asanaSetup, tasks: state.asanaTasks, hotels: state.hotels, day: state.day, today, hotelFilter: state.asanaHotelFilter, canManage: Boolean(state.asanaSetup?.can_manage_tasks && state.session?.permissions.includes("social-planner.write")) });
  else main.innerHTML = { week: weekView, calendar: calendarView, pending: pendingView, campaigns: campaignsView, assets: assetsView, hotels: hotelsView, categories: categoriesView, performance: performanceView, users: usersView, settings: settingsView }[state.view]?.() || "";
  hydrateIcons(main);
}
function accessLevelLabel(level) {
  return { viewer: "Leitura", editor: "Editor", admin: "Administrador" }[level];
}
function openDrawer(story, date = today, hotel = "") {
  state.visitDrawer = null;
  state.postDrawer = null;
  state.asanaTaskDrawer = null;
  state.drawer = story;
  state.createDate = date;
  state.createHotel = hotel;
  renderDrawer();
  hydrateIcons(drawer);
  drawer.hidden = false;
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  drawer.querySelector("input[name=title]")?.focus();
}
function closeDrawer() {
  state.drawer = null;
  state.visitDrawer = null;
  state.postDrawer = null;
  state.asanaTaskDrawer = null;
  drawer.hidden = true;
  backdrop.hidden = true;
  document.body.style.overflow = "";
}
function visitDrawerContent(visit) {
  const related = visit?.stories?.length ? `<section class="drawer-section"><h3>Stories da visita</h3><div class="pending-list">${visit.stories.map((story) => `<button type="button" class="pending-row" data-action="open-linked-story" data-linked-story-id="${escapeHtml(story.id)}"><strong>${escapeHtml(story.title)}</strong><small>${escapeHtml(story.date)}</small><span>${statusLabels[story.status]}</span></button>`).join("")}</div></section>` : "";
  return visitDrawer(visit, visitContext(), state.createDate).replace('<div id="deleteConfirm"></div>', `${related}<div id="deleteConfirm"></div>`);
}
async function openVisit(id, date = today) {
  try {
    state.drawer = null;
    state.postDrawer = null;
    state.asanaTaskDrawer = null;
    state.createDate = date;
    state.visitDrawer = id ? await marketingRepository.visit(id) : "new";
    drawer.innerHTML = visitDrawerContent(state.visitDrawer === "new" ? null : state.visitDrawer);
    hydrateIcons(drawer);
    drawer.hidden = false;
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    drawer.querySelector("[name=title]")?.focus();
  } catch (error) {
    notify(error.message, true);
  }
}
function openPost(post) {
  state.drawer = null;
  state.visitDrawer = null;
  state.asanaTaskDrawer = null;
  state.postDrawer = post || "new";
  drawer.innerHTML = blogDrawer(post || null, blogContext());
  hydrateIcons(drawer);
  drawer.hidden = false;
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  drawer.querySelector("[name=title]")?.focus();
}
function renderAsanaTaskDrawer(task) {
  const editable = Boolean(state.asanaSetup?.can_manage_tasks && state.session?.permissions.includes("social-planner.write"));
  const disabled = editable ? "" : "disabled";
  const startOn = task.start_on || (task.has_start_date ? task.start_date : "") || "";
  const dueOn = task.due_on || task.end_date || "";
  const updated = task.modified_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.modified_at)) : "N\xE3o informado";
  drawer.innerHTML = `<div class="drawer-header"><div><small>Tarefa do Asana</small><h2 id="drawerTitle">${escapeHtml(task.name)}</h2></div><button class="icon-button" type="button" data-action="close-drawer" aria-label="Fechar">${icon("close")}</button></div><form id="asanaTaskForm"><div class="drawer-body"><section class="drawer-section asana-task-context"><span>${escapeHtml(task.hotel_name)}</span><strong>${escapeHtml(task.project_name)}</strong>${task.section_name ? `<small>${escapeHtml(task.section_name)}</small>` : ""}</section><section class="drawer-section"><h3>Conte\xFAdo</h3><div class="form-grid"><label class="full"><span>T\xEDtulo *</span><input name="name" value="${escapeHtml(task.name)}" maxlength="500" required ${disabled}></label><label class="full"><span>Descri\xE7\xE3o</span><textarea name="notes" maxlength="50000" ${disabled}>${escapeHtml(task.notes)}</textarea></label></div></section><section class="drawer-section"><h3>Planejamento</h3><div class="form-grid"><label><span>Data inicial</span><input name="start_on" type="date" value="${escapeHtml(startOn)}" ${disabled}></label><label><span>Data final</span><input name="due_on" type="date" value="${escapeHtml(dueOn)}" ${disabled}></label><label class="asana-completed-toggle full"><input name="completed" type="checkbox" ${task.completed ? "checked" : ""} ${disabled}><span>Marcar tarefa como conclu\xEDda</span></label></div></section><section class="drawer-section asana-task-metadata"><h3>Informa\xE7\xF5es do Asana</h3><dl><div><dt>Respons\xE1vel</dt><dd>${escapeHtml(task.assignee_name || "N\xE3o atribu\xEDdo")}</dd></div><div><dt>\xDAltima altera\xE7\xE3o</dt><dd>${escapeHtml(updated)}</dd></div></dl></section>${!editable ? '<p class="calendar-error">Reconecte sua conta com permiss\xE3o de edi\xE7\xE3o ou solicite perfil de Editor no Planner.</p>' : ""}</div><div class="drawer-actions">${task.permalink_url ? `<a class="button" href="${escapeHtml(task.permalink_url)}" target="_blank" rel="noopener noreferrer">Abrir no Asana</a>` : ""}${editable ? '<button type="submit" class="button primary">Salvar tarefa</button>' : ""}</div></form>`;
  hydrateIcons(drawer);
}
async function openAsanaTask(taskGid) {
  try {
    state.drawer = null;
    state.visitDrawer = null;
    state.postDrawer = null;
    drawer.innerHTML = '<div class="drawer-body"><div class="loading-shell"><div class="skeleton title"></div><div class="skeleton grid"></div></div></div>';
    drawer.hidden = false;
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    state.asanaTaskDrawer = await marketingRepository.asanaTask(taskGid);
    renderAsanaTaskDrawer(state.asanaTaskDrawer);
  } catch (error) {
    closeDrawer();
    notify(error.message, true);
  }
}
function mergeAsanaTask(task) {
  state.asanaTasks = state.asanaTasks.map((entry) => entry.gid === task.gid ? { ...entry, ...task } : entry);
  state.asanaTaskDrawer = task;
}
async function saveAsanaTaskForm(event) {
  event.preventDefault();
  const task = state.asanaTaskDrawer;
  if (!task) return;
  const form = event.target;
  const data = new FormData(form);
  const input = {
    name: String(data.get("name") || "").trim(),
    notes: String(data.get("notes") || ""),
    start_on: String(data.get("start_on") || "") || null,
    due_on: String(data.get("due_on") || "") || null,
    completed: data.get("completed") === "on"
  };
  if (input.start_on && !input.due_on) {
    notify("Informe a data final quando houver data inicial.", true);
    return;
  }
  try {
    const saved = await marketingRepository.updateAsanaTask(task.gid, input);
    mergeAsanaTask(saved);
    render();
    renderAsanaTaskDrawer(saved);
    notify("Tarefa atualizada no Asana.");
  } catch (error) {
    notify(error.message, true);
  }
}
async function moveAsanaTaskToDate(taskGid, targetDate) {
  const task = state.asanaTasks.find((entry) => entry.gid === taskGid);
  if (!task || !/^\d{4}-\d{2}-\d{2}$/u.test(targetDate)) return;
  const duration = task.start_date && task.end_date ? Math.max(0, Math.round((fromIso(task.end_date).getTime() - fromIso(task.start_date).getTime()) / 864e5)) : 0;
  const dueOn = addDays(targetDate, duration);
  const input = task.has_start_date ? { start_on: targetDate, due_on: dueOn } : { due_on: targetDate };
  const previous = state.asanaTasks.map((entry) => ({ ...entry }));
  state.asanaTasks = state.asanaTasks.map((entry) => entry.gid === taskGid ? { ...entry, start_date: targetDate, end_date: dueOn } : entry);
  render();
  try {
    mergeAsanaTask(await marketingRepository.updateAsanaTask(taskGid, input));
    render();
    notify("Tarefa movida no Asana.");
  } catch (error) {
    state.asanaTasks = previous;
    render();
    notify(`Movimento revertido: ${error.message}`, true);
  }
}
function field(name, label, value, kind = "text", full = false) {
  const escaped = escapeHtml(value);
  const required = ["title", "hotel_id", "date"].includes(name) ? "required" : "";
  return `<label class="${full ? "full" : ""}"><span>${label}${required ? " *" : ""}</span>${kind === "textarea" ? `<textarea name="${name}">${escaped}</textarea>` : `<input name="${name}" type="${kind}" value="${escaped}" ${required}>`}</label>`;
}
function selectField2(name, label, value, values, required = false) {
  return `<label><span>${label}${required ? " *" : ""}</span><select name="${name}" ${required ? "required" : ""}>${required ? option("", "Selecione", value || "") : option("", "N\xE3o definido", value || "")}${value && !values.some((item) => item.id === value) ? option(value, "V\xEDnculo existente", value) : ""}${values.map((item) => option(item.id, item.name, value || "")).join("")}</select></label>`;
}
function channelPlanner(story) {
  const existing = new Map((story?.channels || []).map((channel) => [channel.channel_id, channel]));
  const defaultId = story ? null : "instagram-feed";
  const statusOptions = Object.entries(statusLabels).map(([id, name]) => ({ id, name }));
  const sourceOptions = state.channels.map((channel) => ({ id: channel.id, name: channel.display_name }));
  return `<section class="drawer-section"><div class="section-heading"><div><h3>Canais e reaproveitamento</h3><p class="drawer-hint">Selecione os destinos e adapte somente o que mudar em cada rede.</p></div></div><div class="channel-planner">${state.channels.map((channel) => {
    const linked = existing.get(channel.id);
    const selected = Boolean(linked || channel.id === defaultId);
    const plannedAt = linked?.planned_at || (selected && story?.date ? `${story.date}T${story.planned_time || "12:00"}` : "");
    return `<article class="channel-row" data-channel-row="${escapeHtml(channel.id)}"><label class="channel-toggle"><input type="checkbox" name="channel_selected" value="${escapeHtml(channel.id)}" ${selected ? "checked" : ""}><span><strong>${escapeHtml(channel.display_name)}</strong><small>${escapeHtml(channel.platform_name)} \xB7 ${escapeHtml(channel.placement_key)}</small></span></label><div class="channel-fields"><label><span>Agendar</span><input type="datetime-local" name="channel_planned_${escapeHtml(channel.id)}" value="${escapeHtml(plannedAt)}"></label><label><span>Status</span><select name="channel_status_${escapeHtml(channel.id)}">${statusOptions.map((item) => option(item.id, item.name, linked?.status || story?.status || "idea")).join("")}</select></label><label><span>Reaproveitar de</span><select name="channel_source_${escapeHtml(channel.id)}">${option("", "Conte\xFAdo original", linked?.source_channel_id || "")}${sourceOptions.filter((item) => item.id !== channel.id).map((item) => option(item.id, item.name, linked?.source_channel_id || "")).join("")}</select></label><label class="full"><span>Texto adaptado</span><textarea name="channel_text_${escapeHtml(channel.id)}" placeholder="Use somente quando este canal precisar de outra legenda ou roteiro">${escapeHtml(linked?.adapted_text)}</textarea></label></div></article>`;
  }).join("")}</div></section>`;
}
function channelFormInput(form) {
  const data = new FormData(form);
  const selected = new Set(data.getAll("channel_selected").map(String));
  return [...selected].map((id) => {
    const text = (name) => String(data.get(`${name}_${id}`) || "").trim() || null;
    const source = text("channel_source");
    return {
      channel_id: id,
      source_channel_id: source && selected.has(source) ? source : null,
      adapted_text: text("channel_text"),
      planned_at: text("channel_planned"),
      status: text("channel_status") || "idea",
      published_at: null,
      published_url: null
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
  drawer.innerHTML = `<div class="drawer-header"><div><small>${story ? "Editar conte\xFAdo" : "Novo conte\xFAdo"}</small><h2 id="drawerTitle">${escapeHtml(story?.title || "Planejar conte\xFAdo")}</h2></div><button class="icon-button" data-action="close-drawer" aria-label="Fechar">${icon("close")}</button></div><form id="storyForm"><div class="drawer-body"><section class="drawer-section"><h3>Planejamento</h3><div class="form-grid">${selectField2("hotel_id", "Hotel", story?.hotel_id || state.createHotel, state.hotels, true)}${field("date", "Data", story?.date || state.createDate, "date")}${field("planned_time", "Hor\xE1rio planejado", story?.planned_time, "time")}${selectField2("status", "Status geral", story?.status || "idea", statusOptions)}${selectField2("priority", "Prioridade", story?.priority || "normal", priorityOptions)}</div></section><section class="drawer-section"><h3>Conte\xFAdo-base</h3><div class="form-grid">${field("title", "T\xEDtulo interno", story?.title, "text", true)}${field("description", "Descri\xE7\xE3o / ideia", story?.description, "textarea", true)}${field("story_text", "Texto ou roteiro principal", story?.story_text, "textarea", true)}${selectField2("category_id", "Categoria", story?.category_id || null, state.categories)}${selectField2("content_pillar_id", "Pilar de conte\xFAdo", story?.content_pillar_id || null, state.pillars)}${selectField2("format", "Formato", story?.format || null, formatOptions)}${selectField2("objective", "Objetivo", story?.objective || null, objectiveOptions)}${field("cta", "CTA", story?.cta)}${field("link", "Link", story?.link, "url", true)}</div></section>${channelPlanner(story)}<section class="drawer-section"><h3>M\xEDdia</h3><div class="form-grid">${field("media_asset_id", "ID da m\xEDdia na biblioteca", story?.media_asset_id, "text", true)}</div><p class="drawer-hint">O mesmo arquivo pode ser reaproveitado nos destinos selecionados.</p>${story?.thumbnail_url ? `<img src="${escapeHtml(story.thumbnail_url)}" alt="Pr\xE9via da m\xEDdia" style="max-height:100px;border-radius:7px;margin-top:10px">` : ""}</section><section class="drawer-section"><h3>Respons\xE1vel</h3><div class="form-grid">${selectField2("responsible_user_id", "Pessoa respons\xE1vel", story?.responsible_user_id || null, state.users)}</div></section><section class="drawer-section"><h3>Publica\xE7\xE3o principal</h3><div class="form-grid">${selectField2("campaign_id", "Campanha", story?.campaign_id || null, state.campaigns)}${field("published_at", "Publicado em (ISO)", story?.published_at)}${field("published_url", "URL publicada", story?.published_url, "url", true)}</div></section><section class="drawer-section"><h3>Sequ\xEAncia</h3><div class="form-grid">${selectField2("sequence_group_id", "Grupo", story?.sequence_group_id || null, state.sequences.map((sequence) => ({ id: sequence.id, name: sequence.title })))}${field("sequence_position", "Posi\xE7\xE3o", story?.sequence_position)}</div><button type="button" class="button" data-action="new-sequence" style="margin-top:10px">Criar sequ\xEAncia</button></section><section class="drawer-section"><h3>Origem</h3><div class="form-grid">${selectField2("source_visit_id", "Visita de capta\xE7\xE3o", story?.source_visit_id || null, state.visits.filter((visit) => visit.hotel_id === (story?.hotel_id || state.createHotel)).map((visit) => ({ id: visit.id, name: `${visit.date} \xB7 ${visit.title}` })))}</div></section><section class="drawer-section"><h3>Informa\xE7\xF5es adicionais</h3><div class="form-grid">${field("notes", "Observa\xE7\xF5es", story?.notes, "textarea", true)}</div></section><div id="deleteConfirm"></div></div><div class="drawer-actions">${story ? `<button type="button" class="button" data-action="duplicate">Duplicar</button><button type="button" class="button" data-action="mark-ready">Pronto</button><button type="button" class="button" data-action="mark-published">Publicado</button><button type="button" class="button danger" data-action="delete">Excluir</button>` : ""}<button type="submit" class="button primary">${state.saving ? "Salvando..." : "Salvar conte\xFAdo"}</button></div></form>`;
  const mediaSection = drawer.querySelector(".drawer-section:nth-of-type(3)");
  mediaSection?.insertAdjacentHTML("beforeend", '<button type="button" class="button" data-action="choose-media" style="margin-top:10px">Escolher da biblioteca</button><div id="mediaChoices"></div>');
  if (story?.sequence_group_id) drawer.querySelector(".drawer-actions")?.insertAdjacentHTML("afterbegin", '<button type="button" class="button" data-action="duplicate-sequence">Duplicar sequ\xEAncia</button>');
  if (story) drawer.querySelector(".drawer-actions")?.insertAdjacentHTML("afterbegin", '<button type="button" class="button" data-action="move">Mover</button>');
  hydrateIcons(drawer);
}
function formInput() {
  const form = drawer.querySelector("#storyForm");
  const data = new FormData(form);
  const fields = ["hotel_id", "date", "planned_time", "title", "description", "story_text", "category_id", "content_pillar_id", "format", "objective", "status", "priority", "cta", "link", "responsible_user_id", "campaign_id", "media_asset_id", "sequence_group_id", "sequence_position", "source_visit_id", "notes", "published_at", "published_url"];
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
    const channels = channelFormInput(form);
    if (!channels.length) throw new Error("Selecione pelo menos um canal de publica\xE7\xE3o.");
    const baseSaved = existing ? await apiStoryRepository.update(existing.id, formInput()) : await apiStoryRepository.create(formInput());
    const saved = await apiStoryRepository.saveChannels(baseSaved.id, channels);
    state.stories = existing ? state.stories.map((story) => story.id === saved.id ? saved : story) : [...state.stories, saved];
    if (existing?.campaign_id || saved.campaign_id) {
      try {
        state.campaigns = await apiStoryRepository.campaigns();
      } catch {
      }
    }
    closeDrawer();
    render();
    notify(existing ? "Conte\xFAdo atualizado." : "Conte\xFAdo criado.");
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
function upsertVisit(visit) {
  state.visits = [visit, ...state.visits.filter((item) => item.id !== visit.id)];
  render();
}
function upsertPost(post) {
  state.posts = [post, ...state.posts.filter((item) => item.id !== post.id)];
  render();
}
async function refreshVisitDrawer() {
  if (!state.visitDrawer || state.visitDrawer === "new") return;
  state.visitDrawer = await marketingRepository.visit(state.visitDrawer.id);
  upsertVisit(state.visitDrawer);
  drawer.innerHTML = visitDrawerContent(state.visitDrawer);
  hydrateIcons(drawer);
}
async function saveVisitForm(event) {
  event.preventDefault();
  if (state.saving) return;
  const form = event.target;
  if (!form.reportValidity()) return;
  state.saving = true;
  try {
    const existing = state.visitDrawer && state.visitDrawer !== "new" ? state.visitDrawer : null;
    const saved = existing ? await marketingRepository.updateVisit(existing.id, visitFormInput(form)) : await marketingRepository.createVisit(visitFormInput(form));
    upsertVisit(saved);
    closeDrawer();
    notify(existing ? "Visita atualizada." : "Visita agendada.");
  } catch (error) {
    notify(error.message, true);
  } finally {
    state.saving = false;
  }
}
async function savePostForm(event) {
  event.preventDefault();
  if (state.saving) return;
  const form = event.target;
  if (!form.reportValidity()) return;
  state.saving = true;
  try {
    const existing = state.postDrawer && state.postDrawer !== "new" ? state.postDrawer : null;
    const saved = existing ? await marketingRepository.updatePost(existing.id, blogFormInput(form)) : await marketingRepository.createPost(blogFormInput(form));
    upsertPost(saved);
    closeDrawer();
    notify(existing ? "Artigo atualizado." : "Pauta criada.");
  } catch (error) {
    notify(error.message, true);
  } finally {
    state.saving = false;
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
  const platform = target.closest("[data-platform]");
  if (platform) {
    state.platformFilter = platform.dataset.platform || "all";
    updateUrl();
    render();
    return;
  }
  const day = target.closest("[data-day]");
  if (day) {
    state.day = day.dataset.day;
    updateUrl();
    render();
    return;
  }
  const visitElement = target.closest("[data-visit-id]");
  if (visitElement && !target.closest("[data-action]")) {
    await openVisit(visitElement.dataset.visitId);
    return;
  }
  const postElement = target.closest("[data-post-id]");
  if (postElement && !target.closest("[data-action]")) {
    const post = state.posts.find((item) => item.id === postElement.dataset.postId);
    if (post) openPost(post);
    return;
  }
  const storyElement = target.closest("[data-story-id]");
  if (storyElement && !target.closest("[data-action]")) {
    try {
      openDrawer(await apiStoryRepository.story(storyElement.dataset.storyId));
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  const button = target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "open-asana-task") {
    await openAsanaTask(button.dataset.asanaTaskId || "");
    return;
  }
  if (action === "new-planner-user") {
    openPlannerUserDialog();
    return;
  }
  if (action === "edit-planner-user") {
    const user = state.managedUsers.find((entry) => entry.id === button.dataset.userId);
    if (user) openPlannerUserDialog(user);
    return;
  }
  if (action === "reset-planner-password") {
    openPlannerPasswordDialog(button.dataset.userId || "");
    return;
  }
  if (action === "close-planner-user") {
    document.querySelector("#plannerUserDialog")?.close();
    return;
  }
  if (action === "close-planner-password") {
    document.querySelector("#plannerPasswordDialog")?.close();
    return;
  }
  if (action === "connect-calendar") {
    try {
      const result = await marketingRepository.connectCalendar();
      location.assign(result.authorization_url);
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (action === "disconnect-calendar") {
    if (!window.confirm("Desconectar sua agenda do Google Calendar?")) return;
    try {
      await marketingRepository.disconnectCalendar();
      state.calendar = await marketingRepository.calendarStatus();
      render();
      notify("Agenda desconectada.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (action === "connect-asana") {
    try {
      const result = await marketingRepository.connectAsana();
      location.assign(result.authorization_url);
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (action === "disconnect-asana") {
    if (!window.confirm("Desconectar sua conta do Asana deste Planner?")) return;
    try {
      await marketingRepository.disconnectAsana();
      state.asanaSetup = await marketingRepository.asanaSetup();
      state.asanaTasks = [];
      render();
      notify("Conta do Asana desconectada.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (["asana-prev-month", "asana-next-month", "asana-today"].includes(action || "")) {
    const date = action === "asana-today" ? fromIso(today) : fromIso(state.day);
    if (action !== "asana-today") {
      date.setDate(1);
      date.setMonth(date.getMonth() + (action === "asana-prev-month" ? -1 : 1));
    }
    state.day = isoDate(date);
    state.week = weekStart(state.day);
    updateUrl();
    void loadAsanaData();
    return;
  }
  if (action === "close-drawer") closeDrawer();
  if (action === "open-linked-story") {
    try {
      const story = await apiStoryRepository.story(button.dataset.linkedStoryId);
      openDrawer(story);
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (action === "new-visit" || action === "new-visit-day") {
    await openVisit(void 0, button.dataset.date || today);
    return;
  }
  if (action === "new-post") {
    openPost();
    return;
  }
  if (action === "visits-prev-week" || action === "visits-next-week" || action === "visits-today") {
    state.week = action === "visits-today" ? weekStart(today) : addDays(state.week, action === "visits-prev-week" ? -7 : 7);
    state.day = state.week;
    updateUrl();
    void loadData();
    return;
  }
  if (action === "visits-older" || action === "visits-newer") {
    state.day = addDays(state.day, action === "visits-older" ? -90 : 90);
    if (state.day > today) state.day = today;
    updateUrl();
    void loadData();
    return;
  }
  if (["visits-prev-month", "visits-next-month", "blog-prev-month", "blog-next-month"].includes(action || "")) {
    const date = fromIso(state.day);
    date.setDate(1);
    date.setMonth(date.getMonth() + (action?.includes("prev") ? -1 : 1));
    state.day = isoDate(date);
    state.week = weekStart(state.day);
    updateUrl();
    void loadData();
    return;
  }
  if (action === "blog-list" || action === "blog-calendar") {
    state.blogMode = action === "blog-list" ? "list" : "calendar";
    render();
    return;
  }
  const currentVisit = state.visitDrawer && state.visitDrawer !== "new" ? state.visitDrawer : null;
  if (currentVisit && action === "add-visit-item") {
    const title = drawer.querySelector("[name=new_item_title]")?.value.trim();
    if (!title) {
      notify("Informe o item de capta\xE7\xE3o.", true);
      return;
    }
    try {
      await marketingRepository.createItem(currentVisit.id, { title, content_type: drawer.querySelector("[name=new_item_type]")?.value.trim() || null, category_id: drawer.querySelector("[name=new_item_category]")?.value || null });
      await refreshVisitDrawer();
      notify("Item adicionado.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (currentVisit && action === "delete-visit-item") {
    if (!window.confirm("Excluir este item do checklist?")) return;
    try {
      await marketingRepository.deleteItem(currentVisit.id, button.dataset.itemId);
      await refreshVisitDrawer();
      notify("Item exclu\xEDdo.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (currentVisit && action === "link-visit-media") {
    const id = drawer.querySelector("[name=new_media_id]")?.value.trim();
    if (!id) return;
    try {
      await marketingRepository.linkMedia(currentVisit.id, id);
      await refreshVisitDrawer();
      notify("M\xEDdia vinculada.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (currentVisit && action === "unlink-visit-media") {
    try {
      await marketingRepository.unlinkMedia(currentVisit.id, button.dataset.mediaId);
      await refreshVisitDrawer();
      notify("V\xEDnculo removido.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (currentVisit && action === "sync-visit-calendar") {
    try {
      const result = await marketingRepository.syncVisitCalendar(currentVisit.id);
      await refreshVisitDrawer();
      notify(`${result.synced} agenda(s) sincronizada(s).${result.skipped ? ` ${result.skipped} respons\xE1vel(is) sem conex\xE3o.` : ""}`);
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (currentVisit && action === "delete-visit") {
    drawer.querySelector("#deleteConfirm").innerHTML = `<div class="dialog-inline">Excluir esta visita e seu checklist?<br><button type="button" class="button danger" data-action="confirm-delete-visit">Confirmar exclus\xE3o</button><button type="button" class="button" data-action="cancel-marketing-delete">Cancelar</button></div>`;
    return;
  }
  if (currentVisit && action === "confirm-delete-visit") {
    try {
      await marketingRepository.deleteVisit(currentVisit.id);
      state.visits = state.visits.filter((item) => item.id !== currentVisit.id);
      closeDrawer();
      render();
      notify("Visita exclu\xEDda.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  const currentPost = state.postDrawer && state.postDrawer !== "new" ? state.postDrawer : null;
  if (currentPost && action === "duplicate-post") {
    try {
      const copy = await marketingRepository.createPost({ ...currentPost, title: `${currentPost.title} (c\xF3pia)`, slug: `${currentPost.slug}-copia-${Date.now().toString(36)}`, status: "idea", published_at: null, published_url: null });
      upsertPost(copy);
      openPost(copy);
      notify("Artigo duplicado.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (currentPost && action === "archive-post") {
    try {
      const updated = await marketingRepository.updatePost(currentPost.id, { status: "archived" });
      upsertPost(updated);
      closeDrawer();
      notify("Artigo arquivado.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (currentPost && action === "delete-post") {
    drawer.querySelector("#deleteConfirm").innerHTML = `<div class="dialog-inline">Excluir este artigo?<br><button type="button" class="button danger" data-action="confirm-delete-post">Confirmar exclus\xE3o</button><button type="button" class="button" data-action="cancel-marketing-delete">Cancelar</button></div>`;
    return;
  }
  if (currentPost && action === "confirm-delete-post") {
    try {
      await marketingRepository.deletePost(currentPost.id);
      state.posts = state.posts.filter((item) => item.id !== currentPost.id);
      closeDrawer();
      render();
      notify("Artigo exclu\xEDdo.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (action === "cancel-marketing-delete") {
    drawer.querySelector("#deleteConfirm").innerHTML = "";
    return;
  }
  if (action === "new") openDrawer("new", state.view === "week" && (today < state.week || today > addDays(state.week, 6)) ? state.week : today);
  if (action === "new-cell") openDrawer("new", button.dataset.date, button.dataset.hotel);
  if (action === "campaign-prev" || action === "campaign-next" || action === "campaign-today") {
    state.campaignStart = action === "campaign-today" ? weekStart(today) : addDays(state.campaignStart, action === "campaign-prev" ? -28 : 28);
    updateUrl();
    render();
    return;
  }
  if (action === "prev-week" || action === "next-week" || action === "today") {
    state.week = action === "today" ? weekStart(today) : addDays(state.week, action === "prev-week" ? -7 : 7);
    state.day = state.week;
    updateUrl();
    void loadData();
  }
  if (action === "prev-month" || action === "next-month") {
    const d = fromIso(state.day);
    d.setDate(1);
    d.setMonth(d.getMonth() + (action === "prev-month" ? -1 : 1));
    state.day = isoDate(d);
    state.week = weekStart(state.day);
    updateUrl();
    void loadData();
  }
  const current = state.drawer && state.drawer !== "new" ? state.drawer : null;
  if (current && action === "mark-ready") await patchStory(current, { status: "ready" }, "Marcado como pronto.");
  if (current && action === "mark-published") await patchStory(current, { status: "published", published_at: (/* @__PURE__ */ new Date()).toISOString() }, "Marcado como publicado.");
  if (current && action === "duplicate") {
    const copy = { ...current, title: `${current.title} (c\xF3pia)`, status: "idea", published_at: null, published_url: null, sequence_group_id: null, sequence_position: null };
    try {
      const created = await apiStoryRepository.create(copy);
      const saved = await apiStoryRepository.saveChannels(created.id, (current.channels || []).map((channel) => ({ ...channel, status: "idea", published_at: null, published_url: null })));
      state.stories.push(saved);
      render();
      notify("Conte\xFAdo duplicado.");
      openDrawer(saved);
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
      const response = await fetch(`/api/v1/social-planner/media?hotel_id=${encodeURIComponent(hotelId)}`, { credentials: "same-origin" });
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
  if (target.id === "asanaHotelFilter") {
    state.asanaHotelFilter = target.value;
    updateUrl();
    void loadAsanaData();
    return;
  }
  if (target.dataset.visitFilter) {
    state.visitFilter = target.value;
    updateUrl();
    render();
    return;
  }
  if (target.dataset.blogFilter) {
    state.blogFilters[target.dataset.blogFilter] = target.value;
    updateUrl();
    render();
    return;
  }
  if (target.dataset.itemToggle && state.visitDrawer && state.visitDrawer !== "new") {
    const visitId = state.visitDrawer.id, checked = target.checked;
    void marketingRepository.updateItem(visitId, target.dataset.itemToggle, { completed: checked ? 1 : 0 }).then(() => refreshVisitDrawer()).catch((error) => {
      target.checked = !checked;
      notify(error.message, true);
    });
    return;
  }
  if (target.name === "hotel_id" && state.drawer) {
    const select = drawer.querySelector("[name=source_visit_id]");
    if (select) {
      select.innerHTML = option("", "N\xE3o definido") + state.visits.filter((v) => v.hotel_id === target.value).map((v) => option(v.id, `${v.date} \xB7 ${v.title}`)).join("");
    }
  }
  if (!target.dataset.filter || target.dataset.filter === "search") return;
  state.filters[target.dataset.filter] = target.value;
  updateUrl();
  void loadData();
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
document.querySelector("#globalPlannerSearch").addEventListener("input", (event) => {
  state.filters.search = event.target.value;
  if (!["week", "calendar", "pending"].includes(state.view)) {
    state.view = "week";
    updateUrl();
    void loadData();
    return;
  }
  updateUrl();
  render();
  document.querySelector("#globalPlannerSearch")?.focus();
});
drawer.addEventListener("submit", (event) => {
  const id = event.target.id;
  if (id === "storyForm") void saveDrawer(event);
  if (id === "visitForm") void saveVisitForm(event);
  if (id === "blogForm") void savePostForm(event);
  if (id === "asanaTaskForm") void saveAsanaTaskForm(event);
});
document.addEventListener("submit", async (event) => {
  if (event.target.id === "plannerSettingsForm") {
    event.preventDefault();
    const form = event.target;
    const name = String(new FormData(form).get("display_name") || "").trim();
    try {
      const saved = await marketingRepository.saveSettings(name);
      state.displayName = saved.display_name;
      document.querySelector("#plannerName").textContent = saved.display_name;
      document.title = saved.display_name;
      render();
      notify("Nome atualizado.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (event.target.id === "asanaWorkspaceForm") {
    event.preventDefault();
    const form = event.target;
    const workspace = String(new FormData(form).get("workspace_gid") || "");
    try {
      state.asanaSetup = await marketingRepository.selectAsanaWorkspace(workspace);
      notify("Workspace do Asana atualizado.");
      await loadAsanaData();
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (event.target.id === "asanaProjectForm") {
    event.preventDefault();
    const form = event.target;
    const mappings = [...form.querySelectorAll("[data-asana-hotel]")].map((select) => ({ hotel_id: select.dataset.asanaHotel || "", project_gid: select.value || null }));
    try {
      state.asanaSetup = await marketingRepository.saveAsanaProjects(mappings);
      notify("Projetos das unidades atualizados.");
      await loadAsanaData();
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (event.target.id === "plannerUserForm") {
    event.preventDefault();
    const form = event.target;
    const dialog2 = form.closest("dialog");
    const data2 = new FormData(form);
    const input2 = { display_name: String(data2.get("display_name") || ""), email: String(data2.get("email") || ""), access_level: String(data2.get("access_level") || "editor"), status: String(data2.get("status") || "active"), password: String(data2.get("password") || "") };
    try {
      dialog2.dataset.userId ? await request(`/user-management/${encodeURIComponent(dialog2.dataset.userId)}`, "PATCH", input2) : await request("/user-management", "POST", input2);
      dialog2.close();
      await loadManagedUsers();
      notify("Usu\xE1rio salvo.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
  if (event.target.id === "plannerPasswordForm") {
    event.preventDefault();
    const form = event.target;
    const dialog2 = form.closest("dialog");
    const password = String(new FormData(form).get("password") || "");
    try {
      await request(`/user-management/${encodeURIComponent(dialog2.dataset.userId || "")}/password`, "PATCH", { password });
      dialog2.close();
      notify("Senha redefinida e sess\xF5es anteriores encerradas.");
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector("#globalPlannerSearch")?.focus();
  }
  if (event.key === "Escape" && (state.drawer || state.visitDrawer || state.postDrawer || state.asanaTaskDrawer)) closeDrawer();
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".story-card")) {
    event.preventDefault();
    const id = event.target.dataset.storyId;
    if (id) void apiStoryRepository.story(id).then(openDrawer).catch((error) => notify(error.message, true));
  }
});
document.addEventListener("dragstart", (event) => {
  const target = event.target;
  const asanaTask = target.closest(".asana-task");
  if (asanaTask?.dataset.asanaTaskId) {
    event.dataTransfer?.setData("application/x-fioreze-asana", asanaTask.dataset.asanaTaskId);
    event.dataTransfer.effectAllowed = "move";
    asanaTask.classList.add("dragging");
    return;
  }
  const blog = target.closest(".kanban-card");
  if (blog) {
    event.dataTransfer?.setData("application/x-fioreze-blog", blog.dataset.postId || "");
    event.dataTransfer.effectAllowed = "move";
    return;
  }
  const card2 = target.closest(".story-card");
  if (!card2) return;
  event.dataTransfer?.setData("text/plain", card2.dataset.storyId || "");
  event.dataTransfer.effectAllowed = "move";
  card2.classList.add("dragging");
});
document.addEventListener("dragend", (event) => {
  event.target.closest(".story-card, .asana-task")?.classList.remove("dragging");
  document.querySelectorAll(".drag-over").forEach((item) => item.classList.remove("drag-over"));
});
document.addEventListener("dragover", (event) => {
  const cell = event.target.closest(".day-cell, .kanban-column, .asana-calendar-day");
  if (!cell) return;
  event.preventDefault();
  cell.classList.add("drag-over");
});
document.addEventListener("dragleave", (event) => {
  const cell = event.target.closest(".day-cell, .kanban-column, .asana-calendar-day");
  if (cell && !cell.contains(event.relatedTarget)) cell.classList.remove("drag-over");
});
document.addEventListener("drop", (event) => {
  const element = event.target;
  const asanaDay = element.closest(".asana-calendar-day");
  const asanaTaskId = event.dataTransfer?.getData("application/x-fioreze-asana");
  if (asanaDay && asanaTaskId) {
    event.preventDefault();
    asanaDay.classList.remove("drag-over");
    void moveAsanaTaskToDate(asanaTaskId, asanaDay.dataset.asanaDate || "");
    return;
  }
  const blogColumn = element.closest(".kanban-column");
  if (blogColumn) {
    event.preventDefault();
    blogColumn.classList.remove("drag-over");
    const id2 = event.dataTransfer?.getData("application/x-fioreze-blog"), post = state.posts.find((p) => p.id === id2);
    if (post && blogColumn.dataset.blogStatus && post.status !== blogColumn.dataset.blogStatus) {
      const previous = state.posts.map((p) => ({ ...p }));
      post.status = blogColumn.dataset.blogStatus;
      render();
      void marketingRepository.updatePost(post.id, { status: post.status }).then((saved) => {
        upsertPost(saved);
        notify("Etapa do artigo atualizada.");
      }).catch((error) => {
        state.posts = previous;
        render();
        notify(`Altera\xE7\xE3o revertida: ${error.message}`, true);
      });
    }
    return;
  }
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
var plannerApp = document.querySelector("#plannerApp");
var plannerLogin = document.querySelector("#plannerLogin");
var plannerLoginForm = document.querySelector("#plannerLoginForm");
var plannerLoginError = document.querySelector("#plannerLoginError");
plannerLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  plannerLoginError.hidden = true;
  const submit = plannerLoginForm.querySelector("button[type=submit]");
  submit.disabled = true;
  const data = new FormData(plannerLoginForm);
  try {
    const response = await fetch("/api/v1/social-planner/login", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-fioreze-admin-action": "erp-admin" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password"), remember_me: data.get("remember_me") === "on" }) });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "N\xE3o foi poss\xEDvel entrar.");
    state.session = payload.data;
    await initializePlanner();
  } catch (error) {
    plannerLoginError.textContent = error.message;
    plannerLoginError.hidden = false;
  } finally {
    submit.disabled = false;
  }
});
document.querySelector("#plannerLogout").addEventListener("click", async () => {
  if (state.session?.auth_source === "admin-master") {
    location.assign("/admin/");
    return;
  }
  await fetch("/api/v1/social-planner/logout", { method: "POST", credentials: "same-origin", headers: { "x-fioreze-admin-action": "erp-admin" } });
  state.session = null;
  plannerApp.hidden = true;
  plannerLogin.hidden = false;
  plannerLoginForm.reset();
});
async function start() {
  hydrateIcons(document);
  try {
    const response = await fetch("/api/v1/social-planner/session", { credentials: "same-origin" });
    if (response.status === 401) {
      plannerApp.hidden = true;
      plannerLogin.hidden = false;
      return;
    }
    const payload = await response.json();
    if (!payload.ok || !payload.data.permissions.includes("social-planner.read")) throw new Error("Acesso ao Marketing Planner n\xE3o liberado.");
    state.session = payload.data;
    await initializePlanner();
  } catch (error) {
    state.loading = false;
    main.innerHTML = `<div class="empty-state"><h2>N\xE3o foi poss\xEDvel abrir o planner</h2><p>${escapeHtml(error.message)}</p><a class="button" href="/socialplanner/overview">Tentar novamente</a></div>`;
  }
}
async function initializePlanner() {
  plannerLogin.hidden = true;
  plannerApp.hidden = false;
  document.querySelector("#currentUser").textContent = state.session?.user.display_name || "Marketing";
  document.querySelector(".user-avatar").textContent = (state.session?.user.display_name || "M").slice(0, 1).toUpperCase();
  document.querySelector("#centralAdminLink").hidden = state.session?.auth_source !== "admin-master";
  if (state.view === "users" && !state.session?.permissions.includes("social-planner.users.manage")) state.view = "overview";
  [state.hotels, state.categories, state.pillars, state.channels, state.users, state.campaigns, state.sequences, { display_name: state.displayName }, state.calendar] = await Promise.all([apiStoryRepository.hotels(), apiStoryRepository.categories(), apiStoryRepository.pillars(), apiStoryRepository.channels(), apiStoryRepository.users(), apiStoryRepository.campaigns(), apiStoryRepository.sequences(), marketingRepository.settings(), marketingRepository.calendarStatus()]);
  document.querySelector("#plannerName").textContent = state.displayName;
  document.title = state.displayName;
  if (state.view === "users") await loadManagedUsers();
  else if (state.view === "asana-calendar") await loadAsanaData();
  else await loadData();
  if (params.get("calendar") === "connected") notify("Google Calendar conectado \xE0 sua conta.");
  if (params.get("calendar") === "error") notify("N\xE3o foi poss\xEDvel concluir a conex\xE3o com o Google Calendar.", true);
  if (params.get("asana") === "connected") notify("Asana conectado \xE0 sua conta.");
  if (params.get("asana") === "error") notify("N\xE3o foi poss\xEDvel concluir a conex\xE3o com o Asana.", true);
  if (planningAlerts()) notify(`${planningAlerts()} Story(s) de hoje ainda est\xE3o como Ideia.`);
}
void start();
