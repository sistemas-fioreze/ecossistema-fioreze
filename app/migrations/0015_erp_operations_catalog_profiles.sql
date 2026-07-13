PRAGMA foreign_keys = ON;

ALTER TABLE catalog_items ADD COLUMN media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL;

ALTER TABLE media_assets ADD COLUMN uploaded_by_erp_user_id TEXT;

ALTER TABLE erp_users ADD COLUMN avatar_media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE erp_users ADD COLUMN avatar_updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_catalog_items_media_asset
  ON catalog_items(hotel_id, module_key, media_asset_id);

CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by_erp
  ON media_assets(uploaded_by_erp_user_id);

CREATE INDEX IF NOT EXISTS idx_erp_users_avatar
  ON erp_users(hotel_id, avatar_media_asset_id);
