PRAGMA foreign_keys = ON;

-- O item anterior existia apenas para validar a interface do Emporio Muller.
UPDATE catalog_items
   SET status = 'archived',
       archived_at = '2026-08-22T20:02:30.757Z',
       updated_at = '2026-08-22T20:02:30.757Z'
 WHERE id = 'item-muller-emporio-demo'
   AND hotel_id = 'muller-fioreze'
   AND module_key = 'emporio';

UPDATE categories
   SET status = 'archived',
       updated_at = '2026-08-22T20:02:30.757Z'
 WHERE id = 'catg-muller-emporio'
   AND hotel_id = 'muller-fioreze'
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
  'folder-muller-fioreze-portal',
  'muller-fioreze',
  NULL,
  'Portal',
  NULL,
  NULL,
  '2026-08-22T20:02:30.757Z',
  '2026-08-22T20:02:30.757Z',
  NULL
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'muller-fioreze');

INSERT OR IGNORE INTO media_folders (
  id, hotel_id, parent_id, name, created_by_user_id, updated_by_user_id,
  created_at, updated_at, archived_at
) SELECT
  'folder-muller-fioreze-portal-emporio',
  'muller-fioreze',
  'folder-muller-fioreze-portal',
  'Empório',
  NULL,
  NULL,
  '2026-08-22T20:02:30.757Z',
  '2026-08-22T20:02:30.757Z',
  NULL
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'muller-fioreze');

WITH source (
  id, object_key, alt_text, original_filename, size_bytes, checksum_sha256
) AS (
  VALUES
    ('media-muller-emporio-minueto-home-spray-150', 'hotels/muller-fioreze/portal/emporio/catalogo-2026/home-spray-minueto-150ml.png', 'Home Spray Minueto 150 ml', 'home-spray-minueto-150ml.png', 279193, 'e2d97978c5b7ba0ccd2ee29172d4c794959acbb0bfce7972f5bea60c096c2c7f'),
    ('media-muller-emporio-minueto-difusor-400', 'hotels/muller-fioreze/portal/emporio/catalogo-2026/difusor-minueto-400ml.png', 'Difusor de Aromas com Varetas Minueto 400 ml', 'difusor-minueto-400ml.png', 765176, '8f8d9cfc43b73acf6098f74261cb2252861a45c3c243fca46a13dd5f7e1f9320'),
    ('media-muller-emporio-minueto-sabonete-400', 'hotels/muller-fioreze/portal/emporio/catalogo-2026/sabonete-liquido-minueto-400ml.png', 'Sabonete Líquido Dourado Minueto 400 ml', 'sabonete-liquido-minueto-400ml.png', 597184, '51e0c86560f73173843c05a3ed6eba11d5965b5cf1969323d217fb50cd36b832'),
    ('media-muller-emporio-minueto-home-spray-60', 'hotels/muller-fioreze/portal/emporio/catalogo-2026/home-spray-minueto-60ml.png', 'Home Spray Minueto 60 ml', 'home-spray-minueto-60ml.png', 313659, '408cb8080900802fe30f6fe6f1cb2c9995b22a79fc0c474fdedd7bf0a53f8b27'),
    ('media-muller-emporio-tabua-bambu', 'hotels/muller-fioreze/portal/emporio/catalogo-2026/tabua-corte-familia-fioreze-bambu.png', 'Tábua de Corte Família Fioreze em bambu', 'tabua-corte-familia-fioreze-bambu.png', 1177729, 'cd8ab1e213be735f7291e38fc3853e53aff2a7161f14b3faff744b1ad2104e72')
)
INSERT INTO media_assets (
  id, hotel_id, module_key, folder_id, storage_provider, object_key,
  public_url, alt_text, mime_type, status, created_at, updated_at,
  archived_at, original_filename, size_bytes, checksum_sha256,
  storage_etag, uploaded_by_user_id, archived_by_user_id
)
SELECT
  source.id,
  'muller-fioreze',
  'emporio',
  'folder-muller-fioreze-portal-emporio',
  'r2',
  source.object_key,
  '/media/' || source.id,
  source.alt_text,
  'image/png',
  'active',
  '2026-08-22T20:02:30.757Z',
  '2026-08-22T20:02:30.757Z',
  NULL,
  source.original_filename,
  source.size_bytes,
  source.checksum_sha256,
  NULL,
  NULL,
  NULL
