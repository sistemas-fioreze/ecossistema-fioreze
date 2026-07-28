PRAGMA foreign_keys = ON;

INSERT INTO modules (
  module_key, name, description, status, created_at, updated_at
) VALUES (
  'spa',
  'Spa',
  'Catálogo compartilhado de terapias e experiências do Spa Zena.',
  'active',
  '2026-07-28T00:00:00.000Z',
  '2026-07-28T00:00:00.000Z'
)
ON CONFLICT(module_key) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  updated_at = excluded.updated_at;

CREATE TABLE IF NOT EXISTS spa_shared_profile (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  intro_text TEXT NOT NULL,
  about_text TEXT NOT NULL,
  booking_title TEXT NOT NULL,
  booking_text TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  whatsapp_service_message TEXT NOT NULL,
  whatsapp_general_message TEXT NOT NULL,
  hours_text TEXT NOT NULL,
  usage_rules_json TEXT NOT NULL DEFAULT '[]',
  logo_media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS spa_shared_services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_label TEXT NOT NULL,
  duration_minutes INTEGER
    CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_spa_shared_profile_status
  ON spa_shared_profile(status);

CREATE INDEX IF NOT EXISTS idx_spa_shared_services_status_order
  ON spa_shared_services(status, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_spa_shared_services_media
  ON spa_shared_services(media_asset_id);

INSERT OR IGNORE INTO media_assets (
  id, hotel_id, module_key, storage_provider, object_key, public_url,
  alt_text, mime_type, status, created_at, updated_at, archived_at,
  original_filename, size_bytes, checksum_sha256, storage_etag,
  uploaded_by_user_id, archived_by_user_id
) VALUES (
  'media-spa-zena-logo', NULL, 'spa', 'r2',
  'shared/spa/brand/spa-zena-logo.png',
  '/media/media-spa-zena-logo', 'Spa Zena', 'image/png',
  'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
  'spa-zena-logo.png', 296493,
  'be17bdb02dc7c72786ed1ddca42a17946bbe8ab103d0ea646295aa91af88dc3e',
  NULL, NULL, NULL
);

INSERT OR IGNORE INTO media_assets (
  id, hotel_id, module_key, storage_provider, object_key, public_url,
  alt_text, mime_type, status, created_at, updated_at, archived_at,
  original_filename, size_bytes, checksum_sha256, storage_etag,
  uploaded_by_user_id, archived_by_user_id
) VALUES
  (
    'media-spa-zena-01', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-01.png',
    '/media/media-spa-zena-01', 'Massagem Relaxante', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-01.png', 174745,
    '8228a1599cb5824160a1484e0ac300a746fbeae71b13a3b46bcf3a7a68e5c7cc',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-02', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-02.png',
    '/media/media-spa-zena-02', 'Massagem Terapêutica', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-02.png', 208366,
    '39c6e89e855da8284523a3d3788bc8bd039a20f2c4e13c226a0761225b5c2ced',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-03', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-03.png',
    '/media/media-spa-zena-03', 'Terapia com Pedras Quentes', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-03.png', 235255,
    '1bcdfd848c0955d1b161ae93d800be9b1d8be8a3516af1f3839a83cf9027b943',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-04', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-04.png',
    '/media/media-spa-zena-04', 'Massagem com Velas Aromáticas', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-04.png', 235163,
    'b492ec22359fec970faf7a7f8471ede6d5c90ee2bbb5deeeefe96c62aba8c432',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-05', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-05.png',
    '/media/media-spa-zena-05', 'Drenagem Linfática Corporal', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-05.png', 188311,
    'd194199a2844ecde131716f7b310e2b135af3697e3efc893b27b467eeb52817c',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-06', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-06.png',
    '/media/media-spa-zena-06', 'Massagem Dreno-Modeladora', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-06.png', 215127,
    'c90d26c267d4e6de1398f2e85e68c6d080a37bd3b7be72b73f2528b60d22e81a',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-07', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-07.png',
    '/media/media-spa-zena-07', 'Massagem Kids', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-07.png', 266087,
    '7ef0ebd370f2ddc8d061357f23741283dc3896affad381ba782c8d4ad1e44b60',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-08', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-08.png',
    '/media/media-spa-zena-08', 'Esfoliação Corporal', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-08.png', 230074,
    'c62c4ab9cc60371d647c392f3fc4db480d2c2d9e95fce203e8eb79b68cb7a2ee',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-09', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-09.png',
    '/media/media-spa-zena-09', 'Banho de Imersão na Hidromassagem', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-09.png', 398205,
    '03a79de08b1673076c30369092df50e914c8e5e28350354b3cea1ebb3f744269',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-10', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-10.png',
    '/media/media-spa-zena-10', 'Ritual Zena Sal & Chama', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-10.png', 246899,
    '14d0a85e71df772c44f5fee76ebd93942f723be8e2d30968bef0574b73479128',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-11', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-11.png',
    '/media/media-spa-zena-11', 'Reflexologia Podal', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-11.png', 263951,
    'd1d69c99c3e04fec64df0b27a2a917f077a5ad8d15de87389e84ae6b9ebf7cd3',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-12', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-12.png',
    '/media/media-spa-zena-12', 'Spa-Day Relaxante', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-12.png', 246066,
    '221e131b948dfe1bee7fdb56950358ffaf19f84053aea4fe1da192cab8c7eaad',
    NULL, NULL, NULL
  ),
  (
    'media-spa-zena-13', NULL, 'spa', 'r2',
    'shared/spa/catalog/spa-zena-service-13.png',
    '/media/media-spa-zena-13', 'Spa-Day Revigorante', 'image/png',
    'active', '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL,
    'spa-zena-service-13.png', 269786,
    '74ba010b371997495789b4d05217f6922f94a029fe2a934d1f75fd3287457d03',
    NULL, NULL, NULL
  );

INSERT OR IGNORE INTO spa_shared_profile (
  id, title, subtitle, intro_text, about_text, booking_title, booking_text,
  whatsapp_number, whatsapp_service_message, whatsapp_general_message,
  hours_text, usage_rules_json, logo_media_asset_id, status,
  created_at, updated_at, archived_at
) VALUES (
  'spa-zena',
  'Spa Zena',
  'Cuidar de você é a nossa essência.',
  'Utilize este portal para conhecer nossos serviços de relaxamento e bem-estar.',
  'No Spa Zena, acreditamos que nosso propósito é oferecer experiências únicas de relaxamento e cuidado, unindo saúde, bem-estar físico e equilíbrio mental em um ambiente acolhedor e sofisticado. Mais do que um espaço de cuidados, somos um refúgio para desacelerar da rotina, renovar as energias e reconectar corpo e mente. Cada detalhe do Spa Zena foi pensado para proporcionar momentos de tranquilidade, acolhimento e leveza, permitindo que você viva o melhor da vida com plenitude. Seja muito bem-vindo(a) ao Spa Zena, o seu destino de bem-estar e relaxamento.',
  'Agende seu horário',
  'Selecione a terapia desejada e entre em contato direto pelo WhatsApp para consultar disponibilidade e agendar.',
  '5554993584867',
  'Olá! Sou hóspede do {hotel_name} e vi o catálogo do Spa Zena. Gostaria de agendar o serviço: {service_name}.',
  'Olá! Sou hóspede do {hotel_name} e vi o catálogo do Spa Zena. Gostaria de informações sobre agendamentos e valores.',
  'das 9h às 20h',
  '["Horário de funcionamento: das 9h às 20h.","Agendamento conforme disponibilidade da agenda e terapeutas.","Atrasos não serão recompensados.","Caso não possa comparecer à terapia, o cancelamento será aceito com antecedência de até 2h.","O não comparecimento ou a desmarcação em cima da hora gera uma cobrança de 50% do valor da terapia.","Terapias compradas e pagas antecipadamente sem cancelamento prévio não terão devolução.","Utilize roupas íntimas ou de banho, como biquíni e calção, para vir ao spa.","Evite vir com acessórios, como brincos, relógios ou colares.","Mantenha seus aparelhos eletrônicos em modo silencioso ou desligados enquanto estiver no spa. Aqui é um lugar de relaxamento."]',
  'media-spa-zena-logo',
  'active',
  '2026-07-28T00:00:00.000Z',
  '2026-07-28T00:00:00.000Z',
  NULL
);

INSERT OR IGNORE INTO spa_shared_services (
  id, name, description, duration_label, duration_minutes, price_cents,
  currency, media_asset_id, status, sort_order, created_at, updated_at, archived_at
) VALUES
  (
    'spa-zena-massagem-relaxante',
    'Massagem Relaxante',
    'Técnica feita no corpo todo com manobras de deslizamentos suaves e precisos. Ajuda a reduzir a fadiga muscular e diminuir o estresse, relaxa o corpo, reduz a ansiedade e tranquiliza a mente.',
    '50 minutos', 50, 26500, 'BRL', 'media-spa-zena-01', 'active', 1,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-massagem-terapeutica',
    'Massagem Terapêutica',
    'Terapia que mistura técnicas de shiatsu e desportiva. Tem como principal objetivo obter resultados na recuperação dos músculos onde existem tensões e dores. A terapeuta foca nas partes do corpo que mais necessitam de tratamento.',
    '50 minutos', 50, 28000, 'BRL', 'media-spa-zena-02', 'active', 2,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-pedras-quentes',
    'Terapia com Pedras Quentes',
    'Terapia que mistura duas técnicas distintas: a relaxante e a termoterapia por meio de pedras aquecidas. O calor e a pressão da pedra vulcânica ajudam a relaxar a musculatura profundamente. Ideal para os dias frios.',
    '50 minutos', 50, 28000, 'BRL', 'media-spa-zena-03', 'active', 3,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-velas-aromaticas',
    'Massagem com Velas Aromáticas',
    'A terapia com velas utiliza cera especial preparada com óleos essenciais aromáticos, derretida a 37 °C. Proporciona relaxamento profundo por meio do calor, da aromaterapia e de movimentos longos, suaves e delicados durante a massagem.',
    '50 minutos', 50, 28000, 'BRL', 'media-spa-zena-04', 'active', 4,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-drenagem-linfatica',
    'Drenagem Linfática Corporal',
    'Massagem que tem o objetivo de estimular o sistema linfático, reduzindo o inchaço e estimulando o sistema digestivo. É feita com movimentos lentos, suaves e superficiais no sentido dos linfonodos.',
    '50 minutos', 50, 26500, 'BRL', 'media-spa-zena-05', 'active', 5,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-dreno-modeladora',
    'Massagem Dreno-Modeladora',
    'Técnica completa que une os benefícios da drenagem linfática com a intensidade da massagem modeladora. Ativa a circulação sanguínea, auxilia na eliminação de toxinas, reduz o inchaço e contribui no tratamento da celulite e da gordura localizada. Além disso, ajuda a modelar regiões como o abdômen.',
    '50 minutos', 50, 28000, 'BRL', 'media-spa-zena-06', 'active', 6,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-massagem-kids',
    'Massagem Kids',
    'Massagem exclusiva para crianças de 4 a 12 anos, com manobras suaves e relaxantes capazes de acalmar e reduzir a hiperatividade.',
    '30 minutos', 30, 16500, 'BRL', 'media-spa-zena-07', 'active', 7,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-esfoliacao-corporal',
    'Esfoliação Corporal',
    'Terapia que tem o objetivo de esfoliar, renovar e hidratar a pele, deixando-a suave e lisa, com uma sensação intensa de hidratação e bem-estar.',
    '30 minutos', 30, 16500, 'BRL', 'media-spa-zena-08', 'active', 8,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-banho-imersao',
    'Banho de Imersão na Hidromassagem',
    'Relaxamento profundo em água aquecida a 36 °C, com espuma de banho e sais que potencializam as propriedades terapêuticas da imersão. A água aquecida e os jatos massageadores promovem alívio de tensões musculares e bem-estar imediato. Criado especialmente para uma ou duas pessoas.',
    '50 minutos', 50, 21500, 'BRL', 'media-spa-zena-09', 'active', 9,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-sal-chama',
    'Ritual Zena Sal & Chama',
    'O calor que abraça. O sal que purifica. Um ritual exclusivo que une o toque quente das velas à energia ancestral da pedra de sal rosa do Himalaia, criando uma experiência de purificação e presença profunda.',
    '1 hora', 60, 31000, 'BRL', 'media-spa-zena-10', 'active', 10,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-reflexologia-podal',
    'Reflexologia Podal',
    'A reflexologia podal consiste na aplicação de pressão em pontos dos pés, finalizada com massagem para equilibrar a energia do corpo e relaxar os pés depois de um dia inteiro em movimento.',
    '30 minutos', 30, 16500, 'BRL', 'media-spa-zena-11', 'active', 11,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-spa-day-relaxante',
    'Spa-Day Relaxante',
    'Ritual de boas-vindas, massagem relaxante, reflexologia podal e banho de imersão na hidromassagem.',
    '2 horas', 120, 54500, 'BRL', 'media-spa-zena-12', 'active', 13,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  ),
  (
    'spa-zena-spa-day-revigorante',
    'Spa-Day Revigorante',
    'Ritual de boas-vindas, drenagem linfática, esfoliação corporal e banho de imersão na hidromassagem.',
    '2 horas', 120, 54500, 'BRL', 'media-spa-zena-13', 'active', 14,
    '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z', NULL
  );
