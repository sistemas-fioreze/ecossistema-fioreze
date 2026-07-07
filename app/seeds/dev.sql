PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO modules (module_key, name, description, status, created_at, updated_at) VALUES
  ('guest-portal', 'Portal do Hospede', 'Shell publico compartilhado para experiencias do hospede.', 'foundation', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('room-service', 'Room Service', 'Pedidos de alimentos e bebidas por hotel.', 'foundation', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('emporio', 'Emporio', 'Catalogo e pedidos do emporio.', 'planned', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('spa', 'Spa', 'Servicos, solicitacoes e agenda do spa.', 'planned', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('romantic-packages', 'Pacotes Romanticos', 'Catalogo futuro de experiencias romanticas.', 'planned', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('admin', 'ERP Administrativo', 'ERP unificado protegido por autenticacao.', 'foundation', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO hotels (id, slug, name, short_name, timezone, locale, currency, status, created_at, updated_at) VALUES
  ('muller-fioreze', 'muller-fioreze', 'Muller & Fioreze Demo', 'Muller Demo', 'America/Sao_Paulo', 'pt-BR', 'BRL', 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('aurora-demo', 'aurora-demo', 'Aurora Vale Hotel Demo', 'Aurora Demo', 'America/Sao_Paulo', 'pt-BR', 'BRL', 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO hotel_branding (hotel_id, logo_url, icon_url, primary_color, secondary_color, accent_color, background_color, text_color, font_family, updated_at) VALUES
  ('muller-fioreze', '/assets/hotels/muller-fioreze/logo.png', '/assets/hotels/muller-fioreze/logo-ff.png', '#513b2d', '#f4f1ef', '#c1a94c', '#fbf8f4', '#202124', 'Inter, system-ui, sans-serif', '2026-07-04T00:00:00.000Z'),
  ('aurora-demo', NULL, NULL, '#17494d', '#e7f3f1', '#b78338', '#f7fbfa', '#162527', 'Inter, system-ui, sans-serif', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO hotel_settings (id, hotel_id, setting_key, setting_value, value_type, is_public, created_at, updated_at) VALUES
  ('set-muller-rs-status', 'muller-fioreze', 'room_service.status', 'open', 'string', 1, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('set-muller-impression', 'muller-fioreze', 'room_service.impression_enabled', 'false', 'boolean', 0, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('set-aurora-rs-status', 'aurora-demo', 'room_service.status', 'open', 'string', 1, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO hotel_modules (hotel_id, module_key, enabled, is_public, public_name, navigation_label, sort_order, settings_json, created_at, updated_at) VALUES
  ('muller-fioreze', 'guest-portal', 1, 1, 'Portal', 'Inicio', 10, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('muller-fioreze', 'room-service', 1, 1, 'Room Service', 'Room Service', 20, '{"requires_room":true}', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('muller-fioreze', 'emporio', 0, 1, 'Emporio', 'Emporio', 30, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('muller-fioreze', 'spa', 0, 1, 'Spa', 'Spa', 40, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('muller-fioreze', 'romantic-packages', 0, 1, 'Pacotes Romanticos', 'Pacotes', 50, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('muller-fioreze', 'admin', 1, 0, 'ERP', 'ERP', 90, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('aurora-demo', 'guest-portal', 1, 1, 'Portal Aurora', 'Inicio', 10, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('aurora-demo', 'room-service', 1, 1, 'Cafe no Quarto', 'Cafe no Quarto', 20, '{"requires_room":true}', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('aurora-demo', 'emporio', 1, 1, 'Loja Demo', 'Loja', 30, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('aurora-demo', 'spa', 0, 1, 'Spa Aurora', 'Spa', 40, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('aurora-demo', 'admin', 1, 0, 'ERP', 'ERP', 90, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO service_hours (id, hotel_id, module_key, day_of_week, opens_at, closes_at, is_closed, sort_order, status, created_at, updated_at) VALUES
  ('hours-muller-rs-0', 'muller-fioreze', 'room-service', 0, '16:00', '22:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-muller-rs-1', 'muller-fioreze', 'room-service', 1, '16:00', '22:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-muller-rs-2', 'muller-fioreze', 'room-service', 2, '16:00', '22:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-muller-rs-3', 'muller-fioreze', 'room-service', 3, '16:00', '22:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-muller-rs-4', 'muller-fioreze', 'room-service', 4, '16:00', '22:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-muller-rs-5', 'muller-fioreze', 'room-service', 5, '16:00', '22:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-muller-rs-6', 'muller-fioreze', 'room-service', 6, '16:00', '22:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-aurora-rs-0', 'aurora-demo', 'room-service', 0, '15:00', '21:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-aurora-rs-1', 'aurora-demo', 'room-service', 1, '15:00', '21:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-aurora-rs-2', 'aurora-demo', 'room-service', 2, '15:00', '21:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-aurora-rs-3', 'aurora-demo', 'room-service', 3, '15:00', '21:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-aurora-rs-4', 'aurora-demo', 'room-service', 4, '15:00', '21:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-aurora-rs-5', 'aurora-demo', 'room-service', 5, '15:00', '21:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('hours-aurora-rs-6', 'aurora-demo', 'room-service', 6, '15:00', '21:00', 0, 10, 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO media_assets (id, hotel_id, module_key, storage_provider, object_key, public_url, alt_text, mime_type, status, created_at, updated_at) VALUES
  ('media-muller-logo', 'muller-fioreze', 'guest-portal', 'static', 'hotels/muller-fioreze/logo.png', '/assets/hotels/muller-fioreze/logo.png', 'Logo demo do hotel Muller e Fioreze', 'image/png', 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('media-muller-icon', 'muller-fioreze', 'guest-portal', 'static', 'hotels/muller-fioreze/logo-ff.png', '/assets/hotels/muller-fioreze/logo-ff.png', 'Icone demo do hotel Muller e Fioreze', 'image/png', 'active', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO navigation_items (id, hotel_id, module_key, label, path, icon_key, sort_order, is_public, enabled, created_at, updated_at) VALUES
  ('nav-muller-home', 'muller-fioreze', 'guest-portal', 'Inicio', '/muller-fioreze', 'home', 10, 1, 1, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('nav-muller-rs', 'muller-fioreze', 'room-service', 'Room Service', '/muller-fioreze/room-service', 'tray', 20, 1, 1, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('nav-aurora-home', 'aurora-demo', 'guest-portal', 'Inicio', '/aurora-demo', 'home', 10, 1, 1, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('nav-aurora-rs', 'aurora-demo', 'room-service', 'Cafe no Quarto', '/aurora-demo/room-service', 'tray', 20, 1, 1, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('nav-aurora-emporio', 'aurora-demo', 'emporio', 'Loja', '/aurora-demo/emporio', 'bag', 30, 1, 1, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO features (feature_key, module_key, description, status, is_public, default_config_json, created_at, updated_at) VALUES
  ('room-service.order-notes', 'room-service', 'Permite observacoes no pedido.', 'active', 1, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('room-service.order-filters-v2', 'room-service', 'Filtros futuros de pedidos no ERP.', 'active', 0, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('portal.events-preview', 'guest-portal', 'Exibe eventos publicos no portal.', 'active', 1, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO hotel_features (hotel_id, feature_key, enabled, config_json, created_at, updated_at) VALUES
  ('muller-fioreze', 'room-service.order-notes', 1, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('muller-fioreze', 'room-service.order-filters-v2', 0, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('muller-fioreze', 'portal.events-preview', 1, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('aurora-demo', 'room-service.order-notes', 0, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('aurora-demo', 'portal.events-preview', 1, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO rooms (id, hotel_id, code, label, room_type, status, sort_order, created_at, updated_at) VALUES
  ('room-muller-demo-101', 'muller-fioreze', 'D-101', 'Suite demo 101', 'suite-demo', 'active', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('room-muller-demo-102', 'muller-fioreze', 'D-102', 'Suite demo 102', 'suite-demo', 'active', 20, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('room-aurora-demo-201', 'aurora-demo', 'A-201', 'Acomodacao demo 201', 'standard-demo', 'active', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO catalogs (id, hotel_id, module_key, name, description, status, sort_order, created_at, updated_at) VALUES
  ('cat-muller-room-service', 'muller-fioreze', 'room-service', 'Cardapio Room Service Demo', 'Catalogo ficticio local.', 'active', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('cat-muller-emporio', 'muller-fioreze', 'emporio', 'Emporio Demo', 'Catalogo futuro desabilitado.', 'active', 20, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('cat-aurora-room-service', 'aurora-demo', 'room-service', 'Cafe no Quarto Demo', 'Catalogo ficticio do hotel inventado.', 'active', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO categories (id, hotel_id, catalog_id, module_key, name, description, status, sort_order, created_at, updated_at) VALUES
  ('catg-muller-bebidas', 'muller-fioreze', 'cat-muller-room-service', 'room-service', 'Bebidas demo', 'Bebidas ficticias.', 'active', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('catg-muller-lanches', 'muller-fioreze', 'cat-muller-room-service', 'room-service', 'Lanches demo', 'Lanches ficticios.', 'active', 20, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('catg-muller-emporio', 'muller-fioreze', 'cat-muller-emporio', 'emporio', 'Presentes demo', 'Itens ficticios do emporio.', 'active', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('catg-aurora-cafe', 'aurora-demo', 'cat-aurora-room-service', 'room-service', 'Cafe demo', 'Itens ficticios do segundo hotel.', 'active', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO catalog_items (id, public_id, hotel_id, catalog_id, category_id, module_key, item_type, name, description, price_cents, currency, image_url, status, sort_order, metadata_json, created_at, updated_at) VALUES
  ('item-muller-cafe-demo', 'pub-muller-cafe-demo', 'muller-fioreze', 'cat-muller-room-service', 'catg-muller-bebidas', 'room-service', 'product', 'Cafe demo', 'Bebida ficticia para teste local.', 900, 'BRL', NULL, 'active', 10, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('item-muller-sanduiche-demo', 'pub-muller-sanduiche-demo', 'muller-fioreze', 'cat-muller-room-service', 'catg-muller-lanches', 'room-service', 'product', 'Sanduiche demo', 'Lanche ficticio para teste local.', 2500, 'BRL', NULL, 'active', 20, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('item-muller-indisponivel-demo', 'pub-muller-indisponivel-demo', 'muller-fioreze', 'cat-muller-room-service', 'catg-muller-lanches', 'room-service', 'product', 'Produto indisponivel demo', 'Item usado em teste de disponibilidade.', 1800, 'BRL', NULL, 'active', 30, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('item-muller-arquivado-demo', 'pub-muller-arquivado-demo', 'muller-fioreze', 'cat-muller-room-service', 'catg-muller-lanches', 'room-service', 'product', 'Produto arquivado demo', 'Item usado em teste de arquivamento.', 1200, 'BRL', NULL, 'archived', 40, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('item-muller-emporio-demo', 'pub-muller-emporio-demo', 'muller-fioreze', 'cat-muller-emporio', 'catg-muller-emporio', 'emporio', 'product', 'Presente demo', 'Item ficticio de outro modulo.', 3300, 'BRL', NULL, 'active', 10, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('item-aurora-cafe-demo', 'pub-aurora-cafe-demo', 'aurora-demo', 'cat-aurora-room-service', 'catg-aurora-cafe', 'room-service', 'product', 'Cafe Aurora demo', 'Item ficticio de outro hotel.', 1100, 'BRL', NULL, 'active', 10, NULL, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO catalog_item_availability (hotel_id, catalog_item_id, is_available, availability_label, updated_at) VALUES
  ('muller-fioreze', 'item-muller-cafe-demo', 1, NULL, '2026-07-04T00:00:00.000Z'),
  ('muller-fioreze', 'item-muller-sanduiche-demo', 1, NULL, '2026-07-04T00:00:00.000Z'),
  ('muller-fioreze', 'item-muller-indisponivel-demo', 0, 'Indisponivel no teste local', '2026-07-04T00:00:00.000Z'),
  ('muller-fioreze', 'item-muller-arquivado-demo', 1, NULL, '2026-07-04T00:00:00.000Z'),
  ('muller-fioreze', 'item-muller-emporio-demo', 1, NULL, '2026-07-04T00:00:00.000Z'),
  ('aurora-demo', 'item-aurora-cafe-demo', 1, NULL, '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO portal_pages (id, hotel_id, module_key, slug, title, summary, status, sort_order, created_at, updated_at) VALUES
  ('page-muller-home', 'muller-fioreze', 'guest-portal', 'inicio', 'Boas-vindas demo', 'Conteudo ficticio do portal.', 'published', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('page-aurora-home', 'aurora-demo', 'guest-portal', 'inicio', 'Aurora demo', 'Conteudo ficticio do segundo hotel.', 'published', 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO events (id, hotel_id, title, summary, starts_at, ends_at, timezone, status, created_at, updated_at) VALUES
  ('event-muller-demo', 'muller-fioreze', 'Evento demo', 'Evento ficticio para validar portal.', '2026-08-01T18:00:00.000Z', '2026-08-01T20:00:00.000Z', 'America/Sao_Paulo', 'published', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('event-aurora-demo', 'aurora-demo', 'Experiencia demo', 'Evento ficticio do segundo hotel.', '2026-08-02T18:00:00.000Z', '2026-08-02T20:00:00.000Z', 'America/Sao_Paulo', 'published', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO hotel_information (id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at) VALUES
  ('info-muller-checkout', 'muller-fioreze', 'checkout-demo', 'Informacao demo', 'Texto ficticio sem dado operacional real.', 1, 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('info-aurora-checkout', 'aurora-demo', 'checkout-demo', 'Informacao Aurora demo', 'Texto ficticio do segundo hotel.', 1, 10, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO admin_roles (id, role_key, name, description, created_at, updated_at) VALUES
  ('role-demo-manager', 'demo-manager', 'Gerente demo', 'Role ficticia sem acesso real.', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at) VALUES
  ('perm-room-service-orders-read', 'room-service.orders.read', 'room-service', 'Permite visualizar pedidos ficticios de Room Service.', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z'),
  ('perm-room-service-orders-write', 'room-service.orders.write', 'room-service', 'Permite atualizar status de pedidos ficticios de Room Service.', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT INTO admin_users (id, display_name, email, password_hash, password_strategy, status, force_password_change, created_at, updated_at) VALUES
  ('user-demo-admin', 'Usuario Admin Demo', 'admin-demo@example.invalid', 'pbkdf2$sha256$100000$ZmlvcmV6ZS1hZG1pbi1kZW1vLXNhbHQtMjAyNg==$QPM6b/QnKHhfCwYXFU9kCd7KpgtlsLdGDELeiM9Ulgw=', 'pbkdf2', 'active', 0, '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z')
ON CONFLICT(id) DO UPDATE SET
  display_name = excluded.display_name,
  email = excluded.email,
  password_hash = excluded.password_hash,
  password_strategy = excluded.password_strategy,
  status = excluded.status,
  force_password_change = excluded.force_password_change,
  updated_at = excluded.updated_at;

INSERT OR IGNORE INTO admin_user_roles (user_id, role_id, created_at) VALUES
  ('user-demo-admin', 'role-demo-manager', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id, created_at) VALUES
  ('role-demo-manager', 'perm-room-service-orders-read', '2026-07-04T00:00:00.000Z'),
  ('role-demo-manager', 'perm-room-service-orders-write', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO admin_hotel_access (user_id, hotel_id, access_level, created_at, updated_at) VALUES
  ('user-demo-admin', 'muller-fioreze', 'manager', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO orders (id, public_id, hotel_id, module_key, origin, room_id, room_code, guest_name, notes, currency, subtotal_cents, discount_cents, total_cents, status, idempotency_key, created_at, updated_at) VALUES
  ('order-demo-muller-001', 'rs_demo_muller_001', 'muller-fioreze', 'room-service', 'seed-local', 'room-muller-demo-101', 'D-101', 'Hospede Demo', 'Pedido ficticio local.', 'BRL', 900, 0, 900, 'received', 'seed-demo-order-001', '2026-07-04T00:00:00.000Z', '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO order_items (id, order_id, hotel_id, module_key, catalog_item_id, item_name_snapshot, item_description_snapshot, unit_price_cents, quantity, line_total_cents, selected_options_snapshot, created_at) VALUES
  ('order-item-demo-muller-001', 'order-demo-muller-001', 'muller-fioreze', 'room-service', 'item-muller-cafe-demo', 'Cafe demo', 'Bebida ficticia para teste local.', 900, 1, 900, NULL, '2026-07-04T00:00:00.000Z');

INSERT OR IGNORE INTO order_status_history (id, order_id, hotel_id, module_key, status, note, actor_user_id, created_at) VALUES
  ('order-hist-demo-muller-001', 'order-demo-muller-001', 'muller-fioreze', 'room-service', 'received', 'Seed ficticio local.', NULL, '2026-07-04T00:00:00.000Z');
