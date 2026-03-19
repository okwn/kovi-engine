CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tenants (slug, name)
VALUES ('default', 'Default Tenant')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, principal_type, principal_id)
);

CREATE TABLE IF NOT EXISTS tenant_service_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'service_consumer',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tenant_quotas (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  max_sources INT NOT NULL DEFAULT 25,
  max_run_frequency_seconds INT NOT NULL DEFAULT 60,
  max_browser_concurrency INT NOT NULL DEFAULT 10,
  max_event_throughput_per_minute INT NOT NULL DEFAULT 2000,
  storage_quota_mb BIGINT NOT NULL DEFAULT 10240,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tenant_quotas (tenant_id)
SELECT id FROM tenants WHERE slug = 'default'
ON CONFLICT (tenant_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tenant_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  usage_date DATE NOT NULL,
  pages_fetched INT NOT NULL DEFAULT 0,
  browser_minutes NUMERIC(12, 2) NOT NULL DEFAULT 0,
  events_published INT NOT NULL DEFAULT 0,
  storage_mb NUMERIC(12, 2) NOT NULL DEFAULT 0,
  extraction_failures INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, usage_date)
);

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS governance_status TEXT NOT NULL DEFAULT 'allowed',
  ADD COLUMN IF NOT EXISTS policy_allowed_domains TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS policy_crawl_depth_limit INT,
  ADD COLUMN IF NOT EXISTS policy_max_pages_per_run INT,
  ADD COLUMN IF NOT EXISTS policy_auth_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS policy_export_restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS policy_retention_days INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS extraction_strategy_recommendation TEXT NOT NULL DEFAULT 'http_only',
  ADD COLUMN IF NOT EXISTS efficiency_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stale_since TIMESTAMPTZ;

UPDATE sources
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1)
WHERE tenant_id IS NULL;

ALTER TABLE sources
  ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sources_tenant_id'
  ) THEN
    ALTER TABLE sources
      ADD CONSTRAINT fk_sources_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE sessions s
SET tenant_id = src.tenant_id
FROM sources src
WHERE s.source_id = src.id AND s.tenant_id IS NULL;
ALTER TABLE sessions ALTER COLUMN tenant_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sessions_tenant_id') THEN
    ALTER TABLE sessions ADD CONSTRAINT fk_sessions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

ALTER TABLE entities ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE entities e
SET tenant_id = src.tenant_id
FROM sources src
WHERE e.source_id = src.id AND e.tenant_id IS NULL;
ALTER TABLE entities ALTER COLUMN tenant_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_entities_tenant_id') THEN
    ALTER TABLE entities ADD CONSTRAINT fk_entities_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

ALTER TABLE source_runs
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS run_classification TEXT NOT NULL DEFAULT 'scheduled';
UPDATE source_runs sr
SET tenant_id = src.tenant_id
FROM sources src
WHERE sr.source_id = src.id AND sr.tenant_id IS NULL;
ALTER TABLE source_runs ALTER COLUMN tenant_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_source_runs_tenant_id') THEN
    ALTER TABLE source_runs ADD CONSTRAINT fk_source_runs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

ALTER TABLE source_pages ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE source_pages sp
SET tenant_id = src.tenant_id
FROM sources src
WHERE sp.source_id = src.id AND sp.tenant_id IS NULL;
ALTER TABLE source_pages ALTER COLUMN tenant_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_source_pages_tenant_id') THEN
    ALTER TABLE source_pages ADD CONSTRAINT fk_source_pages_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE delivery_events de
SET tenant_id = src.tenant_id
FROM sources src
WHERE de.source_id = src.id AND de.tenant_id IS NULL;
ALTER TABLE delivery_events ALTER COLUMN tenant_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_delivery_events_tenant_id') THEN
    ALTER TABLE delivery_events ADD CONSTRAINT fk_delivery_events_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

ALTER TABLE change_events ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE change_events ce
SET tenant_id = src.tenant_id
FROM sources src
WHERE ce.source_id = src.id AND ce.tenant_id IS NULL;
ALTER TABLE change_events ALTER COLUMN tenant_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_change_events_tenant_id') THEN
    ALTER TABLE change_events ADD CONSTRAINT fk_change_events_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE webhooks w
SET tenant_id = COALESCE(src.tenant_id, (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1))
FROM sources src
WHERE w.source_id = src.id AND w.tenant_id IS NULL;
UPDATE webhooks
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1)
WHERE tenant_id IS NULL;
ALTER TABLE webhooks ALTER COLUMN tenant_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_webhooks_tenant_id') THEN
    ALTER TABLE webhooks ADD CONSTRAINT fk_webhooks_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE audit_logs
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1)
WHERE tenant_id IS NULL;
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_tenant_id') THEN
    ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

ALTER TABLE dead_letter_pages ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE dead_letter_pages dlp
SET tenant_id = src.tenant_id
FROM sources src
WHERE dlp.source_id = src.id AND dlp.tenant_id IS NULL;
ALTER TABLE dead_letter_pages ALTER COLUMN tenant_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dead_letter_pages_tenant_id') THEN
    ALTER TABLE dead_letter_pages ADD CONSTRAINT fk_dead_letter_pages_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS replay_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  source_id UUID REFERENCES sources(id),
  job_type TEXT NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'queued',
  idempotency_key TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_cost_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  source_id UUID NOT NULL REFERENCES sources(id),
  usage_date DATE NOT NULL,
  run_duration_ms BIGINT NOT NULL DEFAULT 0,
  pages_fetched INT NOT NULL DEFAULT 0,
  browser_minutes NUMERIC(12, 2) NOT NULL DEFAULT 0,
  extraction_failures INT NOT NULL DEFAULT 0,
  event_volume INT NOT NULL DEFAULT 0,
  storage_growth_mb NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, source_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_sources_tenant ON sources(tenant_id, governance_status, active);
CREATE INDEX IF NOT EXISTS idx_service_tokens_tenant ON tenant_service_tokens(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_replay_jobs_tenant ON replay_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_cost_daily_tenant_source ON source_cost_daily(tenant_id, source_id, usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_events_tenant ON delivery_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_events_tenant ON change_events(tenant_id, created_at DESC);
