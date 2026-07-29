PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS decoration_categories (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL DEFAULT 'romantic-packages' REFERENCES modules(module_key) ON DELETE RESTRICT,
  category_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  UNIQUE (hotel_id, module_key, category_key)
);

CREATE INDEX IF NOT EXISTS idx_decoration_categories_hotel_module_status
  ON decoration_categories(hotel_id, module_key, status, sort_order);

ALTER TABLE romantic_packages
  ADD COLUMN category_id TEXT REFERENCES decoration_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_romantic_packages_hotel_category_status
  ON romantic_packages(hotel_id, category_id, status, sort_order);

UPDATE modules
   SET name = 'Decorações Especiais',
       description = 'Catálogo de decorações, experiências e adicionais organizados por categoria.',
       status = 'active',
       updated_at = '2026-07-29T13:30:00.000Z'
 WHERE module_key = 'romantic-packages';

UPDATE hotel_modules
   SET public_name = 'Decorações Especiais',
       navigation_label = 'Decorações Especiais',
       updated_at = '2026-07-29T13:30:00.000Z'
 WHERE hotel_id = 'fiorezecentro'
   AND module_key = 'romantic-packages';

UPDATE hotel_settings
   SET setting_value = 'Decorações e experiências preparadas para transformar momentos especiais em lembranças inesquecíveis.',
       updated_at = '2026-07-29T13:30:00.000Z'
 WHERE hotel_id = 'fiorezecentro'
   AND setting_key = 'portal.module.romantic-packages.description';

INSERT INTO decoration_categories (
  id, hotel_id, module_key, category_key, name, description, status,
  sort_order, created_at, updated_at, archived_at
) SELECT
  'decoration-category-fiorezecentro-romantic-surprises',
  'fiorezecentro',
  'romantic-packages',
  'romantic-surprises',
  'Surpresas Românticas',
  'Experiências para celebrar momentos especiais a dois.',
  'active',
  10,
  '2026-07-29T13:30:00.000Z',
  '2026-07-29T13:30:00.000Z',
  NULL
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro')
ON CONFLICT(hotel_id, module_key, category_key) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at,
  archived_at = NULL;

UPDATE romantic_packages
   SET category_id = 'decoration-category-fiorezecentro-romantic-surprises',
       updated_at = '2026-07-29T13:30:00.000Z'
 WHERE hotel_id = 'fiorezecentro'
   AND module_key = 'romantic-packages';
