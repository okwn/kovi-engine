import { vi } from 'vitest';

export interface MockPlaywrightContext {
  pageGoto: ReturnType<typeof vi.fn>;
  pageFill: ReturnType<typeof vi.fn>;
  pageClick: ReturnType<typeof vi.fn>;
  pageWaitForSelector: ReturnType<typeof vi.fn>;
  storageState: ReturnType<typeof vi.fn>;
  contextClose: ReturnType<typeof vi.fn>;
  browserClose: ReturnType<typeof vi.fn>;
}

export const createMockPlaywrightAuth = (): {
  chromium: { launch: ReturnType<typeof vi.fn> };
  ctx: MockPlaywrightContext;
} => {
  const pageGoto = vi.fn(async () => undefined);
  const pageFill = vi.fn(async () => undefined);
  const pageClick = vi.fn(async () => undefined);
  const pageWaitForSelector = vi.fn(async () => undefined);
  const storageState = vi.fn(async () => ({
    cookies: [{ name: 'session', value: 'cookie-value', domain: 'fixture.local', path: '/' }],
    origins: []
  }));
  const contextClose = vi.fn(async () => undefined);
  const browserClose = vi.fn(async () => undefined);

  const page = {
    goto: pageGoto,
    fill: pageFill,
    click: pageClick,
    waitForSelector: pageWaitForSelector
  };

  const context = {
    newPage: vi.fn(async () => page),
    storageState,
    close: contextClose
  };

  const browser = {
    newContext: vi.fn(async () => context),
    close: browserClose
  };

  const chromium = {
    launch: vi.fn(async () => browser)
  };

  return {
    chromium,
    ctx: {
      pageGoto,
      pageFill,
      pageClick,
      pageWaitForSelector,
      storageState,
      contextClose,
      browserClose
    }
  };
};
