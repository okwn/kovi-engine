# Kovi Engine Test Gap Report

**Audit Date:** Phase 12 Final Audit

## Current Test Coverage

| Package | Unit Tests | Integration Tests | E2E Tests |
|---------|-----------|-------------------|-----------|
| source-sdk | ✅ adapter-fixture.test.ts | ✅ auth-strategies.mocked.test.ts | ✅ policy-engine.e2e.test.ts |
| config | ✅ config.test.ts | - | - |
| contracts | ✅ contracts.test.ts | - | - |
| adapter-sdk | ✅ adapter-fixture.test.ts | - | - |

## Gap Analysis

### Critical Gaps (P0)

#### TG-001: Destination Delivery State Machine

**Area:** `packages/events/src/destinations/manager.ts`

**Gap:** No tests for destination delivery lifecycle (queued → sent → acknowledged → failed → dead_lettered).

**Why It Matters:** This is the core delivery mechanism. Incorrect state transitions would cause missed or duplicate events.

**Recommended Tests:**
- Successful delivery state transition
- Failed delivery with retry
- Dead letter after max attempts
- Idempotency key deduplication

**Effort:** Medium

---

#### TG-002: Tenant Isolation Verification

**Area:** `packages/db/src/index.ts`, API routes

**Gap:** No integration tests verifying tenant boundary enforcement.

**Why It Matters:** Multi-tenant security is a core feature. Missing tests risk cross-tenant data leakage.

**Recommended Tests:**
- List operations scoped to tenant
- Cross-tenant access blocked
- Destination deliveries tenant-scoped

**Effort:** Medium

---

### High Priority Gaps (P1)

#### TG-003: Webhook Signature Verification

**Area:** `packages/events/src/destinations/plugins.ts`

**Gap:** No test verifying HMAC signature is correctly computed.

**Why It Matters:** Webhook consumers rely on signature for authenticity.

**Recommended Tests:**
- Signature computation with known secret
- Signature header present when secret configured
- Missing signature when no secret

**Effort:** Small

---

#### TG-004: Adapter Manifest Validation

**Area:** `packages/source-sdk/src/packaged-adapters.ts`

**Gap:** No comprehensive validation tests for manifest schema.

**Why It Matters:** Invalid manifests could cause runtime failures.

**Recommended Tests:**
- Valid manifest accepted
- Missing required fields rejected
- Invalid status values rejected
- Changelog format validation

**Effort:** Small

---

#### TG-005: Encryption Round-Trip

**Area:** `packages/source-sdk/src/auth/crypto.ts`

**Gap:** No dedicated test for encrypt/decrypt round-trip.

**Why It Matters:** Encryption is critical for session security.

**Recommended Tests:**
- Encrypt then decrypt returns original
- Different keys produce different ciphertext
- Base64 and raw key both work

**Effort:** Small

---

### Medium Priority Gaps (P2)

#### TG-006: Pagination Helpers

**Area:** `packages/source-sdk/src/sdk/pagination-helpers.ts`

**Gap:** No tests for pagination URL building and page number extraction.

**Effort:** Small

---

#### TG-007: Selector Test Harness

**Area:** `packages/source-sdk/src/sdk/selector-helpers.ts`

**Gap:** No tests for selector validation against fixture HTML.

**Effort:** Small

---

#### TG-008: Adapter SDK Normalization

**Area:** `packages/source-sdk/src/sdk/normalization-helpers.ts`

**Gap:** No tests for field normalization options.

**Effort:** Small

---

### Low Priority Gaps (P3)

#### TG-009: Crawl Policy Edge Cases

**Gap:** No tests for edge cases like relative URLs, query parameters, fragments.

**Effort:** Small

---

#### TG-010: Diff Engine

**Gap:** `packages/events/src/diff-engine.ts` lacks tests.

**Effort:** Small

---

#### TG-011: Webhook Dispatcher

**Gap:** `packages/events/src/webhook-dispatcher.ts` lacks tests.

**Effort:** Small

---

## Test Infrastructure Notes

**Test Runner:** Vitest (configured in source-sdk, config, contracts, adapter-sdk)

**Test Commands:**
```bash
# All tests
pnpm test

# Package-specific
pnpm --filter @kovi/source-sdk test

# Unit only
pnpm --filter @kovi/source-sdk test:unit

# Integration
pnpm --filter @kovi/source-sdk test:integration

# E2E
pnpm --filter @kovi/source-sdk test:e2e
```

**Missing:** Test fixtures for API routes and admin endpoints.
