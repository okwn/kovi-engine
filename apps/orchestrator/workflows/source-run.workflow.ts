import { proxyActivities, sleep } from '@temporalio/workflow';
import type { PageExecutionResult, PageTask, RunSummary, SourceWorkflowConfig } from './types.js';

interface ControlActivities {
  createSourceRun(input: {
    sourceId: string;
    workerType: 'static' | 'browser';
    runClassification: 'scheduled' | 'manual' | 'replay' | 'backfill' | 'reprocess';
  }): Promise<{ runId: string; entrypoints: string[] }>;
  checkCircuitState(sourceId: string): Promise<{ open: boolean; openUntil: string | null }>;
  recordDeadLetter(input: {
    sourceId: string;
    runId: string;
    url: string;
    canonicalUrl: string;
    attempts: number;
    statusCode: number | null;
    reason: string;
  }): Promise<void>;
  finalizeRunSummary(summary: RunSummary): Promise<void>;
  recordSourceRunFailure(input: { sourceId: string; reason: string }): Promise<{ circuitOpened: boolean }>;
  recordSourceRunSuccess(sourceId: string): Promise<void>;
  emitRunMetric(input: { metric: string; sourceId: string; value: number; tags: Record<string, string> }): Promise<void>;
}

interface WorkerActivities {
  executePageTask(input: {
    sourceId: string;
    runId: string;
    workerType: 'static' | 'browser';
    task: PageTask;
  }): Promise<PageExecutionResult>;
}

const control = proxyActivities<ControlActivities>({
  startToCloseTimeout: '2 minutes',
  taskQueue: 'kovi-orchestrator',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s'
  }
});

const staticWorker = proxyActivities<WorkerActivities>({
  startToCloseTimeout: '4 minutes',
  taskQueue: 'kovi-static-fetch',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '20s'
  }
});

const browserWorker = proxyActivities<WorkerActivities>({
  startToCloseTimeout: '10 minutes',
  taskQueue: 'kovi-browser-fetch',
  retry: {
    maximumAttempts: 2,
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumInterval: '40s'
  }
});

export interface SourceRunWorkflowInput {
  config: SourceWorkflowConfig;
  pendingTasks?: PageTask[];
  runId?: string;
  pagesSucceeded?: number;
  pagesFailed?: number;
  pagesDeadLetter?: number;
  processedPages?: number;
  startedAt?: string;
}

const executeTask = async (
  workerType: 'static' | 'browser',
  input: { sourceId: string; runId: string; task: PageTask }
): Promise<PageExecutionResult> => {
  const activity = workerType === 'browser' ? browserWorker : staticWorker;
  return activity.executePageTask({
    sourceId: input.sourceId,
    runId: input.runId,
    workerType,
    task: input.task
  });
};

const domainOf = (url: string): string => new URL(url).hostname;

