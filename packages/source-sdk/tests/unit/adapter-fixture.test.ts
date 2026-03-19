import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { StaticCatalogAdapter } from '../../src/adapters/static-catalog.adapter.js';
import { JsListingDetailAdapter } from '../../src/adapters/js-listing-detail.adapter.js';
import type { SourceDefinition } from '../../src/contracts.js';

const fixture = (name: string): string =>
  readFileSync(join(process.cwd(), 'tests', 'fixtures', 'websites', name), 'utf8');

const baseSource = (overrides: Partial<SourceDefinition> = {}): SourceDefinition => ({
  id: 'tenant-a-source-1',
  name: 'Fixture Source',
  adapterType: 'static-catalog',
  baseUrl: 'https://fixture.local',
  crawlEntrypoints: ['https://fixture.local/listing'],
  allowedDomains: ['fixture.local'],
  internalLinkPatterns: ['https://fixture.local/*'],
  extractionSelectors: {
    listing: [
      { key: 'title', selector: '.title', required: true },
      { key: 'id', selector: '.sku', required: true }
    ],
    detail: [
      { key: 'name', selector: '.name', required: true },
      { key: 'id', selector: '.id', required: true }
    ]
  },
  pagination: { mode: 'none' },
  authentication: { type: 'none' },
  scheduleInterval: '5m',
  changeDetection: { ignoredFields: [], logicalDeleteAfterMisses: 2 },
  exportPolicy: { subject: 'kovi.fixture', includeRawMetadata: false },
  maxDepth: 2,
  fetchMode: 'static',
  aiFallbackEnabled: false,
  ...overrides
});

describe('fixture adapters', () => {
  it('extracts fixture listing via static adapter', () => {
    const adapter = new StaticCatalogAdapter();
    const source = baseSource();
    const html = fixture('listing.html');

    const pageType = adapter.classifyPage({ source, url: source.crawlEntrypoints[0], depth: 0, html });
    expect(pageType).toBe('listing');

    const entities = adapter.extract({ source, url: source.crawlEntrypoints[0], depth: 0, html }, 'listing');
    expect(entities).toHaveLength(1);
    expect(entities[0]?.recordKey).toBe('fixture-001');
  });

  it('extracts detail fixture via js adapter', () => {
    const adapter = new JsListingDetailAdapter();
    const source = baseSource({ adapterType: 'js-listing-detail', fetchMode: 'js' });
    const html = '<div data-detail-root="1">' + fixture('detail.html') + '</div>';

    const pageType = adapter.classifyPage({ source, url: 'https://fixture.local/detail/fixture-001', depth: 0, html });
    expect(pageType).toBe('detail');

    const entities = adapter.extract(
      { source, url: 'https://fixture.local/detail/fixture-001', depth: 0, html },
      'detail'
    );
    expect(entities[0]?.recordKey).toBe('fixture-001');
  });
});
