import { createHash, randomUUID } from 'node:crypto';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { Client, Connection } from '@temporalio/client';
import { loadAdminConfig } from '@kovi/config';
import { KoviDatabase } from '@kovi/db';
import { bootstrapOtel } from '@kovi/observability';
import { createLogger } from '@kovi/shared';
import {
  AuthDashboardAdapter,
  createDecryptor,
  createEncryptor,
  evaluateSourcePolicy,
  EnvironmentSecretProvider,
  headerTokenStrategy,
  hydrateSourceDefinition,
  JsListingDetailAdapter,
  manualCookieStrategy,
  normalizeEntity,
  playwrightFormLoginStrategy,
  StaticCatalogAdapter,
  type SourceDefinition,
  SessionManager,
  type SessionCookie
} from '@kovi/source-sdk';
import { renderAdminHtml } from './ui.js';
import {
  buildSourceDefinitionConfig,
  type OnboardingDraftJson,
  validateOnboardingDraft
} from './operator-tools.js';

const config = loadAdminConfig();
await bootstrapOtel({
  serviceName: 'admin',
  serviceVersion: config.OTEL_SERVICE_VERSION,
  endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  enabled: config.OTEL_ENABLED
});

const logger = createLogger({ service: 'admin', env: config.NODE_ENV });
const app = Fastify({ loggerInstance: logger });
const db = new KoviDatabase(config.DATABASE_URL);

type TenantRequest = FastifyRequest & {
  tenantContext?: {
    tenantId: string;
    role: string;
  };
};

const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex');

const requireTenant = (request: FastifyRequest, reply: FastifyReply): { tenantId: string; role: string } | null => {
  const context = (request as TenantRequest).tenantContext;
  if (!context) {
    void reply.status(403).send({ error: 'missing tenant context' });
    return null;
  }
  return context;
};

const isPlatformAdmin = (role: string): boolean =>
  role === 'platform_admin' || role === 'platform-admin' || role === 'owner';

const getActorId = (actorId: string | undefined): string => actorId ?? 'operator:manual';

await app.register(rateLimit, {
  max: config.ADMIN_RATE_LIMIT_MAX,
  timeWindow: config.ADMIN_RATE_LIMIT_WINDOW,
  allowList: ['127.0.0.1', '::1']
});

app.addHook('preHandler', async (request, reply) => {
  if (!request.url.startsWith('/admin/api/')) {
    return;
  }

  const tenantSlug = request.headers['x-kovi-tenant'];
  const serviceToken = request.headers['x-kovi-service-token'];

  if (typeof tenantSlug !== 'string' || typeof serviceToken !== 'string') {
    return reply.status(401).send({ error: 'missing tenant credentials' });
  }

  const tenant = await db.getTenantByTokenHash(tokenHash(serviceToken), tenantSlug);
  if (!tenant) {
    return reply.status(403).send({ error: 'invalid tenant credentials' });
  }

  await db.touchServiceToken(tenant.tokenId);
  (request as TenantRequest).tenantContext = {
    tenantId: tenant.tenantId,
    role: tenant.role
  };
});

const parseIntervalSeconds = (value: string): number => {
  const normalized = value.trim().toLowerCase();
  if (normalized === '1m' || normalized === 'pt1m') {
    return 60;
  }
  if (normalized === '5m' || normalized === 'pt5m') {
    return 300;
  }
  if (normalized === '15m' || normalized === 'pt15m') {
    return 900;
  }
  if (normalized === 'hourly' || normalized === '1h' || normalized === 'pt1h') {
    return 3600;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 900;
};

const workerTypeFromSource = (fetchMode: 'static' | 'js'): 'static' | 'browser' =>
  fetchMode === 'js' ? 'browser' : 'static';

const toWorkflowConfig = (
  source: SourceDefinition
): {
  sourceId: string;
  sourceName: string;
  runClassification: 'scheduled' | 'manual' | 'replay' | 'backfill' | 'reprocess';
  intervalSeconds: number;
  workerType: 'static' | 'browser';
  perSourceConcurrency: number;
  perDomainConcurrency: number;
  deadLetterThreshold: number;
  continueAsNewPageThreshold: number;
} => ({
  sourceId: source.id,
  sourceName: source.name,
  runClassification: 'manual',
  intervalSeconds: parseIntervalSeconds(source.scheduleInterval),
  workerType: workerTypeFromSource(source.fetchMode),
  perSourceConcurrency: 4,
  perDomainConcurrency: 3,
  deadLetterThreshold: 3,
  continueAsNewPageThreshold: 250
});

const triggerManualRun = async (source: SourceDefinition): Promise<{ workflowId: string }> => {
  const temporalConnection = await Connection.connect({ address: config.TEMPORAL_ADDRESS });
  const temporalClient = new Client({
    connection: temporalConnection,
    namespace: config.TEMPORAL_NAMESPACE
  });

  const workflowId = `manual-source-run-${source.id}-${Date.now()}`;

  try {
    await temporalClient.workflow.start('sourceRunWorkflow', {
      taskQueue: 'kovi-orchestrator',
      workflowId,
      args: [{ config: toWorkflowConfig(source) }]
    });

    return { workflowId };
  } finally {
    await temporalConnection.close();
  }
};

const sessionManager = new SessionManager({
  repository: db,
  secretProvider: new EnvironmentSecretProvider(),
  encrypt: createEncryptor(config.SESSION_ENCRYPTION_KEY),
  decrypt: createDecryptor(config.SESSION_ENCRYPTION_KEY),
  strategies: {
    none: undefined,
    'manual-cookie-import': manualCookieStrategy,
    'playwright-form-login': playwrightFormLoginStrategy,
    'header-token-injection': headerTokenStrategy
  }
});

app.get('/health', async () => ({ status: 'ok', service: 'admin', timestamp: new Date().toISOString() }));

app.get('/', async (_, reply) => reply.type('text/html').send(renderAdminHtml()));

app.get('/admin/api/health', async () => ({ status: 'ok', service: 'admin', timestamp: new Date().toISOString() }));

app.get('/admin/api/sources', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return { sources: [] };
  }
  const sources = await db.listSourcesByTenant(tenant.tenantId);
  return { sources };
});

