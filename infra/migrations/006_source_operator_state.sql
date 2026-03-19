ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS operator_state TEXT NOT NULL DEFAULT 'allowed';

CREATE INDEX IF NOT EXISTS idx_sources_operator_state
  ON sources(operator_state);
