PRAGMA foreign_keys = ON;

ALTER TABLE romantic_packages
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'package'
    CHECK (item_type IN ('package', 'add-on'));

UPDATE modules
   SET name = 'Pacotes Românticos',
       description = 'Catálogo de experiências e adicionais românticos por unidade.',
       status = 'active',
       updated_at = '2026-07-29T00:00:00.000Z'
 WHERE module_key = 'romantic-packages';

UPDATE hotel_modules
   SET enabled = 1,
       is_public = 1,
       public_name = 'Surpresas Românticas',
       navigation_label = 'Surpresas Românticas',
       updated_at = '2026-07-29T00:00:00.000Z'
 WHERE hotel_id = 'fiorezecentro'
   AND module_key = 'romantic-packages';

INSERT INTO hotel_settings (
  id, hotel_id, setting_key, setting_value, value_type, is_public,
  created_at, updated_at
) SELECT
  'set-fiorezecentro-romantic-description',
  'fiorezecentro',
  'portal.module.romantic-packages.description',
  'Experiências preparadas para transformar momentos especiais em lembranças inesquecíveis.',
  'string',
  1,
  '2026-07-29T00:00:00.000Z',
  '2026-07-29T00:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro')
ON CONFLICT(hotel_id, setting_key) DO UPDATE SET
  setting_value = excluded.setting_value,
  value_type = excluded.value_type,
  is_public = excluded.is_public,
  updated_at = excluded.updated_at;

INSERT OR IGNORE INTO media_folders (
  id, hotel_id, parent_id, name, created_by_user_id, updated_by_user_id,
  created_at, updated_at, archived_at
) SELECT
  'folder-fiorezecentro-portal',
  'fiorezecentro',
  NULL,
  'Portal',
  NULL,
  NULL,
  '2026-07-29T00:00:00.000Z',
  '2026-07-29T00:00:00.000Z',
  NULL
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro');

INSERT OR IGNORE INTO media_folders (
  id, hotel_id, parent_id, name, created_by_user_id, updated_by_user_id,
  created_at, updated_at, archived_at
) SELECT
  'folder-fiorezecentro-portal-romantico',
  'fiorezecentro',
  'folder-fiorezecentro-portal',
  'Romântico',
  NULL,
  NULL,
  '2026-07-29T00:00:00.000Z',
  '2026-07-29T00:00:00.000Z',
  NULL
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro');

WITH source (
  id, hotel_id, module_key, folder_id, storage_provider, object_key,
  public_url, alt_text, mime_type, status, created_at, updated_at,
  archived_at, original_filename, size_bytes, checksum_sha256,
  storage_etag, uploaded_by_user_id, archived_by_user_id
) AS (
  VALUES
  (
    'media-fiorezecentro-romantic-amore',
    'fiorezecentro',
    'romantic-packages',
    'folder-fiorezecentro-portal-romantico',
    'r2',
    'hotels/fiorezecentro/portal/romantico/surpresa-amore.jpg',
    '/media/media-fiorezecentro-romantic-amore',
    'Surpresa Amore com chocolate e espumante',
    'image/jpeg',
    'active',
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    'surpresa-amore.jpg',
    119744,
    'dbbb534f132be33b34a7063f401486f9d8cee087a39298b62125abdfa7f13c9f',
    NULL,
    NULL,
    NULL
  ),
  (
    'media-fiorezecentro-romantic-cupido',
    'fiorezecentro',
    'romantic-packages',
    'folder-fiorezecentro-portal-romantico',
    'r2',
    'hotels/fiorezecentro/portal/romantico/surpresa-cupido.jpg',
    '/media/media-fiorezecentro-romantic-cupido',
    'Surpresa Cupido com rosas, chocolate e espumante',
    'image/jpeg',
    'active',
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    'surpresa-cupido.jpg',
    118586,
    'b62a096b032b49361d6b7728332fa322c08e6b904f87717af8440c31bf78153e',
    NULL,
    NULL,
    NULL
  ),
  (
    'media-fiorezecentro-romantic-conquistare',
    'fiorezecentro',
    'romantic-packages',
    'folder-fiorezecentro-portal-romantico',
    'r2',
    'hotels/fiorezecentro/portal/romantico/surpresa-conquistare.jpg',
    '/media/media-fiorezecentro-romantic-conquistare',
    'Surpresa Conquistare com buquê de rosas, chocolate e espumante',
    'image/jpeg',
    'active',
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    'surpresa-conquistare.jpg',
    195595,
    'cdcd35016e7afea573ffd6b12c19be1dd7cc08f8efe3ad0ae2a304c1d8ece083',
    NULL,
    NULL,
    NULL
  ),
  (
    'media-fiorezecentro-romantic-perfetta',
    'fiorezecentro',
    'romantic-packages',
    'folder-fiorezecentro-portal-romantico',
    'r2',
    'hotels/fiorezecentro/portal/romantico/surpresa-perfetta.jpg',
    '/media/media-fiorezecentro-romantic-perfetta',
    'Surpresa Perfetta com rosas colombianas, pétalas, chocolate e Chandon',
    'image/jpeg',
    'active',
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    'surpresa-perfetta.jpg',
    103781,
    'ac90e73d58bfd57f20cfd0ba1847719587e1b71742cfc3053c7c7327ad96ca43',
    NULL,
    NULL,
    NULL
  )
)
INSERT OR IGNORE INTO media_assets (
  id, hotel_id, module_key, folder_id, storage_provider, object_key,
  public_url, alt_text, mime_type, status, created_at, updated_at,
  archived_at, original_filename, size_bytes, checksum_sha256,
  storage_etag, uploaded_by_user_id, archived_by_user_id
)
SELECT *
  FROM source
 WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro');

