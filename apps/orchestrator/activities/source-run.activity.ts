import { loadOrchestratorConfig } from '@kovi/config';
import { KoviDatabase } from '@kovi/db';
import { canonicalizeUrl, hydrateSourceDefinition, shouldFollowInternalLink } from '@kovi/source-sdk';
import { createLogger } from '@kovi/shared';
import type { PageTask, RunSummary, SourceWorkflowConfig } from '../workflows/types.js';

const config = loadOrchestratorConfig();
const logger = createLogger({ service: 'orchestrator-activity', env: process.env.NODE_ENV ?? 'development' });
const db = new KoviDatabase(config.DATABASE_URL);

const globalPermitState = {
  global: 0,
  perSource: new Map<string, number>(),
  perDomain: new Map<string, number>(),
  perWorkerType: new Map<'static' | 'browser', number>()
};

const pause = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const parseIntervalSeconds = (value: string): number => {
  const normalized = value.trim().toLowerCase();
  if (normalized === '1m' || normalized === 'pt1m') {
    return 60;
  }
  if (normalized === '5m' || normalized === 'pt5m') {
    return 300;
  }
  if (normalized === '15m' || normalized === 'pt15m') {
    return 900;
  }
  if (normalized === 'hourly' || normalized === '1h' || normalized === 'pt1h') {
    return 3600;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 900;
};

const workerTypeFromSource = (fetchMode: 'static' | 'js'): 'static' | 'browser' =>
  fetchMode === 'js' ? 'browser' : 'static';

const acquirePermit = async (input: {
  sourceId: string;
  domain: string;
  workerType: 'static' | 'browser';
}): Promise<void> => {
  while (true) {
    const sourceCurrent = globalPermitState.perSource.get(input.sourceId) ?? 0;
    const domainCurrent = globalPermitState.perDomain.get(input.domain) ?? 0;
    const workerCurrent = globalPermitState.perWorkerType.get(input.workerType) ?? 0;

    const workerLimit =
      input.workerType === 'browser' ? config.ORCH_BROWSER_WORKER_CONCURRENCY : config.ORCH_STATIC_WORKER_CONCURRENCY;

    const canAcquire =
      globalPermitState.global < config.ORCH_GLOBAL_PAGE_CONCURRENCY &&
      sourceCurrent < config.ORCH_PER_SOURCE_CONCURRENCY &&
      domainCurrent < config.ORCH_PER_DOMAIN_CONCURRENCY &&
      workerCurrent < workerLimit;

    if (canAcquire) {
      globalPermitState.global += 1;
      globalPermitState.perSource.set(input.sourceId, sourceCurrent + 1);
      globalPermitState.perDomain.set(input.domain, domainCurrent + 1);
      globalPermitState.perWorkerType.set(input.workerType, workerCurrent + 1);
      return;
    }

    await pause(50);
  }
};

const releasePermit = (input: {
  sourceId: string;
  domain: string;
  workerType: 'static' | 'browser';
}): void => {
  globalPermitState.global = Math.max(0, globalPermitState.global - 1);
  globalPermitState.perSource.set(input.sourceId, Math.max(0, (globalPermitState.perSource.get(input.sourceId) ?? 1) - 1));
  globalPermitState.perDomain.set(input.domain, Math.max(0, (globalPermitState.perDomain.get(input.domain) ?? 1) - 1));
  globalPermitState.perWorkerType.set(
    input.workerType,
    Math.max(0, (globalPermitState.perWorkerType.get(input.workerType) ?? 1) - 1)
  );
};

export const listSchedulableSources = async (): Promise<SourceWorkflowConfig[]> => {
  const rows = await db.getActiveSources();
  return rows.slice(0, config.ORCH_MAX_SOURCES).map((row) => {
    const source = hydrateSourceDefinition({
      id: row.id,
      name: row.name,
      adapterType: row.adapter_type,
      configJson: row.config_json
    });

    return {
      sourceId: row.id,
      sourceName: row.name,
      runClassification: 'scheduled',
      intervalSeconds: parseIntervalSeconds(source.scheduleInterval),
      workerType: workerTypeFromSource(source.fetchMode),
      perSourceConcurrency: config.ORCH_PER_SOURCE_CONCURRENCY,
      perDomainConcurrency: config.ORCH_PER_DOMAIN_CONCURRENCY,
      deadLetterThreshold: config.ORCH_DEAD_LETTER_THRESHOLD,
      continueAsNewPageThreshold: config.ORCH_CONTINUE_AS_NEW_PAGE_THRESHOLD
    };
  });
};

export const createSourceRun = async (input: {
  sourceId: string;
  workerType: 'static' | 'browser';
  runClassification: 'scheduled' | 'manual' | 'replay' | 'backfill' | 'reprocess';
}): Promise<{ runId: string; entrypoints: string[] }> => {
  const source = await db.getSourceById(input.sourceId);
  if (!source) {
    throw new Error(`missing source ${input.sourceId}`);
  }

  const definition = hydrateSourceDefinition({
    id: source.id,
    name: source.name,
    adapterType: source.adapter_type,
    configJson: source.config_json
  });

  const runId = await db.createSourceRun(input.sourceId, input.workerType, input.runClassification);
  return {
    runId,
    entrypoints: definition.crawlEntrypoints
  };
};

export const checkCircuitState = async (sourceId: string): Promise<{ open: boolean; openUntil: string | null }> => {
  const state = await db.getSourceCircuitState(sourceId);
  if (!state) {
    return { open: false, openUntil: null };
  }
  const openUntil = state.circuitOpenUntil;
  const isOpen =
    state.circuitState === 'open' &&
    typeof openUntil === 'string' &&
    Number.isFinite(Date.parse(openUntil)) &&
    Date.parse(openUntil) > Date.now();
  return { open: isOpen, openUntil };
};

export const executePageTask = async (input: {
  sourceId: string;
  runId: string;
  workerType: 'static' | 'browser';
  task: PageTask;
}): Promise<{
  url: string;
  canonicalUrl: string;
  statusCode: number | null;
  success: boolean;
  retryable: boolean;
  reason: string;
  discoveredLinks: string[];
}> => {
  const source = await db.getSourceById(input.sourceId);
  if (!source) {
    return {
      url: input.task.url,
      canonicalUrl: canonicalizeUrl(input.task.url),
      statusCode: null,
      success: false,
      retryable: false,
      reason: 'source-not-found',
      discoveredLinks: []
    };
  }

  const definition = hydrateSourceDefinition({
    id: source.id,
    name: source.name,
    adapterType: source.adapter_type,
    configJson: source.config_json
  });

  await acquirePermit({
    sourceId: input.sourceId,
    domain: input.task.domain,
    workerType: input.workerType
  });

  try {
    if (input.workerType === 'browser') {
      await db.insertSourcePage({
        runId: input.runId,
        sourceId: input.sourceId,
        url: input.task.url,
        canonicalUrl: canonicalizeUrl(input.task.url),
        depth: input.task.depth,
        pageType: 'unknown',
        contentHash: `browser:${Date.now()}`,
        statusCode: 200,
        html: '<browser-delegated/>'
      });
      return {
        url: input.task.url,
        canonicalUrl: canonicalizeUrl(input.task.url),
        statusCode: 200,
        success: true,
        retryable: false,
        reason: 'browser-task-dispatched',
        discoveredLinks: []
      };
    }

    const response = await fetch(input.task.url, { redirect: 'follow' });
    const html = await response.text();
    const canonicalUrl = canonicalizeUrl(response.url || input.task.url);

    await db.insertSourcePage({
      runId: input.runId,
      sourceId: input.sourceId,
      url: input.task.url,
      canonicalUrl,
      depth: input.task.depth,
      pageType: 'unknown',
      contentHash: `static:${Date.now()}`,
      statusCode: response.status,
      html
    });

      const links = Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
        .map((match) => match[1] ?? null)
      .filter((candidate): candidate is string => Boolean(candidate))
      .map((href) => new URL(href, input.task.url).toString())
      .filter((candidate) => shouldFollowInternalLink(definition, input.task.depth, candidate))
      .slice(0, 50)
      .map(canonicalizeUrl);

    if (response.status >= 500) {
      return {
        url: input.task.url,
        canonicalUrl,
        statusCode: response.status,
        success: false,
        retryable: true,
        reason: `http-${response.status}`,
        discoveredLinks: []
      };
    }

    if (response.status >= 400) {
      return {
        url: input.task.url,
        canonicalUrl,
        statusCode: response.status,
        success: false,
        retryable: false,
        reason: `http-${response.status}`,
        discoveredLinks: []
      };
    }

    return {
      url: input.task.url,
      canonicalUrl,
      statusCode: response.status,
      success: true,
      retryable: false,
      reason: 'ok',
      discoveredLinks: links
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      url: input.task.url,
      canonicalUrl: canonicalizeUrl(input.task.url),
      statusCode: null,
      success: false,
      retryable: true,
      reason: message,
      discoveredLinks: []
    };
  } finally {
    releasePermit({
      sourceId: input.sourceId,
      domain: input.task.domain,
      workerType: input.workerType
    });
  }
};

export const recordDeadLetter = async (input: {
  sourceId: string;
  runId: string;
  url: string;
  canonicalUrl: string;
  attempts: number;
  statusCode: number | null;
  reason: string;
}): Promise<void> => {
  await db.insertDeadLetterPage({
    sourceId: input.sourceId,
    runId: input.runId,
    url: input.url,
    canonicalUrl: input.canonicalUrl,
    reason: input.reason,
    attempts: input.attempts,
    lastStatusCode: input.statusCode,
    payload: {
      reason: input.reason,
      attempts: input.attempts,
      statusCode: input.statusCode
    }
  });

  logger.warn(
    {
      sourceId: input.sourceId,
      runId: input.runId,
      url: input.url,
      attempts: input.attempts,
      reason: input.reason
    },
    'Page moved to dead-letter'
  );
};

export const finalizeRunSummary = async (summary: RunSummary): Promise<void> => {
  await db.updateRunSummary({
    runId: summary.sourceRunId,
    status: summary.pagesFailed > 0 && summary.pagesSucceeded === 0 ? 'failed' : 'success',
    pagesSucceeded: summary.pagesSucceeded,
    pagesFailed: summary.pagesFailed,
    pagesDeadLetter: summary.pagesDeadLetter,
    summary: {
      totalPages: summary.totalPages,
      durationMs: summary.durationMs,
      workerType: summary.workerType,
      circuitOpened: summary.circuitOpened,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt
    }
  });
};

export const recordSourceRunFailure = async (input: {
  sourceId: string;
  reason: string;
}): Promise<{ circuitOpened: boolean }> => {
  const result = await db.recordSourceRunFailure({
    sourceId: input.sourceId,
    reason: input.reason,
    threshold: config.ORCH_CIRCUIT_FAILURE_THRESHOLD,
    circuitOpenMinutes: config.ORCH_CIRCUIT_OPEN_MINUTES
  });

  if (result.opened) {
    await db.createAlert(input.sourceId, `circuit-opened: ${input.reason}`);
  }

  return { circuitOpened: result.opened };
};

export const recordSourceRunSuccess = async (sourceId: string): Promise<void> => {
  await db.recordSourceRunSuccess(sourceId);
};

export const emitRunMetric = async (input: {
  metric: string;
  sourceId: string;
  value: number;
  tags: Record<string, string>;
}): Promise<void> => {
  logger.info(
    {
      metric: input.metric,
      sourceId: input.sourceId,
      value: input.value,
      tags: input.tags
    },
    'Run metric emitted'
  );
};

export const updateReplayJobStatus = async (input: {
  replayJobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  resultSummary?: Record<string, unknown>;
}): Promise<void> => {
  const payload = {
    replayJobId: input.replayJobId,
    status: input.status,
    ...(input.resultSummary !== undefined ? { resultSummary: input.resultSummary } : {})
  };

  await db.updateReplayJobStatus(payload);
};

process.on('SIGINT', () => {
  void db.close();
});

process.on('SIGTERM', () => {
  void db.close();
});
