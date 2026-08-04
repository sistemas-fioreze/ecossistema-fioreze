PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS event_occurrences (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  timezone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, starts_at),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_event_occurrences_event_time
  ON event_occurrences(event_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_event_occurrences_hotel_time
  ON event_occurrences(hotel_id, starts_at);

WITH fioreze_centro_events (
  id, hotel_id, title, summary, content, location, category, tags_json,
  starts_at, ends_at, timezone, status, is_permanent, created_at, updated_at
) AS (VALUES
  (
    'event-fiorezecentro-tea-apfelstrudel',
    'fiorezecentro',
    'Chá da Tarde | Apfelstrudel',
    'Uma tarde de sabores e acolhimento, com apfelstrudel e lanchinhos preparados para nossos hóspedes.',
    'Faça uma pausa no roteiro e aproveite uma tarde preparada com o carinho da Família Fioreze.' || char(10) || char(10) ||
    'O destaque deste encontro é o tradicional apfelstrudel, acompanhado de outros lanchinhos que tornam o momento ainda mais gostoso.' || char(10) || char(10) ||
    'Uma oportunidade para desacelerar, conversar e experimentar um sabor que combina perfeitamente com o clima de Gramado.' || char(10) || char(10) ||
    'Horário: das 16h às 18h.',
    'Hotel Fioreze Centro',
    'Chá da Tarde',
    '["Chá da Tarde","Apfelstrudel"]',
    '2026-08-05T19:00:00.000Z',
    '2026-08-19T21:00:00.000Z',
    'America/Sao_Paulo',
    'published',
    0,
    '2026-08-04T17:00:00.000Z',
    '2026-08-04T17:00:00.000Z'
  ),
  (
    'event-fiorezecentro-tea-waffles',
    'fiorezecentro',
    'Chá da Tarde | Waffles',
    'Waffles e outros lanchinhos servidos em uma tarde de aconchego no Fioreze Centro.',
    'Depois de aproveitar Gramado, nada melhor do que encontrar uma mesa preparada com carinho esperando por você.' || char(10) || char(10) ||
    'Neste Chá da Tarde, servimos waffles acompanhados de outros lanchinhos, criando uma pausa saborosa e acolhedora durante a hospedagem.' || char(10) || char(10) ||
    'Um momento simples, gostoso e com aquele jeito da Família Fioreze de receber.' || char(10) || char(10) ||
    'Horário: das 16h às 18h.',
    'Hotel Fioreze Centro',
    'Chá da Tarde',
    '["Chá da Tarde","Waffles"]',
    '2026-08-12T19:00:00.000Z',
    '2026-08-26T21:00:00.000Z',
    'America/Sao_Paulo',
    'published',
    0,
    '2026-08-04T17:00:00.000Z',
    '2026-08-04T17:00:00.000Z'
  ),
  (
    'event-fiorezecentro-sabores-serra',
    'fiorezecentro',
    'Sabores da Serra',
    'Uma degustação de queijos, salames e geleias que representam os sabores da Serra Gaúcha.',
    'A Serra Gaúcha também pode ser conhecida por seus sabores.' || char(10) || char(10) ||
    'Nesta experiência, nossos hóspedes são convidados a degustar uma seleção de queijos, salames e geleias comercializados na região, descobrindo combinações que fazem parte da cultura gastronômica local.' || char(10) || char(10) ||
    'Mais do que uma degustação, é um momento para compartilhar, experimentar e levar novas lembranças de Gramado para casa.' || char(10) || char(10) ||
    'Horário: das 16h às 19h.',
    'Hotel Fioreze Centro',
    'Degustação',
    '["Degustação","Serra Gaúcha"]',
    '2026-08-06T19:00:00.000Z',
    '2026-08-27T22:00:00.000Z',
    'America/Sao_Paulo',
    'published',
    0,
    '2026-08-04T17:00:00.000Z',
    '2026-08-04T17:00:00.000Z'
  ),
  (
    'event-fiorezecentro-brinde-sabado',
    'fiorezecentro',
    'Brinde de Sábado',
    'Vinhos, espumantes e um encontro especial para brindar o sábado no Fioreze Centro.',
    'Todo sábado merece um momento especial para brindar.' || char(10) || char(10) ||
    'No Brinde de Sábado, nossos hóspedes podem conhecer e degustar uma seleção de vinhos e espumantes, em um encontro leve e acolhedor preparado para aproveitar o fim de tarde.' || char(10) || char(10) ||
    'Uma experiência para descobrir novos sabores, compartilhar boas conversas e celebrar mais um dia vivido em Gramado.' || char(10) || char(10) ||
    'Horário: das 16h às 18h.',
    'Hotel Fioreze Centro',
    'Coquetel',
    '["Coquetel","Vinhos","Espumantes"]',
    '2026-08-01T19:00:00.000Z',
    '2026-08-29T21:00:00.000Z',
    'America/Sao_Paulo',
    'published',
    0,
    '2026-08-04T17:00:00.000Z',
    '2026-08-04T17:00:00.000Z'
  )
)
INSERT INTO events (
  id, hotel_id, title, summary, content, location, category, tags_json,
  starts_at, ends_at, timezone, status, is_permanent, created_at, updated_at
)
SELECT
  id, hotel_id, title, summary, content, location, category, tags_json,
  starts_at, ends_at, timezone, status, is_permanent, created_at, updated_at
FROM fioreze_centro_events
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro')
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  location = excluded.location,
  category = excluded.category,
  tags_json = excluded.tags_json,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  timezone = excluded.timezone,
  status = excluded.status,
  is_permanent = excluded.is_permanent,
  updated_at = excluded.updated_at;

WITH fioreze_centro_occurrences (
  id, event_id, hotel_id, starts_at, ends_at, timezone, created_at, updated_at
) AS (VALUES
  ('occ-fiorezecentro-apfel-20260805', 'event-fiorezecentro-tea-apfelstrudel', 'fiorezecentro', '2026-08-05T19:00:00.000Z', '2026-08-05T21:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-apfel-20260819', 'event-fiorezecentro-tea-apfelstrudel', 'fiorezecentro', '2026-08-19T19:00:00.000Z', '2026-08-19T21:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-waffles-20260812', 'event-fiorezecentro-tea-waffles', 'fiorezecentro', '2026-08-12T19:00:00.000Z', '2026-08-12T21:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-waffles-20260826', 'event-fiorezecentro-tea-waffles', 'fiorezecentro', '2026-08-26T19:00:00.000Z', '2026-08-26T21:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-serra-20260806', 'event-fiorezecentro-sabores-serra', 'fiorezecentro', '2026-08-06T19:00:00.000Z', '2026-08-06T22:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-serra-20260813', 'event-fiorezecentro-sabores-serra', 'fiorezecentro', '2026-08-13T19:00:00.000Z', '2026-08-13T22:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-serra-20260820', 'event-fiorezecentro-sabores-serra', 'fiorezecentro', '2026-08-20T19:00:00.000Z', '2026-08-20T22:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-serra-20260827', 'event-fiorezecentro-sabores-serra', 'fiorezecentro', '2026-08-27T19:00:00.000Z', '2026-08-27T22:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-brinde-20260801', 'event-fiorezecentro-brinde-sabado', 'fiorezecentro', '2026-08-01T19:00:00.000Z', '2026-08-01T21:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-brinde-20260808', 'event-fiorezecentro-brinde-sabado', 'fiorezecentro', '2026-08-08T19:00:00.000Z', '2026-08-08T21:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-brinde-20260815', 'event-fiorezecentro-brinde-sabado', 'fiorezecentro', '2026-08-15T19:00:00.000Z', '2026-08-15T21:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-brinde-20260822', 'event-fiorezecentro-brinde-sabado', 'fiorezecentro', '2026-08-22T19:00:00.000Z', '2026-08-22T21:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z'),
  ('occ-fiorezecentro-brinde-20260829', 'event-fiorezecentro-brinde-sabado', 'fiorezecentro', '2026-08-29T19:00:00.000Z', '2026-08-29T21:00:00.000Z', 'America/Sao_Paulo', '2026-08-04T17:00:00.000Z', '2026-08-04T17:00:00.000Z')
)
INSERT INTO event_occurrences (
  id, event_id, hotel_id, starts_at, ends_at, timezone, created_at, updated_at
)
SELECT
  id, event_id, hotel_id, starts_at, ends_at, timezone, created_at, updated_at
FROM fioreze_centro_occurrences
WHERE EXISTS (SELECT 1 FROM events WHERE id = fioreze_centro_occurrences.event_id)
ON CONFLICT(event_id, starts_at) DO UPDATE SET
  ends_at = excluded.ends_at,
  timezone = excluded.timezone,
  updated_at = excluded.updated_at;
