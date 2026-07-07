import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { publicAssetUrl } from "../src/services/media-service.js";

const migration = fs.readFileSync("migrations/0007_core_service_hours_media_assets.sql", "utf8");
const adminOrdersGuardsMigration = fs.readFileSync("migrations/0007_admin_orders_guards.sql", "utf8");
const seed = fs.readFileSync("seeds/dev.sql", "utf8");
const normalizedMigration = normalize(migration);
const normalizedAdminOrdersGuardsMigration = normalize(adminOrdersGuardsMigration);

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

function normalize(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}
