PRAGMA foreign_keys = ON;

INSERT INTO hotel_settings (
  id, hotel_id, setting_key, setting_value, value_type, is_public, created_at, updated_at
) SELECT
  'setting-fiorezecentro-hotel-information-layout',
  'fiorezecentro',
  'portal.hotel_information.layout',
  'guest-guide',
  'string',
  1,
  '2026-08-01T12:30:00.000Z',
  '2026-08-01T12:30:00.000Z'
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro')
ON CONFLICT(hotel_id, setting_key) DO UPDATE SET
  setting_value = excluded.setting_value,
  value_type = excluded.value_type,
  is_public = excluded.is_public,
  updated_at = excluded.updated_at;

WITH centro_information (
  id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at
) AS (VALUES
  ('info-fiorezecentro-checkout', 'fiorezecentro', 'checkout', 'Check-out · até 12h', 'Informe-se na recepção sobre disponibilidade e valores para late check-out.', 1, 10, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z'),
  ('info-fiorezecentro-no-smoking', 'fiorezecentro', 'no-smoking', 'Proibido fumar', 'Não é permitido fumar nas dependências do hotel.', 1, 20, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z'),
  ('info-fiorezecentro-reception', 'fiorezecentro', 'reception', 'Recepção', 'Uma equipe sempre disposta a ajudá-lo, 24 horas por dia.', 1, 30, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z'),
  ('info-fiorezecentro-breakfast', 'fiorezecentro', 'breakfast', 'Restaurante', 'Café da manhã servido das 6h às 10h.', 1, 40, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z'),
  ('info-fiorezecentro-baby-kitchen', 'fiorezecentro', 'baby-kitchen', 'Copa Baby', 'Micro-ondas, liquidificador e minibar para pequenos preparos. Aberta 24 horas.', 1, 50, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z'),
  ('info-fiorezecentro-fitness', 'fiorezecentro', 'fitness', 'Espaço Fitness', 'Aberto das 7h às 22h.', 1, 60, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z'),
  ('info-fiorezecentro-kids', 'fiorezecentro', 'kids', 'Espaço Kids', 'Aberto das 9h às 22h.', 1, 70, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z'),
  ('info-fiorezecentro-lounge', 'fiorezecentro', 'lounge', 'Sala de Estar', 'Disponível 24 horas.', 1, 80, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z'),
  ('info-fiorezecentro-tech', 'fiorezecentro', 'tech', 'Espaço Tech', 'Disponível 24 horas.', 1, 90, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z'),
  ('info-fiorezecentro-wifi', 'fiorezecentro', 'wifi', 'Wi-Fi', 'Wi-Fi gratuito disponível. Consulte os dados de acesso na recepção.', 1, 100, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z'),
  ('info-fiorezecentro-voltage', 'fiorezecentro', 'voltage', 'Voltagem', '220 V.', 1, 110, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z'),
  ('info-fiorezecentro-quiet-hours', 'fiorezecentro', 'quiet-hours', 'Horário de silêncio', 'Das 22h às 8h.', 1, 120, '2026-08-01T12:30:00.000Z', '2026-08-01T12:30:00.000Z')
)
INSERT INTO hotel_information (
  id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at
)
SELECT id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at
  FROM centro_information
 WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro')
ON CONFLICT(hotel_id, info_key) DO UPDATE SET
  title = excluded.title,
  body = excluded.body,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
