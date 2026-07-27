import { run } from "../core/database.js";

export function resolvePortalEventStatus(status, startsAt, isPermanent, now) {
  if (status !== "published" || isPermanent || !startsAt) return status;
  return Date.parse(startsAt) <= Date.parse(now) ? "archived" : status;
}

export async function archiveExpiredPortalEvents(env, { now = new Date().toISOString() } = {}) {
  const normalizedNow = new Date(now).toISOString();
  const result = await run(
    env,
    `UPDATE events
        SET status = 'archived',
            updated_at = ?
      WHERE status = 'published'
        AND is_permanent = 0
        AND starts_at <= ?`,
    [normalizedNow, normalizedNow],
  );
  return Number(result?.meta?.changes || 0);
}
