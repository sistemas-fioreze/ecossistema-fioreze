-- Extend the shared Social Planner into an operational Marketing Planner.
UPDATE modules SET name = 'Fioreze Marketing Planner', description = 'Planejamento de redes sociais, captação nos hotéis e blog.', updated_at = CURRENT_TIMESTAMP WHERE module_key = 'social-planner';

CREATE TABLE IF NOT EXISTS marketing_planner_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO marketing_planner_settings (setting_key, setting_value) VALUES ('display_name', 'Fioreze Marketing Planner');

CREATE TABLE IF NOT EXISTS marketing_hotel_visits (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES social_planner_hotels(hotel_id),
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  title TEXT NOT NULL,
  description TEXT,
  responsible_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','confirmed','in_progress','completed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  campaign_id TEXT REFERENCES social_campaigns(id) ON DELETE SET NULL,
  notes TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_marketing_visits_date ON marketing_hotel_visits(date, hotel_id, start_time);
CREATE INDEX IF NOT EXISTS idx_marketing_visits_campaign ON marketing_hotel_visits(campaign_id, date);

CREATE TABLE IF NOT EXISTS marketing_visit_items (
  id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL REFERENCES marketing_hotel_visits(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT,
  category_id TEXT REFERENCES social_categories(id) ON DELETE SET NULL,
  required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0,1)),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 1000,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_marketing_visit_items_visit ON marketing_visit_items(visit_id, sort_order);

CREATE TABLE IF NOT EXISTS marketing_visit_media (
  visit_id TEXT NOT NULL REFERENCES marketing_hotel_visits(id) ON DELETE CASCADE,
  media_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visit_id, media_asset_id)
);
ALTER TABLE social_stories ADD COLUMN source_visit_id TEXT REFERENCES marketing_hotel_visits(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_social_stories_source_visit ON social_stories(source_visit_id);

CREATE TABLE IF NOT EXISTS marketing_blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  briefing TEXT,
  category_id TEXT REFERENCES social_categories(id) ON DELETE SET NULL,
  hotel_id TEXT REFERENCES social_planner_hotels(hotel_id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES social_campaigns(id) ON DELETE SET NULL,
  author_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  main_keyword TEXT,
  secondary_keywords TEXT,
  meta_description TEXT,
  planned_publish_date TEXT,
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','briefing','writing','review','ready','scheduled','published','archived')),
  published_at TEXT,
  published_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_marketing_blog_schedule ON marketing_blog_posts(planned_publish_date, status);
CREATE INDEX IF NOT EXISTS idx_marketing_blog_campaign ON marketing_blog_posts(campaign_id, planned_publish_date);
