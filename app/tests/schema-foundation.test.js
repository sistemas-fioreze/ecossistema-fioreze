import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { publicAssetUrl } from "../src/services/media-service.js";

const migration = fs.readFileSync("migrations/0007_core_service_hours_media_assets.sql", "utf8");
const adminOrdersGuardsMigration = fs.readFileSync("migrations/0007_admin_orders_guards.sql", "utf8");
const mediaLibraryMigration = fs.readFileSync("migrations/0008_media_library_foundation.sql", "utf8");
const adminUnitsMigration = fs.readFileSync("migrations/0009_admin_units_management_permissions.sql", "utf8");
const shortLinksMigration = fs.readFileSync("migrations/0011_short_links_foundation.sql", "utf8");
const seed = fs.readFileSync("seeds/dev.sql", "utf8");
const wranglerConfig = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
const normalizedMigration = normalize(migration);
const normalizedAdminOrdersGuardsMigration = normalize(adminOrdersGuardsMigration);
const normalizedMediaLibraryMigration = normalize(mediaLibraryMigration);
const normalizedAdminUnitsMigration = normalize(adminUnitsMigration);
const normalizedShortLinksMigration = normalize(shortLinksMigration);

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

test("wrangler declara MEDIA_BUCKET privado de desenvolvimento", () => {
  const bucket = wranglerConfig.r2_buckets.find((entry) => entry.binding === "MEDIA_BUCKET");
  assert.equal(bucket.bucket_name, "fioreze-portais-media-dev");
  assert.equal(bucket.remote, undefined);
  assert.equal(/prod/i.test(bucket.bucket_name), false);
});

test("Static Assets executa Worker antes de api, admin, media, embed e go", () => {
  const workerFirst = new Set(wranglerConfig.assets.run_worker_first);
  assert.equal(workerFirst.has("/api/*"), true);
  assert.equal(workerFirst.has("/admin/*"), true);
  assert.equal(workerFirst.has("/media/*"), true);
  assert.equal(workerFirst.has("/embed/*"), true);
  assert.equal(workerFirst.has("/go/*"), true);
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

function normalize(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}
