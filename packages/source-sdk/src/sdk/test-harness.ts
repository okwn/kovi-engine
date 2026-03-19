import type { NormalizedEntity, PageType, SourceAdapter, SourceDefinition } from '../contracts.js';

export interface AdapterTestHarnessOptions {
  source: SourceDefinition;
  html: string;
  url: string;
  depth?: number;
}

export interface AdapterTestResult {
  pageType: PageType;
  entities: NormalizedEntity[];
  errors: string[];
}

export interface AdapterTestHarness {
  classify: () => PageType;
  extract: (pageType: Exclude<PageType, 'unknown'>) => AdapterTestResult;
  normalize: (entity: NormalizedEntity) => NormalizedEntity;
  shouldFollow: (nextUrl: string, currentDepth: number) => boolean;
  validate: () => { valid: boolean; errors: string[] };
}

export const createTestHarness = (
  adapter: SourceAdapter,
  options: AdapterTestHarnessOptions
): AdapterTestHarness => {
  const { source, html, url, depth = 0 } = options;

  const context = { source, url, depth, html };

  return {
    classify: (): PageType => adapter.classifyPage(context),

    extract: (pageType: Exclude<PageType, 'unknown'>): AdapterTestResult => {
      try {
        const entities = adapter.extract(context, pageType);
        return { pageType, entities, errors: [] };
      } catch (err) {
        return { pageType, entities: [], errors: [String(err)] };
      }
    },

    normalize: (entity: NormalizedEntity): NormalizedEntity => adapter.normalize(entity, source),

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