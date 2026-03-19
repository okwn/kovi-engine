import { createHash } from 'node:crypto';

export interface IdentityOptions {
  prefix?: string;
  normalize?: boolean;
  sourceId: string;
}

export const buildEntityIdentity = (
  recordKey: string,
  options: IdentityOptions
): string => {
  const normalized = options.normalize ? recordKey.toLowerCase().trim() : recordKey;
  const raw = `${options.sourceId}:${normalized}`;
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return options.prefix ? `${options.prefix}-${hash}` : hash;
};

export const buildRecordKey = (
  data: Record<string, unknown>,
  keyFields: string[],
  fallback?: string
): string => {
  for (const field of keyFields) {
    const value = data[field];
    if (value && typeof value === 'string') {
      return value.trim();
    }
  }
  if (fallback && data[fallback]) {
    return String(data[fallback]);
  }
  throw new Error(`cannot build record key: no matching fields ${keyFields.join(', ')}`);
};

export const buildCanonicalKey = (
  url: string,
  options: { stripQuery?: boolean; stripHash?: boolean } = {}
): string => {
  try {
    const parsed = new URL(url);
    if (options.stripHash) parsed.hash = '';
    if (options.stripQuery) parsed.search = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return url;
  }
};

export const contentHash = (data: unknown): string => {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
};