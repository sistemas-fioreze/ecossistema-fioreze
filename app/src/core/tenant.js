import { all, first } from "./database.js";
import { notFoundError } from "./errors.js";
import { isSafeIdentifier } from "./identifiers.js";
import { getPublicFeatures } from "./feature-flags.js";

export async function getHotelBySlug(env, slug) {
  if (!isSafeIdentifier(slug)) return null;
  return first(
    env,
    `SELECT id, slug, name, short_name, timezone, locale, currency, status
       FROM hotels
      WHERE slug = ? AND archived_at IS NULL
      LIMIT 1`,
    [slug],
  );
}

export async function getHotelBranding(env, hotelId) {
  const row = await first(
    env,
    `SELECT logo_url, icon_url, primary_color, secondary_color, accent_color,
            background_color, text_color, font_family, custom_css_json
       FROM hotel_branding
      WHERE hotel_id = ?
      LIMIT 1`,
    [hotelId],
  );
  if (!row) return null;

  const custom = parseJsonObject(row.custom_css_json);
  return {
    logo_url: row.logo_url,
    icon_url: row.icon_url,
    horizontal_logo_url: custom.horizontal_logo_url || row.logo_url || null,
    cover_image_url: custom.cover_image_url || null,
    primary_color: row.primary_color,
    secondary_color: row.secondary_color,
    accent_color: row.accent_color,
    background_color: row.background_color,
    text_color: row.text_color,
    font_family: row.font_family,
  };
}

export async function getHotelSettings(env, hotelId) {
  const rows = await all(
    env,
    `SELECT setting_key, setting_value, value_type, is_public
       FROM hotel_settings
      WHERE hotel_id = ? AND is_public = 1
      ORDER BY setting_key`,
    [hotelId],
  );
  const settings = {};
  for (const row of rows) {
    settings[row.setting_key] = parseSettingValue(row.setting_value, row.value_type);
  }
  return settings;
}

export async function getServiceHours(env, hotelId) {
  const rows = await all(
    env,
    `SELECT sh.module_key, sh.day_of_week, sh.opens_at, sh.closes_at, sh.is_closed
       FROM service_hours sh
       JOIN hotel_modules hm
         ON hm.hotel_id = sh.hotel_id
        AND hm.module_key = sh.module_key
      WHERE sh.hotel_id = ?
        AND sh.status = 'active'
        AND sh.archived_at IS NULL
        AND hm.enabled = 1
        AND hm.is_public = 1
      ORDER BY sh.module_key, sh.day_of_week, sh.sort_order`,
    [hotelId],
  );

  return rows.reduce((grouped, row) => {
    if (!grouped[row.module_key]) grouped[row.module_key] = [];
    grouped[row.module_key].push({
      day_of_week: row.day_of_week,
      opens_at: row.opens_at,
      closes_at: row.closes_at,
      is_closed: Boolean(row.is_closed),
    });
    return grouped;
  }, {});
}

function parseSettingValue(value, type) {
  if (type === "boolean") return value === "true" || value === "1";
  if (type === "number") return Number(value);
  if (type === "json") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function getEnabledModules(env, hotelId, { publicOnly = true } = {}) {
  return all(
    env,
    `SELECT hm.hotel_id, hm.module_key, hm.enabled, hm.public_name, hm.navigation_label,
            hm.sort_order, m.name, m.description
       FROM hotel_modules hm
       JOIN modules m ON m.module_key = hm.module_key
      WHERE hm.hotel_id = ?
        AND hm.enabled = 1
        AND (? = 0 OR hm.is_public = 1)
      ORDER BY hm.sort_order, hm.module_key`,
    [hotelId, publicOnly ? 1 : 0],
  );
}

export async function getHotelModule(env, hotelId, moduleKey) {
  return first(
    env,
    `SELECT hotel_id, module_key, enabled, is_public, public_name, navigation_label, settings_json
       FROM hotel_modules
      WHERE hotel_id = ? AND module_key = ?
      LIMIT 1`,
    [hotelId, moduleKey],
  );
}

export async function getNavigation(env, hotelId) {
  return all(
    env,
    `SELECT module_key, label, path, icon_key, sort_order
       FROM navigation_items
      WHERE hotel_id = ? AND enabled = 1 AND is_public = 1
      ORDER BY sort_order, label`,
    [hotelId],
  );
}

export async function resolveTenantBySlug(env, slug) {
  const hotel = await getHotelBySlug(env, slug);
  if (!hotel || hotel.status !== "active") {
    throw notFoundError("Hotel nao encontrado ou indisponivel.");
  }

  const [branding, settings, modules, navigation, features, serviceHours] = await Promise.all([
    getHotelBranding(env, hotel.id),
    getHotelSettings(env, hotel.id),
    getEnabledModules(env, hotel.id),
    getNavigation(env, hotel.id),
    getPublicFeatures(env, hotel.id),
    getServiceHours(env, hotel.id),
  ]);

  return {
    hotel_id: hotel.id,
    slug: hotel.slug,
    name: hotel.name,
    short_name: hotel.short_name,
    timezone: hotel.timezone,
    locale: hotel.locale,
    currency: hotel.currency,
    status: hotel.status,
    branding: branding || {},
    settings,
    modules: modules.map((module) => ({
      module_key: module.module_key,
      name: module.public_name || module.name,
      navigation_label: module.navigation_label || module.public_name || module.name,
      enabled: Boolean(module.enabled),
    })),
    navigation,
    features,
    service_hours: serviceHours,
  };
}

export async function getBootstrap(env, slug) {
  const tenant = await resolveTenantBySlug(env, slug);
  return {
    hotel_id: tenant.hotel_id,
    slug: tenant.slug,
    name: tenant.name,
    short_name: tenant.short_name,
    timezone: tenant.timezone,
    locale: tenant.locale,
    currency: tenant.currency,
    branding: tenant.branding,
    modules: tenant.modules,
    navigation: tenant.navigation,
    features: tenant.features,
    service_hours: tenant.service_hours,
    settings: tenant.settings,
    service_status: {
      room_service: tenant.settings["room-service.operation_mode"] || tenant.settings["room_service.status"] || "automatic",
    },
    resources: {
      public_assets_base: `/assets/hotels/${tenant.slug}/`,
    },
  };
}
