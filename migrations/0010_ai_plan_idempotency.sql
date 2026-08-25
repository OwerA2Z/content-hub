ALTER TABLE content_series ADD COLUMN IF NOT EXISTS external_id varchar(200);
ALTER TABLE content_briefs ADD COLUMN IF NOT EXISTS external_id varchar(200);

CREATE UNIQUE INDEX IF NOT EXISTS content_series_strategy_external_id_uq
  ON content_series(strategy_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS content_briefs_series_external_id_uq
  ON content_briefs(series_id, external_id)
  WHERE external_id IS NOT NULL;
