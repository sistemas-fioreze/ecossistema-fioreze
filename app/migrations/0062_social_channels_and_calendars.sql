-- Multi-channel planning and per-user calendar synchronization.
CREATE TABLE IF NOT EXISTS social_channels (
  id TEXT PRIMARY KEY,
  platform_key TEXT NOT NULL,
  platform_name TEXT NOT NULL,
  placement_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  UNIQUE (platform_key, placement_key)
);

INSERT OR IGNORE INTO social_channels (
  id, platform_key, platform_name, placement_key, display_name, sort_order
) VALUES
  ('instagram-feed', 'instagram', 'Instagram', 'feed', 'Instagram Feed', 10),
  ('instagram-stories', 'instagram', 'Instagram', 'stories', 'Instagram Stories', 20),
  ('instagram-reels', 'instagram', 'Instagram', 'reels', 'Instagram Reels', 30),
  ('tiktok-video', 'tiktok', 'TikTok', 'video', 'TikTok', 40),
  ('youtube-shorts', 'youtube', 'YouTube', 'shorts', 'YouTube Shorts', 50),
  ('youtube-video', 'youtube', 'YouTube', 'video', 'YouTube Vídeo', 60),
  ('facebook-feed', 'facebook', 'Facebook', 'feed', 'Facebook Feed', 70),
  ('facebook-reels', 'facebook', 'Facebook', 'reels', 'Facebook Reels', 80),
  ('linkedin-post', 'linkedin', 'LinkedIn', 'post', 'LinkedIn', 90),
  ('pinterest-pin', 'pinterest', 'Pinterest', 'pin', 'Pinterest', 100),
  ('threads-post', 'threads', 'Threads', 'post', 'Threads', 110),
  ('x-post', 'x', 'X', 'post', 'X', 120),
  ('google-business-post', 'google-business', 'Google Business Profile', 'post', 'Google Business Profile', 130),
  ('whatsapp-status', 'whatsapp', 'WhatsApp', 'status', 'WhatsApp Status', 140);

CREATE TABLE IF NOT EXISTS social_story_channels (
  story_id TEXT NOT NULL REFERENCES social_stories(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES social_channels(id),
  source_channel_id TEXT REFERENCES social_channels(id) ON DELETE SET NULL,
  adapted_text TEXT,
  planned_at TEXT,
  status TEXT NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea','to_produce','producing','approval','ready','scheduled','published','cancelled')),
  published_at TEXT,
  published_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (story_id, channel_id),
  CHECK (source_channel_id IS NULL OR source_channel_id <> channel_id)
);

INSERT OR IGNORE INTO social_story_channels (
  story_id, channel_id, adapted_text, planned_at, status,
  published_at, published_url, created_at, updated_at
)
SELECT
  id, 'instagram-stories', story_text,
  CASE WHEN planned_time IS NULL THEN date ELSE date || 'T' || planned_time || ':00' END,
  status, published_at, published_url, created_at, updated_at
FROM social_stories;

CREATE INDEX IF NOT EXISTS idx_social_story_channels_schedule
  ON social_story_channels(channel_id, planned_at, status);

CREATE TABLE IF NOT EXISTS marketing_visit_assignees (
  visit_id TEXT NOT NULL REFERENCES marketing_hotel_visits(id) ON DELETE CASCADE,
  planner_user_id TEXT NOT NULL REFERENCES social_planner_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visit_id, planner_user_id)
);

INSERT OR IGNORE INTO marketing_visit_assignees (visit_id, planner_user_id)
SELECT id, responsible_planner_user_id
FROM marketing_hotel_visits
WHERE responsible_planner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_visit_assignees_user
  ON marketing_visit_assignees(planner_user_id, visit_id);

CREATE TABLE IF NOT EXISTS social_planner_calendar_connections (
  planner_user_id TEXT PRIMARY KEY REFERENCES social_planner_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider = 'google'),
  provider_account_id TEXT,
  account_email TEXT,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  access_token_expires_at TEXT,
  granted_scope TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','reauthorization_required','disconnected')),
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_sync_at TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS social_planner_oauth_states (
  state_hash TEXT PRIMARY KEY,
  planner_user_id TEXT NOT NULL REFERENCES social_planner_users(id) ON DELETE CASCADE,
  code_verifier_encrypted TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_social_planner_oauth_states_expiry
  ON social_planner_oauth_states(expires_at, used_at);

CREATE TABLE IF NOT EXISTS marketing_visit_calendar_events (
  visit_id TEXT NOT NULL REFERENCES marketing_hotel_visits(id) ON DELETE CASCADE,
  planner_user_id TEXT NOT NULL REFERENCES social_planner_users(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  provider_event_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending','synced','failed','removed')),
  last_synced_at TEXT,
  last_error TEXT,
  PRIMARY KEY (visit_id, planner_user_id)
);