app.get<{ Params: { sourceId: string } }>('/admin/api/sources/:sourceId/overview', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return reply.status(404).send({ error: 'source not found' });
  }

  const definition = hydrateSourceDefinition({
    id: source.id,
    name: source.name,
    adapterType: source.adapter_type,
    configJson: source.config_json
  });

  const [
    status,
    sessions,
    recentRuns,
    failedRuns,
    changes,
    latestEntities,
    snapshots,
    webhooks,
    auditLogs,
    metrics,
    replayJobs,
    deliveryStats
  ] = await Promise.all([
    db.getSourceStatus(source.id),
    db.listSessionHealth(),
    db.getRecentRuns(source.id, 20),
    db.getFailedRuns(source.id, 20),
    db.getSourceChanges(source.id, 50),
    db.getLatestEntities(source.id, 30),
    db.getPageSnapshotsMetadata(source.id, 40),
    db.listWebhooks(source.id),
    db.getAuditLogs({ sourceId: source.id, limit: 100 }),
    db.getSourceMetrics(source.id, 7),
    db.listReplayJobs(tenant.tenantId, 100),
    db.query<{
      published: number;
      failed: number;
      pending: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'published')::int as published,
         COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
         COUNT(*) FILTER (WHERE status = 'pending')::int as pending
       FROM delivery_events
       WHERE source_id = $1
         AND tenant_id = $2
         AND created_at >= NOW() - INTERVAL '7 days'`,
      [source.id, tenant.tenantId]
    )
  ]);

  const session = sessions.find((row) => row.sourceId === source.id) ?? null;
  const successRatePct =
    metrics.runCount > 0 ? Number(((metrics.successRuns / metrics.runCount) * 100).toFixed(1)) : 0;

  return {
    source: {
      id: source.id,
      name: source.name,
      adapterType: source.adapter_type,
      active: source.active,
      fetchMode: definition.fetchMode,
      scheduleInterval: definition.scheduleInterval,
      crawlEntrypoints: definition.crawlEntrypoints,
      extractionSelectors: definition.extractionSelectors
    },
    status,
    session,
    recentRuns,
    failedRuns,
    changes,
    latestEntities,
    snapshots,
    webhooks,
    replayJobs: replayJobs.filter((job) => job.sourceId === source.id),
    auditLogs,
    deliveryStats: deliveryStats.rows[0] ?? { published: 0, failed: 0, pending: 0 },
    metrics: {
      ...metrics,
      successRatePct
    }
  };
});

app.get<{ Querystring: { sourceId?: string; limit?: string } }>('/admin/api/audit', async (request) => {
  const limit = request.query.limit ? Number(request.query.limit) : 100;
  const input = {
    ...(request.query.sourceId !== undefined ? { sourceId: request.query.sourceId } : {}),
    limit
  };
  const logs = await db.getAuditLogs(input);
  return { logs };
});

app.get<{ Querystring: { sourceId?: string } }>('/admin/api/webhooks', async (request) => {
  const tenant = (request as TenantRequest).tenantContext;
  if (!tenant) {
    return { webhooks: [] };
  }

  const webhooks = request.query.sourceId
    ? await db.query(
        `SELECT
           id,
           source_id as "sourceId",
           url,
           secret_ref as "secretRef",
           active,
           created_at::text as "createdAt",
           updated_at::text as "updatedAt"
         FROM webhooks
         WHERE tenant_id = $1 AND source_id = $2
         ORDER BY created_at DESC`,
        [tenant.tenantId, request.query.sourceId]
      )
    : await db.query(
        `SELECT
           id,
           source_id as "sourceId",
           url,
           secret_ref as "secretRef",
           active,
           created_at::text as "createdAt",
           updated_at::text as "updatedAt"
         FROM webhooks
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenant.tenantId]
      );

  return { webhooks: webhooks.rows };
});

app.post<{ Body: { sourceId?: string | null; url: string; secretRef?: string | null; active?: boolean; actorId?: string } }>(
  '/admin/api/webhooks',
  async (request, reply) => {
    const tenant = requireTenant(request, reply);
    if (!tenant) {
      return;
    }

    if (request.body.sourceId) {
      const sourceMatch = await db.getSourceByIdForTenant(request.body.sourceId, tenant.tenantId);
      if (!sourceMatch) {
        return reply.status(404).send({ error: 'source not found' });
      }
    }

    const createInput = {
      sourceId: request.body.sourceId ?? null,
      url: request.body.url,
      secretRef: request.body.secretRef ?? null,
      tenantId: tenant.tenantId,
      ...(request.body.active !== undefined ? { active: request.body.active } : {})
    };

    const webhookId = await db.createWebhook({ ...createInput });

    await db.insertAuditLog({
      tenantId: tenant.tenantId,
      actorType: 'operator',
      actorId: request.body.actorId ?? 'operator:manual',
      action: 'webhook.created',
      targetType: 'webhook',
      targetId: webhookId,
      details: {
        sourceId: createInput.sourceId,
        url: createInput.url
      }
    });

    return reply.status(201).send({ webhookId });
  }
);

app.patch<{ Params: { webhookId: string }; Body: { url?: string; secretRef?: string | null; active?: boolean; actorId?: string } }>(
  '/admin/api/webhooks/:webhookId',
  async (request, reply) => {
    const tenant = requireTenant(request, reply);
    if (!tenant) {
      return;
    }

    const match = await db.query('SELECT id FROM webhooks WHERE id = $1 AND tenant_id = $2 LIMIT 1', [
      request.params.webhookId,
      tenant.tenantId
    ]);
    if (!match.rows[0]) {
      return reply.status(404).send({ error: 'webhook not found' });
    }

    const updateInput = {
      webhookId: request.params.webhookId,
      ...(request.body.url !== undefined ? { url: request.body.url } : {}),
      ...(request.body.secretRef !== undefined ? { secretRef: request.body.secretRef } : {}),
      ...(request.body.active !== undefined ? { active: request.body.active } : {})
    };

    await db.updateWebhook({ ...updateInput });

    await db.insertAuditLog({
      tenantId: tenant.tenantId,
      actorType: 'operator',
      actorId: request.body.actorId ?? 'operator:manual',
      action: 'webhook.updated',
      targetType: 'webhook',
      targetId: request.params.webhookId,
      details: {
        changes: updateInput
      }
    });

    return { ok: true };
  }
);

