# Kovi Engine Security Findings

**Audit Date:** Phase 12 Final Audit
**Overall Posture:** GOOD with minor recommendations

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 3 |
| Low | 5 |

---

## SEC-001: Webhook URL Validation [MEDIUM]

**Location:** `packages/events/src/destinations/plugins.ts:WebhookDestinationPlugin`

**Finding:** Webhook destination only validates that URL starts with `http://` or `https://`. No validation against private IP ranges or localhost, which could enable SSRF in multi-tenant setups.

**Impact:** Potential SSRF if webhook URL targets internal services.

**Recommendation:** Add private IP range validation for webhook URLs:

```typescript
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^localhost$/i
];

export const isPrivateUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return PRIVATE_IP_RANGES.some(regex => regex.test(parsed.hostname));
  } catch {
    return false;
  }
};
```

**Effort:** Small

---

## SEC-002: Source Fetching SSRF Risk [MEDIUM]

**Location:** `packages/source-sdk/src/crawl-policy.ts`

**Finding:** While domain allowlisting is enforced, no explicit protection against DNS rebinding or redirect-based SSRF during source crawling.

**Impact:** Limited - domain allowlisting provides primary protection.

**Recommendation:** Document that redirects follow the same domain policy. Consider adding redirect validation in crawl policy.

**Effort:** Medium

---

## SEC-003: Encryption Key Rotation Guidance [MEDIUM]

**Location:** Documentation / Operations

**Finding:** `SESSION_ENCRYPTION_KEY` is required but no guidance exists for key rotation procedures.

**Impact:** Operational risk if key needs to be rotated in production.

**Recommendation:** Add key rotation runbook:

1. Deploy new encryption key
2. Re-encrypt all session records
3. Verify all sources still have valid sessions
4. Retire old key

**Effort:** Small (documentation)

---

## SEC-004: Console Destination Info Leak [LOW]

**Location:** `packages/events/src/destinations/plugins.ts:AnalyticsSinkDestinationPlugin`

**Finding:** Analytics sink writes to stdout which could include sensitive data in log aggregation.

**Impact:** Low - opt-in plugin only.

**Recommendation:** Document that this plugin is for development only.

**Effort:** Small

---

## SEC-005: Missing CORS Configuration [LOW]

**Location:** API and Admin servers

**Finding:** CORS configuration not explicitly defined for API endpoints.

**Impact:** Low - API is intended for server-to-server communication.

**Recommendation:** Add explicit CORS policy configuration for API endpoints.

**Effort:** Small

---

## SEC-006: Rate Limit Not Enforced Per-Tenant [LOW]

**Location:** `packages/api/src/routes/destinations.ts`

**Finding:** New API routes created in Phase 11 do not have explicit rate limiting.

**Impact:** Low - inherits from Fastify instance configuration.

**Recommendation:** Ensure rate limiting middleware is applied to all new routes.

**Effort:** Small

---

## SEC-007: Error Messages May Leak Structure [LOW]

**Location:** Various error handlers

**Finding:** Some error messages include internal details that could aid reconnaissance.

**Impact:** Low - typical for development environments.

**Recommendation:** Sanitize error messages in production mode.

**Effort:** Small

---

## SEC-008: Missing Request Size Limits [LOW]

**Location:** Admin API webhook/snapshot endpoints

**Finding:** No explicit payload size limits documented.

**Impact:** Low - Fastify has defaults.

**Recommendation:** Add explicit body size limits to configuration.

**Effort:** Small
