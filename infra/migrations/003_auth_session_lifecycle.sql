ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'healthy',
  ADD COLUMN IF NOT EXISTS degraded_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_alert_at TIMESTAMPTZ;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS renewal_policy_seconds INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failure_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_source_id ON sessions(source_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status_expires ON sessions(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_sources_health_status ON sources(health_status);
