import { createHmac } from 'node:crypto';
import type { KoviDatabase } from '@kovi/db';
import type { EventPublisher } from '../index.js';
import type {
  DestinationHealthResult,
  DestinationPlugin,
  DestinationPluginContext,
  DestinationSecretProvider,
  DestinationSendResult
} from './types.js';

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const ok = (message?: string): DestinationHealthResult => ({ ok: true, ...(message ? { message } : {}) });
const bad = (message: string): DestinationHealthResult => ({ ok: false, message });

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^0\.0\.0\.0$/,
  /^localhost$/i,
  /^::1$/,
  /^fe80:/i,
  /^::$/
];

const isPrivateUrl = (urlString: string): boolean => {
  try {
    const parsed = new URL(urlString);
    return PRIVATE_IP_RANGES.some((regex) => regex.test(parsed.hostname));
  } catch {
    return false;
  }
};

export const validateWebhookUrl = (urlString: string): { valid: boolean; error?: string } => {
  if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
    return { valid: false, error: 'webhook url must be http(s)' };
  }
  if (isPrivateUrl(urlString)) {
    return { valid: false, error: 'webhook url targets private/local network (SSRF protection)' };
  }
  return { valid: true };
};

export class WebhookDestinationPlugin implements DestinationPlugin {
  public readonly type = 'webhook';

  public validateConfig(config: Record<string, unknown>): void {
    const url = asString(config.url);
    if (!url) {
      throw new Error('webhook destination config requires url');
    }
    const validation = validateWebhookUrl(url);
    if (!validation.valid) {
      throw new Error(`webhook destination url invalid: ${validation.error}`);
    }
  }

  public async checkHealth(input: { config: Record<string, unknown>; secretProvider: DestinationSecretProvider }): Promise<DestinationHealthResult> {
    void input.secretProvider;
    const url = asString(input.config.url);
    const validation = validateWebhookUrl(url);
    if (!validation.valid) {
      return bad(validation.error ?? 'invalid webhook url');
    }
    return ok('webhook config looks valid');
  }

  public async send(context: DestinationPluginContext): Promise<DestinationSendResult> {
    const url = asString(context.config.url);
    const body = JSON.stringify(context.envelope);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-kovi-event-id': context.envelope.eventId,
      'x-kovi-contract-version': context.envelope.contractVersion,
      'x-kovi-tenant-id': context.tenantId
    };

    const secretRef = asString(context.config.secretRef);
    if (secretRef) {
      const secret = await context.secretProvider.getSecret(secretRef);
      headers['x-kovi-signature'] = createHmac('sha256', secret).update(body).digest('hex');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body
    });

    return response.ok
      ? { acknowledged: true, externalRef: `http-${response.status}` }
      : { acknowledged: false, error: `http-${response.status}` };
  }
}

export class EventBusDestinationPlugin implements DestinationPlugin {
  public readonly type = 'event-bus';

  public constructor(private readonly publisher: EventPublisher) {}

  public validateConfig(config: Record<string, unknown>): void {
    if (!asString(config.subject)) {
      throw new Error('event-bus destination config requires subject');
    }
  }

  public async checkHealth(input: { config: Record<string, unknown>; secretProvider: DestinationSecretProvider }): Promise<DestinationHealthResult> {
    void input.secretProvider;
    return input.config.subject ? ok('subject configured') : bad('subject missing');
  }

  public async send(context: DestinationPluginContext): Promise<DestinationSendResult> {
    const subject = asString(context.config.subject);
    const ack = await this.publisher.publish(subject, context.envelope);
    return {
      acknowledged: true,
      ...(ack?.replayCursor ? { externalRef: ack.replayCursor } : {})
    };
  }
}

export class QueueDestinationPlugin implements DestinationPlugin {
  public readonly type = 'queue';

  public constructor(private readonly publisher: EventPublisher) {}

  public validateConfig(config: Record<string, unknown>): void {
    if (!asString(config.queueName)) {
      throw new Error('queue destination config requires queueName');
    }
  }

  public async checkHealth(input: { config: Record<string, unknown>; secretProvider: DestinationSecretProvider }): Promise<DestinationHealthResult> {
    void input.secretProvider;
    return input.config.queueName ? ok('queue configured') : bad('queueName missing');
  }