export const sourceRunWorkflow = async (input: SourceRunWorkflowInput): Promise<RunSummary> => {
  const startedAt = input.startedAt ?? new Date().toISOString();
  const pagesSucceeded = input.pagesSucceeded ?? 0;
  const pagesFailed = input.pagesFailed ?? 0;
  const pagesDeadLetter = input.pagesDeadLetter ?? 0;
  const processedPages = input.processedPages ?? 0;

  const circuit = await control.checkCircuitState(input.config.sourceId);
  if (circuit.open) {
    await control.emitRunMetric({
      metric: 'orchestrator.circuit.open.skipped',
      sourceId: input.config.sourceId,
      value: 1,
      tags: { workerType: input.config.workerType }
    });

    const now = new Date().toISOString();
    return {
      sourceId: input.config.sourceId,
      sourceRunId: 'skipped-circuit-open',
      workerType: input.config.workerType,
      totalPages: 0,
      pagesSucceeded,
      pagesFailed,
      pagesDeadLetter,
      startedAt,
      endedAt: now,
      durationMs: Math.max(0, Date.now() - Date.parse(startedAt)),
      circuitOpened: true
    };
  }

  const runContext = input.runId
    ? { runId: input.runId, entrypoints: [] }
    : await control.createSourceRun({
        sourceId: input.config.sourceId,
        workerType: input.config.workerType,
        runClassification: input.config.runClassification
      });

  const queue: PageTask[] =
    input.pendingTasks ??
    runContext.entrypoints.map((url) => ({
      url,
      depth: 0,
      domain: domainOf(url),
      attempts: 0
    }));

  const perDomainInFlight = new Map<string, number>();
  type InFlightItem = {
    id: string;
    promise: Promise<{ task: PageTask; result: PageExecutionResult }>;
  };
  const inFlight: InFlightItem[] = [];
  const seen = new Set<string>(queue.map((task) => task.url));

  const enqueue = (task: PageTask): void => {
    if (seen.has(task.url)) {
      return;
    }
    seen.add(task.url);
    queue.push(task);
  };

  let successCount = pagesSucceeded;
  let failCount = pagesFailed;
  let deadLetterCount = pagesDeadLetter;
  let processedCount = processedPages;

  while (queue.length > 0 || inFlight.length > 0) {
    while (queue.length > 0 && inFlight.length < input.config.perSourceConcurrency) {
      const next = queue.shift();
      if (!next) {
        break;
      }

      const domainSlots = perDomainInFlight.get(next.domain) ?? 0;
      if (domainSlots >= input.config.perDomainConcurrency) {
        queue.push(next);
        break;
      }

      perDomainInFlight.set(next.domain, domainSlots + 1);

      const id = `${next.url}#${next.attempts}#${processedCount}`;
      const promise = executeTask(input.config.workerType, {
        sourceId: input.config.sourceId,
        runId: runContext.runId,
        task: next
      }).then((result) => ({ task: next, result }));

      inFlight.push({ id, promise });
    }

    if (inFlight.length === 0) {
      await sleep(250);
      continue;
    }

    const wrapped = inFlight.map((item) => item.promise.then((value) => ({ id: item.id, value })));
    const completed = await Promise.race(wrapped);
    const idx = inFlight.findIndex((item) => item.id === completed.id);
    if (idx >= 0) {
      inFlight.splice(idx, 1);
    }

    const { task, result } = completed.value;
    const currentSlots = perDomainInFlight.get(task.domain) ?? 1;
    perDomainInFlight.set(task.domain, Math.max(0, currentSlots - 1));

    processedCount += 1;
    if (result.success) {
      successCount += 1;
      for (const discovered of result.discoveredLinks) {
        enqueue({
          url: discovered,
          depth: task.depth + 1,
          domain: domainOf(discovered),
          attempts: 0
        });
      }
    } else {
      failCount += 1;
      const nextAttempts = task.attempts + 1;
      if (result.retryable && nextAttempts < input.config.deadLetterThreshold) {
        await sleep(nextAttempts * 1000);
        queue.push({ ...task, attempts: nextAttempts });
      } else {
        deadLetterCount += 1;
        await control.recordDeadLetter({
          sourceId: input.config.sourceId,
          runId: runContext.runId,
          url: task.url,
          canonicalUrl: result.canonicalUrl,
          attempts: nextAttempts,
          statusCode: result.statusCode,
          reason: result.reason
        });
      }
    }

    if (processedCount >= input.config.continueAsNewPageThreshold && queue.length > 0) {
      return sourceRunWorkflow({
        config: input.config,
        pendingTasks: queue,
        runId: runContext.runId,
        pagesSucceeded: successCount,
        pagesFailed: failCount,
        pagesDeadLetter: deadLetterCount,
        processedPages: processedCount,
        startedAt
      });
    }
  }

  const endedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.now() - Date.parse(startedAt));

  let circuitOpened = false;
  if (failCount > 0 && successCount === 0) {
    const failure = await control.recordSourceRunFailure({
      sourceId: input.config.sourceId,
      reason: `run-failed pagesFailed=${failCount} deadLetter=${deadLetterCount}`
    });
    circuitOpened = failure.circuitOpened;
  } else {
    await control.recordSourceRunSuccess(input.config.sourceId);
  }

  const summary: RunSummary = {
    sourceId: input.config.sourceId,
    sourceRunId: runContext.runId,
    workerType: input.config.workerType,
    totalPages: processedCount,
    pagesSucceeded: successCount,
    pagesFailed: failCount,
    pagesDeadLetter: deadLetterCount,
    startedAt,
    endedAt,
    durationMs,
    circuitOpened
  };

  await control.finalizeRunSummary(summary);
  await control.emitRunMetric({
    metric: 'orchestrator.run.duration.ms',
    sourceId: input.config.sourceId,
    value: durationMs,
    tags: {
      workerType: input.config.workerType,
      circuitOpened: String(circuitOpened)
    }
  });

  return summary;
};
