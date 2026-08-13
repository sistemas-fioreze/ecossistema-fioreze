PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX IF NOT EXISTS uq_printer_devices_single_connected
  ON printer_devices(hotel_id, module_key)
  WHERE status IN ('active', 'paused');
