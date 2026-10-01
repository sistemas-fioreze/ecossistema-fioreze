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
  story: (id) => request(`/stories/${encodeURIComponent(id)}`),
  create: (input) => request("/stories", "POST", input),
  update: (id, input) => request(`/stories/${encodeURIComponent(id)}`, "PATCH", input),
  remove: (id) => request(`/stories/${encodeURIComponent(id)}`, "DELETE"),
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
  return `<button class="visit-card" data-visit-id="${escapeHtml(visit.id)}"><span class="visit-time">${escapeHtml(visit.start_time || "Hor\xE1rio livre")}${visit.end_time ? `\u2013${escapeHtml(visit.end_time)}` : ""}</span><strong>${escapeHtml(visit.hotel_name)}</strong><span>${escapeHtml(visit.title)}</span><small>${escapeHtml(visit.responsible_name || "Sem respons\xE1vel")} \xB7 ${visitLabels[visit.status]}</small>${visit.item_count ? `<small>Checklist ${visit.completed_item_count}/${visit.item_count}</small>` : ""}</button>`;
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
  return `<div class="drawer-header"><div><small>${visit ? "Editar visita" : "Nova visita"}</small><h2 id="drawerTitle">${escapeHtml(visit?.title || "Agendar capta\xE7\xE3o")}</h2></div><button class="icon-button" data-action="close-drawer" aria-label="Fechar">\xD7</button></div><form id="visitForm"><div class="drawer-body"><section class="drawer-section"><h3>Planejamento</h3><div class="form-grid">${inputField("title", "Objetivo principal / t\xEDtulo", visit?.title, "text", true, true)}${selectField("hotel_id", "Hotel", visit?.hotel_id, ctx.hotels, true)}${inputField("date", "Data", visit?.date || createDate, "date", false, true)}${inputField("start_time", "In\xEDcio", visit?.start_time, "time")}${inputField("end_time", "T\xE9rmino", visit?.end_time, "time")}${selectField("status", "Status", visit?.status || "planned", statuses, true)}${selectField("priority", "Prioridade", visit?.priority || "normal", priorities, true)}${selectField("responsible_user_id", "Respons\xE1vel", visit?.responsible_user_id, ctx.users)}${selectField("campaign_id", "Campanha", visit?.campaign_id, ctx.campaigns)}</div></section><section class="drawer-section"><h3>Detalhes</h3><div class="form-grid">${inputField("description", "Descri\xE7\xE3o", visit?.description, "textarea", true)}${inputField("notes", "Observa\xE7\xF5es", visit?.notes, "textarea", true)}</div></section>${visit ? `<section class="drawer-section"><h3>Checklist de capta\xE7\xE3o <span class="subtle">${visit.completed_item_count}/${visit.item_count}</span></h3><div class="visit-checklist">${items.map((item) => `<div class="checklist-row"><label><input type="checkbox" data-item-toggle="${escapeHtml(item.id)}" ${item.completed ? "checked" : ""}><span>${escapeHtml(item.title)}</span></label><small>${escapeHtml(item.content_type || "")}${item.required ? " \xB7 Necess\xE1rio" : ""}</small><button type="button" class="icon-button" data-action="delete-visit-item" data-item-id="${escapeHtml(item.id)}" aria-label="Excluir item">\xD7</button></div>`).join("") || '<p class="subtle">Adicione o que precisa ser captado.</p>'}</div><div class="form-grid compact">${inputField("new_item_title", "Novo item", "", "text", true)}${inputField("new_item_type", "Tipo de conte\xFAdo", "")}${selectField("new_item_category", "Categoria", null, ctx.categories)}</div><button type="button" class="button" data-action="add-visit-item">+ Adicionar item</button></section><section class="drawer-section"><h3>M\xEDdias captadas</h3><div class="visit-media">${(visit.media_assets || []).map((asset) => `<div class="media-link"><a href="${escapeHtml(asset.public_url)}" target="_blank" rel="noopener">${escapeHtml(asset.alt_text || asset.id)}</a><button type="button" class="icon-button" data-action="unlink-visit-media" data-media-id="${escapeHtml(asset.id)}" aria-label="Remover v\xEDnculo">\xD7</button></div>`).join("") || '<p class="subtle">Nenhuma m\xEDdia vinculada.</p>'}</div>${inputField("new_media_id", "ID da m\xEDdia existente", "", "text", true)}<button type="button" class="button" data-action="link-visit-media">Vincular m\xEDdia</button></section>` : '<p class="drawer-hint">Salve a visita para criar o checklist e vincular m\xEDdias.</p>'}<div id="deleteConfirm"></div></div><div class="drawer-actions">${visit ? '<button type="button" class="button danger" data-action="delete-visit">Excluir</button>' : ""}<button type="submit" class="button primary">Salvar visita</button></div></form>`;
}
function visitFormInput(form) {
  return formValues(form, ["hotel_id", "date", "start_time", "end_time", "title", "description", "responsible_user_id", "status", "priority", "campaign_id", "notes"]);
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

// social-planner/app.ts
var views = { overview: "Vis\xE3o Geral", week: "Redes \xB7 Semana", calendar: "Redes \xB7 Calend\xE1rio", pending: "Redes \xB7 Pend\xEAncias", "visits-week": "Visitas \xB7 Semana", "visits-calendar": "Visitas \xB7 Calend\xE1rio", "visits-history": "Visitas \xB7 Hist\xF3rico", "blog-schedule": "Blog \xB7 Cronograma", "blog-ideas": "Blog \xB7 Pautas", "blog-published": "Blog \xB7 Publicados", campaigns: "Campanhas", assets: "Banco de conte\xFAdos", hotels: "Hot\xE9is", categories: "Categorias", performance: "Desempenho", settings: "Configura\xE7\xF5es" };
var today = isoDate(/* @__PURE__ */ new Date());
var params = new URLSearchParams(location.search);
var initialWeek = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") || "") ? params.get("week") : today;
var state = {
  view: location.pathname.split("/").filter(Boolean).at(-1) || "week",
  week: weekStart(initialWeek),
  day: /^\d{4}-\d{2}-\d{2}$/.test(params.get("day") || "") ? params.get("day") : today,
  filters: { hotel_id: params.get("hotel") || "all", status: params.get("status") || "all", category_id: params.get("category") || "all", responsible_user_id: params.get("responsible") || "all", campaign_id: params.get("campaign") || "all", search: params.get("q") || "" },
  hotels: [],
  categories: [],
  pillars: [],
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
  if (view === "visits-history" && state.view !== view) state.day = today;
  state.view = view;
  document.querySelector("#sidebar")?.classList.remove("mobile-open");
  updateUrl();
  if (["week", "calendar", "pending", "overview", "visits-week", "visits-calendar", "visits-history", "blog-schedule", "blog-ideas", "blog-published"].includes(view)) void loadData();
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
  if (state.visitFilter !== "all") query.set("visit_hotel", state.visitFilter);
  for (const [key, urlKey] of [["hotel_id", "blog_hotel"], ["status", "blog_status"], ["category_id", "blog_category"], ["author_user_id", "blog_author"], ["campaign_id", "blog_campaign"]]) {
    if (state.blogFilters[key] && state.blogFilters[key] !== "all") query.set(urlKey, state.blogFilters[key]);
  }
  history.replaceState({}, "", `/admin/social-planner/${state.view}?${query}`);
}
function renderNavigation() {
  const groups = [
    ["", [["overview", "Vis\xE3o Geral", "grid"]]],
    ["Redes Sociais", [["week", "Semana", "grid"], ["calendar", "Calend\xE1rio", "calendar"], ["pending", "Pend\xEAncias", "alert"]]],
    ["Agenda de Hot\xE9is", [["visits-week", "Semana", "hotel"], ["visits-calendar", "Calend\xE1rio", "calendar"], ["visits-history", "Hist\xF3rico", "check"]]],
    ["Blog", [["blog-schedule", "Cronograma", "calendar"], ["blog-ideas", "Pautas", "grid"], ["blog-published", "Publicados", "check"]]],
    ["Conte\xFAdo", [["assets", "Banco de conte\xFAdos", "image"], ["campaigns", "Campanhas", "flag"]]],
    ["An\xE1lise", [["performance", "Desempenho", "grid"]]],
    ["Administra\xE7\xE3o", [["hotels", "Hot\xE9is", "hotel"], ["categories", "Categorias", "tag"], ["users", "Usu\xE1rios", "users"], ["settings", "Configura\xE7\xF5es", "settings"]]]
  ];
  const targets = { users: "/admin/usuarios/" };
  document.querySelector("#navigation").innerHTML = groups.map(([title, items]) => `<div class="nav-group">${title ? `<span class="nav-heading">${title}</span>` : ""}${items.map(([key, label, symbol]) => `<a class="nav-link ${state.view === key ? "active" : ""}" href="${targets[key] || `/admin/social-planner/${key}`}" ${targets[key] ? "" : `data-view="${key}"`} title="${label}">${icon(symbol)}<span class="nav-label">${label}</span></a>`).join("")}</div>`).join("");
  document.querySelector("#viewTitle").textContent = views[state.view];
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
  return `<div class="page-heading"><div><p class="eyebrow">Conte\xFAdo</p><h1>Campanhas</h1><p class="subtle">Uma campanha conecta Stories, visitas e artigos em diferentes hot\xE9is.</p></div><button class="button primary" data-action="new-campaign">${icon("plus")} Nova campanha</button></div><div class="campaign-grid">${state.campaigns.map((campaign) => `<article class="campaign-card"><h2>${escapeHtml(campaign.name)}</h2><p>${escapeHtml(campaign.description || "Sem descri\xE7\xE3o")}</p><p>${escapeHtml(campaign.start_date || "Sem in\xEDcio")} \u2014 ${escapeHtml(campaign.end_date || "Sem fim")}</p><div class="campaign-stats"><span>${campaign.story_count} stories \xB7 ${campaign.published_count} publicados</span><span>${campaign.visit_count} visitas</span><span>${campaign.article_count} artigos</span><span>${campaign.hotel_count} hot\xE9is</span></div><button type="button" class="button" data-action="edit-campaign" data-campaign-id="${escapeHtml(campaign.id)}" style="margin-top:14px">Editar campanha</button></article>`).join("")}</div>${!state.campaigns.length ? '<div class="empty-state"><h2>Nenhuma campanha cadastrada.</h2><p>Crie uma campanha para conectar Stories, visitas e artigos.</p><button class="button primary" data-action="new-campaign">Nova campanha</button></div>' : ""}`;
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
function settingsView() {
  return `<div class="page-heading"><div><p class="eyebrow">Administra\xE7\xE3o</p><h1>Configura\xE7\xF5es</h1><p class="subtle">Identidade do Marketing Planner e acesso \xE0 administra\xE7\xE3o central.</p></div></div><section class="section-card"><h2>Nome da aplica\xE7\xE3o</h2><form id="plannerSettingsForm" class="settings-form"><label><span>Nome exibido</span><input name="display_name" value="${escapeHtml(state.displayName)}" maxlength="100" required></label><button class="button primary" type="submit">Salvar nome</button></form></section><section class="section-card"><h2>Usu\xE1rios e permiss\xF5es</h2><p class="subtle">O acesso usa os perfis administrativos da plataforma.</p><a class="button" href="/admin/configuracoes/">Abrir administra\xE7\xE3o central</a></section>`;
}
function emptyState(message) {
  return `<div class="empty-state"><h2>${escapeHtml(message)}</h2><p>Crie um Story para come\xE7ar o planejamento.</p><button class="button primary" data-action="new">Novo story</button></div>`;
}
function visitContext() {
  return { visits: state.visits, hotels: state.hotels, categories: state.categories, users: state.users, campaigns: state.campaigns, week: state.week, day: state.day, today, filter: state.visitFilter, view: state.view };
}
function blogContext() {
  return { posts: state.posts, hotels: state.hotels, categories: state.categories, users: state.users, campaigns: state.campaigns, day: state.day, today, view: state.view, mode: state.blogMode, filters: state.blogFilters };
}
function render() {
  renderNavigation();
  if (state.loading) {
    main.innerHTML = '<div class="loading-shell"><div class="skeleton title"></div><div class="skeleton toolbar"></div><div class="skeleton grid"></div></div>';
    return;
  }
  if (state.view.startsWith("visits-")) main.innerHTML = visitsView(visitContext());
  else if (state.view.startsWith("blog-")) main.innerHTML = blogView(blogContext());
  else if (state.view === "overview") main.innerHTML = overviewView(state.stories, state.visits, state.posts, state.hotels, today, state.week);
  else main.innerHTML = { week: weekView, calendar: calendarView, pending: pendingView, campaigns: campaignsView, assets: assetsView, hotels: hotelsView, categories: categoriesView, performance: performanceView, settings: settingsView }[state.view]?.() || "";
}
function openDrawer(story, date = today, hotel = "") {
  state.visitDrawer = null;
  state.postDrawer = null;
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
  state.visitDrawer = null;
  state.postDrawer = null;
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
    state.createDate = date;
    state.visitDrawer = id ? await marketingRepository.visit(id) : "new";
    drawer.innerHTML = visitDrawerContent(state.visitDrawer === "new" ? null : state.visitDrawer);
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
  state.postDrawer = post || "new";
  drawer.innerHTML = blogDrawer(post || null, blogContext());
  drawer.hidden = false;
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  drawer.querySelector("[name=title]")?.focus();
}
function field(name, label, value, kind = "text", full = false) {
  const escaped = escapeHtml(value);
  const required = ["title", "hotel_id", "date"].includes(name) ? "required" : "";
  return `<label class="${full ? "full" : ""}"><span>${label}${required ? " *" : ""}</span>${kind === "textarea" ? `<textarea name="${name}">${escaped}</textarea>` : `<input name="${name}" type="${kind}" value="${escaped}" ${required}>`}</label>`;
}
function selectField2(name, label, value, values, required = false) {
  return `<label><span>${label}${required ? " *" : ""}</span><select name="${name}" ${required ? "required" : ""}>${required ? option("", "Selecione", value || "") : option("", "N\xE3o definido", value || "")}${value && !values.some((item) => item.id === value) ? option(value, "V\xEDnculo existente", value) : ""}${values.map((item) => option(item.id, item.name, value || "")).join("")}</select></label>`;
}
function renderDrawer() {
  const story = state.drawer === "new" ? null : state.drawer;
  if (!state.drawer) return;
  const formatOptions = Object.entries(formatLabels).map(([id, name]) => ({ id, name }));
  const objectiveOptions = Object.entries(objectiveLabels).map(([id, name]) => ({ id, name }));
  const statusOptions = Object.entries(statusLabels).map(([id, name]) => ({ id, name }));
  const priorityOptions = Object.entries(priorityLabels).map(([id, name]) => ({ id, name }));
  drawer.innerHTML = `<div class="drawer-header"><div><small>${story ? "Editar story" : "Novo story"}</small><h2 id="drawerTitle">${escapeHtml(story?.title || "Planejar Story")}</h2></div><button class="icon-button" data-action="close-drawer" aria-label="Fechar">${icon("close")}</button></div><form id="storyForm"><div class="drawer-body"><section class="drawer-section"><h3>Planejamento</h3><div class="form-grid">${selectField2("hotel_id", "Hotel", story?.hotel_id || state.createHotel, state.hotels, true)}${field("date", "Data", story?.date || state.createDate, "date")}${field("planned_time", "Hor\xE1rio planejado", story?.planned_time, "time")}${selectField2("status", "Status", story?.status || "idea", statusOptions)}${selectField2("priority", "Prioridade", story?.priority || "normal", priorityOptions)}</div></section><section class="drawer-section"><h3>Conte\xFAdo</h3><div class="form-grid">${field("title", "T\xEDtulo interno", story?.title, "text", true)}${field("description", "Descri\xE7\xE3o / ideia", story?.description, "textarea", true)}${field("story_text", "Texto sugerido", story?.story_text, "textarea", true)}${selectField2("category_id", "Categoria", story?.category_id || null, state.categories)}${selectField2("content_pillar_id", "Pilar de conte\xFAdo", story?.content_pillar_id || null, state.pillars)}${selectField2("format", "Formato", story?.format || null, formatOptions)}${selectField2("objective", "Objetivo", story?.objective || null, objectiveOptions)}${field("cta", "CTA", story?.cta)}${field("link", "Link", story?.link, "url", true)}</div></section><section class="drawer-section"><h3>M\xEDdia</h3><div class="form-grid">${field("media_asset_id", "ID da m\xEDdia na biblioteca", story?.media_asset_id, "text", true)}</div><p class="drawer-hint">O arquivo \xE9 armazenado na biblioteca R2 existente e pode ser reutilizado em outros Stories.</p>${story?.thumbnail_url ? `<img src="${escapeHtml(story.thumbnail_url)}" alt="Pr\xE9via da m\xEDdia" style="max-height:100px;border-radius:7px;margin-top:10px">` : ""}</section><section class="drawer-section"><h3>Respons\xE1vel</h3><div class="form-grid">${selectField2("responsible_user_id", "Pessoa respons\xE1vel", story?.responsible_user_id || null, state.users)}</div></section><section class="drawer-section"><h3>Publica\xE7\xE3o</h3><div class="form-grid">${selectField2("campaign_id", "Campanha", story?.campaign_id || null, state.campaigns)}${field("published_at", "Publicado em (ISO)", story?.published_at)}${field("published_url", "URL publicada", story?.published_url, "url", true)}</div></section><section class="drawer-section"><h3>Sequ\xEAncia</h3><div class="form-grid">${selectField2("sequence_group_id", "Grupo", story?.sequence_group_id || null, state.sequences.map((sequence) => ({ id: sequence.id, name: sequence.title })))}${field("sequence_position", "Posi\xE7\xE3o", story?.sequence_position)}</div><button type="button" class="button" data-action="new-sequence" style="margin-top:10px">Criar sequ\xEAncia</button></section><section class="drawer-section"><h3>Origem</h3><div class="form-grid">${selectField2("source_visit_id", "Visita de capta\xE7\xE3o", story?.source_visit_id || null, state.visits.filter((visit) => visit.hotel_id === (story?.hotel_id || state.createHotel)).map((visit) => ({ id: visit.id, name: `${visit.date} \xB7 ${visit.title}` })))}</div></section><section class="drawer-section"><h3>Informa\xE7\xF5es adicionais</h3><div class="form-grid">${field("notes", "Observa\xE7\xF5es", story?.notes, "textarea", true)}</div></section><div id="deleteConfirm"></div></div><div class="drawer-actions">${story ? `<button type="button" class="button" data-action="duplicate">Duplicar</button><button type="button" class="button" data-action="mark-ready">Pronto</button><button type="button" class="button" data-action="mark-published">Publicado</button><button type="button" class="button danger" data-action="delete">Excluir</button>` : ""}<button type="submit" class="button primary">${state.saving ? "Salvando..." : "Salvar story"}</button></div></form>`;
  const mediaSection = drawer.querySelector(".drawer-section:nth-of-type(3)");
  mediaSection?.insertAdjacentHTML("beforeend", '<button type="button" class="button" data-action="choose-media" style="margin-top:10px">Escolher da biblioteca</button><div id="mediaChoices"></div>');
  if (story?.sequence_group_id) drawer.querySelector(".drawer-actions")?.insertAdjacentHTML("afterbegin", '<button type="button" class="button" data-action="duplicate-sequence">Duplicar sequ\xEAncia</button>');
  if (story) drawer.querySelector(".drawer-actions")?.insertAdjacentHTML("afterbegin", '<button type="button" class="button" data-action="move">Mover</button>');
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
    const story = state.stories.find((item) => item.id === storyElement.dataset.storyId);
    if (story) openDrawer(story);
    return;
  }
  const button = target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
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
drawer.addEventListener("submit", (event) => {
  const id = event.target.id;
  if (id === "storyForm") void saveDrawer(event);
  if (id === "visitForm") void saveVisitForm(event);
  if (id === "blogForm") void savePostForm(event);
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
  if (event.key === "Escape" && (state.drawer || state.visitDrawer || state.postDrawer)) closeDrawer();
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".story-card")) {
    event.preventDefault();
    const story = state.stories.find((item) => item.id === event.target.dataset.storyId);
    if (story) openDrawer(story);
  }
});
document.addEventListener("dragstart", (event) => {
  const blog = event.target.closest(".kanban-card");
  if (blog) {
    event.dataTransfer?.setData("application/x-fioreze-blog", blog.dataset.postId || "");
    event.dataTransfer.effectAllowed = "move";
    return;
  }
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
  const cell = event.target.closest(".day-cell, .kanban-column");
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
    [state.hotels, state.categories, state.pillars, state.users, state.campaigns, state.sequences, { display_name: state.displayName }] = await Promise.all([apiStoryRepository.hotels(), apiStoryRepository.categories(), apiStoryRepository.pillars(), apiStoryRepository.users(), apiStoryRepository.campaigns(), apiStoryRepository.sequences(), marketingRepository.settings()]);
    document.querySelector("#plannerName").textContent = state.displayName;
    document.title = state.displayName;
    await loadData();
    if (planningAlerts()) notify(`${planningAlerts()} Story(s) de hoje ainda est\xE3o como Ideia.`);
  } catch (error) {
    state.loading = false;
    main.innerHTML = `<div class="empty-state"><h2>N\xE3o foi poss\xEDvel abrir o planner</h2><p>${escapeHtml(error.message)}</p><a class="button" href="/admin/">Voltar \xE0 Central</a></div>`;
  }
}
void start();
