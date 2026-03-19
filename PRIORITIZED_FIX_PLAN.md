# Kovi Engine Prioritized Fix Plan

**Audit Date:** Phase 12 Final Audit

## P0 - Must Fix Before Publish

### P0-001: Fix LSP Type Error in Packaged Adapters

**Area:** `packages/source-sdk/src/packaged-adapters.ts:113`

**Severity:** Medium

**Issue:** TypeScript strict mode error with `runtime` optional property. The type cast at line 113 produces a type incompatibility with `exactOptionalPropertyTypes`.

**Why It Matters:** Type errors signal code quality issues and may hide runtime bugs.

**Proposed Fix:** Use explicit undefined union type for runtime property.

**Effort:** Small

**Status:** Implementation in progress

---

### P0-002: Add SSRF Protection for Webhook URLs

**Area:** `packages/events/src/destinations/plugins.ts`

**Severity:** Medium

**Issue:** Webhook destination does not validate against private IP ranges, enabling potential SSRF in multi-tenant setups.

**Why It Matters:** Security vulnerability in production deployments.

**Proposed Fix:** Add private IP range validation function.

**Effort:** Small

---

## P1 - Strongly Recommended

### P1-001: Destination Delivery Tests

**Area:** `packages/events/src/destinations/manager.ts`

**Severity:** High

**Issue:** No tests for core delivery state machine.

**Why It Matters:** Delivery failures could cause missed events in production.

**Proposed Fix:** Add comprehensive unit tests for delivery lifecycle.

**Effort:** Medium

---

### P1-002: Tenant Isolation Integration Tests

**Area:** `packages/db/src/index.ts`, API routes

**Severity:** High

**Issue:** No tests verifying tenant boundary enforcement.

**Why It Matters:** Multi-tenant security is a core feature.

**Proposed Fix:** Add integration tests for cross-tenant access scenarios.

**Effort:** Medium

---

### P1-003: Encryption Key Rotation Documentation

**Area:** Documentation

**Severity:** Medium

**Issue:** No guidance for rotating `SESSION_ENCRYPTION_KEY` in production.

**Why It Matters:** Operational requirement for production deployments.

**Proposed Fix:** Add key rotation runbook to operations documentation.

**Effort:** Small

---

### P1-004: Stuck Run Detection

**Area:** Orchestrator workflow

**Severity:** Medium

**Issue:** No mechanism to detect and recover from stuck runs.

**Why It Matters:** Sources could appear active but not progressing.

**Proposed Fix:** Add background job to check for stale running runs.

**Effort:** Medium

---

### P1-005: Webhook Signature Tests

**Area:** `packages/events/src/destinations/plugins.ts`

**Severity:** Medium

**Issue:** No tests verifying HMAC signature computation.

**Why It Matters:** Webhook consumers rely on signature for authenticity.

**Proposed Fix:** Add tests for signature generation with known inputs.

**Effort:** Small

---

## P2 - Post-Publish Improvement

### P2-001: Adapter Manifest Validation Tests

**Area:** `packages/source-sdk/src/packaged-adapters.ts`

**Severity:** Low

**Issue:** No comprehensive tests for manifest schema validation.

**Proposed Fix:** Add tests for valid/invalid manifest scenarios.

**Effort:** Small

---

### P2-002: Pagination Helpers Tests

**Area:** `packages/source-sdk/src/sdk/pagination-helpers.ts`

**Severity:** Low

**Issue:** Pagination utilities lack test coverage.

**Proposed Fix:** Add tests for URL building and page extraction.

**Effort:** Small

---

### P2-003: Selector Test Harness

**Area:** `packages/source-sdk/src/sdk/selector-helpers.ts`

**Severity:** Low

**Issue:** Selector validation against fixture HTML untested.

**Proposed Fix:** Add fixture-based selector tests.

**Effort:** Small

---

### P2-004: Normalization Helpers Tests

**Area:** `packages/source-sdk/src/sdk/normalization-helpers.ts`

**Severity:** Low

**Issue:** Field normalization options untested.

**Proposed Fix:** Add tests for trim, lowercase, nullify options.

**Effort:** Small

---

### P2-005: Crawl Policy Edge Cases

**Area:** `packages/source-sdk/src/crawl-policy.ts`

**Severity:** Low

**Issue:** Edge cases (relative URLs, fragments, query params) untested.

**Proposed Fix:** Add edge case tests.

**Effort:** Small

---

## P3 - Future Enhancement

### P3-001: Enhanced Monitoring Dashboard

**Area:** Admin UI

**Issue:** Basic admin UI exists but lacks advanced analytics.

**Proposed Fix:** Add delivery success rates, run duration charts, error trends.

**Effort:** Large

---

### P3-002: Additional Destination Plugins

**Area:** `packages/events/src/destinations/plugins.ts`

**Issue:** Current plugins cover common cases; Slack, email, etc. would be useful.

**Proposed Fix:** Add community-contributed destination plugins.

**Effort:** Medium each

---

### P3-003: Distributed Tracing Integration

**Area:** Observability

**Issue:** OpenTelemetry configured but trace correlation could be improved.

**Proposed Fix:** Add trace context propagation through all operations.

**Effort:** Medium

---

### P3-004: Database Migration Rollback Support

**Area:** `infra/migrations/`

**Issue:** Migrations are forward-only; no rollback scripts.

**Proposed Fix:** Add rollback scripts for each migration.

**Effort:** Medium

---

### P3-005: Adapter SDK Pagination Patterns

**Area:** `packages/source-sdk/src/sdk/`

**Issue:** Common pagination patterns could be abstracted.

**Proposed Fix:** Add reusable pagination strategies (offset, cursor, next-link).

**Effort:** Medium

---

## Summary

| Priority | Count | Effort |
|----------|-------|--------|
| P0 | 2 | Small |
| P1 | 5 | Small-Medium |
| P2 | 5 | Small |
| P3 | 5 | Medium-Large |

**Total Effort Estimate:** P0+P1 = ~2-3 days; Full plan = ~2-3 weeks
