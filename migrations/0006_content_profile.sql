ALTER TABLE articles ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS outline jsonb NOT NULL DEFAULT '[]';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS topics jsonb NOT NULL DEFAULT '[]';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS keywords jsonb NOT NULL DEFAULT '[]';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_hash varchar(64);
CREATE INDEX IF NOT EXISTS articles_content_hash_idx ON articles(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS articles_dedup_status_idx ON articles(status, archived_at);
