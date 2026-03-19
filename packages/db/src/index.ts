import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

type SessionAuthMode =
  | 'none'
  | 'manual-cookie-import'
  | 'playwright-form-login'
  | 'header-token-injection';

export interface SourceRecord {
  id: string;
  tenant_id: string;
  name: string;
  adapter_type: string;
  config_json: Record<string, unknown>;
  active: boolean;
  governance_status: string;
  policy_allowed_domains: string[];
  policy_crawl_depth_limit: number | null;
  policy_max_pages_per_run: number | null;
  policy_auth_required: boolean;
  policy_export_restrictions: Record<string, unknown>;
  policy_retention_days: number;
  health_status: string;
  degraded_reason: string | null;
  failure_streak: number;
  circuit_state: string;
  circuit_open_until: string | null;
}

export interface SourceCircuitState {
  sourceId: string;
  failureStreak: number;
  circuitState: string;
  circuitOpenUntil: string | null;
}

export interface StoredEntityVersion {
  entity_id: string;
  latest_hash: string;
  latest_version: number;
}

export interface SessionDbRecord {
  sourceId: string;
  strategy: SessionAuthMode;
  encryptedState: Buffer | null;
  expiresAt: string | null;
  status: 'healthy' | 'expired' | 'invalid' | 'missing';
  lastValidatedAt: string | null;
  lastFailureReason: string | null;
  renewalPolicySeconds: number;
}

export interface SessionHealthRow {
  sourceId: string;
  tenantId: string;
  sourceName: string;
  strategy: SessionAuthMode;
  status: string;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  lastFailureReason: string | null;
}

