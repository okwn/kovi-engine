import type { SourceAdapter, SourceDefinition } from '@kovi/source-sdk';

export interface AdapterFixture {
  name: string;
  url: string;
  depth: number;
  html: string;
  expectedPageType: 'listing' | 'detail' | 'unknown';
  minEntities?: number;
}

export const createMockSourceDefinition = (overrides: Partial<SourceDefinition>): SourceDefinition => ({
  id: overrides.id ?? 'source-test',
  name: overrides.name ?? 'Adapter Test Source',
  adapterType: overrides.adapterType ?? 'custom-adapter',
  baseUrl: overrides.baseUrl ?? 'https://example.local',
  crawlEntrypoints: overrides.crawlEntrypoints ?? ['https://example.local/start'],
  allowedDomains: overrides.allowedDomains ?? ['example.local'],
  internalLinkPatterns: overrides.internalLinkPatterns ?? ['https://example.local/*'],
  extractionSelectors: overrides.extractionSelectors ?? { listing: [], detail: [] },
  pagination: overrides.pagination ?? { mode: 'none' },
  authentication: overrides.authentication ?? { type: 'none' },
  scheduleInterval: overrides.scheduleInterval ?? 'PT15M',
  changeDetection: overrides.changeDetection ?? { ignoredFields: [], logicalDeleteAfterMisses: 3 },
  exportPolicy: overrides.exportPolicy ?? { subject: 'kovi.source.test.changed', includeRawMetadata: false },
  maxDepth: overrides.maxDepth ?? 2,
  fetchMode: overrides.fetchMode ?? 'static',
  aiFallbackEnabled: overrides.aiFallbackEnabled ?? false
});

export const runAdapterFixtureSuite = (input: {
  adapter: SourceAdapter;
  source: SourceDefinition;
  fixtures: AdapterFixture[];
}): Array<{
  fixture: string;
  pageType: string;
  entities: number;
}> => {
  input.adapter.validateDefinition(input.source);

  return input.fixtures.map((fixture) => {
    const pageType = input.adapter.classifyPage({
      source: input.source,
      url: fixture.url,
      depth: fixture.depth,
      html: fixture.html
    });

    if (pageType !== fixture.expectedPageType) {
      throw new Error(`fixture ${fixture.name} expected page type ${fixture.expectedPageType} but got ${pageType}`);
    }

    const entities = pageType === 'unknown'
      ? []
      : input.adapter.extract(
          {
            source: input.source,
            url: fixture.url,
            depth: fixture.depth,
            html: fixture.html
          },
          pageType
        );

    if ((fixture.minEntities ?? 0) > entities.length) {
      throw new Error(`fixture ${fixture.name} expected at least ${fixture.minEntities} entities but got ${entities.length}`);
    }

    return {
      fixture: fixture.name,
      pageType,
      entities: entities.length
    };
  });
};
