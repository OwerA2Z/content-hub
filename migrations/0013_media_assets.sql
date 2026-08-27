CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY,
  kind varchar(20) NOT NULL DEFAULT 'image',
  original_name varchar(255) NOT NULL,
  storage_key varchar(500) NOT NULL UNIQUE,
  mime_type varchar(100) NOT NULL,
  size_bytes bigint NOT NULL,
  width integer,
  height integer,
  alt varchar(500),
  tags jsonb NOT NULL DEFAULT '[]',
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_assets_status_created_idx ON media_assets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS media_assets_tags_idx ON media_assets USING gin(tags);

ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE content_candidates ADD COLUMN IF NOT EXISTS cover_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS articles_cover_asset_idx ON articles(cover_asset_id);
CREATE INDEX IF NOT EXISTS content_candidates_cover_asset_idx ON content_candidates(cover_asset_id);
