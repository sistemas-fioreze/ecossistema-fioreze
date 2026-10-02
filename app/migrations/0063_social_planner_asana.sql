-- Per-user Asana OAuth connections and hotel project mapping.
CREATE TABLE IF NOT EXISTS social_planner_asana_units (
  hotel_id TEXT PRIMARY KEY REFERENCES social_planner_hotels(hotel_id) ON DELETE CASCADE,
  project_name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 100
);

INSERT INTO social_planner_asana_units (hotel_id, project_name, sort_order) VALUES
  ('hoteis-fioreze', 'Hotel Fioreze Centro (hoteisfioreze)', 10),
  ('fioreze-quero-quero', 'Hotel Fioreze Quero Quero', 20),
  ('fioreze-primo', 'Hotel Fioreze Primo', 30),
  ('chales-familia-fioreze', 'Hotel Fioreze Chalés', 40),
  ('muller-fioreze', 'Hotel Müller & Fioreze', 50),
  ('fioreze-origem', 'Hotel Fioreze Origem', 60)
ON CONFLICT(hotel_id) DO UPDATE SET
  project_name = excluded.project_name,
  sort_order = excluded.sort_order;

CREATE TABLE IF NOT EXISTS social_planner_asana_connections (
  planner_user_id TEXT PRIMARY KEY REFERENCES social_planner_users(id) ON DELETE CASCADE,
  provider_account_id TEXT,
  account_name TEXT,
  account_email TEXT,
  workspace_gid TEXT,
  workspace_name TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  access_token_expires_at TEXT,
  granted_scope TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'reauthorization_required', 'disconnected')),
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_sync_at TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS social_planner_asana_oauth_states (
  state_hash TEXT PRIMARY KEY,
  planner_user_id TEXT NOT NULL REFERENCES social_planner_users(id) ON DELETE CASCADE,
  code_verifier_encrypted TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_social_planner_asana_oauth_expiry
  ON social_planner_asana_oauth_states(expires_at, used_at);

CREATE TABLE IF NOT EXISTS social_planner_asana_project_mappings (
  planner_user_id TEXT NOT NULL REFERENCES social_planner_users(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES social_planner_asana_units(hotel_id) ON DELETE CASCADE,
  workspace_gid TEXT NOT NULL,
  project_gid TEXT,
  project_name TEXT,
  match_status TEXT NOT NULL DEFAULT 'missing'
    CHECK (match_status IN ('matched', 'missing', 'unavailable')),
  matched_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (planner_user_id, hotel_id)
);

CREATE INDEX IF NOT EXISTS idx_social_planner_asana_mappings_workspace
  ON social_planner_asana_project_mappings(planner_user_id, workspace_gid);
