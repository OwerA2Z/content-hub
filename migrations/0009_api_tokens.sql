CREATE TABLE IF NOT EXISTS api_tokens (
  id uuid PRIMARY KEY,
  name varchar(120) NOT NULL,
  kind varchar(20) NOT NULL,
  token_hash varchar(64) NOT NULL UNIQUE,
  token_prefix varchar(16) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS api_tokens_kind_idx ON api_tokens(kind, revoked_at);
