export function createTestEnv(overrides = {}) {
  const data = createFixtureData();
  return {
    DB: new MockD1Database(data),
    ASSETS: createAssetsBinding(),
    ENVIRONMENT: "test",
    IMPRESSION_ENABLED: "false",
    DEFAULT_HOTEL_SLUG: "muller-fioreze",
    __data: data,
    ...overrides,
  };
}

export function createRequest(path, init = {}) {
  return new Request(`https://local.test${path}`, init);
}

export async function readJson(response) {
  return response.json();
}

function createAssetsBinding() {
  return {
    fetch(request) {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/admin/") {
        return new Response(
          '<!doctype html><html><body><h1>ERP Fioreze</h1><form id="loginForm"></form><div id="ordersList"></div></body></html>',
          {
          headers: { "content-type": "text/html; charset=utf-8" },
          },
        );
      }

      return new Response(`<html><body>${pathname}</body></html>`, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  };
}

function createFixtureData() {
  return {
    hotels: [
      {
        id: "muller-fioreze",
        slug: "muller-fioreze",
        name: "Muller Demo Hotel",
        short_name: "Muller Demo",
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
        currency: "BRL",
        status: "active",
        archived_at: null,
      },
      {
        id: "aurora-demo",
        slug: "aurora-demo",
        name: "Aurora Demo Hotel",
        short_name: "Aurora Demo",
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
        currency: "BRL",
        status: "active",
        archived_at: null,
      },
    ],
    branding: [
      {
        hotel_id: "muller-fioreze",
        logo_url: "/assets/hotels/muller-fioreze/logo.png",
        icon_url: "/assets/hotels/muller-fioreze/logo-ff.png",
        primary_color: "#17594a",
        secondary_color: "#f2b84b",
        accent_color: "#8c3d2f",
        background_color: "#f7f4ee",
        text_color: "#202124",
        font_family: "system-ui",
      },
      {
        hotel_id: "aurora-demo",
        logo_url: "/assets/shared/demo-logo.svg",
        icon_url: null,
        primary_color: "#264653",
        secondary_color: "#e9c46a",
        accent_color: "#2a9d8f",
        background_color: "#f8f9fa",
        text_color: "#1d1d1d",
        font_family: "system-ui",
      },
    ],
    settings: [
      setting("muller-fioreze", "room_service.status", "open"),
      setting("muller-fioreze", "currency.symbol", "R$"),
      setting("aurora-demo", "room_service.status", "open"),
      setting("aurora-demo", "currency.symbol", "R$"),
      setting("aurora-demo", "internal.note", "hidden", "string", 0),
    ],
    modules: [
      module("guest-portal", "Portal do Hospede"),
      module("room-service", "Room Service"),
      module("emporio", "Emporio"),
      module("spa", "Spa"),
      module("romantic-packages", "Pacotes Romanticos"),
      module("admin", "ERP Administrativo"),
    ],
    hotelModules: [
      hotelModule("muller-fioreze", "guest-portal", 1, 1, "Portal", "Inicio", 10),
      hotelModule("muller-fioreze", "room-service", 1, 1, "Room Service", "Room Service", 20),
      hotelModule("muller-fioreze", "emporio", 0, 1, "Emporio", "Emporio", 30),
      hotelModule("muller-fioreze", "spa", 0, 1, "Spa", "Spa", 40),
      hotelModule("muller-fioreze", "romantic-packages", 0, 1, "Pacotes", "Pacotes", 50),
      hotelModule("muller-fioreze", "admin", 1, 0, "ERP", "ERP", 90),
      hotelModule("aurora-demo", "guest-portal", 1, 1, "Portal", "Inicio", 10),
      hotelModule("aurora-demo", "room-service", 1, 1, "Room Service", "Room Service", 20),
      hotelModule("aurora-demo", "emporio", 1, 1, "Emporio", "Emporio", 30),
      hotelModule("aurora-demo", "spa", 0, 1, "Spa", "Spa", 40),
      hotelModule("aurora-demo", "admin", 1, 0, "ERP", "ERP", 90),
    ],
    serviceHours: [
      ...weekHours("muller-fioreze", "room-service", "16:00", "22:00"),
      serviceHour("muller-fioreze", "room-service", 0, "22:30", "23:30", 20),
      serviceHour("muller-fioreze", "room-service", 1, "08:00", "09:00", 99, "archived"),
      serviceHour("muller-fioreze", "emporio", 0, "09:00", "10:00"),
      ...weekHours("aurora-demo", "room-service", "15:00", "21:00"),
    ],
    mediaAssets: [
      {
        id: "media-muller-logo",
        hotel_id: "muller-fioreze",
        module_key: "guest-portal",
        storage_provider: "static",
        object_key: "hotels/muller-fioreze/logo.png",
        public_url: "/assets/hotels/muller-fioreze/logo.png",
        alt_text: "Logo demo",
        mime_type: "image/png",
        status: "active",
      },
    ],
    navigation: [
      nav("muller-fioreze", "guest-portal", "Inicio", "/muller-fioreze", 10),
      nav("muller-fioreze", "room-service", "Room Service", "/muller-fioreze/room-service", 20),
      nav("muller-fioreze", "emporio", "Emporio", "/muller-fioreze/emporio", 30, 0),
      nav("aurora-demo", "guest-portal", "Inicio", "/aurora-demo", 10),
      nav("aurora-demo", "room-service", "Room Service", "/aurora-demo/room-service", 20),
      nav("aurora-demo", "emporio", "Emporio", "/aurora-demo/emporio", 30),
    ],
    features: [
      { feature_key: "room-service.ordering", module_key: "room-service", status: "active", is_public: 1 },
      { feature_key: "printing.enabled", module_key: "room-service", status: "active", is_public: 0 },
    ],
    hotelFeatures: [
      { hotel_id: "muller-fioreze", feature_key: "room-service.ordering", enabled: 1, config_json: "{}" },
      { hotel_id: "muller-fioreze", feature_key: "printing.enabled", enabled: 0, config_json: "{}" },
      { hotel_id: "aurora-demo", feature_key: "room-service.ordering", enabled: 1, config_json: "{}" },
    ],
    rooms: [
      { id: "room-muller-101", hotel_id: "muller-fioreze", code: "D-101", status: "active" },
      { id: "room-muller-102", hotel_id: "muller-fioreze", code: "D-102", status: "active" },
      { id: "room-aurora-201", hotel_id: "aurora-demo", code: "A-201", status: "active" },
    ],
    catalogs: [
      catalog("cat-muller-rs", "muller-fioreze", "room-service"),
      catalog("cat-muller-emporio", "muller-fioreze", "emporio"),
      catalog("cat-aurora-rs", "aurora-demo", "room-service"),
    ],
    categories: [
      category("catg-muller-lanches", "muller-fioreze", "cat-muller-rs", "Lanches", 10),
      category("catg-muller-bebidas", "muller-fioreze", "cat-muller-rs", "Bebidas", 20),
      category("catg-muller-emporio", "muller-fioreze", "cat-muller-emporio", "Emporio", 10),
      category("catg-aurora-lanches", "aurora-demo", "cat-aurora-rs", "Lanches", 10),
    ],
    catalogItems: [
      item("muller-sandwich", "muller-fioreze", "room-service", "cat-muller-rs", "catg-muller-lanches", "Sanduiche Demo", 2500, "active", 10),
      item("muller-juice", "muller-fioreze", "room-service", "cat-muller-rs", "catg-muller-bebidas", "Suco Demo", 900, "active", 20),
      item("muller-soup", "muller-fioreze", "room-service", "cat-muller-rs", "catg-muller-lanches", "Sopa Demo", 1800, "active", 30),
      item("muller-archived", "muller-fioreze", "room-service", "cat-muller-rs", "catg-muller-lanches", "Item Arquivado", 1200, "archived", 40),
      item("muller-emporio-water", "muller-fioreze", "emporio", "cat-muller-emporio", "catg-muller-emporio", "Agua Emporio", 700, "active", 10),
      item("aurora-sandwich", "aurora-demo", "room-service", "cat-aurora-rs", "catg-aurora-lanches", "Sanduiche Aurora", 1900, "active", 10),
    ],
    availability: [
      availability("muller-sandwich", "muller-fioreze", 1),
      availability("muller-juice", "muller-fioreze", 1),
      availability("muller-soup", "muller-fioreze", 0, "Indisponivel"),
      availability("muller-emporio-water", "muller-fioreze", 1),
      availability("aurora-sandwich", "aurora-demo", 1),
    ],
    adminUsers: [
      {
        id: "user-demo-admin",
        display_name: "Usuario Admin Demo",
        email: "admin-demo@example.invalid",
        password_hash:
          "pbkdf2$sha256$210000$ZmlvcmV6ZS1hZG1pbi1kZW1vLXNhbHQtMjAyNg==$pyDE+YfHY8oVHR16wprIcX1hEP9Ph9X6L+juKuD9U2U=",
        password_strategy: "pbkdf2",
        status: "active",
        force_password_change: 0,
      },
      {
        id: "user-aurora-admin",
        display_name: "Usuario Aurora Demo",
        email: "aurora-demo@example.invalid",
        password_hash:
          "pbkdf2$sha256$210000$ZmlvcmV6ZS1hZG1pbi1kZW1vLXNhbHQtMjAyNg==$pyDE+YfHY8oVHR16wprIcX1hEP9Ph9X6L+juKuD9U2U=",
        password_strategy: "pbkdf2",
        status: "active",
        force_password_change: 0,
      },
    ],
    adminRoles: [{ id: "role-demo-manager", role_key: "demo-manager", name: "Gerente demo" }],
    adminPermissions: [
      { id: "perm-orders-read", permission_key: "room-service.orders.read", module_key: "room-service" },
      { id: "perm-orders-write", permission_key: "room-service.orders.write", module_key: "room-service" },
    ],
    adminUserRoles: [
      { user_id: "user-demo-admin", role_id: "role-demo-manager" },
      { user_id: "user-aurora-admin", role_id: "role-demo-manager" },
    ],
    adminRolePermissions: [
      { role_id: "role-demo-manager", permission_id: "perm-orders-read" },
      { role_id: "role-demo-manager", permission_id: "perm-orders-write" },
    ],
    adminHotelAccess: [
      { user_id: "user-demo-admin", hotel_id: "muller-fioreze", access_level: "manager" },
      { user_id: "user-aurora-admin", hotel_id: "aurora-demo", access_level: "manager" },
    ],
    adminSessions: [],
    adminAuditLog: [],
    orders: [],
    orderItems: [],
    orderStatusHistory: [],
    printEvents: [],
  };
}

function setting(hotelId, key, value, type = "string", isPublic = 1) {
  return { hotel_id: hotelId, setting_key: key, setting_value: value, value_type: type, is_public: isPublic };
}

function module(moduleKey, name) {
  return { module_key: moduleKey, name, description: `${name} demo` };
}

function hotelModule(hotelId, moduleKey, enabled, isPublic, publicName, navigationLabel, sortOrder) {
  return {
    hotel_id: hotelId,
    module_key: moduleKey,
    enabled,
    is_public: isPublic,
    public_name: publicName,
    navigation_label: navigationLabel,
    sort_order: sortOrder,
    settings_json: "{}",
  };
}

function nav(hotelId, moduleKey, label, path, sortOrder, enabled = 1) {
  return { hotel_id: hotelId, module_key: moduleKey, label, path, icon_key: moduleKey, sort_order: sortOrder, enabled, is_public: 1 };
}

function weekHours(hotelId, moduleKey, opensAt, closesAt) {
  return Array.from({ length: 7 }, (_, day) => serviceHour(hotelId, moduleKey, day, opensAt, closesAt));
}

function serviceHour(hotelId, moduleKey, dayOfWeek, opensAt, closesAt, sortOrder = 10, status = "active") {
  return {
    hotel_id: hotelId,
    module_key: moduleKey,
    day_of_week: dayOfWeek,
    opens_at: opensAt,
    closes_at: closesAt,
    is_closed: 0,
    sort_order: sortOrder,
    status,
    archived_at: status === "archived" ? "2026-07-04T00:00:00.000Z" : null,
  };
}

function catalog(id, hotelId, moduleKey) {
  return { id, hotel_id: hotelId, module_key: moduleKey, status: "active" };
}

function category(id, hotelId, catalogId, name, sortOrder) {
  return { id, hotel_id: hotelId, catalog_id: catalogId, name, sort_order: sortOrder, status: "active" };
}

function item(id, hotelId, moduleKey, catalogId, categoryId, name, priceCents, status, sortOrder) {
  return {
    id,
    public_id: id,
    hotel_id: hotelId,
    module_key: moduleKey,
    catalog_id: catalogId,
    category_id: categoryId,
    name,
    description: `${name} ficticio`,
    item_type: "product",
    price_cents: priceCents,
    currency: "BRL",
    image_url: null,
    status,
    sort_order: sortOrder,
  };
}

function availability(catalogItemId, hotelId, isAvailable, label = null) {
  return { catalog_item_id: catalogItemId, hotel_id: hotelId, is_available: isAvailable, availability_label: label };
}

class MockD1Database {
  constructor(data) {
    this.data = data;
    this.failNextBatch = false;
  }

  prepare(sql) {
    return new MockD1Statement(this, sql);
  }

  async batch(statements) {
    const before = structuredClone(this.data);
    try {
      if (this.failNextBatch) {
        this.failNextBatch = false;
        throw new Error("batch failed");
      }
      for (const statement of statements) {
        await statement.run();
      }
      return statements.map(() => ({ success: true }));
    } catch (error) {
      Object.assign(this.data, before);
      throw error;
    }
  }

  selectFirst(sql, params) {
    const normalized = normalize(sql);

    if (normalized.includes("from hotels") && normalized.includes("where slug = ?")) {
      const [slug] = params;
      return this.data.hotels.find((hotel) => hotel.slug === slug && hotel.archived_at == null) || null;
    }

    if (normalized.includes("from hotel_branding")) {
      const [hotelId] = params;
      return this.data.branding.find((branding) => branding.hotel_id === hotelId) || null;
    }

    if (normalized.includes("from hotel_modules") && normalized.includes("where hotel_id = ? and module_key = ?")) {
      const [hotelId, moduleKey] = params;
      return this.data.hotelModules.find((module) => module.hotel_id === hotelId && module.module_key === moduleKey) || null;
    }

    if (normalized.includes("from rooms")) {
      const [hotelId, code] = params;
      return this.data.rooms.find((room) => room.hotel_id === hotelId && room.code === code && room.status === "active") || null;
    }

    if (normalized.includes("from catalog_items ci") && normalized.includes("where ci.id = ?")) {
      const [itemId, hotelId, moduleKey, catalogModuleKey] = params;
      const row = this.data.catalogItems.find(
        (catalogItem) =>
          catalogItem.id === itemId && catalogItem.hotel_id === hotelId && catalogItem.module_key === moduleKey,
      );
      if (!row) return null;
      const catalog = this.data.catalogs.find((entry) => entry.id === row.catalog_id && entry.module_key === catalogModuleKey);
      if (!catalog) return null;
      const itemAvailability = this.findAvailability(row.id, row.hotel_id);
      return { ...row, is_available: itemAvailability?.is_available ?? 1 };
    }

    if (normalized.includes("from orders") && normalized.includes("idempotency_key = ?")) {
      const [hotelId, moduleKey, idempotencyKey] = params;
      return (
        this.data.orders.find(
          (order) =>
            order.hotel_id === hotelId && order.module_key === moduleKey && order.idempotency_key === idempotencyKey,
        ) || null
      );
    }

    if (normalized.includes("from admin_users") && normalized.includes("lower(email) = lower(?)")) {
      const [email] = params;
      return this.data.adminUsers.find((user) => user.email.toLowerCase() === String(email).toLowerCase()) || null;
    }

    if (normalized.includes("from admin_sessions s") && normalized.includes("s.token_hash = ?")) {
      const [tokenHash, now] = params;
      const session = this.data.adminSessions.find(
        (entry) => entry.token_hash === tokenHash && entry.revoked_at == null && entry.expires_at > now,
      );
      if (!session) return null;
      const user = this.data.adminUsers.find((entry) => entry.id === session.user_id && entry.status === "active");
      if (!user) return null;
      return {
        session_id: session.id,
        user_id: user.id,
        expires_at: session.expires_at,
        display_name: user.display_name,
        email: user.email,
      };
    }

    if (normalized.includes("from orders o") && normalized.includes("join hotels h") && normalized.includes("where o.id = ?")) {
      const [orderId, moduleKey] = params;
      const order = this.data.orders.find((entry) => entry.id === orderId && entry.module_key === moduleKey);
      if (!order) return null;
      const hotel = this.data.hotels.find((entry) => entry.id === order.hotel_id);
      return {
        ...order,
        hotel_name: hotel?.name,
        timezone: hotel?.timezone,
        locale: hotel?.locale,
      };
    }

    if (normalized.includes("from orders") && normalized.includes("where id = ?") && normalized.includes("and module_key = ?")) {
      const [orderId, moduleKey] = params;
      return this.data.orders.find((entry) => entry.id === orderId && entry.module_key === moduleKey) || null;
    }

    if (normalized.includes("from hotel_features") && normalized.includes("hf.feature_key = ?")) {
      const [hotelId, featureKey] = params;
      const feature = this.data.features.find((entry) => entry.feature_key === featureKey && entry.status === "active");
      const hotelFeature = this.data.hotelFeatures.find(
        (entry) => entry.hotel_id === hotelId && entry.feature_key === featureKey && entry.enabled === 1,
      );
      return feature && hotelFeature ? { enabled: hotelFeature.enabled } : null;
    }

    throw new Error(`Unhandled first SQL: ${normalized}`);
  }

  selectAll(sql, params) {
    const normalized = normalize(sql);

    if (normalized.includes("from hotel_settings")) {
      const [hotelId] = params;
      return this.data.settings
        .filter((settingRow) => settingRow.hotel_id === hotelId && settingRow.is_public === 1)
        .sort((a, b) => a.setting_key.localeCompare(b.setting_key));
    }

    if (normalized.includes("from hotel_modules hm")) {
      const [hotelId, publicOnly] = params;
      return this.data.hotelModules
        .filter((hotelModuleRow) => hotelModuleRow.hotel_id === hotelId && hotelModuleRow.enabled === 1)
        .filter((hotelModuleRow) => publicOnly === 0 || hotelModuleRow.is_public === 1)
        .map((hotelModuleRow) => ({
          ...hotelModuleRow,
          ...(this.data.modules.find((moduleRow) => moduleRow.module_key === hotelModuleRow.module_key) || {}),
        }))
        .sort((a, b) => a.sort_order - b.sort_order || a.module_key.localeCompare(b.module_key));
    }

    if (normalized.includes("from navigation_items")) {
      const [hotelId] = params;
      return this.data.navigation
        .filter((entry) => entry.hotel_id === hotelId && entry.enabled === 1 && entry.is_public === 1)
        .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
    }

    if (normalized.includes("from service_hours sh")) {
      const [hotelId] = params;
      return this.data.serviceHours
        .filter((entry) => entry.hotel_id === hotelId && entry.status === "active" && entry.archived_at == null)
        .filter((entry) => {
          const moduleRow = this.data.hotelModules.find(
            (hotelModuleRow) =>
              hotelModuleRow.hotel_id === entry.hotel_id &&
              hotelModuleRow.module_key === entry.module_key &&
              hotelModuleRow.enabled === 1 &&
              hotelModuleRow.is_public === 1,
          );
          return Boolean(moduleRow);
        })
        .sort(
          (a, b) =>
            a.module_key.localeCompare(b.module_key) ||
            a.day_of_week - b.day_of_week ||
            a.sort_order - b.sort_order,
        );
    }

    if (normalized.includes("from hotel_features hf")) {
      const [hotelId] = params;
      return this.data.hotelFeatures
        .filter((entry) => entry.hotel_id === hotelId && entry.enabled === 1)
        .map((entry) => {
          const feature = this.data.features.find(
            (featureRow) =>
              featureRow.feature_key === entry.feature_key &&
              featureRow.status === "active" &&
              featureRow.is_public === 1,
          );
          return feature ? { ...feature, ...entry } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.feature_key.localeCompare(b.feature_key));
    }

    if (normalized.includes("from admin_hotel_access aha")) {
      const [userId] = params;
      return this.data.adminHotelAccess
        .filter((entry) => entry.user_id === userId)
        .map((entry) => {
          const hotel = this.data.hotels.find((hotelRow) => hotelRow.id === entry.hotel_id && hotelRow.status === "active");
          return hotel
            ? {
                hotel_id: hotel.id,
                slug: hotel.slug,
                name: hotel.name,
                short_name: hotel.short_name,
                timezone: hotel.timezone,
                locale: hotel.locale,
                currency: hotel.currency,
                access_level: entry.access_level,
              }
            : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (normalized.includes("from admin_user_roles ur")) {
      const [userId] = params;
      const roleIds = this.data.adminUserRoles.filter((entry) => entry.user_id === userId).map((entry) => entry.role_id);
      const permissionIds = this.data.adminRolePermissions
        .filter((entry) => roleIds.includes(entry.role_id))
        .map((entry) => entry.permission_id);
      return this.data.adminPermissions
        .filter((entry) => permissionIds.includes(entry.id))
        .map((entry) => ({ permission_key: entry.permission_key }))
        .sort((a, b) => a.permission_key.localeCompare(b.permission_key));
    }

    if (normalized.includes("from orders o") && normalized.includes("left join order_items oi")) {
      const moduleKey = params[0];
      const hotelCount = countInPlaceholders(normalized, "o.hotel_id in");
      const hotelIds = params.slice(1, 1 + hotelCount);
      let cursor = 1 + hotelCount;
      const hasStatus = normalized.includes("o.status = ?");
      const status = hasStatus ? params[cursor++] : null;
      const hasSearch = normalized.includes("o.public_id like ?");
      const search = hasSearch ? String(params[cursor] || "").replaceAll("%", "").toLowerCase() : "";
      return this.data.orders
        .filter((order) => order.module_key === moduleKey && hotelIds.includes(order.hotel_id))
        .filter((order) => !status || order.status === status)
        .filter((order) => {
          if (!search) return true;
          return [order.public_id, order.room_code, order.guest_name]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search));
        })
        .map((order) => {
          const hotel = this.data.hotels.find((entry) => entry.id === order.hotel_id);
          return {
            ...order,
            hotel_name: hotel?.name,
            timezone: hotel?.timezone,
            item_count: this.data.orderItems.filter((item) => item.order_id === order.id).length,
          };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 100);
    }

    if (normalized.includes("from catalog_items ci") && normalized.includes("join categories c")) {
      const [hotelId] = params;
      return this.data.catalogItems
        .filter((catalogItem) => catalogItem.hotel_id === hotelId)
        .filter((catalogItem) => catalogItem.module_key === "room-service")
        .filter((catalogItem) => catalogItem.status === "active")
        .filter((catalogItem) => {
          const catalog = this.data.catalogs.find((entry) => entry.id === catalogItem.catalog_id);
          return catalog?.module_key === "room-service";
        })
        .map((catalogItem) => {
          const categoryRow = this.data.categories.find((categoryEntry) => categoryEntry.id === catalogItem.category_id);
          const itemAvailability = this.findAvailability(catalogItem.id, catalogItem.hotel_id);
          return {
            ...catalogItem,
            is_available: itemAvailability?.is_available ?? 1,
            availability_label: itemAvailability?.availability_label ?? null,
            category_id: categoryRow.id,
            category_name: categoryRow.name,
            category_sort_order: categoryRow.sort_order,
          };
        })
        .sort((a, b) => a.category_sort_order - b.category_sort_order || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    }

    if (normalized.includes("from order_items") && normalized.includes("where order_id = ?")) {
      const [orderId, hotelId, moduleKey] = params;
      return this.data.orderItems
        .filter((item) => item.order_id === orderId && item.hotel_id === hotelId && item.module_key === moduleKey)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    }

    if (normalized.includes("from order_status_history") && normalized.includes("where order_id = ?")) {
      const [orderId, hotelId, moduleKey] = params;
      return this.data.orderStatusHistory
        .filter((entry) => entry.order_id === orderId && entry.hotel_id === hotelId && entry.module_key === moduleKey)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    }

    if (normalized.includes("from print_events") && normalized.includes("where order_id = ?")) {
      const [orderId, hotelId, moduleKey] = params;
      return this.data.printEvents
        .filter((entry) => entry.order_id === orderId && entry.hotel_id === hotelId && entry.module_key === moduleKey)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    }

    throw new Error(`Unhandled all SQL: ${normalized}`);
  }

  execute(sql, params) {
    const normalized = normalize(sql);

    if (normalized.startsWith("insert into orders")) {
      const [
        id,
        public_id,
        hotel_id,
        module_key,
        origin,
        room_id,
        room_code,
        guest_name,
        notes,
        currency,
        subtotal_cents,
        total_cents,
        idempotency_key,
        created_at,
        updated_at,
      ] = params;
      this.data.orders.push({
        id,
        public_id,
        hotel_id,
        module_key,
        origin,
        room_id,
        room_code,
        guest_name,
        notes,
        currency,
        subtotal_cents,
        discount_cents: 0,
        total_cents,
        status: "received",
        idempotency_key,
        created_at,
        updated_at,
      });
      return { success: true };
    }

    if (normalized.startsWith("insert into order_status_history")) {
      if (params.length === 5) {
        const [id, order_id, hotel_id, module_key, created_at] = params;
        this.data.orderStatusHistory.push({
          id,
          order_id,
          hotel_id,
          module_key,
          status: "received",
          note: "Pedido recebido localmente.",
          actor_user_id: null,
          created_at,
        });
        return { success: true };
      }
      const [id, order_id, hotel_id, module_key, status, note, actor_user_id, created_at] = params;
      this.data.orderStatusHistory.push({
        id,
        order_id,
        hotel_id,
        module_key,
        status,
        note,
        actor_user_id,
        created_at,
      });
      return { success: true };
    }

    if (normalized.startsWith("insert into order_items")) {
      const [
        id,
        order_id,
        hotel_id,
        module_key,
        catalog_item_id,
        item_name_snapshot,
        item_description_snapshot,
        unit_price_cents,
        quantity,
        line_total_cents,
        selected_options_snapshot,
        created_at,
      ] = params;
      this.data.orderItems.push({
        id,
        order_id,
        hotel_id,
        module_key,
        catalog_item_id,
        item_name_snapshot,
        item_description_snapshot,
        unit_price_cents,
        quantity,
        line_total_cents,
        selected_options_snapshot,
        created_at,
      });
      return { success: true };
    }

    if (normalized.startsWith("insert into admin_sessions")) {
      const [id, user_id, token_hash, user_agent_hash, ip_hash, created_at, expires_at] = params;
      this.data.adminSessions.push({
        id,
        user_id,
        token_hash,
        user_agent_hash,
        ip_hash,
        created_at,
        expires_at,
        revoked_at: null,
      });
      return { success: true };
    }

    if (normalized.startsWith("update admin_sessions")) {
      const [revoked_at, token_hash] = params;
      for (const session of this.data.adminSessions) {
        if (session.token_hash === token_hash && session.revoked_at == null) {
          session.revoked_at = revoked_at;
        }
      }
      return { success: true };
    }

    if (normalized.startsWith("update orders")) {
      const [status, updated_at, cancelStatus, cancelled_at, id, hotel_id, module_key, currentStatus] = params;
      const order = this.data.orders.find(
        (entry) => entry.id === id && entry.hotel_id === hotel_id && entry.module_key === module_key && entry.status === currentStatus,
      );
      if (order) {
        order.status = status;
        order.updated_at = updated_at;
        if (cancelStatus === "cancelled") order.cancelled_at = cancelled_at;
      }
      return { success: true };
    }

    if (normalized.startsWith("insert into admin_audit_log")) {
      const [id, hotel_id, module_key, actor_user_id, action, entity_type, entity_id, metadata_json, created_at] = params;
      this.data.adminAuditLog.push({
        id,
        hotel_id,
        module_key,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata_json,
        created_at,
      });
      return { success: true };
    }

    throw new Error(`Unhandled run SQL: ${normalized}`);
  }

  findAvailability(catalogItemId, hotelId) {
    return this.data.availability.find((entry) => entry.catalog_item_id === catalogItemId && entry.hotel_id === hotelId);
  }
}

class MockD1Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new MockD1Statement(this.db, this.sql, params);
  }

  async first() {
    return this.db.selectFirst(this.sql, this.params);
  }

  async all() {
    return { results: this.db.selectAll(this.sql, this.params) };
  }

  async run() {
    return this.db.execute(this.sql, this.params);
  }
}

function normalize(sql) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function countInPlaceholders(normalizedSql, marker) {
  const start = normalizedSql.indexOf(marker);
  if (start === -1) return 0;
  const open = normalizedSql.indexOf("(", start);
  const close = normalizedSql.indexOf(")", open);
  if (open === -1 || close === -1) return 0;
  return normalizedSql.slice(open, close).split("?").length - 1;
}
