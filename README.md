## Kovi Engine

Selector-first, policy-governed web data extraction infrastructure for multi-tenant, continuous monitoring and downstream-ready events.

Kovi Engine is a production-minded TypeScript monorepo that turns brittle scrapers into durable, auditable, and replayable data pipelines. It combines selector-first extraction, governed source policies, authenticated sessions, Temporal-based orchestration, PostgreSQL-backed state, and downstream event delivery into a single, coherent platform.

---

### Tech stack

- **Language/Runtime**: TypeScript, Node.js
- **Monorepo**: pnpm + Turborepo
- **HTTP/API**: Fastify
- **Workers**: Crawlee + Playwright (JS-rendered) and static extractor workers
- **Orchestration**: Temporal
- **Storage**: PostgreSQL (raw snapshots, normalized entities, versions, deliveries)
- **Eventing**: NATS JetStream or Redis Streams
- **Observability**: OpenTelemetry
- **Package ecosystem**: `@kovi/api`, `@kovi/api-core`, `@kovi/source-sdk`, `@kovi/adapter-sdk`

---

### Why Kovi

Ad-hoc scrapers and one-off scripts do not scale:

- they are fragile under UI changes,
- they lack policy, authorization, and tenant boundaries,
- they do not provide reliable change detection or replay,
- they are difficult to observe, debug, and operate in production.

Browser automation libraries alone are not enough. Production web data extraction requires:

- **policy-governed source execution** with explicit allowed domains and link patterns,
- **permissioned, authenticated sessions** with safe storage and rotation,
- **durable workflows** that can be retried, resumed, and replayed,
- **structured outputs** that are normalized, versioned, and auditable,
- **downstream delivery guarantees** to event buses and integrations,
- **operator tooling** for debugging, backfill, and governance.

Kovi Engine exists to provide that infrastructure: it is not a CAPTCHA bypass or anti-bot evasion system, but a governed, selector-first extraction platform designed for permissioned access and repeatable, downstream-ready data flows.

---

### What Kovi does

- **Governed source execution**
  - Per-source configuration: base URL, allowed domains, internal link patterns, max depth, schedules.
  - Selector-based extraction definitions instead of ad-hoc DOM traversal.
  - Policies enforced at runtime with clear audit trails.

- **Selector-first extraction**
  - Describes what to extract via selectors and contracts, not via brittle DOM code.
  - Supports both static and JS-rendered pages through dedicated workers.

- **Authenticated session handling**
  - Manual cookie import, header token injection, and Playwright form-login workflows.
  - Encrypted session state at rest and validation before runs.
  - Source degradation and alerting when auth fails repeatedly.

- **Durable orchestration**
  - Temporal workflows for scheduling, fan-out, retries, and backoff.
  - Separation between orchestrator, static workers, and browser workers.

- **Raw + normalized + versioned storage**
  - Raw snapshots and metadata for audit/debug.
  - Normalized entities with canonical fields and hashes.
  - Versioned history with change scopes at page/entity/field level.

- **Change detection**
  - Field-level diffs and significance-aware change classification.
  - Versioned event envelopes for downstream consumers.

- **Downstream delivery**
  - Destination management and delivery records.
  - NATS JetStream or Redis Streams for event publication.
  - Webhooks and other destinations with idempotent delivery tracking.

- **Replay, backfill, reprocess**
  - Workflows and APIs for replaying events, backfilling runs, and reprocessing entities.

- **Multi-tenant operator model**
  - Tenant-aware schema and service-token isolation.
  - Governance hooks and cost/usage accounting.

- **Admin/control plane**
  - Admin app for sources, runs, sessions, destinations, and diagnostics.
  - Operator workflows for pause/resume, replay, and debugging.

---

### Architecture overview

Kovi is composed of several cooperating services and packages:

- **API / control plane (`@kovi/api`, `@kovi/api-core`)**
  - Exposes tenant and operator HTTP APIs for managing sources, sessions, runs, and destinations.
  - Implements query endpoints for status, history, and changes.

- **Orchestrator (`@kovi/orchestrator`)**
  - Temporal worker responsible for scheduling, fan-out, retries, and backfill/replay orchestration.

- **Browser worker (`@kovi/browser-worker`)**
  - Crawlee + Playwright worker for JS-rendered pages and complex flows.

