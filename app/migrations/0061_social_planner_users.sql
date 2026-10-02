-- Isolate Marketing Planner identities from Central Administration users.
CREATE TABLE IF NOT EXISTS social_planner_users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT,
  password_strategy TEXT,
  access_level TEXT NOT NULL DEFAULT 'editor'
    CHECK (access_level IN ('viewer', 'editor', 'admin')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'archived')),
  admin_user_id TEXT UNIQUE REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  CHECK (
    (admin_user_id IS NOT NULL AND password_hash IS NULL AND password_strategy IS NULL)
    OR
    (admin_user_id IS NULL AND password_hash IS NOT NULL AND password_strategy = 'pbkdf2')
  )
);

CREATE TABLE IF NOT EXISTS social_planner_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES social_planner_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent_hash TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_social_planner_users_status
  ON social_planner_users(status, display_name);
CREATE INDEX IF NOT EXISTS idx_social_planner_sessions_user_expires
  ON social_planner_sessions(user_id, expires_at);

-- Only the platform master (user number 1) is inherited from the Central.
INSERT OR IGNORE INTO social_planner_users (
  id, display_name, email, password_hash, password_strategy, access_level,
  status, admin_user_id, created_at, updated_at
)
SELECT
  'spusr-master', display_name, email, NULL, NULL, 'admin',
  'active', id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM admin_users
WHERE user_number = 1
LIMIT 1;

-- Planner access is no longer granted through Central roles. Existing users are
-- preserved, but their obsolete Planner role link is removed.
DELETE FROM admin_user_roles
WHERE role_id = (
  SELECT id FROM admin_roles WHERE role_key = 'marketing-planner-editor'
);

ALTER TABLE social_stories
  ADD COLUMN responsible_planner_user_id TEXT REFERENCES social_planner_users(id) ON DELETE SET NULL;
ALTER TABLE marketing_hotel_visits
  ADD COLUMN responsible_planner_user_id TEXT REFERENCES social_planner_users(id) ON DELETE SET NULL;
ALTER TABLE marketing_blog_posts
  ADD COLUMN author_planner_user_id TEXT REFERENCES social_planner_users(id) ON DELETE SET NULL;

UPDATE social_stories
SET responsible_planner_user_id = 'spusr-master'
WHERE responsible_user_id = (
  SELECT admin_user_id FROM social_planner_users WHERE id = 'spusr-master'
);
UPDATE marketing_hotel_visits
SET responsible_planner_user_id = 'spusr-master'
WHERE responsible_user_id = (
  SELECT admin_user_id FROM social_planner_users WHERE id = 'spusr-master'
);
UPDATE marketing_blog_posts
SET author_planner_user_id = 'spusr-master'
WHERE author_user_id = (
  SELECT admin_user_id FROM social_planner_users WHERE id = 'spusr-master'
);

CREATE INDEX IF NOT EXISTS idx_social_stories_planner_user
  ON social_stories(responsible_planner_user_id, date);
CREATE INDEX IF NOT EXISTS idx_marketing_visits_planner_user
  ON marketing_hotel_visits(responsible_planner_user_id, date);
CREATE INDEX IF NOT EXISTS idx_marketing_blog_planner_user
  ON marketing_blog_posts(author_planner_user_id, planned_publish_date);
