export function createTestEnv(overrides = {}) {
  const data = createFixtureData();
  return {
    DB: new MockD1Database(data),
    ASSETS: createAssetsBinding(),
    MEDIA_BUCKET: new MockR2Bucket(),
    ENVIRONMENT: "test",
    IMPRESSION_ENABLED: "false",
    DEFAULT_HOTEL_SLUG: "muller-fioreze",
    __data: data,
    ...overrides,
  };
}

export function createRequest(path, init = {}) {
  const url = /^https?:\/\//.test(path) ? path : `https://local.test${path}`;
  return new Request(url, init);
}

export async function readJson(response) {
  return response.json();
}

function createAssetsBinding() {
  return {
    fetch(request) {
      const pathname = new URL(request.url).pathname;
      const htmlByPath = {
        "/admin/":
          '<!doctype html><html><body><h1>Ecossistema Fioreze</h1><form id="loginForm"></form><div id="systemsList"></div></body></html>',
        "/admin/index.html":
          '<!doctype html><html><body><h1>Ecossistema Fioreze</h1><form id="loginForm"></form><div id="systemsList"></div></body></html>',
        "/erp/room-service/":
          '<!doctype html><html><body data-erp="room-service"><h1>ERP Room Service Fioreze</h1><form id="loginForm"></form><div id="routeOutlet"></div><script type="module" src="/js/modules/room-service-erp/app.js"></script></body></html>',
        "/erp/room-service/index.html":
          '<!doctype html><html><body data-erp="room-service"><h1>ERP Room Service Fioreze</h1><form id="loginForm"></form><div id="routeOutlet"></div><script type="module" src="/js/modules/room-service-erp/app.js"></script></body></html>',
        "/admin/portais/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><div id="portalsDenied"></div><section id="mediaLibrary"></section><section id="unitsManager"></section><section id="shortLinksManager"></section></body></html>',
        "/admin/portais/index.html":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><div id="portalsDenied"></div><section id="mediaLibrary"></section><section id="unitsManager"></section><section id="shortLinksManager"></section></body></html>',
        "/admin/portais/media/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><section id="mediaLibrary"></section></body></html>',
        "/admin/portais/unidades/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><section id="unitsManager"></section></body></html>',
        "/admin/portais/links/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><section id="shortLinksManager"></section></body></html>',
        "/admin/usuarios/":
          '<!doctype html><html><body><h1>Central Administrativa Fioreze</h1><form id="loginForm"></form><section id="usersManager"></section></body></html>',
        "/admin/perfis/":
          '<!doctype html><html><body><h1>Central Administrativa Fioreze</h1><form id="loginForm"></form><section id="rolesManager"></section></body></html>',
        "/admin/minha-conta/":
          '<!doctype html><html><body><h1>Central Administrativa Fioreze</h1><form id="loginForm"></form><section id="accountManager"></section></body></html>',
      };
      if (htmlByPath[pathname]) {
        return new Response(htmlByPath[pathname], {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      if (pathname.startsWith("/js/")) {
        return new Response("export {};\n", {
          headers: { "content-type": "application/javascript; charset=utf-8" },
        });
      }

      if (pathname.startsWith("/css/")) {
        return new Response("body{}\n", {
          headers: { "content-type": "text/css; charset=utf-8" },
        });
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
        created_at: "2026-07-04T00:00:00.000Z",
        updated_at: "2026-07-04T00:00:00.000Z",
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
        created_at: "2026-07-04T00:00:00.000Z",
        updated_at: "2026-07-04T00:00:00.000Z",
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
        custom_css_json: "{}",
        updated_at: "2026-07-04T00:00:00.000Z",
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
        custom_css_json: "{}",
        updated_at: "2026-07-04T00:00:00.000Z",
      },
    ],
    settings: [
      setting("muller-fioreze", "room_service.status", "open"),
      setting("muller-fioreze", "currency.symbol", "R$"),
      setting("muller-fioreze", "embed.enabled", "true", "boolean", 0),
      setting("muller-fioreze", "embed.allowed_origins", JSON.stringify(["https://example.invalid", "http://localhost:8787"]), "json", 0),
      setting("muller-fioreze", "embed.allowed_modules", JSON.stringify(["guest-portal", "room-service"]), "json", 0),
      setting("muller-fioreze", "embed.default_theme", "light", "string", 0),
      setting("muller-fioreze", "embed.default_background", "default", "string", 0),
      setting("muller-fioreze", "embed.header", "visible", "string", 0),
      setting("muller-fioreze", "embed.initial_height", "560", "number", 0),
      setting("muller-fioreze", "embed.compact", "false", "boolean", 0),
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
        created_at: "2026-07-04T00:00:00.000Z",
        updated_at: "2026-07-04T00:00:00.000Z",
        archived_at: null,
        original_filename: "logo.png",
        size_bytes: 1024,
        checksum_sha256: null,
        storage_etag: null,
        uploaded_by_user_id: null,
        archived_by_user_id: null,
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
          "pbkdf2$sha256$100000$ZmlvcmV6ZS1hZG1pbi1kZW1vLXNhbHQtMjAyNg==$QPM6b/QnKHhfCwYXFU9kCd7KpgtlsLdGDELeiM9Ulgw=",
        password_strategy: "pbkdf2",
        status: "active",
        force_password_change: 0,
        password_changed_at: null,
        avatar_object_key: null,
        avatar_mime_type: null,
        avatar_updated_at: null,
        created_at: "2026-07-04T00:00:00.000Z",
        updated_at: "2026-07-04T00:00:00.000Z",
      },
      {
        id: "user-aurora-admin",
        display_name: "Usuario Aurora Demo",
        email: "aurora-demo@example.invalid",
        password_hash:
          "pbkdf2$sha256$100000$ZmlvcmV6ZS1hZG1pbi1kZW1vLXNhbHQtMjAyNg==$QPM6b/QnKHhfCwYXFU9kCd7KpgtlsLdGDELeiM9Ulgw=",
        password_strategy: "pbkdf2",
        status: "active",
        force_password_change: 0,
        password_changed_at: null,
        avatar_object_key: null,
        avatar_mime_type: null,
        avatar_updated_at: null,
        created_at: "2026-07-04T00:00:00.000Z",
        updated_at: "2026-07-04T00:00:00.000Z",
      },
    ],
    adminRoles: [{ id: "role-demo-manager", role_key: "demo-manager", name: "Gerente demo", description: "Role ficticia." }],
    adminPermissions: [
      { id: "perm-orders-read", permission_key: "room-service.orders.read", module_key: "room-service" },
      { id: "perm-orders-write", permission_key: "room-service.orders.write", module_key: "room-service" },
      { id: "perm-portals-media-read", permission_key: "portals.media.read", module_key: null },
      { id: "perm-portals-media-upload", permission_key: "portals.media.upload", module_key: null },
      { id: "perm-portals-media-update", permission_key: "portals.media.update", module_key: null },
      { id: "perm-portals-media-archive", permission_key: "portals.media.archive", module_key: null },
      { id: "perm-portals-hotels-read", permission_key: "portals.hotels.read", module_key: null },
      { id: "perm-portals-hotels-create", permission_key: "portals.hotels.create", module_key: null },
      { id: "perm-portals-hotels-update", permission_key: "portals.hotels.update", module_key: null },
      { id: "perm-portals-hotels-branding", permission_key: "portals.hotels.branding", module_key: null },
      { id: "perm-portals-hotels-settings", permission_key: "portals.hotels.settings", module_key: null },
      { id: "perm-portals-hotels-modules", permission_key: "portals.hotels.modules", module_key: null },
      { id: "perm-portals-hotels-navigation", permission_key: "portals.hotels.navigation", module_key: null },
      { id: "perm-portals-embed-read", permission_key: "portals.embed.read", module_key: null },
      { id: "perm-portals-embed-update", permission_key: "portals.embed.update", module_key: null },
      { id: "perm-portals-links-read", permission_key: "portals.links.read", module_key: null },
      { id: "perm-portals-links-create", permission_key: "portals.links.create", module_key: null },
      { id: "perm-portals-links-update", permission_key: "portals.links.update", module_key: null },
      { id: "perm-portals-links-archive", permission_key: "portals.links.archive", module_key: null },
      { id: "perm-portals-links-analytics", permission_key: "portals.links.analytics", module_key: null },
      { id: "perm-admin-users-read", permission_key: "admin.users.read", module_key: "admin", description: "Ver usuarios" },
      { id: "perm-admin-users-create", permission_key: "admin.users.create", module_key: "admin", description: "Criar usuarios" },
      { id: "perm-admin-users-update", permission_key: "admin.users.update", module_key: "admin", description: "Editar usuarios" },
      { id: "perm-admin-users-disable", permission_key: "admin.users.disable", module_key: "admin", description: "Desativar usuarios" },
      { id: "perm-admin-users-password-reset", permission_key: "admin.users.password_reset", module_key: "admin", description: "Redefinir senhas" },
      { id: "perm-admin-users-sessions-revoke", permission_key: "admin.users.sessions_revoke", module_key: "admin", description: "Encerrar sessoes" },
      { id: "perm-admin-roles-read", permission_key: "admin.roles.read", module_key: "admin", description: "Ver perfis" },
      { id: "perm-admin-roles-create", permission_key: "admin.roles.create", module_key: "admin", description: "Criar perfis" },
      { id: "perm-admin-roles-update", permission_key: "admin.roles.update", module_key: "admin", description: "Editar perfis" },
      { id: "perm-admin-roles-permissions", permission_key: "admin.roles.permissions", module_key: "admin", description: "Alterar permissoes" },
      { id: "perm-admin-audit-read", permission_key: "admin.audit.read", module_key: "admin", description: "Ver auditoria" },
    ],
    adminUserRoles: [
      { user_id: "user-demo-admin", role_id: "role-demo-manager" },
      { user_id: "user-aurora-admin", role_id: "role-demo-manager" },
    ],
    adminRolePermissions: [
      { role_id: "role-demo-manager", permission_id: "perm-orders-read" },
      { role_id: "role-demo-manager", permission_id: "perm-orders-write" },
      { role_id: "role-demo-manager", permission_id: "perm-admin-users-read" },
      { role_id: "role-demo-manager", permission_id: "perm-admin-users-create" },
      { role_id: "role-demo-manager", permission_id: "perm-admin-users-update" },
      { role_id: "role-demo-manager", permission_id: "perm-admin-users-disable" },
      { role_id: "role-demo-manager", permission_id: "perm-admin-users-password-reset" },
      { role_id: "role-demo-manager", permission_id: "perm-admin-users-sessions-revoke" },
      { role_id: "role-demo-manager", permission_id: "perm-admin-roles-read" },
      { role_id: "role-demo-manager", permission_id: "perm-admin-roles-create" },
      { role_id: "role-demo-manager", permission_id: "perm-admin-roles-update" },
      { role_id: "role-demo-manager", permission_id: "perm-admin-roles-permissions" },
      { role_id: "role-demo-manager", permission_id: "perm-admin-audit-read" },
    ],
    adminHotelAccess: [
      { user_id: "user-demo-admin", hotel_id: "muller-fioreze", access_level: "manager" },
      { user_id: "user-aurora-admin", hotel_id: "aurora-demo", access_level: "manager" },
    ],
    adminSessions: [],
    adminAuditLog: [],
    shortLinks: [
      {
        id: "link-muller-reservas",
        hotel_id: "muller-fioreze",
        slug: "reservas",
        internal_name: "Reservas demo",
        destination_url: "https://booking.example/muller?origem=link#quartos",
        destination_scheme: "https",
        status: "active",
        starts_at: null,
        expires_at: null,
        notes: "Link ficticio.",
        total_clicks: 0,
        last_clicked_at: null,
        created_by_user_id: "user-demo-admin",
        updated_by_user_id: "user-demo-admin",
        archived_by_user_id: null,
        created_at: "2026-07-04T00:00:00.000Z",
        updated_at: "2026-07-04T00:00:00.000Z",
        archived_at: null,
      },
      {
        id: "link-muller-pausado",
        hotel_id: "muller-fioreze",
        slug: "pausado",
        internal_name: "Pausado demo",
        destination_url: "https://example.invalid/pausado",
        destination_scheme: "https",
        status: "paused",
        starts_at: null,
        expires_at: null,
        notes: null,
        total_clicks: 0,
        last_clicked_at: null,
        created_by_user_id: "user-demo-admin",
        updated_by_user_id: "user-demo-admin",
        archived_by_user_id: null,
        created_at: "2026-07-04T00:00:00.000Z",
        updated_at: "2026-07-04T00:00:00.000Z",
        archived_at: null,
      },
      {
        id: "link-aurora-reservas",
        hotel_id: "aurora-demo",
        slug: "aurora-reservas",
        internal_name: "Aurora reservas demo",
        destination_url: "https://booking.example/aurora",
        destination_scheme: "https",
        status: "active",
        starts_at: null,
        expires_at: null,
        notes: null,
        total_clicks: 0,
        last_clicked_at: null,
        created_by_user_id: "user-aurora-admin",
        updated_by_user_id: "user-aurora-admin",
        archived_by_user_id: null,
        created_at: "2026-07-04T00:00:00.000Z",
        updated_at: "2026-07-04T00:00:00.000Z",
        archived_at: null,
      },
    ],
    shortLinkClicksDaily: [],
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
  return {
    id: `nav-${hotelId}-${moduleKey}-${sortOrder}`,
    hotel_id: hotelId,
    module_key: moduleKey,
    label,
    path,
    icon_key: moduleKey,
    sort_order: sortOrder,
    enabled,
    is_public: 1,
    created_at: "2026-07-04T00:00:00.000Z",
    updated_at: "2026-07-04T00:00:00.000Z",
  };
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
    this.failNextMediaAssetInsert = false;
    this.failNextAdminHotelAccessInsert = false;
    this.adminStatusBatchDelayMs = 0;
  }

  prepare(sql) {
    return new MockD1Statement(this, sql);
  }

  async batch(statements) {
    let before = null;
    try {
      if (this.failNextBatch) {
        this.failNextBatch = false;
        throw new Error("batch failed");
      }
      if (this.adminStatusBatchDelayMs > 0 && statements.some((entry) => normalize(entry.sql).startsWith("update orders"))) {
        await sleep(this.adminStatusBatchDelayMs);
      }
      before = structuredClone(this.data);
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    } catch (error) {
      if (before) Object.assign(this.data, before);
      throw error;
    }
  }

  selectFirst(sql, params) {
    const normalized = normalize(sql);

    if (normalized.includes("from hotels") && normalized.includes("where slug = ?")) {
      const [slug] = params;
      return this.data.hotels.find((hotel) => hotel.slug === slug && hotel.archived_at == null) || null;
    }

    if (normalized.includes("from hotels h") && normalized.includes("join hotel_modules hm") && normalized.includes("h.slug = ?")) {
      const [slug, moduleKey] = params;
      const hotel = this.data.hotels.find((entry) => entry.slug === slug && entry.status === "active" && entry.archived_at == null);
      if (!hotel) return null;
      const hotelModuleRow = this.data.hotelModules.find(
        (entry) =>
          entry.hotel_id === hotel.id &&
          entry.module_key === moduleKey &&
          entry.enabled === 1 &&
          entry.is_public === 1 &&
          entry.module_key !== "admin",
      );
      if (!hotelModuleRow) return null;
      return {
        hotel_id: hotel.id,
        slug: hotel.slug,
        name: hotel.name,
        short_name: hotel.short_name,
        timezone: hotel.timezone,
        locale: hotel.locale,
        currency: hotel.currency,
        module_key: hotelModuleRow.module_key,
        public_name: hotelModuleRow.public_name,
        navigation_label: hotelModuleRow.navigation_label,
      };
    }

    if (normalized.includes("from hotels") && normalized.includes("where slug = ? limit 1")) {
      const [slug] = params;
      return this.data.hotels.find((hotel) => hotel.slug === slug) || null;
    }

    if (normalized.includes("from hotels h") && normalized.includes("left join hotel_branding") && normalized.includes("where h.id = ?")) {
      const [userId, hotelId, ...hotelIds] = params;
      const access = this.data.adminHotelAccess.find((entry) => entry.user_id === userId && entry.hotel_id === hotelId);
      const hotel = this.data.hotels.find((entry) => entry.id === hotelId && hotelIds.includes(entry.id));
      if (!hotel || !access) return null;
      const branding = this.data.branding.find((entry) => entry.hotel_id === hotel.id) || {};
      return {
        ...hotel,
        ...branding,
        access_level: access.access_level,
        active_module_count: this.data.hotelModules.filter((entry) => entry.hotel_id === hotel.id && entry.enabled === 1).length,
      };
    }

    if (normalized.includes("select id, slug from hotels where slug = ?")) {
      const [slug] = params;
      return this.data.hotels.find((hotel) => hotel.slug === slug) || null;
    }

    if (normalized.includes("from hotel_branding")) {
      const [hotelId] = params;
      return this.data.branding.find((branding) => branding.hotel_id === hotelId) || null;
    }

    if (normalized.includes("from hotel_modules") && normalized.includes("where hotel_id = ? and module_key = ?")) {
      const [hotelId, moduleKey] = params;
      return this.data.hotelModules.find((module) => module.hotel_id === hotelId && module.module_key === moduleKey) || null;
    }

    if (normalized.includes("from modules") && normalized.includes("where module_key = ?")) {
      const [moduleKey] = params;
      return this.data.modules.find((moduleRow) => moduleRow.module_key === moduleKey) || null;
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
        session_type: session.session_type || "full",
        expires_at: session.expires_at,
        display_name: user.display_name,
        email: user.email,
        avatar_object_key: user.avatar_object_key,
        avatar_mime_type: user.avatar_mime_type,
        avatar_updated_at: user.avatar_updated_at,
      };
    }

    if (normalized.includes("from admin_users") && normalized.includes("where id = ?") && normalized.includes("limit 1")) {
      const [userId] = params;
      return this.data.adminUsers.find((user) => user.id === userId) || null;
    }

    if (normalized.includes("from admin_users") && normalized.includes("lower(email) = lower(?)") && normalized.includes("select id")) {
      const [email] = params;
      const user = this.data.adminUsers.find((entry) => entry.email.toLowerCase() === String(email).toLowerCase());
      return user ? { id: user.id } : null;
    }

    if (normalized.includes("from admin_roles") && normalized.includes("where id = ?")) {
      const [roleId] = params;
      const role = this.data.adminRoles.find((entry) => entry.id === roleId);
      return role ? { id: role.id } : null;
    }

    if (normalized.includes("from admin_permissions") && normalized.includes("where permission_key = ?")) {
      const [permissionKey] = params;
      const permission = this.data.adminPermissions.find((entry) => entry.permission_key === permissionKey);
      return permission ? { id: permission.id } : null;
    }

    if (normalized.includes("from hotels") && normalized.includes("where id = ?") && normalized.includes("archived_at is null")) {
      const [hotelId] = params;
      const hotel = this.data.hotels.find((entry) => entry.id === hotelId && entry.archived_at == null);
      return hotel ? { id: hotel.id } : null;
    }

    if (normalized.includes("from orders o") && normalized.includes("join hotels h") && normalized.includes("where o.id = ?")) {
      const [orderId, moduleKey, ...hotelIds] = params;
      const order = this.data.orders.find(
        (entry) =>
          entry.id === orderId &&
          entry.module_key === moduleKey &&
          (!hotelIds.length || hotelIds.includes(entry.hotel_id)),
      );
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
      const [orderId, moduleKey, ...hotelIds] = params;
      return (
        this.data.orders.find(
          (entry) =>
            entry.id === orderId &&
            entry.module_key === moduleKey &&
            (!hotelIds.length || hotelIds.includes(entry.hotel_id)),
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

    if (normalized.includes("from media_assets") && normalized.includes("storage_provider = 'r2'")) {
      const [assetId] = params;
      return (
        this.data.mediaAssets.find(
          (entry) => entry.id === assetId && entry.storage_provider === "r2" && entry.status === "active",
        ) || null
      );
    }

    if (normalized.includes("from media_assets") && normalized.includes("where id = ?") && normalized.includes("hotel_id in")) {
      const [assetId, ...hotelIds] = params;
      return this.data.mediaAssets.find((entry) => entry.id === assetId && hotelIds.includes(entry.hotel_id)) || null;
    }

    if (normalized.includes("from media_assets") && normalized.includes("and (hotel_id = ? or hotel_id is null)")) {
      const [assetRef, publicUrlRef, hotelId] = params;
      return (
        this.data.mediaAssets.find(
          (entry) =>
            (entry.id === assetRef || entry.public_url === publicUrlRef) &&
            entry.status === "active" &&
            ["r2", "static"].includes(entry.storage_provider) &&
            (entry.hotel_id === hotelId || entry.hotel_id == null),
        ) || null
      );
    }

    if (normalized.includes("from short_links") && normalized.includes("lower(slug) = lower(?)")) {
      const [slug] = params;
      return this.data.shortLinks.find((link) => link.slug.toLowerCase() === String(slug).toLowerCase()) || null;
    }

    if (normalized.includes("from short_links sl") && normalized.includes("where sl.id = ?") && normalized.includes("sl.hotel_id in")) {
      const [linkId, ...hotelIds] = params;
      const link = this.data.shortLinks.find((entry) => entry.id === linkId && hotelIds.includes(entry.hotel_id));
      if (!link) return null;
      const hotel = this.data.hotels.find((entry) => entry.id === link.hotel_id) || {};
      return { ...link, hotel_name: hotel.name, hotel_timezone: hotel.timezone };
    }

    if (normalized.includes("from navigation_items") && normalized.includes("where id = ? and hotel_id = ?")) {
      const [itemId, hotelId] = params;
      return this.data.navigation.find((entry) => entry.id === itemId && entry.hotel_id === hotelId) || null;
    }

    throw new Error(`Unhandled first SQL: ${normalized}`);
  }

  selectAll(sql, params) {
    const normalized = normalize(sql);

    if (normalized.includes("from hotels h") && normalized.includes("join admin_hotel_access aha") && normalized.includes("left join hotel_branding")) {
      const [userId, ...rest] = params;
      const hotelIds = rest.slice(0, countInPlaceholders(normalized, "h.id in"));
      let cursor = hotelIds.length;
      const statusFilter = normalized.includes("h.status = ?");
      const status = statusFilter ? rest[cursor++] : "";
      const hasSearch = normalized.includes("lower(h.name) like ?");
      const search = hasSearch ? String(rest[cursor] || "").replaceAll("%", "").toLowerCase() : "";
      return this.data.hotels
        .filter((hotel) => hotelIds.includes(hotel.id))
        .filter((hotel) => this.data.adminHotelAccess.some((entry) => entry.user_id === userId && entry.hotel_id === hotel.id))
        .filter((hotel) => !status || hotel.status === status)
        .filter((hotel) => {
          if (!search) return true;
          return [hotel.name, hotel.short_name, hotel.slug].some((value) => String(value).toLowerCase().includes(search));
        })
        .map((hotel) => {
          const branding = this.data.branding.find((entry) => entry.hotel_id === hotel.id) || {};
          const access = this.data.adminHotelAccess.find((entry) => entry.user_id === userId && entry.hotel_id === hotel.id);
          return {
            ...hotel,
            ...branding,
            access_level: access?.access_level,
            active_module_count: this.data.hotelModules.filter((entry) => entry.hotel_id === hotel.id && entry.enabled === 1).length,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (normalized.includes("from hotel_settings")) {
      const [hotelId] = params;
      return this.data.settings
        .filter((settingRow) => settingRow.hotel_id === hotelId && (normalized.includes("is_public") ? settingRow.is_public === 1 : true))
        .sort((a, b) => a.setting_key.localeCompare(b.setting_key));
    }

    if (normalized.includes("from rooms") && normalized.includes("order by code")) {
      const [hotelId] = params;
      return this.data.rooms
        .filter((room) => room.hotel_id === hotelId && room.status === "active")
        .sort((a, b) => a.code.localeCompare(b.code));
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

    if (normalized.includes("from modules m") && normalized.includes("left join hotel_modules hm")) {
      const [hotelId] = params;
      return this.data.modules
        .map((moduleRow) => {
          const hotelModuleRow = this.data.hotelModules.find(
            (entry) => entry.hotel_id === hotelId && entry.module_key === moduleRow.module_key,
          );
          return {
            ...moduleRow,
            enabled: hotelModuleRow?.enabled ?? 0,
            is_public: hotelModuleRow?.is_public ?? 1,
            public_name: hotelModuleRow?.public_name ?? null,
            navigation_label: hotelModuleRow?.navigation_label ?? null,
            sort_order: hotelModuleRow?.sort_order ?? 100,
            settings_json: hotelModuleRow?.settings_json ?? "{}",
          };
        })
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    }

    if (normalized.includes("from navigation_items")) {
      const [hotelId] = params;
      return this.data.navigation
        .filter((entry) => entry.hotel_id === hotelId)
        .filter((entry) => (normalized.includes("enabled = 1") ? entry.enabled === 1 && entry.is_public === 1 : true))
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
          const hotel = this.data.hotels.find((hotelRow) => hotelRow.id === entry.hotel_id && hotelRow.archived_at == null);
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

    if (normalized.includes("from admin_users u") && normalized.includes("group_concat") && normalized.includes("left join admin_user_roles")) {
      const [now] = params;
      return this.data.adminUsers
        .map((user) => {
          const roleIds = this.data.adminUserRoles.filter((entry) => entry.user_id === user.id).map((entry) => entry.role_id);
          const roles = this.data.adminRoles.filter((entry) => roleIds.includes(entry.id));
          const hotelAccess = this.data.adminHotelAccess.filter((entry) => entry.user_id === user.id);
          const hotels = hotelAccess
            .map((entry) => this.data.hotels.find((hotel) => hotel.id === entry.hotel_id))
            .filter(Boolean);
          const activeSessions = this.data.adminSessions.filter(
            (entry) => entry.user_id === user.id && entry.revoked_at == null && entry.expires_at > now,
          );
          return {
            id: user.id,
            display_name: user.display_name,
            email: user.email,
            status: user.status,
            force_password_change: user.force_password_change,
            created_at: user.created_at,
            updated_at: user.updated_at,
            roles_text: roles.map((role) => `${role.id}:${role.name}`).join(","),
            hotels_text: hotels.map((hotel) => `${hotel.id}:${hotel.short_name || hotel.name}`).join(","),
            active_session_count: activeSessions.length,
          };
        })
        .sort((a, b) => a.display_name.localeCompare(b.display_name));
    }

    if (normalized.includes("from admin_user_roles ur") && normalized.includes("join admin_roles r")) {
      const [userId] = params;
      const roleIds = this.data.adminUserRoles.filter((entry) => entry.user_id === userId).map((entry) => entry.role_id);
      return this.data.adminRoles
        .filter((role) => roleIds.includes(role.id))
        .map((role) => ({ id: role.id, role_key: role.role_key, name: role.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (normalized.includes("from admin_sessions") && normalized.includes("where user_id = ?")) {
      const [userId] = params;
      return this.data.adminSessions
        .filter((entry) => entry.user_id === userId)
        .map(({ id, created_at, expires_at, revoked_at }) => ({ id, created_at, expires_at, revoked_at }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 20);
    }

    if (normalized.includes("from admin_roles r") && normalized.includes("group_concat")) {
      return this.data.adminRoles
        .map((role) => {
          const userCount = this.data.adminUserRoles.filter((entry) => entry.role_id === role.id).length;
          const permissionIds = this.data.adminRolePermissions
            .filter((entry) => entry.role_id === role.id)
            .map((entry) => entry.permission_id);
          const permissions = this.data.adminPermissions
            .filter((entry) => permissionIds.includes(entry.id))
            .map((entry) => entry.permission_key)
            .sort();
          return {
            id: role.id,
            role_key: role.role_key,
            name: role.name,
            description: role.description || "",
            user_count: userCount,
            permissions_text: permissions.join(","),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (normalized.includes("from admin_permissions") && normalized.includes("order by permission_key")) {
      return this.data.adminPermissions
        .map((permission) => ({
          id: permission.id,
          permission_key: permission.permission_key,
          module_key: permission.module_key,
          description: permission.description || permission.permission_key,
        }))
        .sort((a, b) => a.permission_key.localeCompare(b.permission_key));
    }

    if (normalized.includes("from admin_role_permissions rp") && normalized.includes("where rp.role_id in")) {
      const roleIds = params;
      const permissionIds = this.data.adminRolePermissions
        .filter((entry) => roleIds.includes(entry.role_id))
        .map((entry) => entry.permission_id);
      return this.data.adminPermissions
        .filter((entry) => permissionIds.includes(entry.id))
        .map((entry) => ({ permission_key: entry.permission_key }))
        .sort((a, b) => a.permission_key.localeCompare(b.permission_key));
    }

    if (normalized.includes("select user_id from admin_user_roles where role_id = ?")) {
      const [roleId] = params;
      return this.data.adminUserRoles.filter((entry) => entry.role_id === roleId).map((entry) => ({ user_id: entry.user_id }));
    }

    if (normalized.includes("select role_id from admin_user_roles where user_id = ?")) {
      const [userId, excludedRoleId] = params;
      return this.data.adminUserRoles
        .filter((entry) => entry.user_id === userId && (!excludedRoleId || entry.role_id !== excludedRoleId))
        .map((entry) => ({ role_id: entry.role_id }));
    }

    if (normalized.includes("from admin_users u") && normalized.includes("p.permission_key in")) {
      const [excludeUserId] = params;
      const capable = new Set();
      for (const user of this.data.adminUsers.filter((entry) => entry.status === "active" && entry.id !== excludeUserId)) {
        const roleIds = this.data.adminUserRoles.filter((entry) => entry.user_id === user.id).map((entry) => entry.role_id);
        const permissionIds = this.data.adminRolePermissions
          .filter((entry) => roleIds.includes(entry.role_id))
          .map((entry) => entry.permission_id);
        const permissionKeys = this.data.adminPermissions
          .filter((entry) => permissionIds.includes(entry.id))
          .map((entry) => entry.permission_key);
        if (permissionKeys.includes("admin.users.update") || permissionKeys.includes("admin.roles.permissions")) {
          capable.add(user.id);
        }
      }
      return [...capable].map((id) => ({ id }));
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

    if (normalized.includes("from short_links sl") && normalized.includes("join hotels h")) {
      const [hotelId] = params;
      let cursor = 1;
      const hasStatus = normalized.includes("sl.status = ?");
      const status = hasStatus ? params[cursor++] : "";
      const hasSearch = normalized.includes("lower(sl.internal_name) like ?");
      const search = hasSearch ? String(params[cursor++] || "").replaceAll("%", "").toLowerCase() : "";
      if (hasSearch) cursor += 2;
      const limit = Number(params[cursor++] || 25);
      const offset = Number(params[cursor++] || 0);
      let rows = this.data.shortLinks
        .filter((link) => link.hotel_id === hotelId)
        .filter((link) => !status || link.status === status)
        .filter((link) => {
          if (!search) return true;
          return [link.internal_name, link.slug, link.notes]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search));
        })
        .map((link) => {
          const hotel = this.data.hotels.find((entry) => entry.id === link.hotel_id) || {};
          return { ...link, hotel_name: hotel.name, hotel_timezone: hotel.timezone };
        });
      if (normalized.includes("order by total_clicks desc")) {
        rows = rows.sort((a, b) => b.total_clicks - a.total_clicks || b.updated_at.localeCompare(a.updated_at));
      } else if (normalized.includes("order by updated_at desc")) {
        rows = rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id));
      } else {
        rows = rows.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      }
      return rows.slice(offset, offset + limit);
    }

    if (normalized.includes("from short_link_clicks_daily") && normalized.includes("where short_link_id = ?")) {
      const [linkId] = params;
      return this.data.shortLinkClicksDaily
        .filter((entry) => entry.short_link_id === linkId)
        .sort((a, b) => a.click_date.localeCompare(b.click_date));
    }

    if (normalized.includes("from media_assets") && normalized.includes("order by created_at desc")) {
      const [hotelId, status] = params;
      let cursor = 2;
      const hasModule = normalized.includes("module_key = ?");
      const moduleKey = hasModule ? params[cursor++] : "";
      const hasSearch = normalized.includes("original_filename");
      const search = hasSearch ? String(params[cursor++] || "").replaceAll("%", "").toLowerCase() : "";
      if (hasSearch) cursor += 1;
      const limit = Number(params[cursor++] || 24);
      const offset = Number(params[cursor++] || 0);
      return this.data.mediaAssets
        .filter((asset) => asset.hotel_id === hotelId && asset.status === status)
        .filter((asset) => !moduleKey || asset.module_key === moduleKey)
        .filter((asset) => {
          if (!search) return true;
          return [asset.original_filename, asset.alt_text]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search));
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
        .slice(offset, offset + limit);
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
      return d1Result(1);
    }

    if (normalized.startsWith("insert into order_status_history")) {
      if (normalized.includes(" from orders o ")) {
        const [
          id,
          status,
          note,
          actor_user_id,
          created_at,
          order_id,
          hotel_id,
          module_key,
          targetStatus,
          targetUpdatedAt,
          historyStatus,
        ] = params;
        const order = this.data.orders.find(
          (entry) =>
            entry.id === order_id &&
            entry.hotel_id === hotel_id &&
            entry.module_key === module_key &&
            entry.status === targetStatus &&
            entry.updated_at === targetUpdatedAt,
        );
        if (!order) return d1Result(0);
        if (this.data.orderStatusHistory.some((entry) => entry.order_id === order_id && entry.status === historyStatus)) {
          return d1Result(0);
        }
        this.insertOrderStatusHistory({
          id,
          order_id,
          hotel_id,
          module_key,
          status,
          note,
          actor_user_id,
          created_at,
        });
        return d1Result(1);
      }
      if (params.length === 5) {
        const [id, order_id, hotel_id, module_key, created_at] = params;
        this.insertOrderStatusHistory({
          id,
          order_id,
          hotel_id,
          module_key,
          status: "received",
          note: "Pedido recebido localmente.",
          actor_user_id: null,
          created_at,
        });
        return d1Result(1);
      }
      const [id, order_id, hotel_id, module_key, status, note, actor_user_id, created_at] = params;
      this.insertOrderStatusHistory({
        id,
        order_id,
        hotel_id,
        module_key,
        status,
        note,
        actor_user_id,
        created_at,
      });
      return d1Result(1);
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
      return d1Result(1);
    }

    if (normalized.startsWith("insert into admin_sessions")) {
      let id;
      let user_id;
      let token_hash;
      let user_agent_hash;
      let ip_hash;
      let session_type;
      let created_at;
      let expires_at;
      if (params.length === 8) {
        [id, user_id, token_hash, user_agent_hash, ip_hash, session_type, created_at, expires_at] = params;
      } else {
        [id, user_id, token_hash, user_agent_hash, ip_hash, created_at, expires_at] = params;
        session_type = "full";
      }
      this.data.adminSessions.push({
        id,
        user_id,
        token_hash,
        user_agent_hash,
        ip_hash,
        session_type,
        created_at,
        expires_at,
        revoked_at: null,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into admin_users")) {
      const [id, display_name, email, password_hash, created_at, updated_at] = params;
      if (this.data.adminUsers.some((user) => user.email.toLowerCase() === String(email).toLowerCase())) {
        throw new Error("UNIQUE constraint failed: admin_users.email");
      }
      this.data.adminUsers.push({
        id,
        display_name,
        email,
        password_hash,
        password_strategy: "pbkdf2",
        status: "active",
        force_password_change: 1,
        password_changed_at: null,
        avatar_object_key: null,
        avatar_mime_type: null,
        avatar_updated_at: null,
        created_at,
        updated_at,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into admin_user_roles") || normalized.startsWith("insert or ignore into admin_user_roles")) {
      const [user_id, role_id, created_at] = params;
      if (!this.data.adminUserRoles.some((entry) => entry.user_id === user_id && entry.role_id === role_id)) {
        this.data.adminUserRoles.push({ user_id, role_id, created_at });
      }
      return d1Result(1);
    }

    if (
      (normalized.startsWith("insert into admin_role_permissions") ||
        normalized.startsWith("insert or ignore into admin_role_permissions")) &&
      normalized.includes("select ?, id")
    ) {
      const [role_id, created_at, permission_key] = params;
      const permission = this.data.adminPermissions.find((entry) => entry.permission_key === permission_key);
      if (permission && !this.data.adminRolePermissions.some((entry) => entry.role_id === role_id && entry.permission_id === permission.id)) {
        this.data.adminRolePermissions.push({ role_id, permission_id: permission.id, created_at });
      }
      return d1Result(permission ? 1 : 0);
    }

    if (normalized.startsWith("insert into admin_roles")) {
      const [id, role_key, name, description, created_at, updated_at] = params;
      if (this.data.adminRoles.some((role) => role.role_key === role_key)) {
        throw new Error("UNIQUE constraint failed: admin_roles.role_key");
      }
      this.data.adminRoles.push({ id, role_key, name, description, created_at, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into media_assets")) {
      if (this.failNextMediaAssetInsert) {
        this.failNextMediaAssetInsert = false;
        throw new Error("media asset insert failed");
      }
      const [
        id,
        hotel_id,
        module_key,
        object_key,
        public_url,
        alt_text,
        mime_type,
        created_at,
        updated_at,
        original_filename,
        size_bytes,
        checksum_sha256,
        storage_etag,
        uploaded_by_user_id,
      ] = params;
      this.data.mediaAssets.push({
        id,
        hotel_id,
        module_key,
        storage_provider: "r2",
        object_key,
        public_url,
        alt_text,
        mime_type,
        status: "active",
        created_at,
        updated_at,
        archived_at: null,
        original_filename,
        size_bytes,
        checksum_sha256,
        storage_etag,
        uploaded_by_user_id,
        archived_by_user_id: null,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into short_links")) {
      const [
        id,
        hotel_id,
        slug,
        internal_name,
        destination_url,
        destination_scheme,
        status,
        starts_at,
        expires_at,
        notes,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at,
      ] = params;
      if (this.data.shortLinks.some((link) => link.slug.toLowerCase() === String(slug).toLowerCase())) {
        throw new Error("UNIQUE constraint failed: short_links.slug");
      }
      this.data.shortLinks.push({
        id,
        hotel_id,
        slug,
        internal_name,
        destination_url,
        destination_scheme,
        status,
        starts_at,
        expires_at,
        notes,
        total_clicks: 0,
        last_clicked_at: null,
        created_by_user_id,
        updated_by_user_id,
        archived_by_user_id: null,
        created_at,
        updated_at,
        archived_at: null,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into short_link_clicks_daily")) {
      const [short_link_id, hotel_id, click_date, first_clicked_at, last_clicked_at] = params;
      const existing = this.data.shortLinkClicksDaily.find(
        (entry) => entry.short_link_id === short_link_id && entry.click_date === click_date,
      );
      if (existing) {
        existing.click_count += 1;
        existing.last_clicked_at = last_clicked_at;
      } else {
        this.data.shortLinkClicksDaily.push({
          short_link_id,
          hotel_id,
          click_date,
          click_count: 1,
          first_clicked_at,
          last_clicked_at,
        });
      }
      return d1Result(1);
    }

    if (normalized.startsWith("insert into hotels")) {
      const [id, slug, name, short_name, timezone, locale, currency, created_at, updated_at] = params;
      this.data.hotels.push({
        id,
        slug,
        name,
        short_name,
        timezone,
        locale,
        currency,
        status: "inactive",
        created_at,
        updated_at,
        archived_at: null,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into hotel_branding")) {
      const [hotel_id, custom_css_json, updated_at] = params;
      this.data.branding.push({
        hotel_id,
        logo_url: null,
        icon_url: null,
        primary_color: "#513b2d",
        secondary_color: "#f4f1ef",
        accent_color: "#c1a94c",
        background_color: "#fbf8f4",
        text_color: "#202124",
        font_family: "Effra, Inter, system-ui, sans-serif",
        custom_css_json,
        updated_at,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into admin_hotel_access") || normalized.startsWith("insert or ignore into admin_hotel_access")) {
      if (this.failNextAdminHotelAccessInsert) {
        this.failNextAdminHotelAccessInsert = false;
        throw new Error("admin hotel access insert failed");
      }
      let user_id;
      let hotel_id;
      let access_level;
      let created_at;
      let updated_at;
      if (params.length === 5) {
        [user_id, hotel_id, access_level, created_at, updated_at] = params;
      } else {
        [user_id, hotel_id, created_at, updated_at] = params;
        access_level = "manager";
      }
      if (!this.data.adminHotelAccess.some((entry) => entry.user_id === user_id && entry.hotel_id === hotel_id)) {
        this.data.adminHotelAccess.push({
          user_id,
          hotel_id,
          access_level,
          created_at,
          updated_at,
        });
      }
      return d1Result(1);
    }

    if (normalized.startsWith("update admin_sessions")) {
      let changes = 0;
      if (normalized.includes("where user_id = ?")) {
        const [revoked_at, user_id] = params;
        for (const session of this.data.adminSessions) {
          if (session.user_id === user_id && session.revoked_at == null) {
            session.revoked_at = revoked_at;
            changes += 1;
          }
        }
        return d1Result(changes);
      }
      const [revoked_at, token_hash] = params;
      for (const session of this.data.adminSessions) {
        if (session.token_hash === token_hash && session.revoked_at == null) {
          session.revoked_at = revoked_at;
          changes += 1;
        }
      }
      return d1Result(changes);
    }

    if (normalized.startsWith("update admin_users") && normalized.includes("set display_name = ?")) {
      const [display_name, email, updated_at, id] = params;
      const user = this.data.adminUsers.find((entry) => entry.id === id);
      if (!user) return d1Result(0);
      Object.assign(user, { display_name, email, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("update admin_users") && normalized.includes("set status = ?")) {
      const [status, updated_at, id] = params;
      const user = this.data.adminUsers.find((entry) => entry.id === id);
      if (!user) return d1Result(0);
      user.status = status;
      user.updated_at = updated_at;
      return d1Result(1);
    }

    if (normalized.startsWith("update admin_users") && normalized.includes("password_hash = ?")) {
      const password_hash = params[0];
      const firstDate = params[1];
      const secondDate = params.length === 4 ? params[2] : params[1];
      const id = params.length === 4 ? params[3] : params[2];
      const user = this.data.adminUsers.find((entry) => entry.id === id);
      if (!user) return d1Result(0);
      user.password_hash = password_hash;
      user.password_strategy = "pbkdf2";
      if (normalized.includes("force_password_change = 0")) {
        user.force_password_change = 0;
        user.password_changed_at = firstDate;
        user.updated_at = secondDate;
      } else {
        user.force_password_change = 1;
        user.password_changed_at = null;
        user.updated_at = firstDate;
      }
      return d1Result(1);
    }

    if (normalized.startsWith("update admin_users") && normalized.includes("avatar_object_key = ?")) {
      const [avatar_object_key, avatar_mime_type, avatar_updated_at, updated_at, id] = params;
      const user = this.data.adminUsers.find((entry) => entry.id === id);
      if (!user) return d1Result(0);
      Object.assign(user, { avatar_object_key, avatar_mime_type, avatar_updated_at, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("update admin_users") && normalized.includes("avatar_object_key = null")) {
      const [updated_at, id] = params;
      const user = this.data.adminUsers.find((entry) => entry.id === id);
      if (!user) return d1Result(0);
      Object.assign(user, {
        avatar_object_key: null,
        avatar_mime_type: null,
        avatar_updated_at: null,
        updated_at,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("update admin_roles")) {
      const [name, description, updated_at, id] = params;
      const role = this.data.adminRoles.find((entry) => entry.id === id);
      if (!role) return d1Result(0);
      Object.assign(role, { name, description, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("delete from admin_user_roles")) {
      const [user_id] = params;
      const before = this.data.adminUserRoles.length;
      this.data.adminUserRoles = this.data.adminUserRoles.filter((entry) => entry.user_id !== user_id);
      return d1Result(before - this.data.adminUserRoles.length);
    }

    if (normalized.startsWith("delete from admin_hotel_access")) {
      const [user_id] = params;
      const before = this.data.adminHotelAccess.length;
      this.data.adminHotelAccess = this.data.adminHotelAccess.filter((entry) => entry.user_id !== user_id);
      return d1Result(before - this.data.adminHotelAccess.length);
    }

    if (normalized.startsWith("delete from admin_role_permissions")) {
      const [role_id] = params;
      const before = this.data.adminRolePermissions.length;
      this.data.adminRolePermissions = this.data.adminRolePermissions.filter((entry) => entry.role_id !== role_id);
      return d1Result(before - this.data.adminRolePermissions.length);
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
        return d1Result(1);
      }
      return d1Result(0);
    }

    if (normalized.startsWith("update media_assets") && normalized.includes("set alt_text = ?")) {
      const [alt_text, module_key, updated_at, id, hotel_id] = params;
      const asset = this.data.mediaAssets.find(
        (entry) => entry.id === id && entry.hotel_id === hotel_id && entry.status !== "archived",
      );
      if (!asset) return d1Result(0);
      asset.alt_text = alt_text;
      asset.module_key = module_key;
      asset.updated_at = updated_at;
      return d1Result(1);
    }

    if (normalized.startsWith("update media_assets") && normalized.includes("set status = 'archived'")) {
      const [archived_at, archived_by_user_id, updated_at, id, hotel_id] = params;
      const asset = this.data.mediaAssets.find(
        (entry) => entry.id === id && entry.hotel_id === hotel_id && entry.status !== "archived",
      );
      if (!asset) return d1Result(0);
      asset.status = "archived";
      asset.archived_at = archived_at;
      asset.archived_by_user_id = archived_by_user_id;
      asset.updated_at = updated_at;
      return d1Result(1);
    }

    if (normalized.startsWith("update short_links") && normalized.includes("total_clicks = total_clicks + 1")) {
      const [last_clicked_at, id] = params;
      const link = this.data.shortLinks.find((entry) => entry.id === id);
      if (!link) return d1Result(0);
      link.total_clicks += 1;
      link.last_clicked_at = last_clicked_at;
      return d1Result(1);
    }

    if (normalized.startsWith("update short_links") && normalized.includes("set internal_name = ?")) {
      const [
        internal_name,
        destination_url,
        destination_scheme,
        status,
        starts_at,
        expires_at,
        notes,
        updated_by_user_id,
        updated_at,
        id,
        hotel_id,
      ] = params;
      const link = this.data.shortLinks.find((entry) => entry.id === id && entry.hotel_id === hotel_id && entry.status !== "archived");
      if (!link) return d1Result(0);
      Object.assign(link, {
        internal_name,
        destination_url,
        destination_scheme,
        status,
        starts_at,
        expires_at,
        notes,
        updated_by_user_id,
        updated_at,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("update short_links") && normalized.includes("set status = 'archived'")) {
      const [archived_at, archived_by_user_id, updated_by_user_id, updated_at, id, hotel_id] = params;
      const link = this.data.shortLinks.find((entry) => entry.id === id && entry.hotel_id === hotel_id && entry.status !== "archived");
      if (!link) return d1Result(0);
      link.status = "archived";
      link.archived_at = archived_at;
      link.archived_by_user_id = archived_by_user_id;
      link.updated_by_user_id = updated_by_user_id;
      link.updated_at = updated_at;
      return d1Result(1);
    }

    if (normalized.startsWith("update hotels")) {
      const [name, short_name, slug, timezone, locale, currency, status, updated_at, archiveStatus, archived_at, id] = params;
      const hotel = this.data.hotels.find((entry) => entry.id === id);
      if (!hotel) return d1Result(0);
      Object.assign(hotel, {
        name,
        short_name,
        slug,
        timezone,
        locale,
        currency,
        status,
        updated_at,
        archived_at: archiveStatus === "archived" ? hotel.archived_at || archived_at : null,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("update hotel_branding")) {
      const [
        logo_url,
        icon_url,
        primary_color,
        secondary_color,
        accent_color,
        background_color,
        text_color,
        font_family,
        custom_css_json,
        updated_at,
        hotel_id,
      ] = params;
      const branding = this.data.branding.find((entry) => entry.hotel_id === hotel_id);
      if (!branding) return d1Result(0);
      Object.assign(branding, {
        logo_url,
        icon_url,
        primary_color,
        secondary_color,
        accent_color,
        background_color,
        text_color,
        font_family,
        custom_css_json,
        updated_at,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into hotel_settings")) {
      const [id, hotel_id, setting_key, setting_value, value_type, is_public, created_at, updated_at] = params;
      const existing = this.data.settings.find((entry) => entry.hotel_id === hotel_id && entry.setting_key === setting_key);
      if (existing) {
        Object.assign(existing, { setting_value, value_type, is_public, updated_at });
      } else {
        this.data.settings.push({ id, hotel_id, setting_key, setting_value, value_type, is_public, created_at, updated_at });
      }
      return d1Result(1);
    }

    if (normalized.startsWith("insert into hotel_modules")) {
      const [
        hotel_id,
        module_key,
        enabled,
        is_public,
        public_name,
        navigation_label,
        sort_order,
        created_at,
        updated_at,
      ] = params;
      const existing = this.data.hotelModules.find((entry) => entry.hotel_id === hotel_id && entry.module_key === module_key);
      if (existing) {
        Object.assign(existing, { enabled, is_public, public_name, navigation_label, sort_order, updated_at });
      } else {
        this.data.hotelModules.push({
          hotel_id,
          module_key,
          enabled,
          is_public,
          public_name,
          navigation_label,
          sort_order,
          settings_json: "{}",
          created_at,
          updated_at,
        });
      }
      return d1Result(1);
    }

    if (normalized.startsWith("insert into navigation_items")) {
      const [id, hotel_id, module_key, label, path, icon_key, sort_order, is_public, enabled, created_at, updated_at] = params;
      this.data.navigation.push({
        id,
        hotel_id,
        module_key,
        label,
        path,
        icon_key,
        sort_order,
        is_public,
        enabled,
        created_at,
        updated_at,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("update navigation_items") && normalized.includes("set module_key = ?")) {
      const [module_key, label, path, icon_key, sort_order, is_public, enabled, updated_at, id, hotel_id] = params;
      const item = this.data.navigation.find((entry) => entry.id === id && entry.hotel_id === hotel_id);
      if (!item) return d1Result(0);
      Object.assign(item, { module_key, label, path, icon_key, sort_order, is_public, enabled, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("update navigation_items") && normalized.includes("set enabled = 0")) {
      const [updated_at, id, hotel_id] = params;
      const item = this.data.navigation.find((entry) => entry.id === id && entry.hotel_id === hotel_id);
      if (!item) return d1Result(0);
      item.enabled = 0;
      item.updated_at = updated_at;
      return d1Result(1);
    }

    if (normalized.startsWith("insert into admin_audit_log")) {
      if (normalized.includes(" from orders o ")) {
        const [
          id,
          actor_user_id,
          action,
          entity_type,
          metadata_json,
          created_at,
          order_id,
          hotel_id,
          module_key,
          targetStatus,
          targetUpdatedAt,
          historyId,
          historyStatus,
        ] = params;
        const order = this.data.orders.find(
          (entry) =>
            entry.id === order_id &&
            entry.hotel_id === hotel_id &&
            entry.module_key === module_key &&
            entry.status === targetStatus &&
            entry.updated_at === targetUpdatedAt,
        );
        if (!order) return d1Result(0);
        const history = this.data.orderStatusHistory.find(
          (entry) => entry.id === historyId && entry.order_id === order_id && entry.status === historyStatus,
        );
        if (!history) return d1Result(0);
        this.data.adminAuditLog.push({
          id,
          hotel_id,
          module_key,
          actor_user_id,
          action,
          entity_type,
          entity_id: order_id,
          metadata_json,
          created_at,
        });
        return d1Result(1);
      }
      if (normalized.includes("'media_asset'")) {
        const [id, hotel_id, module_key, actor_user_id, action, entity_id, metadata_json, created_at] = params;
        this.data.adminAuditLog.push({
          id,
          hotel_id,
          module_key,
          actor_user_id,
          action,
          entity_type: "media_asset",
          entity_id,
          metadata_json,
          created_at,
        });
        return d1Result(1);
      }
      if (normalized.includes("'hotel'")) {
        const [id, hotel_id, module_key, actor_user_id, action, entity_id, metadata_json, created_at] = params;
        this.data.adminAuditLog.push({
          id,
          hotel_id,
          module_key,
          actor_user_id,
          action,
          entity_type: "hotel",
          entity_id,
          metadata_json,
          created_at,
        });
        return d1Result(1);
      }
      if (normalized.includes("'short_link'")) {
        const [id, hotel_id, actor_user_id, action, entity_id, metadata_json, created_at] = params;
        this.data.adminAuditLog.push({
          id,
          hotel_id,
          module_key: null,
          actor_user_id,
          action,
          entity_type: "short_link",
          entity_id,
          metadata_json,
          created_at,
        });
        return d1Result(1);
      }
      if (normalized.includes("values (?, null, null")) {
        const [id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at] = params;
        this.data.adminAuditLog.push({
          id,
          hotel_id: null,
          module_key: null,
          actor_user_id,
          action,
          entity_type,
          entity_id,
          metadata_json,
          created_at,
        });
        return d1Result(1);
      }
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
      return d1Result(1);
    }

    throw new Error(`Unhandled run SQL: ${normalized}`);
  }

  findAvailability(catalogItemId, hotelId) {
    return this.data.availability.find((entry) => entry.catalog_item_id === catalogItemId && entry.hotel_id === hotelId);
  }

  insertOrderStatusHistory(entry) {
    const duplicate = this.data.orderStatusHistory.find(
      (row) => row.order_id === entry.order_id && row.status === entry.status,
    );
    if (duplicate) {
      throw new Error("UNIQUE constraint failed: order_status_history.order_id, order_status_history.status");
    }
    this.data.orderStatusHistory.push(entry);
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

function d1Result(changes, results = []) {
  return {
    success: true,
    meta: {
      changes,
      changed_db: changes > 0,
      rows_written: changes,
      rows_read: 0,
    },
    results,
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class MockR2Bucket {
  constructor() {
    this.objects = new Map();
    this.failNextPut = false;
    this.getCalls = 0;
    this.headCalls = 0;
  }

  async put(key, value, options = {}) {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error("r2 put failed");
    }
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(await new Response(value).arrayBuffer());
    const etag = `"mock-${key.length}-${bytes.byteLength}"`;
    this.objects.set(key, {
      key,
      bytes,
      size: bytes.byteLength,
      etag,
      httpEtag: etag,
      httpMetadata: options.httpMetadata || {},
      customMetadata: options.customMetadata || {},
    });
    return { key, etag, httpEtag: etag };
  }

  async get(key) {
    this.getCalls += 1;
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      ...object,
      body: new Blob([object.bytes]).stream(),
    };
  }

  async head(key) {
    this.headCalls += 1;
    const object = this.objects.get(key);
    if (!object) return null;
    return { ...object, body: undefined };
  }

  async delete(key) {
    this.objects.delete(key);
  }

  async list() {
    return { objects: [...this.objects.values()].map(({ body, ...object }) => object) };
  }
}
