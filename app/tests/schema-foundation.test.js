import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { publicAssetUrl } from "../src/services/media-service.js";

const migration = fs.readFileSync("migrations/0007_core_service_hours_media_assets.sql", "utf8");
const adminOrdersGuardsMigration = fs.readFileSync("migrations/0007_admin_orders_guards.sql", "utf8");
const mediaLibraryMigration = fs.readFileSync("migrations/0008_media_library_foundation.sql", "utf8");
const adminUnitsMigration = fs.readFileSync("migrations/0009_admin_units_management_permissions.sql", "utf8");
const shortLinksMigration = fs.readFileSync("migrations/0011_short_links_foundation.sql", "utf8");
const adminPreferencesMediaFoldersMigration = fs.readFileSync("migrations/0017_admin_preferences_media_folders.sql", "utf8");
const adminLoginSecurityMigration = fs.readFileSync("migrations/0019_admin_login_security.sql", "utf8");
const guestPortalReferenceMigration = fs.readFileSync("migrations/0021_guest_portal_reference_features.sql", "utf8");
const guestPortalEventDetailsMigration = fs.readFileSync("migrations/0022_guest_portal_event_details.sql", "utf8");
const guestPortalEventActionsMigration = fs.readFileSync("migrations/0023_guest_portal_event_actions.sql", "utf8");
const portalEventPermanenceMigration = fs.readFileSync("migrations/0027_portal_event_permanence.sql", "utf8");
const seed = fs.readFileSync("seeds/dev.sql", "utf8");
const wranglerConfig = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
const normalizedMigration = normalize(migration);
const normalizedAdminOrdersGuardsMigration = normalize(adminOrdersGuardsMigration);
const normalizedMediaLibraryMigration = normalize(mediaLibraryMigration);
const normalizedAdminUnitsMigration = normalize(adminUnitsMigration);
const normalizedShortLinksMigration = normalize(shortLinksMigration);
const normalizedAdminPreferencesMediaFoldersMigration = normalize(adminPreferencesMediaFoldersMigration);
const normalizedAdminLoginSecurityMigration = normalize(adminLoginSecurityMigration);
const normalizedGuestPortalReferenceMigration = normalize(guestPortalReferenceMigration);
const normalizedGuestPortalEventDetailsMigration = normalize(guestPortalEventDetailsMigration);
const normalizedGuestPortalEventActionsMigration = normalize(guestPortalEventActionsMigration);
const normalizedPortalEventPermanenceMigration = normalize(portalEventPermanenceMigration);

test("migration 0007 cria service_hours e media_assets", () => {
  assert.match(normalizedMigration, /create table if not exists service_hours/);
  assert.match(normalizedMigration, /create table if not exists media_assets/);
  assert.match(normalizedMigration, /references hotels\(id\) on delete cascade/);
});

test("service_hours define constraints operacionais", () => {
  assert.match(normalizedMigration, /day_of_week integer not null check \(day_of_week between 0 and 6\)/);
  assert.match(normalizedMigration, /is_closed integer not null default 0 check \(is_closed in \(0, 1\)\)/);
  assert.match(normalizedMigration, /status text not null default 'active' check \(status in \('active', 'inactive', 'archived'\)\)/);
  assert.match(normalizedMigration, /is_closed = 0 and opens_at is not null and closes_at is not null/);
  assert.match(normalizedMigration, /is_closed = 1 and opens_at is null and closes_at is null/);
  assert.match(normalizedMigration, /valid_until >= valid_from/);
  assert.match(normalizedMigration, /unique \(hotel_id, module_key, day_of_week, sort_order\)/);
  assert.match(normalizedMigration, /idx_service_hours_hotel_module_status/);
  assert.match(normalizedMigration, /idx_service_hours_hotel_module_day/);
  assert.match(normalizedMigration, /idx_service_hours_hotel_status/);
});

test("media_assets guarda metadados sem binarios", () => {
  assert.match(normalizedMigration, /storage_provider text not null check \(storage_provider in \('static', 'r2', 'external'\)\)/);
  assert.match(normalizedMigration, /module_key text references modules\(module_key\) on delete set null/);
  assert.match(normalizedMigration, /unique \(storage_provider, object_key\)/);
  assert.match(normalizedMigration, /idx_media_assets_hotel_status/);
  assert.match(normalizedMigration, /idx_media_assets_hotel_module_status/);
  assert.match(normalizedMigration, /idx_media_assets_provider_status/);
  assert.equal(/\bblob\b|\bbinary\b/i.test(migration), false);
});

