-- Eventos permanentes continuam publicados depois da data programada.

ALTER TABLE events
ADD COLUMN is_permanent INTEGER NOT NULL DEFAULT 0
CHECK (is_permanent IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_events_public_lifecycle
  ON events(status, is_permanent, starts_at);
