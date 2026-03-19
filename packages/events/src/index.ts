export * from './envelope.js';
export * from './diff-engine.js';
export * from './event-bus.js';
export * from './webhook-dispatcher.js';
export * from './destinations/types.js';
export * from './destinations/registry.js';
export * from './destinations/plugins.js';
export * from './destinations/manager.js';

import type { EventEnvelope } from './envelope.js';
import type { EventBusAdapter } from './event-bus.js';
import { createNatsJetStreamAdapter, createRedisStreamsAdapter } from './event-bus.js';
import { negotiateContractVersion, validateEventEnvelope } from '@kovi/contracts';

export type KoviEvent<TPayload extends Record<string, unknown>> = EventEnvelope<TPayload>;

export interface EventPublisher {
  publish<TPayload extends Record<string, unknown>>(
    subject: string,
    event: EventEnvelope<TPayload>
  ): Promise<{ replayCursor: string } | null>;
  close(): Promise<void>;
}

class AdapterPublisher implements EventPublisher {
  public constructor(private readonly adapter: EventBusAdapter) {}

  public async publish<TPayload extends Record<string, unknown>>(
    subject: string,
    event: EventEnvelope<TPayload>
  ): Promise<{ replayCursor: string }> {
    validateEventEnvelope(event);
    return this.adapter.publish(subject, event);
  }

  public async close(): Promise<void> {
    await this.adapter.close();
  }
}

export const createNatsPublisher = async (url: string): Promise<EventPublisher> => {
  const adapter = await createNatsJetStreamAdapter(url);
  return new AdapterPublisher(adapter);
};

export const createRedisPublisher = async (url: string, streamKey = 'kovi:events'): Promise<EventPublisher> => {
  const adapter = await createRedisStreamsAdapter(url, streamKey);
  return new AdapterPublisher(adapter);
};

export class ConsoleEventPublisher implements EventPublisher {
  public async publish<TPayload extends Record<string, unknown>>(
    subject: string,
    event: EventEnvelope<TPayload>
  ): Promise<null> {
    validateEventEnvelope(event);
    process.stdout.write(JSON.stringify({ subject, event }) + '\n');
    return null;
  }

  public async close(): Promise<void> {
    return Promise.resolve();
  }
}

export { negotiateContractVersion };
