import { canonicalizeUrl, normalizeEntity, type NormalizedEntity, type SelectorRule, type SourceDefinition } from '@kovi/source-sdk';

export const normalizeCanonicalUrl = (url: string): string => canonicalizeUrl(url);

export const buildEntityIdentity = (input: {
  sourceId: string;
  canonicalUrl: string;
  preferredKeys?: string[];
  entity: Record<string, unknown>;
}): string => {
  const preferred = input.preferredKeys ?? ['id', 'sku', 'slug', 'recordKey'];
  for (const key of preferred) {
    const value = input.entity[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return `${input.sourceId}:${key}:${value.trim()}`;
    }
  }
  return `${input.sourceId}:url:${input.canonicalUrl}`;
};

export const normalizeFieldValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFieldValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeFieldValue(item)]));
  }
  return value;
};

export const applySelectorRules = (
  html: string,
  selectors: SelectorRule[],
  extractor: (htmlInput: string, selector: SelectorRule) => unknown
): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  for (const selector of selectors) {
    const value = extractor(html, selector);
    if (selector.required && (value === null || value === undefined || value === '')) {
      throw new Error(`required selector failed for key ${selector.key}`);
    }
    output[selector.key] = normalizeFieldValue(value);
  }
  return output;
};

export const normalizeAdapterEntity = (entity: NormalizedEntity, source: SourceDefinition): NormalizedEntity =>
  normalizeEntity(entity, source);

export const paginateByNextLink = (input: {
  currentDepth: number;
  maxDepth: number;
  links: string[];
  isAllowed: (url: string) => boolean;
}): string[] => {
  if (input.currentDepth >= input.maxDepth) {
    return [];
  }
  return input.links.filter((url) => input.isAllowed(url));
};
