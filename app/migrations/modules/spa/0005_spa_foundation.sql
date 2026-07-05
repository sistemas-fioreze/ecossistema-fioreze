PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS spa_services (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL DEFAULT 'spa' REFERENCES modules(module_key) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS spa_service_requests (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES spa_services(id) ON DELETE SET NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  guest_name TEXT,
  preferred_window TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'contacted', 'scheduled', 'cancelled', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS spa_appointments (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES spa_services(id) ON DELETE SET NULL,
  request_id TEXT REFERENCES spa_service_requests(id) ON DELETE SET NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spa_services_hotel_status ON spa_services(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_spa_requests_hotel_status ON spa_service_requests(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_spa_appointments_hotel_time ON spa_appointments(hotel_id, starts_at);
