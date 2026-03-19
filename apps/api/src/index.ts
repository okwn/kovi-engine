import { createHash } from 'node:crypto';
import Fastify, { type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { loadApiConfig } from '@kovi/config';
import { KoviDatabase } from '@kovi/db';
import { negotiateContractVersion } from '@kovi/events';
import { bootstrapOtel, shutdownOtel } from '@kovi/observability';
import { createLogger } from '@kovi/shared';
import type { HealthResponse } from '@kovi/shared';

const config = loadApiConfig();

type TenantRequest = FastifyRequest & {
  tenantContext?: {
    tenantId: string;
    role: string;
  };
};

const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex');

await bootstrapOtel({
  serviceName: 'api',
  serviceVersion: config.OTEL_SERVICE_VERSION,
  endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  enabled: config.OTEL_ENABLED
});

const logger = createLogger({ service: 'api', env: config.NODE_ENV, version: config.OTEL_SERVICE_VERSION });
const db = new KoviDatabase(config.DATABASE_URL);

const app = Fastify({
  loggerInstance: logger
});

await app.register(rateLimit, {
  max: config.API_RATE_LIMIT_MAX,
  timeWindow: config.API_RATE_LIMIT_WINDOW,
  allowList: ['127.0.0.1', '::1']
});

app.addHook('preHandler', async (request, reply) => {
  if (!request.url.startsWith('/v1/')) {
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

app.get('/health', async (): Promise<HealthResponse> => ({
  status: 'ok',
  service: 'api',
  timestamp: new Date().toISOString()
}));

app.get('/ready', async (): Promise<HealthResponse> => {
  const dbHealthy = await db.healthcheck();
  return {
    status: dbHealthy ? 'ok' : 'degraded',
    service: 'api',
    timestamp: new Date().toISOString()
  };
});

app.get('/v1/sources', async (request) => {
  const tenantId = (request as TenantRequest).tenantContext?.tenantId;
  if (!tenantId) {
    return { sources: [] };
  }

  const sources = await db.listSourcesByTenant(tenantId);
  return { sources };
});

app.get<{ Params: { sourceId: string } }>('/v1/sources/:sourceId/status', async (request, reply) => {
  const tenantId = (request as TenantRequest).tenantContext?.tenantId;
  if (!tenantId) {
    return reply.status(403).send({ error: 'missing tenant context' });
  }

  const source = await db.getSourceByIdForTenant(request.params.sourceId, tenantId);
  if (!source) {
    return reply.status(404).send({ error: 'source not found' });
  }

  const status = await db.getSourceStatus(source.id);
  if (!status) {
    return reply.status(404).send({ error: 'source not found' });
  }
  return status;
});

app.get<{ Params: { sourceId: string }; Querystring: { limit?: string } }>(
  '/v1/sources/:sourceId/entities/latest',
  async (request, reply) => {
    const tenantId = (request as TenantRequest).tenantContext?.tenantId;
    if (!tenantId) {
      return reply.status(403).send({ error: 'missing tenant context' });
    }

    const source = await db.getSourceByIdForTenant(request.params.sourceId, tenantId);
    if (!source) {
      return reply.status(404).send({ error: 'source not found' });
    }

    const limit = request.query.limit ? Number(request.query.limit) : 100;
    const entities = await db.getLatestEntities(source.id, limit);
    return { entities };
  }
);

app.get<{ Params: { entityId: string }; Querystring: { limit?: string } }>('/v1/entities/:entityId/history', async (request, reply) => {
  const tenantId = (request as TenantRequest).tenantContext?.tenantId;
  if (!tenantId) {
    return reply.status(403).send({ error: 'missing tenant context' });
  }

  const limit = request.query.limit ? Number(request.query.limit) : 100;
  const result = await db.query(
    `SELECT
       ev.id as "versionId",
       ev.entity_id as "entityId",
       ev.version_number as "versionNumber",
       ev.content_hash as "contentHash",
       ev.data_json as "dataJson",
       ev.created_at::text as "createdAt"
     FROM entity_versions ev
     JOIN entities e ON e.id = ev.entity_id
     WHERE ev.entity_id = $1
       AND e.tenant_id = $2
     ORDER BY ev.version_number DESC
     LIMIT $3`,
    [request.params.entityId, tenantId, limit]
  );

  return { history: result.rows };
});

app.get<{ Querystring: { limit?: string } }>('/v1/changes/recent', async (request, reply) => {
  const tenantId = (request as TenantRequest).tenantContext?.tenantId;
  if (!tenantId) {
    return reply.status(403).send({ error: 'missing tenant context' });
  }

  const requestedVersion = request.headers['x-kovi-contract-version'];
  negotiateContractVersion(typeof requestedVersion === 'string' ? requestedVersion : undefined);

  const limit = request.query.limit ? Number(request.query.limit) : 100;
  const result = await db.query(
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
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );

  return { changes: result.rows };
});

app.get<{ Querystring: { sourceId?: string } }>('/v1/webhooks', async (request, reply) => {
  const tenantId = (request as TenantRequest).tenantContext?.tenantId;
  if (!tenantId) {
    return reply.status(403).send({ error: 'missing tenant context' });
  }

  const result = request.query.sourceId
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
        [tenantId, request.query.sourceId]
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
        [tenantId]
      );

  return { webhooks: result.rows };
});

app.post<{ Body: { sourceId?: string | null; url: string; secretRef?: string | null; active?: boolean } }>(
  '/v1/webhooks',
  async (request, reply) => {
    const tenantId = (request as TenantRequest).tenantContext?.tenantId;
    if (!tenantId) {
      return reply.status(403).send({ error: 'missing tenant context' });
    }

    const createInput = {
      sourceId: request.body.sourceId ?? null,
      url: request.body.url,
      secretRef: request.body.secretRef ?? null,
      tenantId,
      ...(request.body.active !== undefined ? { active: request.body.active } : {})
    };

    const webhookId = await db.createWebhook({
      ...createInput
    });
    return reply.status(201).send({ webhookId });
  }
);

app.patch<{ Params: { webhookId: string }; Body: { url?: string; secretRef?: string | null; active?: boolean } }>(
  '/v1/webhooks/:webhookId',
  async (request, reply) => {
    const tenantId = (request as TenantRequest).tenantContext?.tenantId;
    if (!tenantId) {
      return reply.status(403).send({ error: 'missing tenant context' });
    }

    const match = await db.query('SELECT id FROM webhooks WHERE id = $1 AND tenant_id = $2 LIMIT 1', [
      request.params.webhookId,
      tenantId
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

    await db.updateWebhook({
      ...updateInput
    });
    return { ok: true };
  }
);

app.delete<{ Params: { webhookId: string } }>('/v1/webhooks/:webhookId', async (request, reply) => {
  const tenantId = (request as TenantRequest).tenantContext?.tenantId;
  if (!tenantId) {
    return reply.status(403).send({ error: 'missing tenant context' });
  }

  const result = await db.query('DELETE FROM webhooks WHERE id = $1 AND tenant_id = $2', [
    request.params.webhookId,
    tenantId
  ]);
  if ((result.rowCount ?? 0) === 0) {
    return reply.status(404).send({ error: 'webhook not found' });
  }
  return { ok: true };
});

const close = async (): Promise<void> => {
  await app.close();
  await db.close();
  await shutdownOtel();
};

process.on('SIGINT', () => {
  void close();
});

process.on('SIGTERM', () => {
  void close();
});

await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
logger.info({ port: config.API_PORT }, 'API service started');
