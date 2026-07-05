PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS service_hours (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE RESTRICT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at TEXT,
  closes_at TEXT,
  is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  valid_from TEXT,
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  CHECK (
    (is_closed = 0 AND opens_at IS NOT NULL AND closes_at IS NOT NULL)
    OR
    (is_closed = 1 AND opens_at IS NULL AND closes_at IS NULL)
  ),
  CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_until >= valid_from),
  UNIQUE (hotel_id, module_key, day_of_week, sort_order)
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  hotel_id TEXT REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT REFERENCES modules(module_key) ON DELETE SET NULL,
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('static', 'r2', 'external')),
  object_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  alt_text TEXT,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  CHECK (length(object_key) > 0),
  CHECK (length(public_url) > 0),
  UNIQUE (storage_provider, object_key)
);

CREATE INDEX IF NOT EXISTS idx_service_hours_hotel_module_status ON service_hours(hotel_id, module_key, status);
CREATE INDEX IF NOT EXISTS idx_service_hours_hotel_module_day ON service_hours(hotel_id, module_key, day_of_week);
CREATE INDEX IF NOT EXISTS idx_service_hours_hotel_status ON service_hours(hotel_id, status);

CREATE INDEX IF NOT EXISTS idx_media_assets_hotel_status ON media_assets(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_media_assets_hotel_module_status ON media_assets(hotel_id, module_key, status);
CREATE INDEX IF NOT EXISTS idx_media_assets_provider_status ON media_assets(storage_provider, status);