test("seed usa service_hours como fonte canonica de horarios", () => {
  assert.equal(seed.includes("set-muller-rs-hours"), false);
  assert.equal(seed.includes("set-aurora-rs-hours"), false);
  assert.equal(seed.includes("room_service.hours"), false);
  assert.match(seed, /insert or ignore into service_hours/i);
  assert.equal(countMatches(seed, /hours-muller-rs-[0-6]/g), 7);
  assert.equal(countMatches(seed, /hours-aurora-rs-[0-6]/g), 7);
});

test("media service aceita asset static e rejeita URL remota", () => {
  assert.equal(publicAssetUrl("/assets/hotels/muller-fioreze/logo.png"), "/assets/hotels/muller-fioreze/logo.png");
  assert.throws(() => publicAssetUrl("https://example.invalid/logo.png"), /Assets remotos nao sao permitidos/);
  assert.match(seed, /insert or ignore into media_assets/i);
  assert.equal(/https?:\/\//i.test(seed), false);
});

test("migration de guardas administrativos cria unicidade no historico de status", () => {
  assert.match(normalizedAdminOrdersGuardsMigration, /create unique index if not exists uq_order_status_history_order_status/);
  assert.match(normalizedAdminOrdersGuardsMigration, /on order_status_history\(order_id, status\)/);
  assert.match(normalizedAdminOrdersGuardsMigration, /select order_id, status, count\(\*\) as total/);
  assert.match(normalizedAdminOrdersGuardsMigration, /having count\(\*\) > 1/);
});

test("migration 0008 prepara biblioteca de imagens sem gravar binarios", () => {
  assert.match(normalizedMediaLibraryMigration, /alter table media_assets add column original_filename text/);
  assert.match(normalizedMediaLibraryMigration, /alter table media_assets add column checksum_sha256 text/);
  assert.match(normalizedMediaLibraryMigration, /idx_media_assets_hotel_status_created/);
  assert.match(normalizedMediaLibraryMigration, /idx_media_assets_checksum/);
  assert.match(normalizedMediaLibraryMigration, /idx_media_assets_uploaded_by/);
  assert.match(normalizedMediaLibraryMigration, /portals\.media\.read/);
  assert.match(normalizedMediaLibraryMigration, /portals\.media\.upload/);
  assert.match(normalizedMediaLibraryMigration, /portals\.media\.update/);
  assert.match(normalizedMediaLibraryMigration, /portals\.media\.archive/);
  assert.equal(/\bblob\b|\bbinary\b/i.test(mediaLibraryMigration), false);
});

test("migration 0021 associa eventos a midias da biblioteca", () => {
  assert.match(normalizedGuestPortalReferenceMigration, /alter table events add column media_asset_id text references media_assets\(id\) on delete set null/);
  assert.match(normalizedGuestPortalReferenceMigration, /create index if not exists idx_events_hotel_media/);
  assert.equal(/insert into|update events|delete from/i.test(guestPortalReferenceMigration), false);
});

test("migration 0022 prepara a visualizacao completa dos eventos sem alterar dados", () => {
  assert.match(normalizedGuestPortalEventDetailsMigration, /alter table events add column content text/);
  assert.match(normalizedGuestPortalEventDetailsMigration, /alter table events add column location text/);
  assert.match(normalizedGuestPortalEventDetailsMigration, /alter table events add column category text/);
  assert.match(normalizedGuestPortalEventDetailsMigration, /add column tags_json text not null default '\[\]' check \(json_valid\(tags_json\)\)/);
  assert.match(normalizedGuestPortalEventDetailsMigration, /idx_events_hotel_category_status/);
  assert.equal(/insert into|update events|delete from/i.test(guestPortalEventDetailsMigration), false);
});

test("migration 0023 adiciona CTA opcional aos eventos sem alterar dados", () => {
  assert.match(normalizedGuestPortalEventActionsMigration, /alter table events add column action_text text/);
  assert.match(normalizedGuestPortalEventActionsMigration, /alter table events add column action_url text/);
  assert.equal(/insert into|update events|delete from/i.test(guestPortalEventActionsMigration), false);
});

test("migration 0027 adiciona permanencia de eventos sem alterar registros existentes", () => {
  assert.match(normalizedPortalEventPermanenceMigration, /alter table events add column is_permanent integer not null default 0/);
  assert.match(normalizedPortalEventPermanenceMigration, /check \(is_permanent in \(0, 1\)\)/);
  assert.match(normalizedPortalEventPermanenceMigration, /create index if not exists idx_events_public_lifecycle/);
  assert.equal(/insert into|update events|delete from/i.test(portalEventPermanenceMigration), false);
});

test("wrangler declara MEDIA_BUCKET privado de desenvolvimento", () => {
  const bucket = wranglerConfig.r2_buckets.find((entry) => entry.binding === "MEDIA_BUCKET");
  assert.equal(bucket.bucket_name, "fioreze-portais-media-dev");
  assert.equal(bucket.remote, undefined);
  assert.equal(/prod/i.test(bucket.bucket_name), false);
});

test("Static Assets executa Worker antes de APIs, produtos e portais personalizados", () => {
  const workerFirst = new Set(wranglerConfig.assets.run_worker_first);
  assert.equal(workerFirst.has("/*"), true);
  assert.equal(workerFirst.size, 1);
});

test("Worker agenda o arquivamento de eventos encerrados", () => {
  assert.deepEqual(wranglerConfig.triggers?.crons, ["*/15 * * * *"]);
});

test("migration 0009 adiciona permissoes de unidades sem associar roles", () => {
  for (const permission of [
    "portals.hotels.read",
    "portals.hotels.create",
    "portals.hotels.update",
    "portals.hotels.branding",
    "portals.hotels.settings",
    "portals.hotels.modules",
    "portals.hotels.navigation",
  ]) {
    assert.match(normalizedAdminUnitsMigration, new RegExp(permission.replaceAll(".", "\\.")));
  }
  assert.equal(/admin_role_permissions/i.test(adminUnitsMigration), false);
});

test("migration 0011 adiciona links personalizados e analytics agregada sem dados pessoais", () => {
  assert.match(normalizedShortLinksMigration, /create table if not exists short_links/);
  assert.match(normalizedShortLinksMigration, /create table if not exists short_link_clicks_daily/);
  assert.match(normalizedShortLinksMigration, /uq_short_links_slug/);
  assert.match(normalizedShortLinksMigration, /short_link_id, click_date/);
  assert.match(normalizedShortLinksMigration, /portals\.links\.read/);
  assert.match(normalizedShortLinksMigration, /portals\.links\.analytics/);
  assert.equal(/user_agent|ip_address|referrer|cookie/i.test(shortLinksMigration), false);
});

test("migration 0017 separa preferencias por usuario e organiza midias em pastas por hotel", () => {
  assert.match(normalizedAdminPreferencesMediaFoldersMigration, /create table if not exists admin_user_preferences/);
  assert.match(normalizedAdminPreferencesMediaFoldersMigration, /user_id text primary key references admin_users\(id\)/);
  assert.match(normalizedAdminPreferencesMediaFoldersMigration, /color_palette in \('fioreze', 'terracotta', 'forest', 'ocean', 'graphite'\)/);
  assert.match(normalizedAdminPreferencesMediaFoldersMigration, /create table if not exists media_folders/);
  assert.match(normalizedAdminPreferencesMediaFoldersMigration, /hotel_id text not null references hotels\(id\)/);
  assert.match(normalizedAdminPreferencesMediaFoldersMigration, /parent_id text references media_folders\(id\)/);
  assert.match(normalizedAdminPreferencesMediaFoldersMigration, /alter table media_assets add column folder_id text references media_folders\(id\)/);
  assert.match(normalizedAdminPreferencesMediaFoldersMigration, /uq_media_folders_active_sibling_name/);
  assert.match(normalizedAdminPreferencesMediaFoldersMigration, /idx_media_assets_hotel_folder_status/);
});

test("migration 0019 protege tentativas sem armazenar IP ou e-mail brutos", () => {
  assert.match(normalizedAdminLoginSecurityMigration, /create table if not exists admin_login_attempts/);
  assert.match(normalizedAdminLoginSecurityMigration, /primary key \(identifier_type, identifier_hash\)/);
  assert.match(normalizedAdminLoginSecurityMigration, /create table if not exists admin_login_security_events/);
  assert.match(normalizedAdminLoginSecurityMigration, /idx_admin_login_attempts_locked_until/);
  assert.match(normalizedAdminLoginSecurityMigration, /idx_admin_login_security_events_expires_at/);
  assert.equal(/\bip_address\b|\bemail\b|password|token/i.test(adminLoginSecurityMigration), false);
});

function normalize(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}
