CREATE TABLE IF NOT EXISTS adapter_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  internal_only BOOLEAN NOT NULL DEFAULT TRUE,
  manifest JSONB NOT NULL,
  changelog JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (adapter_id, version)
);

CREATE INDEX IF NOT EXISTS idx_adapter_packages_status
  ON adapter_packages(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  destination_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  source_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  entity_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  contract_versions TEXT[] NOT NULL DEFAULT '{}'::text[],
  max_retries INT NOT NULL DEFAULT 3,
  last_health_status TEXT NOT NULL DEFAULT 'unknown',
  last_health_checked_at TIMESTAMPTZ,
  last_health_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destinations_tenant_status
  ON destinations(tenant_id, status, destination_type);

CREATE TABLE IF NOT EXISTS destination_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  destination_id UUID NOT NULL REFERENCES destinations(id),
  source_id UUID NOT NULL REFERENCES sources(id),
  entity_id UUID REFERENCES entities(id),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  delivery_state TEXT NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,
  replay_of_delivery_id UUID REFERENCES destination_deliveries(id),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (destination_id, idempotency_key, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_destination_deliveries_tenant_state
  ON destination_deliveries(tenant_id, delivery_state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_destination_deliveries_destination
  ON destination_deliveries(destination_id, created_at DESC);

CREATE TABLE IF NOT EXISTS destination_export_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID NOT NULL REFERENCES destinations(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  source_id UUID NOT NULL REFERENCES sources(id),
  entity_id UUID,
  record_key TEXT,
  payload_hash TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destination_export_rows_destination
  ON destination_export_rows(destination_id, created_at DESC);
