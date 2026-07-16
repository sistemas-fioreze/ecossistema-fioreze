ALTER TABLE admin_users ADD COLUMN user_number INTEGER;
ALTER TABLE admin_roles ADD COLUMN role_number INTEGER;

UPDATE admin_users
   SET user_number = (
     SELECT COUNT(*)
       FROM admin_users AS ordered_users
      WHERE ordered_users.created_at < admin_users.created_at
         OR (ordered_users.created_at = admin_users.created_at AND ordered_users.id <= admin_users.id)
   )
 WHERE user_number IS NULL;

UPDATE admin_roles
   SET role_number = (
     SELECT COUNT(*)
       FROM admin_roles AS ordered_roles
      WHERE ordered_roles.created_at < admin_roles.created_at
         OR (ordered_roles.created_at = admin_roles.created_at AND ordered_roles.id <= admin_roles.id)
   )
 WHERE role_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_users_user_number
  ON admin_users(user_number)
  WHERE user_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_roles_role_number
  ON admin_roles(role_number)
  WHERE role_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_messages (
  id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  archived_by_sender_at TEXT,
  archived_by_recipient_at TEXT,
  FOREIGN KEY (sender_user_id) REFERENCES admin_users(id),
  FOREIGN KEY (recipient_user_id) REFERENCES admin_users(id),
  CHECK (sender_user_id <> recipient_user_id),
  CHECK (length(subject) BETWEEN 1 AND 160),
  CHECK (length(body) BETWEEN 1 AND 5000)
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_recipient_created
  ON admin_messages(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_messages_sender_created
  ON admin_messages(sender_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_messages_recipient_read
  ON admin_messages(recipient_user_id, read_at, created_at DESC);
