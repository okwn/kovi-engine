# Kovi: Production Architecture Blueprint

Date: 2026-03-19
Target: Linux, 24/7 operations
Primary objective: Selector-first, AI-assisted web data extraction with strict compliance and maintainability.

## 1) Architecture Overview

Kovi is designed as an event-driven, workflow-orchestrated platform with clean service boundaries.

Core principles:
- Selector-first extraction, not general scraping.
- Rules-driven crawling limited to approved domains and paths.
- Compliance-first handling of authentication and access controls.
- Workflow durability and replayability through Temporal.
- Raw, normalized, and versioned persistence in PostgreSQL.
- Near-real-time publication through Redis Streams or NATS JetStream.
- Full observability with OpenTelemetry and production SLOs.
- Future multi-tenant capability through tenant-scoped data and policies.

High-level flow:
1. Source configuration defines allowed domains, link rules, selectors, and auth mode.
2. Temporal schedules and executes source runs.
3. Crawlee + Playwright workers fetch pages (static or JS-rendered) and extract configured fields only.
4. Extracted payloads are stored as raw snapshots and normalized records.
5. Change detector computes diffs against latest accepted version.
6. New versions and change events are published to event bus and exposed by API.

## 2) Monorepo Structure Proposal

Preferred tooling:
- Package manager: pnpm
- Build orchestration: Turborepo
- Linting/formatting: ESLint + Prettier
- Runtime: Node.js LTS

Proposed structure:

kovi-engine/
  apps/
    api/
      src/
      test/
      Dockerfile
    worker-crawl/
      src/
      test/
      Dockerfile
    worker-diff/
      src/
      test/
      Dockerfile
    worker-publish/
      src/
      test/
      Dockerfile
    temporal-worker/
      src/
      workflows/
      activities/
      test/
      Dockerfile
  packages/
    core-domain/
      src/
    source-adapters/
      src/
    extraction-engine/
      src/
    auth-session/
      src/
    db/
      prisma-or-migrations/
      src/
    events/
      src/
    observability/
      src/
    policy/
      src/
    api-contracts/
      src/
  infra/
    docker/
      docker-compose.yml
    temporal/
      dynamic-config/
    postgres/
      init/
    redis-or-nats/
      config/
    otel/
      collector-config.yaml
  docs/
    Kovi-Architecture.md
    runbooks/
      incident.md
      source-onboarding.md
      auth-rotation.md
  .github/
    workflows/
  turbo.json
  pnpm-workspace.yaml
  README.md

## 2a) Implemented Monorepo Layout and Package Boundaries

The current codebase implements the architecture above as a pnpm + Turborepo monorepo with the following concrete responsibilities:

- **Runtime apps**
  - `apps/api` (`@kovi/api`): Fastify HTTP runtime. Wires configuration, DB, events and observability, and composes route modules from `@kovi/api-core`.
  - `apps/orchestrator` (`@kovi/orchestrator`): Temporal worker for scheduling and orchestrating source runs.
  - `apps/browser-worker` (`@kovi/browser-worker`): JS-rendered extraction worker (Crawlee + Playwright).
  - `apps/extractor-worker` (`@kovi/extractor-worker`): static extraction worker that executes source adapters and packaged adapters.
  - `apps/admin` (`@kovi/admin`): admin/operator UI/API surface for day-to-day control plane usage.

- **Core platform packages**
  - `packages/api` (`@kovi/api-core`): reusable API/business logic and route layer. Owns HTTP contracts and mapping from DB/events to JSON responses.
  - `packages/config` (`@kovi/config`): environment/config loading and validation.
  - `packages/contracts` (`@kovi/contracts`): change delivery/event contracts.
  - `packages/db` (`@kovi/db`): database access layer and schema mapping.
  - `packages/events` (`@kovi/events`): destination registry, destination manager, and event bus integration.
  - `packages/observability` (`@kovi/observability`): OpenTelemetry wiring, common tracing/metrics helpers.
  - `packages/shared` (`@kovi/shared`): shared utilities, logging, and common types.

- **Adapter SDKs and extension surface**
  - `packages/source-sdk` (`@kovi/source-sdk`): platform-level source adapter contract (`SourceDefinition`, `SourceAdapter`, `PageType`, `NormalizedEntity`) and SDK helpers (normalization, extraction/test harness).
  - `packages/adapter-sdk` (`@kovi/adapter-sdk`): adapter authoring SDK that external adapter authors should depend on. Builds on `@kovi/source-sdk` and `@kovi/contracts` to provide higher-level authoring utilities.

