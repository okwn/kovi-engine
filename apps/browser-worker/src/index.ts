import { loadWorkerConfig } from '@kovi/config';
import { bootstrapOtel, shutdownOtel } from '@kovi/observability';
import { createLogger, sleep } from '@kovi/shared';
import { chromium } from 'playwright';

const config = loadWorkerConfig();

await bootstrapOtel({
  serviceName: 'browser-worker',
  serviceVersion: config.OTEL_SERVICE_VERSION,
  endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  enabled: config.OTEL_ENABLED
});

const logger = createLogger({ service: 'browser-worker', env: config.NODE_ENV });

const run = async (): Promise<void> => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('about:blank');
  logger.info('Browser worker bootstrapped');
  await page.close();
  await context.close();
  await browser.close();
};

try {
  await run();
} catch (error) {
  logger.error({ error }, 'Browser worker startup failed');
} finally {
  await sleep(200);
  await shutdownOtel();
}