WITH source (
  id, hotel_id, module_key, name, description, included_items_json,
  price_cents, currency, status, sort_order, created_at, updated_at,
  archived_at, media_asset_id, item_type
) AS (
  VALUES
  (
    'romantic-fiorezecentro-amore',
    'fiorezecentro',
    'romantic-packages',
    'Surpresa Amore',
    'Chocolate Prawer e Espumante Jolimont.',
    '["Chocolate Prawer","Espumante Jolimont"]',
    15700,
    'BRL',
    'active',
    10,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    'media-fiorezecentro-romantic-amore',
    'package'
  ),
  (
    'romantic-fiorezecentro-cupido',
    'fiorezecentro',
    'romantic-packages',
    'Surpresa Cupido',
    'Buquê de 04 Rosas Nacionais, Chocolate Prawer e Espumante Jolimont.',
    '["Buquê de 04 Rosas Nacionais","Chocolate Prawer","Espumante Jolimont"]',
    28700,
    'BRL',
    'active',
    20,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    'media-fiorezecentro-romantic-cupido',
    'package'
  ),
  (
    'romantic-fiorezecentro-conquistare',
    'fiorezecentro',
    'romantic-packages',
    'Surpresa Conquistare',
    'Buquê de 10 Rosas Nacionais, Chocolate Prawer e Espumante Jolimont.',
    '["Buquê de 10 Rosas Nacionais","Chocolate Prawer","Espumante Jolimont"]',
    49700,
    'BRL',
    'active',
    30,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    'media-fiorezecentro-romantic-conquistare',
    'package'
  ),
  (
    'romantic-fiorezecentro-perfetta',
    'fiorezecentro',
    'romantic-packages',
    'Surpresa Perfetta',
    'Buquê de 06 Rosas Colombianas, Pétalas de Rosas, Chocolate Prawer e Chandon.',
    '["Buquê de 06 Rosas Colombianas","Pétalas de Rosas","Chocolate Prawer","Chandon"]',
    72700,
    'BRL',
    'active',
    40,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    'media-fiorezecentro-romantic-perfetta',
    'package'
  ),
  (
    'romantic-fiorezecentro-declaracao',
    'fiorezecentro',
    'romantic-packages',
    'Declaração Personalizada',
    'Escolha uma mensagem especial: Te amo, Quer namorar comigo? ou Quer casar comigo?',
    '["Mensagem personalizada"]',
    12900,
    'BRL',
    'active',
    110,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-balao',
    'fiorezecentro',
    'romantic-packages',
    'Balão personalizado',
    'Uma unidade personalizada para complementar a surpresa.',
    '[]',
    15000,
    'BRL',
    'active',
    120,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-toalhas',
    'fiorezecentro',
    'romantic-packages',
    '02 Toalhas bordadas',
    'Duas toalhas bordadas para guardar como lembrança.',
    '[]',
    22000,
    'BRL',
    'active',
    130,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-petalas',
    'fiorezecentro',
    'romantic-packages',
    'Pétalas',
    'Pétalas para compor a ambientação romântica.',
    '[]',
    11000,
    'BRL',
    'active',
    140,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-flores-campo',
    'fiorezecentro',
    'romantic-packages',
    'Buquê de Flores do Campo',
    'Buquê de flores do campo.',
    '[]',
    27000,
    'BRL',
    'active',
    150,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-rosas-nacionais-04',
    'fiorezecentro',
    'romantic-packages',
    'Buquê de Rosas Nacionais',
    'Buquê com 04 rosas nacionais.',
    '[]',
    14000,
    'BRL',
    'active',
    160,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-rosas-nacionais-10',
    'fiorezecentro',
    'romantic-packages',
    'Buquê de Rosas Nacionais',
    'Buquê com 10 rosas nacionais.',
    '[]',
    33000,
    'BRL',
    'active',
    170,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-rosas-colombianas-06',
    'fiorezecentro',
    'romantic-packages',
    'Buquê de Rosas Colombianas',
    'Buquê com 06 rosas colombianas.',
    '[]',
    30000,
    'BRL',
    'active',
    180,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-rosas-colombianas-12',
    'fiorezecentro',
    'romantic-packages',
    'Buquê de Rosas Colombianas',
    'Buquê com 12 rosas colombianas.',
    '[]',
    67000,
    'BRL',
    'active',
    190,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-piquenique-02',
    'fiorezecentro',
    'romantic-packages',
    'Cesta de Piquenique',
    'Cesta de piquenique para 2 pessoas.',
    '[]',
    22000,
    'BRL',
    'active',
    200,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-piquenique-04',
    'fiorezecentro',
    'romantic-packages',
    'Cesta de Piquenique',
    'Cesta de piquenique para 4 pessoas.',
    '[]',
    27000,
    'BRL',
    'active',
    210,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-chandon-brut',
    'fiorezecentro',
    'romantic-packages',
    'Chandon Brut',
    'Uma garrafa de Chandon Brut.',
    '[]',
    18000,
    'BRL',
    'active',
    220,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  ),
  (
    'romantic-fiorezecentro-jolimont',
    'fiorezecentro',
    'romantic-packages',
    'Espumante Jolimont',
    'Escolha entre Brut ou Moscatel.',
    '[]',
    11000,
    'BRL',
    'active',
    230,
    '2026-07-29T00:00:00.000Z',
    '2026-07-29T00:00:00.000Z',
    NULL,
    NULL,
    'add-on'
  )
)
INSERT OR IGNORE INTO romantic_packages (
  id, hotel_id, module_key, name, description, included_items_json,
  price_cents, currency, status, sort_order, created_at, updated_at,
  archived_at, media_asset_id, item_type
)
SELECT *
  FROM source
 WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro');
