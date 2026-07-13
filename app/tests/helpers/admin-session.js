export const ADMIN_ORIGIN = "https://local.test";
export const DEMO_USER_ID = "user-demo-admin";
export const AURORA_USER_ID = "user-aurora-admin";
export const TEST_ADMIN_NOW = "2026-07-12T12:00:00.000Z";
export const TEST_ADMIN_CREATED_AT = "2026-07-12T11:00:00.000Z";
export const TEST_ADMIN_EXPIRES_AT = "2026-07-12T13:00:00.000Z";

export async function createSessionCookie(env, userId = DEMO_USER_ID, overrides = {}) {
  const token = `test-session-${crypto.randomUUID()}`;
  env.__data.adminSessions.push({
    id: `sess-${crypto.randomUUID()}`,
    user_id: userId,
    token_hash: await sha256Hex(token),
    user_agent_hash: null,
    ip_hash: null,
    session_type: "full",
    created_at: TEST_ADMIN_CREATED_AT,
    expires_at: TEST_ADMIN_EXPIRES_AT,
    revoked_at: null,
    ...overrides,
  });
  return `fioreze_admin_session=${token}`;
}

export async function createErpSessionCookie(env, userId = "erp-user-muller-1", overrides = {}) {
  const user = env.__data.erpUsers.find((entry) => entry.id === userId);
  if (!user) throw new Error(`ERP fixture user not found: ${userId}`);
  const token = `test-erp-session-${crypto.randomUUID()}`;
  env.__data.erpSessions.push({
    id: `erpsess-${crypto.randomUUID()}`,
    user_id: user.id,
    hotel_id: user.hotel_id,
    token_hash: await sha256Hex(token),
    user_agent_hash: null,
    ip_hash: null,
    created_at: TEST_ADMIN_CREATED_AT,
    expires_at: TEST_ADMIN_EXPIRES_AT,
    revoked_at: null,
    ...overrides,
  });
  return `fioreze_erp_session=${token}`;
}

export function withCookie(cookie, init = {}) {
  return {
    ...init,
    headers: {
      "x-fioreze-test-now": TEST_ADMIN_NOW,
      ...(init.headers || {}),
      cookie,
    },
  };
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