- **Extractor worker (`@kovi/extractor-worker`)**
  - Static HTML extractor for non-JS flows.
  - Loads and executes source adapters, including packaged adapters discovered at runtime.

- **Source adapter layer (`@kovi/source-sdk`, `@kovi/adapter-sdk`)**
  - `@kovi/source-sdk`: defines `SourceDefinition`, `SourceAdapter`, `PageType`, `NormalizedEntity`, and core SDK helpers.
  - `@kovi/adapter-sdk`: authoring SDK for adapter/package authors building adapters for Kovi.

- **Events / delivery layer (`@kovi/events`)**
  - Destination registry and manager.
  - Validates envelopes and fan-outs events to configured destinations.

- **Database / state layer (`@kovi/db`)**
  - PostgreSQL access layer and schema mapping.
  - Owns persistence for sources, runs, entities, versions, deliveries, and audit logs.

- **Observability (`@kovi/observability`)**
  - OpenTelemetry wiring, shared tracing and metrics.

- **Admin / operator layer (`@kovi/admin`)**
  - Operator console and APIs for day-to-day operations.

Architecture diagram:

```mermaid
flowchart LR
  subgraph ControlPlane[API / Admin]
    API[@kovi/api<br/>HTTP API]
    ADMIN[@kovi/admin<br/>Operator UI]
  end

  subgraph Orchestration[Temporal Orchestrator]
    ORCH[@kovi/orchestrator]
  end

  subgraph Workers[Workers]
    BW[@kovi/browser-worker<br/>JS-rendered]
    EW[@kovi/extractor-worker<br/>Static]
  end

  subgraph Adapters[Source Adapters]
    SDK[@kovi/source-sdk<br/>@kovi/adapter-sdk]
    PKG[Packaged Adapters<br/>(adapters/ + KOVI_ADAPTER_MANIFEST_DIR)]
  end

  subgraph Storage[State]
    DB[(PostgreSQL)]
  end

  subgraph Events[Events / Destinations]
    EV[@kovi/events]
    BUS[(NATS JetStream / Redis Streams)]
    DOWN[Downstream Consumers]
  end

  Sources((Configured Sources))

  API --> ORCH
  ADMIN --> API

  ORCH --> BW
  ORCH --> EW

  BW --> SDK
  EW --> SDK
  SDK --> PKG

  BW --> DB
  EW --> DB

  EV --> DB
  EV --> BUS --> DOWN

  ORCH --> DB
  API --> DB
  API --> EV
```

---

### Monorepo structure

```text
kovi-engine/
  apps/
    api/              # @kovi/api – HTTP runtime service
    orchestrator/     # @kovi/orchestrator – Temporal workflows/activities
    browser-worker/   # @kovi/browser-worker – JS-rendered extraction worker
    extractor-worker/ # @kovi/extractor-worker – static extraction + packaged adapters
    admin/            # @kovi/admin – operator/admin control plane

  packages/
    api/              # @kovi/api-core – reusable API/business logic and routes
    config/           # @kovi/config – config loading/validation
    contracts/        # @kovi/contracts – event/change contracts
    db/               # @kovi/db – PostgreSQL access and schema mapping
    events/           # @kovi/events – destination registry and delivery manager
    observability/    # @kovi/observability – OpenTelemetry wiring
    shared/           # @kovi/shared – shared utilities and types
    source-sdk/       # @kovi/source-sdk – source adapter contract + core SDK helpers
    adapter-sdk/      # @kovi/adapter-sdk – adapter authoring SDK

  adapters/           # packaged adapters/manifest definitions
  infra/              # docker-compose, migrations, temporal, monitoring
  docs/               # architecture, operations, security, testing docs
```

---

### How it works – lifecycle

1. **Define a source**
   - Configure base URL, allowed domains, internal link patterns, crawl entrypoints, and selectors.

2. **Configure policies and auth**
   - Choose auth strategy (`none`, manual cookie, header token, Playwright form login).
   - Set policy constraints (max depth, allowed domains, schedules).

3. **Orchestrate runs**
   - Temporal orchestrator triggers runs on a schedule or on-demand.
   - Static and browser workers pick up work based on fetch mode.

4. **Fetch + extract**
   - Workers fetch pages (static or JS-rendered) for configured entrypoints and allowed internal links.
   - Source adapters (via `@kovi/source-sdk` / `@kovi/adapter-sdk`) apply selectors and map raw HTML to normalized entities.

