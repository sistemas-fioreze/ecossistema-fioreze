PRAGMA foreign_keys = ON;

ALTER TABLE events ADD COLUMN content TEXT;
ALTER TABLE events ADD COLUMN location TEXT;
ALTER TABLE events ADD COLUMN category TEXT;
ALTER TABLE events
  ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json));

CREATE INDEX IF NOT EXISTS idx_events_hotel_category_status
  ON events(hotel_id, category, status, starts_at);
