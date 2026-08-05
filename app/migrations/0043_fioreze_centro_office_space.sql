PRAGMA foreign_keys = ON;

INSERT INTO hotel_information (
  id, hotel_id, info_key, title, body, is_public, sort_order, created_at, updated_at
) SELECT
  'info-fiorezecentro-office',
  'fiorezecentro',
  'office',
  'Espaço Office',
  'Aberto das 9h às 22h.',
  1,
  75,
  '2026-08-05T15:00:00.000Z',
  '2026-08-05T15:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro')
ON CONFLICT(hotel_id, info_key) DO UPDATE SET
  title = excluded.title,
  body = excluded.body,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
