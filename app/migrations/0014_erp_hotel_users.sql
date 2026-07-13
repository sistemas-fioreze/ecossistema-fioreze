PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS erp_users (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  user_code INTEGER NOT NULL CHECK (user_code > 0),
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_strategy TEXT NOT NULL DEFAULT 'pbkdf2',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  UNIQUE (hotel_id, user_code),
  UNIQUE (id, hotel_id)
);

CREATE TABLE IF NOT EXISTS erp_user_permissions (
  user_id TEXT NOT NULL,
  hotel_id TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, permission_key),
  FOREIGN KEY (user_id, hotel_id) REFERENCES erp_users(id, hotel_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS erp_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  hotel_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent_hash TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id, hotel_id) REFERENCES erp_users(id, hotel_id) ON DELETE CASCADE
);

ALTER TABLE order_status_history ADD COLUMN actor_erp_user_id TEXT REFERENCES erp_users(id) ON DELETE SET NULL;
ALTER TABLE admin_audit_log ADD COLUMN actor_erp_user_id TEXT REFERENCES erp_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_erp_users_hotel_status
  ON erp_users(hotel_id, status, user_code);

CREATE INDEX IF NOT EXISTS idx_erp_permissions_hotel_key
  ON erp_user_permissions(hotel_id, permission_key);

CREATE INDEX IF NOT EXISTS idx_erp_sessions_user_expires
  ON erp_sessions(hotel_id, user_id, expires_at);

INSERT OR IGNORE INTO admin_permissions (
  id, permission_key, module_key, description, created_at, updated_at
) VALUES (
  'perm-erp-master',
  'erp.master',
  'admin',
  'Acesso mestre aos ERPs operacionais de todas as unidades.',
  '2026-07-13T00:00:00.000Z',
  '2026-07-13T00:00:00.000Z'
);

INSERT OR IGNORE INTO admin_roles (
  id, role_key, name, description, created_at, updated_at
) VALUES (
  'role-erp-master',
  'erp-master',
  'Administrador mestre dos ERPs',
  'Perfil reservado ao administrador tecnico da plataforma.',
  '2026-07-13T00:00:00.000Z',
  '2026-07-13T00:00:00.000Z'
);

INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, '2026-07-13T00:00:00.000Z'
  FROM admin_roles r
  JOIN admin_permissions p ON p.permission_key = 'erp.master'
 WHERE r.role_key = 'erp-master';

INSERT OR IGNORE INTO admin_user_roles (user_id, role_id, created_at)
SELECT u.id, r.id, '2026-07-13T00:00:00.000Z'
  FROM admin_users u
  JOIN admin_roles r ON r.role_key = 'erp-master'
 WHERE u.id = 'user-demo-admin';
