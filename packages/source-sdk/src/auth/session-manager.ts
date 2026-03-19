import type { SourceDefinition } from '../contracts.js';
import type {
  AuthStrategyHandler,
  SessionManagerOptions,
  SessionHealthRecord,
  SessionPayload,
  SessionRecord
} from './types.js';
import type { AuthMode } from '../contracts.js';

const parsePayload = (decrypt: (cipher: Buffer) => string, record: SessionRecord): SessionPayload | null => {
  if (!record.encryptedState) {
    return null;
  }
  return JSON.parse(decrypt(record.encryptedState)) as SessionPayload;
};

const toDateOrNull = (value: string | null): Date | null => (value ? new Date(value) : null);

export class SessionManager {
  public constructor(private readonly options: SessionManagerOptions) {}

  public async ensureValidSession(source: SourceDefinition): Promise<SessionPayload | null> {
    if (source.authentication.type === 'none') {
      return null;
    }

    const strategy = this.getStrategy(source.authentication.type);
    const existing = await this.options.repository.getSessionBySource(source.id);
    const existingPayload = existing ? parsePayload(this.options.decrypt, existing) : null;
    const now = Date.now();
    const existingExpiry = toDateOrNull(existing?.expiresAt ?? null);
    const mustRenew =
      !existingPayload ||
      !existingExpiry ||
      existingExpiry.getTime() <= now + source.authentication.renewalSeconds * 1000;

    if (mustRenew) {
      const renewed = await this.bootstrapAndPersist(source, strategy, existingPayload, 'system', 'session.renew');
      await this.options.repository.markSourceHealthy(source.id);
      return renewed;
    }

    const validation = await strategy.validate({
      source,
      payload: existingPayload,
      expiresAt: existingExpiry
    });

    if (!validation.valid) {
      await this.handleAuthFailure(source.id, validation.reason ?? 'session validation failed', 'system');
      throw new Error(`session validation failed for source ${source.id}: ${validation.reason ?? 'unknown reason'}`);
    }

    await this.options.repository.updateSessionValidation({
      sourceId: source.id,
      status: 'healthy',
      lastFailureReason: null,
      expiresAt: existing?.expiresAt ?? (existingExpiry ? existingExpiry.toISOString() : null)
    });

    return existingPayload;
  }

  public async manualCookieImport(input: {
    source: SourceDefinition;
    actorId: string;
    cookies: SessionPayload['cookies'];
    expiresAt: string | null;
  }): Promise<void> {
    if (input.source.authentication.type !== 'manual-cookie-import') {
      throw new Error('manual cookie import is only available for manual-cookie-import auth mode');
    }

    const payload: SessionPayload = {
      mode: 'manual-cookie-import',
      headers: {},
      cookies: input.cookies,
      origins: [],
      metadata: {}
    };

    await this.persistPayload(
      input.source,
      payload,
      input.expiresAt ? new Date(input.expiresAt) : null,
      input.actorId,
      'session.import.manual-cookie'
    );
  }

  public async forceReauth(source: SourceDefinition, actorId: string): Promise<void> {
    if (source.authentication.type === 'none') {
      return;
    }
    const strategy = this.getStrategy(source.authentication.type);
    await this.bootstrapAndPersist(source, strategy, null, actorId, 'session.reauth.manual');
  }

  public async getSessionHealth(): Promise<SessionHealthRecord[]> {
    return this.options.repository.listSessionHealth();
  }

  private getStrategy(mode: AuthMode): AuthStrategyHandler {
    const strategy = this.options.strategies[mode];
    if (!strategy) {
      throw new Error(`missing auth strategy handler for mode ${mode}`);
    }
    return strategy;
  }

  private async bootstrapAndPersist(
    source: SourceDefinition,
    strategy: AuthStrategyHandler,
    existingPayload: SessionPayload | null,
    actorId: string,
    auditAction: string
  ): Promise<SessionPayload> {
    try {
      const result = await strategy.bootstrap({
        source,
        secretProvider: this.options.secretProvider,
        existingPayload
      });
      await this.persistPayload(source, result.payload, result.expiresAt, actorId, auditAction);
      await this.options.repository.markSourceHealthy(source.id);
      return result.payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.handleAuthFailure(source.id, message, actorId);
      throw error;
    }
  }

  private async persistPayload(
    source: SourceDefinition,
    payload: SessionPayload,
    expiresAt: Date | null,
    actorId: string,
    auditAction: string
  ): Promise<void> {
    const encrypted = this.options.encrypt(JSON.stringify(payload));
    await this.options.repository.upsertSession({
      sourceId: source.id,
      strategy: source.authentication.type,
      encryptedState: encrypted,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      status: 'healthy',
      renewalPolicySeconds: source.authentication.type === 'none' ? 0 : source.authentication.renewalSeconds
    });

    await this.options.repository.insertAuditLog({
      actorType: actorId === 'system' ? 'system' : 'operator',
      actorId,
      action: auditAction,
      targetType: 'session',
      targetId: source.id,
      details: {
        mode: source.authentication.type,
        expiresAt: expiresAt?.toISOString() ?? null
      }
    });
  }

  private async handleAuthFailure(sourceId: string, reason: string, actorId: string): Promise<void> {
    await this.options.repository.updateSessionValidation({
      sourceId,
      status: 'invalid',
      lastFailureReason: reason,
      expiresAt: null
    });

    await this.options.repository.markSourceDegraded(sourceId, reason);
    await this.options.repository.createAlert(sourceId, reason);
    await this.options.repository.insertAuditLog({
      actorType: actorId === 'system' ? 'system' : 'operator',
      actorId,
      action: 'session.auth.failed',
      targetType: 'source',
      targetId: sourceId,
      details: { reason }
    });
  }
}
