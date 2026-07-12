import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError } from "../../core/errors.js";
import { createPublicId, isSafeIdentifier } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireString } from "../../core/validation.js";
import {
  assertAdminMutationAllowed,
  requireAdminHotelAccess,
  requirePermission,
} from "../../services/admin-auth.js";

export const HOTELS_READ_PERMISSION = "portals.hotels.read";
export const HOTELS_CREATE_PERMISSION = "portals.hotels.create";
export const HOTELS_UPDATE_PERMISSION = "portals.hotels.update";
export const HOTELS_BRANDING_PERMISSION = "portals.hotels.branding";
export const HOTELS_SETTINGS_PERMISSION = "portals.hotels.settings";
export const HOTELS_MODULES_PERMISSION = "portals.hotels.modules";
export const HOTELS_NAVIGATION_PERMISSION = "portals.hotels.navigation";

const RESERVED_SLUGS = new Set(["admin", "api", "media", "assets", "css", "js", "favicon"]);
const HOTEL_STATUSES = new Set(["active", "inactive", "archived"]);
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const INTERNAL_PATH = /^\/[a-z0-9][a-z0-9/_-]*(?:\/)?$/;
const PUBLIC_SETTINGS = new Set([
  "general.short_description",
  "general.institutional_description",
  "general.opened_at",
  "contact.address",
  "contact.number",
  "contact.complement",
  "contact.district",
  "contact.city",
  "contact.state",
  "contact.postal_code",
  "contact.country",
  "contact.latitude",
  "contact.longitude",
  "contact.phone",
  "contact.whatsapp",
  "contact.email",
  "contact.website",
  "contact.maps_url",
  "hosting.check_in",
  "hosting.check_out",
  "hosting.breakfast_hours",
  "hosting.reception_hours",
  "hosting.parking_info",
  "hosting.wifi_info",
  "hosting.pet_policy",
  "hosting.house_rules",
  "hosting.welcome_text",
  "hosting.emergency_contact",
  "hosting.arrival_instructions",
  "seo.title",
  "seo.description",
  "seo.social_image_asset_id",
  "seo.canonical_base",
  "seo.share_name",
  "seo.browser_color",
]);
const TEXT_SETTING_MAX = 1200;
const BRANDING_COLOR_FIELDS = new Set([
  "primary_color",
  "secondary_color",
  "accent_color",
  "background_color",
  "surface_color",
  "text_color",
  "muted_text_color",
  "browser_theme_color",
]);
const BRANDING_MEDIA_FIELDS = new Set([
  "logo_url",
  "horizontal_logo_url",
  "icon_url",
  "favicon_url",
  "cover_image_url",
  "social_image_url",
]);
const SAFE_ICONS = new Set(["home", "utensils", "shopping-bag", "sparkles", "calendar", "map-pin", "image", "info", "phone"]);

