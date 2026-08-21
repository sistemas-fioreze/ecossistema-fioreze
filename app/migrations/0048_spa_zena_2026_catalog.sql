PRAGMA foreign_keys = ON;

-- Menu aprovado do Spa Zena em 21/08/2026. Os dois objetos novos do R2
-- devem ser enviados antes da aplicacao desta migration.
INSERT INTO media_assets (
  id, hotel_id, module_key, storage_provider, object_key, public_url,
  alt_text, mime_type, status, created_at, updated_at, archived_at,
  original_filename, size_bytes, checksum_sha256, storage_etag,
  uploaded_by_user_id, archived_by_user_id
) VALUES
  (
    'media-spa-zena-2026-cranio-facial', NULL, 'spa', 'r2',
    'shared/spa/catalog/2026/spa-zena-2026-cranio-facial.png',
    '/media/media-spa-zena-2026-cranio-facial',
    'Massagem Crânio-Facial para Acalmar a Mente', 'image/png',
    'active', '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL,
    'spa-zena-2026-cranio-facial.png', 165089,
    'b7fbe8ed03529590819c115d932e522a9484dd92be19adc729e1006e13f093ba',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-2026-banho-imersao', NULL, 'spa', 'r2',
    'shared/spa/catalog/2026/spa-zena-2026-banho-imersao.png',
    '/media/media-spa-zena-2026-banho-imersao',
    'Banho de Imersão na Hidromassagem', 'image/png',
    'active', '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL,
    'spa-zena-2026-banho-imersao.png', 113232,
    'a6cc2d67af00a777b18590b0e313b54b9e39c0cb708086cf66b88f45a7852ff5',
    NULL, NULL, NULL
  )
ON CONFLICT(id) DO UPDATE SET
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

-- A imagem aprovada das esferas ja existe no acervo compartilhado.
UPDATE media_assets
   SET alt_text = 'Massagem com Esferas de Sal do Himalaia',
       status = 'active',
       updated_at = '2026-08-21T22:42:42.722Z',
       archived_at = NULL
 WHERE id = 'media-spa-zena-10';

