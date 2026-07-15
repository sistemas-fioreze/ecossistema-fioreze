PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  color_palette TEXT NOT NULL DEFAULT 'fioreze' CHECK (
    color_palette IN ('fioreze', 'terracotta', 'forest', 'ocean', 'graphite')
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_folders (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES media_folders(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

ALTER TABLE media_assets ADD COLUMN folder_id TEXT REFERENCES media_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_media_folders_hotel_parent
  ON media_folders(hotel_id, parent_id, archived_at, name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_folders_active_sibling_name
  ON media_folders(hotel_id, ifnull(parent_id, ''), lower(name))
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_hotel_folder_status
  ON media_assets(hotel_id, folder_id, status, created_at);
