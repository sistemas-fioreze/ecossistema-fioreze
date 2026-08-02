PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS printer_templates (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL DEFAULT 'room-service' REFERENCES modules(module_key) ON DELETE RESTRICT,
  template_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config_json TEXT NOT NULL CHECK (json_valid(config_json)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  UNIQUE (hotel_id, module_key, template_key)
);

CREATE TABLE IF NOT EXISTS printer_devices (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL DEFAULT 'room-service' REFERENCES modules(module_key) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'windows',
  app_version TEXT,
  printer_name TEXT,
  template_id TEXT REFERENCES printer_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
  enrolled_by_admin_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  enrolled_by_erp_user_id TEXT REFERENCES erp_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS printer_enrollment_codes (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL DEFAULT 'room-service' REFERENCES modules(module_key) ON DELETE RESTRICT,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_by_admin_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_by_erp_user_id TEXT REFERENCES erp_users(id) ON DELETE SET NULL,
  used_by_device_id TEXT REFERENCES printer_devices(id) ON DELETE SET NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

ALTER TABLE print_events ADD COLUMN device_id TEXT REFERENCES printer_devices(id) ON DELETE SET NULL;
ALTER TABLE print_events ADD COLUMN template_id TEXT REFERENCES printer_templates(id) ON DELETE SET NULL;
ALTER TABLE print_events ADD COLUMN request_key TEXT;
ALTER TABLE print_events ADD COLUMN claim_token_hash TEXT;
ALTER TABLE print_events ADD COLUMN claimed_at TEXT;
ALTER TABLE print_events ADD COLUMN claim_expires_at TEXT;
ALTER TABLE print_events ADD COLUMN completed_at TEXT;
ALTER TABLE print_events ADD COLUMN job_kind TEXT NOT NULL DEFAULT 'automatic'
  CHECK (job_kind IN ('automatic', 'manual', 'reprint'));

CREATE INDEX IF NOT EXISTS idx_printer_templates_hotel_status
  ON printer_templates(hotel_id, module_key, status, is_default);

CREATE UNIQUE INDEX IF NOT EXISTS uq_printer_templates_default
  ON printer_templates(hotel_id, module_key)
  WHERE is_default = 1 AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_printer_devices_hotel_status
  ON printer_devices(hotel_id, module_key, status, last_seen_at);

CREATE INDEX IF NOT EXISTS idx_printer_enrollment_expiry
  ON printer_enrollment_codes(hotel_id, expires_at, used_at);

CREATE INDEX IF NOT EXISTS idx_print_events_claim_queue
  ON print_events(hotel_id, module_key, status, claim_expires_at, requested_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_print_events_request_key
  ON print_events(hotel_id, module_key, request_key)
  WHERE request_key IS NOT NULL;

INSERT OR IGNORE INTO printer_templates (
  id, hotel_id, module_key, template_key, name, description,
  config_json, is_default, status, created_at, updated_at
)
SELECT
  'print-template-legacy-' || h.id,
  h.id,
  'room-service',
  'legacy-thermal-42',
  'Comprovante termico classico',
  'Template baseado no comprovante do sistema legado, parametrizado por unidade.',
  '{"version":1,"paper_columns":42,"show_logo":true,"copies":[{"key":"establishment","title":"VIA ESTABELECIMENTO","signature":false},{"key":"guest","title":"VIA DO HOSPEDE","signature":true}],"sections":["hotel","order","items","total","notes"]}',
  1,
  'active',
  '2026-08-02T00:00:00.000Z',
  '2026-08-02T00:00:00.000Z'
FROM hotels h
JOIN hotel_modules hm ON hm.hotel_id = h.id
WHERE hm.module_key = 'room-service';

INSERT OR IGNORE INTO hotel_settings (
  id, hotel_id, setting_key, setting_value, value_type, is_public, created_at, updated_at
)
SELECT
  'setting-print-enabled-' || h.id,
  h.id,
  'room-service.printing_enabled',
  'false',
  'boolean',
  0,
  '2026-08-02T00:00:00.000Z',
  '2026-08-02T00:00:00.000Z'
FROM hotels h
JOIN hotel_modules hm ON hm.hotel_id = h.id
WHERE hm.module_key = 'room-service';

CREATE TRIGGER IF NOT EXISTS trg_hotels_room_service_print_template
AFTER INSERT ON hotel_modules
WHEN NEW.module_key = 'room-service'
BEGIN
  INSERT OR IGNORE INTO printer_templates (
    id, hotel_id, module_key, template_key, name, description,
    config_json, is_default, status, created_at, updated_at
  ) VALUES (
    'print-template-legacy-' || NEW.hotel_id,
    NEW.hotel_id,
    'room-service',
    'legacy-thermal-42',
    'Comprovante termico classico',
    'Template baseado no comprovante do sistema legado, parametrizado por unidade.',
    '{"version":1,"paper_columns":42,"show_logo":true,"copies":[{"key":"establishment","title":"VIA ESTABELECIMENTO","signature":false},{"key":"guest","title":"VIA DO HOSPEDE","signature":true}],"sections":["hotel","order","items","total","notes"]}',
    1,
    'active',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  );

  INSERT OR IGNORE INTO hotel_settings (
    id, hotel_id, setting_key, setting_value, value_type, is_public, created_at, updated_at
  ) VALUES (
    'setting-print-enabled-' || NEW.hotel_id,
    NEW.hotel_id,
    'room-service.printing_enabled',
    'false',
    'boolean',
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  );
END;
