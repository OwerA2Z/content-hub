ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS wechat_publish_id text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS publish_confirmed boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS articles_ai_published_idx
  ON articles(published_at DESC, id DESC)
  WHERE status = 'published' AND publish_confirmed = true AND archived_at IS NULL;
