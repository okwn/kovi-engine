import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import type { SourceDefinition } from './contracts.js';

const normalizePath = (value: string): string => value.replace(/\/$/, '') || '/';

export const canonicalizeUrl = (input: string): string => {
  const url = new URL(input);
  url.hash = '';
  url.pathname = normalizePath(url.pathname);
  const entries = [...url.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  url.search = '';
  for (const [key, val] of entries) {
    url.searchParams.append(key, val);
  }
  return url.toString();
};

const globToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
};

const isAllowedDomain = (candidate: URL, allowedDomains: string[]): boolean =>
  allowedDomains.some((domain) => candidate.hostname === domain || candidate.hostname.endsWith(`.${domain}`));

const matchesInternalPattern = (url: string, patterns: string[]): boolean =>
  patterns.some((pattern) => globToRegex(pattern).test(url));

export const shouldFollowInternalLink = (
  source: SourceDefinition,
  currentDepth: number,
  candidateUrl: string
): boolean => {
  if (currentDepth >= source.maxDepth) {
    return false;
  }

  const parsed = new URL(candidateUrl);
  if (!isAllowedDomain(parsed, source.allowedDomains)) {
    return false;
  }

  return matchesInternalPattern(parsed.toString(), source.internalLinkPatterns);
};

export const buildVisitKey = (url: string): string => createHash('sha256').update(canonicalizeUrl(url)).digest('hex');
