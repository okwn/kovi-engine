import type { EventEnvelope } from '../envelope.js';

export type DestinationDeliveryState = 'queued' | 'sent' | 'acknowledged' | 'failed' | 'dead_lettered';

export interface DestinationSecretProvider {
  getSecret(secretRef: string): Promise<string>;
}

export interface DestinationPluginContext {
  destinationId: string;
  tenantId: string;
  sourceId: string;
  entityId?: string;
  eventType: string;
  envelope: EventEnvelope<Record<string, unknown>>;
  config: Record<string, unknown>;
  secretProvider: DestinationSecretProvider;
}

export interface DestinationHealthResult {
  ok: boolean;
  message?: string;
}

export interface DestinationSendResult {
  acknowledged: boolean;
  externalRef?: string;
  error?: string;
}

export interface DestinationPlugin {
  type: string;
  validateConfig(config: Record<string, unknown>): void;
  checkHealth(context: { config: Record<string, unknown>; secretProvider: DestinationSecretProvider }): Promise<DestinationHealthResult>;
  send(context: DestinationPluginContext): Promise<DestinationSendResult>;
}
