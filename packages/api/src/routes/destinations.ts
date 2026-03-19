import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { KoviDatabase } from '@kovi/db';
import { DestinationRegistry } from '@kovi/events';

export interface DestinationRoutesDeps {
  db: KoviDatabase;
  destinationRegistry: DestinationRegistry;
  secretProvider: { getSecret(ref: string): Promise<string> };
}

export const registerDestinationRoutes = (
  app: FastifyInstance,
  deps: DestinationRoutesDeps
): void => {
  app.get<{ Params: { tenantId: string } }>(
    '/tenants/:tenantId/destinations',
    async (request: FastifyRequest<{ Params: { tenantId: string } }>, reply: FastifyReply) => {
      const { tenantId } = request.params;
      const destinations = await deps.db.listDestinations(tenantId, true);
      return destinations.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.destinationType,
        status: d.status,
        eventTypes: d.eventTypes,
        sourceIds: d.sourceIds,
        entityTypes: d.entityTypes,
        contractVersions: d.contractVersions,
        maxRetries: d.maxRetries,
        lastHealthStatus: d.lastHealthStatus,
        lastHealthCheckedAt: d.lastHealthCheckedAt,
        lastHealthError: d.lastHealthError,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }));
    }
  );

  app.get<{ Params: { tenantId: string; destinationId: string } }>(
    '/tenants/:tenantId/destinations/:destinationId',
    async (request: FastifyRequest<{ Params: { tenantId: string; destinationId: string } }>, reply: FastifyReply) => {
      const { tenantId, destinationId } = request.params;
      const destinations = await deps.db.listDestinations(tenantId, true);
      const destination = destinations.find((d) => d.id === destinationId);
      if (!destination) {
        return reply.status(404).send({ error: 'Destination not found' });
      }
      return destination;
    }
  );

  app.post<{ Params: { tenantId: string }; Body: CreateDestinationBody }>(
    '/tenants/:tenantId/destinations',
    async (request: FastifyRequest<{ Params: { tenantId: string }; Body: CreateDestinationBody }>, reply: FastifyReply) => {
      const { tenantId } = request.params;
      const { name, type, config, eventTypes, sourceIds, entityTypes, contractVersions, maxRetries } = request.body;

      const plugin = deps.destinationRegistry.get(type);
      plugin.validateConfig(config);

      const destinationId = await deps.db.createDestination({
        tenantId,
        name,
        destinationType: type,
        configJson: config,
        eventTypes: eventTypes ?? [],
        sourceIds: sourceIds ?? [],
        entityTypes: entityTypes ?? [],
        contractVersions: contractVersions ?? ['1.0'],
        maxRetries: maxRetries ?? 3
      });

      return reply.status(201).send({ id: destinationId });
    }
  );

  app.patch<{ Params: { tenantId: string; destinationId: string }; Body: UpdateDestinationBody }>(
    '/tenants/:tenantId/destinations/:destinationId',
    async (request: FastifyRequest<{ Params: { tenantId: string; destinationId: string }; Body: UpdateDestinationBody }>, reply: FastifyReply) => {
      const { tenantId, destinationId } = request.params;
      const { name, status, config, eventTypes, sourceIds, entityTypes, contractVersions, maxRetries } = request.body;

      if (config) {
        const destinations = await deps.db.listDestinations(tenantId, true);
        const current = destinations.find((d) => d.id === destinationId);
        if (current) {
          const plugin = deps.destinationRegistry.get(current.destinationType);
          plugin.validateConfig(config);
        }
      }

      await deps.db.updateDestination({
        destinationId,
        tenantId,
        name,
        status,
        configJson: config,
        eventTypes,
        sourceIds,
        entityTypes,
        contractVersions,
        maxRetries
      });

      return { success: true };
    }
  );

  app.delete<{ Params: { tenantId: string; destinationId: string } }>(
    '/tenants/:tenantId/destinations/:destinationId',
    async (request: FastifyRequest<{ Params: { tenantId: string; destinationId: string } }>, reply: FastifyReply) => {
      const { tenantId, destinationId } = request.params;
      await deps.db.updateDestination({
        destinationId,
        tenantId,
        status: 'deleted'
      });
      return { success: true };
    }
  );

  app.post<{ Params: { tenantId: string; destinationId: string } }>(
    '/tenants/:tenantId/destinations/:destinationId/test',
    async (request: FastifyRequest<{ Params: { tenantId: string; destinationId: string } }>, reply: FastifyReply) => {
      const { tenantId, destinationId } = request.params;
      const destinations = await deps.db.listDestinations(tenantId, true);
      const destination = destinations.find((d) => d.id === destinationId);
      if (!destination) {
        return reply.status(404).send({ error: 'Destination not found' });
      }

      const plugin = deps.destinationRegistry.get(destination.destinationType);
      const health = await plugin.checkHealth({
        config: destination.configJson,
        secretProvider: deps.secretProvider
      });

      return { ok: health.ok, message: health.message };
    }
  );

  app.post<{ Params: { tenantId: string; destinationId: string } }>(
    '/tenants/:tenantId/destinations/:destinationId/pause',
    async (request: FastifyRequest<{ Params: { tenantId: string; destinationId: string } }>, reply: FastifyReply) => {
      const { tenantId, destinationId } = request.params;
      await deps.db.updateDestination({
        destinationId,
        tenantId,
        status: 'paused'
      });
      return { success: true };
    }
  );

  app.post<{ Params: { tenantId: string; destinationId: string } }>(
    '/tenants/:tenantId/destinations/:destinationId/resume',
    async (request: FastifyRequest<{ Params: { tenantId: string; destinationId: string } }>, reply: FastifyReply) => {
      const { tenantId, destinationId } = request.params;
      await deps.db.updateDestination({
        destinationId,
        tenantId,
        status: 'active'
      });
      return { success: true };
    }
  );
};

interface CreateDestinationBody {
  name: string;
  type: string;
  config: Record<string, unknown>;
  eventTypes?: string[];
  sourceIds?: string[];
  entityTypes?: string[];
  contractVersions?: string[];
  maxRetries?: number;
}

interface UpdateDestinationBody {
  name?: string;
  status?: string;
  config?: Record<string, unknown>;
  eventTypes?: string[];
  sourceIds?: string[];
  entityTypes?: string[];
  contractVersions?: string[];
  maxRetries?: number;
}