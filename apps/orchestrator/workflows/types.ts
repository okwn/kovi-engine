export type WorkerType = 'static' | 'browser';

export interface SourceWorkflowConfig {
  sourceId: string;
  sourceName: string;
  runClassification: 'scheduled' | 'manual' | 'replay' | 'backfill' | 'reprocess';
  intervalSeconds: number;
  workerType: WorkerType;
  perSourceConcurrency: number;
  perDomainConcurrency: number;
  deadLetterThreshold: number;
  continueAsNewPageThreshold: number;
}

export interface PageTask {
  url: string;
  depth: number;
  domain: string;
  attempts: number;
}

export interface PageExecutionResult {
  url: string;
  canonicalUrl: string;
  statusCode: number | null;
  success: boolean;
  retryable: boolean;
  reason: string;
  discoveredLinks: string[];
}

export interface RunSummary {
  sourceId: string;
  sourceRunId: string;
  workerType: WorkerType;
  totalPages: number;
  pagesSucceeded: number;
  pagesFailed: number;
  pagesDeadLetter: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  circuitOpened: boolean;
}
