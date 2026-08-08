ALTER TABLE admin_messages ADD COLUMN source_kind TEXT;
ALTER TABLE admin_messages ADD COLUMN source_hotel_id TEXT REFERENCES hotels(id) ON DELETE SET NULL;
ALTER TABLE admin_messages ADD COLUMN source_erp_user_id TEXT REFERENCES erp_users(id) ON DELETE SET NULL;
ALTER TABLE admin_messages ADD COLUMN attachment_object_key TEXT;
ALTER TABLE admin_messages ADD COLUMN attachment_mime_type TEXT;
ALTER TABLE admin_messages ADD COLUMN attachment_size_bytes INTEGER;
ALTER TABLE admin_messages ADD COLUMN attachment_checksum_sha256 TEXT;

INSERT OR IGNORE INTO admin_users (
  id, display_name, email, password_hash, password_strategy, status,
  force_password_change, created_at, updated_at
) VALUES (
  'system-erp-support',
  'Suporte ERP',
  'erp-support@system.invalid',
  'login-disabled',
  'system',
  'disabled',
  0,
  '2026-08-08T00:00:00.000Z',
  '2026-08-08T00:00:00.000Z'
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_source_hotel_created
  ON admin_messages(source_hotel_id, source_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_messages_source_erp_user
  ON admin_messages(source_erp_user_id, created_at DESC);
