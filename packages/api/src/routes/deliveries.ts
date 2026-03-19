import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { KoviDatabase } from '@kovi/db';

export interface DeliveryRoutesDeps {
  db: KoviDatabase;
}

export const registerDeliveryRoutes = (
  app: FastifyInstance,
  deps: DeliveryRoutesDeps
): void => {
  app.get<{ Params: { tenantId: string }; Querystring: DeliveryQueryParams }>(
    '/tenants/:tenantId/deliveries',
    async (request: FastifyRequest<{ Params: { tenantId: string }; Querystring: DeliveryQueryParams }>) => {
      const { tenantId } = request.params;
      const { destinationId, sourceId, eventType, state, limit } = request.query;

      const deliveries = await deps.db.listDestinationDeliveries({
        tenantId,
        ...(destinationId ? { destinationId } : {}),
        ...(sourceId ? { sourceId } : {}),
        ...(eventType ? { eventType } : {}),
        ...(state ? { state } : {}),
        ...(limit ? { limit } : {})
      });

      return deliveries.map((d) => ({
        id: d.id,
        destinationId: d.destinationId,
        sourceId: d.sourceId,
        entityId: d.entityId,
        eventId: d.eventId,
        eventType: d.eventType,
        contractVersion: d.contractVersion,
        idempotencyKey: d.idempotencyKey,
        state: d.deliveryState,
        attempts: d.attempts,
        maxAttempts: d.maxAttempts,
        lastError: d.lastError,
        replayOfDeliveryId: d.replayOfDeliveryId,
        queuedAt: d.queuedAt,
        sentAt: d.sentAt,
        acknowledgedAt: d.acknowledgedAt,
        failedAt: d.failedAt,
        deadLetteredAt: d.deadLetteredAt,
        createdAt: d.createdAt
      }));
    }
  );

  app.get<{ Params: { tenantId: string; deliveryId: string } }>(
    '/tenants/:tenantId/deliveries/:deliveryId',
    async (request: FastifyRequest<{ Params: { tenantId: string; deliveryId: string } }>, reply: FastifyReply) => {
      const { tenantId, deliveryId } = request.params;
      const deliveries = await deps.db.listDestinationDeliveries({
        tenantId,
        limit: 1
      });
      const delivery = deliveries.find((d) => d.id === deliveryId);
      if (!delivery) {
        return reply.status(404).send({ error: 'Delivery not found' });
      }
      return { ...delivery, payloadJson: undefined };
    }
  );

  app.get<{ Params: { tenantId: string; deliveryId: string } }>(
    '/tenants/:tenantId/deliveries/:deliveryId/payload',
    async (request: FastifyRequest<{ Params: { tenantId: string; deliveryId: string } }>, reply: FastifyReply) => {
      const { tenantId, deliveryId } = request.params;
      const deliveries = await deps.db.listDestinationDeliveries({
        tenantId,
        limit: 1
      });
      const delivery = deliveries.find((d) => d.id === deliveryId);
      if (!delivery) {
        return reply.status(404).send({ error: 'Delivery not found' });
      }
      return delivery.payloadJson;
    }
  );

  app.post<{ Params: { tenantId: string; destinationId: string }; Body: ReplayDeliveryBody }>(
    '/tenants/:tenantId/destinations/:destinationId/deliveries/replay',
    async (request: FastifyRequest<{ Params: { tenantId: string; destinationId: string }; Body: ReplayDeliveryBody }>) => {
      const { tenantId, destinationId } = request.params;
      const { actorId, limit } = request.body;

      const count = await deps.db.replayFailedDestinationDeliveries({
        tenantId,
        destinationId,
        actorId: actorId ?? 'system',
        ...(limit ? { limit } : {})
      });

      return { success: true, replayedCount: count };
    }
  );
};

interface DeliveryQueryParams {
  destinationId?: string;
  sourceId?: string;
  eventType?: string;
  state?: string;
  limit?: number;
}

interface ReplayDeliveryBody {
  actorId?: string;
  limit?: number;
}