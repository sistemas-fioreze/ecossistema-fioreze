PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS visual_portals (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  draft_document_json TEXT NOT NULL CHECK (json_valid(draft_document_json)),
  published_document_json TEXT CHECK (published_document_json IS NULL OR json_valid(published_document_json)),
  draft_revision INTEGER NOT NULL DEFAULT 1 CHECK (draft_revision >= 1),
  published_revision INTEGER CHECK (published_revision IS NULL OR published_revision >= 1),
  created_by_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  updated_by_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  published_by_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  archived_by_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  archived_at TEXT,
  CHECK (length(slug) BETWEEN 2 AND 100),
  CHECK (length(name) BETWEEN 2 AND 160),
  CHECK (length(title) BETWEEN 2 AND 180),
  CHECK (length(draft_document_json) BETWEEN 2 AND 250000),
  CHECK (published_document_json IS NULL OR length(published_document_json) BETWEEN 2 AND 250000),
  UNIQUE (hotel_id, slug)
);

CREATE TABLE IF NOT EXISTS visual_portal_versions (
  id TEXT PRIMARY KEY,
  portal_id TEXT NOT NULL REFERENCES visual_portals(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  version_type TEXT NOT NULL CHECK (version_type IN ('draft', 'published', 'restored')),
  document_json TEXT NOT NULL CHECK (json_valid(document_json)),
  created_by_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  CHECK (length(document_json) BETWEEN 2 AND 250000),
  UNIQUE (portal_id, revision, version_type)
);

CREATE TABLE IF NOT EXISTS visual_portal_templates (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  document_json TEXT NOT NULL CHECK (json_valid(document_json)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  updated_by_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  archived_by_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  CHECK (length(name) BETWEEN 2 AND 120),
  CHECK (document_json IS NOT NULL AND length(document_json) BETWEEN 2 AND 250000)
);

CREATE INDEX IF NOT EXISTS idx_visual_portals_hotel_module_status
  ON visual_portals(hotel_id, module_key, status);
CREATE INDEX IF NOT EXISTS idx_visual_portals_hotel_updated
  ON visual_portals(hotel_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_visual_portal_versions_portal_created
  ON visual_portal_versions(portal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visual_portal_templates_hotel_module_status
  ON visual_portal_templates(hotel_id, module_key, status);
CREATE INDEX IF NOT EXISTS idx_visual_portal_templates_hotel_updated
  ON visual_portal_templates(hotel_id, updated_at DESC);
