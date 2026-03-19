# Kovi Engine Monorepo

Production-first TypeScript monorepo for selector-first, policy-constrained web data extraction.

## What Is Implemented

- Monorepo with apps and packages requested in architecture
- Source adapter contract with required source definition fields
- Three example adapters:
  - Static catalog
  - JS listing/detail
  - Authenticated dashboard with Playwright form login
- Extraction pipeline:
  - Fetch page
  - Validate page type
  - Apply selectors
  - Normalize fields
  - Compute content hash
  - Compare and version entities
  - Persist source pages + entity versions
  - Publish change events
- Recursive crawl policy:
  - Max depth
  - Allowed domains + internal patterns only
  - Canonical URL handling
  - Visit dedupe
- Retry delay utility and failure classification
- Secure auth/session lifecycle:
  - Manual cookie import
  - Playwright form login bootstrap
  - Header token injection via secret references
  - Encrypted session state at rest
  - Session validation before crawl start
  - Source degradation + alert event on auth failure
  - Audit logging for session actions
- Temporal orchestration runtime:
  - Coordinator workflow for source fan-out
  - Per-source schedule workflow with 1m, 5m, 15m, hourly support
  - Child source-run workflows with retry/backoff
  - Continue-as-new for coordinator and schedule workflows
  - Separate static and browser task queues
  - Concurrency controls: global, per-source, per-domain, per-worker-type
  - Circuit breaker for unstable sources
  - Dead-letter handling for repeatedly failing pages
  - Run summaries written to source_runs and metric logs emitted
- Change detection and downstream delivery:
  - Page/entity/field-level diff detection
  - Versioned event envelope (`schemaVersion: 1.0`)
  - Idempotent delivery records with replay cursor tracking
  - Internal stream publishing via NATS JetStream or Redis Streams
  - Webhook fan-out with per-target attempt/status tracking
  - API query layer for source status, entity history, and recent changes
- Phase 9 hardening:
  - Multi-tenant schema and service-token isolation middleware
  - Governance policy fields with runtime policy evaluation hooks
  - Versioned output contracts with publish-time validation
  - Replay/backfill/reprocess job model and admin endpoints
  - Tenant and source cost/usage accounting schema
  - Production deployment artifacts (Dockerfiles, prod compose, systemd examples)
  - CI pipeline for lint/typecheck/test/build + env/migration verification
  - Incident/ops runbooks and maintainability docs (ADRs, contributor guide, testing matrix)
- Phase 10 operator product layer:
  - Tenant-authenticated admin control plane with deep-link views
  - Dashboard, sources, source detail, runs, changes, sessions, diagnostics, replay, tenant views
  - Source onboarding wizard draft persistence + resume flow
  - Selector sandbox with snapshot-backed preview and normalized output compare
  - Session bootstrap UX (manual cookie import, header-token setup, re-auth actions, history)
  - Source operations UX endpoints (pause/resume/run/dry-run/replay/backfill/reprocess/clone/edit)
  - Tenant-aware role and route restrictions for operator vs platform admin workflows
- Phase 11 extensible platform:
  - Adapter SDK with typed helper utilities
  - Template library for common source types
  - Destination management REST APIs
  - Adapter catalog APIs for marketplace
  - Enhanced scaffold scripts
- Docker Compose local infra:
  - PostgreSQL
  - Temporal
  - NATS JetStream
  - OpenTelemetry Collector
- SQL migrations for initial tables and seed source configs
- Security hardening:
  - SSRF protection for webhook URLs
  - AES-256-GCM encryption for session state
  - Domain allowlisting enforcement
  - Rate limiting on API endpoints

## Repo Layout

- apps/api
- apps/orchestrator
- apps/browser-worker
- apps/extractor-worker
- apps/admin
- packages/config
- packages/db
- packages/source-sdk
- packages/events
- packages/observability
- packages/shared
- infra/docker-compose
- infra/migrations
- infra/temporal
- infra/monitoring

## Boot Steps

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Start local infra:

```bash
docker compose -f infra/docker-compose/docker-compose.yml up -d
```