5. **Normalize + persist**
   - Entities are normalized into canonical shapes.
   - Raw snapshots, normalized entities, and versions are persisted in PostgreSQL.

6. **Detect changes**
   - Change detection computes diffs at page/entity/field level.
   - Versioned events are produced for meaningful changes.

7. **Deliver downstream**
   - `@kovi/events` routes events via NATS JetStream or Redis Streams, and to configured destinations/webhooks.
   - Delivery state is tracked for retries, dead-lettering, and replay.

8. **Replay / backfill / reprocess**
   - Orchestrator and API expose controls to replay deliveries, backfill historical runs, and reprocess entities with updated logic.

---

### Key technical decisions

- **TypeScript monorepo**: single, strict-TS codebase for all services, SDKs, and contracts to keep types aligned across layers.
- **pnpm + Turborepo**: fast workspace installs and orchestrated `lint`, `typecheck`, `test`, `build` pipelines across apps and packages.
- **Crawlee + Playwright**: separates static and JS-rendered fetch paths with battle-tested crawling primitives.
- **Temporal**: explicit workflows and activities for durable, observable orchestration with retries, backoff, and replay.
- **PostgreSQL**: single source of truth for configs, runs, snapshots, entities, versions, and deliveries.
- **Redis Streams / NATS JetStream**: streaming backbones for low-latency change delivery and downstream consumption.
- **OpenTelemetry**: unified tracing/metrics across API, orchestrator, workers, DB, and eventing.

---

### Local development setup

1. **Clone and install**

```bash
git clone <repo-url>
cd kovi-engine

corepack enable
corepack use pnpm@9.12.0
pnpm install
```

2. **Configure environment**

```bash
cp .env.example .env
```

3. **Start local infrastructure**

```bash
docker compose -f infra/docker-compose/docker-compose.yml up -d
```

4. **Run full pre-PR checks (recommended)**

