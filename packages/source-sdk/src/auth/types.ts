import type { AuthMode, SourceDefinition } from '../contracts.js';

export interface SessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

export interface SessionOriginStorage {
  origin: string;
  localStorage: Array<{ name: string; value: string }>;
}

export interface SessionPayload {
  mode: AuthMode;
  headers: Record<string, string>;
  cookies: SessionCookie[];
  origins: SessionOriginStorage[];
  metadata: Record<string, string>;
}

export interface SessionRecord {
  sourceId: string;
  strategy: AuthMode;
  encryptedState: Buffer | null;
  expiresAt: string | null;
  status: 'healthy' | 'expired' | 'invalid' | 'missing';
  lastValidatedAt: string | null;
  lastFailureReason: string | null;
  renewalPolicySeconds: number;
}

export interface SessionHealthRecord {
  sourceId: string;
  sourceName: string;
  strategy: AuthMode;
  status: string;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  lastFailureReason: string | null;
}

export interface SessionRepository {
  getSessionBySource(sourceId: string): Promise<SessionRecord | null>;
  upsertSession(input: {
    sourceId: string;
    strategy: AuthMode;
    encryptedState: Buffer;
    expiresAt: string | null;
    status: SessionRecord['status'];
    renewalPolicySeconds: number;
  }): Promise<void>;
  updateSessionValidation(input: {
    sourceId: string;
    status: SessionRecord['status'];
    lastFailureReason: string | null;
    expiresAt: string | null;
  }): Promise<void>;
  listSessionHealth(): Promise<SessionHealthRecord[]>;
  markSourceDegraded(sourceId: string, reason: string): Promise<void>;
  markSourceHealthy(sourceId: string): Promise<void>;
  createAlert(sourceId: string, message: string): Promise<void>;
  insertAuditLog(input: {
    actorType: 'system' | 'operator';
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    details: Record<string, unknown>;
  }): Promise<void>;
}

export interface SecretProvider {
  getSecret(secretRef: string): Promise<string>;
}

export interface AuthStrategyHandler {
  mode: AuthMode;
  bootstrap(input: {
    source: SourceDefinition;
    secretProvider: SecretProvider;
    existingPayload: SessionPayload | null;
  }): Promise<{ payload: SessionPayload; expiresAt: Date | null }>;
  validate(input: {
    source: SourceDefinition;
    payload: SessionPayload;
    expiresAt: Date | null;
  }): Promise<{ valid: boolean; reason?: string }>;
}

export interface SessionManagerOptions {
  repository: SessionRepository;
  secretProvider: SecretProvider;
  encrypt: (plain: string) => Buffer;
  decrypt: (cipher: Buffer) => string;
  strategies: Record<AuthMode, AuthStrategyHandler | undefined>;
}