app.delete<{ Params: { webhookId: string }; Body: { actorId?: string } }>('/admin/api/webhooks/:webhookId', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const result = await db.query('DELETE FROM webhooks WHERE id = $1 AND tenant_id = $2', [
    request.params.webhookId,
    tenant.tenantId
  ]);

  if ((result.rowCount ?? 0) === 0) {
    return reply.status(404).send({ error: 'webhook not found' });
  }

  await db.insertAuditLog({
    tenantId: tenant.tenantId,
    actorType: 'operator',
    actorId: request.body?.actorId ?? 'operator:manual',
    action: 'webhook.deleted',
    targetType: 'webhook',
    targetId: request.params.webhookId,
    details: {}
  });
  return { ok: true };
});

app.post<{ Params: { sourceId: string }; Body: { actorId?: string } }>('/admin/api/sources/:sourceId/pause', async (request) => {
  const tenant = (request as TenantRequest).tenantContext;
  if (!tenant) {
    return { ok: false, error: 'missing tenant context' };
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return { ok: false, error: 'source not found' };
  }

  await db.setSourceActive(source.id, false);
  await db.insertAuditLog({
    tenantId: tenant.tenantId,
    actorType: 'operator',
    actorId: request.body?.actorId ?? 'operator:manual',
    action: 'source.paused',
    targetType: 'source',
    targetId: request.params.sourceId,
    details: { active: false }
  });
  return { ok: true };
});

app.post<{ Params: { sourceId: string }; Body: { actorId?: string } }>('/admin/api/sources/:sourceId/resume', async (request) => {
  const tenant = (request as TenantRequest).tenantContext;
  if (!tenant) {
    return { ok: false, error: 'missing tenant context' };
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return { ok: false, error: 'source not found' };
  }

  await db.setSourceActive(source.id, true);
  await db.insertAuditLog({
    tenantId: tenant.tenantId,
    actorType: 'operator',
    actorId: request.body?.actorId ?? 'operator:manual',
    action: 'source.resumed',
    targetType: 'source',
    targetId: request.params.sourceId,
    details: { active: true }
  });
  return { ok: true };
});

app.patch<{ Params: { sourceId: string }; Body: { state: 'allowed' | 'review' | 'blocked'; actorId?: string } }>(
  '/admin/api/sources/:sourceId/operator-state',
  async (request, reply) => {
    const tenant = requireTenant(request, reply);
    if (!tenant) {
      return;
    }

    if (!request.body?.state || !['allowed', 'review', 'blocked'].includes(request.body.state)) {
      return { ok: false, error: 'state must be one of allowed|review|blocked' };
    }

    const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
    if (!source) {
      return reply.status(404).send({ error: 'source not found' });
    }

    await db.setSourceOperatorState(request.params.sourceId, request.body.state);
    await db.insertAuditLog({
      tenantId: tenant.tenantId,
      actorType: 'operator',
      actorId: request.body.actorId ?? 'operator:manual',
      action: 'source.operator_state.updated',
      targetType: 'source',
      targetId: request.params.sourceId,
      details: { state: request.body.state }
    });

    return { ok: true };
  }
);

app.patch<{ Params: { sourceId: string }; Body: { selectors: Record<string, unknown>; actorId?: string } }>(
  '/admin/api/sources/:sourceId/selectors',
  async (request, reply) => {
    const tenant = requireTenant(request, reply);
    if (!tenant) {
      return;
    }

    if (!request.body?.selectors || typeof request.body.selectors !== 'object') {
      return reply.status(400).send({ error: 'selectors must be an object' });
    }

    const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
    if (!source) {
      return reply.status(404).send({ error: 'source not found' });
    }

    await db.updateExtractionSelectors(request.params.sourceId, request.body.selectors);
    await db.insertAuditLog({
      tenantId: tenant.tenantId,
      actorType: 'operator',
      actorId: request.body.actorId ?? 'operator:manual',
      action: 'source.selectors.updated',
      targetType: 'source',
      targetId: request.params.sourceId,
      details: {
        selectorKeys: Object.keys(request.body.selectors)
      }
    });

    return { ok: true };
  }
);

app.patch<{
  Params: { sourceId: string };
  Body: {
    governanceStatus?: 'allowed' | 'review_required' | 'paused' | 'blocked';
    allowedDomains?: string[];
    crawlDepthLimit?: number;
    maxPagesPerRun?: number;
    authRequired?: boolean;
    exportRestrictions?: Record<string, unknown>;
    retentionDays?: number;
    actorId?: string;
  };
}>('/admin/api/sources/:sourceId/policy', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return reply.status(404).send({ error: 'source not found' });
  }

  await db.query(
    `UPDATE sources
     SET
       governance_status = COALESCE($2, governance_status),
       policy_allowed_domains = COALESCE($3, policy_allowed_domains),
       policy_crawl_depth_limit = COALESCE($4, policy_crawl_depth_limit),
       policy_max_pages_per_run = COALESCE($5, policy_max_pages_per_run),
       policy_auth_required = COALESCE($6, policy_auth_required),
       policy_export_restrictions = COALESCE($7, policy_export_restrictions),
       policy_retention_days = COALESCE($8, policy_retention_days),
       updated_at = NOW()
     WHERE id = $1 AND tenant_id = $9`,
    [
      source.id,
      request.body.governanceStatus ?? null,
      request.body.allowedDomains ?? null,
      request.body.crawlDepthLimit ?? null,
      request.body.maxPagesPerRun ?? null,
      request.body.authRequired ?? null,
      request.body.exportRestrictions ?? null,
      request.body.retentionDays ?? null,
      tenant.tenantId
    ]
  );

  await db.insertAuditLog({
    tenantId: tenant.tenantId,
    actorType: 'operator',
    actorId: request.body.actorId ?? 'operator:manual',
    action: 'source.policy.updated',
    targetType: 'source',
    targetId: source.id,
    details: {
      governanceStatus: request.body.governanceStatus ?? null,
      allowedDomains: request.body.allowedDomains ?? null,
      crawlDepthLimit: request.body.crawlDepthLimit ?? null,
      maxPagesPerRun: request.body.maxPagesPerRun ?? null,
      authRequired: request.body.authRequired ?? null,
      retentionDays: request.body.retentionDays ?? null
    }
  });

  return { ok: true };
});