```bash
pnpm check
# equivalent to:
# pnpm verify:env && pnpm verify:migrations && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

5. **Run services (separate terminals)**

```bash
pnpm --filter @kovi/api dev
pnpm --filter @kovi/orchestrator dev
pnpm --filter @kovi/extractor-worker dev
pnpm --filter @kovi/browser-worker dev
pnpm --filter @kovi/admin dev
```

6. **Useful scripts**

- **Validation**
  - `pnpm verify:env` – env/config validation via `@kovi/config`.
  - `pnpm verify:migrations` – checks `infra/migrations` directory and migration naming.
  - `pnpm lint` – ESLint across all apps/packages.
  - `pnpm typecheck` – TypeScript typecheck across the monorepo.
  - `pnpm test` – Vitest tests for packages that define tests.
  - `pnpm build` – build all apps and packages via `tsc`.

- **Formatting**
  - `pnpm format` – Prettier across the repo.

---

### Contributor workflow

- **Workspace expectations**
  - This is a pnpm workspace with Turborepo; always run commands via `pnpm` from the repo root.
  - Apps live in `apps/`; shared libraries and SDKs live in `packages/`.

- **Package boundaries**
  - Use `@kovi/api-core` from services/tests, not `apps/api` internals.
  - Use `@kovi/source-sdk` / `@kovi/adapter-sdk` for adapter contracts and authoring.
  - Use `@kovi/db` for DB access; do not inline SQL in services.
  - Use `@kovi/events` for destination and event delivery logic.

- **Pre-PR checks**
  - Run `pnpm check` before opening a PR.
  - Keep lint (`@typescript-eslint`), strict TS, and `import type` discipline intact; do not weaken rules to “make it pass”.

- **Adding adapters**
  - Use the adapter scaffolding scripts (see `scripts/` and `docs/Contributor-Guide.md`).
  - Implement contracts using `@kovi/adapter-sdk` / `@kovi/source-sdk`.
  - When shipping packaged adapters, ensure manifests validate against `PackagedAdapterManifest`.

- **Adding tests**
  - Use Vitest for unit/integration tests in `packages/*`.
  - Prefer testing business logic and contracts over incidental implementation details.

For more detail, see `CONTRIBUTING.md` and `docs/Contributor-Guide.md`.

---

### Safety and governance

Kovi is designed for **permissioned access** and **governed source execution**:

- No stealth/evasion modules are implemented.
- No CAPTCHA solving, anti-bot bypass, or unauthorized access logic is included.
- Authenticated access is supported only via operator-provided credentials and session state.
- Crawls are explicit and policy-bound: only configured selectors are extracted, and link traversal is constrained by source policies.
- Multi-tenant boundaries, service tokens, governance fields, and audit logs are first-class concerns.

This repository does **not** position itself as an anti-bot evasion framework. It is infrastructure for safe, governed extraction in environments where access is permitted and controlled.

---

### Current maturity

Kovi Engine is **production-minded infrastructure** with:

- Implemented:
  - Multi-tenant schema and governance hooks.
  - Static + JS-rendered extraction workers.
  - Selector-first adapters and SDKs (`@kovi/source-sdk`, `@kovi/adapter-sdk`).
  - Temporal-based orchestration and retry semantics.
  - Raw + normalized + versioned storage in PostgreSQL.
  - Change-detection and event-raising contracts.
  - Destination management and delivery tracking.
  - Admin/operator workflows and docs (runbooks, testing matrix, security checklists).
  - Strict lint/typecheck/build/test pipelines.

- Still evolving/hardening:
  - Broader adapter catalog and destination ecosystem.
  - Additional operator UX refinements.
  - Expanded E2E and contract/integration test coverage.
  - Performance tuning and scale testing for higher source volumes.

---

### Roadmap (high level)

- **Core platform foundation**
  - Continue refining adapter contracts and worker orchestration.
  - Harden migrations and schema evolution paths.

- **Multi-tenant governance**
  - Richer policy modeling.
  - More granular service-token/RBAC constraints.
  - Expanded audit and cost/usage reporting.

- **Operator control plane**
  - Deeper admin dashboards for source health, change volume, and cost.
  - Self-serve source onboarding flows and selector sandbox improvements.

- **Adapter ecosystem**
  - Additional first-party packaged adapters.
  - Improved templates and tooling for adapter authors.
  - Marketplace-style catalog surfacing adapter capabilities.

- **Destination/integration framework**
  - More destination plugins (message buses, warehouses, webhooks).
  - Stronger contract validation for downstream integrations.

- **Reliability hardening**
  - Extended chaos and failure-mode testing.
  - Automated runbook hooks and recovery playbooks.

- **Developer ergonomics**
  - More scaffolding scripts.
  - Expanded documentation around internal packages and SDKs.

---

### Example use cases

- **Internal monitoring pipelines**
  - Track changes in partner sites, docs, or product catalogs where you have permission to access data.

- **Authenticated operational dashboards**
  - Monitor internal or partner dashboards behind authentication and publish structured changes to internal systems.

- **Structured data feeds for downstream apps**
  - Normalize web data into stable event contracts and feed analytics, search, or notification systems.

- **Change tracking systems**
  - Maintain versioned histories of entities and pages with field-level diffs for audits or review workflows.

- **Admin/operator inspection workflows**
  - Use the admin control plane to debug sources, inspect sessions, replay deliveries, and manage policies.

---

### Documentation index

- **Architecture**
  - `docs/Kovi-Architecture.md`
- **Governance and security**
  - `docs/Phase9-MultiTenant-Hardening.md`
  - `SECURITY_CHECKLIST.md`
  - `SECURITY_FINDINGS.md`
- **Operations and failure modes**
  - `FAILURE_MODES.md`
  - `docs/operations/Incident-Playbook.md`
  - `docs/operations/Source-Debugging-Guide.md`
  - `docs/operations/Session-Recovery-Guide.md`
- **Quality and readiness**
  - `RELEASE_READINESS.md`
  - `TEST_GAP_REPORT.md`
  - `PRIORITIZED_FIX_PLAN.md`
  - `FINAL_CHECK_RESULTS.md`
- **Contributing**
  - `CONTRIBUTING.md`
  - `docs/Contributor-Guide.md`
  - `docs/Testing-Matrix.md`

---

### Closing

Kovi Engine is infrastructure for **repeatable, governed, downstream-ready extraction workflows** – not a collection of scripts. If you care about selector-first extraction, tenant-aware policies, and clean event-based integrations, this repository is designed to give you a solid, production-minded foundation to build on.