  public async send(context: DestinationPluginContext): Promise<DestinationSendResult> {
    const queueName = asString(context.config.queueName);
    const subject = `kovi.queue.${queueName}`;
    const ack = await this.publisher.publish(subject, context.envelope);
    return {
      acknowledged: true,
      ...(ack?.replayCursor ? { externalRef: ack.replayCursor } : {})
    };
  }
}

export class PostgresExportDestinationPlugin implements DestinationPlugin {
  public readonly type = 'postgres-export';

  public constructor(private readonly db: KoviDatabase) {}

  public validateConfig(config: Record<string, unknown>): void {
    if (!asString(config.exportTable, 'destination_export_rows')) {
      throw new Error('postgres-export destination config requires exportTable');
    }
  }

  public async checkHealth(input: { config: Record<string, unknown>; secretProvider: DestinationSecretProvider }): Promise<DestinationHealthResult> {
    void input.secretProvider;
    const table = asString(input.config.exportTable, 'destination_export_rows');
    try {
      await this.db.query(`SELECT 1 FROM ${table} LIMIT 1`);
      return ok('postgres export table reachable');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return bad(message);
    }
  }

  public async send(context: DestinationPluginContext): Promise<DestinationSendResult> {
    const exportTable = asString(context.config.exportTable, 'destination_export_rows');
    await this.db.query(
      `INSERT INTO ${exportTable} (
         destination_id,
         tenant_id,
         source_id,
         entity_id,
         record_key,
         payload_hash,
         payload_json,
         created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [
        context.destinationId,
        context.tenantId,
        context.sourceId,
        context.entityId ?? null,
        context.envelope.recordKey ?? null,
        context.envelope.idempotencyKey,
        context.envelope
      ]
    );

    return { acknowledged: true, externalRef: 'postgres-export' };
  }
}

export class S3BundleDestinationPlugin implements DestinationPlugin {
  public readonly type = 's3-bundle';

  public validateConfig(config: Record<string, unknown>): void {
    if (!asString(config.bucket)) {
      throw new Error('s3-bundle destination config requires bucket');
    }
  }

  public async checkHealth(input: { config: Record<string, unknown>; secretProvider: DestinationSecretProvider }): Promise<DestinationHealthResult> {
    void input.secretProvider;
    return input.config.bucket ? ok('bucket configured') : bad('bucket missing');
  }

  public async send(context: DestinationPluginContext): Promise<DestinationSendResult> {
    const bundleRef = `s3://${asString(context.config.bucket)}/${context.tenantId}/${context.sourceId}/${context.envelope.eventId}.json`;
    return { acknowledged: true, externalRef: bundleRef };
  }
}

export class SignedJsonBundleDestinationPlugin implements DestinationPlugin {
  public readonly type = 'signed-json-bundle';

  public validateConfig(config: Record<string, unknown>): void {
    if (!asString(config.signingSecretRef)) {
      throw new Error('signed-json-bundle destination config requires signingSecretRef');
    }
  }

  public async checkHealth(input: { config: Record<string, unknown>; secretProvider: DestinationSecretProvider }): Promise<DestinationHealthResult> {
    try {
      await input.secretProvider.getSecret(asString(input.config.signingSecretRef));
      return ok('signing secret available');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return bad(message);
    }
  }

  public async send(context: DestinationPluginContext): Promise<DestinationSendResult> {
    const secret = await context.secretProvider.getSecret(asString(context.config.signingSecretRef));
    const payload = JSON.stringify(context.envelope);
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    return {
      acknowledged: true,
      externalRef: `signed:${signature.slice(0, 16)}`
    };
  }
}

export class AnalyticsSinkDestinationPlugin implements DestinationPlugin {
  public readonly type = 'analytics-sink';

  public validateConfig(config: Record<string, unknown>): void {
    if (!asString(config.sinkName)) {
      throw new Error('analytics-sink destination config requires sinkName');
    }
  }

  public async checkHealth(input: { config: Record<string, unknown>; secretProvider: DestinationSecretProvider }): Promise<DestinationHealthResult> {
    void input.secretProvider;
    return input.config.sinkName ? ok('analytics sink configured') : bad('sinkName missing');
  }

  public async send(context: DestinationPluginContext): Promise<DestinationSendResult> {
    process.stdout.write(
      JSON.stringify({
        sink: asString(context.config.sinkName),
        tenantId: context.tenantId,
        sourceId: context.sourceId,
        eventId: context.envelope.eventId
      }) + '\n'
    );

    return {
      acknowledged: true,
      externalRef: `analytics:${asString(context.config.sinkName)}`
    };
  }
}