- **Packaged adapters and discovery**
  - `adapters/`: packaged source adapters that can be shipped as artifacts.
  - `apps/extractor-worker/src/adapter-registry.ts` uses `@kovi/source-sdk` to create an in-memory adapter registry.
  - At startup, the extractor worker:
    - always registers first-party adapters,
    - if the `KOVI_ADAPTER_MANIFEST_DIR` environment variable is set, scans that directory for packaged adapter manifests and registers them via `loadPackagedAdapterManifestsFromDir` / `registerExternalPackagedAdapter`.
  - This makes adapter loading configurable at runtime without changing core app code.

New contributors should:

- Import **runtime apps** (e.g. `@kovi/api`) only as deployment/runtime entrypoints.
- Import **platform packages** (`@kovi/api-core`, `@kovi/db`, `@kovi/events`, etc.) only from other server-side code within the monorepo.
- Import **`@kovi/adapter-sdk`** when building external adapters that integrate with Kovi.

## 3) Service Boundaries and Responsibilities

1. API Service (Fastify preferred)
- Source CRUD, field definitions, run controls.
- Query endpoints for latest data, versions, and change history.
- Auth/session management endpoints for operator-provided credentials.
- Webhook management and event replay endpoints.
- Tenant and RBAC-aware access control.

2. Temporal Worker
- Durable orchestration for periodic and on-demand runs.
- Retry policies, backoff, timeout, and compensation steps.
- Workflow state and idempotency keys for exactly-once business effects.

3. Crawl Worker (Crawlee + Playwright)
- Executes source adapters.
- Handles static and JS-rendered fetching.
- Enforces crawl policies: depth, path allowlist, robots mode policy, rate limits, and run budgets.
- Emits raw extraction artifacts.

4. Diff Worker
- Normalizes extracted records.
- Computes canonical signatures and field-level diffs.
- Creates new versions only when configured significance thresholds are met.

5. Publish Worker
- Pushes low-latency events to Redis Streams or NATS JetStream.
- Handles delivery guarantees, dead-lettering, retries, and replay indexes.

6. PostgreSQL
- Source configs, run metadata, snapshots, normalized entities, versions, and audit trails.

7. Redis Streams or NATS JetStream
- Internal update fan-out and downstream consumption with consumer groups.

## 4) Database Schema Proposal (PostgreSQL)

Design goals:
- Tenant-ready from day one.
- Immutable history for traceability.
- Efficient latest-state reads.

Core tables:

1. tenants
- id (uuid, pk)
- name
- status
- created_at

2. users
- id (uuid, pk)
- tenant_id (fk tenants)
- email (unique per tenant)
- role
- created_at

3. sources
- id (uuid, pk)
- tenant_id (fk tenants)
- name
- base_url
- adapter_type
- status (active, paused, error)
- schedule_cron
- max_depth
- max_pages_per_run
- js_render_mode (auto, always, never)
- created_at, updated_at

4. source_policies
- source_id (pk, fk sources)
- allowed_domains (text[])
- allowed_path_patterns (text[])
- disallowed_path_patterns (text[])
- include_query_params (bool)
- honor_robots_txt (bool)
- rate_limit_rps
- concurrency_limit

5. source_fields
- id (uuid, pk)
- source_id (fk sources)
- field_key
- selector
- selector_type (css, xpath, regex-post)
- transform_pipeline (jsonb)
- required (bool)
- unique_key_part (bool)
- data_type
- created_at, updated_at

6. auth_profiles
- id (uuid, pk)
- tenant_id (fk tenants)
- source_id (fk sources)
- auth_type (form_login, cookie_seed, header_token, oauth_manual_seed)
- secret_ref (vault key id)
- session_ttl_seconds
- created_at, updated_at

7. run_executions
- id (uuid, pk)
- tenant_id
- source_id
- temporal_workflow_id
- trigger_type (schedule, manual, webhook)
- started_at, ended_at
- status
- pages_visited
- pages_extracted
- errors_count
- warning_count

8. page_visits
- id (uuid, pk)
- run_id (fk run_executions)
- url
- parent_url
- depth
- http_status
- fetched_at
- content_hash
- render_mode_used
- blocked_reason

9. raw_snapshots
- id (uuid, pk)
- run_id
- source_id
- page_visit_id
- record_key
- extracted_payload (jsonb)
- raw_html_ref (object storage key or compressed bytea reference)
- screenshot_ref (optional)
- extracted_at

10. normalized_records
- id (uuid, pk)
- tenant_id
- source_id
- record_key
- canonical_json (jsonb)
- canonical_hash
- latest_version_no
- first_seen_at
- last_seen_at
- active (bool)

11. record_versions
- id (uuid, pk)
- normalized_record_id (fk normalized_records)
- version_no
- canonical_json (jsonb)
- canonical_hash

## Phase 9 Extension Summary

This architecture now includes a hardened multi-tenant and governance layer:

- Tenant-isolated persistence and service-token auth boundaries.
- Governance policy fields enforced before execution and logged on violation.
- Versioned output contracts with schema validation before publish.
- Replay/backfill/reprocess job model separated from scheduled/manual crawl runs.
- Cost and usage accounting tables for tenant and source optimization.
- Emergency tenant pause controls and DR-ready operational artifacts.

## Phase 10 Extension Summary

This architecture now includes an operator product layer for day-to-day control plane usage:

- Authenticated admin console with tenant-scoped and role-aware navigation.
- Source onboarding wizard with persisted drafts, step validation, and policy preflight.
- Selector sandbox endpoints and UI for snapshot-backed extraction preview and comparison.
- Session bootstrap and lifecycle UX (manual cookie import, header-token setup, renewal history).
- Source detail operational actions (pause/resume/run/dry-run/replay/backfill/reprocess/clone/edit).
- Tenant diagnostics dashboards for degraded sources, repeated failures, policy blocks, and publish/auth risk.
- Stable deep-link route model for operators to triage sources, runs, and changes quickly.

Reference docs:

- docs/Phase9-MultiTenant-Hardening.md
- docs/Admin-API-Phase9.md
- docs/Phase10-Operator-Product-Layer.md
- docs/Admin-API-Phase10.md
- docs/Workflows-Replay-Backfill-Reprocess.md
- docs/operations/*
- diff_from_prev (jsonb)
- change_type (create, update, delete-logical, reappear)
- run_id
- created_at

12. outbound_events
- id (uuid, pk)
- tenant_id
- source_id
- event_type
- entity_id
- version_id
- payload (jsonb)
- published_at
- bus_message_id
- delivery_status

13. audit_logs
- id (uuid, pk)
- tenant_id
- actor_type (user, system)
- actor_id
- action
- target_type
- target_id
- details (jsonb)
- created_at

Indexes and constraints:
- Unique: (tenant_id, source_id, record_key) on normalized_records.
- Unique: (normalized_record_id, version_no) on record_versions.
- Index: run_executions(source_id, started_at desc).
- Index: page_visits(run_id, depth, url).
- Index: outbound_events(delivery_status, published_at).
- GIN indexes on jsonb fields used for query/filter.

## 5) Source Adapter Model

Adapter interface:
- validateConfig(sourceConfig): ValidationResult
- buildRequests(seedContext): Request[]
- shouldFollowLink(currentUrl, candidateUrl, depth, policy): boolean
- extract(page, fieldConfig): ExtractedRecord[]
- normalize(record): CanonicalRecord
- postProcess(runArtifacts): AdapterSummary

Adapter categories:
- Listing/detail adapters for paginated catalogs.
- Feed-like adapters for repeated cards/rows.
- Single-page adapters for dashboard-like pages.

Selector-first behavior:
- Only fields from source_fields are extracted.
- No unrestricted DOM dump to normalized output.
- Optional raw snapshot retained for audit/debug.

AI-assist scope:
- Suggest selectors during onboarding.
- Detect selector drift and propose candidate fixes.
- Never auto-publish selector changes without operator approval.

## 6) Auth/Session Lifecycle Design

Compliance constraints:
- Only legitimate credentials and sessions provided by operator.
- No bypass modules for CAPTCHA/paywall/anti-bot.
- On challenge or block page, classify and halt source run per policy.

Lifecycle:
1. Operator configures auth_profile and secret references.
2. Session bootstrap activity runs in isolated browser context.
3. Successful login yields session artifacts (cookies/local storage token references) encrypted at rest.
4. Session reused until TTL or invalidation.
5. On 401/redirect-to-login detection, controlled re-auth attempt occurs.
6. Repeated failures trigger source state degraded and alert.

Storage/security:
- Secrets in Vault/KMS-backed store, never plaintext in database.
- Session artifacts encrypted with rotating data keys.
- Strict RBAC on who can trigger auth refresh or view auth metadata.

## 7) Change Detection Design

Canonicalization pipeline:
- Field-level normalization (trim, date parsing, currency normalization, locale handling).
- Deterministic ordering for arrays/objects where order is non-semantic.
- Optional ignore rules for volatile fields (timestamps, counters).

Identity and versioning:
- record_key built from configured unique_key_part fields.
- canonical_hash computed from canonical_json.
- If hash unchanged: update last_seen_at only.
- If hash changed: insert record_versions row and update latest pointer.

Diff output:
- JSON patch-like structure at field level.
- change_type classification for create/update/delete-logical/reappear.
- Significance policy to suppress low-value churn if configured.

Deletion model:
- Soft deletion inferred after N consecutive misses or explicit page signal.
- Deletion emits version and event, preserving historical lineage.

## 8) Export/API/Event Design

API style:
- Fastify REST with OpenAPI first.
- Cursor pagination for large result sets.
- Idempotency keys for mutating endpoints.

Key endpoints:
- POST /v1/sources
- GET /v1/sources/:id
- PATCH /v1/sources/:id
- POST /v1/sources/:id/runs
- GET /v1/sources/:id/runs
- GET /v1/records?sourceId=&updatedSince=
- GET /v1/records/:recordId/versions
- GET /v1/events?sinceCursor=
- POST /v1/webhooks

Event contract:
- event_id
- tenant_id
- source_id
- record_key
- version_no
- event_type
- changed_fields
- emitted_at
- trace_id

Delivery semantics:
- At-least-once delivery from bus.
- Consumers deduplicate via event_id + version_no.
- Dead letter stream with replay tooling.

Low latency path:
- Diff Worker writes version.
- Outbox table transactionally stores event intent.
- Publish Worker reads outbox and publishes within seconds.

## 9) Security Model

Identity and access:
- Tenant-aware RBAC (admin, operator, reader, integration).
- Service-to-service auth via mTLS or signed JWT.

Data security:
- TLS in transit.
- Encryption at rest for database volumes and secret-backed session artifacts.
- Column-level protection for sensitive metadata where needed.

Compliance controls:
- Audit logs for source changes, auth operations, and manual reruns.
- Policy engine blocks disallowed domains or path patterns.
- Explicit source ownership and approval workflow.

Abuse prevention:
- Per-source rate limiting and concurrency ceilings.
- Circuit breaker on repeated block/challenge responses.
- No stealth/evasion techniques included.

## 10) Operational Model for 24/7 Linux

Deployment pattern:
- Containerized services on Linux.
- Local development with Docker Compose.
- Production with Kubernetes or systemd-managed containers.

Runtime SLO targets:
- Scheduler availability: 99.9%+
- Event publication p95 latency: less than 5 seconds from version commit.
- Run success ratio with policy-compliant failures separately tracked.

Observability stack:
- OpenTelemetry SDK in all services.
- Trace propagation: API -> Temporal -> workers -> DB/event bus.
- Metrics examples:
  - run_duration_seconds
  - pages_visited_total
  - extraction_errors_total
  - selector_miss_rate
  - auth_refresh_failures_total
  - publish_lag_seconds
- Structured logs with trace_id, source_id, run_id, tenant_id.

Reliability tactics:
- Temporal retries with bounded exponential backoff.
- Idempotent activities and outbox publisher.
- Graceful shutdown with in-flight checkpointing.
- Point-in-time recovery backups for PostgreSQL.

Runbooks required:
- Source fails authentication.
- Selector drift spike.
- Event backlog growth.
- Database failover and restore.

## 11) Risks, Tradeoffs, and Scaling Notes

Key risks:
- Selector drift on dynamic frontends can increase maintenance load.
- JS-rendered pages increase CPU and memory cost.
- Auth session expiry patterns vary by site and may cause noisy failures.

Tradeoffs:
- Temporal adds operational complexity but provides strong durability and recoverability.
- Playwright provides high compatibility for JS sites but higher resource usage than pure HTTP parsing.
- Versioned storage increases write volume but enables auditability and replay.

Scaling strategy:
- Horizontal scale crawl workers based on source-level queue depth.
- Use per-source concurrency caps to avoid overload or policy violations.
- Partition hot tables by tenant or time when volume grows.
- Move large raw artifacts to object storage and keep references in PostgreSQL.
- Introduce tenant quotas and fair scheduling for multi-tenant isolation.

Recommended upper-bound planning for 50 concurrent sites:
- Crawl worker pool sized for peak JS rendering cost, not average.
- Separate queues for static-heavy and JS-heavy workloads.
- Dedicated browser context limits per node to prevent noisy-neighbor crashes.

## Opinionated Default Decisions

- API framework: Fastify (lean performance profile and strong plugin ecosystem).
- Event bus: NATS JetStream for durable streams and consumer control.
- Auth secret management: HashiCorp Vault or cloud KMS + secret manager.
- ORM/data access: SQL-first migrations with lightweight query builder for control.
- Raw payload retention: 30-90 days in object storage, normalized/versioned records retained longer.

## Minimal Implementation Roadmap

Phase 1:
- Monorepo bootstrap, API + Temporal + crawl worker skeleton.
- Source config, selector extraction, run executions, snapshots.

Phase 2:
- Normalization + versioning + change events.
- Outbox publisher and downstream consumer sample.

Phase 3:
- Auth/session lifecycle hardening.
- Tenant RBAC, quotas, alerting, and SLO dashboards.

Phase 4:
- AI-assisted selector suggestion and drift advisory workflow.
- Operator approval loop and safe rollout controls.

## Non-Goals and Explicit Exclusions

Kovi does not implement:
- CAPTCHA bypass.
- Anti-bot evasion or stealth fingerprint spoofing.
- Credential stuffing or unauthorized access workflows.
- Paywall circumvention.

These are hard policy boundaries in code and operations.
