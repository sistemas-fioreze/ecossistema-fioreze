-- Recovered from the active fioreze-portais-dev D1 schema on 2026-10-02.
CREATE TABLE romantic_package_media (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL DEFAULT 'romantic-packages' REFERENCES modules(module_key) ON DELETE RESTRICT,
  package_id TEXT NOT NULL REFERENCES romantic_packages(id) ON DELETE CASCADE,
  media_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  CHECK (module_key = 'romantic-packages'),
  UNIQUE (package_id, media_asset_id)
);

CREATE INDEX idx_romantic_package_media_catalog
  ON romantic_package_media(hotel_id, module_key, package_id, status, sort_order);
