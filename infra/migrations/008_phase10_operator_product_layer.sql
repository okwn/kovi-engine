CREATE TABLE IF NOT EXISTS source_onboarding_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  source_id UUID REFERENCES sources(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  step_index INT NOT NULL DEFAULT 0,
  draft_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_drafts_tenant_updated
  ON source_onboarding_drafts(tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_drafts_status
  ON source_onboarding_drafts(tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS session_renewal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  source_id UUID NOT NULL REFERENCES sources(id),
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  failure_reason TEXT,
  expires_at TIMESTAMPTZ,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_renewal_history_source
  ON session_renewal_history(tenant_id, source_id, created_at DESC);
