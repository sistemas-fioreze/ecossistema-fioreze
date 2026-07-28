import { first, run } from "../../core/database.js";
import { notFoundError } from "../../core/errors.js";
import { configuredPrivacySecret, hmacSha256Hex, visitorRequestContext } from "../../core/privacy.js";
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
    const analytics = recordShortLinkClick({ request, env, link, clickedAt: now }).catch(() => null);
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

async function recordShortLinkClick({ request, env, link, clickedAt }) {
  const visitor = await resolveVisitorAnalytics({ request, env, link, clickedAt });
  if (visitor) {
    await recordUniqueVisitorClick({ env, link, clickedAt, visitor });
    return;
  }
  await recordAggregateClick({ env, link, clickedAt });
}

async function recordUniqueVisitorClick({ env, link, clickedAt, visitor }) {
  const day = clickedAt.slice(0, 10);
  const lifetimeInsert = await run(
    env,
    `INSERT OR IGNORE INTO short_link_unique_visitors (
       short_link_id, hotel_id, visitor_hash, country_code, region,
       first_clicked_at, last_clicked_at, click_count
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [link.id, link.hotel_id, visitor.visitorHash, visitor.countryCode, visitor.region, clickedAt, clickedAt],
  );
  if (Number(lifetimeInsert?.meta?.changes || 0) === 0) {
    await run(
      env,
      `UPDATE short_link_unique_visitors
          SET click_count = click_count + 1,
              last_clicked_at = ?
        WHERE short_link_id = ?
          AND visitor_hash = ?`,
      [clickedAt, link.id, visitor.visitorHash],
    );
  }

  const dailyInsert = await run(
    env,
    `INSERT OR IGNORE INTO short_link_click_visitors (
       short_link_id, hotel_id, click_date, visitor_hash, country_code, region,
       first_clicked_at, last_clicked_at, click_count
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [link.id, link.hotel_id, day, visitor.visitorHash, visitor.countryCode, visitor.region, clickedAt, clickedAt],
  );
  if (Number(dailyInsert?.meta?.changes || 0) === 1) {
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
  } else {
    await run(
      env,
      `UPDATE short_link_click_visitors
          SET click_count = click_count + 1,
              last_clicked_at = ?
        WHERE short_link_id = ?
          AND click_date = ?
          AND visitor_hash = ?`,
      [clickedAt, link.id, day, visitor.visitorHash],
    );
  }

  if (Number(lifetimeInsert?.meta?.changes || 0) === 1) {
    await run(
      env,
      `UPDATE short_links
          SET total_clicks = total_clicks + 1,
              last_clicked_at = ?
        WHERE id = ?`,
      [clickedAt, link.id],
    );
  } else {
    await run(env, "UPDATE short_links SET last_clicked_at = ? WHERE id = ?", [clickedAt, link.id]);
  }
}

async function recordAggregateClick({ env, link, clickedAt }) {
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

async function resolveVisitorAnalytics({ request, env, link, clickedAt }) {
  const requestContext = visitorRequestContext(request, env);
  const secret = configuredPrivacySecret(env, "SHORT_LINK_ANALYTICS_KEY", "LOGIN_RATE_LIMIT_KEY");
  if (!requestContext.ip || !secret) return null;
  const visitorHash = await hmacSha256Hex(secret, `short-link:${link.id}:${requestContext.ip}`);
  return {
    visitorHash,
    countryCode: requestContext.countryCode,
    region: requestContext.region,
  };
}
