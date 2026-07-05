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
    orders: [],
    orderItems: [],
    orderStatusHistory: [],
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
      const [id, order_id, hotel_id, module_key, created_at] = params;
      this.data.orderStatusHistory.push({
        id,
        order_id,
        hotel_id,
        module_key,
        status: "received",
        note: "Pedido recebido localmente.",
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
