import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("migrations/0062_social_channels_and_calendars.sql", "utf8");
const routes = fs.readFileSync("src/modules/social-planner/routes.js", "utf8");
const calendar = fs.readFileSync("src/services/social-planner-calendar.js", "utf8");
const app = fs.readFileSync("social-planner/app.ts", "utf8");
const visits = fs.readFileSync("social-planner/visits.ts", "utf8");

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
