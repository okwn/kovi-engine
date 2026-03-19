# Kovi Change Detection and Delivery

This document defines the downstream contract for change events emitted by Kovi and the operational semantics for idempotent, replay-safe delivery.

## Event Envelope (v1.0)

All emitted change events use schema version `1.0` and this envelope shape:

```ts
type ChangeScope = 'page' | 'entity' | 'field';

interface FieldChange {
  field: string;
  before?: unknown;
  after?: unknown;
}

interface ChangeSet {
  pageChanged: boolean;
  entityChanged: boolean;
  fieldChanges: FieldChange[];
}

interface EventEnvelope<TPayload extends Record<string, unknown>> {
  schemaVersion: '1.0';
  eventType: 'entity.changed' | 'page.changed';
  eventId: string;
  idempotencyKey: string;
  occurredAt: string;
  sourceId: string;
  entityId?: string;
  recordKey?: string;
  versionNo?: number;
  changeScopes: ChangeScope[];
  changes: ChangeSet;
  payload: TPayload;
}
```

## Change Detection Semantics

- Page-level detection compares canonical page hash values per canonical URL.
- Entity-level detection compares normalized entity snapshots by source and record key.
- Field-level detection computes delta entries with previous and next values.
- Duplicate suppression is enforced by idempotency keys on `change_events` and delivery records.

## Idempotency and Replay

Kovi stores delivery lifecycle data in `delivery_events` and enforces dedupe with idempotency keys.

- Internal stream event idempotency key:
  - `sourceId:entityId:versionNo:eventType` for entity events
  - `sourceId:page:canonicalUrl:pageHash` for page-only events
- Webhook idempotency key:
  - `<event-idempotency>:webhook:<webhookId>`
- API layer indexing idempotency key:
  - `<event-idempotency>:api-index`

Delivery metadata:

- `status`: pending | published | failed
- `attempts`: incremented on every delivery attempt update
- `last_attempt_at`, `next_attempt_at`, `last_error`
- `replay_cursor`: broker cursor/offset for replay support

Replay cursor formats:

- NATS JetStream: `<stream>:<seq>`
- Redis Streams: `<stream-id>`

## Event Bus Backends

Configure backend with environment variables:

- `EVENT_BUS_BACKEND=nats-jetstream|redis-streams`
- `NATS_URL` (when using NATS)
- `REDIS_URL` and `REDIS_STREAM_KEY` (when using Redis Streams)

Extractor worker runtime selects the configured backend and publishes events through a shared adapter interface.

## Webhook Delivery

Webhook targets are managed through API endpoints and dispatched for each emitted change event.

- Delivery attempts are tracked in `delivery_events`.
- Each webhook target gets an independent status and attempt history.
- Failed deliveries are persisted with error reason for retry/operations.

## API Endpoints

Read/query endpoints:

- `GET /v1/sources`
- `GET /v1/sources/:sourceId/status`
- `GET /v1/sources/:sourceId/entities/latest?limit=100`
- `GET /v1/entities/:entityId/history?limit=100`
- `GET /v1/changes/recent?limit=100`
- `GET /v1/webhooks?sourceId=<optional>`

Webhook management:

- `POST /v1/webhooks`
- `PATCH /v1/webhooks/:webhookId`
- `DELETE /v1/webhooks/:webhookId`

## Operational Notes

- `change_events` is the durable query/index layer for downstream APIs.
- `delivery_events` is the durable transport and retry audit layer.
- Consumers should treat `idempotencyKey` as the authoritative dedupe key.
- Consumers should persist and checkpoint `replay_cursor` for deterministic replay workflows.
