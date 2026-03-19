import { Client, Connection } from '@temporalio/client';
import { NativeConnection, Worker } from '@temporalio/worker';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOrchestratorConfig } from '@kovi/config';
import { bootstrapOtel } from '@kovi/observability';
import { createLogger } from '@kovi/shared';
import { coordinatorWorkflow } from '../workflows/coordinator.workflow.js';
import * as activities from '../activities/source-run.activity.js';

const config = loadOrchestratorConfig();
const logger = createLogger({ service: 'orchestrator', env: config.NODE_ENV, version: config.OTEL_SERVICE_VERSION });

await bootstrapOtel({
  serviceName: 'orchestrator',
  serviceVersion: config.OTEL_SERVICE_VERSION,
  endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  enabled: config.OTEL_ENABLED
});

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const workflowsPath = join(currentDir, '..', 'workflows');

const connection = await NativeConnection.connect({ address: config.TEMPORAL_ADDRESS });
const temporalClientConnection = await Connection.connect({ address: config.TEMPORAL_ADDRESS });
const temporalClient = new Client({
  connection: temporalClientConnection,
  namespace: config.TEMPORAL_NAMESPACE
});

const orchestratorWorker = await Worker.create({
  connection,
  namespace: config.TEMPORAL_NAMESPACE,
  taskQueue: 'kovi-orchestrator',
  workflowsPath,
  activities,
  maxConcurrentActivityTaskExecutions: config.WORKER_CONCURRENCY,
  maxConcurrentWorkflowTaskExecutions: Math.max(4, Math.floor(config.WORKER_CONCURRENCY / 2))
});

const staticFetchWorker = await Worker.create({
  connection,
  namespace: config.TEMPORAL_NAMESPACE,
  taskQueue: 'kovi-static-fetch',
  activities: {
    executePageTask: activities.executePageTask
  },
  maxConcurrentActivityTaskExecutions: config.ORCH_STATIC_WORKER_CONCURRENCY
});

const browserFetchWorker = await Worker.create({
  connection,
  namespace: config.TEMPORAL_NAMESPACE,
  taskQueue: 'kovi-browser-fetch',
  activities: {
    executePageTask: activities.executePageTask
  },
  maxConcurrentActivityTaskExecutions: config.ORCH_BROWSER_WORKER_CONCURRENCY
});

try {
  await temporalClient.workflow.start(coordinatorWorkflow, {
    taskQueue: 'kovi-orchestrator',
    workflowId: 'kovi-coordinator',
    args: [
      {
        reconcileSeconds: config.ORCH_SCHEDULE_RECONCILE_SECONDS
      }
    ]
  });
  logger.info('Coordinator workflow started');
} catch (error) {
  logger.info({ error }, 'Coordinator workflow already running or start failed safely');
}

const shutdown = async (): Promise<void> => {
  logger.info('Graceful shutdown requested for orchestrator workers');
  await Promise.all([
    orchestratorWorker.shutdown(),
    staticFetchWorker.shutdown(),
    browserFetchWorker.shutdown()
  ]);
  await temporalClientConnection.close();
  await connection.close();
};

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});

logger.info(
  {
    temporalAddress: config.TEMPORAL_ADDRESS,
    orchestratorConcurrency: config.WORKER_CONCURRENCY,
    staticConcurrency: config.ORCH_STATIC_WORKER_CONCURRENCY,
    browserConcurrency: config.ORCH_BROWSER_WORKER_CONCURRENCY
  },
  'Temporal orchestrator workers started'
);

await Promise.all([orchestratorWorker.run(), staticFetchWorker.run(), browserFetchWorker.run()]);
