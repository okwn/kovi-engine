import { createHash } from 'node:crypto';
import type { NormalizedEntity, SourceDefinition } from './contracts.js';

const stableObject = (input: unknown): unknown => {
  if (Array.isArray(input)) {
    return input.map(stableObject);
  }
  if (input && typeof input === 'object') {
    const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([k, v]) => [k, stableObject(v)]));
  }
  return input;
};

export const normalizeEntity = (entity: NormalizedEntity, source: SourceDefinition): NormalizedEntity => {
  const ignored = new Set(source.changeDetection.ignoredFields);
  const filtered = Object.fromEntries(
    Object.entries(entity.canonicalData).filter(([key]) => !ignored.has(key))
  );

  return {
    ...entity,
    canonicalData: stableObject(filtered) as Record<string, unknown>
  };
};

export const computeContentHash = (entity: NormalizedEntity): string =>
  createHash('sha256').update(JSON.stringify(entity.canonicalData)).digest('hex');
