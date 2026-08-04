PRAGMA foreign_keys = ON;

INSERT INTO hotel_settings (
  id, hotel_id, setting_key, setting_value, value_type, is_public, created_at, updated_at
) SELECT
  'setting-muller-hotel-information-layout',
  'muller-fioreze',
  'portal.hotel_information.layout',
  'guest-guide',
  'string',
  1,
  '2026-08-04T15:00:00.000Z',
  '2026-08-04T15:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'muller-fioreze')
ON CONFLICT(hotel_id, setting_key) DO UPDATE SET
  setting_value = excluded.setting_value,
  value_type = excluded.value_type,
  is_public = excluded.is_public,
  updated_at = excluded.updated_at;

WITH muller_information (
  id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at
) AS (VALUES
  ('info-muller-checkout', 'muller-fioreze', 'checkout', 'Check-out · até 12h', 'Informe-se na recepção sobre disponibilidade e valores para late check-out.', 1, 10, '2026-08-04T15:00:00.000Z', '2026-08-04T15:00:00.000Z'),
  ('info-muller-no-smoking', 'muller-fioreze', 'no-smoking', 'Proibido fumar', 'Não é permitido fumar nas dependências do hotel.', 1, 20, '2026-08-04T15:00:00.000Z', '2026-08-04T15:00:00.000Z'),
  ('info-muller-reception', 'muller-fioreze', 'reception', 'Recepção', 'Uma equipe sempre disposta a ajudá-lo, 24 horas por dia.' || char(10) || 'Ramal n° 9 do telefone da acomodação.', 1, 30, '2026-08-04T15:00:00.000Z', '2026-08-04T15:00:00.000Z'),
  ('info-muller-breakfast', 'muller-fioreze', 'breakfast', 'Café da manhã', 'Servido diariamente das 7h às 10h.', 1, 40, '2026-08-04T15:00:00.000Z', '2026-08-04T15:00:00.000Z'),
  ('info-muller-room-service', 'muller-fioreze', 'room-service', 'Room Service', 'Consulte o horário de funcionamento do Room Service.', 1, 45, '2026-08-04T15:00:00.000Z', '2026-08-04T15:00:00.000Z'),
  ('info-muller-fitness', 'muller-fioreze', 'fitness', 'Academia', 'Consulte a recepção.', 1, 60, '2026-08-04T15:00:00.000Z', '2026-08-04T15:00:00.000Z'),
  ('info-muller-lounge', 'muller-fioreze', 'lounge', 'Sala de Estar', 'Disponível 24 horas.', 1, 80, '2026-08-04T15:00:00.000Z', '2026-08-04T15:00:00.000Z'),
  ('info-muller-wifi', 'muller-fioreze', 'wifi', 'Wi-Fi', 'Rede: Müller & Fioreze - Hotel Boutique' || char(10) || 'Rede aberta, sem senha', 1, 100, '2026-08-04T15:00:00.000Z', '2026-08-04T15:00:00.000Z'),
  ('info-muller-voltage', 'muller-fioreze', 'voltage', 'Voltagem', '220 V.', 1, 110, '2026-08-04T15:00:00.000Z', '2026-08-04T15:00:00.000Z'),
  ('info-muller-quiet-hours', 'muller-fioreze', 'quiet-hours', 'Horário de silêncio', 'Das 22h às 8h.', 1, 120, '2026-08-04T15:00:00.000Z', '2026-08-04T15:00:00.000Z')
)
INSERT INTO hotel_information (
  id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at
)
SELECT id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at
  FROM muller_information
 WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'muller-fioreze')
ON CONFLICT(hotel_id, info_key) DO UPDATE SET
  title = excluded.title,
  body = excluded.body,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;

UPDATE hotel_information
   SET is_public = 0,
       updated_at = '2026-08-04T15:00:00.000Z'
 WHERE hotel_id = 'muller-fioreze'
   AND info_key IN ('checkout-demo', 'baby-kitchen', 'kids', 'tech', 'espaco-tche');

UPDATE hotel_information
   SET body = 'Servido diariamente das 6h30 às 10h.',
       updated_at = '2026-08-04T15:00:00.000Z'
 WHERE hotel_id = 'fiorezecentro'
   AND info_key = 'breakfast';

UPDATE hotel_information
   SET body = 'Rede: Hotel Fioreze Centro' || char(10) || 'Código de acesso: hotelcentro',
       updated_at = '2026-08-04T15:00:00.000Z'
 WHERE hotel_id = 'fiorezecentro'
   AND info_key = 'wifi';
