import { describe, expect, it } from 'vitest';
import { evaluateSourcePolicy } from '../../src/policy.js';

describe('policy engine e2e', () => {
  it('blocks blocked/restricted source execution', () => {
    const result = evaluateSourcePolicy({
      source: {
        active: true,
        governance_status: 'blocked',
        policy_auth_required: true,
        policy_max_pages_per_run: 5,
        policy_crawl_depth_limit: 2,
        policy_allowed_domains: ['allowed.local']
      },
      candidateUrl: 'https://other.local/page',
      depth: 3,
      fetchedPagesInRun: 10,
      hasValidSession: false
    });

    expect(result.allowed).toBe(false);
    expect(result.violations).toContain('source_blocked');
    expect(result.violations).toContain('auth_required');
    expect(result.violations).toContain('depth_exceeded');
    expect(result.violations).toContain('domain_not_allowed');
  });
});
