export function createTestEnv(overrides = {}) {
  const data = createFixtureData();
  return {
    DB: new MockD1Database(data),
    ASSETS: createAssetsBinding(),
    MEDIA_BUCKET: new MockR2Bucket(),
    ENVIRONMENT: "test",
    IMPRESSION_ENABLED: "false",
    DEFAULT_HOTEL_SLUG: "muller-fioreze",
    TURNSTILE_ENABLED: "false",
    TURNSTILE_SITE_KEY: "",
    TURNSTILE_ALLOWED_HOSTNAMES: "local.test,localhost,127.0.0.1",
    LOGIN_RATE_LIMIT_KEY: "test-login-rate-limit-key-with-more-than-32-characters",
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
          '<!doctype html><html><body><h1>Ecossistema Fioreze</h1><form id="loginForm"></form><div id="systemsList"></div><section id="settingsManager"></section></body></html>',
        "/admin/index.html":
          '<!doctype html><html><body><h1>Ecossistema Fioreze</h1><form id="loginForm"></form><div id="systemsList"></div><section id="settingsManager"></section></body></html>',
        "/erp/room-service/":
          '<!doctype html><html><body data-erp="room-service"><h1>ERP Room Service Fioreze</h1><form id="loginForm"></form><div id="routeOutlet"></div><script type="module" src="/js/modules/room-service-erp/app.js"></script></body></html>',
        "/erp/room-service/index.html":
          '<!doctype html><html><body data-erp="room-service"><h1>ERP Room Service Fioreze</h1><form id="loginForm"></form><div id="routeOutlet"></div><script type="module" src="/js/modules/room-service-erp/app.js"></script></body></html>',
        "/admin/portais/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><div id="portalsDenied"></div><section id="mediaLibrary"></section><section id="unitsManager"></section><section id="shortLinksManager"></section><section id="contentManager"></section><section id="areasManager"></section><section id="navigationManager"></section><section id="auditManager"></section></body></html>',
        "/admin/portais/index.html":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><div id="portalsDenied"></div><section id="mediaLibrary"></section><section id="unitsManager"></section><section id="shortLinksManager"></section><section id="contentManager"></section><section id="areasManager"></section><section id="navigationManager"></section><section id="auditManager"></section></body></html>',
        "/admin/portais/media/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><section id="mediaLibrary"></section></body></html>',
        "/admin/portais/unidades/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><section id="unitsManager"></section></body></html>',
        "/admin/portais/links/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><section id="shortLinksManager"></section></body></html>',
        "/admin/portais/portal-hospede/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><section id="guestPortalEditor"></section></body></html>',
        "/admin/portais/conteudos/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><section id="contentManager"></section></body></html>',
        "/admin/portais/areas/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><section id="areasManager"></section></body></html>',
        "/admin/portais/navegacao/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><section id="navigationManager"></section></body></html>',
        "/admin/portais/auditoria/":
          '<!doctype html><html><body><h1>Central de Portais Fioreze</h1><form id="loginForm"></form><section id="auditManager"></section></body></html>',
        "/admin/usuarios/":
          '<!doctype html><html><body><h1>Central Administrativa Fioreze</h1><form id="loginForm"></form><section id="usersManager"></section></body></html>',
        "/admin/perfis/":
          '<!doctype html><html><body><h1>Central Administrativa Fioreze</h1><form id="loginForm"></form><section id="rolesManager"></section></body></html>',
        "/admin/mensagens/":
          '<!doctype html><html><body><h1>Central Administrativa Fioreze</h1><form id="loginForm"></form><section id="messagesManager"></section></body></html>',
        "/admin/minha-conta/":
          '<!doctype html><html><body><h1>Central Administrativa Fioreze</h1><form id="loginForm"></form><section id="accountManager"></section></body></html>',
        "/admin/configuracoes/":
          '<!doctype html><html><body><h1>Central Administrativa Fioreze</h1><form id="loginForm"></form><section id="settingsManager"></section></body></html>',
        "/not-found/":
          '<!doctype html><html lang="pt-BR"><body><main class="public-not-found"><img src="/assets/shared/fioreze-central-logo.jpg" alt="Fioreze Hotéis"><h1>404</h1><p>A página solicitada não pode ser encontrada.</p></main></body></html>',
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
        custom_css_json: JSON.stringify({ horizontal_logo_url: "/assets/hotels/muller-fioreze/logo.png" }),
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
        folder_id: null,
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
    romanticPackages: [],
    decorationCategories: [],
    spaSharedProfile: {
      id: "spa-zena",
      title: "Spa Zena",
      subtitle: "Cuidar de voce e a nossa essencia.",
      intro_text: "Conheca nossos servicos de relaxamento e bem-estar.",
      about_text: "Conteudo institucional ficticio do Spa.",
      booking_title: "Agende seu horario",
      booking_text: "Consulte a disponibilidade com a equipe.",
      whatsapp_number: "5554999999999",
      whatsapp_service_message: "Mensagem para {hotel_name}: {service_name}.",
      whatsapp_general_message: "Mensagem geral para {hotel_name}.",
      hours_text: "das 9h as 20h",
      usage_rules_json: JSON.stringify(["Regra ficticia de utilizacao."]),
      logo_media_asset_id: null,
      status: "active",
      created_at: "2026-07-28T00:00:00.000Z",
      updated_at: "2026-07-28T00:00:00.000Z",
      archived_at: null,
    },
    spaSharedServices: [
      {
        id: "spa-service-shared-relax",
        name: "Massagem Relaxante Ficticia",
        description: "Servico ficticio para testes locais.",
        duration_label: "50 minutos",
        duration_minutes: 50,
        price_cents: 25000,
        currency: "BRL",
        media_asset_id: null,
        status: "active",
        sort_order: 10,
        created_at: "2026-07-28T00:00:00.000Z",
        updated_at: "2026-07-28T00:00:00.000Z",
        archived_at: null,
      },
    ],
    adminUsers: [
      {
        id: "user-demo-admin",
        user_number: 1,
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
        user_number: 2,
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
    adminRoles: [
      { id: "role-demo-manager", role_number: 1, role_key: "demo-manager", name: "Gerente demo", description: "Role ficticia." },
      { id: "role-erp-master", role_number: 2, role_key: "erp-master", name: "Administrador mestre dos ERPs", description: "Perfil tecnico." },
    ],
    adminPermissions: [
      { id: "perm-orders-read", permission_key: "room-service.orders.read", module_key: "room-service" },
      { id: "perm-orders-write", permission_key: "room-service.orders.write", module_key: "room-service" },
      { id: "perm-erp-master", permission_key: "erp.master", module_key: "admin" },
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
      { id: "perm-portals-links-delete", permission_key: "portals.links.delete", module_key: null },
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
      { user_id: "user-demo-admin", role_id: "role-erp-master" },
      { user_id: "user-aurora-admin", role_id: "role-demo-manager" },
    ],
    adminRolePermissions: [
      { role_id: "role-demo-manager", permission_id: "perm-orders-read" },
      { role_id: "role-demo-manager", permission_id: "perm-orders-write" },
      { role_id: "role-erp-master", permission_id: "perm-erp-master" },
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
    adminLoginAttempts: [],
    adminLoginSecurityEvents: [],
    adminUserPreferences: [
      {
        user_id: "user-demo-admin",
        color_palette: "fioreze",
        created_at: "2026-07-04T00:00:00.000Z",
        updated_at: "2026-07-04T00:00:00.000Z",
      },
    ],
    adminMessages: [],
    mediaFolders: [],
    erpUsers: [
      {
        id: "erp-user-muller-1",
        hotel_id: "muller-fioreze",
        user_code: 1,
        display_name: "Atendente Muller Demo",
        password_hash:
          "pbkdf2$sha256$100000$ZmlvcmV6ZS1hZG1pbi1kZW1vLXNhbHQtMjAyNg==$QPM6b/QnKHhfCwYXFU9kCd7KpgtlsLdGDELeiM9Ulgw=",
        password_strategy: "pbkdf2",
        status: "active",
        created_at: "2026-07-13T00:00:00.000Z",
        updated_at: "2026-07-13T00:00:00.000Z",
        archived_at: null,
      },
      {
        id: "erp-user-aurora-1",
        hotel_id: "aurora-demo",
        user_code: 1,
        display_name: "Atendente Aurora Demo",
        password_hash:
          "pbkdf2$sha256$100000$ZmlvcmV6ZS1hZG1pbi1kZW1vLXNhbHQtMjAyNg==$QPM6b/QnKHhfCwYXFU9kCd7KpgtlsLdGDELeiM9Ulgw=",
        password_strategy: "pbkdf2",
        status: "active",
        created_at: "2026-07-13T00:00:00.000Z",
        updated_at: "2026-07-13T00:00:00.000Z",
        archived_at: null,
      },
    ],
    erpUserPermissions: [
      { user_id: "erp-user-muller-1", hotel_id: "muller-fioreze", permission_key: "room-service.dashboard.read", created_at: "2026-07-13T00:00:00.000Z" },
      { user_id: "erp-user-muller-1", hotel_id: "muller-fioreze", permission_key: "room-service.orders.read", created_at: "2026-07-13T00:00:00.000Z" },
      { user_id: "erp-user-muller-1", hotel_id: "muller-fioreze", permission_key: "room-service.orders.write", created_at: "2026-07-13T00:00:00.000Z" },
      { user_id: "erp-user-aurora-1", hotel_id: "aurora-demo", permission_key: "room-service.orders.read", created_at: "2026-07-13T00:00:00.000Z" },
    ],
    erpSessions: [],
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
    shortLinkUserShares: [],
    shortLinkClicksDaily: [],
    shortLinkClickVisitors: [],
    shortLinkUniqueVisitors: [],
    portalVisitVisitors: [],
    customPortalPages: [],
    portalPages: [
      {
        id: "page-muller-home",
        hotel_id: "muller-fioreze",
        module_key: "guest-portal",
        slug: "inicio",
        title: "Boas-vindas",
        summary: "Conteudo institucional ficticio.",
        status: "published",
        sort_order: 10,
        updated_at: "2026-07-04T00:00:00.000Z",
        archived_at: null,
      },
      {
        id: "page-muller-guide",
        hotel_id: "muller-fioreze",
        module_key: "guest-portal",
        slug: "guia-local",
        title: "Guia local",
        summary: "Sugestoes ficticias para a estadia.",
        status: "published",
        sort_order: 20,
        updated_at: "2026-07-04T00:00:00.000Z",
        archived_at: null,
      },
      {
        id: "page-aurora-home",
        hotel_id: "aurora-demo",
        module_key: "guest-portal",
        slug: "inicio",
        title: "Aurora",
        summary: "Conteudo ficticio de isolamento.",
        status: "published",
        sort_order: 10,
        updated_at: "2026-07-04T00:00:00.000Z",
        archived_at: null,
      },
    ],
    events: [
      {
        id: "event-muller-welcome",
        hotel_id: "muller-fioreze",
        title: "Encontro de boas-vindas",
        summary: "Evento inteiramente ficticio.",
        content: "Conteudo ficticio para validar a visualizacao detalhada.",
        location: "Sala Exemplo",
        category: "Boas-vindas",
        tags_json: '["Recepcao"]',
        action_text: "Ver programacao",
        action_url: "https://example.test/programacao",
        starts_at: "2026-08-10T20:00:00.000Z",
        ends_at: "2026-08-10T22:00:00.000Z",
        timezone: "America/Sao_Paulo",
        status: "published",
        is_permanent: 0,
      },
      {
        id: "event-aurora-welcome",
        hotel_id: "aurora-demo",
        title: "Evento Aurora",
        summary: "Evento ficticio de outra unidade.",
        content: "Conteudo ficticio de isolamento.",
        location: "Espaco Aurora",
        category: "Experiencia",
        tags_json: '["Aurora"]',
        action_text: null,
        action_url: null,
        starts_at: "2026-08-11T20:00:00.000Z",
        ends_at: "2026-08-11T22:00:00.000Z",
        timezone: "America/Sao_Paulo",
        status: "published",
        is_permanent: 0,
      },
    ],
    hotelInformation: [
      {
        id: "info-muller-wifi",
        hotel_id: "muller-fioreze",
        info_key: "wifi",
        title: "Wi-Fi",
        body: "Consulte os dados de acesso na recepcao.",
        is_public: 1,
        sort_order: 10,
      },
      {
        id: "info-muller-breakfast",
        hotel_id: "muller-fioreze",
        info_key: "breakfast",
        title: "Cafe da manha",
        body: "Horario ficticio para testes locais.",
        is_public: 1,
        sort_order: 20,
      },
      {
        id: "info-muller-private",
        hotel_id: "muller-fioreze",
        info_key: "internal",
        title: "Informacao interna",
        body: "Nao deve aparecer publicamente.",
        is_public: 0,
        sort_order: 30,
      },
      {
        id: "info-aurora-wifi",
        hotel_id: "aurora-demo",
        info_key: "wifi",
        title: "Wi-Fi Aurora",
        body: "Conteudo ficticio de outra unidade.",
        is_public: 1,
        sort_order: 10,
      },
    ],
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

    if (normalized.includes("from admin_login_attempts") && normalized.includes("locked_until > ?")) {
      const [accountHash, ipHash, now] = params;
      return (
        this.data.adminLoginAttempts
          .filter(
            (entry) =>
              ((entry.identifier_type === "account" && entry.identifier_hash === accountHash) ||
                (entry.identifier_type === "ip" && entry.identifier_hash === ipHash)) &&
              entry.locked_until > now,
          )
          .sort((left, right) => right.locked_until.localeCompare(left.locked_until))[0] || null
      );
    }

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

    if (
      normalized.includes("from hotels h") &&
      normalized.includes("join hotel_modules hm") &&
      normalized.includes("where h.id = ?") &&
      normalized.includes("hm.module_key = ?") &&
      normalized.includes("'operator' as access_level")
    ) {
      const [hotelId, moduleKey] = params;
      const hotel = this.data.hotels.find((entry) => entry.id === hotelId && entry.status === "active" && entry.archived_at == null);
      const hotelModuleRow = this.data.hotelModules.find(
        (entry) => entry.hotel_id === hotelId && entry.module_key === moduleKey && entry.enabled === 1,
      );
      const requiresCentralManagement = normalized.includes("from admin_hotel_access");
      const centrallyManaged = this.data.adminHotelAccess.some((entry) => entry.hotel_id === hotelId);
      return hotel && hotelModuleRow && (!requiresCentralManagement || centrallyManaged)
        ? {
            hotel_id: hotel.id,
            slug: hotel.slug,
            name: hotel.name,
            short_name: hotel.short_name,
            timezone: hotel.timezone,
            locale: hotel.locale,
            currency: hotel.currency,
            access_level: "operator",
          }
        : null;
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

    if (normalized.includes("select setting_value") && normalized.includes("from hotel_settings")) {
      const [hotelId, settingKey] = params;
      return this.data.settings.find((entry) => entry.hotel_id === hotelId && entry.setting_key === settingKey) || null;
    }

    if (normalized.includes("from hotel_modules") && normalized.includes("where hotel_id = ? and module_key = ?")) {
      const [hotelId, moduleKey] = params;
      return this.data.hotelModules.find((module) => module.hotel_id === hotelId && module.module_key === moduleKey) || null;
    }

    if (normalized.includes("from modules") && normalized.includes("where module_key = ?")) {
      const [moduleKey] = params;
      return this.data.modules.find((moduleRow) => moduleRow.module_key === moduleKey) || null;
    }

    if (normalized.includes("from spa_shared_profile p") && normalized.includes("where p.status = 'active'")) {
      const profile = this.data.spaSharedProfile;
      if (!profile || profile.status !== "active") return null;
      const media = this.data.mediaAssets.find(
        (entry) => entry.id === profile.logo_media_asset_id && entry.status === "active",
      );
      return {
        ...profile,
        logo_url: media?.public_url || null,
        logo_alt: media?.alt_text || null,
      };
    }

    if (normalized.includes("from spa_shared_profile p") && normalized.includes("where p.id = ?")) {
      const [profileId] = params;
      const profile = this.data.spaSharedProfile;
      if (!profile || profile.id !== profileId) return null;
      const media = this.data.mediaAssets.find((entry) => entry.id === profile.logo_media_asset_id);
      return {
        ...profile,
        logo_url: media?.public_url || null,
        logo_alt: media?.alt_text || null,
      };
    }

    if (normalized.includes("from spa_shared_services s") && normalized.includes("where s.id = ?")) {
      const [serviceId] = params;
      const service = this.data.spaSharedServices.find((entry) => entry.id === serviceId);
      if (!service) return null;
      const media = this.data.mediaAssets.find((entry) => entry.id === service.media_asset_id);
      return {
        ...service,
        image_url: media?.public_url || null,
        image_alt: media?.alt_text || null,
      };
    }

    if (
      normalized.includes("select id, hotel_id") &&
      normalized.includes("from media_assets") &&
      normalized.includes("mime_type like 'image/%'")
    ) {
      const [assetId] = params;
      const asset = this.data.mediaAssets.find(
        (entry) =>
          entry.id === assetId &&
          entry.status === "active" &&
          String(entry.mime_type || "").startsWith("image/"),
      );
      return asset ? { id: asset.id, hotel_id: asset.hotel_id } : null;
    }

    if (normalized.includes("from catalogs c") && normalized.includes("join hotels h") && normalized.includes("c.status = 'active'")) {
      const [hotelId, moduleKey] = params;
      const catalogRow = this.data.catalogs.find((entry) => entry.hotel_id === hotelId && entry.module_key === moduleKey && entry.status === "active");
      const hotel = this.data.hotels.find((entry) => entry.id === hotelId);
      return catalogRow && hotel ? { ...catalogRow, currency: hotel.currency } : null;
    }

    if (normalized.includes("from categories") && normalized.includes("where id = ?")) {
      const [categoryId, hotelId, moduleKey] = params;
      const categoryRow = this.data.categories.find((entry) => entry.id === categoryId && entry.hotel_id === hotelId);
      const catalogRow = categoryRow && this.data.catalogs.find((entry) => entry.id === categoryRow.catalog_id && entry.module_key === moduleKey);
      return categoryRow && catalogRow ? { ...categoryRow, module_key: moduleKey } : null;
    }

    if (normalized.includes("from decoration_categories") && normalized.includes("where id = ?")) {
      const [categoryId, hotelId, moduleKey] = params;
      return this.data.decorationCategories.find(
        (entry) => entry.id === categoryId && entry.hotel_id === hotelId && entry.module_key === moduleKey,
      ) || null;
    }

    if (normalized.includes("from romantic_packages rp") && normalized.includes("where rp.id = ?")) {
      const [itemId, hotelId, moduleKey] = params;
      const item = this.data.romanticPackages.find(
        (entry) => entry.id === itemId && entry.hotel_id === hotelId && entry.module_key === moduleKey,
      );
      if (!item) return null;
      const media = this.data.mediaAssets.find(
        (entry) => entry.id === item.media_asset_id && entry.hotel_id === hotelId && entry.status === "active",
      );
      return {
        ...item,
        image_url: media?.public_url || null,
        image_alt: media?.alt_text || null,
      };
    }

    if (normalized.includes("from catalog_items ci") && normalized.includes("left join catalog_item_availability") && normalized.includes("where ci.id = ?")) {
      const [itemId, hotelId, moduleKey] = params;
      const catalogItem = this.data.catalogItems.find((entry) => entry.id === itemId && entry.hotel_id === hotelId && entry.module_key === moduleKey);
      if (!catalogItem) return null;
      const itemAvailability = this.findAvailability(itemId, hotelId);
      return { ...catalogItem, is_available: itemAvailability?.is_available ?? 1, availability_label: itemAvailability?.availability_label ?? null };
    }

    if (normalized.includes("select id") && normalized.includes("from media_assets") && normalized.includes("module_key = ? or module_key is null")) {
      const [assetId, hotelId, moduleKey] = params;
      const asset = this.data.mediaAssets.find((entry) => entry.id === assetId && entry.hotel_id === hotelId && (entry.module_key === moduleKey || entry.module_key == null) && entry.status === "active");
      return asset ? { id: asset.id } : null;
    }

    if (normalized.includes("select id") && normalized.includes("from media_assets") && normalized.includes("mime_type like 'image/%'")) {
      const [assetId, hotelId] = params;
      const asset = this.data.mediaAssets.find(
        (entry) =>
          entry.id === assetId &&
          entry.hotel_id === hotelId &&
          entry.status === "active" &&
          String(entry.mime_type || "").startsWith("image/"),
      );
      return asset ? { id: asset.id } : null;
    }

    if (normalized.includes("from rooms") && normalized.includes("where id = ? and hotel_id = ?")) {
      const [roomId, hotelId] = params;
      return this.data.rooms.find((entry) => entry.id === roomId && entry.hotel_id === hotelId) || null;
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

    if (normalized.includes("select coalesce(max(user_number), 0) + 1 as next_number from admin_users")) {
      return { next_number: Math.max(0, ...this.data.adminUsers.map((user) => Number(user.user_number || 0))) + 1 };
    }

    if (normalized.includes("select coalesce(max(role_number), 0) + 1 as next_number from admin_roles")) {
      return { next_number: Math.max(0, ...this.data.adminRoles.map((role) => Number(role.role_number || 0))) + 1 };
    }

    if (normalized.includes("from admin_messages") && normalized.includes("where id = ?") && normalized.includes("limit 1")) {
      const [messageId] = params;
      return this.data.adminMessages.find((message) => message.id === messageId) || null;
    }

    if (normalized.includes("from admin_users u") && normalized.includes("where u.id = ?") && normalized.includes("recipient_access")) {
      const [recipientUserId, senderUserId] = params;
      const recipient = this.data.adminUsers.find((user) => user.id === recipientUserId && user.status === "active");
      if (!recipient) return null;
      const senderHotels = this.data.adminHotelAccess.filter((access) => access.user_id === senderUserId).map((access) => access.hotel_id);
      const recipientHotels = this.data.adminHotelAccess.filter((access) => access.user_id === recipientUserId).map((access) => access.hotel_id);
      return !senderHotels.length || senderHotels.some((hotelId) => recipientHotels.includes(hotelId)) ? { id: recipient.id } : null;
    }

    if (normalized.includes("from admin_user_preferences") && normalized.includes("where user_id = ?")) {
      const [userId] = params;
      return this.data.adminUserPreferences.find((entry) => entry.user_id === userId) || null;
    }

    if (normalized.includes("from media_folders") && normalized.includes("select") && normalized.includes("where id = ?") && normalized.includes("hotel_id = ?")) {
      const [folderId, hotelId] = params;
      return this.data.mediaFolders.find(
        (entry) => entry.id === folderId && entry.hotel_id === hotelId && entry.archived_at == null,
      ) || null;
    }

    if (normalized.includes("from media_folders") && normalized.includes("hotel_id in") && normalized.includes("where id = ?")) {
      const [folderId, ...hotelIds] = params;
      return this.data.mediaFolders.find(
        (entry) => entry.id === folderId && hotelIds.includes(entry.hotel_id) && entry.archived_at == null,
      ) || null;
    }

    if (normalized.startsWith("select (select count(*) from media_assets where folder_id = ?")) {
      const [assetFolderId, childFolderId] = params;
      return {
        item_count: this.data.mediaAssets.filter((entry) => entry.folder_id === assetFolderId && entry.status !== "archived").length,
        child_count: this.data.mediaFolders.filter((entry) => entry.parent_id === childFolderId && entry.archived_at == null).length,
      };
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
        user_number: user.user_number,
        session_type: session.session_type || "full",
        expires_at: session.expires_at,
        display_name: user.display_name,
        email: user.email,
        avatar_object_key: user.avatar_object_key,
        avatar_mime_type: user.avatar_mime_type,
        avatar_updated_at: user.avatar_updated_at,
      };
    }

    if (normalized.includes("from erp_users") && normalized.includes("user_code = ?")) {
      const [hotelId, userCode] = params;
      return this.data.erpUsers.find((user) => user.hotel_id === hotelId && user.user_code === Number(userCode)) || null;
    }

    if (normalized.includes("from erp_sessions s") && normalized.includes("s.token_hash = ?")) {
      const [tokenHash, now] = params;
      const session = this.data.erpSessions.find(
        (entry) => entry.token_hash === tokenHash && entry.revoked_at == null && entry.expires_at > now,
      );
      if (!session) return null;
      const user = this.data.erpUsers.find(
        (entry) => entry.id === session.user_id && entry.hotel_id === session.hotel_id && entry.status === "active",
      );
      return user ? { ...user, session_id: session.id, expires_at: session.expires_at } : null;
    }

    if (normalized.includes("select avatar_media_asset_id") && normalized.includes("from erp_users")) {
      const [userId, hotelId] = params;
      const user = this.data.erpUsers.find((entry) => entry.id === userId && entry.hotel_id === hotelId);
      return user ? { avatar_media_asset_id: user.avatar_media_asset_id || null } : null;
    }

    if (normalized.includes("from erp_users") && normalized.includes("password_hash") && normalized.includes("status = 'active'")) {
      const [userId, hotelId] = params;
      return this.data.erpUsers.find((entry) => entry.id === userId && entry.hotel_id === hotelId && entry.status === "active") || null;
    }

    if (normalized.includes("select coalesce(max(user_code), 0) + 1 as next_code") && normalized.includes("from erp_users")) {
      const [hotelId] = params;
      const codes = this.data.erpUsers.filter((user) => user.hotel_id === hotelId).map((user) => Number(user.user_code));
      return { next_code: Math.max(0, ...codes) + 1 };
    }

    if (normalized.includes("from erp_users") && normalized.includes("where id = ? and hotel_id = ?")) {
      const [userId, hotelId] = params;
      const user = this.data.erpUsers.find(
        (entry) => entry.id === userId && entry.hotel_id === hotelId && entry.status !== "archived",
      );
      if (!user) return null;
      const { password_hash: _passwordHash, password_strategy: _passwordStrategy, ...safe } = user;
      return safe;
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
      return role ? { ...role } : null;
    }

    if (normalized.includes("from admin_user_roles ur") && normalized.includes("join admin_users u") && normalized.includes("u.user_number = 1")) {
      const [roleId] = params;
      const assigned = this.data.adminUserRoles.find(
        (entry) =>
          entry.role_id === roleId &&
          this.data.adminUsers.some((user) => user.id === entry.user_id && Number(user.user_number) === 1),
      );
      return assigned ? { role_id: assigned.role_id } : null;
    }

    if (normalized.includes("count(*) as user_count") && normalized.includes("from admin_user_roles")) {
      const [roleId] = params;
      return { user_count: this.data.adminUserRoles.filter((entry) => entry.role_id === roleId).length };
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

    if (normalized.includes("count(*) as file_count") && normalized.includes("sum(size_bytes)") && normalized.includes("from media_assets")) {
      const [hotelId] = params;
      const assets = this.data.mediaAssets.filter(
        (entry) => entry.hotel_id === hotelId && entry.storage_provider === "r2",
      );
      return {
        file_count: assets.length,
        used_bytes: assets.reduce((total, entry) => total + Number(entry.size_bytes || 0), 0),
      };
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
            (entry.hotel_id === hotelId || entry.hotel_id == null) &&
            (!normalized.includes("mime_type in ('font/woff', 'font/woff2')") ||
              ["font/woff", "font/woff2"].includes(entry.mime_type)),
        ) || null
      );
    }

    if (normalized.includes("from custom_portal_pages") && normalized.includes("lower(slug) = lower(?)")) {
      const [hotelId, slug, excludedId] = params;
      return (
        this.data.customPortalPages.find(
          (page) =>
            page.hotel_id === hotelId &&
            page.slug.toLowerCase() === String(slug).toLowerCase() &&
            (!normalized.includes("id <> ?") || page.id !== excludedId),
        ) || null
      );
    }

    if (normalized.includes("from custom_portal_pages cp") && normalized.includes("where cp.id = ?") && normalized.includes("cp.hotel_id in")) {
      const [pageId, ...hotelIds] = params;
      const page = this.data.customPortalPages.find((entry) => entry.id === pageId && hotelIds.includes(entry.hotel_id));
      if (!page) return null;
      const hotel = this.data.hotels.find((entry) => entry.id === page.hotel_id) || {};
      return { ...page, hotel_name: hotel.name, hotel_slug: hotel.slug };
    }

    if (normalized.includes("from custom_portal_pages cp") && normalized.includes("join hotel_modules hm")) {
      const [hotelSlug, pageSlug] = params;
      const hotel = this.data.hotels.find(
        (entry) => entry.slug === hotelSlug && entry.status === "active" && entry.archived_at == null,
      );
      if (!hotel) return null;
      const module = this.data.hotelModules.find(
        (entry) => entry.hotel_id === hotel.id && entry.module_key === "guest-portal" && entry.enabled === 1 && entry.is_public === 1,
      );
      const page = this.data.customPortalPages.find(
        (entry) =>
          entry.hotel_id === hotel.id &&
          entry.slug === pageSlug &&
          entry.status === "published" &&
          entry.archived_at == null,
      );
      return module && page ? { id: page.id, title: page.title, sanitized_html: page.sanitized_html } : null;
    }

    if (normalized.includes("from short_links") && normalized.includes("lower(slug) = lower(?)")) {
      const [slug] = params;
      return this.data.shortLinks.find((link) => link.slug.toLowerCase() === String(slug).toLowerCase()) || null;
    }

    if (normalized.includes("from short_links sl") && normalized.includes("where sl.id = ?") && normalized.includes("sl.hotel_id in")) {
      const hasSharedAccess = normalized.includes("from short_link_user_shares sls");
      const linkId = params[0];
      const ownerUserId = params.at(hasSharedAccess ? -2 : -1);
      const viewerUserId = params.at(-1);
      const hotelIds = params.slice(1, hasSharedAccess ? -2 : -1);
      const link = this.data.shortLinks.find((entry) =>
        entry.id === linkId &&
        hotelIds.includes(entry.hotel_id) &&
        (entry.created_by_user_id === ownerUserId || (hasSharedAccess && this.data.shortLinkUserShares.some(
          (share) => share.short_link_id === entry.id && share.user_id === viewerUserId,
        )))
      );
      if (!link) return null;
      const hotel = this.data.hotels.find((entry) => entry.id === link.hotel_id) || {};
      return { ...link, hotel_name: hotel.name, hotel_timezone: hotel.timezone };
    }

    if (normalized.includes("select user_id from short_link_user_shares")) {
      const [shortLinkId, userId] = params;
      return this.data.shortLinkUserShares.find((entry) => entry.short_link_id === shortLinkId && entry.user_id === userId) || null;
    }

    if (normalized.includes("from portal_visit_visitors") && normalized.includes("count(distinct visitor_hash)")) {
      const [hotelId, from, to, regionLike] = params;
      const rows = filterPortalAnalytics(this.data.portalVisitVisitors, { hotelId, from, to, regionLike });
      return {
        unique_visitors: new Set(rows.map((entry) => entry.visitor_hash)).size,
        total_visits: rows.reduce((sum, entry) => sum + Number(entry.visit_count || 0), 0),
        first_visit_at: rows.map((entry) => entry.first_visited_at).sort()[0] || null,
        last_visit_at: rows.map((entry) => entry.last_visited_at).sort().at(-1) || null,
      };
    }

    if (normalized.includes("from short_link_click_visitors") && normalized.includes("count(distinct visitor_hash)")) {
      const [linkId, from, to, regionLike] = params;
      const rows = filterShortLinkAnalytics(this.data.shortLinkClickVisitors, { linkId, from, to, regionLike });
      return {
        unique_visitors: new Set(rows.map((entry) => entry.visitor_hash)).size,
        total_attempts: sumMetric(rows, "click_count"),
      };
    }

    if (normalized.includes("from admin_users u") && normalized.includes("join admin_hotel_access aha") && normalized.includes("where u.id = ?")) {
      const [hotelId, userId] = params;
      const user = this.data.adminUsers.find((entry) => entry.id === userId && entry.status === "active");
      const access = this.data.adminHotelAccess.some((entry) => entry.user_id === userId && entry.hotel_id === hotelId);
      return user && access ? { id: user.id, display_name: user.display_name, email: user.email } : null;
    }

    if (normalized.includes("from navigation_items") && normalized.includes("where id = ? and hotel_id = ?")) {
      const [itemId, hotelId] = params;
      return this.data.navigation.find((entry) => entry.id === itemId && entry.hotel_id === hotelId) || null;
    }

    throw new Error(`Unhandled first SQL: ${normalized}`);
  }

  selectAll(sql, params) {
    const normalized = normalize(sql);

    if (normalized.includes("from spa_shared_services s")) {
      const activeOnly = normalized.includes("where s.status = 'active'");
      return this.data.spaSharedServices
        .filter((entry) => !activeOnly || (entry.status === "active" && entry.archived_at == null))
        .map((entry) => {
          const media = this.data.mediaAssets.find(
            (candidate) =>
              candidate.id === entry.media_asset_id &&
              (!activeOnly || candidate.status === "active"),
          );
          return {
            ...entry,
            image_url: media?.public_url || null,
            image_alt: media?.alt_text || null,
          };
        })
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || a.name.localeCompare(b.name));
    }

    if (normalized.includes("from portal_pages") && normalized.includes("status = 'published'")) {
      const [hotelId, moduleKey] = params;
      return this.data.portalPages
        .filter(
          (entry) =>
            entry.hotel_id === hotelId &&
            entry.module_key === moduleKey &&
            entry.status === "published" &&
            entry.archived_at == null,
        )
        .sort((left, right) => left.sort_order - right.sort_order || left.title.localeCompare(right.title));
    }

    if (normalized.includes("from events") && normalized.includes("status = 'published'")) {
      const [hotelId, now] = params;
      return this.data.events
        .filter((entry) =>
          entry.hotel_id === hotelId &&
          entry.status === "published" &&
          (!normalized.includes("e.is_permanent = 1 or e.starts_at > ?") || entry.is_permanent === 1 || entry.starts_at > now),
        )
        .sort((left, right) => left.starts_at.localeCompare(right.starts_at) || left.title.localeCompare(right.title));
    }

    if (normalized.includes("from hotel_information") && normalized.includes("is_public = 1")) {
      const [hotelId] = params;
      return this.data.hotelInformation
        .filter((entry) => entry.hotel_id === hotelId && entry.is_public === 1)
        .sort((left, right) => left.sort_order - right.sort_order || left.title.localeCompare(right.title));
    }

    if (normalized.includes("select distinct u.id, u.user_number") && normalized.includes("from admin_users u")) {
      const [senderUserId] = params;
      const senderHotels = this.data.adminHotelAccess.filter((access) => access.user_id === senderUserId).map((access) => access.hotel_id);
      return this.data.adminUsers
        .filter((user) => user.status === "active" && user.id !== senderUserId)
        .filter((user) => {
          if (!senderHotels.length) return true;
          const recipientHotels = this.data.adminHotelAccess.filter((access) => access.user_id === user.id).map((access) => access.hotel_id);
          return senderHotels.some((hotelId) => recipientHotels.includes(hotelId));
        })
        .map(({ id, user_number, display_name, email }) => ({ id, user_number, display_name, email }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id));
    }

    if (normalized.includes("from admin_messages m") && normalized.includes("join admin_users sender")) {
      const ownerUserId = params[0];
      const archived = normalized.includes("archived_by_sender_at is not null");
      if (archived) {
        return this.data.adminMessages
          .filter(
            (message) =>
              (message.sender_user_id === ownerUserId && message.archived_by_sender_at != null) ||
              (message.recipient_user_id === ownerUserId && message.archived_by_recipient_at != null),
          )
          .map((message) => {
            const sent = message.sender_user_id === ownerUserId;
            const counterpart = this.data.adminUsers.find((user) => user.id === (sent ? message.recipient_user_id : message.sender_user_id));
            return {
              id: message.id,
              subject: message.subject,
              body: message.body,
              created_at: message.created_at,
              read_at: message.read_at || null,
              direction: sent ? "sent" : "inbox",
              counterpart_number: counterpart?.user_number || null,
              counterpart_name: counterpart?.display_name || "",
              counterpart_email: counterpart?.email || "",
            };
          })
          .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      }
      const sent = normalized.includes("m.sender_user_id = ?");
      return this.data.adminMessages
        .filter((message) => (sent ? message.sender_user_id : message.recipient_user_id) === ownerUserId)
        .filter((message) => (sent ? message.archived_by_sender_at : message.archived_by_recipient_at) == null)
        .map((message) => {
          const counterpart = this.data.adminUsers.find((user) => user.id === (sent ? message.recipient_user_id : message.sender_user_id));
          return {
            id: message.id,
            subject: message.subject,
            body: message.body,
            created_at: message.created_at,
            read_at: message.read_at || null,
            counterpart_number: counterpart?.user_number || null,
            counterpart_name: counterpart?.display_name || "",
            counterpart_email: counterpart?.email || "",
          };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    }

    if (
      normalized.includes("from hotels h") &&
      normalized.includes("join hotel_modules hm") &&
      normalized.includes("left join hotel_branding hb") &&
      normalized.includes("hm.module_key = ?")
    ) {
      const [moduleKey] = params;
      const requiresCentralManagement = normalized.includes("from admin_hotel_access");
      return this.data.hotels
        .filter((hotel) => hotel.status === "active" && hotel.archived_at == null)
        .filter((hotel) => this.data.hotelModules.some((entry) => entry.hotel_id === hotel.id && entry.module_key === moduleKey && entry.enabled === 1))
        .filter((hotel) => !requiresCentralManagement || this.data.adminHotelAccess.some((entry) => entry.hotel_id === hotel.id))
        .map((hotel) => ({
          hotel_id: hotel.id,
          slug: hotel.slug,
          name: hotel.name,
          short_name: hotel.short_name,
          timezone: hotel.timezone,
          locale: hotel.locale,
          currency: hotel.currency,
          ...(this.data.branding.find((entry) => entry.hotel_id === hotel.id) || {}),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (
      normalized.includes("from hotels h") &&
      normalized.includes("'owner' as access_level") &&
      !normalized.includes("join hotel_modules")
    ) {
      return this.data.hotels
        .filter((hotel) => hotel.status !== "archived" && hotel.archived_at == null)
        .map((hotel) => ({
          hotel_id: hotel.id,
          slug: hotel.slug,
          name: hotel.name,
          short_name: hotel.short_name,
          timezone: hotel.timezone,
          locale: hotel.locale,
          currency: hotel.currency,
          access_level: "owner",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (normalized.includes("from hotels h") && normalized.includes("join hotel_modules hm") && normalized.includes("'owner' as access_level")) {
      const [moduleKey] = params;
      const requiresCentralManagement = normalized.includes("from admin_hotel_access");
      return this.data.hotels
        .filter((hotel) => hotel.status === "active" && hotel.archived_at == null)
        .filter((hotel) => this.data.hotelModules.some((entry) => entry.hotel_id === hotel.id && entry.module_key === moduleKey && entry.enabled === 1))
        .filter((hotel) => !requiresCentralManagement || this.data.adminHotelAccess.some((entry) => entry.hotel_id === hotel.id))
        .map((hotel) => ({
          hotel_id: hotel.id,
          slug: hotel.slug,
          name: hotel.name,
          short_name: hotel.short_name,
          timezone: hotel.timezone,
          locale: hotel.locale,
          currency: hotel.currency,
          access_level: "owner",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (normalized.includes("from erp_users") && normalized.includes("where hotel_id = ?") && normalized.includes("order by user_code")) {
      const [hotelId] = params;
      return this.data.erpUsers
        .filter((user) => user.hotel_id === hotelId && user.status !== "archived")
        .map(({ password_hash, password_strategy, ...safe }) => safe)
        .sort((a, b) => a.user_code - b.user_code);
    }

    if (normalized.includes("from erp_user_permissions") && normalized.includes("where hotel_id = ?") && normalized.includes("order by user_id")) {
      const [hotelId] = params;
      return this.data.erpUserPermissions
        .filter((entry) => entry.hotel_id === hotelId)
        .map(({ user_id, permission_key }) => ({ user_id, permission_key }))
        .sort((a, b) => a.user_id.localeCompare(b.user_id) || a.permission_key.localeCompare(b.permission_key));
    }

    if (normalized.includes("from erp_user_permissions") && normalized.includes("where user_id = ?")) {
      const [userId, hotelId] = params;
      return this.data.erpUserPermissions
        .filter((entry) => entry.user_id === userId && entry.hotel_id === hotelId)
        .map(({ permission_key }) => ({ permission_key }))
        .sort((a, b) => a.permission_key.localeCompare(b.permission_key));
    }

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

    if (normalized.includes("from catalogs c") && normalized.includes("join hotels h") && normalized.includes("c.status = 'active'")) {
      const [hotelId, moduleKey] = params;
      const catalogRow = this.data.catalogs.find((entry) => entry.hotel_id === hotelId && entry.module_key === moduleKey && entry.status === "active");
      const hotel = this.data.hotels.find((entry) => entry.id === hotelId);
      return catalogRow && hotel ? { ...catalogRow, currency: hotel.currency } : null;
    }

    if (normalized.includes("from categories") && normalized.includes("where id = ?")) {
      const [categoryId, hotelId, moduleKey] = params;
      const categoryRow = this.data.categories.find((entry) => entry.id === categoryId && entry.hotel_id === hotelId);
      const catalogRow = categoryRow && this.data.catalogs.find((entry) => entry.id === categoryRow.catalog_id && entry.module_key === moduleKey);
      return categoryRow && catalogRow ? { ...categoryRow, module_key: moduleKey } : null;
    }

    if (normalized.includes("from catalog_items ci") && normalized.includes("left join catalog_item_availability") && normalized.includes("where ci.id = ?")) {
      const [itemId, hotelId, moduleKey] = params;
      const catalogItem = this.data.catalogItems.find((entry) => entry.id === itemId && entry.hotel_id === hotelId && entry.module_key === moduleKey);
      if (!catalogItem) return null;
      const itemAvailability = this.findAvailability(itemId, hotelId);
      return { ...catalogItem, is_available: itemAvailability?.is_available ?? 1, availability_label: itemAvailability?.availability_label ?? null };
    }

    if (normalized.includes("select id") && normalized.includes("from media_assets") && normalized.includes("module_key = ? or module_key is null")) {
      const [assetId, hotelId, moduleKey] = params;
      const asset = this.data.mediaAssets.find((entry) => entry.id === assetId && entry.hotel_id === hotelId && (entry.module_key === moduleKey || entry.module_key == null) && entry.status === "active");
      return asset ? { id: asset.id } : null;
    }

    if (normalized.includes("from rooms") && normalized.includes("where id = ? and hotel_id = ?")) {
      const [roomId, hotelId] = params;
      return this.data.rooms.find((entry) => entry.id === roomId && entry.hotel_id === hotelId) || null;
    }

    if (normalized.includes("select avatar_media_asset_id") && normalized.includes("from erp_users")) {
      const [userId, hotelId] = params;
      const user = this.data.erpUsers.find((entry) => entry.id === userId && entry.hotel_id === hotelId);
      return user ? { avatar_media_asset_id: user.avatar_media_asset_id || null } : null;
    }

    if (normalized.includes("from erp_users") && normalized.includes("password_hash") && normalized.includes("status = 'active'")) {
      const [userId, hotelId] = params;
      return this.data.erpUsers.find((entry) => entry.id === userId && entry.hotel_id === hotelId && entry.status === "active") || null;
    }

    if (normalized.includes("from rooms") && normalized.includes("status != 'archived'")) {
      const [hotelId] = params;
      return this.data.rooms
        .filter((room) => room.hotel_id === hotelId && room.status !== "archived")
        .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100) || a.code.localeCompare(b.code));
    }

    if (normalized.includes("from rooms") && normalized.includes("order by sort_order, code")) {
      const [hotelId] = params;
      return this.data.rooms
        .filter((room) => room.hotel_id === hotelId && room.status === "active")
        .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100) || a.code.localeCompare(b.code));
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
      const [hotelId, moduleKey] = params;
      return this.data.serviceHours
        .filter((entry) => entry.hotel_id === hotelId && entry.status === "active" && entry.archived_at == null)
        .filter((entry) => !normalized.includes("sh.module_key = ?") || entry.module_key === moduleKey)
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
            user_number: user.user_number,
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
            role_number: role.role_number,
            role_key: role.role_key,
            name: role.name,
            description: role.description || "",
            user_count: userCount,
            master_assigned: this.data.adminUserRoles.some(
              (entry) =>
                entry.role_id === role.id &&
                this.data.adminUsers.some((user) => user.id === entry.user_id && Number(user.user_number) === 1),
            )
              ? 1
              : 0,
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

    if (normalized.includes("select hotel_id from admin_hotel_access where user_id = ?")) {
      const [userId] = params;
      return this.data.adminHotelAccess
        .filter((entry) => entry.user_id === userId)
        .map((entry) => ({ hotel_id: entry.hotel_id }))
        .sort((a, b) => a.hotel_id.localeCompare(b.hotel_id));
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
      const [hotelId, requestedModuleKey] = params;
      const moduleKey = requestedModuleKey ||
        (normalized.includes("ci.module_key = 'emporio'") ? "emporio" : "room-service");
      const includeInactive = normalized.includes("ci.status != 'archived'");
      return this.data.catalogItems
        .filter((catalogItem) => catalogItem.hotel_id === hotelId)
        .filter((catalogItem) => catalogItem.module_key === moduleKey)
        .filter((catalogItem) => includeInactive ? catalogItem.status !== "archived" : catalogItem.status === "active")
        .filter((catalogItem) => {
          const catalog = this.data.catalogs.find((entry) => entry.id === catalogItem.catalog_id);
          return catalog?.module_key === moduleKey && catalog.status === "active";
        })
        .map((catalogItem) => {
          const categoryRow = this.data.categories.find((categoryEntry) => categoryEntry.id === catalogItem.category_id);
          if (!categoryRow || (includeInactive ? categoryRow.status === "archived" : categoryRow.status !== "active")) return null;
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
        .filter(Boolean)
        .sort((a, b) => a.category_sort_order - b.category_sort_order || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    }

    if (normalized.includes("from decoration_categories") && normalized.includes("status != 'archived'")) {
      const [hotelId, moduleKey] = params;
      return this.data.decorationCategories
        .filter((entry) => entry.hotel_id === hotelId && entry.module_key === moduleKey && entry.status !== "archived")
        .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100) || a.name.localeCompare(b.name));
    }

    if (normalized.includes("from romantic_packages rp")) {
      const [hotelId, moduleKey] = params;
      const includeInactive = normalized.includes("rp.status != 'archived'");
      return this.data.romanticPackages
        .filter((entry) => entry.hotel_id === hotelId)
        .filter((entry) => entry.module_key === moduleKey)
        .filter((entry) => includeInactive ? entry.status !== "archived" : entry.status === "active")
        .map((entry) => {
          const media = this.data.mediaAssets.find(
            (candidate) =>
              candidate.id === entry.media_asset_id
              && candidate.hotel_id === entry.hotel_id
              && candidate.status === "active",
          );
          const categoryRow = this.data.decorationCategories.find(
            (candidate) =>
              candidate.id === entry.category_id
              && candidate.hotel_id === entry.hotel_id
              && candidate.module_key === entry.module_key
              && candidate.status === "active",
          );
          return {
            ...entry,
            category_key: categoryRow?.category_key || entry.category_key || null,
            category_name: categoryRow?.name || entry.category_name || null,
            category_description: categoryRow?.description || entry.category_description || null,
            category_sort_order: categoryRow?.sort_order || entry.category_sort_order || null,
            image_url: media?.public_url || null,
            image_alt: media?.alt_text || null,
          };
        })
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || a.name.localeCompare(b.name));
    }

    if (normalized.includes("from categories") && normalized.includes("status != 'archived'")) {
      const [hotelId, moduleKey] = params;
      return this.data.categories
        .filter((entry) => {
          const catalog = this.data.catalogs.find((candidate) => candidate.id === entry.catalog_id);
          return entry.hotel_id === hotelId && catalog?.module_key === moduleKey && entry.status !== "archived";
        })
        .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100) || a.name.localeCompare(b.name));
    }

    if (normalized.includes("from order_items oi") && normalized.includes("sum(oi.quantity)")) {
      const [hotelId, moduleKey] = params;
      const totals = new Map();
      for (const item of this.data.orderItems.filter((entry) => entry.hotel_id === hotelId && entry.module_key === moduleKey)) {
        const order = this.data.orders.find((entry) => entry.id === item.order_id && entry.status !== "cancelled");
        if (!order) continue;
        const key = `${item.catalog_item_id || "snapshot"}:${item.item_name_snapshot}`;
        const current = totals.get(key) || { catalog_item_id: item.catalog_item_id, name: item.item_name_snapshot, quantity: 0, revenue_cents: 0 };
        current.quantity += Number(item.quantity || 0);
        current.revenue_cents += Number(item.line_total_cents || 0);
        totals.set(key, current);
      }
      return [...totals.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)).slice(0, 8);
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

    if (normalized.includes("from custom_portal_pages cp") && normalized.includes("join hotels h") && normalized.includes("where cp.hotel_id = ?")) {
      const [hotelId] = params;
      const hotel = this.data.hotels.find((entry) => entry.id === hotelId) || {};
      return this.data.customPortalPages
        .filter((page) => page.hotel_id === hotelId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.title.localeCompare(b.title))
        .map(({ sanitized_html: _sanitizedHtml, ...page }) => ({ ...page, hotel_name: hotel.name, hotel_slug: hotel.slug }));
    }

    if (normalized.includes("from short_links sl") && normalized.includes("join hotels h")) {
      const [hotelId, ownerUserId, viewerUserId] = params;
      let cursor = 3;
      const hasStatus = normalized.includes("sl.status = ?");
      const status = hasStatus ? params[cursor++] : "";
      const hasSearch = normalized.includes("lower(sl.internal_name) like ?");
      const search = hasSearch ? String(params[cursor++] || "").replaceAll("%", "").toLowerCase() : "";
      if (hasSearch) cursor += 2;
      const limit = Number(params[cursor++] || 25);
      const offset = Number(params[cursor++] || 0);
      let rows = this.data.shortLinks
        .filter((link) => link.hotel_id === hotelId)
        .filter((link) => link.created_by_user_id === ownerUserId || this.data.shortLinkUserShares.some(
          (share) => share.short_link_id === link.id && share.user_id === viewerUserId,
        ))
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

    if (normalized.includes("from admin_users u") && normalized.includes("left join short_link_user_shares sls")) {
      const [hotelId, shortLinkId, ownerUserId] = params;
      return this.data.adminHotelAccess
        .filter((access) => access.hotel_id === hotelId && access.user_id !== ownerUserId)
        .map((access) => this.data.adminUsers.find((user) => user.id === access.user_id && user.status === "active"))
        .filter(Boolean)
        .map((user) => ({
          id: user.id,
          display_name: user.display_name,
          email: user.email,
          shared: this.data.shortLinkUserShares.some((share) => share.short_link_id === shortLinkId && share.user_id === user.id) ? 1 : 0,
        }))
        .sort((left, right) => left.display_name.localeCompare(right.display_name) || left.email.localeCompare(right.email));
    }

    if (normalized.includes("from short_link_clicks_daily") && normalized.includes("where short_link_id = ?")) {
      const [linkId, from, to] = params;
      return this.data.shortLinkClicksDaily
        .filter((entry) => entry.short_link_id === linkId)
        .filter((entry) => !from || (entry.click_date >= from && entry.click_date <= to))
        .sort((a, b) => a.click_date.localeCompare(b.click_date));
    }

    if (normalized.includes("from short_link_click_visitors")) {
      const [linkId, from, to, regionLike] = params;
      const rows = filterShortLinkAnalytics(this.data.shortLinkClickVisitors, { linkId, from, to, regionLike });
      if (normalized.includes("group by click_date")) {
        return groupedAnalytics(rows, (entry) => entry.click_date)
          .map(({ key, rows: group }) => ({ click_date: key, click_count: new Set(group.map((entry) => entry.visitor_hash)).size, first_clicked_at: minMetric(group, "first_clicked_at"), last_clicked_at: maxMetric(group, "last_clicked_at") }))
          .sort((left, right) => left.click_date.localeCompare(right.click_date));
      }

      if (normalized.includes("group by coalesce(country_code")) {
        return groupedAnalytics(rows, (entry) => `${entry.country_code || "Nao informado"}\u0000${entry.region || "Nao informado"}`)
          .map(({ key, rows: group }) => {
            const [country_code, region] = key.split("\u0000");
            return { country_code, region, unique_clicks: new Set(group.map((entry) => entry.visitor_hash)).size, total_attempts: sumMetric(group, "click_count"), last_clicked_at: maxMetric(group, "last_clicked_at") };
          })
          .sort((left, right) => right.unique_clicks - left.unique_clicks || right.total_attempts - left.total_attempts)
          .slice(0, 12);
      }
      if (normalized.includes("group by substr(first_clicked_at")) {
        return groupedAnalytics(rows, (entry) => entry.first_clicked_at.slice(11, 13))
          .map(({ key, rows: group }) => ({ hour: key, unique_clicks: new Set(group.map((entry) => entry.visitor_hash)).size, total_attempts: sumMetric(group, "click_count") }))
          .sort((left, right) => left.hour.localeCompare(right.hour));
      }
      return rows.sort((left, right) => right.last_clicked_at.localeCompare(left.last_clicked_at)).slice(0, 20);
    }

    if (normalized.includes("from portal_visit_visitors")) {
      const [hotelId, from, to, regionLike] = params;
      const rows = filterPortalAnalytics(this.data.portalVisitVisitors, { hotelId, from, to, regionLike });
      let keyForRow;
      if (normalized.includes("group by visit_date, page_key")) {
        keyForRow = (entry) => `${entry.visit_date}\u0000${entry.page_key}\u0000${entry.country_code || ""}\u0000${entry.region || ""}`;
      } else if (normalized.includes("group by visit_date")) {
        keyForRow = (entry) => entry.visit_date;
      } else if (normalized.includes("group by page_key")) {
        keyForRow = (entry) => entry.page_key;
      } else if (normalized.includes("group by coalesce(country_code")) {
        keyForRow = (entry) => `${entry.country_code || "Nao informado"}\u0000${entry.region || "Nao informado"}`;
      } else {
        keyForRow = (entry) => entry.first_visited_at.slice(11, 13);
      }
      const mapped = groupedAnalytics(rows, keyForRow).map(({ key, rows: group }) => {
        const values = key.split("\u0000");
        const base = { unique_visitors: new Set(group.map((entry) => entry.visitor_hash)).size, total_visits: sumMetric(group, "visit_count") };
        if (normalized.includes("group by visit_date, page_key")) {
          return { ...base, visit_date: values[0], page_key: values[1], country_code: values[2] || null, region: values[3] || null, first_visit_at: minMetric(group, "first_visited_at"), last_visit_at: maxMetric(group, "last_visited_at") };
        }
        if (normalized.includes("group by visit_date")) return { ...base, visit_date: key };
        if (normalized.includes("group by page_key")) return { ...base, page_key: key, last_visit_at: maxMetric(group, "last_visited_at") };
        if (normalized.includes("group by coalesce(country_code")) return { ...base, country_code: values[0], region: values[1] };
        return { ...base, hour: key };
      });
      if (normalized.includes("order by last_visit_at desc")) return mapped.sort((a, b) => b.last_visit_at.localeCompare(a.last_visit_at)).slice(0, 30);
      if (normalized.includes("order by unique_visitors desc")) return mapped.sort((a, b) => b.unique_visitors - a.unique_visitors || b.total_visits - a.total_visits);
      return mapped.sort((a, b) => String(a.visit_date || a.hour || "").localeCompare(String(b.visit_date || b.hour || "")));
    }

    if (normalized.includes("from media_assets") && normalized.includes("uploaded_by_erp_user_id") && normalized.includes("limit 100")) {
      const [hotelId, moduleKey] = params;
      return this.data.mediaAssets
        .filter((asset) => asset.hotel_id === hotelId && (asset.module_key === moduleKey || asset.module_key == null) && asset.status === "active")
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
        .slice(0, 100);
    }

    if (normalized.includes("from media_folders f") && normalized.includes("order by lower(f.name)")) {
      const [hotelId, parentId] = params;
      const includeAll = normalized.includes("and 1 = 1");
      const filtersRoot = normalized.includes("f.parent_id is null");
      return this.data.mediaFolders
        .filter((folder) => folder.hotel_id === hotelId && folder.archived_at == null)
        .filter((folder) => includeAll || (filtersRoot ? folder.parent_id == null : folder.parent_id === parentId))
        .map((folder) => ({
          ...folder,
          item_count: this.data.mediaAssets.filter((asset) => asset.folder_id === folder.id && asset.status !== "archived").length,
          child_count: this.data.mediaFolders.filter((child) => child.parent_id === folder.id && child.archived_at == null).length,
        }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    }

    if (normalized.includes("from media_assets") && normalized.includes("order by created_at desc")) {
      const [hotelId, status] = params;
      let cursor = 2;
      const hasModule = normalized.includes("module_key = ?");
      const moduleKey = hasModule ? params[cursor++] : "";
      const hasFolder = normalized.includes("folder_id = ?");
      const folderId = hasFolder ? params[cursor++] : null;
      const rootOnly = normalized.includes("folder_id is null");
      const hasSearch = normalized.includes("lower(coalesce(original_filename");
      const search = hasSearch ? String(params[cursor++] || "").replaceAll("%", "").toLowerCase() : "";
      if (hasSearch) cursor += 1;
      const limit = Number(params[cursor++] || 24);
      const offset = Number(params[cursor++] || 0);
      return this.data.mediaAssets
        .filter((asset) => asset.hotel_id === hotelId && asset.status === status)
        .filter((asset) => !moduleKey || asset.module_key === moduleKey)
        .filter((asset) => (hasFolder ? asset.folder_id === folderId : !rootOnly || asset.folder_id == null))
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

    if (normalized.startsWith("update spa_shared_profile")) {
      const [
        title,
        subtitle,
        intro_text,
        about_text,
        booking_title,
        booking_text,
        whatsapp_number,
        whatsapp_service_message,
        whatsapp_general_message,
        hours_text,
        usage_rules_json,
        logo_media_asset_id,
        status,
        updated_at,
        archived_at,
        profileId,
      ] = params;
      const profile = this.data.spaSharedProfile;
      if (!profile || profile.id !== profileId) return d1Result(0);
      Object.assign(profile, {
        title,
        subtitle,
        intro_text,
        about_text,
        booking_title,
        booking_text,
        whatsapp_number,
        whatsapp_service_message,
        whatsapp_general_message,
        hours_text,
        usage_rules_json,
        logo_media_asset_id,
        status,
        updated_at,
        archived_at,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into spa_shared_services")) {
      const [
        id,
        name,
        description,
        duration_label,
        duration_minutes,
        price_cents,
        currency,
        media_asset_id,
        status,
        sort_order,
        created_at,
        updated_at,
        archived_at,
      ] = params;
      this.data.spaSharedServices.push({
        id,
        name,
        description,
        duration_label,
        duration_minutes,
        price_cents,
        currency,
        media_asset_id,
        status,
        sort_order,
        created_at,
        updated_at,
        archived_at,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("update spa_shared_services")) {
      const [
        name,
        description,
        duration_label,
        duration_minutes,
        price_cents,
        currency,
        media_asset_id,
        status,
        sort_order,
        updated_at,
        archived_at,
        serviceId,
      ] = params;
      const service = this.data.spaSharedServices.find((entry) => entry.id === serviceId);
      if (!service) return d1Result(0);
      Object.assign(service, {
        name,
        description,
        duration_label,
        duration_minutes,
        price_cents,
        currency,
        media_asset_id,
        status,
        sort_order,
        updated_at,
        archived_at,
      });
      return d1Result(1);
    }

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
          actor_erp_user_id,
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
          actor_erp_user_id,
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

    if (normalized.startsWith("insert into admin_login_attempts")) {
      const [identifier_type, identifier_hash, now, last_failed_at, expires_at, created_at, updated_at, cutoff, threshold] = params;
      let attempt = this.data.adminLoginAttempts.find(
        (entry) => entry.identifier_type === identifier_type && entry.identifier_hash === identifier_hash,
      );
      if (!attempt) {
        attempt = {
          identifier_type,
          identifier_hash,
          failure_count: 1,
          lock_level: 0,
          window_started_at: now,
          last_failed_at,
          locked_until: null,
          expires_at,
          created_at,
          updated_at,
        };
        this.data.adminLoginAttempts.push(attempt);
      } else if (!(attempt.locked_until && attempt.locked_until > now)) {
        if (attempt.window_started_at <= cutoff) {
          attempt.failure_count = 1;
          attempt.window_started_at = now;
          attempt.locked_until = null;
        } else {
          const candidate = attempt.failure_count + 1;
          if (candidate >= Number(threshold)) {
            attempt.failure_count = 0;
            attempt.lock_level = Math.min(attempt.lock_level + 1, 4);
            attempt.window_started_at = now;
            attempt.locked_until = params[15 + attempt.lock_level];
          } else {
            attempt.failure_count = candidate;
            if (attempt.locked_until && attempt.locked_until <= now) attempt.locked_until = null;
          }
        }
        attempt.last_failed_at = now;
        attempt.expires_at = expires_at;
        attempt.updated_at = updated_at;
      }
      return d1Result(1, [
        {
          identifier_type: attempt.identifier_type,
          failure_count: attempt.failure_count,
          lock_level: attempt.lock_level,
          locked_until: attempt.locked_until,
        },
      ]);
    }

    if (normalized.startsWith("delete from admin_login_attempts") && normalized.includes("expires_at <= ?")) {
      const [now] = params;
      const before = this.data.adminLoginAttempts.length;
      this.data.adminLoginAttempts = this.data.adminLoginAttempts.filter((entry) => entry.expires_at > now);
      return d1Result(before - this.data.adminLoginAttempts.length);
    }

    if (normalized.startsWith("delete from admin_login_attempts") && normalized.includes("identifier_type = 'account'")) {
      const [accountHash, sessionId] = params;
      if (!this.data.adminSessions.some((entry) => entry.id === sessionId)) return d1Result(0);
      const before = this.data.adminLoginAttempts.length;
      this.data.adminLoginAttempts = this.data.adminLoginAttempts.filter(
        (entry) => !(entry.identifier_type === "account" && entry.identifier_hash === accountHash),
      );
      return d1Result(before - this.data.adminLoginAttempts.length);
    }

    if (normalized.startsWith("delete from admin_login_security_events")) {
      const [now] = params;
      const before = this.data.adminLoginSecurityEvents.length;
      this.data.adminLoginSecurityEvents = this.data.adminLoginSecurityEvents.filter((entry) => entry.expires_at > now);
      return d1Result(before - this.data.adminLoginSecurityEvents.length);
    }

    if (normalized.startsWith("insert into admin_login_security_events")) {
      let event;
      if (normalized.includes("select ?, 'login_success'")) {
        const [id, account_hash, ip_hash, created_at, expires_at, sessionId] = params;
        if (!this.data.adminSessions.some((entry) => entry.id === sessionId)) return d1Result(0);
        event = {
          id,
          event_type: "login_success",
          account_hash,
          ip_hash,
          reason_code: "credentials_valid",
          metadata_json: null,
          created_at,
          expires_at,
        };
      } else if (normalized.includes("'challenge_unavailable'")) {
        const [id, account_hash, ip_hash, reason_code, created_at, expires_at] = params;
        event = {
          id,
          event_type: "challenge_unavailable",
          account_hash,
          ip_hash,
          reason_code,
          metadata_json: null,
          created_at,
          expires_at,
        };
      } else {
        const [id, event_type, account_hash, ip_hash, reason_code, created_at, expires_at] = params;
        event = { id, event_type, account_hash, ip_hash, reason_code, metadata_json: null, created_at, expires_at };
      }
      this.data.adminLoginSecurityEvents.push(event);
      return d1Result(1);
    }

    if (normalized.startsWith("insert into admin_sessions") && normalized.includes("where not exists")) {
      const [id, user_id, token_hash, user_agent_hash, ip_hash, session_type, created_at, expires_at, accountHash, rateIpHash, now] = params;
      const blocked = this.data.adminLoginAttempts.some(
        (entry) =>
          ((entry.identifier_type === "account" && entry.identifier_hash === accountHash) ||
            (entry.identifier_type === "ip" && entry.identifier_hash === rateIpHash)) &&
          entry.locked_until > now,
      );
      if (blocked) return d1Result(0);
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

    if (normalized.startsWith("insert into erp_sessions")) {
      const [id, user_id, hotel_id, token_hash, user_agent_hash, ip_hash, created_at, expires_at] = params;
      this.data.erpSessions.push({
        id,
        user_id,
        hotel_id,
        token_hash,
        user_agent_hash,
        ip_hash,
        created_at,
        expires_at,
        revoked_at: null,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into erp_users")) {
      const [id, hotel_id, user_code, display_name, password_hash, created_at, updated_at] = params;
      if (this.data.erpUsers.some((user) => user.hotel_id === hotel_id && user.user_code === Number(user_code))) {
        throw new Error("UNIQUE constraint failed: erp_users.hotel_id, erp_users.user_code");
      }
      this.data.erpUsers.push({
        id,
        hotel_id,
        user_code: Number(user_code),
        display_name,
        password_hash,
        password_strategy: "pbkdf2",
        status: "active",
        avatar_media_asset_id: null,
        avatar_updated_at: null,
        created_at,
        updated_at,
        archived_at: null,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into service_hours")) {
      const [id, hotel_id, module_key, day_of_week, opens_at, closes_at, is_closed, created_at, updated_at] = params;
      const existing = this.data.serviceHours.find((entry) => entry.hotel_id === hotel_id && entry.module_key === module_key && Number(entry.day_of_week) === Number(day_of_week) && Number(entry.sort_order || 0) === 0);
      const values = {
        id: existing?.id || id,
        hotel_id,
        module_key,
        day_of_week: Number(day_of_week),
        opens_at,
        closes_at,
        is_closed: Number(is_closed),
        sort_order: 0,
        valid_from: null,
        valid_until: null,
        status: "active",
        created_at: existing?.created_at || created_at,
        updated_at,
        archived_at: null,
      };
      if (existing) Object.assign(existing, values);
      else this.data.serviceHours.push(values);
      return d1Result(1);
    }

    if (normalized.startsWith("insert into rooms")) {
      const [id, hotel_id, code, label, room_type, sort_order, created_at, updated_at] = params;
      if (this.data.rooms.some((entry) => entry.hotel_id === hotel_id && entry.code === code)) {
        throw new Error("UNIQUE constraint failed: rooms.hotel_id, rooms.code");
      }
      this.data.rooms.push({ id, hotel_id, code, label, room_type, status: "active", sort_order, created_at, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into categories")) {
      const [id, hotel_id, catalog_id, module_key, name, description, sort_order, created_at, updated_at] = params;
      if (this.data.categories.some((entry) => entry.catalog_id === catalog_id && entry.name === name)) {
        throw new Error("UNIQUE constraint failed: categories.catalog_id, categories.name");
      }
      this.data.categories.push({ id, hotel_id, catalog_id, module_key, name, description, status: "active", sort_order, created_at, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into decoration_categories")) {
      const [id, hotel_id, module_key, category_key, name, description, sort_order, created_at, updated_at] = params;
      if (this.data.decorationCategories.some((entry) =>
        entry.hotel_id === hotel_id && entry.module_key === module_key && entry.category_key === category_key
      )) {
        throw new Error("UNIQUE constraint failed: decoration_categories.hotel_id, decoration_categories.module_key, decoration_categories.category_key");
      }
      this.data.decorationCategories.push({
        id,
        hotel_id,
        module_key,
        category_key,
        name,
        description,
        status: "active",
        sort_order,
        created_at,
        updated_at,
        archived_at: null,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into romantic_packages")) {
      const [
        id,
        hotel_id,
        module_key,
        name,
        description,
        included_items_json,
        price_cents,
        currency,
        status,
        sort_order,
        created_at,
        updated_at,
        archived_at,
        media_asset_id,
        item_type,
        category_id,
      ] = params;
      this.data.romanticPackages.push({
        id,
        hotel_id,
        module_key,
        name,
        description,
        included_items_json,
        price_cents,
        currency,
        status,
        sort_order,
        created_at,
        updated_at,
        archived_at,
        media_asset_id,
        item_type,
        category_id,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert or ignore into catalogs")) {
      const [id, hotel_id, module_key, created_at, updated_at] = params;
      if (!this.data.catalogs.some((entry) => entry.id === id)) {
        this.data.catalogs.push({
          id,
          hotel_id,
          module_key,
          name: "Emporio",
          description: "Catalogo digital da unidade",
          status: "active",
          sort_order: 100,
          created_at,
          updated_at,
          archived_at: null,
        });
      }
      return d1Result(1);
    }

    if (normalized.startsWith("insert into catalog_items")) {
      const [id, public_id, hotel_id, catalog_id, category_id, module_key, name, description, tag, price_cents, currency, image_url, status, sort_order, created_at, updated_at, archived_at, media_asset_id] = params;
      this.data.catalogItems.push({
        id,
        public_id,
        hotel_id,
        catalog_id,
        category_id,
        module_key,
        item_type: "product",
        name,
        description,
        tag,
        price_cents,
        currency,
        image_url,
        status,
        sort_order,
        metadata_json: null,
        created_at,
        updated_at,
        archived_at,
        media_asset_id,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into catalog_item_availability")) {
      const [hotel_id, catalog_item_id, is_available, availability_label, updated_at] = params;
      const existing = this.data.availability.find((entry) => entry.hotel_id === hotel_id && entry.catalog_item_id === catalog_item_id);
      const values = { hotel_id, catalog_item_id, is_available: Number(is_available), availability_label, starts_at: null, ends_at: null, updated_at };
      if (existing) Object.assign(existing, values);
      else this.data.availability.push(values);
      return d1Result(1);
    }

    if (normalized.startsWith("insert into erp_user_permissions")) {
      const [user_id, hotel_id, permission_key, created_at] = params;
      this.data.erpUserPermissions.push({ user_id, hotel_id, permission_key, created_at });
      return d1Result(1);
    }

    if (normalized.startsWith("delete from erp_user_permissions")) {
      const [userId, hotelId] = params;
      this.data.erpUserPermissions = this.data.erpUserPermissions.filter(
        (entry) => entry.user_id !== userId || entry.hotel_id !== hotelId,
      );
      return d1Result(1);
    }

    if (normalized.startsWith("insert into admin_users")) {
      const [id, user_number, display_name, email, password_hash, created_at, updated_at] = params;
      if (this.data.adminUsers.some((user) => user.email.toLowerCase() === String(email).toLowerCase())) {
        throw new Error("UNIQUE constraint failed: admin_users.email");
      }
      this.data.adminUsers.push({
        id,
        user_number,
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

    if (normalized.startsWith("insert into admin_user_preferences")) {
      const [user_id, color_palette, created_at, updated_at] = params;
      const existing = this.data.adminUserPreferences.find((entry) => entry.user_id === user_id);
      if (existing) Object.assign(existing, { color_palette, updated_at });
      else this.data.adminUserPreferences.push({ user_id, color_palette, created_at, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into media_folders")) {
      const [id, hotel_id, parent_id, name, created_by_user_id, updated_by_user_id, created_at, updated_at] = params;
      const duplicate = this.data.mediaFolders.some(
        (entry) =>
          entry.hotel_id === hotel_id &&
          (entry.parent_id || null) === (parent_id || null) &&
          entry.archived_at == null &&
          entry.name.toLowerCase() === String(name).toLowerCase(),
      );
      if (duplicate) throw new Error("UNIQUE constraint failed: media_folders sibling name");
      this.data.mediaFolders.push({
        id,
        hotel_id,
        parent_id,
        name,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at,
        archived_at: null,
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
      const [id, role_number, role_key, name, description, created_at, updated_at] = params;
      if (this.data.adminRoles.some((role) => role.role_key === role_key)) {
        throw new Error("UNIQUE constraint failed: admin_roles.role_key");
      }
      this.data.adminRoles.push({ id, role_number, role_key, name, description, created_at, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into admin_messages")) {
      const [id, sender_user_id, recipient_user_id, subject, body, created_at] = params;
      this.data.adminMessages.push({
        id,
        sender_user_id,
        recipient_user_id,
        subject,
        body,
        created_at,
        read_at: null,
        archived_by_sender_at: null,
        archived_by_recipient_at: null,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into media_assets")) {
      if (this.failNextMediaAssetInsert) {
        this.failNextMediaAssetInsert = false;
        throw new Error("media asset insert failed");
      }
      const hasFolder = normalized.includes("folder_id");
      const values = hasFolder
        ? {
            id: params[0], hotel_id: params[1], module_key: params[2], folder_id: params[3], object_key: params[4],
            public_url: params[5], alt_text: params[6], mime_type: params[7], created_at: params[8], updated_at: params[9],
            original_filename: params[10], size_bytes: params[11], checksum_sha256: params[12], storage_etag: params[13],
            uploaded_by_user_id: params[14], uploaded_by_erp_user_id: null,
          }
        : {
            id: params[0], hotel_id: params[1], module_key: params[2], folder_id: null, object_key: params[3],
            public_url: params[4], alt_text: params[5], mime_type: params[6], created_at: params[7], updated_at: params[8],
            original_filename: params[9], size_bytes: params[10], checksum_sha256: params[11], storage_etag: params[12],
            uploaded_by_user_id: params[13], uploaded_by_erp_user_id: params[14] || null,
          };
      this.data.mediaAssets.push({
        id: values.id,
        hotel_id: values.hotel_id,
        module_key: values.module_key,
        folder_id: values.folder_id,
        storage_provider: "r2",
        object_key: values.object_key,
        public_url: values.public_url,
        alt_text: values.alt_text,
        mime_type: values.mime_type,
        status: "active",
        created_at: values.created_at,
        updated_at: values.updated_at,
        archived_at: null,
        original_filename: values.original_filename,
        size_bytes: values.size_bytes,
        checksum_sha256: values.checksum_sha256,
        storage_etag: values.storage_etag,
        uploaded_by_user_id: values.uploaded_by_user_id,
        uploaded_by_erp_user_id: values.uploaded_by_erp_user_id,
        archived_by_user_id: null,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("insert into custom_portal_pages")) {
      const [
        id,
        hotel_id,
        slug,
        title,
        sanitized_html,
        content_sha256,
        sanitizer_version,
        status,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at,
      ] = params;
      if (this.data.customPortalPages.some((page) => page.hotel_id === hotel_id && page.slug.toLowerCase() === String(slug).toLowerCase())) {
        throw new Error("UNIQUE constraint failed: custom_portal_pages.hotel_id, custom_portal_pages.slug");
      }
      this.data.customPortalPages.push({
        id,
        hotel_id,
        slug,
        title,
        sanitized_html,
        content_sha256,
        sanitizer_version,
        status,
        created_by_user_id,
        updated_by_user_id,
        archived_by_user_id: null,
        created_at,
        updated_at,
        archived_at: null,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("update custom_portal_pages") && normalized.includes("set slug = ?")) {
      const [slug, title, sanitized_html, content_sha256, sanitizer_version, status, updated_by_user_id, updated_at, id, hotel_id] = params;
      const page = this.data.customPortalPages.find(
        (entry) => entry.id === id && entry.hotel_id === hotel_id && entry.status !== "archived",
      );
      if (!page) return d1Result(0);
      Object.assign(page, { slug, title, sanitized_html, content_sha256, sanitizer_version, status, updated_by_user_id, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("update custom_portal_pages") && normalized.includes("set status = 'archived'")) {
      const [archived_by_user_id, archived_at, updated_by_user_id, updated_at, id, hotel_id] = params;
      const page = this.data.customPortalPages.find(
        (entry) => entry.id === id && entry.hotel_id === hotel_id && entry.status !== "archived",
      );
      if (!page) return d1Result(0);
      Object.assign(page, { status: "archived", archived_by_user_id, archived_at, updated_by_user_id, updated_at });
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

    if (normalized.startsWith("insert into short_link_user_shares")) {
      const [short_link_id, user_id, shared_by_user_id, created_at] = params;
      if (this.data.shortLinkUserShares.some((entry) => entry.short_link_id === short_link_id && entry.user_id === user_id)) {
        throw new Error("UNIQUE constraint failed: short_link_user_shares.short_link_id, short_link_user_shares.user_id");
      }
      this.data.shortLinkUserShares.push({ short_link_id, user_id, shared_by_user_id, access_level: "viewer", created_at });
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

    if (normalized.startsWith("insert or ignore into short_link_unique_visitors")) {
      const [short_link_id, hotel_id, visitor_hash, country_code, region, first_clicked_at, last_clicked_at] = params;
      const duplicate = this.data.shortLinkUniqueVisitors.some(
        (entry) => entry.short_link_id === short_link_id && entry.visitor_hash === visitor_hash,
      );
      if (duplicate) return d1Result(0);
      this.data.shortLinkUniqueVisitors.push({ short_link_id, hotel_id, visitor_hash, country_code, region, first_clicked_at, last_clicked_at, click_count: 1 });
      return d1Result(1);
    }

    if (normalized.startsWith("insert or ignore into short_link_click_visitors")) {
      const [short_link_id, hotel_id, click_date, visitor_hash, country_code, region, first_clicked_at, last_clicked_at] = params;
      const duplicate = this.data.shortLinkClickVisitors.some(
        (entry) => entry.short_link_id === short_link_id && entry.click_date === click_date && entry.visitor_hash === visitor_hash,
      );
      if (duplicate) return d1Result(0);
      this.data.shortLinkClickVisitors.push({ short_link_id, hotel_id, click_date, visitor_hash, country_code, region, first_clicked_at, last_clicked_at, click_count: 1 });
      return d1Result(1);
    }

    if (normalized.startsWith("insert or ignore into portal_visit_visitors")) {
      const [hotel_id, page_key, visit_date, visitor_hash, country_code, region, first_visited_at, last_visited_at] = params;
      const duplicate = this.data.portalVisitVisitors.some(
        (entry) => entry.hotel_id === hotel_id && entry.page_key === page_key && entry.visit_date === visit_date && entry.visitor_hash === visitor_hash,
      );
      if (duplicate) return d1Result(0);
      this.data.portalVisitVisitors.push({ hotel_id, page_key, visit_date, visitor_hash, country_code, region, first_visited_at, last_visited_at, visit_count: 1 });
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

    if (normalized.startsWith("update admin_messages") && normalized.includes("set read_at = null")) {
      const [id, recipient_user_id] = params;
      const message = this.data.adminMessages.find(
        (entry) => entry.id === id && entry.recipient_user_id === recipient_user_id && entry.read_at != null,
      );
      if (!message) return d1Result(0);
      message.read_at = null;
      return d1Result(1);
    }

    if (normalized.startsWith("update admin_messages") && normalized.includes("archived_by_sender_at = ?")) {
      const [archived_at, id] = params;
      const message = this.data.adminMessages.find((entry) => entry.id === id && entry.archived_by_sender_at == null);
      if (!message) return d1Result(0);
      message.archived_by_sender_at = archived_at;
      return d1Result(1);
    }

    if (normalized.startsWith("update admin_messages") && normalized.includes("archived_by_recipient_at = ?")) {
      const [archived_at, id] = params;
      const message = this.data.adminMessages.find((entry) => entry.id === id && entry.archived_by_recipient_at == null);
      if (!message) return d1Result(0);
      message.archived_by_recipient_at = archived_at;
      return d1Result(1);
    }

    if (normalized.startsWith("update admin_messages") && normalized.includes("archived_by_sender_at = null")) {
      const [id] = params;
      const message = this.data.adminMessages.find((entry) => entry.id === id && entry.archived_by_sender_at != null);
      if (!message) return d1Result(0);
      message.archived_by_sender_at = null;
      return d1Result(1);
    }

    if (normalized.startsWith("update admin_messages") && normalized.includes("archived_by_recipient_at = null")) {
      const [id] = params;
      const message = this.data.adminMessages.find((entry) => entry.id === id && entry.archived_by_recipient_at != null);
      if (!message) return d1Result(0);
      message.archived_by_recipient_at = null;
      return d1Result(1);
    }

    if (normalized.startsWith("update admin_messages")) {
      const [read_at, id, recipient_user_id] = params;
      const message = this.data.adminMessages.find(
        (entry) => entry.id === id && entry.recipient_user_id === recipient_user_id && entry.read_at == null,
      );
      if (!message) return d1Result(0);
      message.read_at = read_at;
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

    if (normalized.startsWith("update erp_sessions")) {
      const [revokedAt, identifier, maybeHotelId, excludedSessionId] = params;
      let changes = 0;
      for (const session of this.data.erpSessions) {
        const matches = normalized.includes("where token_hash = ?")
          ? session.token_hash === identifier
          : session.user_id === identifier && session.hotel_id === maybeHotelId;
        if (matches && session.revoked_at == null && (!normalized.includes("id <> ?") || session.id !== excludedSessionId)) {
          session.revoked_at = revokedAt;
          changes += 1;
        }
      }
      return d1Result(changes);
    }

    if (normalized.startsWith("update erp_users") && normalized.includes("avatar_media_asset_id = ?")) {
      const [avatar_media_asset_id, avatar_updated_at, updated_at, userId, hotelId] = params;
      const user = this.data.erpUsers.find((entry) => entry.id === userId && entry.hotel_id === hotelId);
      if (!user) return d1Result(0);
      Object.assign(user, { avatar_media_asset_id, avatar_updated_at, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("update erp_users") && normalized.includes("avatar_media_asset_id = null")) {
      const [updated_at, userId, hotelId] = params;
      const user = this.data.erpUsers.find((entry) => entry.id === userId && entry.hotel_id === hotelId);
      if (!user) return d1Result(0);
      Object.assign(user, { avatar_media_asset_id: null, avatar_updated_at: null, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("update erp_users") && normalized.includes("set display_name = ?")) {
      const [displayName, status, updatedAt, userId, hotelId] = params;
      const user = this.data.erpUsers.find((entry) => entry.id === userId && entry.hotel_id === hotelId);
      if (!user) return d1Result(0);
      Object.assign(user, { display_name: displayName, status, updated_at: updatedAt });
      return d1Result(1);
    }

    if (normalized.startsWith("update erp_users") && normalized.includes("set password_hash = ?")) {
      const [passwordHash, updatedAt, userId, hotelId] = params;
      const user = this.data.erpUsers.find((entry) => entry.id === userId && entry.hotel_id === hotelId);
      if (!user) return d1Result(0);
      Object.assign(user, { password_hash: passwordHash, password_strategy: "pbkdf2", updated_at: updatedAt });
      return d1Result(1);
    }

    if (normalized.startsWith("update service_hours") && normalized.includes("sort_order <> 0")) {
      const [archivedAt, updatedAt, hotelId, moduleKey] = params;
      let changes = 0;
      for (const entry of this.data.serviceHours) {
        if (entry.hotel_id === hotelId && entry.module_key === moduleKey && Number(entry.sort_order || 0) !== 0 && entry.status === "active") {
          Object.assign(entry, { status: "archived", archived_at: archivedAt, updated_at: updatedAt });
          changes += 1;
        }
      }
      return d1Result(changes);
    }

    if (normalized.startsWith("update rooms") && normalized.includes("set code = ?")) {
      const [code, label, room_type, status, sort_order, updated_at, roomId, hotelId] = params;
      if (this.data.rooms.some((entry) => entry.hotel_id === hotelId && entry.code === code && entry.id !== roomId)) {
        throw new Error("UNIQUE constraint failed: rooms.hotel_id, rooms.code");
      }
      const room = this.data.rooms.find((entry) => entry.id === roomId && entry.hotel_id === hotelId);
      if (!room) return d1Result(0);
      Object.assign(room, { code, label, room_type, status, sort_order, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("update categories") && normalized.includes("set name = ?")) {
      const [name, description, status, sort_order, updated_at, categoryId, hotelId, moduleKey] = params;
      const category = this.data.categories.find((entry) => entry.id === categoryId && entry.hotel_id === hotelId && (entry.module_key === moduleKey || this.data.catalogs.find((catalogRow) => catalogRow.id === entry.catalog_id)?.module_key === moduleKey));
      if (!category) return d1Result(0);
      Object.assign(category, { name, description, status, sort_order, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("update decoration_categories")) {
      const [name, description, status, sort_order, updated_at, archived_at, categoryId, hotelId, moduleKey] = params;
      const category = this.data.decorationCategories.find(
        (entry) => entry.id === categoryId && entry.hotel_id === hotelId && entry.module_key === moduleKey,
      );
      if (!category) return d1Result(0);
      Object.assign(category, { name, description, status, sort_order, updated_at, archived_at });
      return d1Result(1);
    }

    if (normalized.startsWith("update romantic_packages") && normalized.includes("set category_id = ?")) {
      const [
        category_id,
        name,
        description,
        included_items_json,
        price_cents,
        currency,
        status,
        sort_order,
        media_asset_id,
        item_type,
        updated_at,
        archived_at,
        itemId,
        hotelId,
        moduleKey,
      ] = params;
      const item = this.data.romanticPackages.find(
        (entry) => entry.id === itemId && entry.hotel_id === hotelId && entry.module_key === moduleKey,
      );
      if (!item) return d1Result(0);
      Object.assign(item, {
        category_id,
        name,
        description,
        included_items_json,
        price_cents,
        currency,
        status,
        sort_order,
        media_asset_id,
        item_type,
        updated_at,
        archived_at,
      });
      return d1Result(1);
    }

    if (normalized.startsWith("update catalog_items") && normalized.includes("set category_id = ?")) {
      const [category_id, name, description, tag, price_cents, currency, image_url, status, sort_order, media_asset_id, updated_at, archived_at, itemId, hotelId, moduleKey] = params;
      const item = this.data.catalogItems.find((entry) => entry.id === itemId && entry.hotel_id === hotelId && entry.module_key === moduleKey);
      if (!item) return d1Result(0);
      Object.assign(item, { category_id, name, description, tag, price_cents, currency, image_url, status, sort_order, media_asset_id, updated_at, archived_at });
      return d1Result(1);
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

    if (normalized.startsWith("update admin_users") && normalized.includes("set status = 'archived'")) {
      const [archived_at, updated_at, id] = params;
      const user = this.data.adminUsers.find((entry) => entry.id === id && entry.status !== "archived");
      if (!user) return d1Result(0);
      Object.assign(user, { status: "archived", archived_at, updated_at });
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

    if (normalized.startsWith("delete from admin_roles")) {
      const [role_id] = params;
      const before = this.data.adminRoles.length;
      this.data.adminRoles = this.data.adminRoles.filter((entry) => entry.id !== role_id);
      return d1Result(before - this.data.adminRoles.length);
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
      const hasFolder = normalized.includes("folder_id = ?");
      const [alt_text, module_key] = params;
      const folder_id = hasFolder ? params[2] : null;
      const updated_at = params[hasFolder ? 3 : 2];
      const id = params[hasFolder ? 4 : 3];
      const hotel_id = params[hasFolder ? 5 : 4];
      const asset = this.data.mediaAssets.find(
        (entry) => entry.id === id && entry.hotel_id === hotel_id && entry.status !== "archived",
      );
      if (!asset) return d1Result(0);
      asset.alt_text = alt_text;
      asset.module_key = module_key;
      if (hasFolder) asset.folder_id = folder_id;
      asset.updated_at = updated_at;
      return d1Result(1);
    }

    if (normalized.startsWith("update media_folders") && normalized.includes("set name = ?")) {
      const hasParent = normalized.includes("parent_id = ?");
      const [name] = params;
      const parent_id = hasParent ? params[1] : null;
      const updated_by_user_id = params[hasParent ? 2 : 1];
      const updated_at = params[hasParent ? 3 : 2];
      const id = params[hasParent ? 4 : 3];
      const hotel_id = params[hasParent ? 5 : 4];
      const folder = this.data.mediaFolders.find(
        (entry) => entry.id === id && entry.hotel_id === hotel_id && entry.archived_at == null,
      );
      if (!folder) return d1Result(0);
      const nextParentId = hasParent ? parent_id : folder.parent_id || null;
      const duplicate = this.data.mediaFolders.some(
        (entry) =>
          entry.id !== id &&
          entry.hotel_id === hotel_id &&
          (entry.parent_id || null) === nextParentId &&
          entry.archived_at == null &&
          entry.name.toLowerCase() === String(name).toLowerCase(),
      );
      if (duplicate) throw new Error("UNIQUE constraint failed: media_folders sibling name");
      Object.assign(folder, { name, parent_id: nextParentId, updated_by_user_id, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("update media_folders") && normalized.includes("set archived_at = ?")) {
      const [archived_at, updated_by_user_id, updated_at, id, hotel_id] = params;
      const folder = this.data.mediaFolders.find(
        (entry) => entry.id === id && entry.hotel_id === hotel_id && entry.archived_at == null,
      );
      if (!folder) return d1Result(0);
      Object.assign(folder, { archived_at, updated_by_user_id, updated_at });
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

    if (normalized.startsWith("update short_links") && normalized.includes("analytics_reset_at = ?")) {
      const [analytics_reset_at, analytics_reset_by_user_id, analytics_reset_nonce, updated_by_user_id, updated_at, id, hotel_id] = params;
      const link = this.data.shortLinks.find((entry) => entry.id === id && entry.hotel_id === hotel_id && !entry.analytics_reset_at);
      if (!link) return d1Result(0);
      Object.assign(link, { total_clicks: 0, last_clicked_at: null, analytics_reset_at, analytics_reset_by_user_id, analytics_reset_nonce, updated_by_user_id, updated_at });
      return d1Result(1);
    }

    if (normalized.startsWith("update short_links") && normalized.includes("set last_clicked_at = ?")) {
      const [last_clicked_at, id] = params;
      const link = this.data.shortLinks.find((entry) => entry.id === id);
      if (!link) return d1Result(0);
      link.last_clicked_at = last_clicked_at;
      return d1Result(1);
    }

    if (normalized.startsWith("update short_link_unique_visitors")) {
      const [last_clicked_at, shortLinkId, visitorHash] = params;
      const visitor = this.data.shortLinkUniqueVisitors.find(
        (entry) => entry.short_link_id === shortLinkId && entry.visitor_hash === visitorHash,
      );
      if (!visitor) return d1Result(0);
      visitor.click_count += 1;
      visitor.last_clicked_at = last_clicked_at;
      return d1Result(1);
    }

    if (normalized.startsWith("update short_link_click_visitors")) {
      const [last_clicked_at, shortLinkId, clickDate, visitorHash] = params;
      const visitor = this.data.shortLinkClickVisitors.find(
        (entry) => entry.short_link_id === shortLinkId && entry.click_date === clickDate && entry.visitor_hash === visitorHash,
      );
      if (!visitor) return d1Result(0);
      visitor.click_count += 1;
      visitor.last_clicked_at = last_clicked_at;
      return d1Result(1);
    }

    if (normalized.startsWith("update portal_visit_visitors")) {
      const [last_visited_at, hotelId, pageKey, visitDate, visitorHash] = params;
      const visitor = this.data.portalVisitVisitors.find(
        (entry) => entry.hotel_id === hotelId && entry.page_key === pageKey && entry.visit_date === visitDate && entry.visitor_hash === visitorHash,
      );
      if (!visitor) return d1Result(0);
      visitor.visit_count += 1;
      visitor.last_visited_at = last_visited_at;
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

    if (normalized.startsWith("delete from short_links")) {
      const [id, hotelId] = params;
      const index = this.data.shortLinks.findIndex(
        (entry) => entry.id === id && entry.hotel_id === hotelId && entry.status === "archived",
      );
      if (index === -1) return d1Result(0);
      this.data.shortLinks.splice(index, 1);
      this.data.shortLinkUserShares = this.data.shortLinkUserShares.filter((entry) => entry.short_link_id !== id);
      this.data.shortLinkClicksDaily = this.data.shortLinkClicksDaily.filter((entry) => entry.short_link_id !== id);
      this.data.shortLinkClickVisitors = this.data.shortLinkClickVisitors.filter((entry) => entry.short_link_id !== id);
      this.data.shortLinkUniqueVisitors = this.data.shortLinkUniqueVisitors.filter((entry) => entry.short_link_id !== id);
      return d1Result(1);
    }

    if (normalized.startsWith("delete from short_link_clicks_daily") && normalized.includes("analytics_reset_nonce")) {
      const [shortLinkId, linkId, nonce] = params;
      const allowed = this.data.shortLinks.some((entry) => entry.id === linkId && entry.analytics_reset_nonce === nonce);
      if (!allowed) return d1Result(0);
      const before = this.data.shortLinkClicksDaily.length;
      this.data.shortLinkClicksDaily = this.data.shortLinkClicksDaily.filter((entry) => entry.short_link_id !== shortLinkId);
      return d1Result(before - this.data.shortLinkClicksDaily.length);
    }

    if (normalized.startsWith("delete from short_link_click_visitors") && normalized.includes("analytics_reset_nonce")) {
      const [shortLinkId, linkId, nonce] = params;
      const allowed = this.data.shortLinks.some((entry) => entry.id === linkId && entry.analytics_reset_nonce === nonce);
      if (!allowed) return d1Result(0);
      const before = this.data.shortLinkClickVisitors.length;
      this.data.shortLinkClickVisitors = this.data.shortLinkClickVisitors.filter((entry) => entry.short_link_id !== shortLinkId);
      return d1Result(before - this.data.shortLinkClickVisitors.length);
    }

    if (normalized.startsWith("delete from short_link_unique_visitors") && normalized.includes("analytics_reset_nonce")) {
      const [shortLinkId, linkId, nonce] = params;
      const allowed = this.data.shortLinks.some((entry) => entry.id === linkId && entry.analytics_reset_nonce === nonce);
      if (!allowed) return d1Result(0);
      const before = this.data.shortLinkUniqueVisitors.length;
      this.data.shortLinkUniqueVisitors = this.data.shortLinkUniqueVisitors.filter((entry) => entry.short_link_id !== shortLinkId);
      return d1Result(before - this.data.shortLinkUniqueVisitors.length);
    }

    if (normalized.startsWith("delete from short_link_user_shares")) {
      const [shortLinkId, userId] = params;
      const before = this.data.shortLinkUserShares.length;
      this.data.shortLinkUserShares = this.data.shortLinkUserShares.filter(
        (entry) => entry.short_link_id !== shortLinkId || entry.user_id !== userId,
      );
      return d1Result(before - this.data.shortLinkUserShares.length);
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
      const usesLiteralMetadata = params.length === 6;
      const [id, hotel_id, setting_key, setting_value] = params;
      const value_type = usesLiteralMetadata ? "string" : params[4];
      const is_public = usesLiteralMetadata ? 1 : params[5];
      const created_at = params[usesLiteralMetadata ? 4 : 6];
      const updated_at = params[usesLiteralMetadata ? 5 : 7];
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
          actor_erp_user_id,
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
          actor_erp_user_id,
          action,
          entity_type,
          entity_id: order_id,
          metadata_json,
          created_at,
        });
        return d1Result(1);
      }
      if (normalized.includes("'erp_user'")) {
        const [id, hotel_id, module_key, actor_user_id, actor_erp_user_id, action, entity_id, metadata_json, created_at] = params;
        this.data.adminAuditLog.push({
          id,
          hotel_id,
          module_key,
          actor_user_id,
          actor_erp_user_id,
          action,
          entity_type: "erp_user",
          entity_id,
          metadata_json,
          created_at,
        });
        return d1Result(1);
      }
      if (normalized.includes("'media_asset'")) {
        const hasErpActor = params.length === 9;
        const [id, hotel_id, module_key, actor_user_id] = params;
        const actor_erp_user_id = hasErpActor ? params[4] : null;
        const action = params[hasErpActor ? 5 : 4];
        const entity_id = params[hasErpActor ? 6 : 5];
        const metadata_json = params[hasErpActor ? 7 : 6];
        const created_at = params[hasErpActor ? 8 : 7];
        this.data.adminAuditLog.push({
          id,
          hotel_id,
          module_key,
          actor_user_id,
          actor_erp_user_id,
          action,
          entity_type: "media_asset",
          entity_id,
          metadata_json,
          created_at,
        });
        return d1Result(1);
      }
      if (normalized.includes("'media_folder'")) {
        const [id, hotel_id, actor_user_id, action, entity_id, metadata_json, created_at] = params;
        this.data.adminAuditLog.push({
          id,
          hotel_id,
          module_key: null,
          actor_user_id,
          actor_erp_user_id: null,
          action,
          entity_type: "media_folder",
          entity_id,
          metadata_json,
          created_at,
        });
        return d1Result(1);
      }
      if (normalized.includes("'admin_message'")) {
        const [id, actor_user_id, action, entity_id, metadata_json, created_at] = params;
        this.data.adminAuditLog.push({
          id,
          hotel_id: null,
          module_key: null,
          actor_user_id,
          actor_erp_user_id: null,
          action,
          entity_type: "admin_message",
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
        if (normalized.includes("from short_links sl")) {
          if (normalized.includes("'short-link.analytics-reset'")) {
            const [id, actor_user_id, metadata_json, created_at, entity_id, nonce] = params;
            const link = this.data.shortLinks.find((entry) => entry.id === entity_id && entry.analytics_reset_nonce === nonce);
            if (!link) return d1Result(0);
            this.data.adminAuditLog.push({ id, hotel_id: link.hotel_id, module_key: null, actor_user_id, action: "short-link.analytics-reset", entity_type: "short_link", entity_id, metadata_json, created_at });
            return d1Result(1);
          }
          const [id, actor_user_id, metadata_json, created_at, entity_id, hotel_id] = params;
          const link = this.data.shortLinks.find(
            (entry) => entry.id === entity_id && entry.hotel_id === hotel_id && entry.status === "archived",
          );
          if (!link) return d1Result(0);
          this.data.adminAuditLog.push({
            id,
            hotel_id,
            module_key: null,
            actor_user_id,
            action: "short-link.delete",
            entity_type: "short_link",
            entity_id,
            metadata_json,
            created_at,
          });
          return d1Result(1);
        }
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
      const hasErpActor = params.length === 10;
      const [id, hotel_id, module_key, actor_user_id] = params;
      const actor_erp_user_id = hasErpActor ? params[4] : null;
      const action = params[hasErpActor ? 5 : 4];
      const entity_type = params[hasErpActor ? 6 : 5];
      const entity_id = params[hasErpActor ? 7 : 6];
      const metadata_json = params[hasErpActor ? 8 : 7];
      const created_at = params[hasErpActor ? 9 : 8];
      this.data.adminAuditLog.push({
        id,
        hotel_id,
        module_key,
        actor_user_id,
        actor_erp_user_id,
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

function filterShortLinkAnalytics(rows, { linkId, from, to, regionLike }) {
  const regionSearch = String(regionLike || "").replaceAll("%", "").toLowerCase();
  return rows.filter((entry) =>
    entry.short_link_id === linkId &&
    (!from || (entry.click_date >= from && entry.click_date <= to)) &&
    (!regionSearch || String(entry.region || "").toLowerCase().includes(regionSearch))
  );
}

function filterPortalAnalytics(rows, { hotelId, from, to, regionLike }) {
  const regionSearch = String(regionLike || "").replaceAll("%", "").toLowerCase();
  return rows.filter((entry) =>
    entry.hotel_id === hotelId &&
    (!from || (entry.visit_date >= from && entry.visit_date <= to)) &&
    (!regionSearch || String(entry.region || "").toLowerCase().includes(regionSearch))
  );
}

function groupedAnalytics(rows, keyForRow) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyForRow(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups].map(([key, groupRows]) => ({ key, rows: groupRows }));
}

function sumMetric(rows, key) {
  return rows.reduce((sum, entry) => sum + Number(entry[key] || 0), 0);
}

function minMetric(rows, key) {
  return rows.map((entry) => entry[key]).filter(Boolean).sort()[0] || null;
}

function maxMetric(rows, key) {
  return rows.map((entry) => entry[key]).filter(Boolean).sort().at(-1) || null;
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
