ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS scopes jsonb NOT NULL DEFAULT '[]';

UPDATE api_tokens
SET scopes = CASE kind
  WHEN 'api' THEN '["articles:read","articles:write","planning:read","dedup:check","operations:read"]'::jsonb
  WHEN 'ai_read' THEN '["articles:read","planning:read","dedup:check"]'::jsonb
  WHEN 'ai_write' THEN '["articles:write"]'::jsonb
  WHEN 'ai_plan_write' THEN '["planning:write"]'::jsonb
  ELSE scopes
END
WHERE kind IS NOT NULL;

ALTER TABLE api_tokens DROP COLUMN IF EXISTS kind;
DROP INDEX IF EXISTS api_tokens_kind_idx;
CREATE INDEX IF NOT EXISTS api_tokens_scopes_idx ON api_tokens USING gin(scopes);
