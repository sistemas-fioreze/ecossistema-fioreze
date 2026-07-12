import { first, run } from "../../core/database.js";
import { notFoundError } from "../../core/errors.js";
import { requestNow } from "../../core/time.js";
import { isShortLinkAvailable, normalizeShortLinkSlug } from "./shared.js";

const REDIRECT_HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "strict-origin-when-cross-origin",
};

export async function redirectShortLink({ request, env, ctx, params, head = false }) {
  const slug = normalizeShortLinkSlug(params.slug, { publicLookup: true });
  if (!slug) throw notFoundError("Link nao encontrado.");

  const now = requestNow({ request, env });
  const link = await first(
    env,
    `SELECT id, hotel_id, slug, destination_url, status, starts_at, expires_at, archived_at
       FROM short_links
      WHERE lower(slug) = lower(?)
      LIMIT 1`,
    [slug],
  );

  if (!isShortLinkAvailable(link, now)) throw notFoundError("Link nao encontrado.");

  if (!head) {
    const analytics = recordShortLinkClick({ env, link, clickedAt: now }).catch(() => null);
    if (ctx?.waitUntil) {
      ctx.waitUntil(analytics);
    } else {
      await analytics;
    }
  }

  const headers = new Headers(REDIRECT_HEADERS);
  headers.set("location", link.destination_url);
  return new Response(null, { status: 302, headers });
}

async function recordShortLinkClick({ env, link, clickedAt }) {
  const day = clickedAt.slice(0, 10);
  await run(
    env,
    `UPDATE short_links
        SET total_clicks = total_clicks + 1,
            last_clicked_at = ?
      WHERE id = ?`,
    [clickedAt, link.id],
  );
  await run(
    env,
    `INSERT INTO short_link_clicks_daily (
       short_link_id, hotel_id, click_date, click_count, first_clicked_at, last_clicked_at
     ) VALUES (?, ?, ?, 1, ?, ?)
     ON CONFLICT(short_link_id, click_date)
     DO UPDATE SET
       click_count = click_count + 1,
       last_clicked_at = excluded.last_clicked_at`,
    [link.id, link.hotel_id, day, clickedAt, clickedAt],
  );
}