export interface SessionRenewalHistoryRow {
  id: string;
  tenantId: string;
  sourceId: string;
  action: string;
  status: string;
  failureReason: string | null;
  expiresAt: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface SourceListRow {
  id: string;
  tenantId: string;
  name: string;
  active: boolean;
  operatorState: string;
  governanceStatus: string;
  healthStatus: string;
  adapterType: string;
  updatedAt: string;
}

export interface OnboardingDraftRow {
  id: string;
  tenantId: string;
  sourceId: string | null;
  name: string;
  status: string;
  stepIndex: number;
  draftJson: Record<string, unknown>;
  lastValidation: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantOverviewRow {
  tenantId: string;
  slug: string;
  name: string;
  status: string;
  sourceCount: number;
  activeSourceCount: number;
  quotaMaxSources: number;
  quotaMaxEventThroughputPerMinute: number;
  quotaStorageMb: number;
  usagePagesFetched: number;
  usageBrowserMinutes: number;
  usageEventsPublished: number;
  usageStorageMb: number;
}

export interface TenantListRow {
  id: string;
  slug: string;
  name: string;
  status: string;
}

export interface TenantRunRow {
  id: string;
  sourceId: string;
  sourceName: string;
  status: string;
  runClassification: string;
  workerType: string | null;
  startedAt: string;
  endedAt: string | null;
  pagesSucceeded: number;
  pagesFailed: number;
  pagesDeadLetter: number;
  summary: Record<string, unknown> | null;
}

export interface SourceSnapshotRow {
  pageId: string;
  sourceId: string;
  url: string;
  canonicalUrl: string;
  rawHtml: string;
  fetchedAt: string;
}

export interface SourceStatusRow {
  sourceId: string;
  tenantId: string;
  name: string;
  active: boolean;
  operatorState: string;
  governanceStatus: string;
  healthStatus: string;
  degradedReason: string | null;
  lastRunStatus: string | null;
  lastRunStartedAt: string | null;
  lastRunEndedAt: string | null;
}

export interface SourceRunRow {
  id: string;
  sourceId: string;
  status: string;
  workerType: string | null;
  startedAt: string;
  endedAt: string | null;
  pagesSucceeded: number;
  pagesFailed: number;
  pagesDeadLetter: number;
  summary: Record<string, unknown> | null;
}

export interface PageSnapshotMetadataRow {
  pageId: string;
  runId: string;
  url: string;
  canonicalUrl: string;
  pageType: string;
  depth: number;
  statusCode: number;
  fetchedAt: string;
  contentHash: string;
  latestVersionNumber: number | null;
  latestMetadata: Record<string, unknown> | null;
}

export interface AuditLogRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface SourceMetricsRow {
  sourceId: string;
  windowDays: number;
  runCount: number;
  successRuns: number;
  failedRuns: number;
  pagesSucceeded: number;
  pagesFailed: number;
  pagesDeadLetter: number;
  avgRunDurationMs: number;
}

export interface LatestEntityRow {
  entityId: string;
  sourceId: string;
  recordKey: string;
  latestVersion: number;
  latestData: Record<string, unknown> | null;
  updatedAt: string;
}

export interface EntityHistoryRow {
  versionId: string;
  entityId: string;
  versionNumber: number;
  contentHash: string;
  dataJson: Record<string, unknown>;
  createdAt: string;
}

export interface ChangeEventRow {
  id: string;
  sourceId: string;
  entityId: string | null;
  changeScope: string[];
  pageChanged: boolean;
  entityChanged: boolean;
  fieldChanges: unknown[];
  envelope: Record<string, unknown>;
  createdAt: string;
}

export interface WebhookRow {
  id: string;
  sourceId: string | null;
  url: string;
  secretRef: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdapterCatalogRow {
  id: string;
  adapterId: string;
  version: string;
  name: string;
  status: string;
  internalOnly: boolean;
  manifest: Record<string, unknown>;
  changelog: unknown[];
  sampleOutput: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DestinationRow {
  id: string;
  tenantId: string;
  name: string;
  destinationType: string;
  status: string;
  configJson: Record<string, unknown>;
  eventTypes: string[];
  sourceIds: string[];
  entityTypes: string[];
  contractVersions: string[];
  maxRetries: number;
  lastHealthStatus: string;
  lastHealthCheckedAt: string | null;
  lastHealthError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DestinationDeliveryRow {
  id: string;
  tenantId: string;
  destinationId: string;
  sourceId: string;
  entityId: string | null;
  eventId: string;
  eventType: string;
  contractVersion: string;
  idempotencyKey: string;
  payloadHash: string;
  payloadJson: Record<string, unknown>;
  deliveryState: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  replayOfDeliveryId: string | null;
  queuedAt: string;
  sentAt: string | null;
  acknowledgedAt: string | null;
  failedAt: string | null;
  deadLetteredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class KoviDatabase {
  private readonly pool: Pool;

  public constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  public async healthcheck(): Promise<boolean> {
    const result = await this.query<{ ok: number }>('SELECT 1 as ok');
    return result.rows[0]?.ok === 1;
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public async getActiveSources(): Promise<SourceRecord[]> {
    const result = await this.query<SourceRecord>(
      `SELECT
         id,
         tenant_id,
         name,
         adapter_type,
         config_json,
         active,
         governance_status,
         policy_allowed_domains,
         policy_crawl_depth_limit,
         policy_max_pages_per_run,
         policy_auth_required,
         policy_export_restrictions,
         policy_retention_days,
         health_status,
         degraded_reason,
         failure_streak,
         circuit_state,
         circuit_open_until::text
       FROM sources
       WHERE active = TRUE
         AND governance_status = 'allowed'
         AND COALESCE(health_status, 'healthy') <> 'degraded'
         AND COALESCE(circuit_open_until, NOW() - INTERVAL '1 second') <= NOW()
       ORDER BY created_at ASC`
    );
    return result.rows;
  }

  public async getSourceById(sourceId: string): Promise<SourceRecord | null> {
    const result = await this.query<SourceRecord>(
      `SELECT
         id,
         tenant_id,
         name,
         adapter_type,
         config_json,
         active,
         governance_status,
         policy_allowed_domains,
         policy_crawl_depth_limit,
         policy_max_pages_per_run,
         policy_auth_required,
         policy_export_restrictions,
         policy_retention_days,
         health_status,
         degraded_reason,
         failure_streak,
         circuit_state,
         circuit_open_until::text
       FROM sources
       WHERE id = $1`,
      [sourceId]
    );
    return result.rows[0] ?? null;
  }

  public async createSourceRun(
    sourceId: string,
    workerType?: string,
    runClassification: 'scheduled' | 'manual' | 'replay' | 'backfill' | 'reprocess' = 'scheduled'
  ): Promise<string> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO source_runs (source_id, tenant_id, status, started_at, worker_type, run_classification)
       VALUES ($1, (SELECT tenant_id FROM sources WHERE id = $1), 'running', NOW(), $2, $3)
       RETURNING id`,
      [sourceId, workerType ?? null, runClassification]
    );
    const created = result.rows[0];
    if (!created) {
      throw new Error('failed to create source run');
    }
    return created.id;
  }

  public async finalizeSourceRun(runId: string, status: 'success' | 'failed'): Promise<void> {
    await this.query(
      `UPDATE source_runs
       SET status = $2, ended_at = NOW()
       WHERE id = $1`,
      [runId, status]
    );
  }

  public async updateRunSummary(input: {
    runId: string;
    status: 'success' | 'failed';
    pagesSucceeded: number;
    pagesFailed: number;
    pagesDeadLetter: number;
    summary: Record<string, unknown>;
  }): Promise<void> {
    await this.query(
      `UPDATE source_runs
       SET
         status = $2,
         pages_succeeded = $3,
         pages_failed = $4,
         pages_dead_letter = $5,
         summary_json = $6,
         ended_at = NOW()
       WHERE id = $1`,
      [
        input.runId,
        input.status,
        input.pagesSucceeded,
        input.pagesFailed,
        input.pagesDeadLetter,
        input.summary
      ]
    );
  }

  public async insertSourcePage(input: {
    runId: string;
    sourceId: string;
    url: string;
    canonicalUrl: string;
    depth: number;
    pageType: string;
    contentHash: string;
    statusCode: number;
    html: string;
  }): Promise<string> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO source_pages (
         source_run_id,
         source_id,
         tenant_id,
         url,
         canonical_url,
         depth,
         page_type,
         content_hash,
         status_code,
         raw_html,
         fetched_at
       ) VALUES ($1,$2,(SELECT tenant_id FROM sources WHERE id = $2),$3,$4,$5,$6,$7,$8,$9,NOW())
       RETURNING id`,
      [
        input.runId,
        input.sourceId,
        input.url,
        input.canonicalUrl,
        input.depth,
        input.pageType,
        input.contentHash,
        input.statusCode,
        input.html
      ]
    );
    const created = result.rows[0];
    if (!created) {
      throw new Error('failed to insert source page');
    }
    return created.id;
  }

  public async getLatestPageVersion(sourceId: string, canonicalUrl: string): Promise<{ contentHash: string; versionNumber: number } | null> {
    const result = await this.query<{ contentHash: string; versionNumber: number }>(
      `SELECT
         pv.content_hash as "contentHash",
         pv.version_number as "versionNumber"
       FROM page_versions pv
       JOIN source_pages sp ON sp.id = pv.source_page_id
       WHERE sp.source_id = $1 AND sp.canonical_url = $2
       ORDER BY pv.created_at DESC
       LIMIT 1`,
      [sourceId, canonicalUrl]
    );
    return result.rows[0] ?? null;
  }

  public async insertPageVersion(input: {
    pageId: string;
    contentHash: string;
    metadata: Record<string, unknown>;
  }): Promise<number> {
    const latest = await this.query<{ versionNo: number }>(
      `SELECT COALESCE(MAX(version_number), 0) as "versionNo"
       FROM page_versions
       WHERE source_page_id = $1`,
      [input.pageId]
    );
    const versionNo = (latest.rows[0]?.versionNo ?? 0) + 1;

    await this.query(
      `INSERT INTO page_versions (
         source_page_id,
         version_number,
         content_hash,
         metadata,
         created_at
       ) VALUES ($1,$2,$3,$4,NOW())`,
      [input.pageId, versionNo, input.contentHash, input.metadata]
    );

    return versionNo;
  }

  public async getLatestEntitySnapshot(sourceId: string, recordKey: string): Promise<{ entityId: string; latestData: Record<string, unknown> | null; latestHash: string | null; latestVersion: number } | null> {
    const result = await this.query<{
      entityId: string;
      latestData: Record<string, unknown> | null;
      latestHash: string | null;
      latestVersion: number;
    }>(
      `SELECT
         id as "entityId",
         latest_data as "latestData",
         latest_hash as "latestHash",
         latest_version as "latestVersion"
       FROM entities
       WHERE source_id = $1 AND record_key = $2`,
      [sourceId, recordKey]
    );
    return result.rows[0] ?? null;
  }

  public async upsertEntityVersion(input: {
    sourceId: string;
    recordKey: string;
    data: Record<string, unknown>;
    contentHash: string;
    pageId: string;
  }): Promise<{ changed: boolean; entityId: string; versionNumber: number; entityVersionId: string | null }> {
    return this.withTransaction(async (tx) => {
      const entityRes = await tx.query<{ id: string; latest_hash: string | null; latest_version: number }>(
        `SELECT id, latest_hash, latest_version
         FROM entities
         WHERE source_id = $1 AND record_key = $2
         FOR UPDATE`,
        [input.sourceId, input.recordKey]
      );

      if (entityRes.rows.length === 0) {
        const createEntity = await tx.query<{ id: string }>(
          `INSERT INTO entities (
             source_id,
             record_key,
             latest_hash,
             latest_version,
             latest_data,
             created_at,
             updated_at
           ) VALUES ($1,$2,$3,1,$4,NOW(),NOW())
           RETURNING id`,
          [input.sourceId, input.recordKey, input.contentHash, input.data]
        );
        const createdEntity = createEntity.rows[0];
        if (!createdEntity) {
          throw new Error('failed to create entity');
        }
        const entityId = createdEntity.id;
        const createdVersion = await tx.query<{ id: string }>(
          `INSERT INTO entity_versions (
             entity_id,
             version_number,
             content_hash,
             data_json,
             source_page_id,
             created_at
           ) VALUES ($1,1,$2,$3,$4,NOW())
           RETURNING id`,
          [entityId, input.contentHash, input.data, input.pageId]
        );
        return { changed: true, entityId, versionNumber: 1, entityVersionId: createdVersion.rows[0]?.id ?? null };
      }

      const current = entityRes.rows[0];
      if (!current) {
        throw new Error('entity not found during upsert');
      }
      if (current.latest_hash === input.contentHash) {
        await tx.query('UPDATE entities SET updated_at = NOW() WHERE id = $1', [current.id]);
        return { changed: false, entityId: current.id, versionNumber: current.latest_version, entityVersionId: null };
      }

      const nextVersion = current.latest_version + 1;
      await tx.query(
        `UPDATE entities
         SET latest_hash = $2,
             latest_version = $3,
             latest_data = $4,
             updated_at = NOW()
         WHERE id = $1`,
        [current.id, input.contentHash, nextVersion, input.data]
      );

      const createdVersion = await tx.query<{ id: string }>(
        `INSERT INTO entity_versions (
           entity_id,
           version_number,
           content_hash,
           data_json,
           source_page_id,
           created_at
         ) VALUES ($1,$2,$3,$4,$5,NOW())
         RETURNING id`,
        [current.id, nextVersion, input.contentHash, input.data, input.pageId]
      );

      return {
        changed: true,
        entityId: current.id,
        versionNumber: nextVersion,
        entityVersionId: createdVersion.rows[0]?.id ?? null
      };
    });
  }

  public async insertDeliveryEvent(input: {
    sourceId: string;
    entityId: string | null;
    eventType: string;
    payload: unknown;
    idempotencyKey?: string;
    targetType?: string;
    targetRef?: string;
    schemaVersion?: string;
    replayCursor?: string | null;
    status?: string;
    attempts?: number;
    lastError?: string | null;
  }): Promise<boolean> {
    const result = await this.query(
      `INSERT INTO delivery_events (
        tenant_id,
         source_id,
         entity_id,
         event_type,
         payload,
         idempotency_key,
         target_type,
         target_ref,
         schema_version,
         replay_cursor,
         attempts,
         last_error,
         last_attempt_at,
         status,
         created_at
       ) VALUES (
         COALESCE($1, (SELECT tenant_id FROM sources WHERE id = $2), (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1)),
         $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13,NOW()
       )
      ON CONFLICT DO NOTHING`,
      [
        null,
        input.sourceId,
        input.entityId,
        input.eventType,
        input.payload,
        input.idempotencyKey ?? null,
        input.targetType ?? null,
        input.targetRef ?? null,
        input.schemaVersion ?? '1.0',
        input.replayCursor ?? null,
        input.attempts ?? 0,
        input.lastError ?? null,
        input.status ?? 'pending'
      ]
    );
    return (result.rowCount ?? 0) > 0;
  }

  public async updateDeliveryEventAttempt(input: {
    idempotencyKey: string;
    status: 'pending' | 'published' | 'failed';
    replayCursor?: string | null;
    error?: string | null;
  }): Promise<void> {
    await this.query(
      `UPDATE delivery_events
       SET
         attempts = attempts + 1,
         status = $2,
         replay_cursor = COALESCE($3, replay_cursor),
         last_error = $4,
         last_attempt_at = NOW(),
         next_attempt_at = CASE WHEN $2 = 'failed' THEN NOW() + INTERVAL '30 seconds' ELSE NULL END
       WHERE idempotency_key = $1`,
      [input.idempotencyKey, input.status, input.replayCursor ?? null, input.error ?? null]
    );
  }

  public async insertChangeEvent(input: {
    sourceId: string;
    sourceRunId: string;
    sourcePageId: string;
    entityId: string | null;
    entityVersionId?: string | null;
    changeScope: string[];
    pageChanged: boolean;
    entityChanged: boolean;
    fieldChanges: unknown[];
    idempotencyKey: string;
    eventEnvelope: unknown;
  }): Promise<boolean> {
    const result = await this.query(
      `INSERT INTO change_events (
        tenant_id,
         source_id,
         source_run_id,
         source_page_id,
         entity_id,
         entity_version_id,
         change_scope,
         page_changed,
         entity_changed,
         field_changes,
         idempotency_key,
         event_envelope,
         created_at
       ) VALUES ((SELECT tenant_id FROM sources WHERE id = $1),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (idempotency_key)
       DO NOTHING`,
      [
        input.sourceId,
        input.sourceRunId,
        input.sourcePageId,
        input.entityId,
        input.entityVersionId ?? null,
        input.changeScope,
        input.pageChanged,
        input.entityChanged,
        input.fieldChanges,
        input.idempotencyKey,
        input.eventEnvelope
      ]
    );
    return (result.rowCount ?? 0) > 0;
  }

  public async getSessionBySource(sourceId: string): Promise<SessionDbRecord | null> {
    const result = await this.query<SessionDbRecord>(
      `SELECT
         source_id as "sourceId",
         strategy,
         encrypted_state as "encryptedState",
         expires_at::text as "expiresAt",
         status,
         last_validated_at::text as "lastValidatedAt",
         last_failure_reason as "lastFailureReason",
         renewal_policy_seconds as "renewalPolicySeconds"
       FROM sessions
       WHERE source_id = $1`,
      [sourceId]
    );
    return result.rows[0] ?? null;
  }

  public async upsertSession(input: {
    sourceId: string;
    strategy: SessionAuthMode;
    encryptedState: Buffer;
    expiresAt: string | null;
    status: 'healthy' | 'expired' | 'invalid' | 'missing';
    renewalPolicySeconds: number;
  }): Promise<void> {
    await this.query(
      `INSERT INTO sessions (
         source_id,
        tenant_id,
         strategy,
         encrypted_state,
         expires_at,
         status,
         renewal_policy_seconds,
         last_validated_at,
         updated_at
       ) VALUES ($1,(SELECT tenant_id FROM sources WHERE id = $1),$2,$3,$4,$5,$6,NOW(),NOW())
       ON CONFLICT (source_id)
       DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         strategy = EXCLUDED.strategy,
         encrypted_state = EXCLUDED.encrypted_state,
         expires_at = EXCLUDED.expires_at,
         status = EXCLUDED.status,
         renewal_policy_seconds = EXCLUDED.renewal_policy_seconds,
         last_validated_at = NOW(),
         updated_at = NOW()`,
      [
        input.sourceId,
        input.strategy,
        input.encryptedState,
        input.expiresAt,
        input.status,
        input.renewalPolicySeconds
      ]
    );
  }

  public async updateSessionValidation(input: {
    sourceId: string;
    status: 'healthy' | 'expired' | 'invalid' | 'missing';
    lastFailureReason: string | null;
    expiresAt: string | null;
  }): Promise<void> {
    await this.query(
      `INSERT INTO sessions (
         source_id,
        tenant_id,
         strategy,
         encrypted_state,
         expires_at,
         status,
         renewal_policy_seconds,
         last_failure_reason,
         last_validated_at,
         updated_at
       ) VALUES ($1,(SELECT tenant_id FROM sources WHERE id = $1),'none',NULL,$4,$2,0,$3,NOW(),NOW())
       ON CONFLICT (source_id)
       DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         status = EXCLUDED.status,
         last_failure_reason = EXCLUDED.last_failure_reason,
         expires_at = COALESCE(EXCLUDED.expires_at, sessions.expires_at),
         last_validated_at = NOW(),
         updated_at = NOW()`,
      [input.sourceId, input.status, input.lastFailureReason, input.expiresAt]
    );
  }

  public async listSessionHealth(tenantId?: string): Promise<SessionHealthRow[]> {
    const result = tenantId
      ? await this.query<SessionHealthRow>(
          `SELECT
             s.id as "sourceId",
             s.tenant_id as "tenantId",
             s.name as "sourceName",
             COALESCE(sess.strategy, 'none') as strategy,
             COALESCE(sess.status, 'missing') as status,
             sess.expires_at::text as "expiresAt",
             sess.last_validated_at::text as "lastValidatedAt",
             sess.last_failure_reason as "lastFailureReason"
           FROM sources s
           LEFT JOIN sessions sess ON sess.source_id = s.id
           WHERE s.tenant_id = $1
           ORDER BY s.created_at ASC`,
          [tenantId]
        )
      : await this.query<SessionHealthRow>(
      `SELECT
         s.id as "sourceId",
         s.tenant_id as "tenantId",
         s.name as "sourceName",
         COALESCE(sess.strategy, 'none') as strategy,
         COALESCE(sess.status, 'missing') as status,
         sess.expires_at::text as "expiresAt",
         sess.last_validated_at::text as "lastValidatedAt",
         sess.last_failure_reason as "lastFailureReason"
       FROM sources s
       LEFT JOIN sessions sess ON sess.source_id = s.id
       ORDER BY s.created_at ASC`
      );
    return result.rows;
  }

  public async insertSessionRenewalHistory(input: {
    tenantId: string;
    sourceId: string;
    action: string;
    status: 'success' | 'failed';
    failureReason?: string | null;
    expiresAt?: string | null;
    actorId?: string | null;
  }): Promise<void> {
    await this.query(
      `INSERT INTO session_renewal_history (
         tenant_id,
         source_id,
         action,
         status,
         failure_reason,
         expires_at,
         actor_id,
         created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [
        input.tenantId,
        input.sourceId,
        input.action,
        input.status,
        input.failureReason ?? null,
        input.expiresAt ?? null,
        input.actorId ?? null
      ]
    );
  }

  public async getSessionRenewalHistory(sourceId: string, tenantId: string, limit = 30): Promise<SessionRenewalHistoryRow[]> {
    const result = await this.query<SessionRenewalHistoryRow>(
      `SELECT
         id,
         tenant_id as "tenantId",
         source_id as "sourceId",
         action,
         status,
         failure_reason as "failureReason",
         expires_at::text as "expiresAt",
         actor_id as "actorId",
         created_at::text as "createdAt"
       FROM session_renewal_history
       WHERE source_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [sourceId, tenantId, limit]
    );
    return result.rows;
  }

  public async markSourceDegraded(sourceId: string, reason: string): Promise<void> {
    await this.query(
      `UPDATE sources
       SET health_status = 'degraded',
           degraded_reason = $2,
           last_alert_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [sourceId, reason]
    );
  }

  public async markSourceHealthy(sourceId: string): Promise<void> {
    await this.query(
      `UPDATE sources
       SET health_status = 'healthy',
           degraded_reason = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [sourceId]
    );
  }

  public async createAlert(sourceId: string, message: string): Promise<void> {
    await this.insertDeliveryEvent({
      sourceId,
      entityId: null,
      eventType: 'auth.failed',
      payload: {
        sourceId,
        message,
        createdAt: new Date().toISOString()
      }
    });
  }

  public async insertAuditLog(input: {
    tenantId?: string;
    actorType: 'system' | 'operator';
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    await this.query(
      `INSERT INTO audit_logs (
         tenant_id,
         actor_type,
         actor_id,
         action,
         target_type,
         target_id,
         details,
         created_at
       ) VALUES (
         COALESCE($1, (SELECT tenant_id FROM sources WHERE id = $6), (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1)),
         $2,$3,$4,$5,$6,$7,NOW()
       )`,
      [input.tenantId ?? null, input.actorType, input.actorId, input.action, input.targetType, input.targetId, input.details]
    );
  }

  public async listSources(): Promise<SourceListRow[]> {
    const result = await this.query<SourceListRow>(
      `SELECT
         id,
        tenant_id as "tenantId",
         name,
         active,
         COALESCE(operator_state, 'allowed') as "operatorState",
        COALESCE(governance_status, 'allowed') as "governanceStatus",
         health_status as "healthStatus",
         adapter_type as "adapterType",
         updated_at::text as "updatedAt"
       FROM sources
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  public async getSourceStatus(sourceId: string): Promise<SourceStatusRow | null> {
    const result = await this.query<SourceStatusRow>(
      `SELECT
         s.id as "sourceId",
        s.tenant_id as "tenantId",
         s.name,
         s.active,
         COALESCE(s.operator_state, 'allowed') as "operatorState",
        COALESCE(s.governance_status, 'allowed') as "governanceStatus",
         s.health_status as "healthStatus",
         s.degraded_reason as "degradedReason",
         sr.status as "lastRunStatus",
         sr.started_at::text as "lastRunStartedAt",
         sr.ended_at::text as "lastRunEndedAt"
       FROM sources s
       LEFT JOIN LATERAL (
         SELECT status, started_at, ended_at
         FROM source_runs
         WHERE source_id = s.id
         ORDER BY started_at DESC
         LIMIT 1
       ) sr ON TRUE
       WHERE s.id = $1`,
      [sourceId]
    );
    return result.rows[0] ?? null;
  }

  public async setSourceActive(sourceId: string, active: boolean): Promise<void> {
    await this.query(
      `UPDATE sources
       SET active = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [sourceId, active]
    );
  }

  public async setSourceOperatorState(sourceId: string, state: 'allowed' | 'review' | 'blocked'): Promise<void> {
    await this.query(
      `UPDATE sources
       SET operator_state = $2,
           active = CASE WHEN $2 = 'blocked' THEN FALSE ELSE active END,
           updated_at = NOW()
       WHERE id = $1`,
      [sourceId, state]
    );
  }

  public async updateExtractionSelectors(sourceId: string, extractionSelectors: Record<string, unknown>): Promise<void> {
    const source = await this.getSourceById(sourceId);
    if (!source) {
      throw new Error('source not found');
    }

    const nextConfig = {
      ...source.config_json,
      extractionSelectors
    };

    await this.query(
      `UPDATE sources
       SET config_json = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [sourceId, nextConfig]
    );
  }

  public async getRecentRuns(sourceId: string, limit = 20): Promise<SourceRunRow[]> {
    const result = await this.query<SourceRunRow>(
      `SELECT
         id,
         source_id as "sourceId",
         status,
         worker_type as "workerType",
         started_at::text as "startedAt",
         ended_at::text as "endedAt",
         pages_succeeded as "pagesSucceeded",
         pages_failed as "pagesFailed",
         pages_dead_letter as "pagesDeadLetter",
         summary_json as "summary"
       FROM source_runs
       WHERE source_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [sourceId, limit]
    );
    return result.rows;
  }

  public async getFailedRuns(sourceId: string, limit = 20): Promise<SourceRunRow[]> {
    const result = await this.query<SourceRunRow>(
      `SELECT
         id,
         source_id as "sourceId",
         status,
         worker_type as "workerType",
         started_at::text as "startedAt",
         ended_at::text as "endedAt",
         pages_succeeded as "pagesSucceeded",
         pages_failed as "pagesFailed",
         pages_dead_letter as "pagesDeadLetter",
         summary_json as "summary"
       FROM source_runs
       WHERE source_id = $1
         AND status = 'failed'
       ORDER BY started_at DESC
       LIMIT $2`,
      [sourceId, limit]
    );
    return result.rows;
  }

  public async getSourceChanges(sourceId: string, limit = 50): Promise<ChangeEventRow[]> {
    const result = await this.query<ChangeEventRow>(
      `SELECT
         id,
         source_id as "sourceId",
         entity_id as "entityId",
         change_scope as "changeScope",
         page_changed as "pageChanged",
         entity_changed as "entityChanged",
         field_changes as "fieldChanges",
         event_envelope as "envelope",
         created_at::text as "createdAt"
       FROM change_events
       WHERE source_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sourceId, limit]
    );
    return result.rows;
  }

  public async getPageSnapshotsMetadata(sourceId: string, limit = 50): Promise<PageSnapshotMetadataRow[]> {
    const result = await this.query<PageSnapshotMetadataRow>(
      `SELECT
         sp.id as "pageId",
         sp.source_run_id as "runId",
         sp.url,
         sp.canonical_url as "canonicalUrl",
         sp.page_type as "pageType",
         sp.depth,
         sp.status_code as "statusCode",
         sp.fetched_at::text as "fetchedAt",
         sp.content_hash as "contentHash",
         pv.version_number as "latestVersionNumber",
         pv.metadata as "latestMetadata"
       FROM source_pages sp
       LEFT JOIN LATERAL (
         SELECT version_number, metadata
         FROM page_versions
         WHERE source_page_id = sp.id
         ORDER BY version_number DESC
         LIMIT 1
       ) pv ON TRUE
       WHERE sp.source_id = $1
       ORDER BY sp.fetched_at DESC
       LIMIT $2`,
      [sourceId, limit]
    );
    return result.rows;
  }

  public async getAuditLogs(input: { sourceId?: string; limit?: number } = {}): Promise<AuditLogRow[]> {
    const limit = input.limit ?? 100;
    const result = input.sourceId
      ? await this.query<AuditLogRow>(
          `SELECT
             id,
             actor_type as "actorType",
             actor_id as "actorId",
             action,
             target_type as "targetType",
             target_id as "targetId",
             details,
             created_at::text as "createdAt"
           FROM audit_logs
           WHERE target_id = $1
              OR (details->>'sourceId') = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [input.sourceId, limit]
        )
      : await this.query<AuditLogRow>(
          `SELECT
             id,
             actor_type as "actorType",
             actor_id as "actorId",
             action,
             target_type as "targetType",
             target_id as "targetId",
             details,
             created_at::text as "createdAt"
           FROM audit_logs
           ORDER BY created_at DESC
           LIMIT $1`,
          [limit]
        );

    return result.rows;
  }

  public async getSourceMetrics(sourceId: string, windowDays = 7): Promise<SourceMetricsRow> {
    const result = await this.query<{
      runCount: number;
      successRuns: number;
      failedRuns: number;
      pagesSucceeded: number;
      pagesFailed: number;
      pagesDeadLetter: number;
      avgRunDurationMs: number | null;
    }>(
      `SELECT
         COUNT(*)::int as "runCount",
         COUNT(*) FILTER (WHERE status = 'success')::int as "successRuns",
         COUNT(*) FILTER (WHERE status = 'failed')::int as "failedRuns",
         COALESCE(SUM(pages_succeeded), 0)::int as "pagesSucceeded",
         COALESCE(SUM(pages_failed), 0)::int as "pagesFailed",
         COALESCE(SUM(pages_dead_letter), 0)::int as "pagesDeadLetter",
         AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000) as "avgRunDurationMs"
       FROM source_runs
       WHERE source_id = $1
         AND started_at >= NOW() - (($2::text || ' days')::interval)`,
      [sourceId, windowDays]
    );

    const row = result.rows[0];
    return {
      sourceId,
      windowDays,
      runCount: row?.runCount ?? 0,
      successRuns: row?.successRuns ?? 0,
      failedRuns: row?.failedRuns ?? 0,
      pagesSucceeded: row?.pagesSucceeded ?? 0,
      pagesFailed: row?.pagesFailed ?? 0,
      pagesDeadLetter: row?.pagesDeadLetter ?? 0,
      avgRunDurationMs: Math.round(row?.avgRunDurationMs ?? 0)
    };
  }

  public async getLatestEntities(sourceId: string, limit = 100): Promise<LatestEntityRow[]> {
    const result = await this.query<LatestEntityRow>(
      `SELECT
         id as "entityId",
         source_id as "sourceId",
         record_key as "recordKey",
         latest_version as "latestVersion",
         latest_data as "latestData",
         updated_at::text as "updatedAt"
       FROM entities
       WHERE source_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [sourceId, limit]
    );
    return result.rows;
  }

  public async getEntityHistory(entityId: string, limit = 100): Promise<EntityHistoryRow[]> {
    const result = await this.query<EntityHistoryRow>(
      `SELECT
         id as "versionId",
         entity_id as "entityId",
         version_number as "versionNumber",
         content_hash as "contentHash",
         data_json as "dataJson",
         created_at::text as "createdAt"
       FROM entity_versions
       WHERE entity_id = $1
       ORDER BY version_number DESC
       LIMIT $2`,
      [entityId, limit]
    );
    return result.rows;
  }

  public async getRecentChanges(limit = 100): Promise<ChangeEventRow[]> {
    const result = await this.query<ChangeEventRow>(
      `SELECT
         id,
         source_id as "sourceId",
         entity_id as "entityId",
         change_scope as "changeScope",
         page_changed as "pageChanged",
         entity_changed as "entityChanged",
         field_changes as "fieldChanges",
         event_envelope as "envelope",
         created_at::text as "createdAt"
       FROM change_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  public async listWebhooks(sourceId?: string): Promise<WebhookRow[]> {
    const result = sourceId
      ? await this.query<WebhookRow>(
          `SELECT
             id,
             source_id as "sourceId",
             url,
             secret_ref as "secretRef",
             active,
             created_at::text as "createdAt",
             updated_at::text as "updatedAt"
           FROM webhooks
           WHERE source_id = $1
           ORDER BY created_at DESC`,
          [sourceId]
        )
      : await this.query<WebhookRow>(
          `SELECT
             id,
             source_id as "sourceId",
             url,
             secret_ref as "secretRef",
             active,
             created_at::text as "createdAt",
             updated_at::text as "updatedAt"
           FROM webhooks
           ORDER BY created_at DESC`
        );
    return result.rows;
  }

  public async createWebhook(input: {
    sourceId: string | null;
    url: string;
    secretRef: string | null;
    active?: boolean;
    tenantId?: string;
  }): Promise<string> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO webhooks (
         tenant_id,
         source_id,
         url,
         secret_ref,
         active,
         created_at,
         updated_at
       ) VALUES (
         COALESCE($1, (SELECT tenant_id FROM sources WHERE id = $2), (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1)),
         $2,$3,$4,$5,NOW(),NOW()
       )
       RETURNING id`,
      [input.tenantId ?? null, input.sourceId, input.url, input.secretRef, input.active ?? true]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('failed to create webhook');
    }
    return row.id;
  }

  public async updateWebhook(input: {
    webhookId: string;
    url?: string;
    secretRef?: string | null;
    active?: boolean;
  }): Promise<void> {
    await this.query(
      `UPDATE webhooks
       SET
         url = COALESCE($2, url),
         secret_ref = COALESCE($3, secret_ref),
         active = COALESCE($4, active),
         updated_at = NOW()
       WHERE id = $1`,
      [input.webhookId, input.url ?? null, input.secretRef ?? null, input.active ?? null]
    );
  }

  public async deleteWebhook(webhookId: string): Promise<void> {
    await this.query('DELETE FROM webhooks WHERE id = $1', [webhookId]);
  }

  public async getSourceCircuitState(sourceId: string): Promise<SourceCircuitState | null> {
    const result = await this.query<SourceCircuitState>(
      `SELECT
         id as "sourceId",
         failure_streak as "failureStreak",
         circuit_state as "circuitState",
         circuit_open_until::text as "circuitOpenUntil"
       FROM sources
       WHERE id = $1`,
      [sourceId]
    );
    return result.rows[0] ?? null;
  }

  public async recordSourceRunFailure(input: {
    sourceId: string;
    reason: string;
    threshold: number;
    circuitOpenMinutes: number;
  }): Promise<{ opened: boolean; streak: number }> {
    return this.withTransaction(async (tx) => {
      const currentRes = await tx.query<{ failure_streak: number }>(
        'SELECT failure_streak FROM sources WHERE id = $1 FOR UPDATE',
        [input.sourceId]
      );
      const current = currentRes.rows[0];
      const streak = (current?.failure_streak ?? 0) + 1;
      const opened = streak >= input.threshold;

      await tx.query(
        `UPDATE sources
         SET
           failure_streak = $2,
           circuit_state = CASE WHEN $3 THEN 'open' ELSE circuit_state END,
           circuit_open_until = CASE WHEN $3 THEN NOW() + ($4::text || ' minutes')::interval ELSE circuit_open_until END,
           degraded_reason = $5,
           updated_at = NOW()
         WHERE id = $1`,
        [input.sourceId, streak, opened, input.circuitOpenMinutes, input.reason]
      );

      return { opened, streak };
    });
  }

  public async recordSourceRunSuccess(sourceId: string): Promise<void> {
    await this.query(
      `UPDATE sources
       SET
         failure_streak = 0,
         circuit_state = 'closed',
         circuit_open_until = NULL,
         degraded_reason = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [sourceId]
    );
  }

  public async insertDeadLetterPage(input: {
    sourceId: string;
    runId: string | null;
    url: string;
    canonicalUrl: string;
    reason: string;
    attempts: number;
    lastStatusCode: number | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.query(
      `INSERT INTO dead_letter_pages (
        tenant_id,
         source_id,
         source_run_id,
         url,
         canonical_url,
         failure_reason,
         attempts,
         last_status_code,
         payload,
         created_at
       ) VALUES ((SELECT tenant_id FROM sources WHERE id = $1),$1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [
        input.sourceId,
        input.runId,
        input.url,
        input.canonicalUrl,
        input.reason,
        input.attempts,
        input.lastStatusCode,
        input.payload
      ]
    );
  }

  public async getTenantByTokenHash(tokenHash: string, tenantSlug?: string): Promise<{ tenantId: string; role: string; tokenId: string } | null> {
    const result = tenantSlug
      ? await this.query<{ tenantId: string; role: string; tokenId: string }>(
          `SELECT
             tst.tenant_id as "tenantId",
             tst.role,
             tst.id as "tokenId"
           FROM tenant_service_tokens tst
           JOIN tenants t ON t.id = tst.tenant_id
           WHERE tst.token_hash = $1
             AND tst.active = TRUE
             AND (tst.expires_at IS NULL OR tst.expires_at > NOW())
             AND t.slug = $2
             AND t.status = 'active'
           LIMIT 1`,
          [tokenHash, tenantSlug]
        )
      : await this.query<{ tenantId: string; role: string; tokenId: string }>(
          `SELECT
             tst.tenant_id as "tenantId",
             tst.role,
             tst.id as "tokenId"
           FROM tenant_service_tokens tst
           JOIN tenants t ON t.id = tst.tenant_id
           WHERE tst.token_hash = $1
             AND tst.active = TRUE
             AND (tst.expires_at IS NULL OR tst.expires_at > NOW())
             AND t.status = 'active'
           LIMIT 1`,
          [tokenHash]
        );

    return result.rows[0] ?? null;
  }

  public async touchServiceToken(tokenId: string): Promise<void> {
    await this.query('UPDATE tenant_service_tokens SET last_used_at = NOW() WHERE id = $1', [tokenId]);
  }

  public async listSourcesByTenant(tenantId: string): Promise<SourceListRow[]> {
    const result = await this.query<SourceListRow>(
      `SELECT
         id,
         tenant_id as "tenantId",
         name,
         active,
         COALESCE(operator_state, 'allowed') as "operatorState",
         COALESCE(governance_status, 'allowed') as "governanceStatus",
         health_status as "healthStatus",
         adapter_type as "adapterType",
         updated_at::text as "updatedAt"
       FROM sources
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  public async getSourceByIdForTenant(sourceId: string, tenantId: string): Promise<SourceRecord | null> {
    const result = await this.query<SourceRecord>(
      `SELECT
         id,
         tenant_id,
         name,
         adapter_type,
         config_json,
         active,
         governance_status,
        policy_allowed_domains,
        policy_crawl_depth_limit,
        policy_max_pages_per_run,
        policy_auth_required,
        policy_export_restrictions,
        policy_retention_days,
         health_status,
         degraded_reason,
         failure_streak,
         circuit_state,
         circuit_open_until::text
       FROM sources
       WHERE id = $1 AND tenant_id = $2`,
      [sourceId, tenantId]
    );
    return result.rows[0] ?? null;
  }

  public async createSource(input: {
    tenantId: string;
    name: string;
    adapterType: string;
    configJson: Record<string, unknown>;
    active?: boolean;
  }): Promise<string> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO sources (
         tenant_id,
         name,
         adapter_type,
         config_json,
         active,
         created_at,
         updated_at
       ) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
       RETURNING id`,
      [input.tenantId, input.name, input.adapterType, input.configJson, input.active ?? true]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('failed to create source');
    }
    return row.id;
  }

  public async cloneSource(input: { tenantId: string; sourceId: string; nameSuffix?: string }): Promise<string> {
    const source = await this.getSourceByIdForTenant(input.sourceId, input.tenantId);
    if (!source) {
      throw new Error('source not found');
    }

    const clonedName = `${source.name}${input.nameSuffix ?? ' (Clone)'}`;
    return this.createSource({
      tenantId: input.tenantId,
      name: clonedName,
      adapterType: source.adapter_type,
      configJson: source.config_json,
      active: false
    });
  }

  public async updateSourceConfigForTenant(input: {
    tenantId: string;
    sourceId: string;
    configJson: Record<string, unknown>;
    name?: string;
    adapterType?: string;
    active?: boolean;
  }): Promise<void> {
    await this.query(
      `UPDATE sources
       SET
         name = COALESCE($4, name),
         adapter_type = COALESCE($5, adapter_type),
         active = COALESCE($6, active),
         config_json = $3,
         updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [
        input.sourceId,
        input.tenantId,
        input.configJson,
        input.name ?? null,
        input.adapterType ?? null,
        input.active ?? null
      ]
    );
  }

  public async listTenants(): Promise<TenantListRow[]> {
    const result = await this.query<TenantListRow>(
      `SELECT id, slug, name, status
       FROM tenants
       ORDER BY created_at ASC`
    );
    return result.rows;
  }

  public async getTenantOverview(tenantId: string): Promise<TenantOverviewRow | null> {
    const result = await this.query<TenantOverviewRow>(
      `SELECT
         t.id as "tenantId",
         t.slug,
         t.name,
         t.status,
         COUNT(s.id)::int as "sourceCount",
         COUNT(*) FILTER (WHERE s.active = TRUE)::int as "activeSourceCount",
         COALESCE(q.max_sources, 25)::int as "quotaMaxSources",
         COALESCE(q.max_event_throughput_per_minute, 2000)::int as "quotaMaxEventThroughputPerMinute",
         COALESCE(q.storage_quota_mb, 10240)::bigint as "quotaStorageMb",
         COALESCE(SUM(u.pages_fetched), 0)::int as "usagePagesFetched",
         COALESCE(SUM(u.browser_minutes), 0)::numeric as "usageBrowserMinutes",
         COALESCE(SUM(u.events_published), 0)::int as "usageEventsPublished",
         COALESCE(SUM(u.storage_mb), 0)::numeric as "usageStorageMb"
       FROM tenants t
       LEFT JOIN sources s ON s.tenant_id = t.id
       LEFT JOIN tenant_quotas q ON q.tenant_id = t.id
       LEFT JOIN tenant_usage_daily u ON u.tenant_id = t.id AND u.usage_date >= CURRENT_DATE - INTERVAL '7 days'
       WHERE t.id = $1
       GROUP BY t.id, t.slug, t.name, t.status, q.max_sources, q.max_event_throughput_per_minute, q.storage_quota_mb`,
      [tenantId]
    );
    return result.rows[0] ?? null;
  }

  public async listTenantRuns(input: {
    tenantId: string;
    sourceId?: string;
    classification?: string;
    status?: string;
    limit?: number;
  }): Promise<TenantRunRow[]> {
    const params: unknown[] = [input.tenantId];
    const where: string[] = ['sr.tenant_id = $1'];

    if (input.sourceId) {
      params.push(input.sourceId);
      where.push(`sr.source_id = $${params.length}`);
    }

    if (input.classification) {
      params.push(input.classification);
      where.push(`sr.run_classification = $${params.length}`);
    }

    if (input.status) {
      params.push(input.status);
      where.push(`sr.status = $${params.length}`);
    }

    params.push(input.limit ?? 100);

    const result = await this.query<TenantRunRow>(
      `SELECT
         sr.id,
         sr.source_id as "sourceId",
         s.name as "sourceName",
         sr.status,
         sr.run_classification as "runClassification",
         sr.worker_type as "workerType",
         sr.started_at::text as "startedAt",
         sr.ended_at::text as "endedAt",
         sr.pages_succeeded as "pagesSucceeded",
         sr.pages_failed as "pagesFailed",
         sr.pages_dead_letter as "pagesDeadLetter",
         sr.summary_json as "summary"
       FROM source_runs sr
       JOIN sources s ON s.id = sr.source_id
       WHERE ${where.join(' AND ')}
       ORDER BY sr.started_at DESC
       LIMIT $${params.length}`,
      params
    );

    return result.rows;
  }

  public async listTenantChanges(input: {
    tenantId: string;
    sourceId?: string;
    limit?: number;
  }): Promise<ChangeEventRow[]> {
    const params: unknown[] = [input.tenantId];
    const where: string[] = ['tenant_id = $1'];

    if (input.sourceId) {
      params.push(input.sourceId);
      where.push(`source_id = $${params.length}`);
    }

    params.push(input.limit ?? 100);
    const result = await this.query<ChangeEventRow>(
      `SELECT
         id,
         source_id as "sourceId",
         entity_id as "entityId",
         change_scope as "changeScope",
         page_changed as "pageChanged",
         entity_changed as "entityChanged",
         field_changes as "fieldChanges",
         event_envelope as "envelope",
         created_at::text as "createdAt"
       FROM change_events
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params
    );

    return result.rows;
  }

  public async getTenantDiagnostics(tenantId: string): Promise<{
    degradedSources: number;
    repeatedFailures: number;
    policyBlocked: number;
    authFailures24h: number;
    publishFailures24h: number;
    slowRuns24h: number;
    browserRuns24h: number;
  }> {
    const result = await this.query<{
      degradedSources: number;
      repeatedFailures: number;
      policyBlocked: number;
      authFailures24h: number;
      publishFailures24h: number;
      slowRuns24h: number;
      browserRuns24h: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE s.health_status = 'degraded')::int as "degradedSources",
         COUNT(*) FILTER (WHERE s.failure_streak >= 3)::int as "repeatedFailures",
         COUNT(*) FILTER (WHERE s.operator_state = 'blocked' OR s.governance_status = 'blocked')::int as "policyBlocked",
         COALESCE((
           SELECT COUNT(*)::int
           FROM audit_logs al
           WHERE al.tenant_id = $1
             AND al.action IN ('session.reauth_failed', 'session.validation.failed')
             AND al.created_at >= NOW() - INTERVAL '24 hours'
         ), 0) as "authFailures24h",
         COALESCE((
           SELECT COUNT(*)::int
           FROM delivery_events de
           WHERE de.tenant_id = $1
             AND de.status = 'failed'
             AND de.created_at >= NOW() - INTERVAL '24 hours'
         ), 0) as "publishFailures24h",
         COALESCE((
           SELECT COUNT(*)::int
           FROM source_runs sr
           WHERE sr.tenant_id = $1
             AND sr.started_at >= NOW() - INTERVAL '24 hours'
             AND EXTRACT(EPOCH FROM (COALESCE(sr.ended_at, NOW()) - sr.started_at)) > 300
         ), 0) as "slowRuns24h",
         COALESCE((
           SELECT COUNT(*)::int
           FROM source_runs sr
           WHERE sr.tenant_id = $1
             AND sr.started_at >= NOW() - INTERVAL '24 hours'
             AND sr.worker_type = 'browser'
         ), 0) as "browserRuns24h"
       FROM sources s
       WHERE s.tenant_id = $1`,
      [tenantId]
    );

    return (
      result.rows[0] ?? {
        degradedSources: 0,
        repeatedFailures: 0,
        policyBlocked: 0,
        authFailures24h: 0,
        publishFailures24h: 0,
        slowRuns24h: 0,
        browserRuns24h: 0
      }
    );
  }

  public async getLatestSourceSnapshot(sourceId: string, tenantId: string, url?: string): Promise<SourceSnapshotRow | null> {
    const result = url
      ? await this.query<SourceSnapshotRow>(
          `SELECT
             sp.id as "pageId",
             sp.source_id as "sourceId",
             sp.url,
             sp.canonical_url as "canonicalUrl",
             sp.raw_html as "rawHtml",
             sp.fetched_at::text as "fetchedAt"
           FROM source_pages sp
           WHERE sp.source_id = $1
             AND sp.tenant_id = $2
             AND (sp.url = $3 OR sp.canonical_url = $3)
           ORDER BY sp.fetched_at DESC
           LIMIT 1`,
          [sourceId, tenantId, url]
        )
      : await this.query<SourceSnapshotRow>(
          `SELECT
             sp.id as "pageId",
             sp.source_id as "sourceId",
             sp.url,
             sp.canonical_url as "canonicalUrl",
             sp.raw_html as "rawHtml",
             sp.fetched_at::text as "fetchedAt"
           FROM source_pages sp
           WHERE sp.source_id = $1
             AND sp.tenant_id = $2
           ORDER BY sp.fetched_at DESC
           LIMIT 1`,
          [sourceId, tenantId]
        );

    return result.rows[0] ?? null;
  }

  public async createOnboardingDraft(input: {
    tenantId: string;
    name: string;
    sourceId?: string | null;
    draftJson?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<string> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO source_onboarding_drafts (
         tenant_id,
         source_id,
         name,
         status,
         step_index,
         draft_json,
         last_validation,
         created_by,
         updated_by,
         created_at,
         updated_at
       ) VALUES ($1,$2,$3,'draft',0,$4,'{}'::jsonb,$5,$5,NOW(),NOW())
       RETURNING id`,
      [input.tenantId, input.sourceId ?? null, input.name, input.draftJson ?? {}, input.createdBy ?? null]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('failed to create onboarding draft');
    }
    return row.id;
  }

  public async listOnboardingDrafts(tenantId: string, limit = 50): Promise<OnboardingDraftRow[]> {
    const result = await this.query<OnboardingDraftRow>(
      `SELECT
         id,
         tenant_id as "tenantId",
         source_id as "sourceId",
         name,
         status,
         step_index as "stepIndex",
         draft_json as "draftJson",
         last_validation as "lastValidation",
         created_by as "createdBy",
         updated_by as "updatedBy",
         created_at::text as "createdAt",
         updated_at::text as "updatedAt"
       FROM source_onboarding_drafts
       WHERE tenant_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  }

  public async getOnboardingDraft(draftId: string, tenantId: string): Promise<OnboardingDraftRow | null> {
    const result = await this.query<OnboardingDraftRow>(
      `SELECT
         id,
         tenant_id as "tenantId",
         source_id as "sourceId",
         name,
         status,
         step_index as "stepIndex",
         draft_json as "draftJson",
         last_validation as "lastValidation",
         created_by as "createdBy",
         updated_by as "updatedBy",
         created_at::text as "createdAt",
         updated_at::text as "updatedAt"
       FROM source_onboarding_drafts
       WHERE id = $1 AND tenant_id = $2
       LIMIT 1`,
      [draftId, tenantId]
    );
    return result.rows[0] ?? null;
  }

  public async updateOnboardingDraft(input: {
    draftId: string;
    tenantId: string;
    name?: string;
    sourceId?: string | null;
    status?: string;
    stepIndex?: number;
    draftJson?: Record<string, unknown>;
    lastValidation?: Record<string, unknown>;
    updatedBy?: string | null;
  }): Promise<void> {
    await this.query(
      `UPDATE source_onboarding_drafts
       SET
         name = COALESCE($3, name),
         source_id = COALESCE($4, source_id),
         status = COALESCE($5, status),
         step_index = COALESCE($6, step_index),
         draft_json = COALESCE($7, draft_json),
         last_validation = COALESCE($8, last_validation),
         updated_by = COALESCE($9, updated_by),
         updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [
        input.draftId,
        input.tenantId,
        input.name ?? null,
        input.sourceId ?? null,
        input.status ?? null,
        input.stepIndex ?? null,
        input.draftJson ?? null,
        input.lastValidation ?? null,
        input.updatedBy ?? null
      ]
    );
  }

  public async insertReplayJob(input: {
    tenantId: string;
    sourceId: string | null;
    jobType: 'replay' | 'backfill' | 'reprocess';
    dryRun: boolean;
    idempotencyKey: string;
    params: Record<string, unknown>;
  }): Promise<string> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO replay_jobs (
         tenant_id,
         source_id,
         job_type,
         dry_run,
         idempotency_key,
         params,
         created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (idempotency_key)
       DO UPDATE SET params = EXCLUDED.params
       RETURNING id`,
      [input.tenantId, input.sourceId, input.jobType, input.dryRun, input.idempotencyKey, input.params]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('failed to insert replay job');
    }
    return row.id;
  }

  public async listReplayJobs(tenantId: string, limit = 50): Promise<
    Array<{
      id: string;
      sourceId: string | null;
      jobType: string;
      dryRun: boolean;
      status: string;
      startedAt: string | null;
      endedAt: string | null;
      params: Record<string, unknown>;
      resultSummary: Record<string, unknown>;
      createdAt: string;
    }>
  > {
    const result = await this.query<{
      id: string;
      sourceId: string | null;
      jobType: string;
      dryRun: boolean;
      status: string;
      startedAt: string | null;
      endedAt: string | null;
      params: Record<string, unknown>;
      resultSummary: Record<string, unknown>;
      createdAt: string;
    }>(
      `SELECT
         id,
         source_id as "sourceId",
         job_type as "jobType",
         dry_run as "dryRun",
         status,
         started_at::text as "startedAt",
         ended_at::text as "endedAt",
         params,
         result_summary as "resultSummary",
         created_at::text as "createdAt"
       FROM replay_jobs
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    return result.rows;
  }

  public async updateReplayJobStatus(input: {
    replayJobId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    resultSummary?: Record<string, unknown>;
  }): Promise<void> {
    await this.query(
      `UPDATE replay_jobs
       SET
         status = $2,
         started_at = CASE WHEN $2 = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
         ended_at = CASE WHEN $2 IN ('completed','failed') THEN NOW() ELSE ended_at END,
         result_summary = COALESCE($3, result_summary)
       WHERE id = $1`,
      [input.replayJobId, input.status, input.resultSummary ?? null]
    );
  }

  public async upsertAdapterPackage(input: {
    adapterId: string;
    version: string;
    name: string;
    status: string;
    internalOnly: boolean;
    manifest: Record<string, unknown>;
    changelog: unknown[];
    sampleOutput: Record<string, unknown>;
  }): Promise<string> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO adapter_packages (
         adapter_id,
         version,
         name,
         status,
         internal_only,
         manifest,
         changelog,
         sample_output,
         created_at,
         updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
       ON CONFLICT (adapter_id, version)
       DO UPDATE SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         internal_only = EXCLUDED.internal_only,
         manifest = EXCLUDED.manifest,
         changelog = EXCLUDED.changelog,
         sample_output = EXCLUDED.sample_output,
         updated_at = NOW()
       RETURNING id`,
      [
        input.adapterId,
        input.version,
        input.name,
        input.status,
        input.internalOnly,
        input.manifest,
        input.changelog,
        input.sampleOutput
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('failed to upsert adapter package');
    }
    return row.id;
  }

  public async listAdapterPackages(status?: string): Promise<AdapterCatalogRow[]> {
    const result = status
      ? await this.query<AdapterCatalogRow>(
          `SELECT
             id,
             adapter_id as "adapterId",
             version,
             name,
             status,
             internal_only as "internalOnly",
             manifest,
             changelog,
             sample_output as "sampleOutput",
             created_at::text as "createdAt",
             updated_at::text as "updatedAt"
           FROM adapter_packages
           WHERE status = $1
           ORDER BY updated_at DESC`,
          [status]
        )
      : await this.query<AdapterCatalogRow>(
          `SELECT
             id,
             adapter_id as "adapterId",
             version,
             name,
             status,
             internal_only as "internalOnly",
             manifest,
             changelog,
             sample_output as "sampleOutput",
             created_at::text as "createdAt",
             updated_at::text as "updatedAt"
           FROM adapter_packages
           ORDER BY updated_at DESC`
        );

    return result.rows;
  }

  public async createDestination(input: {
    tenantId: string;
    name: string;
    destinationType: string;
    status?: string;
    configJson?: Record<string, unknown>;
    eventTypes?: string[];
    sourceIds?: string[];
    entityTypes?: string[];
    contractVersions?: string[];
    maxRetries?: number;
  }): Promise<string> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO destinations (
         tenant_id,
         name,
         destination_type,
         status,
         config_json,
         event_types,
         source_ids,
         entity_types,
         contract_versions,
         max_retries,
         created_at,
         updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::uuid[],$8,$9,$10,NOW(),NOW())
       RETURNING id`,
      [
        input.tenantId,
        input.name,
        input.destinationType,
        input.status ?? 'active',
        input.configJson ?? {},
        input.eventTypes ?? [],
        input.sourceIds ?? [],
        input.entityTypes ?? [],
        input.contractVersions ?? ['1.0'],
        input.maxRetries ?? 3
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('failed to create destination');
    }
    return row.id;
  }

  public async listDestinations(tenantId: string, includePaused = true): Promise<DestinationRow[]> {
    const result = includePaused
      ? await this.query<DestinationRow>(
          `SELECT
             id,
             tenant_id as "tenantId",
             name,
             destination_type as "destinationType",
             status,
             config_json as "configJson",
             event_types as "eventTypes",
             source_ids as "sourceIds",
             entity_types as "entityTypes",
             contract_versions as "contractVersions",
             max_retries as "maxRetries",
             last_health_status as "lastHealthStatus",
             last_health_checked_at::text as "lastHealthCheckedAt",
             last_health_error as "lastHealthError",
             created_at::text as "createdAt",
             updated_at::text as "updatedAt"
           FROM destinations
           WHERE tenant_id = $1
           ORDER BY created_at DESC`,
          [tenantId]
        )
      : await this.query<DestinationRow>(
          `SELECT
             id,
             tenant_id as "tenantId",
             name,
             destination_type as "destinationType",
             status,
             config_json as "configJson",
             event_types as "eventTypes",
             source_ids as "sourceIds",
             entity_types as "entityTypes",
             contract_versions as "contractVersions",
             max_retries as "maxRetries",
             last_health_status as "lastHealthStatus",
             last_health_checked_at::text as "lastHealthCheckedAt",
             last_health_error as "lastHealthError",
             created_at::text as "createdAt",
             updated_at::text as "updatedAt"
           FROM destinations
           WHERE tenant_id = $1
             AND status <> 'paused'
           ORDER BY created_at DESC`,
          [tenantId]
        );

    return result.rows;
  }

  public async updateDestination(input: {
    destinationId: string;
    tenantId: string;
    name?: string;
    status?: string;
    configJson?: Record<string, unknown>;
    eventTypes?: string[];
    sourceIds?: string[];
    entityTypes?: string[];
    contractVersions?: string[];
    maxRetries?: number;
    lastHealthStatus?: string;
    lastHealthError?: string | null;
  }): Promise<void> {
    await this.query(
      `UPDATE destinations
       SET
         name = COALESCE($3, name),
         status = COALESCE($4, status),
         config_json = COALESCE($5, config_json),
         event_types = COALESCE($6, event_types),
         source_ids = COALESCE($7::uuid[], source_ids),
         entity_types = COALESCE($8, entity_types),
         contract_versions = COALESCE($9, contract_versions),
         max_retries = COALESCE($10, max_retries),
         last_health_status = COALESCE($11, last_health_status),
         last_health_error = COALESCE($12, last_health_error),
         last_health_checked_at = CASE WHEN $11 IS NOT NULL THEN NOW() ELSE last_health_checked_at END,
         updated_at = NOW()
       WHERE id = $1
         AND tenant_id = $2`,
      [
        input.destinationId,
        input.tenantId,
        input.name ?? null,
        input.status ?? null,
        input.configJson ?? null,
        input.eventTypes ?? null,
        input.sourceIds ?? null,
        input.entityTypes ?? null,
        input.contractVersions ?? null,
        input.maxRetries ?? null,
        input.lastHealthStatus ?? null,
        input.lastHealthError ?? null
      ]
    );
  }

  public async insertDestinationDelivery(input: {
    tenantId: string;
    destinationId: string;
    sourceId: string;
    entityId: string | null;
    eventId: string;
    eventType: string;
    contractVersion: string;
    idempotencyKey: string;
    payloadHash: string;
    payloadJson: Record<string, unknown>;
    maxAttempts?: number;
    replayOfDeliveryId?: string | null;
  }): Promise<string | null> {
    const result = await this.query<{ id: string }>(
      `INSERT INTO destination_deliveries (
         tenant_id,
         destination_id,
         source_id,
         entity_id,
         event_id,
         event_type,
         contract_version,
         idempotency_key,
         payload_hash,
         payload_json,
         delivery_state,
         attempts,
         max_attempts,
         replay_of_delivery_id,
         queued_at,
         created_at,
         updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'queued',0,$11,$12,NOW(),NOW(),NOW())
       ON CONFLICT (destination_id, idempotency_key, payload_hash)
       DO NOTHING
       RETURNING id`,
      [
        input.tenantId,
        input.destinationId,
        input.sourceId,
        input.entityId,
        input.eventId,
        input.eventType,
        input.contractVersion,
        input.idempotencyKey,
        input.payloadHash,
        input.payloadJson,
        input.maxAttempts ?? 3,
        input.replayOfDeliveryId ?? null
      ]
    );

    return result.rows[0]?.id ?? null;
  }

  public async updateDestinationDeliveryState(input: {
    deliveryId: string;
    destinationId: string;
    state: 'queued' | 'sent' | 'acknowledged' | 'failed' | 'dead_lettered';
    error?: string | null;
  }): Promise<void> {
    await this.query(
      `UPDATE destination_deliveries
       SET
         delivery_state = $3,
         attempts = CASE WHEN $3 IN ('sent','failed','dead_lettered') THEN attempts + 1 ELSE attempts END,
         sent_at = CASE WHEN $3 = 'sent' THEN NOW() ELSE sent_at END,
         acknowledged_at = CASE WHEN $3 = 'acknowledged' THEN NOW() ELSE acknowledged_at END,
         failed_at = CASE WHEN $3 = 'failed' THEN NOW() ELSE failed_at END,
         dead_lettered_at = CASE WHEN $3 = 'dead_lettered' THEN NOW() ELSE dead_lettered_at END,
         last_error = $4,
         updated_at = NOW()
       WHERE id = $1
         AND destination_id = $2`,
      [input.deliveryId, input.destinationId, input.state, input.error ?? null]
    );
  }

  public async listDestinationDeliveries(input: {
    tenantId: string;
    destinationId?: string;
    sourceId?: string;
    eventType?: string;
    state?: string;
    limit?: number;
  }): Promise<DestinationDeliveryRow[]> {
    const params: unknown[] = [input.tenantId];
    const where: string[] = ['tenant_id = $1'];

    if (input.destinationId) {
      params.push(input.destinationId);
      where.push(`destination_id = $${params.length}`);
    }
    if (input.sourceId) {
      params.push(input.sourceId);
      where.push(`source_id = $${params.length}`);
    }
    if (input.eventType) {
      params.push(input.eventType);
      where.push(`event_type = $${params.length}`);
    }
    if (input.state) {
      params.push(input.state);
      where.push(`delivery_state = $${params.length}`);
    }

    params.push(input.limit ?? 200);

    const result = await this.query<DestinationDeliveryRow>(
      `SELECT
         id,
         tenant_id as "tenantId",
         destination_id as "destinationId",
         source_id as "sourceId",
         entity_id as "entityId",
         event_id as "eventId",
         event_type as "eventType",
         contract_version as "contractVersion",
         idempotency_key as "idempotencyKey",
         payload_hash as "payloadHash",
         payload_json as "payloadJson",
         delivery_state as "deliveryState",
         attempts,
         max_attempts as "maxAttempts",
         last_error as "lastError",
         replay_of_delivery_id as "replayOfDeliveryId",
         queued_at::text as "queuedAt",
         sent_at::text as "sentAt",
         acknowledged_at::text as "acknowledgedAt",
         failed_at::text as "failedAt",
         dead_lettered_at::text as "deadLetteredAt",
         created_at::text as "createdAt",
         updated_at::text as "updatedAt"
       FROM destination_deliveries
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params
    );

    return result.rows;
  }

  public async replayFailedDestinationDeliveries(input: {
    tenantId: string;
    destinationId: string;
    actorId: string;
    limit?: number;
  }): Promise<number> {
    const limit = input.limit ?? 100;
    const result = await this.query<{ id: string }>(
      `SELECT id
       FROM destination_deliveries
       WHERE tenant_id = $1
         AND destination_id = $2
         AND delivery_state IN ('failed','dead_lettered')
       ORDER BY updated_at DESC
       LIMIT $3`,
      [input.tenantId, input.destinationId, limit]
    );

    for (const row of result.rows) {
      await this.query(
        `UPDATE destination_deliveries
         SET
           delivery_state = 'queued',
           last_error = NULL,
           updated_at = NOW()
         WHERE id = $1`,
        [row.id]
      );
    }

    await this.insertAuditLog({
      tenantId: input.tenantId,
      actorType: 'operator',
      actorId: input.actorId,
      action: 'destination.delivery.replay',
      targetType: 'destination',
      targetId: input.destinationId,
      details: { count: result.rows.length }
    });

    return result.rows.length;
  }

  private async withTransaction<T>(handler: (tx: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
