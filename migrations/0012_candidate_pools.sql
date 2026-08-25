CREATE TABLE IF NOT EXISTS candidate_pools (
  id uuid PRIMARY KEY,
  pool_date date NOT NULL UNIQUE,
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Shanghai',
  status varchar(20) NOT NULL DEFAULT 'open',
  version integer NOT NULL DEFAULT 1,
  last_evaluated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_candidates (
  id uuid PRIMARY KEY,
  pool_id uuid NOT NULL REFERENCES candidate_pools(id) ON DELETE CASCADE,
  external_id varchar(200) NOT NULL,
  title varchar(120) NOT NULL,
  content text NOT NULL,
  content_format varchar(20) NOT NULL DEFAULT 'html',
  author varchar(100),
  digest varchar(300),
  summary text,
  outline jsonb NOT NULL DEFAULT '[]',
  topics jsonb NOT NULL DEFAULT '[]',
  keywords jsonb NOT NULL DEFAULT '[]',
  cover_url text,
  source varchar(100),
  strategy_id uuid,
  series_id uuid,
  brief_id uuid,
  status varchar(20) NOT NULL DEFAULT 'candidate',
  similarity numeric(6,4) NOT NULL DEFAULT 0,
  score numeric(6,4) NOT NULL DEFAULT 0,
  risk varchar(20) NOT NULL DEFAULT 'low',
  warnings jsonb NOT NULL DEFAULT '[]',
  matched_article_id uuid,
  accepted_article_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pool_id, external_id)
);

CREATE INDEX IF NOT EXISTS candidate_pools_date_idx ON candidate_pools(pool_date, status);
CREATE INDEX IF NOT EXISTS content_candidates_pool_score_idx ON content_candidates(pool_id, score DESC, status);