export async function listAdminHotels({ env, session, url }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  if (!session.hotel_ids.length) return { hotels: [] };

  const requestedStatus = optionalString(url?.searchParams?.get("status"), "status", { max: 30 });
  const search = optionalString(url?.searchParams?.get("q"), "q", { max: 120 }).toLowerCase();
  const sort = optionalString(url?.searchParams?.get("sort"), "sort", { max: 30 }) || "name";
  if (requestedStatus && !HOTEL_STATUSES.has(requestedStatus)) throw badRequest("status de unidade invalido.");
  if (!["name", "updated_at"].includes(sort)) throw badRequest("ordenacao de unidade invalida.");

  const placeholders = session.hotel_ids.map(() => "?").join(", ");
  const filters = [`h.id IN (${placeholders})`];
  const params = [...session.hotel_ids];
  if (requestedStatus) {
    filters.push("h.status = ?");
    params.push(requestedStatus);
  }
  if (search) {
    filters.push("(lower(h.name) LIKE ? OR lower(h.short_name) LIKE ? OR lower(h.slug) LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const rows = await all(
    env,
    `SELECT h.id, h.slug, h.name, h.short_name, h.timezone, h.locale, h.currency,
            h.status, h.created_at, h.updated_at, h.archived_at,
            hb.logo_url, hb.icon_url, hb.primary_color, hb.secondary_color,
            hb.accent_color, hb.background_color, hb.text_color,
            aha.access_level,
            COALESCE(SUM(CASE WHEN hm.enabled = 1 THEN 1 ELSE 0 END), 0) AS active_module_count
       FROM hotels h
       JOIN admin_hotel_access aha ON aha.hotel_id = h.id
      LEFT JOIN hotel_branding hb ON hb.hotel_id = h.id
      LEFT JOIN hotel_modules hm ON hm.hotel_id = h.id
      WHERE aha.user_id = ?
        AND ${filters.join(" AND ")}
      GROUP BY h.id
      ORDER BY ${sort === "updated_at" ? "h.updated_at DESC, h.name" : "h.name"}`,
    [session.user.id, ...params],
  );

  return { hotels: rows.map(formatHotelSummary) };
}

export async function createAdminHotel({ request, env, session }) {
  requirePermission(session, HOTELS_CREATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  rejectUnknown(payload, new Set(["name", "short_name", "slug", "timezone", "locale", "currency"]));

  const slug = validateSlug(payload.slug);
  const existing = await findHotelBySlug(env, slug);
  if (existing) throw conflict("Slug de unidade ja cadastrado.");

  const now = requestNow({ request, env });
  const hotelId = slug;
  const name = requireString(payload.name, "name", { max: 180 });
  const shortName = requireString(payload.short_name, "short_name", { max: 80 });
  const timezone = validateTimezone(payload.timezone);
  const locale = validateLocale(payload.locale);
  const currency = validateCurrency(payload.currency);

  await batch(env, [
    statement(
      env,
      `INSERT INTO hotels (id, slug, name, short_name, timezone, locale, currency, status, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'inactive', ?, ?, NULL)`,
      [hotelId, slug, name, shortName, timezone, locale, currency, now, now],
    ),
    statement(
      env,
      `INSERT INTO hotel_branding (hotel_id, logo_url, icon_url, primary_color, secondary_color, accent_color,
                                  background_color, text_color, font_family, custom_css_json, updated_at)
       VALUES (?, NULL, NULL, '#513b2d', '#f4f1ef', '#c1a94c', '#fbf8f4', '#202124',
               'Effra, Inter, system-ui, sans-serif', ?, ?)`,
      [hotelId, JSON.stringify(defaultBrandingJson()), now],
    ),
    auditStatement(env, {
      hotelId,
      actorUserId: session.user.id,
      action: "hotel.create",
      entityId: hotelId,
      metadata: { fields: ["name", "short_name", "slug", "timezone", "locale", "currency"] },
      createdAt: now,
    }),
  ]);

  return {
    hotel: {
      ...formatHotelSummary({
        id: hotelId,
        slug,
        name,
        short_name: shortName,
        timezone,
        locale,
        currency,
        status: "inactive",
        created_at: now,
        updated_at: now,
        archived_at: null,
        logo_url: null,
        icon_url: null,
        primary_color: "#513b2d",
        secondary_color: "#f4f1ef",
        accent_color: "#c1a94c",
        background_color: "#fbf8f4",
        text_color: "#202124",
        access_level: null,
        active_module_count: 0,
      }),
      access_pending: true,
    },
  };
}

export async function getAdminHotel({ env, session, hotelId }) {
  requirePermission(session, HOTELS_READ_PERMISSION);
  return { hotel: await loadHotelDetail({ env, session, hotelId }) };
}

export async function updateAdminHotel({ request, env, session, hotelId }) {
  requirePermission(session, HOTELS_UPDATE_PERMISSION);
  assertAdminMutationAllowed({ request });
  requireAdminHotelAccess(session, hotelId);
  const current = await loadHotelRow(env, session, hotelId);
  if (!current) throw notFoundError("Unidade nao encontrada.");

  const payload = await readJson(request);
  rejectUnknown(payload, new Set(["name", "short_name", "slug", "timezone", "locale", "currency", "status"]));
  const next = {
    name: Object.hasOwn(payload, "name") ? requireString(payload.name, "name", { max: 180 }) : current.name,
    short_name: Object.hasOwn(payload, "short_name")
      ? requireString(payload.short_name, "short_name", { max: 80 })
      : current.short_name,
    slug: Object.hasOwn(payload, "slug") ? validateSlug(payload.slug) : current.slug,
    timezone: Object.hasOwn(payload, "timezone") ? validateTimezone(payload.timezone) : current.timezone,
    locale: Object.hasOwn(payload, "locale") ? validateLocale(payload.locale) : current.locale,
    currency: Object.hasOwn(payload, "currency") ? validateCurrency(payload.currency) : current.currency,
    status: Object.hasOwn(payload, "status") ? validateStatus(payload.status) : current.status,
  };
  if (next.slug !== current.slug) {
    const existing = await findHotelBySlug(env, next.slug);
    if (existing && existing.id !== hotelId) throw conflict("Slug de unidade ja cadastrado.");
  }
  const changedFields = diffFields(current, next, ["name", "short_name", "slug", "timezone", "locale", "currency", "status"]);
  if (!changedFields.length) return { hotel: await loadHotelDetail({ env, session, hotelId }), changed_fields: [] };

  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE hotels
          SET name = ?, short_name = ?, slug = ?, timezone = ?, locale = ?, currency = ?,
              status = ?, updated_at = ?, archived_at = CASE WHEN ? = 'archived' THEN COALESCE(archived_at, ?) ELSE NULL END
        WHERE id = ?`,
      [
        next.name,
        next.short_name,
        next.slug,
        next.timezone,
        next.locale,
        next.currency,
        next.status,
        now,
        next.status,
        now,
        hotelId,
      ],
    ),
    auditStatement(env, {
      hotelId,
      actorUserId: session.user.id,
      action: "hotel.update",
      entityId: hotelId,
      metadata: { changed_fields: changedFields },
      createdAt: now,
    }),
  ]);
  return { hotel: await loadHotelDetail({ env, session, hotelId }), changed_fields: changedFields };
}

export async function getAdminHotelBranding({ env, session, hotelId }) {
  requirePermission(session, HOTELS_BRANDING_PERMISSION);
  requireAdminHotelAccess(session, hotelId);
  await ensureHotelVisible(env, session, hotelId);
  return { branding: await loadBranding(env, hotelId) };
}

export async function updateAdminHotelBranding({ request, env, session, hotelId }) {
  requirePermission(session, HOTELS_BRANDING_PERMISSION);
  assertAdminMutationAllowed({ request });
  requireAdminHotelAccess(session, hotelId);
  await ensureHotelVisible(env, session, hotelId);
  const payload = await readJson(request);
  const allowed = new Set([...BRANDING_COLOR_FIELDS, ...BRANDING_MEDIA_FIELDS, "font_family", "theme"]);
  rejectUnknown(payload, allowed);

  const current = await loadBranding(env, hotelId);
  const custom = parseJson(current.custom_css_json, {});
  const next = { ...current };
  const customNext = { ...custom };
  const changedFields = [];

  for (const field of BRANDING_COLOR_FIELDS) {
    if (!Object.hasOwn(payload, field)) continue;
    const color = validateHexColor(payload[field], field);
    if (["surface_color", "muted_text_color", "browser_theme_color"].includes(field)) {
      if (customNext[field] !== color) changedFields.push(field);
      customNext[field] = color;
    } else {
      if (next[field] !== color) changedFields.push(field);
      next[field] = color;
    }
  }
  for (const field of BRANDING_MEDIA_FIELDS) {
    if (!Object.hasOwn(payload, field)) continue;
    const publicUrl = await validateMediaSelection(env, hotelId, payload[field]);
    if (["horizontal_logo_url", "favicon_url", "cover_image_url", "social_image_url"].includes(field)) {
      if ((customNext[field] || null) !== publicUrl) changedFields.push(field);
      customNext[field] = publicUrl;
    } else {
      if ((next[field] || null) !== publicUrl) changedFields.push(field);
      next[field] = publicUrl;
    }
  }
  if (Object.hasOwn(payload, "font_family")) {
    const fontFamily = optionalString(payload.font_family, "font_family", { max: 160 }) || "Effra, Inter, system-ui, sans-serif";
    if (next.font_family !== fontFamily) changedFields.push("font_family");
    next.font_family = fontFamily;
  }
  if (Object.hasOwn(payload, "theme")) {
    const theme = optionalString(payload.theme, "theme", { max: 20 }) || "light";
    if (!["light"].includes(theme)) throw badRequest("Tema invalido.");
    if (customNext.theme !== theme) changedFields.push("theme");
    customNext.theme = theme;
  }
  if (!changedFields.length) return { branding: formatBranding(current), changed_fields: [] };

  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE hotel_branding
          SET logo_url = ?, icon_url = ?, primary_color = ?, secondary_color = ?, accent_color = ?,
              background_color = ?, text_color = ?, font_family = ?, custom_css_json = ?, updated_at = ?
        WHERE hotel_id = ?`,
      [
        next.logo_url,
        next.icon_url,
        next.primary_color,
        next.secondary_color,
        next.accent_color,
        next.background_color,
        next.text_color,
        next.font_family,
        JSON.stringify(customNext),
        now,
        hotelId,
      ],
    ),
    auditStatement(env, {
      hotelId,
      actorUserId: session.user.id,
      action: "hotel.branding.update",
      entityId: hotelId,
      metadata: { changed_fields: changedFields },
      createdAt: now,
    }),
  ]);
  return { branding: await loadBranding(env, hotelId), changed_fields: changedFields };
}

