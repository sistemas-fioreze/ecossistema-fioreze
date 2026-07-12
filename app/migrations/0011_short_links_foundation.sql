PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS short_links (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL COLLATE NOCASE,
  internal_name TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  destination_scheme TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  starts_at TEXT NULL,
  expires_at TEXT NULL,
  notes TEXT NULL,
  total_clicks INTEGER NOT NULL DEFAULT 0 CHECK (total_clicks >= 0),
  last_clicked_at TEXT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  updated_by_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  archived_by_user_id TEXT NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT NULL,
  CHECK (length(slug) BETWEEN 2 AND 64),
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_short_links_slug ON short_links(lower(slug));
CREATE INDEX IF NOT EXISTS idx_short_links_hotel ON short_links(hotel_id);
CREATE INDEX IF NOT EXISTS idx_short_links_hotel_status ON short_links(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_short_links_status_expires ON short_links(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_short_links_hotel_created ON short_links(hotel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_short_links_hotel_updated ON short_links(hotel_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_short_links_hotel_clicks ON short_links(hotel_id, total_clicks);

CREATE TABLE IF NOT EXISTS short_link_clicks_daily (
  short_link_id TEXT NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  click_date TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  first_clicked_at TEXT NOT NULL,
  last_clicked_at TEXT NOT NULL,
  PRIMARY KEY (short_link_id, click_date)
);

CREATE INDEX IF NOT EXISTS idx_short_link_clicks_daily_hotel_date ON short_link_clicks_daily(hotel_id, click_date);
CREATE INDEX IF NOT EXISTS idx_short_link_clicks_daily_link_date ON short_link_clicks_daily(short_link_id, click_date);
CREATE INDEX IF NOT EXISTS idx_short_link_clicks_daily_click_date ON short_link_clicks_daily(click_date);

INSERT OR IGNORE INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at) VALUES
  ('perm-portals-links-read', 'portals.links.read', NULL, 'Ler links personalizados dos portais', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-portals-links-create', 'portals.links.create', NULL, 'Criar links personalizados dos portais', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-portals-links-update', 'portals.links.update', NULL, 'Atualizar links personalizados dos portais', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-portals-links-archive', 'portals.links.archive', NULL, 'Arquivar links personalizados dos portais', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-portals-links-analytics', 'portals.links.analytics', NULL, 'Consultar metricas agregadas de links personalizados', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z');
