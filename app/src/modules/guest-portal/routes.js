import { all } from "../../core/database.js";
import { notFoundError } from "../../core/errors.js";
import { ok } from "../../core/responses.js";
import { resolveTenantBySlug } from "../../core/tenant.js";
import { requireEnabledModule } from "../../middleware/require-module.js";
import { loadPublicBlog, loadPublicWeather } from "../../services/public-portal-feeds.js";

const MODULE_KEY = "guest-portal";

export function registerGuestPortalRoutes(router) {
  router.get("/api/v1/public/hotels/:hotel_slug/portal/home", getPortalHome);
  router.get("/api/v1/public/hotels/:hotel_slug/portal/pages", getPortalPages);
  router.get("/api/v1/public/hotels/:hotel_slug/portal/events", getPortalEvents);
  router.get("/api/v1/public/hotels/:hotel_slug/portal/blog", getPortalBlog);
  router.get("/api/v1/public/hotels/:hotel_slug/portal/weather", getPortalWeather);
}

async function getPortalHome({ env, params }) {
  const tenant = await requirePublicPortal(env, params.hotel_slug);
  const [pages, events, information] = await Promise.all([
    listPublishedPages(env, tenant.hotel_id),
    listPublishedEvents(env, tenant.hotel_id),
    listPublicInformation(env, tenant.hotel_id),
  ]);

  return ok(
    {
      hotel_id: tenant.hotel_id,
      module_key: MODULE_KEY,
      pages,
      events,
      information,
    },
    { cacheControl: "public, max-age=60" },
  );
}

async function getPortalPages({ env, params }) {
  const tenant = await requirePublicPortal(env, params.hotel_slug);
  return ok(
    {
      hotel_id: tenant.hotel_id,
      module_key: MODULE_KEY,
      pages: await listPublishedPages(env, tenant.hotel_id),
    },
    { cacheControl: "public, max-age=60" },
  );
}

async function getPortalEvents({ env, params }) {
  const tenant = await requirePublicPortal(env, params.hotel_slug);
  return ok(
    {
      hotel_id: tenant.hotel_id,
      module_key: MODULE_KEY,
      events: await listPublishedEvents(env, tenant.hotel_id),
    },
    { cacheControl: "public, max-age=60" },
  );
}

async function getPortalBlog({ env, params }) {
  const tenant = await requirePublicPortal(env, params.hotel_slug);
  try {
    const posts = await loadPublicBlog({ feedUrl: tenant.settings["portal.blog_feed_url"] });
    return ok({ hotel_id: tenant.hotel_id, posts, available: true }, { cacheControl: "public, max-age=300" });
  } catch {
    return ok({ hotel_id: tenant.hotel_id, posts: [], available: false }, { cacheControl: "public, max-age=60" });
  }
}

async function getPortalWeather({ env, params }) {
  const tenant = await requirePublicPortal(env, params.hotel_slug);
  try {
    const weather = await loadPublicWeather({
      latitude: tenant.settings["contact.latitude"],
      longitude: tenant.settings["contact.longitude"],
      timezone: tenant.timezone,
    });
    return ok({ hotel_id: tenant.hotel_id, ...weather }, { cacheControl: "public, max-age=300" });
  } catch {
    return ok({ hotel_id: tenant.hotel_id, available: false, current: null, forecast: [] }, { cacheControl: "public, max-age=60" });
  }
}

async function requirePublicPortal(env, slug) {
  const tenant = await resolveTenantBySlug(env, slug);
  const module = await requireEnabledModule(env, tenant.hotel_id, MODULE_KEY);
  if (!module.is_public) throw notFoundError("Modulo indisponivel para este hotel.");
  return tenant;
}

function listPublishedPages(env, hotelId) {
  return all(
    env,
    `SELECT id, slug, title, summary, sort_order, updated_at
       FROM portal_pages
      WHERE hotel_id = ?
        AND module_key = ?
        AND status = 'published'
        AND archived_at IS NULL
      ORDER BY sort_order, title`,
    [hotelId, MODULE_KEY],
  );
}

async function listPublishedEvents(env, hotelId) {
  const events = await all(
    env,
    `SELECT e.id, e.title, e.summary, e.content, e.location, e.category, e.tags_json,
            e.action_text, e.action_url, e.starts_at, e.ends_at, e.timezone,
            e.media_asset_id, ma.public_url AS image_url, ma.alt_text AS image_alt
       FROM events e
       LEFT JOIN media_assets ma
         ON ma.id = e.media_asset_id
        AND ma.hotel_id = e.hotel_id
        AND ma.status = 'active'
      WHERE e.hotel_id = ?
        AND e.status = 'published'
      ORDER BY e.starts_at, e.title
      LIMIT 24`,
    [hotelId],
  );
  return events.map(formatPublicEvent);
}

function formatPublicEvent(event) {
  return {
    ...event,
    tags: parseTags(event.tags_json),
    tags_json: undefined,
  };
}

function parseTags(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string").slice(0, 20) : [];
  } catch {
    return [];
  }
}

function listPublicInformation(env, hotelId) {
  return all(
    env,
    `SELECT id, info_key, title, body, sort_order
       FROM hotel_information
      WHERE hotel_id = ?
        AND is_public = 1
      ORDER BY sort_order, title`,
    [hotelId],
  );
}
