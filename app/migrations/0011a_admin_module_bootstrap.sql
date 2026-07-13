PRAGMA foreign_keys = ON;

-- Garante a referencia usada pelas permissoes administrativas em bancos vazios.
INSERT OR IGNORE INTO modules (
  module_key, name, description, status, created_at, updated_at
) VALUES (
  'admin',
  'ERP Administrativo',
  'Nucleo administrativo compartilhado da plataforma.',
  'foundation',
  '2026-07-13T00:00:00.000Z',
  '2026-07-13T00:00:00.000Z'
);
