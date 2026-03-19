export * from './normalization-helpers.js';
export * from './extraction-helpers.js';
export * from './pagination-helpers.js';
export * from './identity-helpers.js';
export * from './selector-helpers.js';

import type { SourceAdapter, SourceDefinition } from '../contracts.js';
import type { NormalizationOptions } from './normalization-helpers.js';
import type { SelectorDefinition } from './selector-helpers.js';

export interface AdapterBuilderContext {
  source: SourceDefinition;
}

export type AdapterFactory = (context: AdapterBuilderContext) => SourceAdapter;

export interface AdapterTestHarnessOptions {
  source: SourceDefinition;
  html: string;
  url: string;
}

export const createAdapterTestHarness = <T extends SourceAdapter>(
  adapter: T,
  options: AdapterTestHarnessOptions
) => {
  const { source, html, url } = options;
  return {
    classify: () => adapter.classifyPage({ source, url, depth: 0, html }),
    extract: (pageType: 'listing' | 'detail') => adapter.extract({ source, url, depth: 0, html }, pageType),
    normalize: (entity: ReturnType<typeof adapter.extract>[0]) => adapter.normalize(entity, source)
  };
};