FROM source
WHERE EXISTS (
  SELECT 1
    FROM hotels h
    JOIN modules m ON m.module_key = 'emporio'
   WHERE h.id = 'muller-fioreze'
)
ON CONFLICT(id) DO UPDATE SET
  folder_id = excluded.folder_id,
  object_key = excluded.object_key,
  public_url = excluded.public_url,
  alt_text = excluded.alt_text,
  mime_type = excluded.mime_type,
  status = 'active',
  updated_at = excluded.updated_at,
  archived_at = NULL,
  original_filename = excluded.original_filename,
  size_bytes = excluded.size_bytes,
  checksum_sha256 = excluded.checksum_sha256;

WITH source (id, name, description, sort_order) AS (
  VALUES
    ('category-muller-emporio-aromas', 'Aromas', 'Aromas e fragrâncias da linha Minueto.', 10),
    ('category-muller-emporio-dia-a-dia', 'Dia a dia', 'Itens da Família Fioreze para casa e para presentear.', 20)
)
INSERT INTO categories (
  id, hotel_id, catalog_id, module_key, name, description, status,
  sort_order, created_at, updated_at
)
SELECT
  source.id,
  'muller-fioreze',
  'cat-muller-emporio',
  'emporio',
  source.name,
  source.description,
  'active',
  source.sort_order,
  '2026-08-22T20:02:30.757Z',
  '2026-08-22T20:02:30.757Z'
