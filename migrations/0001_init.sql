CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY,
  external_id varchar(200),
  source varchar(100),
  title varchar(120) NOT NULL,
  content text NOT NULL,
  content_format varchar(20) NOT NULL DEFAULT 'html',
  author varchar(100),
  digest varchar(300),
  cover_url text,
  images jsonb NOT NULL DEFAULT '[]',
  metadata jsonb NOT NULL DEFAULT '{}',
  status varchar(30) NOT NULL DEFAULT 'uploaded',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status);
CREATE INDEX IF NOT EXISTS articles_created_at_idx ON articles(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS articles_source_external_id_uq
  ON articles(source, external_id)
  WHERE source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS channel_operations (
  id uuid PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES articles(id),
  provider varchar(30) NOT NULL,
  action varchar(30) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'pending',
  external_id text,
  error_message text,
  request_id varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS channel_operations_article_idx ON channel_operations(article_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS channel_operations_pending_uq
  ON channel_operations(article_id, provider, action)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY,
  action varchar(60) NOT NULL,
  actor_type varchar(30) NOT NULL,
  actor_id varchar(120),
  article_id uuid,
  operation_id uuid,
  ip varchar(100),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(100) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
