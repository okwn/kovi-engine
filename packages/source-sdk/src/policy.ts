export type GovernanceStatus = 'allowed' | 'review_required' | 'paused' | 'blocked';
export type PolicyViolationCode =
  | 'source_blocked'
  | 'source_paused'
  | 'review_required'
  | 'depth_exceeded'
  | 'domain_not_allowed'
  | 'max_pages_per_run_exceeded'
  | 'auth_required';

export interface PolicyEvaluationInput {
  source: {
    active: boolean;
    governance_status: string;
    policy_auth_required: boolean;
    policy_max_pages_per_run: number | null;
    policy_crawl_depth_limit: number | null;
    policy_allowed_domains: string[];
  };
  candidateUrl?: string;
  depth?: number;
  fetchedPagesInRun?: number;
  hasValidSession?: boolean;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  violations: PolicyViolationCode[];
}

const statusAllowsExecution = (status: string): boolean => status === 'allowed';

export const evaluateSourcePolicy = (input: PolicyEvaluationInput): PolicyEvaluationResult => {
  const violations: PolicyViolationCode[] = [];

  if (!input.source.active) {
    violations.push('source_paused');
  }

  const status = (input.source.governance_status ?? 'allowed') as GovernanceStatus;
  if (!statusAllowsExecution(status)) {
    if (status === 'blocked') {
      violations.push('source_blocked');
    } else if (status === 'paused') {
      violations.push('source_paused');
    } else {
      violations.push('review_required');
    }
  }

  if (input.source.policy_auth_required && input.hasValidSession === false) {
    violations.push('auth_required');
  }

  if (
    typeof input.source.policy_max_pages_per_run === 'number' &&
    typeof input.fetchedPagesInRun === 'number' &&
    input.fetchedPagesInRun > input.source.policy_max_pages_per_run
  ) {
    violations.push('max_pages_per_run_exceeded');
  }

  if (
    typeof input.source.policy_crawl_depth_limit === 'number' &&
    typeof input.depth === 'number' &&
    input.depth > input.source.policy_crawl_depth_limit
  ) {
    violations.push('depth_exceeded');
  }

  if (input.candidateUrl && input.source.policy_allowed_domains.length > 0) {
    const host = new URL(input.candidateUrl).hostname;
    const allowed = input.source.policy_allowed_domains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
    if (!allowed) {
      violations.push('domain_not_allowed');
    }
  }

  return {
    allowed: violations.length === 0,
    violations
  };
};
