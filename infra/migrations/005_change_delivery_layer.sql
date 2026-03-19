ALTER TABLE delivery_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS target_type TEXT,
  ADD COLUMN IF NOT EXISTS target_ref TEXT,
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS replay_cursor TEXT,
  ADD COLUMN IF NOT EXISTS schema_version TEXT NOT NULL DEFAULT '1.0';

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_events_idempotency
  ON delivery_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id),
  source_run_id UUID REFERENCES source_runs(id),
  source_page_id UUID REFERENCES source_pages(id),
  entity_id UUID REFERENCES entities(id),
  entity_version_id UUID REFERENCES entity_versions(id),
  change_scope TEXT[] NOT NULL,
  page_changed BOOLEAN NOT NULL DEFAULT FALSE,
  entity_changed BOOLEAN NOT NULL DEFAULT FALSE,
  field_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key TEXT NOT NULL,
  event_envelope JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_change_events_source_created
  ON change_events(source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_events_entity_created
  ON change_events(entity_id, created_at DESC);
