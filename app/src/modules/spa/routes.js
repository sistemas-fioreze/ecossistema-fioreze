import { all, first } from "../../core/database.js";
import { notFoundError } from "../../core/errors.js";
import { ok } from "../../core/responses.js";
import { resolveTenantBySlug } from "../../core/tenant.js";
import { requireEnabledModule } from "../../middleware/require-module.js";

const MODULE_KEY = "spa";
const SPA_LOCATION_TEXT = "Localizado no Hotel Müller & Fioreze, em Gramado.";

export function registerSpaRoutes(router) {
  router.get("/api/v1/public/hotels/:hotel_slug/spa/services", async ({ env, params }) => {
    const tenant = await resolveTenantBySlug(env, params.hotel_slug);
    const module = await requireEnabledModule(env, tenant.hotel_id, MODULE_KEY);
    if (!module.is_public) throw notFoundError("Modulo indisponivel para este hotel.");

    const [profile, services] = await Promise.all([
      loadActiveSpaProfile(env),
      listActiveSpaServices(env),
    ]);
    if (!profile) throw notFoundError("Catalogo do Spa indisponivel.");

    return ok(
      {
        hotel_id: tenant.hotel_id,
        hotel_name: tenant.name,
        module_key: MODULE_KEY,
        profile: formatSpaProfile(profile),
        services,
      },
      { cacheControl: "no-store" },
    );
  });
}

function loadActiveSpaProfile(env) {
  return first(
    env,
    `SELECT p.id, p.title, p.subtitle, p.intro_text, p.about_text,
            p.booking_title, p.booking_text, p.whatsapp_number,
            p.whatsapp_service_message, p.whatsapp_general_message,
            p.hours_text, p.usage_rules_json, p.logo_media_asset_id,
            ma.public_url AS logo_url, ma.alt_text AS logo_alt,
            p.status, p.updated_at
       FROM spa_shared_profile p
       LEFT JOIN media_assets ma
         ON ma.id = p.logo_media_asset_id
        AND ma.status = 'active'
      WHERE p.status = 'active'
      ORDER BY p.updated_at DESC
      LIMIT 1`,
  );
}

function listActiveSpaServices(env) {
  return all(
    env,
    `SELECT s.id, s.name, s.description, s.duration_label,
            s.duration_minutes, s.price_cents, s.currency,
            s.media_asset_id, ma.public_url AS image_url,
            ma.alt_text AS image_alt, s.sort_order, s.updated_at
       FROM spa_shared_services s
       LEFT JOIN media_assets ma
         ON ma.id = s.media_asset_id
        AND ma.status = 'active'
      WHERE s.status = 'active'
        AND s.archived_at IS NULL
      ORDER BY s.sort_order, s.name`,
  );
}

function formatSpaProfile(profile) {
  return {
    ...profile,
    location_text: SPA_LOCATION_TEXT,
    usage_rules: parseRules(profile.usage_rules_json),
    usage_rules_json: undefined,
  };
}

function parseRules(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.map((rule) => String(rule || "").trim()).filter(Boolean).slice(0, 30)
      : [];
  } catch {
    return [];
  }
}
