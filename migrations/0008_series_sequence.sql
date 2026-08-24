ALTER TABLE content_series ADD COLUMN IF NOT EXISTS sequence integer;
UPDATE content_series SET sequence = ordered.row_number FROM (
  SELECT id, row_number() OVER (PARTITION BY strategy_id ORDER BY created_at, id) AS row_number
  FROM content_series
) ordered WHERE content_series.id = ordered.id AND content_series.sequence IS NULL;
ALTER TABLE content_series ALTER COLUMN sequence SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS content_series_strategy_sequence_uq ON content_series(strategy_id, sequence);
