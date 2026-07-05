PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS romantic_packages (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL DEFAULT 'romantic-packages' REFERENCES modules(module_key) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  included_items_json TEXT,
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS romantic_package_requests (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  package_id TEXT REFERENCES romantic_packages(id) ON DELETE SET NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  guest_name TEXT,
  requested_date TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'reviewing', 'confirmed', 'cancelled', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_romantic_packages_hotel_status ON romantic_packages(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_romantic_requests_hotel_status ON romantic_package_requests(hotel_id, status);
