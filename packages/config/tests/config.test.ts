import { describe, expect, it } from 'vitest';
import { loadApiConfig } from '../src/index.js';

describe('config validation', () => {
  it('fails when DATABASE_URL is missing', () => {
    const previous = process.env.DATABASE_URL;
    const previousKey = process.env.SESSION_ENCRYPTION_KEY;

    delete process.env.DATABASE_URL;
    process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef';

    expect(() => loadApiConfig()).toThrow();

    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }

    if (previousKey === undefined) {
      delete process.env.SESSION_ENCRYPTION_KEY;
    } else {
      process.env.SESSION_ENCRYPTION_KEY = previousKey;
    }
  });
});
