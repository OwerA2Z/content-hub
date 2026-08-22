CREATE TABLE IF NOT EXISTS admin_recovery_codes (
  id uuid PRIMARY KEY,
  username varchar(64) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  code_hash varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_recovery_codes_lookup_idx
  ON admin_recovery_codes(username, code_hash, expires_at)
  WHERE used_at IS NULL;
