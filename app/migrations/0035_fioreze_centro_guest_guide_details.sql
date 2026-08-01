PRAGMA foreign_keys = ON;

UPDATE hotel_information
   SET body = 'Uma equipe sempre disposta a ajudá-lo, 24 horas por dia.' || char(10) || 'Ramal n° 9 do telefone da acomodação.',
       updated_at = '2026-08-01T13:30:00.000Z'
 WHERE hotel_id = 'fiorezecentro'
   AND info_key = 'reception';

UPDATE hotel_information
   SET title = 'Café da manhã',
       body = 'Servido diariamente das 6h às 10h.',
       updated_at = '2026-08-01T13:30:00.000Z'
 WHERE hotel_id = 'fiorezecentro'
   AND info_key = 'breakfast';

UPDATE hotel_information
   SET info_key = 'espaco-tche',
       title = 'Espaço Tchê',
       body = 'Disponível 24 horas.',
       updated_at = '2026-08-01T13:30:00.000Z'
 WHERE hotel_id = 'fiorezecentro'
   AND info_key = 'tech';

UPDATE hotel_information
   SET body = 'Rede: Hotel Fioreze Centro.' || char(10) || 'Código de acesso: hotelcentro.',
       updated_at = '2026-08-01T13:30:00.000Z'
 WHERE hotel_id = 'fiorezecentro'
   AND info_key = 'wifi';

INSERT INTO hotel_information (
  id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at
) SELECT
  'info-fiorezecentro-room-service',
  'fiorezecentro',
  'room-service',
  'Room Service',
  'Consulte o horário de funcionamento do Room Service.',
  1,
  45,
  '2026-08-01T13:30:00.000Z',
  '2026-08-01T13:30:00.000Z'
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro')
ON CONFLICT(hotel_id, info_key) DO UPDATE SET
  title = excluded.title,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
