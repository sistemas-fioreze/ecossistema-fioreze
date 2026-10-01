-- Social Planner is a private, cross-hotel administrative module.
INSERT OR IGNORE INTO modules (module_key, name, description, status, created_at, updated_at)
VALUES ('social-planner', 'Fioreze Social Planner', 'Planejamento editorial de Stories.', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO hotels (id, slug, name, short_name, timezone, locale, currency, status, created_at, updated_at) VALUES
  ('hoteis-fioreze', 'hoteis-fioreze', 'Hotéis Fioreze', 'Hotéis Fioreze', 'America/Sao_Paulo', 'pt-BR', 'BRL', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('fioreze-quero-quero', 'fioreze-quero-quero', 'Hotel Fioreze Quero Quero', 'Quero Quero', 'America/Sao_Paulo', 'pt-BR', 'BRL', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('muller-fioreze', 'muller-fioreze', 'Müller & Fioreze Hotel Boutique', 'Müller & Fioreze', 'America/Sao_Paulo', 'pt-BR', 'BRL', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('fioreze-origem', 'fioreze-origem', 'Hotel Fioreze Origem', 'Origem', 'America/Sao_Paulo', 'pt-BR', 'BRL', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('fioreze-primo', 'fioreze-primo', 'Hotel Fioreze Primo', 'Primo', 'America/Sao_Paulo', 'pt-BR', 'BRL', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('chales-familia-fioreze', 'chales-familia-fioreze', 'Chalés Família Fioreze', 'Chalés', 'America/Sao_Paulo', 'pt-BR', 'BRL', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS social_planner_hotels (
  hotel_id TEXT PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  instagram_username TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO social_planner_hotels (hotel_id, display_name, short_name, instagram_username, sort_order) VALUES
  ('hoteis-fioreze', 'Hotéis Fioreze', 'Hotéis Fioreze', '@hoteisfioreze', 10),
  ('fioreze-quero-quero', 'Hotel Fioreze Quero Quero', 'Quero Quero', '@hotelfiorezequeroquero', 20),
  ('muller-fioreze', 'Müller & Fioreze Hotel Boutique', 'Müller & Fioreze', '@mullerefioreze', 30),
  ('fioreze-origem', 'Hotel Fioreze Origem', 'Origem', '@hotelfiorezeorigem', 40),
  ('fioreze-primo', 'Hotel Fioreze Primo', 'Primo', '@hotelfiorezeprimo', 50),
  ('chales-familia-fioreze', 'Chalés Família Fioreze', 'Chalés Família', '@chalesfamiliafioreze', 60);

CREATE TABLE IF NOT EXISTS social_categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100
);
INSERT OR IGNORE INTO social_categories (id, name, sort_order) VALUES
  ('acomodacoes', 'Acomodações', 10), ('experiencia', 'Experiência', 20),
  ('cafe-da-manha', 'Café da manhã', 30), ('gastronomia', 'Gastronomia', 40),
  ('lazer', 'Lazer', 50), ('familia', 'Família', 60), ('bastidores', 'Bastidores', 70),
  ('institucional', 'Institucional', 80), ('gramado-destino', 'Gramado / Destino', 90),
  ('oferta', 'Oferta', 100), ('campanha', 'Campanha', 110), ('evento', 'Evento', 120),
  ('depoimento', 'Depoimento', 130), ('repost-ugc', 'Repost / UGC', 140),
  ('datas-comemorativas', 'Datas comemorativas', 150);

CREATE TABLE IF NOT EXISTS social_content_pillars (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS social_campaigns (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  start_date TEXT, end_date TEXT, status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_story_sequences (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_stories (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES social_planner_hotels(hotel_id),
  date TEXT NOT NULL,
  planned_time TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1000,
  title TEXT NOT NULL,
  description TEXT,
  story_text TEXT,
  category_id TEXT REFERENCES social_categories(id),
  content_pillar_id TEXT REFERENCES social_content_pillars(id),
  format TEXT CHECK (format IN ('photo','video','repost','art','text','boomerang','other')),
  objective TEXT CHECK (objective IN ('engagement','relationship','conversion','information','institutional','traffic','promotion')),
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','to_produce','producing','approval','ready','scheduled','published','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  cta TEXT,
  link TEXT,
  responsible_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES social_campaigns(id) ON DELETE SET NULL,
  media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  sequence_group_id TEXT REFERENCES social_story_sequences(id) ON DELETE SET NULL,
  sequence_position INTEGER,
  notes TEXT,
  published_at TEXT,
  published_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_social_stories_period ON social_stories(date, hotel_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_social_stories_status ON social_stories(status, date);
CREATE INDEX IF NOT EXISTS idx_social_stories_campaign ON social_stories(campaign_id, date);
CREATE INDEX IF NOT EXISTS idx_social_stories_sequence ON social_stories(sequence_group_id, sequence_position);

INSERT OR IGNORE INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at) VALUES
  ('perm-social-planner-read', 'social-planner.read', 'social-planner', 'Consultar o planejamento social.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm-social-planner-write', 'social-planner.write', 'social-planner', 'Editar o planejamento social.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, CURRENT_TIMESTAMP FROM admin_roles r CROSS JOIN admin_permissions p
WHERE r.role_key = 'demo-manager' AND p.permission_key IN ('social-planner.read', 'social-planner.write');