export async function getAdminHotelSettings({ env, session, hotelId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  requireAdminHotelAccess(session, hotelId);
  await ensureHotelVisible(env, session, hotelId);
  return { settings: await loadSettings(env, hotelId) };
}

export async function updateAdminHotelSettings({ request, env, session, hotelId }) {
  requirePermission(session, HOTELS_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  requireAdminHotelAccess(session, hotelId);
  await ensureHotelVisible(env, session, hotelId);
  const payload = await readJson(request);
  rejectUnknown(payload, PUBLIC_SETTINGS);
  const entries = Object.entries(payload);
  if (!entries.length) return { settings: await loadSettings(env, hotelId), changed_fields: [] };
  const now = requestNow({ request, env });
  const statements = [];
  const changedFields = [];
  for (const [key, value] of entries) {
    const normalized = validateSetting(key, value);
    if (key === "seo.social_image_asset_id" && normalized.value) {
      await validateMediaSelection(env, hotelId, normalized.value);
    }
    changedFields.push(key);
    statements.push(
      statement(
        env,
        `INSERT INTO hotel_settings (id, hotel_id, setting_key, setting_value, value_type, is_public, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(hotel_id, setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           value_type = excluded.value_type,
           is_public = excluded.is_public,
           updated_at = excluded.updated_at`,
        [settingId(hotelId, key), hotelId, key, normalized.value, normalized.type, 1, now, now],
      ),
    );
  }
  statements.push(
    auditStatement(env, {
      hotelId,
      actorUserId: session.user.id,
      action: "hotel.settings.update",
      entityId: hotelId,
      metadata: { changed_fields: changedFields },
      createdAt: now,
    }),
  );
  await batch(env, statements);
  return { settings: await loadSettings(env, hotelId), changed_fields: changedFields };
}

export async function listAdminHotelModules({ env, session, hotelId }) {
  requirePermission(session, HOTELS_MODULES_PERMISSION);
  requireAdminHotelAccess(session, hotelId);
  await ensureHotelVisible(env, session, hotelId);
  const rows = await all(
    env,
    `SELECT m.module_key, m.name, m.description, m.status,
            COALESCE(hm.enabled, 0) AS enabled,
            COALESCE(hm.is_public, 1) AS is_public,
            hm.public_name, hm.navigation_label, hm.sort_order, hm.settings_json
       FROM modules m
       LEFT JOIN hotel_modules hm ON hm.module_key = m.module_key AND hm.hotel_id = ?
      ORDER BY COALESCE(hm.sort_order, 100), m.name`,
    [hotelId],
  );
  return { modules: rows.map(formatHotelModule) };
}

export async function updateAdminHotelModules({ request, env, session, hotelId }) {
  requirePermission(session, HOTELS_MODULES_PERMISSION);
  assertAdminMutationAllowed({ request });
  requireAdminHotelAccess(session, hotelId);
  await ensureHotelVisible(env, session, hotelId);
  const payload = await readJson(request);
  rejectUnknown(payload, new Set(["modules"]));
  if (!Array.isArray(payload.modules)) throw badRequest("modules deve ser uma lista.");
  if (payload.modules.length > 50) throw badRequest("modules excede o limite permitido.");
  const now = requestNow({ request, env });
  const statements = [];
  const changed = [];
  for (const entry of payload.modules) {
    rejectUnknown(entry, new Set(["module_key", "enabled", "is_public", "public_name", "navigation_label", "sort_order"]));
    const moduleKey = validateModuleKey(entry.module_key);
    const moduleExists = await first(env, "SELECT module_key FROM modules WHERE module_key = ? LIMIT 1", [moduleKey]);
    if (!moduleExists) throw badRequest("Modulo inexistente.");
    const enabled = toBooleanInteger(entry.enabled);
    const isPublic = Object.hasOwn(entry, "is_public") ? toBooleanInteger(entry.is_public) : 1;
    const sortOrder = validateSortOrder(entry.sort_order ?? 100);
    statements.push(
      statement(
        env,
        `INSERT INTO hotel_modules (hotel_id, module_key, enabled, is_public, public_name, navigation_label,
                                   sort_order, settings_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)
         ON CONFLICT(hotel_id, module_key) DO UPDATE SET
           enabled = excluded.enabled,
           is_public = excluded.is_public,
           public_name = excluded.public_name,
           navigation_label = excluded.navigation_label,
           sort_order = excluded.sort_order,
           updated_at = excluded.updated_at`,
        [
          hotelId,
          moduleKey,
          enabled,
          isPublic,
          optionalString(entry.public_name, "public_name", { max: 80 }) || null,
          optionalString(entry.navigation_label, "navigation_label", { max: 80 }) || null,
          sortOrder,
          now,
          now,
        ],
      ),
    );
    changed.push(moduleKey);
  }
  statements.push(
    auditStatement(env, {
      hotelId,
      actorUserId: session.user.id,
      action: "hotel.modules.update",
      entityId: hotelId,
      metadata: { modules: changed },
      createdAt: now,
    }),
  );
  await batch(env, statements);
  return listAdminHotelModules({ env, session, hotelId });
}

export async function listAdminHotelNavigation({ env, session, hotelId }) {
  requirePermission(session, HOTELS_NAVIGATION_PERMISSION);
  requireAdminHotelAccess(session, hotelId);
  await ensureHotelVisible(env, session, hotelId);
  const rows = await all(
    env,
    `SELECT id, hotel_id, module_key, label, path, icon_key, sort_order, is_public, enabled, created_at, updated_at
       FROM navigation_items
      WHERE hotel_id = ?
      ORDER BY sort_order, label`,
    [hotelId],
  );
  return { navigation: rows.map(formatNavigationItem) };
}

export async function createAdminHotelNavigation({ request, env, session, hotelId }) {
  requirePermission(session, HOTELS_NAVIGATION_PERMISSION);
  assertAdminMutationAllowed({ request });
  requireAdminHotelAccess(session, hotelId);
  await ensureHotelVisible(env, session, hotelId);
  const payload = await readJson(request);
  const item = await validateNavigationPayload(env, payload, { partial: false });
  const now = requestNow({ request, env });
  const id = createPublicId("nav");
  await batch(env, [
    statement(
      env,
      `INSERT INTO navigation_items (id, hotel_id, module_key, label, path, icon_key, sort_order,
                                    is_public, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, hotelId, item.module_key, item.label, item.path, item.icon_key, item.sort_order, item.is_public, item.enabled, now, now],
    ),
    auditStatement(env, {
      hotelId,
      moduleKey: item.module_key,
      actorUserId: session.user.id,
      action: "hotel.navigation.create",
      entityId: id,
      metadata: { fields: ["label", "path", "module_key", "sort_order"] },
      createdAt: now,
    }),
  ]);
  return { item: (await listAdminHotelNavigation({ env, session, hotelId })).navigation.find((entry) => entry.id === id) };
}

export async function updateAdminHotelNavigation({ request, env, session, hotelId, itemId }) {
  requirePermission(session, HOTELS_NAVIGATION_PERMISSION);
  assertAdminMutationAllowed({ request });
  requireAdminHotelAccess(session, hotelId);
  const current = await loadNavigationItem(env, hotelId, itemId);
  if (!current) throw notFoundError("Item de navegacao nao encontrado.");
  const payload = await readJson(request);
  const item = await validateNavigationPayload(env, { ...current, ...payload }, { partial: false });
  const changedFields = Object.keys(payload).filter((key) => key in item);
  const now = requestNow({ request, env });
  await batch(env, [
    statement(
      env,
      `UPDATE navigation_items
          SET module_key = ?, label = ?, path = ?, icon_key = ?, sort_order = ?,
              is_public = ?, enabled = ?, updated_at = ?
        WHERE id = ? AND hotel_id = ?`,
      [item.module_key, item.label, item.path, item.icon_key, item.sort_order, item.is_public, item.enabled, now, itemId, hotelId],
    ),
    auditStatement(env, {
      hotelId,
      moduleKey: item.module_key,
      actorUserId: session.user.id,
      action: "hotel.navigation.update",
      entityId: itemId,
      metadata: { changed_fields: changedFields },
      createdAt: now,
    }),
  ]);
  return { item: await loadNavigationItem(env, hotelId, itemId), changed_fields: changedFields };
}

export async function archiveAdminHotelNavigation({ request, env, session, hotelId, itemId }) {
  requirePermission(session, HOTELS_NAVIGATION_PERMISSION);
  assertAdminMutationAllowed({ request });
  requireAdminHotelAccess(session, hotelId);
  const current = await loadNavigationItem(env, hotelId, itemId);
  if (!current) throw notFoundError("Item de navegacao nao encontrado.");
  const now = requestNow({ request, env });
  await batch(env, [
    statement(env, "UPDATE navigation_items SET enabled = 0, updated_at = ? WHERE id = ? AND hotel_id = ?", [now, itemId, hotelId]),
    auditStatement(env, {
      hotelId,
      moduleKey: current.module_key,
      actorUserId: session.user.id,
      action: "hotel.navigation.archive",
      entityId: itemId,
      metadata: { previous_enabled: current.enabled },
      createdAt: now,
    }),
  ]);
  return { item: await loadNavigationItem(env, hotelId, itemId), archived: true };
}

async function loadHotelDetail({ env, session, hotelId }) {
  requireAdminHotelAccess(session, hotelId);
  const hotel = await loadHotelRow(env, session, hotelId);
  if (!hotel) throw notFoundError("Unidade nao encontrada.");
  return {
    ...formatHotelSummary(hotel),
    branding: await loadBranding(env, hotelId),
    settings: await loadSettings(env, hotelId),
  };
}

async function loadHotelRow(env, session, hotelId) {
  const placeholders = session.hotel_ids.map(() => "?").join(", ");
  if (!placeholders) return null;
  return first(
    env,
    `SELECT h.id, h.slug, h.name, h.short_name, h.timezone, h.locale, h.currency,
            h.status, h.created_at, h.updated_at, h.archived_at,
            hb.logo_url, hb.icon_url, hb.primary_color, hb.secondary_color,
            hb.accent_color, hb.background_color, hb.text_color, hb.font_family,
            hb.custom_css_json, aha.access_level,
            COALESCE(SUM(CASE WHEN hm.enabled = 1 THEN 1 ELSE 0 END), 0) AS active_module_count
       FROM hotels h
       JOIN admin_hotel_access aha ON aha.hotel_id = h.id AND aha.user_id = ?
      LEFT JOIN hotel_branding hb ON hb.hotel_id = h.id
      LEFT JOIN hotel_modules hm ON hm.hotel_id = h.id
      WHERE h.id = ?
        AND h.id IN (${placeholders})
      GROUP BY h.id
      LIMIT 1`,
    [session.user.id, hotelId, ...session.hotel_ids],
  );
}

async function ensureHotelVisible(env, session, hotelId) {
  const row = await loadHotelRow(env, session, hotelId);
  if (!row) throw notFoundError("Unidade nao encontrada.");
  return row;
}

async function loadBranding(env, hotelId) {
  const row = await first(env, "SELECT * FROM hotel_branding WHERE hotel_id = ? LIMIT 1", [hotelId]);
  return formatBranding(row || { hotel_id: hotelId, custom_css_json: "{}" });
}

async function loadSettings(env, hotelId) {
  const rows = await all(
    env,
    `SELECT setting_key, setting_value, value_type, is_public, updated_at
       FROM hotel_settings
      WHERE hotel_id = ?
      ORDER BY setting_key`,
    [hotelId],
  );
  return Object.fromEntries(rows.map((row) => [row.setting_key, coerceSettingValue(row)]));
}

async function findHotelBySlug(env, slug) {
  return first(env, "SELECT id, slug FROM hotels WHERE slug = ? LIMIT 1", [slug]);
}

async function loadNavigationItem(env, hotelId, itemId) {
  const row = await first(
    env,
    `SELECT id, hotel_id, module_key, label, path, icon_key, sort_order, is_public, enabled, created_at, updated_at
       FROM navigation_items
      WHERE id = ? AND hotel_id = ?
      LIMIT 1`,
    [itemId, hotelId],
  );
  return row ? formatNavigationItem(row) : null;
}

async function validateMediaSelection(env, hotelId, value) {
  const assetId = optionalString(value, "media_asset", { max: 160 });
  if (!assetId) return null;
  if (assetId.startsWith("/assets/")) return assetId;
  const asset = await first(
    env,
    `SELECT id, hotel_id, storage_provider, public_url, status
       FROM media_assets
      WHERE id = ?
        AND status = 'active'
        AND storage_provider IN ('r2', 'static')
        AND (hotel_id = ? OR hotel_id IS NULL)
      LIMIT 1`,
    [assetId, hotelId],
  );
  if (!asset) throw badRequest("Midia selecionada invalida.");
  return asset.public_url;
}

function formatHotelSummary(row) {
  return {
    id: row.id,
    hotel_id: row.id,
    slug: row.slug,
    name: row.name,
    short_name: row.short_name,
    timezone: row.timezone,
    locale: row.locale,
    currency: row.currency,
    status: row.status,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    archived_at: row.archived_at || null,
    access_level: row.access_level || null,
    logo_url: row.logo_url || row.icon_url || null,
    active_module_count: Number(row.active_module_count || 0),
    branding_configured: Boolean(row.logo_url || row.icon_url || row.primary_color),
  };
}

function formatBranding(row) {
  const custom = parseJson(row?.custom_css_json, {});
  return {
    hotel_id: row?.hotel_id || null,
    logo_url: row?.logo_url || null,
    horizontal_logo_url: custom.horizontal_logo_url || null,
    icon_url: row?.icon_url || null,
    favicon_url: custom.favicon_url || null,
    cover_image_url: custom.cover_image_url || null,
    social_image_url: custom.social_image_url || null,
    primary_color: row?.primary_color || "#513b2d",
    secondary_color: row?.secondary_color || "#f4f1ef",
    accent_color: row?.accent_color || "#c1a94c",
    background_color: row?.background_color || "#fbf8f4",
    surface_color: custom.surface_color || "#ffffff",
    text_color: row?.text_color || "#202124",
    muted_text_color: custom.muted_text_color || "#667085",
    browser_theme_color: custom.browser_theme_color || row?.primary_color || "#513b2d",
    font_family: row?.font_family || "Effra, Inter, system-ui, sans-serif",
    theme: custom.theme || "light",
    updated_at: row?.updated_at || null,
  };
}

function formatHotelModule(row) {
  return {
    module_key: row.module_key,
    name: row.name,
    description: row.description || "",
    status: row.status || "planned",
    enabled: Number(row.enabled || 0) === 1,
    is_public: Number(row.is_public ?? 1) === 1,
    public_name: row.public_name || null,
    navigation_label: row.navigation_label || null,
    sort_order: Number(row.sort_order || 100),
    settings: parseJson(row.settings_json, {}),
  };
}

function formatNavigationItem(row) {
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    module_key: row.module_key,
    label: row.label,
    path: row.path,
    icon_key: row.icon_key || null,
    sort_order: Number(row.sort_order || 100),
    is_public: Number(row.is_public ?? 1) === 1,
    enabled: Number(row.enabled ?? 1) === 1,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function validateSlug(value) {
  const slug = requireString(value, "slug", { max: 80 });
  if (!isSafeIdentifier(slug) || RESERVED_SLUGS.has(slug)) throw badRequest("slug invalido ou reservado.");
  return slug;
}

function validateModuleKey(value) {
  const moduleKey = requireString(value, "module_key", { max: 80 });
  if (!isSafeIdentifier(moduleKey)) throw badRequest("module_key invalido.");
  return moduleKey;
}

function validateStatus(value) {
  const status = requireString(value, "status", { max: 30 });
  if (!HOTEL_STATUSES.has(status)) throw badRequest("status de unidade invalido.");
  return status;
}

function validateTimezone(value) {
  const timezone = requireString(value, "timezone", { max: 80 });
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format(new Date());
  } catch {
    throw badRequest("timezone invalido.");
  }
  return timezone;
}

function validateLocale(value) {
  const locale = requireString(value, "locale", { max: 20 });
  try {
    new Intl.Locale(locale);
  } catch {
    throw badRequest("locale invalido.");
  }
  return locale;
}

function validateCurrency(value) {
  const currency = requireString(value, "currency", { min: 3, max: 3 }).toUpperCase();
  try {
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(1);
  } catch {
    throw badRequest("currency invalida.");
  }
  return currency;
}

function validateHexColor(value, field) {
  const color = requireString(value, field, { max: 7 });
  if (!HEX_COLOR.test(color)) throw badRequest(`${field} deve estar em hexadecimal.`);
  return color.toLowerCase();
}

function validateSetting(key, value) {
  if (value == null || value === "") return { value: "", type: "string" };
  if (["contact.latitude", "contact.longitude"].includes(key)) {
    const number = Number(value);
    const max = key.endsWith("latitude") ? 90 : 180;
    if (!Number.isFinite(number) || number < -max || number > max) throw badRequest(`${key} invalido.`);
    return { value: String(number), type: "number" };
  }
  if (["hosting.check_in", "hosting.check_out"].includes(key) && !TIME.test(String(value))) {
    throw badRequest(`${key} deve estar no formato HH:mm.`);
  }
  if (key === "contact.email" && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value))) {
    throw badRequest("E-mail invalido.");
  }
  if (["contact.website", "contact.maps_url", "seo.canonical_base"].includes(key) && value) {
    validateSafeUrl(value);
  }
  if (["seo.browser_color"].includes(key)) validateHexColor(value, key);
  if (key === "seo.social_image_asset_id") return { value: requireString(value, key, { max: 160 }), type: "string" };
  const text = String(value).trim();
  if (/[<>]/.test(text)) throw badRequest(`${key} nao aceita HTML.`);
  if (text.length > TEXT_SETTING_MAX) throw badRequest(`${key} excede o tamanho permitido.`);
  return { value: text, type: "string" };
}

function validateSafeUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    throw badRequest("URL invalida.");
  }
  if (!["https:", "http:"].includes(parsed.protocol)) throw badRequest("URL com esquema inseguro.");
}

async function validateNavigationPayload(env, payload, { partial }) {
  const allowed = new Set(["module_key", "label", "path", "icon_key", "sort_order", "is_public", "enabled"]);
  rejectUnknown(payload, allowed);
  const required = partial ? optionalString : requireString;
  const moduleKey = validateModuleKey(required(payload.module_key, "module_key", { max: 80 }));
  const moduleExists = await first(env, "SELECT module_key FROM modules WHERE module_key = ? LIMIT 1", [moduleKey]);
  if (!moduleExists) throw badRequest("Modulo inexistente.");
  const label = requireString(payload.label, "label", { max: 80 });
  const path = requireString(payload.path, "path", { max: 180 });
  if (!INTERNAL_PATH.test(path) || path.toLowerCase().startsWith("/javascript")) throw badRequest("Destino de navegacao invalido.");
  const iconKey = optionalString(payload.icon_key, "icon_key", { max: 40 }) || null;
  if (iconKey && !SAFE_ICONS.has(iconKey)) throw badRequest("Icone de navegacao invalido.");
  return {
    module_key: moduleKey,
    label,
    path,
    icon_key: iconKey,
    sort_order: validateSortOrder(payload.sort_order ?? 100),
    is_public: Object.hasOwn(payload, "is_public") ? toBooleanInteger(payload.is_public) : 1,
    enabled: Object.hasOwn(payload, "enabled") ? toBooleanInteger(payload.enabled) : 1,
  };
}

function toBooleanInteger(value) {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  throw badRequest("Valor booleano invalido.");
}

function validateSortOrder(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 10000) throw badRequest("sort_order invalido.");
  return number;
}

function rejectUnknown(payload, allowed) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw badRequest("Payload invalido.");
  const unknown = Object.keys(payload).filter((key) => !allowed.has(key));
  if (unknown.length) throw badRequest("Campos nao permitidos.", { fields: unknown });
}

function diffFields(current, next, fields) {
  return fields.filter((field) => String(current[field] ?? "") !== String(next[field] ?? ""));
}

function defaultBrandingJson() {
  return {
    surface_color: "#ffffff",
    muted_text_color: "#667085",
    browser_theme_color: "#513b2d",
    theme: "light",
  };
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function coerceSettingValue(row) {
  if (row.value_type === "number") return Number(row.setting_value);
  if (row.value_type === "boolean") return row.setting_value === "true" || row.setting_value === "1";
  if (row.value_type === "json") return parseJson(row.setting_value, null);
  return row.setting_value;
}

function settingId(hotelId, key) {
  return `set-${hotelId}-${key.replaceAll(".", "-").replaceAll("_", "-")}`.slice(0, 120);
}

function auditStatement(env, { hotelId, moduleKey = null, actorUserId, action, entityId, metadata, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, 'hotel', ?, ?, ?)`,
    [createPublicId("audit"), hotelId, moduleKey, actorUserId, action, entityId, JSON.stringify(metadata || {}), createdAt],
  );
}
