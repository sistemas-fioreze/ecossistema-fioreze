import { run } from "../core/database.js";

export function resolvePortalEventStatus(status, endsAt, now) {
  if (status !== "published" || !endsAt) return status;
  return Date.parse(endsAt) <= Date.parse(now) ? "archived" : status;
}

export async function archiveExpiredPortalEvents(env, { now = new Date().toISOString() } = {}) {
  const normalizedNow = new Date(now).toISOString();
  const result = await run(
    env,
    `UPDATE events
        SET status = 'archived',
            updated_at = ?
      WHERE status = 'published'
        AND ends_at IS NOT NULL
        AND ends_at <= ?`,
    [normalizedNow, normalizedNow],
  );
  return Number(result?.meta?.changes || 0);
}
