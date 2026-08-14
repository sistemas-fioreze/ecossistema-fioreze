PRAGMA foreign_keys = ON;

CREATE TABLE room_service_guest_directory (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL DEFAULT 'room-service' REFERENCES modules(module_key) ON DELETE RESTRICT,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  room_code TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'public-web' CHECK (source IN ('public-web', 'admin_pdv')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  archived_at TEXT,
  archived_by_admin_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  archived_by_erp_user_id TEXT REFERENCES erp_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (hotel_id, module_key, room_code)
);

CREATE INDEX idx_room_service_guest_directory_active
  ON room_service_guest_directory (hotel_id, module_key, status, last_seen_at DESC);

CREATE INDEX idx_room_service_guest_directory_last_order
  ON room_service_guest_directory (last_order_id);
