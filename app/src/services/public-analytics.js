import { run } from "../core/database.js";
import { configuredPrivacySecret, hmacSha256Hex, visitorRequestContext } from "../core/privacy.js";
import { requestNow } from "../core/time.js";
import { readJson, requireString } from "../core/validation.js";

const PAGE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const TRACKED_PAGE_KEYS = new Set(["inicio", "servicos", "eventos", "hotel", "blog", "room-service", "emporio", "spa", "romantic-packages"]);
export async function recordPublicPortalVisit({ request, env, hotelId }) {
  const payload = await readJson(request);
  const pageKey = requireString(payload.page_key, "page_key", { max: 80 }).toLowerCase();
  if (!PAGE_KEY_PATTERN.test(pageKey) || !TRACKED_PAGE_KEYS.has(pageKey)) return { tracked: false };

  const requestContext = visitorRequestContext(request, env);
  const secret = configuredPrivacySecret(env, "PORTAL_ANALYTICS_KEY", "SHORT_LINK_ANALYTICS_KEY", "LOGIN_RATE_LIMIT_KEY");
  if (!requestContext.ip || !secret) return { tracked: false };

  const visitedAt = requestNow({ request, env });
  const visitDate = visitedAt.slice(0, 10);
  const visitorHash = await hmacSha256Hex(secret, `portal:${hotelId}:${requestContext.ip}`);
  const inserted = await run(
    env,
    `INSERT OR IGNORE INTO portal_visit_visitors (
       hotel_id, page_key, visit_date, visitor_hash, country_code, region,
       first_visited_at, last_visited_at, visit_count
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      hotelId,
      pageKey,
      visitDate,
      visitorHash,
      requestContext.countryCode,
      requestContext.region,
      visitedAt,
      visitedAt,
    ],
  );

  if (Number(inserted?.meta?.changes || 0) === 1) {
    return { tracked: true, unique: true };
  }

  await run(
    env,
    `UPDATE portal_visit_visitors
        SET visit_count = visit_count + 1,
            last_visited_at = ?
      WHERE hotel_id = ?
        AND page_key = ?
        AND visit_date = ?
        AND visitor_hash = ?`,
    [visitedAt, hotelId, pageKey, visitDate, visitorHash],
  );
  return { tracked: true, unique: false };
}
