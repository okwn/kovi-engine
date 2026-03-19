export type FailureClass =
  | 'network'
  | 'timeout'
  | 'server-5xx'
  | 'auth-required'
  | 'forbidden'
  | 'selector-miss'
  | 'validation'
  | 'unknown';

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryable: FailureClass[];
}

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  retryable: ['network', 'timeout', 'server-5xx']
};

export const classifyFailure = (statusCode: number | null, message: string): FailureClass => {
  const lower = message.toLowerCase();
  if (lower.includes('timeout')) {
    return 'timeout';
  }
  if (lower.includes('selector')) {
    return 'selector-miss';
  }
  if (statusCode === 401) {
    return 'auth-required';
  }
  if (statusCode === 403) {
    return 'forbidden';
  }
  if (statusCode !== null && statusCode >= 500) {
    return 'server-5xx';
  }
  if (statusCode === null) {
    return 'network';
  }
  return 'unknown';
};

export const computeRetryDelayMs = (attempt: number, policy: RetryPolicy): number => {
  const delay = policy.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, policy.maxDelayMs);
};
