CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  username varchar(64) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
