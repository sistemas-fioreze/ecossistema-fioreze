PRAGMA foreign_keys = ON;

-- D1/SQLite only supports simple nullable ADD COLUMN safely here.
-- uploaded_by_user_id and archived_by_user_id are validated by application code.
ALTER TABLE media_assets ADD COLUMN original_filename TEXT;
ALTER TABLE media_assets ADD COLUMN size_bytes INTEGER;
ALTER TABLE media_assets ADD COLUMN checksum_sha256 TEXT;
ALTER TABLE media_assets ADD COLUMN storage_etag TEXT;
ALTER TABLE media_assets ADD COLUMN uploaded_by_user_id TEXT;
ALTER TABLE media_assets ADD COLUMN archived_by_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_media_assets_hotel_status_created
  ON media_assets(hotel_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_media_assets_checksum
  ON media_assets(checksum_sha256);

CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by
  ON media_assets(uploaded_by_user_id);

INSERT INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at)
SELECT 'perm-portals-media-read', 'portals.media.read', NULL,
       'Visualizar biblioteca de imagens da Central de Portais.',
       '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE permission_key = 'portals.media.read'
);

INSERT INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at)
SELECT 'perm-portals-media-upload', 'portals.media.upload', NULL,
       'Enviar imagens para a biblioteca da Central de Portais.',
       '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE permission_key = 'portals.media.upload'
);

INSERT INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at)
SELECT 'perm-portals-media-update', 'portals.media.update', NULL,
       'Atualizar metadados publicos da biblioteca de imagens.',
       '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE permission_key = 'portals.media.update'
);

INSERT INTO admin_permissions (id, permission_key, module_key, description, created_at, updated_at)
SELECT 'perm-portals-media-archive', 'portals.media.archive', NULL,
       'Arquivar imagens da biblioteca sem excluir objetos R2.',
       '2026-07-07T00:00:00.000Z', '2026-07-07T00:00:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE permission_key = 'portals.media.archive'
);
