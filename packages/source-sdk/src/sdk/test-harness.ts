import type { SourceAdapter, SourceDefinition } from '../contracts.js';

export interface AdapterTestHarnessOptions {
  source: SourceDefinition;
  html: string;
  url: string;
  depth?: number;
}

export interface AdapterTestResult<T> {
  pageType: string;
  entities: T[];
  errors: string[];
}

export interface AdapterTestHarness<TAdapter extends SourceAdapter> {
  classify: () => string;
  extract: (pageType: 'listing' | 'detail') => AdapterTestResult<ReturnType<TAdapter['extract']>[0]>;
  normalize: (entity: ReturnType<TAdapter['extract']>[0]) => ReturnType<TAdapter['normalize']>;
  shouldFollow: (nextUrl: string, currentDepth: number) => boolean;
  validate: () => { valid: boolean; errors: string[] };
}

export const createTestHarness = <TAdapter extends SourceAdapter>(
  adapter: TAdapter,
  options: AdapterTestHarnessOptions
): AdapterTestHarness<TAdapter> => {
  const { source, html, url, depth = 0 } = options;

  const context = { source, url, depth, html };

  return {
    classify: (): string => adapter.classifyPage(context),

    extract: (pageType: 'listing' | 'detail'): AdapterTestResult<ReturnType<TAdapter['extract']>[0]> => {
      try {
        const entities = adapter.extract(context, pageType);
        return { pageType, entities, errors: [] };
      } catch (err) {
        return { pageType, entities: [], errors: [String(err)] };
      }
    },

    normalize: (entity: ReturnType<TAdapter['extract']>[0]): ReturnType<TAdapter['normalize']> =>
      adapter.normalize(entity, source),

    shouldFollow: (nextUrl: string, currentDepth: number): boolean =>
      adapter.shouldFollowLink(url, nextUrl, currentDepth, source),

    validate: (): { valid: boolean; errors: string[] } => {
      try {
        adapter.validateDefinition(source);
        return { valid: true, errors: [] };
      } catch (err) {
        return { valid: false, errors: [String(err)] };
      }
    }
  };
};

export interface MockPageOptions {
  html: string;
  url: string;
  statusCode?: number;
  contentType?: string;
}

export interface MockPage {
  html: string;
  url: string;
  statusCode: number;
  contentType: string;
  fetchedAt: string;
}

export const createMockPage = (options: MockPageOptions): MockPage => ({
  html: options.html,
  url: options.url,
  statusCode: options.statusCode ?? 200,
  contentType: options.contentType ?? 'text/html',
  fetchedAt: new Date().toISOString()
});

export const createMockSource = (
  partial: Partial<SourceDefinition> = {}
): SourceDefinition => ({
  id: 'test-source-id',
  name: 'Test Source',
  adapterType: 'test-adapter',
  baseUrl: 'https://example.com',
  crawlEntrypoints: ['/'],
  allowedDomains: ['example.com'],
  internalLinkPatterns: ['^https://example\\.com'],
  extractionSelectors: {
    listing: [],
    detail: []
  },
  pagination: { mode: 'none' },
  authentication: { type: 'none' },
  scheduleInterval: '0 * * * *',
  changeDetection: { ignoredFields: [], logicalDeleteAfterMisses: 3 },
  exportPolicy: { subject: 'test', includeRawMetadata: false },
  maxDepth: 2,
  fetchMode: 'static',
  aiFallbackEnabled: false,
  ...partial
});