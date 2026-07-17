PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS custom_portal_pages (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  sanitized_html TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  sanitizer_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  updated_by_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  archived_by_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  CHECK (length(slug) BETWEEN 2 AND 100),
  CHECK (length(sanitized_html) BETWEEN 1 AND 250000),
  UNIQUE (hotel_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_custom_portal_pages_hotel_status
  ON custom_portal_pages(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_custom_portal_pages_hotel_updated
  ON custom_portal_pages(hotel_id, updated_at);

INSERT OR IGNORE INTO admin_permissions (
  id, permission_key, module_key, description, created_at, updated_at
) VALUES (
  'perm-portals-links-delete',
  'portals.links.delete',
  NULL,
  'Excluir definitivamente links personalizados arquivados',
  '2026-07-17T00:00:00.000Z',
  '2026-07-17T00:00:00.000Z'
);

INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id, created_at)
SELECT 'role-demo-manager', id, '2026-07-17T00:00:00.000Z'
  FROM admin_permissions
 WHERE permission_key = 'portals.links.delete'
   AND EXISTS (SELECT 1 FROM admin_roles WHERE id = 'role-demo-manager');
