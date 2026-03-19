import { describe, expect, it } from 'vitest';
import { negotiateContractVersion, validateEventEnvelope } from './index.js';

describe('contracts', () => {
  it('validates envelope v1.0', () => {
    expect(() =>
      validateEventEnvelope({
        schemaVersion: '1.0',
        contractType: 'entity.change',
        contractVersion: '1.0',
        eventType: 'entity.changed',
        eventId: 'e-1',
        idempotencyKey: 'k-1',
        occurredAt: new Date().toISOString(),
        tenantId: 't-1',
        sourceId: 's-1',
        changeScopes: ['entity'],
        changes: { pageChanged: false, entityChanged: true, fieldChanges: [] },
        payload: { a: 1 }
      })
    ).not.toThrow();
  });

  it('negotiates only supported version', () => {
    expect(negotiateContractVersion(undefined)).toBe('1.0');
    expect(() => negotiateContractVersion('2.0')).toThrow();
  });
});
