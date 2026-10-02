-- Recovered from the active fioreze-portais-dev D1 schema on 2026-10-02.
ALTER TABLE orders ADD COLUMN display_number INTEGER
  CHECK (display_number IS NULL OR display_number > 0);

UPDATE orders
   SET display_number = (
     SELECT COUNT(*)
       FROM orders sequence
      WHERE sequence.hotel_id = orders.hotel_id
        AND sequence.module_key = orders.module_key
        AND (
          sequence.created_at < orders.created_at
          OR (sequence.created_at = orders.created_at AND sequence.id <= orders.id)
        )
   );

CREATE UNIQUE INDEX uq_orders_hotel_module_display_number
  ON orders(hotel_id, module_key, display_number);

CREATE TRIGGER set_order_display_number_after_insert
AFTER INSERT ON orders
FOR EACH ROW
WHEN NEW.display_number IS NULL
BEGIN
  UPDATE orders
  SET display_number = (
    SELECT COALESCE(MAX(sequence.display_number), 0) + 1
    FROM orders sequence
    WHERE sequence.hotel_id = NEW.hotel_id
      AND sequence.module_key = NEW.module_key
      AND sequence.id <> NEW.id
  )
  WHERE id = NEW.id;
END;
