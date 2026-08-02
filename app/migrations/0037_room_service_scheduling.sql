PRAGMA foreign_keys = ON;

ALTER TABLE orders
ADD COLUMN preparation_mode TEXT NOT NULL DEFAULT 'now'
CHECK (preparation_mode IN ('now', 'scheduled'));

ALTER TABLE orders
ADD COLUMN scheduled_for TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_hotel_module_scheduled
ON orders(hotel_id, module_key, scheduled_for)
WHERE scheduled_for IS NOT NULL;
