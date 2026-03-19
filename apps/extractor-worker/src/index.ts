import { loadWorkerConfig } from '@kovi/config';
import { KoviDatabase } from '@kovi/db';
import {
  checkDestinationHealth,
  ConsoleEventPublisher,
  createNatsPublisher,
  createRedisPublisher,
  DestinationRegistry,
  EventBusDestinationPlugin,
  PostgresExportDestinationPlugin,
  QueueDestinationPlugin,
  S3BundleDestinationPlugin,
  SignedJsonBundleDestinationPlugin,
  AnalyticsSinkDestinationPlugin,
  WebhookDestinationPlugin,
  WebhookDispatcher
} from '@kovi/events';
import { bootstrapOtel, shutdownOtel } from '@kovi/observability';
import { createLogger } from '@kovi/shared';
import {
  createDecryptor,
  createEncryptor,
  EnvironmentSecretProvider,
  headerTokenStrategy,
  manualCookieStrategy,
  playwrightFormLoginStrategy,
  SessionManager
} from '@kovi/source-sdk';
import { runSourceExtraction } from './crawler.js';

const config = loadWorkerConfig();

await bootstrapOtel({
  serviceName: 'extractor-worker',
  serviceVersion: config.OTEL_SERVICE_VERSION,
  endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  enabled: config.OTEL_ENABLED
});

const logger = createLogger({
  service: 'extractor-worker',
  env: config.NODE_ENV,
  version: config.OTEL_SERVICE_VERSION
});

const db = new KoviDatabase(config.DATABASE_URL);
const publisher =
  config.EVENT_BUS_BACKEND === 'redis-streams'
    ? await createRedisPublisher(config.REDIS_URL, config.REDIS_STREAM_KEY)
    : config.NATS_URL
      ? await createNatsPublisher(config.NATS_URL)
      : new ConsoleEventPublisher();
const webhookDispatcher = new WebhookDispatcher();
const secretProvider = new EnvironmentSecretProvider();
const destinationRegistry = new DestinationRegistry();
destinationRegistry.register(new WebhookDestinationPlugin());
destinationRegistry.register(new EventBusDestinationPlugin(publisher));
destinationRegistry.register(new QueueDestinationPlugin(publisher));
destinationRegistry.register(new PostgresExportDestinationPlugin(db));
destinationRegistry.register(new S3BundleDestinationPlugin());
destinationRegistry.register(new SignedJsonBundleDestinationPlugin());
destinationRegistry.register(new AnalyticsSinkDestinationPlugin());

const sessionManager = new SessionManager({
  repository: db,
  secretProvider,
  encrypt: createEncryptor(config.SESSION_ENCRYPTION_KEY),
  decrypt: createDecryptor(config.SESSION_ENCRYPTION_KEY),
  strategies: {
    none: undefined,
    'manual-cookie-import': manualCookieStrategy,
    'playwright-form-login': playwrightFormLoginStrategy,
    'header-token-injection': headerTokenStrategy
  }
});

try {
  const sources = await db.getActiveSources();
  logger.info({ sources: sources.length }, 'Starting extraction cycle');

  const tenantIds = Array.from(new Set(sources.map((source) => source.tenant_id)));
  for (const tenantId of tenantIds) {
    const destinations = await db.listDestinations(tenantId, true).catch(() => []);
    for (const destination of destinations) {
      try {
        const health = await checkDestinationHealth(
          {
            db,
            registry: destinationRegistry,
            secretProvider
          },
          destination
        );
        logger.info({ destinationId: destination.id, ok: health.ok }, 'Destination health check completed');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ destinationId: destination.id, error: message }, 'Destination health check failed');
      }
    }
  }

  for (const source of sources) {
    await runSourceExtraction(
      {
        db,
        publisher,
        webhookDispatcher,
        destinationDispatchDeps: {
          db,
          registry: destinationRegistry,
          secretProvider
        },
        logger,
        sessionManager
      },
      source
    );
  }
} finally {
  await publisher.close();
  await db.close();
  await shutdownOtel();
}
