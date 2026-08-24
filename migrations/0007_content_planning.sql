CREATE TABLE IF NOT EXISTS content_strategies (
  id uuid PRIMARY KEY,
  name varchar(120) NOT NULL,
  goal text NOT NULL,
  audience varchar(500),
  tone varchar(300),
  content_pillars jsonb NOT NULL DEFAULT '[]',
  avoid_topics jsonb NOT NULL DEFAULT '[]',
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_series (
  id uuid PRIMARY KEY,
  strategy_id uuid NOT NULL REFERENCES content_strategies(id),
  name varchar(120) NOT NULL,
  pillar varchar(100),
  target_count integer NOT NULL DEFAULT 1,
  order_mode varchar(30) NOT NULL DEFAULT 'sequential',
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_series_strategy_idx ON content_series(strategy_id, status);

CREATE TABLE IF NOT EXISTS content_briefs (
  id uuid PRIMARY KEY,
  series_id uuid NOT NULL REFERENCES content_series(id),
  sequence integer NOT NULL,
  title_direction varchar(300) NOT NULL,
  core_question varchar(500),
  angle varchar(500),
  summary text,
  must_cover jsonb NOT NULL DEFAULT '[]',
  must_avoid jsonb NOT NULL DEFAULT '[]',
  novelty_requirement text,
  status varchar(20) NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(series_id, sequence)
);

CREATE INDEX IF NOT EXISTS content_briefs_status_idx ON content_briefs(status, sequence);

ALTER TABLE articles ADD COLUMN IF NOT EXISTS strategy_id uuid REFERENCES content_strategies(id);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES content_series(id);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS brief_id uuid REFERENCES content_briefs(id);
CREATE INDEX IF NOT EXISTS articles_brief_idx ON articles(brief_id);
