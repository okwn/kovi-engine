import { chromium } from 'playwright';
import type { AuthStrategyHandler, SessionPayload } from './types.js';

const emptyPayload = (mode: SessionPayload['mode']): SessionPayload => ({
  mode,
  headers: {},
  cookies: [],
  origins: [],
  metadata: {}
});

export const manualCookieStrategy: AuthStrategyHandler = {
  mode: 'manual-cookie-import',
  async bootstrap({ source, existingPayload }) {
    if (source.authentication.type !== 'manual-cookie-import') {
      throw new Error('invalid auth mode for manual cookie strategy');
    }
    if (!existingPayload) {
      throw new Error('manual-cookie-import requires operator-provided cookie import');
    }
    const expiresAt = new Date(Date.now() + source.authentication.renewalSeconds * 1000);
    return { payload: existingPayload, expiresAt };
  },
  async validate({ expiresAt }) {
    if (!expiresAt) {
      return { valid: false, reason: 'missing expiry for manual cookie session' };
    }
    if (expiresAt.getTime() <= Date.now()) {
      return { valid: false, reason: 'manual cookie session expired' };
    }
    return { valid: true };
  }
};

export const headerTokenStrategy: AuthStrategyHandler = {
  mode: 'header-token-injection',
  async bootstrap({ source, secretProvider }) {
    if (source.authentication.type !== 'header-token-injection') {
      throw new Error('invalid auth mode for header token strategy');
    }

    const token = await secretProvider.getSecret(source.authentication.tokenSecretRef);
    const value = source.authentication.prefix ? `${source.authentication.prefix} ${token}` : token;
    const payload: SessionPayload = {
      ...emptyPayload('header-token-injection'),
      headers: {
        [source.authentication.headerName]: value
      }
    };

    const expiresAt = new Date(Date.now() + source.authentication.renewalSeconds * 1000);
    return { payload, expiresAt };
  },
  async validate({ payload, expiresAt }) {
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      return { valid: false, reason: 'header token session expired' };
    }
    if (Object.keys(payload.headers).length === 0) {
      return { valid: false, reason: 'header token missing from session payload' };
    }
    return { valid: true };
  }
};

export const playwrightFormLoginStrategy: AuthStrategyHandler = {
  mode: 'playwright-form-login',
  async bootstrap({ source, secretProvider }) {
    if (source.authentication.type !== 'playwright-form-login') {
      throw new Error('invalid auth mode for playwright login strategy');
    }

    const username = await secretProvider.getSecret(source.authentication.usernameSecretRef);
    const password = await secretProvider.getSecret(source.authentication.passwordSecretRef);

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(source.authentication.loginUrl, { waitUntil: 'domcontentloaded' });
      await page.fill(source.authentication.usernameSelector, username);
      await page.fill(source.authentication.passwordSelector, password);
      await page.click(source.authentication.submitSelector);
      await page.waitForSelector(source.authentication.successSelector, { timeout: 15000 });

      const storageState = await context.storageState();
      const payload: SessionPayload = {
        ...emptyPayload('playwright-form-login'),
        cookies: storageState.cookies,
        origins: storageState.origins
      };

      const expiresAt = new Date(Date.now() + source.authentication.renewalSeconds * 1000);
      await context.close();
      return { payload, expiresAt };
    } finally {
      await browser.close();
    }
  },
  async validate({ payload, expiresAt }) {
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      return { valid: false, reason: 'playwright session expired' };
    }
    if (payload.cookies.length === 0) {
      return { valid: false, reason: 'playwright session has no cookies' };
    }
    return { valid: true };
  }
};