app.post<{ Body: { sourceId?: string | null; jobType: 'replay' | 'backfill' | 'reprocess'; dryRun?: boolean; params?: Record<string, unknown> } }>(
  '/admin/api/replay-jobs',
  async (request, reply) => {
    const tenant = requireTenant(request, reply);
    if (!tenant) {
      return;
    }

    const replayJobId = await db.insertReplayJob({
      tenantId: tenant.tenantId,
      sourceId: request.body.sourceId ?? null,
      jobType: request.body.jobType,
      dryRun: request.body.dryRun ?? true,
      idempotencyKey: `${tenant.tenantId}:${request.body.jobType}:${randomUUID()}`,
      params: request.body.params ?? {}
    });

    const workflowName =
      request.body.jobType === 'backfill'
        ? 'backfillWorkflow'
        : request.body.jobType === 'reprocess'
          ? 'reprocessWorkflow'
          : 'replayWorkflow';

    const temporalConnection = await Connection.connect({ address: config.TEMPORAL_ADDRESS });
    const temporalClient = new Client({
      connection: temporalConnection,
      namespace: config.TEMPORAL_NAMESPACE
    });

    try {
      await temporalClient.workflow.start(workflowName, {
        taskQueue: 'kovi-orchestrator',
        workflowId: `${request.body.jobType}-${replayJobId}`,
        args: [
          {
            replayJobId,
            tenantId: tenant.tenantId,
            sourceId: request.body.sourceId ?? null,
            dryRun: request.body.dryRun ?? true,
            params: request.body.params ?? {}
          }
        ]
      });
    } finally {
      await temporalConnection.close();
    }

    await db.insertAuditLog({
      tenantId: tenant.tenantId,
      actorType: 'operator',
      actorId: 'operator:manual',
      action: 'replay.job.created',
      targetType: 'replay_job',
      targetId: replayJobId,
      details: { jobType: request.body.jobType, dryRun: request.body.dryRun ?? true }
    });

    return { replayJobId };
  }
);

app.get<{ Querystring: { limit?: string } }>('/admin/api/replay-jobs', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const limit = request.query.limit ? Number(request.query.limit) : 50;
  const jobs = await db.listReplayJobs(tenant.tenantId, limit);
  return { jobs };
});

app.get<{ Params: { sourceId: string }; Querystring: { html?: string; url?: string } }>(
  '/admin/api/sources/:sourceId/simulate',
  async (request, reply) => {
    const tenant = requireTenant(request, reply);
    if (!tenant) {
      return;
    }

    const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
    if (!source) {
      return reply.status(404).send({ error: 'source not found' });
    }

    const definition = hydrateSourceDefinition({
      id: source.id,
      name: source.name,
      adapterType: source.adapter_type,
      configJson: source.config_json
    });

    const adapter =
      definition.adapterType === 'js-listing-detail'
        ? new JsListingDetailAdapter()
        : definition.adapterType === 'auth-dashboard'
          ? new AuthDashboardAdapter()
          : new StaticCatalogAdapter();

    const html = request.query.html ?? '<html><body></body></html>';
    const url = request.query.url ?? definition.crawlEntrypoints[0] ?? definition.baseUrl;
    const pageType = adapter.classifyPage({ source: definition, html, depth: 0, url });

    if (pageType === 'unknown') {
      return { pageType, entities: [] };
    }

    const entities = adapter.extract({ source: definition, html, depth: 0, url }, pageType);
    return { pageType, entities };
  }
);

