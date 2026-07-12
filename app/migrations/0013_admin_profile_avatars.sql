PRAGMA foreign_keys = ON;

ALTER TABLE admin_users ADD COLUMN avatar_object_key TEXT;
ALTER TABLE admin_users ADD COLUMN avatar_mime_type TEXT CHECK (
  avatar_mime_type IS NULL OR avatar_mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
);
ALTER TABLE admin_users ADD COLUMN avatar_updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_users_avatar_updated ON admin_users(avatar_updated_at);
