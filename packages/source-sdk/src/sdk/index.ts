export * from './normalization-helpers.js';
export * from './extraction-helpers.js';
export * from './pagination-helpers.js';
export * from './identity-helpers.js';
export * from './selector-helpers.js';

import type { NormalizedEntity, PageType, SourceAdapter, SourceDefinition } from '../contracts.js';

export interface AdapterBuilderContext {
  source: SourceDefinition;
}

export type AdapterFactory = (context: AdapterBuilderContext) => SourceAdapter;

export interface AdapterTestHarnessOptions {
  source: SourceDefinition;
  html: string;
  url: string;
}

export interface AdapterTestHarness {
  classify: () => PageType;
  extract: (pageType: Exclude<PageType, 'unknown'>) => NormalizedEntity[];
  normalize: (entity: NormalizedEntity) => NormalizedEntity;
}

export const createAdapterTestHarness = (
  adapter: SourceAdapter,
  options: AdapterTestHarnessOptions
): AdapterTestHarness => {
  const { source, html, url } = options;
  return {
    classify: () => adapter.classifyPage({ source, url, depth: 0, html }),
    extract: (pageType: Exclude<PageType, 'unknown'>) =>
      adapter.extract({ source, url, depth: 0, html }, pageType),
    normalize: (entity: NormalizedEntity) => adapter.normalize(entity, source)
  };
};