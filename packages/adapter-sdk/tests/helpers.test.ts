import { describe, expect, it } from 'vitest';
import {
  applySelectorRules,
  buildEntityIdentity,
  normalizeAdapterEntity,
  normalizeCanonicalUrl,
  normalizeFieldValue,
  paginateByNextLink
} from '../src/helpers.js';
import type { NormalizedEntity, SelectorRule, SourceDefinition } from '@kovi/source-sdk';

describe('adapter-sdk helpers', () => {
  it('normalizes canonical URLs by removing fragments and cleaning trailing slashes', () => {
    const url = 'https://example.com/path/?q=1#section';
    const normalized = normalizeCanonicalUrl(url);
    // Current behavior: hash is stripped, leading to a normalized URL
    expect(normalized).toBe('https://example.com/path?q=1');
  });

  it('builds stable entity identity from preferred keys and falls back to URL', () => {
    const id = buildEntityIdentity({
      sourceId: 'source-1',
      canonicalUrl: 'https://example.com/item/42',
      preferredKeys: ['slug', 'id'],
      entity: { id: '42', name: 'Item 42' }
    });
    expect(id).toBe('source-1:id:42');

    const fallback = buildEntityIdentity({
      sourceId: 'source-1',
      canonicalUrl: 'https://example.com/item/42',
      entity: {}
    });
    expect(fallback).toBe('source-1:url:https://example.com/item/42');
  });

  it('normalizes field values recursively (strings, numbers, objects)', () => {
    const input = {
      name: '  Test  ',
      price: '10.50',
      tags: ['  a ', ' b'],
      nested: { value: ' 3 ' }
    };
    const normalized = normalizeFieldValue(input) as Record<string, unknown>;

    expect(normalized.name).toBe('Test');
    expect(normalized.price).toBe(10.5);
    expect(normalized.tags).toEqual(['a', 'b']);
    expect((normalized.nested as Record<string, unknown>).value).toBe(3);
  });

  it('applies selector rules and enforces required selectors', () => {
    const selectors: SelectorRule[] = [
      { key: 'title', selector: 'h1', required: true },
      { key: 'optional', selector: '.opt', required: false }
    ];

    const extractor = (html: string, rule: SelectorRule): unknown => {
      if (rule.selector === 'h1') return '  Title  ';
      return null;
    };

    const result = applySelectorRules('<h1>Title</h1>', selectors, extractor);
    expect(result.title).toBe('Title');
    expect(result.optional).toBeNull();

    const failingExtractor = (_html: string, _rule: SelectorRule): unknown => '';
    expect(() => applySelectorRules('<h1></h1>', selectors, failingExtractor)).toThrowError(
      /required selector failed for key title/
    );
  });

  it('paginates by next-link respecting max depth and allowed URLs', () => {
    const links = ['https://example.com/page/2', 'https://other.com/page/2'];
    const next = paginateByNextLink({
      currentDepth: 0,
      maxDepth: 2,
      links,
      isAllowed: (url) => url.includes('example.com')
    });
    expect(next).toEqual(['https://example.com/page/2']);

    const none = paginateByNextLink({
      currentDepth: 2,
      maxDepth: 2,
      links,
      isAllowed: () => true
    });
    expect(none).toEqual([]);
  });

  it('normalizes adapter entities via source-sdk normalization', () => {
    const entity: NormalizedEntity = {
      sourceId: 'source-1',
      recordKey: 'key',
      pageUrl: 'https://example.com',
      canonicalData: { name: 'Test' }
    };

    const source: SourceDefinition = {
      id: 'source-1',
      name: 'Test Source',
      adapterType: 'test-adapter',
      baseUrl: 'https://example.com',
      crawlEntrypoints: ['/'],
      allowedDomains: ['example.com'],
      internalLinkPatterns: ['^https://example\\.com'],
      extractionSelectors: { listing: [], detail: [] },
      pagination: { mode: 'none' },
      authentication: { type: 'none' },
      scheduleInterval: '0 * * * *',
      changeDetection: { ignoredFields: [], logicalDeleteAfterMisses: 3 },
      exportPolicy: { subject: 'test', includeRawMetadata: false },
      maxDepth: 2,
      fetchMode: 'static',
      aiFallbackEnabled: false
    };

    const normalized = normalizeAdapterEntity(entity, source);
    expect(normalized).toEqual(entity);
  });
});

