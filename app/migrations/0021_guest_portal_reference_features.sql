PRAGMA foreign_keys = ON;

ALTER TABLE events
  ADD COLUMN media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_hotel_media
  ON events(hotel_id, media_asset_id);
