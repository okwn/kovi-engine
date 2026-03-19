export type ChangeScope = 'page' | 'entity' | 'field';

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ChangeSet {
  pageChanged: boolean;
  entityChanged: boolean;
  fieldChanges: FieldChange[];
}

export interface EventEnvelope<TPayload extends Record<string, unknown>> {
  schemaVersion: '1.0';
  contractType: 'entity.snapshot' | 'entity.change' | 'source.run.summary' | 'source.health';
  contractVersion: '1.0';
  eventType: string;
  eventId: string;
  idempotencyKey: string;
  occurredAt: string;
  tenantId: string;
  sourceId: string;
  entityId?: string;
  recordKey?: string;
  versionNo?: number;
  changeScopes: ChangeScope[];
  changes: ChangeSet;
  payload: TPayload;
}