INSERT INTO spa_shared_services (
  id, name, description, duration_label, duration_minutes, price_cents,
  currency, media_asset_id, status, sort_order, created_at, updated_at, archived_at
) VALUES
  (
    'spa-zena-massagem-relaxante',
    'Massagem Relaxante',
    'Técnica feita no corpo todo com manobras de deslizamentos suaves e precisos. Ajuda a reduzir a fadiga muscular e diminuir o estresse, relaxa o corpo, reduz a ansiedade e tranquiliza a mente.',
    '50 minutos', 50, 31000, 'BRL', 'media-spa-zena-01', 'active', 1,
    '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL
  ),
  (
    'spa-zena-massagem-terapeutica',
    'Massagem Terapêutica',
    'Terapia que mistura técnicas de shiatsu e desportiva, tendo como principal objetivo obter resultados na recuperação dos músculos onde existem tensões e dores. A terapeuta foca nas partes do corpo que mais necessitam de tratamento.',
    '50 minutos', 50, 34500, 'BRL', 'media-spa-zena-02', 'active', 2,
    '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL
  ),
  (
    'spa-zena-pedras-quentes',
    'Terapia com Pedras Quentes',
    'Terapia que mistura duas técnicas distintas: a relaxante e a termoterapia por meio das pedras aquecidas. O calor e a pressão da pedra vulcânica ajudam a relaxar a musculatura profundamente. Ideal para os dias frios.',
    '50 minutos', 50, 34500, 'BRL', 'media-spa-zena-03', 'active', 3,
    '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL
  ),
  (
    'spa-zena-velas-aromaticas',
    'Massagem com Velas Aromáticas',
    'A Massagem com Velas Quentes proporciona relaxamento profundo por meio do calor das velas, da aromaterapia e de movimentos longos, suaves e delicados, promovendo bem-estar e hidratação da pele.',
    '50 minutos', 50, 34500, 'BRL', 'media-spa-zena-04', 'active', 4,
    '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL
  ),
  (
    'spa-zena-drenagem-linfatica',
    'Drenagem Linfática Corporal',
    'Massagem que tem o objetivo de estimular o sistema linfático, reduzindo o inchaço e estimulando o sistema digestivo. É feita com movimentos lentos, suaves e superficiais no sentido dos linfonodos.',
    '50 minutos', 50, 34500, 'BRL', 'media-spa-zena-05', 'active', 5,
    '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL
  ),
  (
    'spa-zena-dreno-modeladora',
    'Massagem Dreno-Modeladora',
    'Técnica completa que une os benefícios da drenagem linfática com a intensidade da massagem modeladora. Essa terapia ativa a circulação sanguínea, auxilia na eliminação de toxinas, reduz o inchaço e contribui no tratamento da celulite e da gordura localizada. Além disso, ajuda a modelar regiões como o abdômen.',
    '50 minutos', 50, 34500, 'BRL', 'media-spa-zena-06', 'active', 6,
    '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL
  ),
  (
    'spa-zena-esferas-sal-himalaia',
    'Massagem com Esferas de Sal do Himalaia',
    'Massagem relaxante realizada com esferas de sal rosa aquecidas, que liberam minerais, promovem equilíbrio energético, aliviam tensões e proporcionam profundo bem-estar.',
    '50 minutos', 50, 34500, 'BRL', 'media-spa-zena-10', 'active', 7,
    '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL
  ),
  (
    'spa-zena-esfoliacao-corporal',
    'Esfoliação Corporal',
    'Terapia que tem o objetivo de esfoliar, renovar e hidratar a pele, deixando-a suave e lisa, com uma sensação intensa de hidratação e bem-estar.',
    '30 minutos', 30, 17500, 'BRL', 'media-spa-zena-08', 'active', 8,
    '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL
  ),
  (
    'spa-zena-massagem-cranio-facial',
    'Massagem Crânio-Facial para Acalmar a Mente',
    'Toques delicados que liberam tensões da face, cabeça e pescoço. Proporciona relaxamento profundo para acalmar a mente, melhora o sono e desperta uma sensação única de leveza e bem-estar.',
    '30 minutos', 30, 17500, 'BRL', 'media-spa-zena-2026-cranio-facial', 'active', 9,
    '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL
  ),
  (
    'spa-zena-reflexologia-podal',
    'Reflexologia Podal',
    'A reflexologia podal é a aplicação de pressão em pontos dos pés, finalizada com massagem para equilibrar a energia do corpo e relaxar os pés depois de um dia inteiro em pé.',
    '30 minutos', 30, 17500, 'BRL', 'media-spa-zena-11', 'active', 10,
    '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL
  ),
  (
    'spa-zena-banho-imersao',
    'Banho de Imersão na Hidromassagem',
    'Feito em água aquecida com espuma de banho, associado à cromoterapia, que melhora as propriedades terapêuticas da imersão. Alivia tensões, promove o relaxamento profundo, combate o estresse e a ansiedade, ajuda na qualidade e manutenção do sono, hidrata e desintoxica a pele. Criado especialmente para uma ou duas pessoas, beneficia o corpo e a mente, trazendo total relaxamento.',
    '50 minutos', 50, 31000, 'BRL', 'media-spa-zena-2026-banho-imersao', 'active', 11,
    '2026-08-21T22:42:42.722Z', '2026-08-21T22:42:42.722Z', NULL
  )
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  duration_label = excluded.duration_label,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  media_asset_id = excluded.media_asset_id,
  status = 'active',
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at,
  archived_at = NULL;

UPDATE spa_shared_services
   SET status = 'archived',
       updated_at = '2026-08-21T22:42:42.722Z',
       archived_at = '2026-08-21T22:42:42.722Z'
 WHERE id IN (
   'spa-zena-massagem-kids',
   'spa-zena-sal-chama',
   'spa-zena-spa-day-relaxante',
   'spa-zena-spa-day-revigorante'
 );

UPDATE spa_shared_profile
   SET usage_rules_json = '["Utilize roupas íntimas ou de banho, como biquíni ou calção, para vir ao spa.","Evite vir com acessórios, como brincos, relógio ou colares.","Atrasos não serão recompensados.","Caso não possa comparecer à terapia, o cancelamento será aceito com antecedência de até 2h antes do horário agendado.","O não comparecimento ou a desmarcação em cima da hora gera uma cobrança de 50% do valor da terapia.","Terapias compradas e pagas antecipadamente sem cancelamento prévio não terão devolução.","Mantenha seus aparelhos eletrônicos em modo silencioso ou desligados enquanto estiver no spa. Aqui é um lugar de relaxamento."]',
       updated_at = '2026-08-21T22:42:42.722Z'
 WHERE id = 'spa-zena';
