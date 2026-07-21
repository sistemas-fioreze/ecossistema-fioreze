PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS short_link_user_shares (
  short_link_id TEXT NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  shared_by_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  access_level TEXT NOT NULL DEFAULT 'viewer' CHECK (access_level = 'viewer'),
  created_at TEXT NOT NULL,
  PRIMARY KEY (short_link_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_short_link_user_shares_user
  ON short_link_user_shares(user_id, short_link_id);

CREATE INDEX IF NOT EXISTS idx_short_link_user_shares_shared_by
  ON short_link_user_shares(shared_by_user_id, created_at);
