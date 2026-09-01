-- TOTP MFA for Central Administrativa.
CREATE TABLE IF NOT EXISTS admin_totp_config (
  user_id TEXT PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  secret_ciphertext TEXT NOT NULL,
  secret_iv TEXT NOT NULL,
  enabled_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_step INTEGER
);

CREATE TABLE IF NOT EXISTS admin_totp_recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_totp_recovery_user
  ON admin_totp_recovery_codes(user_id, used_at, created_at);

CREATE TABLE IF NOT EXISTS admin_totp_setup_challenges (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  secret_ciphertext TEXT NOT NULL,
  secret_iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_totp_setup_expiry
  ON admin_totp_setup_challenges(expires_at, consumed_at);

CREATE TABLE IF NOT EXISTS admin_totp_login_challenges (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  account_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  session_type TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  CHECK (attempt_count >= 0),
  CHECK (session_type IN ('full', 'password_change_required'))
);
CREATE INDEX IF NOT EXISTS idx_admin_totp_login_expiry
  ON admin_totp_login_challenges(expires_at, consumed_at);
