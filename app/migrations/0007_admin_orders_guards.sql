-- Pre-check before applying this migration remotely:
-- SELECT order_id, status, COUNT(*) AS total
-- FROM order_status_history
-- GROUP BY order_id, status
-- HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_status_history_order_status
ON order_status_history(order_id, status);
