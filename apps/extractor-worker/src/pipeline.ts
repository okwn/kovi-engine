import { randomUUID } from 'node:crypto';
import type { KoviDatabase } from '@kovi/db';
import {
  buildChangeSet,
  dispatchToDestinations,
  type DestinationDispatchDeps,
  type EventEnvelope,
  type EventPublisher,
  type WebhookDispatcher
} from '@kovi/events';
import {
  canonicalizeUrl,
  classifyFailure,
  computeContentHash,
  normalizeEntity,
  type ExtractorAiFallback,
  type ExtractionContext,
  type SourceAdapter,
  type SourceDefinition
} from '@kovi/source-sdk';

interface LoggerLike {
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface PipelineInput {
  db: KoviDatabase;
  publisher: EventPublisher;
  webhookDispatcher: WebhookDispatcher;
  logger: LoggerLike;
  destinationDispatchDeps: DestinationDispatchDeps;
  tenantId: string;
  source: SourceDefinition;
  adapter: SourceAdapter;
  runId: string;
  aiFallback: ExtractorAiFallback;
  url: string;
  depth: number;
  html: string;
  statusCode: number;
}

const idempotencyKeyFor = (input: {
  sourceId: string;
  entityId: string;
  versionNo: number;
  eventType: string;
}): string => `${input.sourceId}:${input.entityId}:${input.versionNo}:${input.eventType}`;

export const processExtractedPage = async (input: PipelineInput): Promise<void> => {
  const context: ExtractionContext = {
    source: input.source,
    url: input.url,
    depth: input.depth,
    html: input.html
  };

  const pageType = input.adapter.classifyPage(context);
  if (pageType === 'unknown') {
    input.logger.warn({ sourceId: input.source.id, url: input.url }, 'Skipping unknown page type');
    return;
  }

  const canonicalUrl = canonicalizeUrl(input.url);
  const pageHash = computeContentHash({
    sourceId: input.source.id,
    recordKey: canonicalUrl,
    pageUrl: input.url,
    canonicalData: { html: input.html }
  });

  const pageId = await input.db.insertSourcePage({
    runId: input.runId,
    sourceId: input.source.id,
    url: input.url,
    canonicalUrl,
    depth: input.depth,
    pageType,
    contentHash: pageHash,
    statusCode: input.statusCode,
    html: input.html
  });

  const latestPageVersion = await input.db.getLatestPageVersion(input.source.id, canonicalUrl);
  const pageChanged = latestPageVersion ? latestPageVersion.contentHash !== pageHash : true;
  await input.db.insertPageVersion({
    pageId,
    contentHash: pageHash,
    metadata: {
      previousHash: latestPageVersion?.contentHash ?? null,
      changed: pageChanged,
      canonicalUrl
    }
  });

  let entities;
  try {
    entities = input.adapter.extract(context, pageType);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown extraction error';
    const category = classifyFailure(input.statusCode, message);
    input.logger.error({ sourceId: input.source.id, url: input.url, category, message }, 'Deterministic extraction failed');

    if (!input.source.aiFallbackEnabled) {
      throw error;
    }

    entities = await input.aiFallback.extractFromHtml(input.html, input.source, pageType);
  }

  let emittedEntityEvent = false;

  for (const entity of entities) {
    const previousSnapshot = await input.db.getLatestEntitySnapshot(input.source.id, entity.recordKey);
    const normalized = normalizeEntity(input.adapter.normalize(entity, input.source), input.source);
    const contentHash = computeContentHash(normalized);

    const versionResult = await input.db.upsertEntityVersion({
      sourceId: input.source.id,
      recordKey: normalized.recordKey,
      data: normalized.canonicalData,
      contentHash,
      pageId
    });

    if (!versionResult.changed) {
      continue;
    }

    const changeSet = buildChangeSet({
      previousPageHash: latestPageVersion?.contentHash ?? null,
      currentPageHash: pageHash,
      previousEntity: previousSnapshot?.latestData ?? null,
      currentEntity: normalized.canonicalData
    });

    const changeScopes: Array<'page' | 'entity' | 'field'> = [];
    if (changeSet.pageChanged) {
      changeScopes.push('page');
    }
    if (changeSet.entityChanged) {
      changeScopes.push('entity');
    }
    if (changeSet.fieldChanges.length > 0) {
      changeScopes.push('field');
    }

    const idempotencyKey = idempotencyKeyFor({
      sourceId: input.source.id,
      entityId: versionResult.entityId,
      versionNo: versionResult.versionNumber,
      eventType: 'entity.changed'
    });

    const payload: Record<string, unknown> = {
      sourceId: input.source.id,
      entityId: versionResult.entityId,
      recordKey: normalized.recordKey,
      version: versionResult.versionNumber,
      pageUrl: normalized.pageUrl,
      changedAt: new Date().toISOString()
    };

    const envelope: EventEnvelope<Record<string, unknown>> = {
      schemaVersion: '1.0',
      contractType: 'entity.change',
      contractVersion: '1.0',
      eventType: 'entity.changed',
      eventId: randomUUID(),
      idempotencyKey,
      occurredAt: new Date().toISOString(),
      tenantId: input.tenantId,
      sourceId: input.source.id,
      entityId: versionResult.entityId,
      recordKey: normalized.recordKey,
      versionNo: versionResult.versionNumber,
      changeScopes,
      changes: changeSet,
      payload
    };

    const insertedChange = await input.db.insertChangeEvent({
      sourceId: input.source.id,
      sourceRunId: input.runId,
      sourcePageId: pageId,
      entityId: versionResult.entityId,
      entityVersionId: versionResult.entityVersionId,
      changeScope: changeScopes,
      pageChanged: changeSet.pageChanged,
      entityChanged: changeSet.entityChanged,
      fieldChanges: changeSet.fieldChanges,
      idempotencyKey,
      eventEnvelope: envelope
    });

    if (!insertedChange) {
      continue;
    }

    emittedEntityEvent = true;

    await input.db.insertDeliveryEvent({
      sourceId: input.source.id,
      entityId: versionResult.entityId,
      eventType: 'entity.changed',
      payload: envelope,
      idempotencyKey,
      targetType: 'internal-stream',
      targetRef: input.source.exportPolicy.subject,
      status: 'pending'
    });

    const busResult = await input.publisher.publish(input.source.exportPolicy.subject, envelope);
    await input.db.updateDeliveryEventAttempt({
      idempotencyKey,
      status: 'published',
      replayCursor: busResult?.replayCursor ?? null,
      error: null
    });

    const webhookRows = await input.db.listWebhooks(input.source.id);
    const webhookTargets = webhookRows
      .filter((row) => row.active)
      .map((row) => ({
        id: row.id,
        sourceId: row.sourceId ?? input.source.id,
        url: row.url
      }));

    const webhookResults = await input.webhookDispatcher.dispatch(envelope, webhookTargets);
    for (const result of webhookResults) {
      const webhookIdempotency = `${idempotencyKey}:webhook:${result.targetId}`;
      const inserted = await input.db.insertDeliveryEvent({
        sourceId: input.source.id,
        entityId: versionResult.entityId,
        eventType: 'entity.changed',
        payload: envelope,
        idempotencyKey: webhookIdempotency,
        targetType: 'webhook',
        targetRef: result.targetId,
        status: result.success ? 'published' : 'failed',
        attempts: 1,
        lastError: result.error
      });

      if (inserted && !result.success) {
        await input.db.updateDeliveryEventAttempt({
          idempotencyKey: webhookIdempotency,
          status: 'failed',
          replayCursor: null,
          error: result.error
        });
      }
    }

    await dispatchToDestinations(input.destinationDispatchDeps, {
      tenantId: input.tenantId,
      sourceId: input.source.id,
      entityId: versionResult.entityId,
      envelope
    });

    await input.db.insertDeliveryEvent({
      sourceId: input.source.id,
      entityId: versionResult.entityId,
      eventType: 'api.change-indexed',
      payload: {
        sourceId: input.source.id,
        entityId: versionResult.entityId,
        idempotencyKey
      },
      idempotencyKey: `${idempotencyKey}:api-index`,
      targetType: 'api-query-layer',
      targetRef: 'change_events',
      status: 'published'
    });
  }

  if (pageChanged && !emittedEntityEvent) {
    const idempotencyKey = `${input.source.id}:page:${canonicalUrl}:${pageHash}`;
    const envelope: EventEnvelope<Record<string, unknown>> = {
      schemaVersion: '1.0',
      contractType: 'source.health',
      contractVersion: '1.0',
      eventType: 'page.changed',
      eventId: randomUUID(),
      idempotencyKey,
      occurredAt: new Date().toISOString(),
      tenantId: input.tenantId,
      sourceId: input.source.id,
      changeScopes: ['page'],
      changes: {
        pageChanged: true,
        entityChanged: false,
        fieldChanges: []
      },
      payload: {
        sourceId: input.source.id,
        canonicalUrl,
        pageId,
        changedAt: new Date().toISOString()
      }
    };

    const insertedChange = await input.db.insertChangeEvent({
      sourceId: input.source.id,
      sourceRunId: input.runId,
      sourcePageId: pageId,
      entityId: null,
      entityVersionId: null,
      changeScope: ['page'],
      pageChanged: true,
      entityChanged: false,
      fieldChanges: [],
      idempotencyKey,
      eventEnvelope: envelope
    });

    if (!insertedChange) {
      return;
    }

    await input.db.insertDeliveryEvent({
      sourceId: input.source.id,
      entityId: null,
      eventType: 'page.changed',
      payload: envelope,
      idempotencyKey,
      targetType: 'internal-stream',
      targetRef: input.source.exportPolicy.subject,
      status: 'pending'
    });

    const busResult = await input.publisher.publish(input.source.exportPolicy.subject, envelope);
    await input.db.updateDeliveryEventAttempt({
      idempotencyKey,
      status: 'published',
      replayCursor: busResult?.replayCursor ?? null,
      error: null
    });

    await dispatchToDestinations(input.destinationDispatchDeps, {
      tenantId: input.tenantId,
      sourceId: input.source.id,
      entityId: null,
      envelope
    });
  }
};