FROM source
WHERE EXISTS (
  SELECT 1 FROM catalogs
   WHERE id = 'cat-muller-emporio'
     AND hotel_id = 'muller-fioreze'
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
    'item-muller-emporio-minueto-home-spray-150',
    'product-muller-emporio-minueto-home-spray-150',
    'category-muller-emporio-aromas',
    'Home Spray - Essência Minueto - 150 ml',
    'Home spray floral-frutado com notas de pomelo, gerânio, bergamota, jasmim, rosa, vetiver e musk, além de minipartículas douradas. Aplique sobre tecidos em geral, evitando couro e materiais sintéticos, a aproximadamente 30 cm de distância e sem encharcar.',
    'Destaque',
    12400,
    10,
    '{"sku":"EMP-MIN-HS-150","short_description":"Fragrância Minueto em home spray de 150 ml com minipartículas douradas.","packaging":"Vidro","origin":"Gramado/RS","tags":["Aromas","Minueto","Destaque"]}',
    'media-muller-emporio-minueto-home-spray-150'
  ),
  (
    'item-muller-emporio-minueto-difusor-400',
    'product-muller-emporio-minueto-difusor-400',
    'category-muller-emporio-aromas',
    'Difusor de Aromas com Varetas Minueto - 400 ml',
    'Difusor floral-frutado com notas de pomelo, gerânio, bergamota, jasmim, rosa, vetiver e musk. Retire o vedante, recoloque a tampa e insira todas as varetas de fibra branca. Evite derramar o líquido sobre superfícies; caso isso ocorra, limpe imediatamente.',
    'Aromas',
    23800,
    20,
    '{"sku":"EMP-MIN-DIF-400","short_description":"Difusor Minueto com varetas para perfumar o ambiente continuamente.","packaging":"Vidro","origin":"Gramado/RS","tags":["Aromas","Minueto","Casa"]}',
    'media-muller-emporio-minueto-difusor-400'
  ),
  (
    'item-muller-emporio-minueto-sabonete-400',
    'product-muller-emporio-minueto-sabonete-400',
    'category-muller-emporio-aromas',
    'Sabonete Líquido Dourado Minueto - 400 ml',
    'Sabonete líquido floral-frutado com notas de pomelo, gerânio, bergamota, jasmim, rosa, vetiver e musk. Aplique sobre a pele e massageie até formar uma espuma cremosa. Pode ser usado no banho ou para lavar as mãos e o rosto, ajudando a manter o pH natural da pele.',
    'Aromas',
    21600,
    30,
    '{"sku":"EMP-MIN-SAB-400","short_description":"Sabonete líquido dourado Minueto para corpo, mãos e rosto.","packaging":"Vidro","origin":"Gramado/RS","tags":["Aromas","Minueto","Cuidado"]}',
    'media-muller-emporio-minueto-sabonete-400'
  ),
  (
    'item-muller-emporio-minueto-home-spray-60',
    'product-muller-emporio-minueto-home-spray-60',
    'category-muller-emporio-aromas',
    'Home Spray - Essência Minueto - 60 ml',
    'Home spray floral-frutado com notas de pomelo, gerânio, bergamota, jasmim, rosa, vetiver e musk, além de minipartículas douradas. Aplique sobre tecidos em geral, evitando couro e materiais sintéticos, a aproximadamente 30 cm de distância e sem encharcar.',
    'Aromas',
    4200,
    40,
    '{"sku":"EMP-MIN-HS-060","short_description":"Fragrância Minueto em uma versão compacta de 60 ml.","packaging":"Plástico","origin":"Gramado/RS","tags":["Aromas","Minueto","Viagem"]}',
    'media-muller-emporio-minueto-home-spray-60'
  ),
  (
    'item-muller-emporio-tabua-bambu',
    'product-muller-emporio-tabua-bambu',
    'category-muller-emporio-dia-a-dia',
    'Tábua de Corte - Família Fioreze - Bambu',
    'Tábua de bambu com superfície resistente, canaleta para líquidos, orifício para pendurar e gravação a laser da Família Fioreze. Lave com detergente neutro e seque imediatamente após o uso. Não utilize em lava-louças; aplique óleo mineral periodicamente para conservar a peça.',
    'Casa',
    12000,
    10,
    '{"sku":"EMP-TABUA-BAMBU","short_description":"Tábua de bambu personalizada para preparar, servir e presentear.","packaging":"Bambu","origin":"Gramado/RS","tags":["Casa","Bambu","Família Fioreze"],"information_pending":["dimensões"]}',
    'media-muller-emporio-tabua-bambu'
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
  'muller-fioreze',
  'cat-muller-emporio',
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
  '2026-08-22T20:02:30.757Z',
  '2026-08-22T20:02:30.757Z',
  NULL,
  source.media_asset_id
FROM source
WHERE EXISTS (
  SELECT 1
    FROM categories c
    JOIN media_assets ma ON ma.id = source.media_asset_id
   WHERE c.id = source.category_id
     AND c.hotel_id = 'muller-fioreze'
     AND ma.hotel_id = 'muller-fioreze'
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

WITH source (catalog_item_id, is_available, availability_label) AS (
  VALUES
    ('item-muller-emporio-minueto-home-spray-150', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-muller-emporio-minueto-difusor-400', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-muller-emporio-minueto-sabonete-400', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-muller-emporio-minueto-home-spray-60', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-muller-emporio-tabua-bambu', 1, 'Consulte a disponibilidade com a recepção')
)
INSERT INTO catalog_item_availability (
  hotel_id, catalog_item_id, is_available, availability_label,
  starts_at, ends_at, updated_at
)
SELECT
  'muller-fioreze',
  source.catalog_item_id,
  source.is_available,
  source.availability_label,
  NULL,
  NULL,
  '2026-08-22T20:02:30.757Z'
FROM source
WHERE EXISTS (
  SELECT 1 FROM catalog_items ci
   WHERE ci.id = source.catalog_item_id
     AND ci.hotel_id = 'muller-fioreze'
)
ON CONFLICT(hotel_id, catalog_item_id) DO UPDATE SET
  is_available = excluded.is_available,
  availability_label = excluded.availability_label,
  starts_at = NULL,
  ends_at = NULL,
  updated_at = excluded.updated_at;
