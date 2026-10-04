import type { BlogInput, BlogPost, Campaign, Category, Hotel, User } from "./types";
import { escapeHtml as e, option } from "./utils";
import { formValues, heading, inputField, selectField } from "./marketing-ui";

export interface BlogContext { posts: BlogPost[]; hotels: Hotel[]; categories: Category[]; campaigns: Campaign[]; users: User[]; day: string; today: string; view: "blog-schedule" | "blog-ideas" | "blog-published"; mode: "list" | "calendar"; filters: Record<string, string> }

const editorialStatuses = [
  { id: "briefing", name: "Pauta" },
  { id: "review", name: "Aguardando aprovação" },
  { id: "published", name: "Publicado" },
];

function canonicalStatus(status: BlogPost["status"]): "briefing" | "review" | "published" | "archived" {
  if (status === "published" || status === "archived") return status;
  if (["review", "ready", "scheduled"].includes(status)) return "review";
  return "briefing";
}

function filterBar(ctx: BlogContext): string {
  const select = (key: string, label: string, options: { id: string; name: string }[]) => `<select data-blog-filter="${key}" aria-label="${label}">${option("all", label, ctx.filters[key] || "all")}${options.map((item) => option(item.id, item.name, ctx.filters[key] || "all")).join("")}</select>`;
  return `<div class="filter-panel blog-filters">${select("hotel_id", "Todas as unidades", ctx.hotels)}${select("author_user_id", "Todos os responsáveis", ctx.users)}${select("status", "Todos os status", [...editorialStatuses, { id: "archived", name: "Arquivado" }])}${select("document", "Todos os arquivos", [{ id: "attached", name: "Com artigo anexado" }, { id: "missing", name: "Sem artigo anexado" }])}</div>`;
}

function matchesFilters(post: BlogPost, filters: Record<string, string>): boolean {
  if (filters.hotel_id && filters.hotel_id !== "all" && post.hotel_id !== filters.hotel_id) return false;
  if (filters.author_user_id && filters.author_user_id !== "all" && post.author_user_id !== filters.author_user_id) return false;
  if (filters.status && filters.status !== "all" && canonicalStatus(post.status) !== filters.status) return false;
  if (filters.document === "attached" && !post.article_file_name) return false;
  if (filters.document === "missing" && post.article_file_name) return false;
  return post.status !== "archived" || filters.status === "archived";
}

function articleState(post: BlogPost): { label: string; kind: string } {
  const status = canonicalStatus(post.status);
  return ({ briefing: { label: "Pauta", kind: "briefing" }, review: { label: "Aguardando aprovação", kind: "review" }, published: { label: "Publicado", kind: "published" }, archived: { label: "Arquivado", kind: "archived" } })[status];
}

function postRow(post: BlogPost): string {
  const state = articleState(post);
  const planned = post.planned_publish_date ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${post.planned_publish_date}T12:00:00`)) : "Sem data";
  return `<button class="article-row" data-post-id="${e(post.id)}"><span class="article-main"><strong>${e(post.title)}</strong><small>${e(post.briefing || "Pauta sem orientações adicionais.")}</small></span><span>${e(post.hotel_name || "Toda a rede")}</span><span>${e(post.author_name || "Sem responsável")}</span><span class="article-file-name">${post.article_file_name ? `<i data-lucide="file-check-2" aria-hidden="true"></i>${e(post.article_file_name)}` : '<i data-lucide="file-plus-2" aria-hidden="true"></i>Adicionar arquivo'}</span><span class="status-pill" data-status="${state.kind}">${state.label}</span><time datetime="${e(post.planned_publish_date || "")}">${e(planned)}</time></button>`;
}

export function blogView(ctx: BlogContext): string {
  const posts = ctx.posts.filter((post) => matchesFilters(post, ctx.filters));
  return `${heading("Produção", "Artigos", "Crie a pauta, acompanhe a aprovação e anexe o artigo final em PDF ou DOCX.", "new-post", "Nova pauta")}${filterBar(ctx)}<div class="article-list"><div class="article-row article-table-head"><span>Pauta</span><span>Unidade</span><span>Responsável</span><span>Arquivo</span><span>Status</span><span>Previsão</span></div>${posts.length ? posts.map(postRow).join("") : '<div class="empty-state"><h2>Nenhuma pauta neste filtro.</h2><p>Crie uma pauta para começar um novo artigo.</p></div>'}</div>`;
}

function fileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function blogDrawer(post: BlogPost | null, ctx: BlogContext): string {
  const currentFile = post?.article_file_name ? `<div class="article-current-file"><i data-lucide="file-text" aria-hidden="true"></i><span><strong>${e(post.article_file_name)}</strong><small>${e(fileSize(post.article_size_bytes))}</small></span><a class="button" href="${e(post.article_download_url || "#")}">Baixar</a><button type="button" class="icon-button" data-action="remove-post-document" aria-label="Remover arquivo"><i data-lucide="trash-2" aria-hidden="true"></i></button></div>` : "";
  const selectedStatus = canonicalStatus(post?.status || "briefing");
  const statusOptions = selectedStatus === "archived" ? [...editorialStatuses, { id: "archived", name: "Arquivado" }] : editorialStatuses;
  return `<div class="drawer-header"><div><small>${post ? "Editar pauta" : "Nova pauta"}</small><h2 id="drawerTitle">${e(post?.title || "Planejar artigo")}</h2></div><button class="icon-button" data-action="close-drawer" aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button></div><form id="blogForm"><div class="drawer-body"><section class="drawer-section"><h3>Pauta</h3><div class="form-grid">${inputField("title", "Título da pauta", post?.title, "text", true, true)}${inputField("planned_publish_date", "Previsão de publicação", post?.planned_publish_date || "", "date")}${selectField("status", "Status", selectedStatus, statusOptions, true)}${selectField("hotel_id", "Unidade", post?.hotel_id, ctx.hotels)}${selectField("author_user_id", "Responsável", post?.author_user_id, ctx.users)}${inputField("briefing", "Orientações do artigo", post?.briefing, "textarea", true)}</div></section><section class="drawer-section article-upload-section"><h3>Arquivo do artigo</h3><p class="subtle">Anexe o texto final em PDF ou DOCX, com até 15 MB.</p>${currentFile}<label class="article-file-picker"><i data-lucide="upload" aria-hidden="true"></i><span><strong>${post?.article_file_name ? "Substituir arquivo" : "Selecionar artigo"}</strong><small>PDF ou DOCX</small></span><input name="article_file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label></section><div id="deleteConfirm"></div></div><div class="drawer-actions">${post ? '<button type="button" class="button" data-action="archive-post">Arquivar</button><button type="button" class="button danger" data-action="delete-post">Excluir</button>' : ""}<button type="submit" class="button primary">Salvar pauta</button></div></form>`;
}

export function blogFormInput(form: HTMLFormElement): BlogInput {
  return formValues(form, ["title", "briefing", "planned_publish_date", "hotel_id", "author_user_id", "status"]) as BlogInput;
}
