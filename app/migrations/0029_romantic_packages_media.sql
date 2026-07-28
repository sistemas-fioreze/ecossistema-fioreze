PRAGMA foreign_keys = ON;

ALTER TABLE romantic_packages
  ADD COLUMN media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_romantic_packages_hotel_media
  ON romantic_packages(hotel_id, media_asset_id);
