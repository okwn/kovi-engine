import { createHmac } from 'node:crypto';
import type { EventEnvelope } from './envelope.js';

export interface WebhookTarget {
  id: string;
  sourceId: string;
  url: string;
  secret?: string;
}

export interface WebhookDispatchResult {
  targetId: string;
  success: boolean;
  statusCode: number | null;
  error: string | null;
}

const signatureFor = (secret: string, body: string): string =>
  createHmac('sha256', secret).update(body).digest('hex');

export class WebhookDispatcher {
  public async dispatch<TPayload extends Record<string, unknown>>(
    envelope: EventEnvelope<TPayload>,
    targets: WebhookTarget[]
  ): Promise<WebhookDispatchResult[]> {
    const body = JSON.stringify(envelope);

    const results: WebhookDispatchResult[] = [];
    for (const target of targets) {
      try {
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          'x-kovi-event-id': envelope.eventId,
          'x-kovi-idempotency-key': envelope.idempotencyKey,
          'x-kovi-schema-version': envelope.schemaVersion
        };

        if (target.secret) {
          headers['x-kovi-signature'] = signatureFor(target.secret, body);
        }

        const response = await fetch(target.url, {
          method: 'POST',
          headers,
          body
        });

        results.push({
          targetId: target.id,
          success: response.ok,
          statusCode: response.status,
          error: response.ok ? null : `http-${response.status}`
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          targetId: target.id,
          success: false,
          statusCode: null,
          error: message
        });
      }
    }

    return results;
  }
}
