## @kovi/extractor-worker (apps/extractor-worker)

**Role**: Static extraction worker and packaged adapter host.

- **What it does**:
  - Executes source adapters for static (non-JS-rendered) extraction flows.
  - Uses `@kovi/source-sdk` to create an adapter registry and run adapters.
  - Discovers and registers packaged adapters, including external ones from `KOVI_ADAPTER_MANIFEST_DIR`.
- **What it should not own**:
  - HTTP APIs (owned by `@kovi/api` / `@kovi/api-core`).
  - Temporal orchestration (owned by `@kovi/orchestrator`).
  - Destination delivery logic (owned by `@kovi/events`).
- **Who should depend on it**:
  - Runtime deployment for static workers.
  - Tests that need to exercise static adapter execution and packaged adapter discovery.

