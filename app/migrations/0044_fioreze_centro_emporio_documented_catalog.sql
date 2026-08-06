PRAGMA foreign_keys = ON;

-- Produtos documentados no catálogo Família Fioreze de 06/08/2026.
WITH source (
  id, object_key, alt_text, original_filename, size_bytes, checksum_sha256
) AS (
  VALUES
    ('media-fiorezecentro-emporio-garbo-60', 'hotels/fiorezecentro/portal/emporio/catalogo-2026/perfume-garbo-60ml.jpg', 'Perfume de Ambiente Garbo 60 ml', 'perfume-garbo-60ml.jpg', 9287, '1e4009661108f88e2a070449ad2e7fc040f3537ada85f6a71ba369097737599f'),
    ('media-fiorezecentro-emporio-azeite-250', 'hotels/fiorezecentro/portal/emporio/catalogo-2026/azeite-terroir-serrano-250ml.jpg', 'Azeite de Oliva Extravirgem Terroir Serrano 250 ml', 'azeite-terroir-serrano-250ml.jpg', 8746, 'd8338d09f043b7d81da8b2a393f49f10f0d04c0b3f7b6e5d84c2567f39f6140a'),
    ('media-fiorezecentro-emporio-kit-cuia', 'hotels/fiorezecentro/portal/emporio/catalogo-2026/kit-cuia-familia-fioreze.jpg', 'Kit Cuia Família Fioreze', 'kit-cuia-familia-fioreze.jpg', 11210, '2f2c7f4c2af1b2d17f57a2886939dad1a5217f176974110734c54ce03bc60de7'),
    ('media-fiorezecentro-emporio-biscoitos-150', 'hotels/fiorezecentro/portal/emporio/catalogo-2026/biscoitos-familia-fioreze-150g.jpg', 'Biscoitos Família Fioreze 150 g', 'biscoitos-familia-fioreze-150g.jpg', 16294, '61790cc2bcb945b817beb87e6b9306e40f5f49b695f87dee537e6391db033db7'),
    ('media-fiorezecentro-emporio-caneca-tampa', 'hotels/fiorezecentro/portal/emporio/catalogo-2026/caneca-familia-fioreze-tampa.jpg', 'Caneca Família Fioreze com Tampa de Madeira', 'caneca-familia-fioreze-tampa.jpg', 17087, 'c432cb59dadb4a4ad60728031e13ea8d4bc064e90633bacdd82cbde08a1aa32d'),
    ('media-fiorezecentro-emporio-difusor-garbo-240', 'hotels/fiorezecentro/portal/emporio/catalogo-2026/difusor-garbo-240ml.jpg', 'Difusor de Aromas com Varetas Garbo 240 ml', 'difusor-garbo-240ml.jpg', 11068, '51f5aa6c85372958b4b9940e6d5469383f8808726877ea3b833f178f6c58715e'),
    ('media-fiorezecentro-emporio-garbo-300', 'hotels/fiorezecentro/portal/emporio/catalogo-2026/perfume-garbo-300ml.jpg', 'Perfume de Ambiente Garbo 300 ml', 'perfume-garbo-300ml.jpg', 8264, '0fc2f0c175cc49636fe360443d51822ae9d0047ae5f74857b571596ba50d7bb5'),
    ('media-fiorezecentro-emporio-pijama-adulto', 'hotels/fiorezecentro/portal/emporio/catalogo-2026/pijama-adulto-familia-fioreze.jpg', 'Pijama Adulto Família Fioreze', 'pijama-adulto-familia-fioreze.jpg', 11254, 'aa99b3a9ac38808a51b78143399eceac7de9a5dd81f58e5aaedfbb3eb9a095c8'),
    ('media-fiorezecentro-emporio-tabua-madeira', 'hotels/fiorezecentro/portal/emporio/catalogo-2026/tabua-madeira-familia-fioreze.jpg', 'Tábua de Madeira Família Fioreze', 'tabua-madeira-familia-fioreze.jpg', 19155, 'b8b53e83270c5f1588c1030e73f7332322937ace03499c20261692ccfe527041')
)
INSERT INTO media_assets (
  id, hotel_id, module_key, folder_id, storage_provider, object_key,
  public_url, alt_text, mime_type, status, created_at, updated_at,
  archived_at, original_filename, size_bytes, checksum_sha256,
  storage_etag, uploaded_by_user_id, archived_by_user_id
)
SELECT
  source.id,
  'fiorezecentro',
  'emporio',
  'folder-fiorezecentro-portal-emporio',
  'r2',
  source.object_key,
  '/media/' || source.id,
  source.alt_text,
  'image/jpeg',
  'active',
  '2026-08-06T14:48:06.000Z',
  '2026-08-06T14:48:06.000Z',
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
   WHERE h.id = 'fiorezecentro'
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
    ('category-fiorezecentro-emporio-aromas', 'Aromas', 'Aromas e fragrâncias da Família Fioreze.', 10),
    ('category-fiorezecentro-emporio-gastronomia', 'Gastronomia', 'Sabores e lembranças gastronômicas da Serra Gaúcha.', 30),
    ('category-fiorezecentro-emporio-chimarrao', 'Chimarrão', 'Tradição gaúcha para levar consigo.', 40),
    ('category-fiorezecentro-emporio-biscoitos', 'Biscoitos', 'Sabores de Gramado em embalagens para presentear.', 50),
    ('category-fiorezecentro-emporio-canecas', 'Canecas', 'Itens afetivos para café, chá e chocolate quente.', 60),
    ('category-fiorezecentro-emporio-conforto', 'Conforto', 'Produtos para prolongar a experiência de hospedagem.', 70),
    ('category-fiorezecentro-emporio-casa', 'Casa', 'Peças para servir, decorar e presentear.', 80)
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
  '2026-08-06T14:48:06.000Z',
  '2026-08-06T14:48:06.000Z'
