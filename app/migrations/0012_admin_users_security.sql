PRAGMA foreign_keys = ON;

ALTER TABLE admin_sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'full'
  CHECK (session_type IN ('full', 'password_change_required'));

ALTER TABLE admin_users ADD COLUMN password_changed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_sessions_type_expires ON admin_sessions(session_type, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_users_email_status ON admin_users(email, status);

INSERT OR IGNORE INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at) VALUES
  ('perm-admin-users-read', 'admin.users.read', 'admin', 'Visualizar usuarios administrativos.', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-admin-users-create', 'admin.users.create', 'admin', 'Criar usuarios administrativos.', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-admin-users-update', 'admin.users.update', 'admin', 'Editar usuarios administrativos.', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-admin-users-disable', 'admin.users.disable', 'admin', 'Ativar e desativar usuarios administrativos.', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-admin-users-password-reset', 'admin.users.password_reset', 'admin', 'Redefinir senhas administrativas.', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-admin-users-sessions-revoke', 'admin.users.sessions_revoke', 'admin', 'Encerrar sessoes administrativas.', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-admin-roles-read', 'admin.roles.read', 'admin', 'Visualizar perfis administrativos.', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-admin-roles-create', 'admin.roles.create', 'admin', 'Criar perfis administrativos.', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-admin-roles-update', 'admin.roles.update', 'admin', 'Editar perfis administrativos.', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-admin-roles-permissions', 'admin.roles.permissions', 'admin', 'Alterar permissoes de perfis administrativos.', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('perm-admin-audit-read', 'admin.audit.read', 'admin', 'Visualizar auditoria administrativa.', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z');