4. Run services (separate terminals):

```bash
pnpm --filter @kovi/api dev
pnpm --filter @kovi/orchestrator dev
pnpm --filter @kovi/extractor-worker dev
pnpm --filter @kovi/browser-worker dev
pnpm --filter @kovi/admin dev
```

5. Health checks:

- API: http://localhost:3000/health
- API readiness: http://localhost:3000/ready
- Admin: http://localhost:3100/health

Admin session endpoints:

- GET /admin/api/sessions/health
- POST /admin/api/sessions/:sourceId/reauth
- POST /admin/api/sessions/:sourceId/manual-cookie
- POST /admin/api/sessions/:sourceId/header-token

Orchestration behavior:

- Coordinator workflow id: kovi-coordinator
- Child schedule workflow id pattern: source-schedule-<sourceId>
- Static worker queue: kovi-static-fetch
- Browser worker queue: kovi-browser-fetch
- Orchestrator queue: kovi-orchestrator
- Circuit breaker opens after ORCH_CIRCUIT_FAILURE_THRESHOLD consecutive hard run failures
- Dead letter threshold per page is controlled by ORCH_DEAD_LETTER_THRESHOLD

Event delivery behavior:

- Backend selected via EVENT_BUS_BACKEND (`nats-jetstream` or `redis-streams`)
- NATS URL via NATS_URL
- Redis settings via REDIS_URL and REDIS_STREAM_KEY
- Delivery attempts and replay cursors are persisted in `delivery_events`

Downstream integration contract:

- docs/Kovi-Change-Delivery.md

## Notes On Compliance

- No stealth/evasion modules are implemented.
- Authenticated access is supported only via operator-provided credentials/session state.
- No CAPTCHA solving, anti-bot bypass, or unauthorized access logic is included.
- Crawl is explicit and policy-bound; it does not perform blind whole-site scraping.
- Only configured selectors are extracted.

## Source Adapter Contract

Defined in packages/source-sdk and requires each source to provide:

- baseUrl
- crawlEntrypoints
- allowedDomains
- internalLinkPatterns
- extractionSelectors
- pagination
- authentication
- scheduleInterval
- changeDetection
- exportPolicy

## Migrations

- infra/migrations/001_init.sql
- infra/migrations/002_seed_sources.sql
- infra/migrations/003_auth_session_lifecycle.sql
- infra/migrations/004_orchestration_runtime.sql
- infra/migrations/005_change_delivery_layer.sql
- infra/migrations/006_source_operator_state.sql
- infra/migrations/007_phase9_multitenant_governance.sql
- infra/migrations/008_phase10_operator_product_layer.sql

## Phase 9 Docs

- docs/Phase9-MultiTenant-Hardening.md
- docs/Admin-API-Phase9.md
- docs/Workflows-Replay-Backfill-Reprocess.md
- docs/examples/One-Tenant-Multi-Source.md
- docs/operations/Incident-Playbook.md
- docs/operations/Source-Debugging-Guide.md
- docs/operations/Session-Recovery-Guide.md
- docs/operations/Scaling-50plus-Sources.md
- docs/operations/Backup-Restore-Notes.md
- docs/operations/Rolling-Restart-Notes.md
- docs/Security-Checks-Phase9.md
- docs/Contributor-Guide.md
- docs/Testing-Matrix.md

## Phase 10 Docs

- docs/Phase10-Operator-Product-Layer.md
- docs/Admin-API-Phase10.md

These are auto-applied by PostgreSQL container init for local development.

## Phase 12 Audit & Release

- [Security Checklist](./SECURITY_CHECKLIST.md)
- [Security Findings](./SECURITY_FINDINGS.md)
- [Failure Modes](./FAILURE_MODES.md)
- [Test Gap Report](./TEST_GAP_REPORT.md)
- [Release Readiness](./RELEASE_READINESS.md)
- [Prioritized Fix Plan](./PRIORITIZED_FIX_PLAN.md)
- [Final Check Results](./FINAL_CHECK_RESULTS.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and contribution guidelines.

## License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) for details.
