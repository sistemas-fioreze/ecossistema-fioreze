PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_strategy TEXT NOT NULL DEFAULT 'not-configured',
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('active', 'disabled', 'archived')),
  force_password_change INTEGER NOT NULL DEFAULT 1 CHECK (force_password_change IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  id TEXT PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  module_key TEXT REFERENCES modules(module_key) ON DELETE SET NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS admin_hotel_access (
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'viewer' CHECK (access_level IN ('viewer', 'operator', 'manager', 'owner')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, hotel_id)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent_hash TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  hotel_id TEXT REFERENCES hotels(id) ON DELETE SET NULL,
  module_key TEXT REFERENCES modules(module_key) ON DELETE SET NULL,
  actor_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_module ON admin_permissions(module_key);
CREATE INDEX IF NOT EXISTS idx_admin_hotel_access_hotel ON admin_hotel_access(hotel_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_hotel_created ON admin_audit_log(hotel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_module_created ON admin_audit_log(hotel_id, module_key, created_at);
