PRAGMA foreign_keys = ON;

UPDATE printer_templates
   SET is_default = 0,
       updated_at = '2026-08-04T00:00:00.000Z'
 WHERE hotel_id = 'fiorezecentro'
   AND module_key = 'room-service'
   AND is_default = 1;

INSERT INTO printer_templates (
  id, hotel_id, module_key, template_key, name, description,
  config_json, is_default, status, created_at, updated_at
)
SELECT
  'print-template-centro-elgin-48',
  'fiorezecentro',
  'room-service',
  'legacy-centro-elgin-48',
  'Fioreze Centro - Elgin 48 colunas',
  'Duas vias adaptadas do comprovante operacional do Fioreze Centro.',
  '{"version":2,"layout_key":"legacy-centro-elgin-48","paper_columns":48,"paper_width_pixels":384,"show_logo":true,"header_lines":["GRAMADO - RS","RECEPCAO: RAMAL 9"],"copies":[{"key":"kitchen","title":"VIA COZINHA/RECEP","signature":true},{"key":"guest","title":"VIA DO HOSPEDE","signature":false}],"guest_footer":["FAMILIA FIOREZE","OBRIGADO E BOM APETITE"]}',
  1,
  'active',
  '2026-08-04T00:00:00.000Z',
  '2026-08-04T00:00:00.000Z'
WHERE EXISTS (
  SELECT 1 FROM hotels h
   WHERE h.id = 'fiorezecentro'
     AND h.status = 'active'
     AND h.archived_at IS NULL
)
ON CONFLICT(hotel_id, module_key, template_key) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  config_json = excluded.config_json,
  is_default = 1,
  status = 'active',
  archived_at = NULL,
  updated_at = excluded.updated_at;
