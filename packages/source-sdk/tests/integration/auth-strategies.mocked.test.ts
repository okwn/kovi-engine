import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  pageGoto: vi.fn(async () => undefined),
  pageFill: vi.fn(async () => undefined),
  pageClick: vi.fn(async () => undefined),
  pageWaitForSelector: vi.fn(async () => undefined)
}));

vi.mock('playwright', () => {
  const page = {
    goto: mockState.pageGoto,
    fill: mockState.pageFill,
    click: mockState.pageClick,
    waitForSelector: mockState.pageWaitForSelector
  };
  const context = {
    newPage: vi.fn(async () => page),
    storageState: vi.fn(async () => ({
      cookies: [{ name: 'session', value: 'cookie-value', domain: 'fixture.local', path: '/' }],
      origins: []
    })),
    close: vi.fn(async () => undefined)
  };
  const browser = {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => undefined)
  };

  return {
    chromium: {
      launch: vi.fn(async () => browser)
    }
  };
});

import { headerTokenStrategy, playwrightFormLoginStrategy } from '../../src/auth/strategies.js';
import type { SourceDefinition } from '../../src/contracts.js';

const secretProvider = {
  getSecret: vi.fn(async (ref: string) => (ref.includes('username') ? 'u1' : ref.includes('password') ? 'p1' : 'token-1'))
};

const source = (auth: SourceDefinition['authentication']): SourceDefinition => ({
  id: 'src-auth',
  name: 'Auth Fixture',
  adapterType: 'auth-dashboard',
  baseUrl: 'https://fixture.local',
  crawlEntrypoints: ['https://fixture.local/start'],
  allowedDomains: ['fixture.local'],
  internalLinkPatterns: ['https://fixture.local/*'],
  extractionSelectors: { listing: [], detail: [] },
  pagination: { mode: 'none' },
  authentication: auth,
  scheduleInterval: '5m',
  changeDetection: { ignoredFields: [], logicalDeleteAfterMisses: 1 },
  exportPolicy: { subject: 'kovi.auth', includeRawMetadata: false },
  maxDepth: 1,
  fetchMode: 'js',
  aiFallbackEnabled: false
});

describe('mocked auth flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds token headers via header strategy', async () => {
    const result = await headerTokenStrategy.bootstrap({
      source: source({
        type: 'header-token-injection',
        headerName: 'Authorization',
        tokenSecretRef: 'token',
        prefix: 'Bearer',
        renewalSeconds: 60
      }),
      secretProvider,
      existingPayload: null
    });

    expect(result.payload.headers.Authorization).toBe('Bearer token-1');
  });

  it('bootstraps playwright login with mocked browser flow', async () => {
    const result = await playwrightFormLoginStrategy.bootstrap({
      source: source({
        type: 'playwright-form-login',
        loginUrl: 'https://fixture.local/login',
        usernameSelector: '#username',
        passwordSelector: '#password',
        submitSelector: '#submit',
        successSelector: '#success',
        usernameSecretRef: 'fixture-username',
        passwordSecretRef: 'fixture-password',
        renewalSeconds: 60
      }),
      secretProvider,
      existingPayload: null
    });

    expect(result.payload.cookies.length).toBeGreaterThan(0);
    expect(mockState.pageGoto).toHaveBeenCalledTimes(1);
    expect(mockState.pageFill).toHaveBeenCalledTimes(2);
    expect(mockState.pageClick).toHaveBeenCalledTimes(1);
    expect(mockState.pageWaitForSelector).toHaveBeenCalledTimes(1);
  });
});
