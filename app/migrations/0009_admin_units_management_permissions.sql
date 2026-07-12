PRAGMA foreign_keys = ON;

INSERT INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at)
SELECT 'perm-portals-hotels-read', 'portals.hotels.read', NULL,
       'Visualizar unidades na Central de Portais.',
       '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE permission_key = 'portals.hotels.read'
);

INSERT INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at)
SELECT 'perm-portals-hotels-create', 'portals.hotels.create', NULL,
       'Criar novas unidades na Central de Portais.',
       '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE permission_key = 'portals.hotels.create'
);

INSERT INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at)
SELECT 'perm-portals-hotels-update', 'portals.hotels.update', NULL,
       'Editar dados gerais das unidades.',
       '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE permission_key = 'portals.hotels.update'
);

INSERT INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at)
SELECT 'perm-portals-hotels-branding', 'portals.hotels.branding', NULL,
       'Editar identidade visual das unidades.',
       '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE permission_key = 'portals.hotels.branding'
);

INSERT INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at)
SELECT 'perm-portals-hotels-settings', 'portals.hotels.settings', NULL,
       'Editar configuracoes publicas e operacionais das unidades.',
       '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE permission_key = 'portals.hotels.settings'
);

INSERT INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at)
SELECT 'perm-portals-hotels-modules', 'portals.hotels.modules', NULL,
       'Habilitar e desabilitar modulos por unidade.',
       '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE permission_key = 'portals.hotels.modules'
);

INSERT INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at)
SELECT 'perm-portals-hotels-navigation', 'portals.hotels.navigation', NULL,
       'Gerenciar navegacao publica das unidades.',
       '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE permission_key = 'portals.hotels.navigation'
);
