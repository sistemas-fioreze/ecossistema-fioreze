import { run } from "../core/database.js";

const schemaPromises = new WeakMap();

export function ensureAdminTotpSchema(env) {
  if (!env?.DB || (typeof env.DB !== "object" && typeof env.DB !== "function")) {
    return Promise.reject(new Error("Binding DB não configurado para autenticador."));
  }
  const current = schemaPromises.get(env.DB);
  if (current) return current;
  const pending = applySchema(env).catch((error) => {
    schemaPromises.delete(env.DB);
    throw error;
  });
  schemaPromises.set(env.DB, pending);
  return pending;
}

async function applySchema(env) {
  await run(env, `CREATE TABLE IF NOT EXISTS admin_totp_config (
    user_id TEXT PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
    secret_ciphertext TEXT NOT NULL,
    secret_iv TEXT NOT NULL,
    enabled_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_used_step INTEGER
  )`);
  await run(env, `CREATE TABLE IF NOT EXISTS admin_totp_recovery_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    used_at TEXT
  )`);
  await run(env, `CREATE INDEX IF NOT EXISTS idx_admin_totp_recovery_user ON admin_totp_recovery_codes(user_id, used_at, created_at)`);
  await run(env, `CREATE TABLE IF NOT EXISTS admin_totp_setup_challenges (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    secret_ciphertext TEXT NOT NULL,
    secret_iv TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT
  )`);
  await run(env, `CREATE INDEX IF NOT EXISTS idx_admin_totp_setup_expiry ON admin_totp_setup_challenges(expires_at, consumed_at)`);
  await run(env, `CREATE TABLE IF NOT EXISTS admin_totp_login_challenges (
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
  )`);
  await run(env, `CREATE INDEX IF NOT EXISTS idx_admin_totp_login_expiry ON admin_totp_login_challenges(expires_at, consumed_at)`);
}
