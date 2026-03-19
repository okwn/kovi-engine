import type { ChangeSet, FieldChange } from './envelope.js';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const keysOf = (value: Record<string, unknown>): string[] => Object.keys(value).sort((a, b) => a.localeCompare(b));

const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export const diffFields = (
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): FieldChange[] => {
  const prev = before ?? {};
  const allKeys = Array.from(new Set([...keysOf(prev), ...keysOf(after)])).sort((a, b) => a.localeCompare(b));

  const changes: FieldChange[] = [];
  for (const key of allKeys) {
    const prevValue = prev[key];
    const nextValue = after[key];
    if (!equal(prevValue, nextValue)) {
      changes.push({
        field: key,
        before: prevValue,
        after: nextValue
      });
    }
  }
  return changes;
};

export const buildChangeSet = (input: {
  previousPageHash: string | null;
  currentPageHash: string;
  previousEntity: Record<string, unknown> | null;
  currentEntity: Record<string, unknown>;
}): ChangeSet => {
  const pageChanged = input.previousPageHash !== null && input.previousPageHash !== input.currentPageHash;
  const fieldChanges = diffFields(input.previousEntity, input.currentEntity);
  const entityChanged = fieldChanges.length > 0;

  return {
    pageChanged,
    entityChanged,
    fieldChanges
  };
};

export const stableNormalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }

  if (isObject(value)) {
    return Object.fromEntries(keysOf(value).map((key) => [key, stableNormalize(value[key])]));
  }

  return value;
};
