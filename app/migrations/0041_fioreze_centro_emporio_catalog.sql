PRAGMA foreign_keys = ON;

-- The previous item was created only to validate the Emporio interface.
UPDATE catalog_items
   SET status = 'archived',
       archived_at = '2026-08-04T00:00:00.000Z',
       updated_at = '2026-08-04T00:00:00.000Z'
 WHERE id = 'item_09818cf8-8dde-4f0c-ad02-574615e86bf9'
   AND hotel_id = 'fiorezecentro'
   AND module_key = 'emporio';

UPDATE categories
   SET status = 'archived',
       updated_at = '2026-08-04T00:00:00.000Z'
 WHERE id = 'category_920ac4fc-fefd-4833-8e9f-2e01acca326e'
   AND hotel_id = 'fiorezecentro'
   AND module_key = 'emporio'
   AND NOT EXISTS (
     SELECT 1
       FROM catalog_items ci
      WHERE ci.category_id = categories.id
        AND ci.status != 'archived'
   );

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
  '2026-08-04T00:00:00.000Z',
  '2026-08-04T00:00:00.000Z',
  NULL
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro');

INSERT OR IGNORE INTO media_folders (
  id, hotel_id, parent_id, name, created_by_user_id, updated_by_user_id,
  created_at, updated_at, archived_at
) SELECT
  'folder-fiorezecentro-portal-emporio',
  'fiorezecentro',
  'folder-fiorezecentro-portal',
  'Empório',
  NULL,
  NULL,
  '2026-08-04T00:00:00.000Z',
  '2026-08-04T00:00:00.000Z',
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
    'media-fiorezecentro-emporio-vela-garbo',
    'fiorezecentro',
    'emporio',
    'folder-fiorezecentro-portal-emporio',
    'r2',
    'hotels/fiorezecentro/portal/emporio/vela-aromatica-garbo.png',
    '/media/media-fiorezecentro-emporio-vela-garbo',
    'Vela Aromática Família Fioreze com essência Garbo',
    'image/png',
    'active',
    '2026-08-04T00:00:00.000Z',
    '2026-08-04T00:00:00.000Z',
    NULL,
    'vela-aromatica-garbo.png',
    656367,
    'b094e9c35c1f2eafc3d4cfd4d9d2b2774b78d9d6879aad77e664811cd496bbc3',
    NULL,
    NULL,
    NULL
  ),
  (
    'media-fiorezecentro-emporio-xampu-condicionador',
    'fiorezecentro',
    'emporio',
    'folder-fiorezecentro-portal-emporio',
    'r2',
    'hotels/fiorezecentro/portal/emporio/xampu-condicionador-2-em-1.png',
    '/media/media-fiorezecentro-emporio-xampu-condicionador',
    'Xampu e condicionador 2 em 1 Família Fioreze',
    'image/png',
    'active',
    '2026-08-04T00:00:00.000Z',
    '2026-08-04T00:00:00.000Z',
    NULL,
    'xampu-condicionador-2-em-1.png',
    558748,
    'a49a158870635cc3d701699432bad11fc226c250e8f58c4aa7dec6a16367585c',
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
 WHERE EXISTS (
   SELECT 1
     FROM hotels h
     JOIN modules m ON m.module_key = 'emporio'
    WHERE h.id = 'fiorezecentro'
 );

WITH source (id, name, description, sort_order) AS (
  VALUES
    ('category-fiorezecentro-emporio-aromas', 'Aromas', 'Aromas e fragrâncias da Família Fioreze.', 10),
    ('category-fiorezecentro-emporio-banho', 'Banho', 'Cuidados pessoais da Família Fioreze.', 20)
)
INSERT INTO categories (
  id, hotel_id, catalog_id, module_key, name, description, status,
  sort_order, created_at, updated_at
)
SELECT
  source.id,
  'fiorezecentro',
  'catalog-fiorezecentro-emporio',
  'emporio',
  source.name,
  source.description,
  'active',
  source.sort_order,
  '2026-08-04T00:00:00.000Z',
  '2026-08-04T00:00:00.000Z'
FROM source
WHERE EXISTS (
  SELECT 1
    FROM catalogs
   WHERE id = 'catalog-fiorezecentro-emporio'
     AND hotel_id = 'fiorezecentro'
     AND module_key = 'emporio'
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  status = 'active',
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;

WITH source (
  id, public_id, category_id, name, description, tag, price_cents,
  sort_order, metadata_json, media_asset_id
) AS (
  VALUES
  (
    'item-fiorezecentro-emporio-vela-garbo',
    'product-fiorezecentro-emporio-vela-garbo',
    'category-fiorezecentro-emporio-aromas',
    'Vela Aromática Família Fioreze - Essência Garbo (170g)',
    'Leve a sofisticação e o aconchego característicos de Gramado para o seu ambiente. Desenvolvida em parceria com a Santho Aroma, a essência exclusiva Garbo proporciona uma experiência olfativa marcante e relaxante. O design em vidro fosco com tampa de madeira gravada complementa qualquer decoração com um toque de elegância rústica.',
    'Destaque',
    13800,
    10,
    '{"legacy_id":"EMP001","sku":"SKU-VEL-001","packaging":"Vidro âmbar fosco com tampa de madeira natural.","origin":"Gramado/RS","stock":50,"previous_price_cents":23800,"tags":["DESTAQUE","PROMOÇÃO"],"highlight":"Fragrância exclusiva"}',
    'media-fiorezecentro-emporio-vela-garbo'
  ),
  (
    'item-fiorezecentro-emporio-xampu-condicionador',
    'product-fiorezecentro-emporio-xampu-condicionador',
    'category-fiorezecentro-emporio-banho',
    'Xampu & Condicionador 2-em-1 Família Fioreze (500ml)',
    'Simplifique sua rotina de beleza com a praticidade do Xampu & Condicionador 2-em-1 da Família Fioreze. Desenvolvido para limpar suavemente e condicionar profundamente em um único passo, deixa os cabelos macios, brilhantes e com um aroma delicado e duradouro. O frasco transparente de 500 ml possui bomba prática e rótulo em português, inglês e espanhol.',
    'Cuidado',
    4800,
    20,
    '{"legacy_id":"EMP002","sku":"SKU-POO-001","packaging":"Plástico","origin":"Gramado/RS","stock":50,"tags":["BELEZA","BANHO","CUIDADO"],"highlight":"Fragrância exclusiva"}',
    'media-fiorezecentro-emporio-xampu-condicionador'
  )
)
INSERT INTO catalog_items (
  id, public_id, hotel_id, catalog_id, category_id, module_key, item_type,
  name, description, tag, price_cents, currency, image_url, status,
  sort_order, metadata_json, created_at, updated_at, archived_at, media_asset_id
)
SELECT
  source.id,
  source.public_id,
  'fiorezecentro',
  'catalog-fiorezecentro-emporio',
  source.category_id,
  'emporio',
  'product',
  source.name,
  source.description,
  source.tag,
  source.price_cents,
  'BRL',
  '/media/' || source.media_asset_id,
  'active',
  source.sort_order,
  source.metadata_json,
  '2026-08-04T00:00:00.000Z',
  '2026-08-04T00:00:00.000Z',
  NULL,
  source.media_asset_id
FROM source
WHERE EXISTS (
  SELECT 1
    FROM categories c
    JOIN media_assets ma ON ma.id = source.media_asset_id
   WHERE c.id = source.category_id
     AND c.hotel_id = 'fiorezecentro'
     AND ma.hotel_id = 'fiorezecentro'
)
ON CONFLICT(id) DO UPDATE SET
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  tag = excluded.tag,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  image_url = excluded.image_url,
  status = 'active',
  sort_order = excluded.sort_order,
  metadata_json = excluded.metadata_json,
  updated_at = excluded.updated_at,
  archived_at = NULL,
  media_asset_id = excluded.media_asset_id;

WITH source (catalog_item_id) AS (
  VALUES
    ('item-fiorezecentro-emporio-vela-garbo'),
    ('item-fiorezecentro-emporio-xampu-condicionador')
)
INSERT INTO catalog_item_availability (
  hotel_id, catalog_item_id, is_available, availability_label,
  starts_at, ends_at, updated_at
)
SELECT
  'fiorezecentro',
  source.catalog_item_id,
  1,
  'Consulte a disponibilidade com a recepção',
  NULL,
  NULL,
  '2026-08-04T00:00:00.000Z'
FROM source
WHERE EXISTS (
  SELECT 1
    FROM catalog_items ci
   WHERE ci.id = source.catalog_item_id
     AND ci.hotel_id = 'fiorezecentro'
)
ON CONFLICT(hotel_id, catalog_item_id) DO UPDATE SET
  is_available = 1,
  availability_label = excluded.availability_label,
  starts_at = NULL,
  ends_at = NULL,
  updated_at = excluded.updated_at;
