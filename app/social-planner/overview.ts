import type { BlogPost, Hotel, Story, Visit } from "./types";
import { addDays, escapeHtml as e } from "./utils";

export function overviewView(stories: Story[], visits: Visit[], posts: BlogPost[], hotels: Hotel[], today: string, week: string): string {
  const weekEnd = addDays(week, 6);
  const weekStories = stories.filter((s) => s.date >= week && s.date <= weekEnd);
  const weekVisits = visits.filter((v) => v.date >= week && v.date <= weekEnd);
  const weekPosts = posts.filter((p) => p.planned_publish_date && p.planned_publish_date >= week && p.planned_publish_date <= weekEnd);
  const duePosts = posts.filter((p) => p.planned_publish_date && p.planned_publish_date >= today && p.planned_publish_date <= addDays(today, 7) && p.status !== "published" && p.status !== "archived");
  const nextVisit = visits.filter((v) => v.date >= today && v.status !== "cancelled" && v.status !== "completed").sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || "").localeCompare(b.start_time || ""))[0];
  const todayStories = stories.filter((s) => s.date === today && s.status !== "cancelled");
  const actions: { title: string; detail: string; view: string }[] = [];
  for (const s of todayStories.filter((s) => !s.media_asset_id && s.status !== "published")) actions.push({ title: "Story de hoje sem mídia", detail: s.title, view: "pending" });
  for (const s of todayStories.filter((s) => s.status === "idea")) actions.push({ title: "Story de hoje ainda é ideia", detail: s.title, view: "week" });
  for (const hotel of hotels) {
    const upcoming = stories.filter((s) => s.hotel_id === hotel.id && s.date >= today && s.date <= addDays(today, 2) && s.status !== "cancelled").length;
    if (!upcoming) actions.push({ title: "Hotel sem Stories nos próximos 3 dias", detail: hotel.short_name, view: "week" });
  }
  for (const v of visits.filter((v) => v.date === today && v.status !== "cancelled" && v.status !== "completed")) actions.push({ title: "Visita marcada para hoje", detail: `${v.hotel_name} · ${v.start_time || "Horário livre"}`, view: "visits-week" });
  for (const v of visits.filter((v) => v.date <= addDays(today, 1) && v.date >= today && v.item_count > v.completed_item_count && v.status !== "cancelled")) actions.push({ title: "Checklist de visita incompleto", detail: `${v.hotel_name} · ${v.completed_item_count}/${v.item_count}`, view: "visits-week" });
  for (const p of posts.filter((p) => p.status === "review")) actions.push({ title: "Artigo aguardando revisão", detail: p.title, view: "blog-ideas" });
  for (const p of duePosts) actions.push({ title: "Publicação do blog próxima", detail: `${p.title} · ${p.planned_publish_date}`, view: "blog-schedule" });
  const stat = (title: string, value: string, detail: string) => `<div class="metric"><small>${e(title)}</small><strong>${e(value)}</strong><span class="subtle">${e(detail)}</span></div>`;
  return `<div class="page-heading"><div><p class="eyebrow">Fioreze Marketing Planner</p><h1>Visão geral</h1><p class="subtle">O que precisa de atenção no Marketing da Rede Fioreze.</p></div></div><h2 class="section-title">Hoje</h2><div class="overview-metrics">${stat("Stories", String(todayStories.length), `${todayStories.filter((s) => s.status !== "published" && s.status !== "ready").length} ainda pendentes`)}${stat("Próxima visita", nextVisit ? nextVisit.hotel_name : "—", nextVisit ? `${nextVisit.date} · ${nextVisit.item_count - nextVisit.completed_item_count} tarefas abertas` : "Nenhuma visita próxima")}${stat("Blog nos próximos 7 dias", String(duePosts.length), `${posts.filter((p) => p.status === "review").length} em revisão`)}</div><h2 class="section-title">Esta semana</h2><div class="overview-metrics">${stat("Stories", `${weekStories.length} / ${weekStories.filter((s) => s.status === "published").length}`, "planejados / publicados")}${stat("Visitas", `${weekVisits.length} / ${weekVisits.filter((v) => v.status === "completed").length}`, "planejadas / realizadas")}${stat("Artigos", `${weekPosts.length} / ${weekPosts.filter((p) => p.status === "published").length}`, "planejados / publicados")}</div><section class="section-card"><h2>Próximas ações <span class="subtle">${actions.length}</span></h2><div class="action-list">${actions.length ? actions.slice(0, 20).map((a) => `<button class="action-row" data-view="${a.view}"><strong>${e(a.title)}</strong><span>${e(a.detail)}</span><span aria-hidden="true">→</span></button>`).join("") : '<p class="subtle">Nenhuma ação urgente neste período.</p>'}</div></section>`;
}
