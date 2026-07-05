PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS hotels (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS hotel_domains (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'public' CHECK (purpose IN ('public', 'admin', 'module')),
  module_key TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hotel_branding (
  hotel_id TEXT PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  logo_url TEXT,
  icon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#513b2d',
  secondary_color TEXT NOT NULL DEFAULT '#f4f1ef',
  accent_color TEXT NOT NULL DEFAULT '#c1a94c',
  background_color TEXT NOT NULL DEFAULT '#fbf8f4',
  text_color TEXT NOT NULL DEFAULT '#202124',
  font_family TEXT NOT NULL DEFAULT 'Inter, system-ui, sans-serif',
  custom_css_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hotel_settings (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (hotel_id, setting_key)
);

CREATE TABLE IF NOT EXISTS modules (
  module_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'foundation', 'active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hotel_modules (
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE RESTRICT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  public_name TEXT,
  navigation_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  settings_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (hotel_id, module_key)
);

CREATE TABLE IF NOT EXISTS navigation_items (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  icon_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (hotel_id, module_key, path)
);

CREATE TABLE IF NOT EXISTS features (
  feature_key TEXT PRIMARY KEY,
  module_key TEXT REFERENCES modules(module_key) ON DELETE SET NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'deprecated')),
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  default_config_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hotel_features (
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES features(feature_key) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  config_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (hotel_id, feature_key)
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT,
  room_type TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (hotel_id, code)
);

CREATE INDEX IF NOT EXISTS idx_hotels_status ON hotels(status);
CREATE INDEX IF NOT EXISTS idx_hotel_domains_hotel ON hotel_domains(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_settings_public ON hotel_settings(hotel_id, is_public);
CREATE INDEX IF NOT EXISTS idx_hotel_modules_enabled ON hotel_modules(hotel_id, module_key, enabled);
CREATE INDEX IF NOT EXISTS idx_navigation_hotel_public ON navigation_items(hotel_id, enabled, is_public);
CREATE INDEX IF NOT EXISTS idx_features_module ON features(module_key, status);
CREATE INDEX IF NOT EXISTS idx_hotel_features_enabled ON hotel_features(hotel_id, feature_key, enabled);
CREATE INDEX IF NOT EXISTS idx_rooms_hotel_status ON rooms(hotel_id, status);
