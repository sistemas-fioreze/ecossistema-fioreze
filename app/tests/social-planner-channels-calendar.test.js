import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("migrations/0062_social_channels_and_calendars.sql", "utf8");
const routes = fs.readFileSync("src/modules/social-planner/routes.js", "utf8");
const calendar = fs.readFileSync("src/services/social-planner-calendar.js", "utf8");
const app = fs.readFileSync("social-planner/app.ts", "utf8");
const visits = fs.readFileSync("social-planner/visits.ts", "utf8");
const shell = fs.readFileSync("public/admin/social-planner/index.html", "utf8");
const styles = fs.readFileSync("public/css/modules/social-planner/planner.css", "utf8");
const asanaMigration = fs.readFileSync("migrations/0063_social_planner_asana.sql", "utf8");
const asanaService = fs.readFileSync("src/services/social-planner-asana.js", "utf8");
const asanaView = fs.readFileSync("social-planner/asana.ts", "utf8");

test("Planner modela destinos sociais e reaproveitamento por conteudo", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS social_channels/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS social_story_channels/);
  for (const channel of ["instagram-feed", "instagram-stories", "instagram-reels", "tiktok-video", "youtube-shorts", "youtube-video", "facebook-feed", "facebook-reels", "threads-post", "x-post", "google-business-post", "whatsapp-status"]) {
    assert.match(migration, new RegExp(`'${channel}'`));
  }
  assert.match(migration, /source_channel_id TEXT REFERENCES social_channels/);
  assert.match(routes, /stories\/:id\/channels/);
  assert.match(app, /Canais e reaproveitamento/);
  assert.match(app, /Reaproveitar de/);
});

test("visitas aceitam varios responsaveis com calendario individual", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS marketing_visit_assignees/);
  assert.match(migration, /PRIMARY KEY \(visit_id, planner_user_id\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS social_planner_calendar_connections/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS marketing_visit_calendar_events/);
  assert.match(visits, /name="responsible_user_ids"/);
  assert.match(visits, /A visita entra na agenda conectada de cada pessoa selecionada/);
  assert.match(routes, /visits\/:id\/calendar-sync/);
});

test("Google Calendar usa OAuth por usuario sem segredos no cliente", () => {
  assert.match(calendar, /code_challenge_method", "S256"/);
  assert.match(calendar, /access_type", "offline"/);
  assert.match(calendar, /social_planner_oauth_states/);
  assert.match(calendar, /AES-GCM/);
  assert.match(calendar, /GOOGLE_CALENDAR_CLIENT_SECRET/);
  assert.match(calendar, /AbortSignal\.timeout\(10_000\)/);
  assert.doesNotMatch(app, /GOOGLE_CALENDAR_CLIENT_SECRET|GOOGLE_CALENDAR_TOKEN_KEY/);
});

test("Planner usa shell escuro integrado e filtra cronograma por rede", () => {
  assert.match(shell, /fioreze-social-planner-logo\.png/);
  assert.match(shell, /id="globalPlannerSearch"/);
  assert.match(shell, /lucide-erp\.min\.js/);
  assert.match(styles, /color-scheme:\s*dark/);
  assert.match(styles, /\.schedule-layout/);
  assert.match(styles, /\.upcoming-rail/);
  assert.match(styles, /\.workspace \{[^}]*border-top: 1px solid var\(--border\);[^}]*border-left: 1px solid var\(--border\);[^}]*border-top-left-radius: 14px/s);
  assert.match(styles, /\.topbar \{[^}]*border-bottom: 0/s);
  assert.match(app, /CAMPAIGN_TIMELINE_DAYS = 35/);
  assert.match(app, /campaign-period-bar/);
  assert.match(app, /campaign-prev/);
  assert.match(app, /Sem período definido/);
  assert.match(styles, /\.campaign-timeline-header, \.campaign-timeline-row/);
  assert.match(styles, /\.campaign-period-bar\[data-status="active"\]/);
  assert.match(app, /platformFilter/);
  assert.match(app, /Instagram/);
  assert.match(app, /TikTok/);
  assert.match(app, /YouTube/);
  assert.match(app, /Facebook/);
  assert.match(app, /data-platform/);
  assert.match(app, /from "simple-icons"/);
  assert.match(app, /function platformLogo/);
  assert.match(app, /platformLogo\(channel\.platform_key, true\)/);
  assert.match(styles, /\.platform-mark svg, \.platform-mini svg/);
  assert.doesNotMatch(app, /short: "(?:IG|TT|YT|FB)"/);
});

test("Asana conecta cada usuario e organiza os seis projetos por unidade", () => {
  assert.match(asanaMigration, /social_planner_asana_connections/);
  assert.match(asanaMigration, /PRIMARY KEY \(planner_user_id, hotel_id\)/);
  for (const project of ["Hotel Fioreze Centro (hoteisfioreze)", "Hotel Fioreze Quero Quero", "Hotel Fioreze Primo", "Hotel Fioreze Chalés", "Hotel Müller & Fioreze", "Hotel Fioreze Origem"]) {
    assert.ok(asanaMigration.includes(project));
  }
  assert.match(asanaService, /code_challenge_method", "S256"/);
  assert.match(asanaService, /ASANA_CLIENT_SECRET/);
  assert.match(asanaService, /AES-GCM/);
  assert.match(asanaService, /projects\/\$\{encodeURIComponent\(projectGid\)\}\/tasks/);
  assert.match(asanaService, /tasks:write/);
  assert.match(asanaService, /export async function getAsanaTask/);
  assert.match(asanaService, /export async function updateAsanaTask/);
  assert.match(asanaService, /Essa tarefa não pertence a um projeto vinculado neste Planner/);
  assert.match(routes, /asana\/callback/);
  assert.match(routes, /asana\/tasks/);
  assert.match(routes, /asana\/tasks\/:id/);
  assert.match(app, /Calendário do Asana/);
  assert.match(app, /openAsanaTask/);
  assert.match(app, /application\/x-fioreze-asana/);
  assert.match(app, /moveAsanaTaskToDate/);
  assert.match(asanaView, /id="asanaHotelFilter"/);
  assert.match(asanaView, /data-asana-task-id/);
  assert.match(asanaView, /data-asana-date/);
  assert.match(styles, /\.asana-calendar-grid/);
  assert.match(styles, /\.asana-calendar-day\.drag-over/);
  assert.doesNotMatch(app, /ASANA_CLIENT_SECRET|ASANA_TOKEN_KEY/);
});
