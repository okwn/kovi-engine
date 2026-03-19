export * from './normalization-helpers.js';
export * from './extraction-helpers.js';
export * from './pagination-helpers.js';
export * from './identity-helpers.js';
export * from './selector-helpers.js';

import type { SourceAdapter, SourceDefinition } from '../contracts.js';

export interface AdapterBuilderContext {
  source: SourceDefinition;
}

export type AdapterFactory = (context: AdapterBuilderContext) => SourceAdapter;

export interface AdapterTestHarnessOptions {
  source: SourceDefinition;
  html: string;
  url: string;
}

export interface AdapterTestHarness<T extends SourceAdapter> {
  classify: () => ReturnType<T['classifyPage']>;
  extract: (pageType: 'listing' | 'detail') => ReturnType<T['extract']>[0][];
  normalize: (entity: ReturnType<T['extract']>[0]) => ReturnType<T['normalize']>;
}

export const createAdapterTestHarness = <T extends SourceAdapter>(
  adapter: T,
  options: AdapterTestHarnessOptions
): AdapterTestHarness<T> => {
  const { source, html, url } = options;
  return {
    classify: () => adapter.classifyPage({ source, url, depth: 0, html }),
    extract: (pageType: 'listing' | 'detail') => adapter.extract({ source, url, depth: 0, html }, pageType),
    normalize: (entity: ReturnType<T['extract']>[0]) => adapter.normalize(entity, source)
  };
};