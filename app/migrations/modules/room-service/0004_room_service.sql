PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS catalogs (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  catalog_id TEXT NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (catalog_id, name)
);

CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  catalog_id TEXT NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE RESTRICT,
  item_type TEXT NOT NULL DEFAULT 'product',
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS catalog_item_availability (
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  catalog_item_id TEXT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
  availability_label TEXT,
  starts_at TEXT,
  ends_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (hotel_id, catalog_item_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE RESTRICT,
  origin TEXT NOT NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  room_code TEXT,
  guest_name TEXT,
  notes TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled', 'archived')),
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cancelled_at TEXT,
  archived_at TEXT,
  UNIQUE (hotel_id, module_key, idempotency_key)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE RESTRICT,
  catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
  item_name_snapshot TEXT NOT NULL,
  item_description_snapshot TEXT,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
  selected_options_snapshot TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES modules(module_key) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  note TEXT,
  actor_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS print_events (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL DEFAULT 'room-service' REFERENCES modules(module_key) ON DELETE RESTRICT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  printer_id TEXT,
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled', 'queued', 'printing', 'printed', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  requested_at TEXT NOT NULL,
  printed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalogs_hotel_module ON catalogs(hotel_id, module_key, status);
CREATE INDEX IF NOT EXISTS idx_categories_catalog_order ON categories(catalog_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_catalog_items_hotel_module_status ON catalog_items(hotel_id, module_key, status);
CREATE INDEX IF NOT EXISTS idx_catalog_items_catalog_category ON catalog_items(catalog_id, category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_availability_hotel ON catalog_item_availability(hotel_id, is_available);
CREATE INDEX IF NOT EXISTS idx_orders_hotel_module_status ON orders(hotel_id, module_key, status);
CREATE INDEX IF NOT EXISTS idx_orders_hotel_created ON orders(hotel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_hotel_module ON order_items(hotel_id, module_key);
CREATE INDEX IF NOT EXISTS idx_order_status_order_created ON order_status_history(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_print_events_hotel_status ON print_events(hotel_id, status);
