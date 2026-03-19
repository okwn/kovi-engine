import { describe, expect, it, vi } from 'vitest';
import type { SourceDefinition } from '../contracts.js';
import { SessionManager } from './session-manager.js';
import type { AuthStrategyHandler, SessionPayload, SessionRepository, SecretProvider } from './types.js';

const baseSource = (authentication: SourceDefinition['authentication']): SourceDefinition => ({
  id: 'source-1',
  name: 'Test Source',
  adapterType: 'static-catalog',
  baseUrl: 'https://example.local',
  crawlEntrypoints: ['https://example.local/start'],
  allowedDomains: ['example.local'],
  internalLinkPatterns: ['https://example.local/*'],
  extractionSelectors: { listing: [], detail: [] },
  pagination: { mode: 'none' },
  authentication,
  scheduleInterval: 'PT5M',
  changeDetection: { ignoredFields: [], logicalDeleteAfterMisses: 2 },
  exportPolicy: { subject: 'kovi.test', includeRawMetadata: false },
  maxDepth: 2,
  fetchMode: 'static',
  aiFallbackEnabled: false
});

const encrypt = (plain: string): Buffer => Buffer.from(plain, 'utf8');
const decrypt = (cipher: Buffer): string => cipher.toString('utf8');

const createRepo = (): SessionRepository => {
  let stored = new Map<string, { encrypted: Buffer; expiresAt: string | null; status: string; strategy: string }>();

  return {
    async getSessionBySource(sourceId) {
      const item = stored.get(sourceId);
      if (!item) {
        return null;
      }
      return {
        sourceId,
        strategy: item.strategy as SourceDefinition['authentication']['type'],
        encryptedState: item.encrypted,
        expiresAt: item.expiresAt,
        status: item.status as 'healthy' | 'expired' | 'invalid' | 'missing',
        lastValidatedAt: null,
        lastFailureReason: null,
        renewalPolicySeconds: 60
      };
    },
    async upsertSession(input) {
      stored.set(input.sourceId, {
        encrypted: input.encryptedState,
        expiresAt: input.expiresAt,
        status: input.status,
        strategy: input.strategy
      });
    },
    async updateSessionValidation(input) {
      const item = stored.get(input.sourceId);
      if (!item) {
        return;
      }
      item.status = input.status;
      if (input.expiresAt) {
        item.expiresAt = input.expiresAt;
      }
    },
    async listSessionHealth() {
      return [];
    },
    async markSourceDegraded() {
      return;
    },
    async markSourceHealthy() {
      return;
    },
    async createAlert() {
      return;
    },
    async insertAuditLog() {
      return;
    }
  };
};

const secretProvider: SecretProvider = {
  async getSecret() {
    return 'secret';
  }
};

describe('SessionManager', () => {
  it('renews an expired header-token session', async () => {
    const repo = createRepo();
    await repo.upsertSession({
      sourceId: 'source-1',
      strategy: 'header-token-injection',
      encryptedState: encrypt(
        JSON.stringify({ mode: 'header-token-injection', headers: {}, cookies: [], origins: [], metadata: {} })
      ),
      expiresAt: new Date(Date.now() - 30_000).toISOString(),
      status: 'expired',
      renewalPolicySeconds: 10
    });

    const strategy: AuthStrategyHandler = {
      mode: 'header-token-injection',
      async bootstrap() {
        return {
          payload: {
            mode: 'header-token-injection',
            headers: { Authorization: 'Bearer renewed' },
            cookies: [],
            origins: [],
            metadata: {}
          },
          expiresAt: new Date(Date.now() + 60_000)
        };
      },
      async validate() {
        return { valid: true };
      }
    };

    const manager = new SessionManager({
      repository: repo,
      secretProvider,
      encrypt,
      decrypt,
      strategies: {
        none: undefined,
        'manual-cookie-import': undefined,
        'playwright-form-login': undefined,
        'header-token-injection': strategy
      }
    });

    const session = await manager.ensureValidSession(
      baseSource({
        type: 'header-token-injection',
        headerName: 'Authorization',
        tokenSecretRef: 'token',
        prefix: 'Bearer',
        renewalSeconds: 10
      })
    );

    expect(session?.headers.Authorization).toBe('Bearer renewed');
  });

  it('marks source degraded when renewal fails', async () => {
    const repo = createRepo();
    const markSourceDegraded = vi.fn(async () => undefined);
    const createAlert = vi.fn(async () => undefined);
    const insertAuditLog = vi.fn(async () => undefined);

    const failingRepo: SessionRepository = {
      ...repo,
      markSourceDegraded,
      createAlert,
      insertAuditLog
    };

    const strategy: AuthStrategyHandler = {
      mode: 'header-token-injection',
      async bootstrap() {
        throw new Error('secret unavailable');
      },
      async validate() {
        return { valid: false, reason: 'invalid token' };
      }
    };

    const manager = new SessionManager({
      repository: failingRepo,
      secretProvider,
      encrypt,
      decrypt,
      strategies: {
        none: undefined,
        'manual-cookie-import': undefined,
        'playwright-form-login': undefined,
        'header-token-injection': strategy
      }
    });

    await expect(
      manager.ensureValidSession(
        baseSource({
          type: 'header-token-injection',
          headerName: 'Authorization',
          tokenSecretRef: 'token',
          renewalSeconds: 10
        })
      )
    ).rejects.toThrow('secret unavailable');

    expect(markSourceDegraded).toHaveBeenCalledTimes(1);
    expect(createAlert).toHaveBeenCalledTimes(1);
    expect(insertAuditLog).toHaveBeenCalledTimes(1);
  });

  it('fails validation for invalid existing session', async () => {
    const repo = createRepo();
    const payload: SessionPayload = {
      mode: 'header-token-injection',
      headers: { Authorization: 'Bearer x' },
      cookies: [],
      origins: [],
      metadata: {}
    };

    await repo.upsertSession({
      sourceId: 'source-1',
      strategy: 'header-token-injection',
      encryptedState: encrypt(JSON.stringify(payload)),
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      status: 'healthy',
      renewalPolicySeconds: 60
    });

    const strategy: AuthStrategyHandler = {
      mode: 'header-token-injection',
      async bootstrap() {
        return {
          payload,
          expiresAt: new Date(Date.now() + 120_000)
        };
      },
      async validate() {
        return { valid: false, reason: 'revoked token' };
      }
    };

    const manager = new SessionManager({
      repository: repo,
      secretProvider,
      encrypt,
      decrypt,
      strategies: {
        none: undefined,
        'manual-cookie-import': undefined,
        'playwright-form-login': undefined,
        'header-token-injection': strategy
      }
    });

    await expect(
      manager.ensureValidSession(
        baseSource({
          type: 'header-token-injection',
          headerName: 'Authorization',
          tokenSecretRef: 'token',
          renewalSeconds: 10
        })
      )
    ).rejects.toThrow('session validation failed');
  });
});
