import { connect, JSONCodec, type JetStreamClient, type NatsConnection } from 'nats';
import { createClient } from 'redis';
import type { EventEnvelope } from './envelope.js';

export interface PublishResult {
  replayCursor: string;
}

export interface EventBusAdapter {
  publish<TPayload extends Record<string, unknown>>(subject: string, envelope: EventEnvelope<TPayload>): Promise<PublishResult>;
  close(): Promise<void>;
}

export class NatsJetStreamAdapter implements EventBusAdapter {
  private readonly codec = JSONCodec<EventEnvelope<Record<string, unknown>>>();

  public constructor(
    private readonly connection: NatsConnection,
    private readonly jetstream: JetStreamClient
  ) {}

  public async publish<TPayload extends Record<string, unknown>>(
    subject: string,
    envelope: EventEnvelope<TPayload>
  ): Promise<PublishResult> {
    const ack = await this.jetstream.publish(
      subject,
      this.codec.encode(envelope as EventEnvelope<Record<string, unknown>>),
      {
        msgID: envelope.idempotencyKey
      }
    );

    return {
      replayCursor: `${ack.stream}:${ack.seq}`
    };
  }

  public async close(): Promise<void> {
    await this.connection.drain();
    await this.connection.closed();
  }
}

export const createNatsJetStreamAdapter = async (url: string): Promise<NatsJetStreamAdapter> => {
  const connection = await connect({ servers: [url] });
  const jetstream = connection.jetstream();
  return new NatsJetStreamAdapter(connection, jetstream);
};

export class RedisStreamsAdapter implements EventBusAdapter {
  public constructor(private readonly redis: ReturnType<typeof createClient>, private readonly streamKey: string) {}

  public async publish<TPayload extends Record<string, unknown>>(
    subject: string,
    envelope: EventEnvelope<TPayload>
  ): Promise<PublishResult> {
    const id = await this.redis.xAdd(this.streamKey, '*', {
      subject,
      envelope: JSON.stringify(envelope),
      idempotencyKey: envelope.idempotencyKey
    });

    return {
      replayCursor: id
    };
  }

  public async close(): Promise<void> {
    await this.redis.quit();
  }
}

export const createRedisStreamsAdapter = async (
  url: string,
  streamKey = 'kovi:events'
): Promise<RedisStreamsAdapter> => {
  const redis = createClient({ url });
  await redis.connect();
  return new RedisStreamsAdapter(redis, streamKey);
};
