export interface NormalizationOptions {
  trimStrings?: boolean;
  lowercaseKeys?: boolean;
  nullifyEmpty?: boolean;
  preserveKeys?: string[];
}

export const normalizeField = (value: unknown, options: NormalizationOptions = {}): unknown => {
  const { trimStrings = true, lowercaseKeys = false, nullifyEmpty = true, preserveKeys = [] } = options;

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    if (nullifyEmpty && value.trim() === '') {
      return null;
    }
    return trimStrings ? value.trim() : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeField(item, options)).filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const processedKey = lowercaseKeys ? key.toLowerCase() : key;
      const processedVal = preserveKeys.includes(key) ? val : normalizeField(val, options);
      if (processedVal !== undefined) {
        normalized[processedKey] = processedVal;
      }
    }
    return normalized;
  }

  return value;
};

export const normalizeEntity = (
  data: Record<string, unknown>,
  options: NormalizationOptions = {}
): Record<string, unknown> => {
  return normalizeField(data, options) as Record<string, unknown>;
};

export const buildCanonicalUrl = (baseUrl: string, path: string, params?: Record<string, string>): string => {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
};

export const extractDomain = (urlString: string): string | null => {
  try {
    return new URL(urlString).hostname;
  } catch {
    return null;
  }
};

export const isSameDomain = (url1: string, url2: string): boolean => {
  try {
    return new URL(url1).hostname === new URL(url2).hostname;
  } catch {
    return false;
  }
};

export const normalizeUrl = (url: string, base?: string): string => {
  try {
    const parsed = new URL(url, base);
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return url;
  }
};