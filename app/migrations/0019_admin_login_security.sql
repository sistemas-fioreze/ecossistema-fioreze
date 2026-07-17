CREATE TABLE IF NOT EXISTS admin_login_attempts (
  identifier_type TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  lock_level INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  last_failed_at TEXT,
  locked_until TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (identifier_type, identifier_hash),
  CHECK (identifier_type IN ('account', 'ip')),
  CHECK (length(identifier_hash) = 64),
  CHECK (failure_count >= 0),
  CHECK (lock_level BETWEEN 0 AND 4)
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_locked_until
  ON admin_login_attempts(locked_until)
  WHERE locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_expires_at
  ON admin_login_attempts(expires_at);

CREATE TABLE IF NOT EXISTS admin_login_security_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  account_hash TEXT,
  ip_hash TEXT,
  reason_code TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  CHECK (length(account_hash) = 64 OR account_hash IS NULL),
  CHECK (length(ip_hash) = 64 OR ip_hash IS NULL),
  CHECK (event_type IN ('login_failure', 'login_blocked', 'login_success', 'challenge_unavailable'))
);

CREATE INDEX IF NOT EXISTS idx_admin_login_security_events_created_at
  ON admin_login_security_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_login_security_events_expires_at
  ON admin_login_security_events(expires_at);