app.post<{ Body: { actorId?: string } }>('/admin/api/emergency/tenant/pause-all', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  await db.query(
    `UPDATE sources
     SET active = FALSE,
         governance_status = 'paused',
         updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenant.tenantId]
  );

  await db.insertAuditLog({
    tenantId: tenant.tenantId,
    actorType: 'operator',
    actorId: request.body.actorId ?? 'operator:manual',
    action: 'tenant.pause_all',
    targetType: 'tenant',
    targetId: tenant.tenantId,
    details: {}
  });

  return { ok: true };
});

app.post<{ Params: { sourceId: string }; Body: { actorId?: string } }>(
  '/admin/api/sources/:sourceId/manual-crawl',
  async (request, reply) => {
    const tenant = requireTenant(request, reply);
    if (!tenant) {
      return;
    }

    const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
    if (!source) {
      return reply.status(404).send({ error: 'source not found' });
    }

    const definition = hydrateSourceDefinition({
      id: source.id,
      name: source.name,
      adapterType: source.adapter_type,
      configJson: source.config_json
    });

    const started = await triggerManualRun(definition);
    await db.insertAuditLog({
      tenantId: tenant.tenantId,
      actorType: 'operator',
      actorId: request.body?.actorId ?? 'operator:manual',
      action: 'source.manual_crawl.triggered',
      targetType: 'source',
      targetId: source.id,
      details: {
        workflowId: started.workflowId
      }
    });

    return { ok: true, workflowId: started.workflowId };
  }
);

app.post<{ Params: { sourceId: string }; Body: { actorId?: string } }>(
  '/admin/api/sources/:sourceId/rotate-session',
  async (request, reply) => {
    const tenant = requireTenant(request, reply);
    if (!tenant) {
      return;
    }

    const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
    if (!source) {
      return reply.status(404).send({ error: 'source not found' });
    }

    const definition = hydrateSourceDefinition({
      id: source.id,
      name: source.name,
      adapterType: source.adapter_type,
      configJson: source.config_json
    });

    try {
      await sessionManager.forceReauth(definition, request.body?.actorId ?? 'operator:manual');
      await db.insertSessionRenewalHistory({
        tenantId: tenant.tenantId,
        sourceId: source.id,
        action: 'session.force_reauth',
        status: 'success',
        actorId: getActorId(request.body?.actorId)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'manual re-auth failed';
      await db.insertSessionRenewalHistory({
        tenantId: tenant.tenantId,
        sourceId: source.id,
        action: 'session.force_reauth',
        status: 'failed',
        failureReason: message,
        actorId: getActorId(request.body?.actorId)
      });
      return reply.status(400).send({ error: message });
    }

    await db.insertAuditLog({
      tenantId: tenant.tenantId,
      actorType: 'operator',
      actorId: request.body?.actorId ?? 'operator:manual',
      action: 'session.rotated',
      targetType: 'source',
      targetId: source.id,
      details: {
        sourceId: source.id
      }
    });

    return { ok: true, sourceId: source.id };
  }
);

app.get('/admin/api/sessions/health', async (request) => {
  const tenantId = (request as TenantRequest).tenantContext?.tenantId;
  const sessions = tenantId ? await db.listSessionHealth(tenantId) : await sessionManager.getSessionHealth();
  return {
    service: 'admin',
    count: sessions.length,
    sessions
  };
});

app.post<{
  Params: { sourceId: string };
  Body: { actorId?: string };
}>('/admin/api/sessions/:sourceId/reauth', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return reply.status(404).send({ error: 'source not found' });
  }

  const definition = hydrateSourceDefinition({
    id: source.id,
    name: source.name,
    adapterType: source.adapter_type,
    configJson: source.config_json
  });

  try {
    await sessionManager.forceReauth(definition, request.body?.actorId ?? 'operator:manual');
    await db.insertSessionRenewalHistory({
      tenantId: tenant.tenantId,
      sourceId: source.id,
      action: 'session.reauth',
      status: 'success',
      actorId: getActorId(request.body?.actorId)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'manual re-auth failed';
    await db.insertSessionRenewalHistory({
      tenantId: tenant.tenantId,
      sourceId: source.id,
      action: 'session.reauth',
      status: 'failed',
      failureReason: message,
      actorId: getActorId(request.body?.actorId)
    });
    return reply.status(400).send({ error: message });
  }

  await db.insertAuditLog({
    tenantId: tenant.tenantId,
    actorType: 'operator',
    actorId: request.body?.actorId ?? 'operator:manual',
    action: 'session.reauth',
    targetType: 'source',
    targetId: source.id,
    details: {
      sourceId: source.id
    }
  });

  return { ok: true, sourceId: source.id };
});

app.post<{
  Params: { sourceId: string };
  Body: { actorId?: string; expiresAt?: string | null; cookies: SessionCookie[] };
}>('/admin/api/sessions/:sourceId/manual-cookie', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return reply.status(404).send({ error: 'source not found' });
  }

  const definition = hydrateSourceDefinition({
    id: source.id,
    name: source.name,
    adapterType: source.adapter_type,
    configJson: source.config_json
  });

  if (!request.body?.cookies || request.body.cookies.length === 0) {
    return reply.status(400).send({ error: 'at least one cookie is required for manual import' });
  }

  await sessionManager.manualCookieImport({
    source: definition,
    actorId: request.body?.actorId ?? 'operator:manual',
    cookies: request.body?.cookies ?? [],
    expiresAt: request.body?.expiresAt ?? null
  });

  await db.insertSessionRenewalHistory({
    tenantId: tenant.tenantId,
    sourceId: source.id,
    action: 'session.manual_cookie_import',
    status: 'success',
    expiresAt: request.body?.expiresAt ?? null,
    actorId: getActorId(request.body?.actorId)
  });

  await db.insertAuditLog({
    tenantId: tenant.tenantId,
    actorType: 'operator',
    actorId: request.body?.actorId ?? 'operator:manual',
    action: 'session.manual_cookie_import',
    targetType: 'source',
    targetId: source.id,
    details: {
      sourceId: source.id,
      cookies: request.body.cookies.map((cookie) => ({
        name: cookie.name,
        domain: cookie.domain
      }))
    }
  });

  return { ok: true, sourceId: source.id };
});

app.post<{
  Params: { sourceId: string };
  Body: { actorId?: string; headerName: string; tokenSecretRef: string; prefix?: string; renewalSeconds?: number };
}>('/admin/api/sessions/:sourceId/header-token', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return reply.status(404).send({ error: 'source not found' });
  }

  const nextConfig = {
    ...source.config_json,
    authentication: {
      type: 'header-token-injection',
      headerName: request.body.headerName,
      tokenSecretRef: request.body.tokenSecretRef,
      ...(request.body.prefix ? { prefix: request.body.prefix } : {}),
      renewalSeconds: Number(request.body.renewalSeconds ?? 3600)
    }
  };

  await db.updateSourceConfigForTenant({
    tenantId: tenant.tenantId,
    sourceId: source.id,
    configJson: nextConfig
  });

  await db.insertSessionRenewalHistory({
    tenantId: tenant.tenantId,
    sourceId: source.id,
    action: 'session.header_token_updated',
    status: 'success',
    actorId: getActorId(request.body.actorId)
  });

  await db.insertAuditLog({
    tenantId: tenant.tenantId,
    actorType: 'operator',
    actorId: getActorId(request.body.actorId),
    action: 'session.header_token.updated',
    targetType: 'source',
    targetId: source.id,
    details: {
      headerName: request.body.headerName,
      tokenSecretRef: request.body.tokenSecretRef
    }
  });

  return { ok: true, sourceId: source.id };
});

app.get('/admin/api/bootstrap', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const [tenantRow, sources] = await Promise.all([
    db.getTenantOverview(tenant.tenantId),
    db.listSourcesByTenant(tenant.tenantId)
  ]);

  return {
    tenant: tenantRow,
    role: tenant.role,
    permissions: {
      platformAdmin: isPlatformAdmin(tenant.role),
      canManageSources: true,
      canManageSessions: true,
      canManageReplay: true
    },
    sourceCount: sources.length
  };
});

app.get('/admin/api/dashboard', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const [overview, diagnostics, runs, changes, replayJobs, sessions] = await Promise.all([
    db.getTenantOverview(tenant.tenantId),
    db.getTenantDiagnostics(tenant.tenantId),
    db.listTenantRuns({ tenantId: tenant.tenantId, limit: 12 }),
    db.listTenantChanges({ tenantId: tenant.tenantId, limit: 12 }),
    db.listReplayJobs(tenant.tenantId, 12),
    db.listSessionHealth(tenant.tenantId)
  ]);

  return {
    overview,
    diagnostics,
    runs,
    changes,
    replayJobs,
    sessions
  };
});

app.get('/admin/api/tenants', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  if (isPlatformAdmin(tenant.role)) {
    const tenants = await db.listTenants();
    return { tenants };
  }

  const currentTenant = await db.getTenantOverview(tenant.tenantId);
  return {
    tenants: currentTenant
      ? [
          {
            id: currentTenant.tenantId,
            slug: currentTenant.slug,
            name: currentTenant.name,
            status: currentTenant.status
          }
        ]
      : []
  };
});

app.get<{ Params: { tenantId: string } }>('/admin/api/tenants/:tenantId/overview', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  if (request.params.tenantId !== tenant.tenantId && !isPlatformAdmin(tenant.role)) {
    return reply.status(403).send({ error: 'insufficient role for cross-tenant overview' });
  }

  const [overview, diagnostics, sources] = await Promise.all([
    db.getTenantOverview(request.params.tenantId),
    db.getTenantDiagnostics(request.params.tenantId),
    db.listSourcesByTenant(request.params.tenantId)
  ]);

  if (!overview) {
    return reply.status(404).send({ error: 'tenant not found' });
  }

  return { overview, diagnostics, sources };
});

app.get<{ Querystring: { sourceId?: string; classification?: string; status?: string; limit?: string } }>(
  '/admin/api/runs',
  async (request, reply) => {
    const tenant = requireTenant(request, reply);
    if (!tenant) {
      return;
    }

    const runs = await db.listTenantRuns({
      tenantId: tenant.tenantId,
      ...(request.query.sourceId ? { sourceId: request.query.sourceId } : {}),
      ...(request.query.classification ? { classification: request.query.classification } : {}),
      ...(request.query.status ? { status: request.query.status } : {}),
      limit: request.query.limit ? Number(request.query.limit) : 100
    });

    return { runs };
  }
);

app.get<{ Querystring: { sourceId?: string; limit?: string } }>('/admin/api/changes', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const changes = await db.listTenantChanges({
    tenantId: tenant.tenantId,
    ...(request.query.sourceId ? { sourceId: request.query.sourceId } : {}),
    limit: request.query.limit ? Number(request.query.limit) : 100
  });

  return { changes };
});

app.get('/admin/api/diagnostics', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const [diagnostics, degradedSources, failedRuns, policyBlocked] = await Promise.all([
    db.getTenantDiagnostics(tenant.tenantId),
    db.query(
      `SELECT id, name, health_status as "healthStatus", degraded_reason as "degradedReason", failure_streak as "failureStreak"
       FROM sources
       WHERE tenant_id = $1 AND health_status = 'degraded'
       ORDER BY updated_at DESC
       LIMIT 50`,
      [tenant.tenantId]
    ),
    db.query(
      `SELECT
         sr.id,
         sr.source_id as "sourceId",
         s.name as "sourceName",
         sr.status,
         sr.run_classification as "runClassification",
         sr.started_at::text as "startedAt",
         sr.ended_at::text as "endedAt",
         sr.summary_json as "summary"
       FROM source_runs sr
       JOIN sources s ON s.id = sr.source_id
       WHERE sr.tenant_id = $1 AND sr.status = 'failed'
       ORDER BY sr.started_at DESC
       LIMIT 50`,
      [tenant.tenantId]
    ),
    db.query(
      `SELECT id, name, operator_state as "operatorState", governance_status as "governanceStatus"
       FROM sources
       WHERE tenant_id = $1 AND (operator_state = 'blocked' OR governance_status IN ('blocked', 'review_required', 'paused'))
       ORDER BY updated_at DESC`,
      [tenant.tenantId]
    )
  ]);

  return {
    summary: diagnostics,
    degradedSources: degradedSources.rows,
    failedRuns: failedRuns.rows,
    policyBlocked: policyBlocked.rows
  };
});

app.get<{ Querystring: { sourceId?: string } }>('/admin/api/sessions', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const sessions = await db.listSessionHealth(tenant.tenantId);
  const filtered = request.query.sourceId ? sessions.filter((item) => item.sourceId === request.query.sourceId) : sessions;
  return { sessions: filtered };
});

app.get<{ Params: { sourceId: string } }>('/admin/api/sessions/:sourceId', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return reply.status(404).send({ error: 'source not found' });
  }

  const [session, history] = await Promise.all([
    db.getSessionBySource(source.id),
    db.getSessionRenewalHistory(source.id, tenant.tenantId, 50)
  ]);

  return {
    source: {
      id: source.id,
      name: source.name
    },
    session,
    history
  };
});

app.get<{ Params: { sourceId: string } }>('/admin/api/sources/:sourceId/jobs', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return reply.status(404).send({ error: 'source not found' });
  }

  const jobs = await db.listReplayJobs(tenant.tenantId, 200);
  return { jobs: jobs.filter((job) => job.sourceId === source.id) };
});

app.post<{ Params: { sourceId: string }; Body: { actorId?: string } }>('/admin/api/sources/:sourceId/clone', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const clonedSourceId = await db.cloneSource({ tenantId: tenant.tenantId, sourceId: request.params.sourceId });

  await db.insertAuditLog({
    tenantId: tenant.tenantId,
    actorType: 'operator',
    actorId: getActorId(request.body.actorId),
    action: 'source.cloned',
    targetType: 'source',
    targetId: request.params.sourceId,
    details: {
      clonedSourceId
    }
  });

  return { ok: true, clonedSourceId };
});

app.patch<{
  Params: { sourceId: string };
  Body: {
    actorId?: string;
    name?: string;
    adapterType?: string;
    active?: boolean;
    configJson: Record<string, unknown>;
  };
}>('/admin/api/sources/:sourceId/config', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return reply.status(404).send({ error: 'source not found' });
  }

  await db.updateSourceConfigForTenant({
    tenantId: tenant.tenantId,
    sourceId: source.id,
    configJson: request.body.configJson,
    ...(request.body.name !== undefined ? { name: request.body.name } : {}),
    ...(request.body.adapterType !== undefined ? { adapterType: request.body.adapterType } : {}),
    ...(request.body.active !== undefined ? { active: request.body.active } : {})
  });

  await db.insertAuditLog({
    tenantId: tenant.tenantId,
    actorType: 'operator',
    actorId: getActorId(request.body.actorId),
    action: 'source.config.updated',
    targetType: 'source',
    targetId: source.id,
    details: {
      configKeys: Object.keys(request.body.configJson ?? {})
    }
  });

  return { ok: true };
});

app.get<{ Querystring: { limit?: string } }>('/admin/api/onboarding/drafts', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const drafts = await db.listOnboardingDrafts(tenant.tenantId, request.query.limit ? Number(request.query.limit) : 50);
  return { drafts };
});

app.post<{ Body: { name: string; sourceId?: string | null; draft?: OnboardingDraftJson; actorId?: string } }>(
  '/admin/api/onboarding/drafts',
  async (request, reply) => {
    const tenant = requireTenant(request, reply);
    if (!tenant) {
      return;
    }

    const draftId = await db.createOnboardingDraft({
      tenantId: tenant.tenantId,
      name: request.body.name,
      sourceId: request.body.sourceId ?? null,
      draftJson: (request.body.draft ?? {}) as Record<string, unknown>,
      createdBy: getActorId(request.body.actorId)
    });

    await db.insertAuditLog({
      tenantId: tenant.tenantId,
      actorType: 'operator',
      actorId: getActorId(request.body.actorId),
      action: 'onboarding.draft.created',
      targetType: 'onboarding_draft',
      targetId: draftId,
      details: {
        name: request.body.name,
        sourceId: request.body.sourceId ?? null
      }
    });

    return reply.status(201).send({ draftId });
  }
);

app.get<{ Params: { draftId: string } }>('/admin/api/onboarding/drafts/:draftId', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const draft = await db.getOnboardingDraft(request.params.draftId, tenant.tenantId);
  if (!draft) {
    return reply.status(404).send({ error: 'draft not found' });
  }

  return { draft };
});

app.patch<{
  Params: { draftId: string };
  Body: {
    actorId?: string;
    name?: string;
    stepIndex?: number;
    status?: string;
    draft?: OnboardingDraftJson;
  };
}>('/admin/api/onboarding/drafts/:draftId', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const existing = await db.getOnboardingDraft(request.params.draftId, tenant.tenantId);
  if (!existing) {
    return reply.status(404).send({ error: 'draft not found' });
  }

  await db.updateOnboardingDraft({
    draftId: existing.id,
    tenantId: tenant.tenantId,
    ...(request.body.name !== undefined ? { name: request.body.name } : {}),
    ...(request.body.stepIndex !== undefined ? { stepIndex: request.body.stepIndex } : {}),
    ...(request.body.status !== undefined ? { status: request.body.status } : {}),
    draftJson: (request.body.draft ?? existing.draftJson) as Record<string, unknown>,
    updatedBy: getActorId(request.body.actorId)
  });

  return { ok: true };
});

app.post<{
  Params: { draftId: string };
  Body: { actorId?: string; stepIndex?: number; draft?: OnboardingDraftJson };
}>('/admin/api/onboarding/drafts/:draftId/validate', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const existing = await db.getOnboardingDraft(request.params.draftId, tenant.tenantId);
  if (!existing) {
    return reply.status(404).send({ error: 'draft not found' });
  }

  const effectiveDraft = (request.body.draft ?? existing.draftJson) as OnboardingDraftJson;
  const validation = validateOnboardingDraft(effectiveDraft, request.body.stepIndex);

  const policyResult = evaluateSourcePolicy({
    source: {
      active: true,
      governance_status: validation.valid ? 'allowed' : 'review_required',
      policy_auth_required: false,
      policy_max_pages_per_run: Number(effectiveDraft.crawl?.maxPagesPerRun ?? 0) || null,
      policy_crawl_depth_limit: Number(effectiveDraft.crawl?.maxDepth ?? 0) || null,
      policy_allowed_domains: effectiveDraft.basic?.allowedDomains ?? []
    },
    ...(effectiveDraft.basic?.baseUrl ? { candidateUrl: effectiveDraft.basic.baseUrl } : {}),
    depth: Number(effectiveDraft.crawl?.maxDepth ?? 1),
    fetchedPagesInRun: Number(effectiveDraft.crawl?.maxPagesPerRun ?? 1),
    hasValidSession: effectiveDraft.authentication?.type === 'none'
  });

  const lastValidation = {
    checkedAt: new Date().toISOString(),
    stepIndex: request.body.stepIndex ?? existing.stepIndex,
    validation,
    policyResult
  };

  await db.updateOnboardingDraft({
    draftId: existing.id,
    tenantId: tenant.tenantId,
    stepIndex: request.body.stepIndex ?? existing.stepIndex,
    draftJson: effectiveDraft as Record<string, unknown>,
    lastValidation: lastValidation as Record<string, unknown>,
    updatedBy: getActorId(request.body.actorId)
  });

  return {
    validation,
    policyResult
  };
});

app.post<{ Params: { draftId: string }; Body: { actorId?: string } }>(
  '/admin/api/onboarding/drafts/:draftId/create-source',
  async (request, reply) => {
    const tenant = requireTenant(request, reply);
    if (!tenant) {
      return;
    }

    const existing = await db.getOnboardingDraft(request.params.draftId, tenant.tenantId);
    if (!existing) {
      return reply.status(404).send({ error: 'draft not found' });
    }

    const draftJson = existing.draftJson as OnboardingDraftJson;
    const validation = validateOnboardingDraft(draftJson);
    if (!validation.valid) {
      return reply.status(400).send({ error: 'draft validation failed', validation });
    }

    const policyResult = evaluateSourcePolicy({
      source: {
        active: true,
        governance_status: 'allowed',
        policy_auth_required: false,
        policy_max_pages_per_run: Number(draftJson.crawl?.maxPagesPerRun ?? 0) || null,
        policy_crawl_depth_limit: Number(draftJson.crawl?.maxDepth ?? 0) || null,
        policy_allowed_domains: draftJson.basic?.allowedDomains ?? []
      },
      ...(draftJson.basic?.baseUrl ? { candidateUrl: draftJson.basic.baseUrl } : {}),
      depth: 1,
      fetchedPagesInRun: 1,
      hasValidSession: true
    });

    if (!policyResult.allowed) {
      return reply.status(422).send({ error: 'policy requirements failed', policyResult });
    }

    const provisionalSourceId = existing.sourceId ?? randomUUID();
    const sourceDefinition = buildSourceDefinitionConfig(draftJson, provisionalSourceId);
    const sourceId = existing.sourceId
      ? existing.sourceId
      : await db.createSource({
          tenantId: tenant.tenantId,
          name: sourceDefinition.name,
          adapterType: sourceDefinition.adapterType,
          configJson: sourceDefinition as unknown as Record<string, unknown>
        });

    if (existing.sourceId) {
      await db.updateSourceConfigForTenant({
        tenantId: tenant.tenantId,
        sourceId,
        configJson: sourceDefinition as unknown as Record<string, unknown>,
        name: sourceDefinition.name,
        adapterType: sourceDefinition.adapterType,
        active: true
      });
    }

    await db.query(
      `UPDATE sources
       SET
         policy_allowed_domains = $2,
         policy_crawl_depth_limit = $3,
         policy_max_pages_per_run = $4,
         policy_auth_required = $5,
         policy_export_restrictions = $6,
         policy_retention_days = $7,
         governance_status = 'allowed',
         updated_at = NOW()
       WHERE id = $1 AND tenant_id = $8`,
      [
        sourceId,
        sourceDefinition.allowedDomains,
        sourceDefinition.maxDepth,
        Number(draftJson.crawl?.maxPagesPerRun ?? 50),
        sourceDefinition.authentication.type !== 'none',
        draftJson.output?.exportRestrictions ?? {},
        Number(draftJson.output?.retentionDays ?? 30),
        tenant.tenantId
      ]
    );

    await db.updateOnboardingDraft({
      draftId: existing.id,
      tenantId: tenant.tenantId,
      sourceId,
      status: 'created',
      stepIndex: 7,
      lastValidation: {
        checkedAt: new Date().toISOString(),
        validation,
        policyResult
      },
      updatedBy: getActorId(request.body.actorId)
    });

    await db.insertAuditLog({
      tenantId: tenant.tenantId,
      actorType: 'operator',
      actorId: getActorId(request.body.actorId),
      action: 'source.created.from_draft',
      targetType: 'source',
      targetId: sourceId,
      details: {
        draftId: existing.id
      }
    });

    return { ok: true, sourceId };
  }
);

app.post<{
  Params: { sourceId: string };
  Body: {
    url?: string;
    html?: string;
    useLatestSnapshot?: boolean;
    pageType?: 'listing' | 'detail' | 'unknown';
    selectors?: Record<'listing' | 'detail', Array<{ key: string; selector: string; attribute?: string; required: boolean; multiple?: boolean }>>;
    requiredFields?: string[];
    compareWithCurrent?: boolean;
  };
}>('/admin/api/sources/:sourceId/selector-sandbox/test', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return reply.status(404).send({ error: 'source not found' });
  }

  const definition = hydrateSourceDefinition({
    id: source.id,
    name: source.name,
    adapterType: source.adapter_type,
    configJson: source.config_json
  });

  const snapshot = request.body.useLatestSnapshot || !request.body.html
    ? await db.getLatestSourceSnapshot(source.id, tenant.tenantId, request.body.url)
    : null;

  const html = request.body.html ?? snapshot?.rawHtml;
  if (!html) {
    return reply.status(400).send({ error: 'no html provided and no stored snapshot found' });
  }

  const targetUrl = request.body.url ?? snapshot?.canonicalUrl ?? definition.crawlEntrypoints[0] ?? definition.baseUrl;
  const adapter =
    definition.adapterType === 'js-listing-detail'
      ? new JsListingDetailAdapter()
      : definition.adapterType === 'auth-dashboard'
        ? new AuthDashboardAdapter()
        : new StaticCatalogAdapter();

  const candidateDefinition = {
    ...definition,
    extractionSelectors: request.body.selectors
      ? {
          listing: request.body.selectors.listing ?? definition.extractionSelectors.listing,
          detail: request.body.selectors.detail ?? definition.extractionSelectors.detail
        }
      : definition.extractionSelectors
  };

  const pageType = request.body.pageType && request.body.pageType !== 'unknown'
    ? request.body.pageType
    : adapter.classifyPage({ source: candidateDefinition, html, depth: 0, url: targetUrl });

  if (pageType === 'unknown') {
    return {
      pageType,
      preview: [],
      missingRequiredFields: [],
      normalizedPreview: [],
      baselinePreview: []
    };
  }

  const preview = adapter.extract({ source: candidateDefinition, html, depth: 0, url: targetUrl }, pageType);
  const normalizedPreview = preview.map((entity) => normalizeEntity(entity, candidateDefinition));
  const requiredFields = new Set(request.body.requiredFields ?? []);

  const missingRequiredFields = Array.from(requiredFields).filter((field) => {
    const value = normalizedPreview[0]?.canonicalData?.[field];
    return value === null || value === undefined || value === '';
  });

  const baselinePreview = request.body.compareWithCurrent
    ? adapter
        .extract({ source: definition, html, depth: 0, url: targetUrl }, pageType)
        .map((entity) => normalizeEntity(entity, definition))
    : [];

  return {
    pageType,
    htmlFragment: html.slice(0, 4000),
    targetUrl,
    preview,
    normalizedPreview,
    missingRequiredFields,
    baselinePreview,
    canonicalUrlPreview: normalizedPreview[0]?.pageUrl ?? targetUrl,
    entityKeyPreview: normalizedPreview[0]?.recordKey ?? null,
    fieldConfidence: normalizedPreview[0]
      ? Object.fromEntries(
          Object.entries(normalizedPreview[0].canonicalData).map(([key, value]) => [key, value ? 1 : 0])
        )
      : {}
  };
});

app.post<{ Params: { sourceId: string }; Body: { actorId?: string } }>('/admin/api/sources/:sourceId/dry-run', async (request, reply) => {
  const tenant = requireTenant(request, reply);
  if (!tenant) {
    return;
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenant.tenantId);
  if (!source) {
    return reply.status(404).send({ error: 'source not found' });
  }

  const replayJobId = await db.insertReplayJob({
    tenantId: tenant.tenantId,
    sourceId: source.id,
    jobType: 'reprocess',
    dryRun: true,
    idempotencyKey: `${tenant.tenantId}:dry-run:${source.id}:${Date.now()}`,
    params: { trigger: 'source-dry-run' }
  });

  await db.insertAuditLog({
    tenantId: tenant.tenantId,
    actorType: 'operator',
    actorId: getActorId(request.body.actorId),
    action: 'source.dry_run.started',
    targetType: 'source',
    targetId: source.id,
    details: { replayJobId }
  });

  return { ok: true, replayJobId };
});

process.on('SIGINT', () => {
  void db.close();
});

process.on('SIGTERM', () => {
  void db.close();
});

await app.listen({ host: '0.0.0.0', port: config.ADMIN_PORT });
