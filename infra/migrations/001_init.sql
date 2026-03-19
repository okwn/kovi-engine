CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  config_json JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id),
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_run_id UUID NOT NULL REFERENCES source_runs(id),
  source_id UUID NOT NULL REFERENCES sources(id),
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  depth INT NOT NULL,
  page_type TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status_code INT NOT NULL,
  raw_html TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_page_id UUID NOT NULL REFERENCES source_pages(id),
  version_number INT NOT NULL,
  content_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_page_id, version_number)
);

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id),
  record_key TEXT NOT NULL,
  latest_hash TEXT,
  latest_version INT NOT NULL DEFAULT 0,
  latest_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, record_key)
);

CREATE TABLE IF NOT EXISTS entity_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  version_number INT NOT NULL,
  content_hash TEXT NOT NULL,
  data_json JSONB NOT NULL,
  source_page_id UUID REFERENCES source_pages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_id, version_number)
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id),
  strategy TEXT NOT NULL,
  storage_state_path TEXT,
  encrypted_state BYTEA,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id),
  url TEXT NOT NULL,
  secret_ref TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources(id),
  entity_id UUID REFERENCES entities(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_runs_source_started ON source_runs(source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_pages_source_canonical ON source_pages(source_id, canonical_url);
CREATE INDEX IF NOT EXISTS idx_entity_versions_entity_created ON entity_versions(entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_events_source_created ON delivery_events(source_id, created_at DESC);