FROM source
WHERE EXISTS (
  SELECT 1 FROM catalogs
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
    'item-fiorezecentro-emporio-garbo-60',
    'product-fiorezecentro-emporio-garbo-60',
    'category-fiorezecentro-emporio-aromas',
    'Perfume de Ambiente Garbo 60 ml',
    'Perfume de ambiente Garbo em frasco de 60 ml, ideal para levar na bolsa, presentear ou perfumar pequenos ambientes. Sua composição floral-frutal combina cassis, pera, maçã, violeta, ameixa, muguet, pêssego branco e musk, criando uma fragrância moderna, leve e envolvente.',
    'Aromas',
    3990,
    30,
    '{"sku":"EMP-GARBO-HS-060","short_description":"O aroma que marca a experiência Fioreze em uma versão compacta.","tags":["Aromas","Presente","Família Fioreze"]}',
    'media-fiorezecentro-emporio-garbo-60'
  ),
  (
    'item-fiorezecentro-emporio-azeite-250',
    'product-fiorezecentro-emporio-azeite-250',
    'category-fiorezecentro-emporio-gastronomia',
    'Azeite de Oliva Extravirgem Terroir Serrano 250 ml',
    'Azeite de oliva extravirgem em embalagem de 250 ml, personalizado para a Família Fioreze em parceria com a Olivas de Gramado. Uma lembrança gastronômica da Serra Gaúcha, ideal para finalizar saladas, pães, massas e pratos especiais.',
    'Gastronomia',
    10900,
    10,
    '{"sku":"EMP-AZEITE-250","short_description":"Azeite extravirgem de Gramado para finalizar receitas com elegância.","tags":["Gastronomia","Gramado","Presente"]}',
    'media-fiorezecentro-emporio-azeite-250'
  ),
  (
    'item-fiorezecentro-emporio-kit-cuia',
    'product-fiorezecentro-emporio-kit-cuia',
    'category-fiorezecentro-emporio-chimarrao',
    'Kit Cuia Família Fioreze',
    'Kit composto por cuia de madeira e bomba metálica, apresentado em embalagem transparente com laço personalizado da Família Fioreze. Um presente afetivo que leva consigo um dos símbolos mais queridos da cultura gaúcha.',
    'Chimarrão',
    9900,
    10,
    '{"sku":"EMP-KIT-CUIA","short_description":"Cuia e bomba em um conjunto inspirado na tradição do chimarrão.","tags":["Chimarrão","Tradição Gaúcha","Presente"]}',
    'media-fiorezecentro-emporio-kit-cuia'
  ),
  (
    'item-fiorezecentro-emporio-biscoitos-150',
    'product-fiorezecentro-emporio-biscoitos-150',
    'category-fiorezecentro-emporio-biscoitos',
    'Biscoitos Família Fioreze 150 g',
    'Lata com 150 g de biscoitos Família Fioreze, criada para guardar um pedacinho da experiência em Gramado. A embalagem personalizada une praticidade, charme e memória afetiva, sendo uma opção delicada para presentear ou saborear durante a viagem.',
    'Biscoitos',
    1500,
    10,
    '{"sku":"EMP-BISCOITO-150","short_description":"Biscoitos em lata personalizada, uma lembrança doce de Gramado.","tags":["Biscoitos","Sabores de Gramado","Presente"],"information_pending":["sabor","ingredientes","alergênicos"]}',
    'media-fiorezecentro-emporio-biscoitos-150'
  ),
  (
    'item-fiorezecentro-emporio-caneca-tampa',
    'product-fiorezecentro-emporio-caneca-tampa',
    'category-fiorezecentro-emporio-canecas',
    'Caneca Família Fioreze com Tampa de Madeira',
    'Caneca branca com alça preta, tampa de madeira personalizada e frase institucional da Família Fioreze. Um item funcional e afetivo para café, chá ou chocolate quente, ideal para levar para casa uma lembrança da hospitalidade vivida em Gramado.',
    'Caneca',
    9000,
    10,
    '{"sku":"EMP-CANECA-TAMPA","short_description":"Caneca personalizada com tampa de madeira e uma mensagem que traduz o jeito Fioreze de receber.","tags":["Caneca","Casa","Presente"],"information_pending":["capacidade","cuidados de lavagem"]}',
    'media-fiorezecentro-emporio-caneca-tampa'
  ),
  (
    'item-fiorezecentro-emporio-difusor-garbo-240',
    'product-fiorezecentro-emporio-difusor-garbo-240',
    'category-fiorezecentro-emporio-aromas',
    'Difusor de Aromas com Varetas Garbo 240 ml',
    'Difusor de aromas com varetas Garbo, em frasco de vidro de 240 ml, desenvolvido em parceria com a Santho Aroma. A fragrância floral-frutal reúne cassis, pera, maçã, violeta, ameixa, muguet, pêssego branco e musk, trazendo uma atmosfera moderna, leve e acolhedora aos ambientes. Acompanha varetas.',
    'Aromas',
    16800,
    40,
    '{"sku":"EMP-GARBO-DIF-240","short_description":"Fragrância Garbo com difusão contínua para perfumar o ambiente com elegância.","tags":["Aromas","Casa","Garbo"]}',
    'media-fiorezecentro-emporio-difusor-garbo-240'
  ),
  (
    'item-fiorezecentro-emporio-garbo-300',
    'product-fiorezecentro-emporio-garbo-300',
    'category-fiorezecentro-emporio-aromas',
    'Perfume de Ambiente Garbo 300 ml',
    'Home Spray Garbo de 300 ml, ideal para perfumar salas, quartos e outros ambientes com praticidade. Sua fragrância floral-frutal combina notas de cassis, pera, maçã, violeta, ameixa, muguet, pêssego branco e musk, criando uma sensação contemporânea, delicada e acolhedora.',
    'Aromas',
    9900,
    50,
    '{"sku":"EMP-GARBO-HS-300","short_description":"O aroma assinatura Fioreze em uma versão de 300 ml para perfumar seus ambientes.","tags":["Aromas","Casa","Garbo"]}',
    'media-fiorezecentro-emporio-garbo-300'
  ),
  (
    'item-fiorezecentro-emporio-pijama-adulto',
    'product-fiorezecentro-emporio-pijama-adulto',
    'category-fiorezecentro-emporio-conforto',
    'Pijama Adulto Família Fioreze',
    'Pijama Família Fioreze produzido pela empresa Mar de Sonhos, composto por camisa de manga longa com botões e calça, em preto com acabamento contrastante branco. Disponível nos tamanhos adulto e infantil, também oferece a possibilidade de personalização com o nome bordado. Uma peça elegante e confortável, criada para transformar os momentos de descanso em uma extensão da experiência de hospedagem.',
    'Conforto',
    22900,
    10,
    '{"sku":"EMP-PIJAMA-ADULTO","short_description":"Pijama Família Fioreze produzido pela Mar de Sonhos, disponível nos modelos adulto e infantil, com opção de nome bordado.","tags":["Conforto","Pijama","Família Fioreze"],"information_pending":["tamanhos","tecido","instruções de lavagem"]}',
    'media-fiorezecentro-emporio-pijama-adulto'
  ),
  (
    'item-fiorezecentro-emporio-tabua-madeira',
    'product-fiorezecentro-emporio-tabua-madeira',
    'category-fiorezecentro-emporio-casa',
    'Tábua de Madeira Família Fioreze',
    'Tábua de madeira personalizada com a marca Família Fioreze, alça circular e acabamento natural, apresentada com laço dourado. Versátil para servir queijos, pães, petiscos e outras composições, também funciona como uma lembrança elegante de Gramado.',
    'Casa',
    0,
    10,
    '{"sku":"EMP-TABUA-MADEIRA","short_description":"Tábua de madeira personalizada para servir e presentear com identidade serrana.","tags":["Tábua","Casa","Presente"],"price_pending":true,"information_pending":["preço","dimensões","tipo de madeira","cuidados de conservação"]}',
    'media-fiorezecentro-emporio-tabua-madeira'
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
  '2026-08-06T14:48:06.000Z',
  '2026-08-06T14:48:06.000Z',
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

WITH source (catalog_item_id, is_available, availability_label) AS (
  VALUES
    ('item-fiorezecentro-emporio-garbo-60', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-fiorezecentro-emporio-azeite-250', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-fiorezecentro-emporio-kit-cuia', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-fiorezecentro-emporio-biscoitos-150', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-fiorezecentro-emporio-caneca-tampa', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-fiorezecentro-emporio-difusor-garbo-240', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-fiorezecentro-emporio-garbo-300', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-fiorezecentro-emporio-pijama-adulto', 1, 'Consulte a disponibilidade com a recepção'),
    ('item-fiorezecentro-emporio-tabua-madeira', 0, 'Preço e disponibilidade sob consulta')
)
INSERT INTO catalog_item_availability (
  hotel_id, catalog_item_id, is_available, availability_label,
  starts_at, ends_at, updated_at
)
SELECT
  'fiorezecentro',
  source.catalog_item_id,
  source.is_available,
  source.availability_label,
  NULL,
  NULL,
  '2026-08-06T14:48:06.000Z'
FROM source
WHERE EXISTS (
  SELECT 1 FROM catalog_items ci
   WHERE ci.id = source.catalog_item_id
     AND ci.hotel_id = 'fiorezecentro'
)
ON CONFLICT(hotel_id, catalog_item_id) DO UPDATE SET
  is_available = excluded.is_available,
  availability_label = excluded.availability_label,
  starts_at = NULL,
  ends_at = NULL,
  updated_at = excluded.updated_at;
