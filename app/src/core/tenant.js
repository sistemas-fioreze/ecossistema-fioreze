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
  return first(
    env,
    `SELECT logo_url, icon_url, primary_color, secondary_color, accent_color,
            background_color, text_color, font_family
       FROM hotel_branding
      WHERE hotel_id = ?
      LIMIT 1`,
    [hotelId],
  );
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

  const [branding, settings, modules, navigation, features] = await Promise.all([
    getHotelBranding(env, hotel.id),
    getHotelSettings(env, hotel.id),
    getEnabledModules(env, hotel.id),
    getNavigation(env, hotel.id),
    getPublicFeatures(env, hotel.id),
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
    settings: tenant.settings,
    service_status: {
      room_service: tenant.settings["room_service.status"] || "closed",
    },
    resources: {
      public_assets_base: `/assets/hotels/${tenant.slug}/`,
    },
  };
}
