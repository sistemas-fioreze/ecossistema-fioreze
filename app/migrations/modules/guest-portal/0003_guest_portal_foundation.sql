PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS portal_pages (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL DEFAULT 'guest-portal' REFERENCES modules(module_key) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  UNIQUE (hotel_id, module_key, slug)
);

CREATE TABLE IF NOT EXISTS portal_sections (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES portal_pages(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  title TEXT,
  body TEXT,
  settings_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_content_items (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES portal_sections(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  media_url TEXT,
  link_url TEXT,
  settings_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hotel_information (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  info_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (hotel_id, info_key)
);

CREATE INDEX IF NOT EXISTS idx_portal_pages_hotel_status ON portal_pages(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_sections_page_order ON portal_sections(page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_portal_content_section_order ON portal_content_items(section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_events_hotel_status_time ON events(hotel_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_hotel_information_public ON hotel_information(hotel_id, is_public);
