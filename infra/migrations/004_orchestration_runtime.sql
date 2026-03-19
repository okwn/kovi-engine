ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS failure_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS circuit_state TEXT NOT NULL DEFAULT 'closed',
  ADD COLUMN IF NOT EXISTS circuit_open_until TIMESTAMPTZ;

ALTER TABLE source_runs
  ADD COLUMN IF NOT EXISTS worker_type TEXT,
  ADD COLUMN IF NOT EXISTS pages_succeeded INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pages_failed INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pages_dead_letter INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS summary_json JSONB;

CREATE TABLE IF NOT EXISTS dead_letter_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id),
  source_run_id UUID REFERENCES source_runs(id),
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  failure_reason TEXT NOT NULL,
  attempts INT NOT NULL,
  last_status_code INT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_source_created
  ON dead_letter_pages(source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dead_letter_unresolved
  ON dead_letter_pages(source_id)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sources_circuit_open_until
  ON sources(circuit_open_until);