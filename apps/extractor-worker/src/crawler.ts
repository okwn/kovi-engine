import { CheerioCrawler, PlaywrightCrawler, type RequestOptions } from 'crawlee';
import type { KoviDatabase, SourceRecord } from '@kovi/db';
import type { DestinationDispatchDeps, EventPublisher, WebhookDispatcher } from '@kovi/events';
import type { Page } from 'playwright';
import {
  buildVisitKey,
  canonicalizeUrl,
  computeRetryDelayMs,
  defaultRetryPolicy,
  evaluateSourcePolicy,
  hydrateSourceDefinition,
  type SessionPayload,
  shouldFollowInternalLink,
  type SourceDefinition
} from '@kovi/source-sdk';
import type { SessionManager } from '@kovi/source-sdk';
import { sleep } from '@kovi/shared';
import { getAdapter } from './adapter-registry.js';
import { DisabledAiFallback } from './ai-fallback.js';
import { processExtractedPage } from './pipeline.js';

interface LoggerLike {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

interface CrawlRunDeps {
  db: KoviDatabase;
  publisher: EventPublisher;
  webhookDispatcher: WebhookDispatcher;
  destinationDispatchDeps: DestinationDispatchDeps;
  logger: LoggerLike;
  sessionManager: SessionManager;
}

interface CrawlContext {
  source: SourceDefinition;
  tenantId: string;
  session: SessionPayload | null;
  runId: string;
  visited: Set<string>;
}

const toSourceDefinition = (record: SourceRecord): SourceDefinition => {
  return hydrateSourceDefinition({
    id: record.id,
    name: record.name,
    adapterType: record.adapter_type,
    configJson: record.config_json
  });
};

const makeRequest = (url: string, depth: number): RequestOptions => ({
  url,
  userData: { depth }
});

const applySessionHeadersAndCookies = async (page: Page, session: SessionPayload | null): Promise<void> => {
  if (!session) {
    return;
  }

  const headers = session.headers;
  if (Object.keys(headers).length > 0) {
    await page.setExtraHTTPHeaders(headers);
  }

  if (session.cookies.length > 0) {
    await page.context().addCookies(session.cookies);
  }
};

const applySessionOrigins = async (page: Page, session: SessionPayload | null): Promise<void> => {
  if (!session) {
    return;
  }

  const currentOrigin = new URL(page.url()).origin;
  for (const originState of session.origins) {
    if (originState.origin !== currentOrigin) {
      continue;
    }
    await page.evaluate((items) => {
      for (const item of items) {
        localStorage.setItem(item.name, item.value);
      }
    }, originState.localStorage);
  }
};

const cookieHeaderForUrl = (session: SessionPayload | null, targetUrl: string): string | null => {
  if (!session || session.cookies.length === 0) {
    return null;
  }

  const target = new URL(targetUrl);
  const nowEpochSec = Math.floor(Date.now() / 1000);
  const pairs = session.cookies
    .filter((cookie) => {
      const domainMatch = target.hostname === cookie.domain || target.hostname.endsWith(cookie.domain.replace(/^\./, ''));
      const pathMatch = target.pathname.startsWith(cookie.path);
      const notExpired = cookie.expires <= 0 || cookie.expires > nowEpochSec;
      return domainMatch && pathMatch && notExpired;
    })
    .map((cookie) => `${cookie.name}=${cookie.value}`);

  return pairs.length > 0 ? pairs.join('; ') : null;
};

const maybeEnqueueLink = async (
  enqueue: (requests: RequestOptions[]) => Promise<void>,
  crawl: CrawlContext,
  shouldFollow: boolean,
  link: string,
  depth: number
): Promise<void> => {
  if (!shouldFollow || !shouldFollowInternalLink(crawl.source, depth, link)) {
    return;
  }

  const key = buildVisitKey(link);
  if (crawl.visited.has(key)) {
    return;
  }

  crawl.visited.add(key);
  await enqueue([makeRequest(link, depth + 1)]);
};

const runStaticCrawler = async (deps: CrawlRunDeps, crawl: CrawlContext): Promise<void> => {
  const adapter = await getAdapter(crawl.source.adapterType);
  adapter.validateDefinition(crawl.source);

  const crawler = new CheerioCrawler({
    maxRequestRetries: defaultRetryPolicy.maxAttempts,
    preNavigationHooks: [
      ({ request }, gotOptions): void => {
        gotOptions.headers = {
          ...(gotOptions.headers ?? {}),
          ...(crawl.session?.headers ?? {})
        };

        const cookie = cookieHeaderForUrl(crawl.session, request.url);
        if (cookie) {
          gotOptions.headers = {
            ...(gotOptions.headers ?? {}),
            cookie
          };
        }
      }
    ],
    async requestHandler({ request, $, body, response, addRequests }): Promise<void> {
      const depth = Number(request.userData.depth ?? 0);
      const html = typeof body === 'string' ? body : body.toString();
      const statusCode = response?.statusCode ?? 200;

      await processExtractedPage({
        ...deps,
        tenantId: crawl.tenantId,
        source: crawl.source,
        adapter,
        runId: crawl.runId,
        aiFallback: new DisabledAiFallback(),
        url: request.loadedUrl ?? request.url,
        depth,
        html,
        statusCode
      });

      const links = $('a[href]')
        .toArray()
        .map((el) => $(el).attr('href'))
        .filter((link): link is string => Boolean(link))
        .map((link) => new URL(link, request.loadedUrl ?? request.url).toString())
        .map(canonicalizeUrl);

      for (const link of links) {
        const shouldFollow = adapter.shouldFollowLink(request.loadedUrl ?? request.url, link, depth, crawl.source);
        await maybeEnqueueLink(addRequests, crawl, shouldFollow, link, depth);
      }
    },
    failedRequestHandler({ request, error }): void {
      const message = error instanceof Error ? error.message : String(error);
      deps.logger.error({ sourceId: crawl.source.id, url: request.url, error: message }, 'Static crawl request failed');
    }
  });

  await crawler.run(crawl.source.crawlEntrypoints.map((entry) => makeRequest(entry, 0)));
};

const runJsCrawler = async (deps: CrawlRunDeps, crawl: CrawlContext): Promise<void> => {
  const adapter = await getAdapter(crawl.source.adapterType);
  adapter.validateDefinition(crawl.source);

  const crawler = new PlaywrightCrawler({
    maxRequestRetries: defaultRetryPolicy.maxAttempts,
    preNavigationHooks: [
      async ({ page }): Promise<void> => {
        await applySessionHeadersAndCookies(page, crawl.session);
      }
    ],
    async requestHandler({ request, page, response, addRequests }): Promise<void> {
      const depth = Number(request.userData.depth ?? 0);
      await applySessionOrigins(page, crawl.session);

      const html = await page.content();
      const statusCode = response?.status() ?? 200;

      await processExtractedPage({
        ...deps,
        tenantId: crawl.tenantId,
        source: crawl.source,
        adapter,
        runId: crawl.runId,
        aiFallback: new DisabledAiFallback(),
        url: page.url(),
        depth,
        html,
        statusCode
      });

      const links = await page.$$eval('a[href]', (nodes) =>
        nodes
          .map((node) => node.getAttribute('href'))
          .filter((href): href is string => Boolean(href))
      );

      for (const link of links) {
        const resolved = canonicalizeUrl(new URL(link, page.url()).toString());
        const shouldFollow = adapter.shouldFollowLink(page.url(), resolved, depth, crawl.source);
        await maybeEnqueueLink(addRequests, crawl, shouldFollow, resolved, depth);
      }
    },
    failedRequestHandler({ request, error }): void {
      const message = error instanceof Error ? error.message : String(error);
      deps.logger.error({ sourceId: crawl.source.id, url: request.url, error: message }, 'JS crawl request failed');
    }
  });

  await crawler.run(crawl.source.crawlEntrypoints.map((entry) => makeRequest(entry, 0)));
};

export const runSourceExtraction = async (deps: CrawlRunDeps, sourceRecord: SourceRecord): Promise<void> => {
  const source = toSourceDefinition(sourceRecord);
  const session = await deps.sessionManager.ensureValidSession(source);
  const policy = evaluateSourcePolicy({
    source: sourceRecord,
    hasValidSession: source.authentication.type === 'none' ? true : Boolean(session)
  });

  if (!policy.allowed) {
    await deps.db.insertAuditLog({
      tenantId: sourceRecord.tenant_id,
      actorType: 'system',
      actorId: 'policy-engine',
      action: 'policy.violation',
      targetType: 'source',
      targetId: source.id,
      details: {
        violations: policy.violations
      }
    });
    deps.logger.warn({ sourceId: source.id, violations: policy.violations }, 'Source execution blocked by policy');
    return;
  }

  const runId = await deps.db.createSourceRun(source.id);
  const visited = new Set<string>(source.crawlEntrypoints.map((url) => buildVisitKey(url)));

  const crawl: CrawlContext = {
    source,
    tenantId: sourceRecord.tenant_id,
    session,
    runId,
    visited
  };

  try {
    if (source.fetchMode === 'js') {
      await runJsCrawler(deps, crawl);
    } else {
      await runStaticCrawler(deps, crawl);
    }
    await deps.db.finalizeSourceRun(runId, 'success');
  } catch (error) {
    await deps.db.finalizeSourceRun(runId, 'failed');

    const message = error instanceof Error ? error.message : 'unknown extraction error';
    deps.logger.error({ sourceId: source.id, runId, error: message }, 'Source extraction failed');

    const delay = computeRetryDelayMs(1, defaultRetryPolicy);
    await sleep(delay);
    throw error;
  }
};
