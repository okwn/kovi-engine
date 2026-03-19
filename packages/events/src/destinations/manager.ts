import { createHash } from 'node:crypto';
import type { DestinationRow, KoviDatabase } from '@kovi/db';
import { validateEventEnvelope } from '@kovi/contracts';
import type { EventEnvelope } from '../envelope.js';
import type { DestinationRegistry } from './registry.js';
import type { DestinationPluginContext, DestinationSecretProvider } from './types.js';

export interface DestinationDispatchDeps {
  db: KoviDatabase;
  registry: DestinationRegistry;
  secretProvider: DestinationSecretProvider;
}

export const payloadHashFor = (payload: unknown): string =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const destinationMatchesEnvelope = (
  destination: DestinationRow,
  envelope: EventEnvelope<Record<string, unknown>>
): boolean => {
  if (destination.status !== 'active' && destination.status !== 'beta') {
    return false;
  }

  if (destination.eventTypes.length > 0 && !destination.eventTypes.includes(envelope.eventType)) {
    return false;
  }

  if (destination.sourceIds.length > 0 && !destination.sourceIds.includes(envelope.sourceId)) {
    return false;
  }

  if (destination.contractVersions.length > 0 && !destination.contractVersions.includes(envelope.contractVersion)) {
    return false;
  }

  const payloadEntityType = typeof envelope.payload.entityType === 'string' ? envelope.payload.entityType : null;
  if (destination.entityTypes.length > 0 && payloadEntityType && !destination.entityTypes.includes(payloadEntityType)) {
    return false;
  }

  return true;
};

export const dispatchToDestinations = async (
  deps: DestinationDispatchDeps,
  input: {
    tenantId: string;
    sourceId: string;
    entityId: string | null;
    envelope: EventEnvelope<Record<string, unknown>>;
  }
): Promise<void> => {
  validateEventEnvelope(input.envelope);

  const destinations = await deps.db.listDestinations(input.tenantId, false);
  const payloadHash = payloadHashFor(input.envelope);

  for (const destination of destinations) {
    if (!destinationMatchesEnvelope(destination, input.envelope)) {
      continue;
    }

    const deliveryId = await deps.db.insertDestinationDelivery({
      tenantId: input.tenantId,
      destinationId: destination.id,
      sourceId: input.sourceId,
      entityId: input.entityId,
      eventId: input.envelope.eventId,
      eventType: input.envelope.eventType,
      contractVersion: input.envelope.contractVersion,
      idempotencyKey: `${input.envelope.idempotencyKey}:${destination.id}`,
      payloadHash,
      payloadJson: input.envelope,
      maxAttempts: destination.maxRetries
    });

    if (!deliveryId) {
      continue;
    }

    const plugin = deps.registry.get(destination.destinationType);
    plugin.validateConfig(destination.configJson);

    const context: DestinationPluginContext = {
      destinationId: destination.id,
      tenantId: input.tenantId,
      sourceId: input.sourceId,
      ...(input.entityId ? { entityId: input.entityId } : {}),
      eventType: input.envelope.eventType,
      envelope: input.envelope,
      config: destination.configJson,
      secretProvider: deps.secretProvider
    };

    try {
      await deps.db.updateDestinationDeliveryState({
        deliveryId,
        destinationId: destination.id,
        state: 'sent'
      });

      const result = await plugin.send(context);
      if (result.acknowledged) {
        await deps.db.updateDestinationDeliveryState({
          deliveryId,
          destinationId: destination.id,
          state: 'acknowledged'
        });
      } else {
        await deps.db.updateDestinationDeliveryState({
          deliveryId,
          destinationId: destination.id,
          state: 'failed',
          error: result.error ?? 'destination did not acknowledge'
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const deliveries = await deps.db.listDestinationDeliveries({
        tenantId: input.tenantId,
        destinationId: destination.id,
        state: 'failed',
        limit: 1
      });
      const current = deliveries.find((row) => row.id === deliveryId);

      if (current && current.attempts >= current.maxAttempts) {
        await deps.db.updateDestinationDeliveryState({
          deliveryId,
          destinationId: destination.id,
          state: 'dead_lettered',
          error: message
        });
      } else {
        await deps.db.updateDestinationDeliveryState({
          deliveryId,
          destinationId: destination.id,
          state: 'failed',
          error: message
        });
      }
    }
  }
};

export const checkDestinationHealth = async (
  deps: DestinationDispatchDeps,
  destination: DestinationRow
): Promise<{ ok: boolean; message?: string }> => {
  const plugin = deps.registry.get(destination.destinationType);
  plugin.validateConfig(destination.configJson);

  const result = await plugin.checkHealth({
    config: destination.configJson,
    secretProvider: deps.secretProvider
  });

  await deps.db.updateDestination({
    destinationId: destination.id,
    tenantId: destination.tenantId,
    lastHealthStatus: result.ok ? 'healthy' : 'degraded',
    ...(result.message ? { lastHealthError: result.ok ? null : result.message } : {})
  });

  return result;
};
