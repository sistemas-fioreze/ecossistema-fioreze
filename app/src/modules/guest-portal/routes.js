import { all } from "../../core/database.js";
import { notFoundError } from "../../core/errors.js";
import { ok } from "../../core/responses.js";
import { resolveTenantBySlug } from "../../core/tenant.js";
import { requireEnabledModule } from "../../middleware/require-module.js";

const MODULE_KEY = "guest-portal";

export function registerGuestPortalRoutes(router) {
  router.get("/api/v1/public/hotels/:hotel_slug/portal/home", getPortalHome);
  router.get("/api/v1/public/hotels/:hotel_slug/portal/pages", getPortalPages);
  router.get("/api/v1/public/hotels/:hotel_slug/portal/events", getPortalEvents);
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

function listPublishedEvents(env, hotelId) {
  return all(
    env,
    `SELECT id, title, summary, starts_at, ends_at, timezone
       FROM events
      WHERE hotel_id = ?
        AND status = 'published'
      ORDER BY starts_at, title
      LIMIT 24`,
    [hotelId],
  );
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
