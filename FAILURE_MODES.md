# Kovi Engine Failure Modes Analysis

**Audit Date:** Phase 12 Final Audit

## Failure Mode Matrix

### FM-001: Browser Worker Crash

| Aspect | Description |
|--------|-------------|
| **Detection** | Temporal activity timeout, health check failure |
| **Impact** | In-flight page fetches fail, stuck runs |
| **Mitigation** | Temporal retry policy, continue-as-new for stuck workflows |
| **Recovery** | Automatic retry on different worker, manual run restart |

**Status:** ✅ Mitigated

---

### FM-002: Scheduler Duplication

| Aspect | Description |
|--------|-------------|
| **Detection** | Duplicate workflow IDs, log warnings |
| **Impact** | Multiple concurrent runs for same source |
| **Mitigation** | Temporal workflow ID deduplication, per-source concurrency limits |
| **Recovery** | Idempotency keys prevent duplicate events |

**Status:** ✅ Mitigated

---

### FM-003: Overlapping/Stuck Runs

| Aspect | Description |
|--------|-------------|
| **Detection** | Run status 'running' with stale timestamp |
| **Impact** | Source appears active but not progressing |
| **Mitigation** | Temporal activity timeouts, circuit breaker for repeated failures |
| **Recovery** | Manual run finalization via admin API |

**Status:** ⚠️ Partially mitigated - add stuck run detection job

---

### FM-004: Event Broker Outage

| Aspect | Description |
|--------|-------------|
| **Detection** | Connection failures, publish timeouts |
| **Impact** | Events queued but not delivered to consumers |
| **Mitigation** | Delivery events persisted before publish, replay cursor tracking |
| **Recovery** | Manual replay via admin API |

**Status:** ✅ Mitigated

---

### FM-005: Database Slowdown/Outage

| Aspect | Description |
|--------|-------------|
| **Detection** | Connection pool exhaustion, query timeouts |
| **Impact** | All operations degrade, runs may fail |
| **Mitigation** | Connection pooling, transaction isolation |
| **Recovery** | Pool connection recycling, service restart |

**Status:** ✅ Mitigated

---

### FM-006: Webhook Destination Failure

| Aspect | Description |
|--------|-------------|
| **Detection** | HTTP error response, connection timeout |
| **Impact** | Events not delivered downstream |
| **Mitigation** | Retry with max attempts, dead letter after threshold |
| **Recovery** | Manual replay of failed deliveries |

**Status:** ✅ Mitigated

---

### FM-007: Auth Session Expiry

| Aspect | Description |
|--------|-------------|
| **Detection** | Session validation failure before crawl |
| **Impact** | Source marked degraded, crawl blocked |
| **Mitigation** | Auto-renewal before expiry, source degradation alerts |
| **Recovery** | Manual reauth via admin UI |

**Status:** ✅ Mitigated

---

### FM-008: Adapter Misconfiguration

| Aspect | Description |
|--------|-------------|
| **Detection** | Extraction errors, empty results |
| **Impact** | No data extracted, source health degrades |
| **Mitigation** | Manifest validation, required field checks |
| **Recovery** | Edit source config via admin |

**Status:** ✅ Mitigated

---

### FM-009: Circuit Breaker Activation

| Aspect | Description |
|--------|-------------|
| **Detection** | Failure streak exceeds threshold |
| **Impact** | Source temporarily disabled |
| **Mitigation** | Configurable threshold and open duration |
| **Recovery** | Auto-retry after circuit closes |

**Status:** ✅ Mitigated

---

### FM-010: Tenant Quota Exhaustion

| Aspect | Description |
|--------|-------------|
| **Detection** | Usage exceeds quota limits |
| **Impact** | New sources blocked for tenant |
| **Mitigation** | Quota enforcement in source creation |
| **Recovery** | Admin quota adjustment |

**Status:** ⚠️ Partially mitigated - quotas defined but enforcement needs testing

---

### FM-011: OpenTelemetry Failure

| Aspect | Description |
|--------|-------------|
| **Detection** | Export errors, missing traces |
| **Impact** | Observability degraded, core operations unaffected |
| **Mitigation** | Non-blocking telemetry, optional via config |
| **Recovery** | Restart collector, disable if needed |

**Status:** ✅ Mitigated

---

### FM-012: Page Dead Letter

| Aspect | Description |
|--------|-------------|
| **Detection** | Attempts exceed `ORCH_DEAD_LETTER_THRESHOLD` |
| **Impact** | Page skipped from extraction |
| **Mitigation** | Dead letter record persisted, not blocking |
| **Recovery** | Manual inspection, adjust policy |

**Status:** ✅ Mitigated

---

## Recommended Improvements

### Priority 1: Stuck Run Detection Job

Create a background job that:
1. Finds runs older than 1 hour with status 'running'
2. Attempts finalization or marks as failed
3. Alerts operator

### Priority 2: Quota Enforcement Testing

Add integration tests for tenant quota enforcement scenarios.

### Priority 3: Delivery Queue Overflow

Add monitoring for `delivery_events` table growth and implement retention policies.
