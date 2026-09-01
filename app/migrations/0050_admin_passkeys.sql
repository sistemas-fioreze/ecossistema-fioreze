PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  user_handle TEXT NOT NULL,
  public_key_jwk TEXT NOT NULL,
  algorithm INTEGER NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0,
  device_name TEXT NOT NULL,
  transports_json TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  CHECK (algorithm = -7),
  CHECK (sign_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_admin_passkeys_user
  ON admin_passkeys(user_id, revoked_at, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_webauthn_challenges (
  challenge_hash TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  user_id TEXT REFERENCES admin_users(id) ON DELETE CASCADE,
  rp_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  CHECK (purpose IN ('register', 'authenticate')),
  CHECK (length(challenge_hash) = 64),
  CHECK (length(ip_hash) = 64 OR ip_hash IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_admin_webauthn_challenges_expires
  ON admin_webauthn_challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_webauthn_challenges_ip
  ON admin_webauthn_challenges(ip_hash, purpose, created_at)
  WHERE consumed_at IS NULL;
