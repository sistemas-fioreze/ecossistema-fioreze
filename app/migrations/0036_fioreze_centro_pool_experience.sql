PRAGMA foreign_keys = ON;

INSERT INTO hotel_settings (
  id, hotel_id, setting_key, setting_value, value_type, is_public, created_at, updated_at
) SELECT
  'setting-fiorezecentro-service-experiences',
  'fiorezecentro',
  'portal.services.extra_items',
  '[{"id":"pool","title":"Piscina (Origem e Quero-Quero)","description":"Acesso disponível para hóspedes da rede.","icon_key":"pool","image_url":"/assets/hotels/fioreze-centro/piscina.jpg","sort_order":50,"enabled":true}]',
  'json',
  1,
  '2026-08-01T14:10:00.000Z',
  '2026-08-01T14:10:00.000Z'
WHERE EXISTS (SELECT 1 FROM hotels WHERE id = 'fiorezecentro')
ON CONFLICT(hotel_id, setting_key) DO UPDATE SET
  setting_value = excluded.setting_value,
  value_type = excluded.value_type,
  is_public = excluded.is_public,
  updated_at = excluded.updated_at;
