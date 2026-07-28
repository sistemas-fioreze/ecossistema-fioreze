PRAGMA foreign_keys = ON;

ALTER TABLE short_links ADD COLUMN analytics_reset_at TEXT NULL;
ALTER TABLE short_links ADD COLUMN analytics_reset_by_user_id TEXT NULL REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE short_links ADD COLUMN analytics_reset_nonce TEXT NULL;

CREATE TABLE IF NOT EXISTS short_link_unique_visitors (
  short_link_id TEXT NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  visitor_hash TEXT NOT NULL,
  country_code TEXT NULL,
  region TEXT NULL,
  first_clicked_at TEXT NOT NULL,
  last_clicked_at TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 1 CHECK (click_count >= 1),
  PRIMARY KEY (short_link_id, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_short_link_unique_visitors_hotel
  ON short_link_unique_visitors(hotel_id);

CREATE INDEX IF NOT EXISTS idx_short_link_unique_visitors_location
  ON short_link_unique_visitors(short_link_id, country_code, region);

CREATE INDEX IF NOT EXISTS idx_short_link_unique_visitors_last_clicked
  ON short_link_unique_visitors(short_link_id, last_clicked_at);

CREATE TABLE IF NOT EXISTS short_link_click_visitors (
  short_link_id TEXT NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  click_date TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  country_code TEXT NULL,
  region TEXT NULL,
  first_clicked_at TEXT NOT NULL,
  last_clicked_at TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 1 CHECK (click_count >= 1),
  PRIMARY KEY (short_link_id, click_date, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_short_link_click_visitors_hotel_date
  ON short_link_click_visitors(hotel_id, click_date);

CREATE INDEX IF NOT EXISTS idx_short_link_click_visitors_link_date
  ON short_link_click_visitors(short_link_id, click_date);

CREATE INDEX IF NOT EXISTS idx_short_link_click_visitors_location
  ON short_link_click_visitors(short_link_id, country_code, region);

CREATE INDEX IF NOT EXISTS idx_short_link_click_visitors_last_clicked
  ON short_link_click_visitors(short_link_id, last_clicked_at);

CREATE TABLE IF NOT EXISTS portal_visit_visitors (
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  country_code TEXT NULL,
  region TEXT NULL,
  first_visited_at TEXT NOT NULL,
  last_visited_at TEXT NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 1 CHECK (visit_count >= 1),
  PRIMARY KEY (hotel_id, page_key, visit_date, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_portal_visit_visitors_hotel_date
  ON portal_visit_visitors(hotel_id, visit_date);

CREATE INDEX IF NOT EXISTS idx_portal_visit_visitors_hotel_page_date
  ON portal_visit_visitors(hotel_id, page_key, visit_date);

CREATE INDEX IF NOT EXISTS idx_portal_visit_visitors_location
  ON portal_visit_visitors(hotel_id, country_code, region);

CREATE INDEX IF NOT EXISTS idx_portal_visit_visitors_last_visited
  ON portal_visit_visitors(hotel_id, last_visited_at);
