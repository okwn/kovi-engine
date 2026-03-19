## @kovi/orchestrator (apps/orchestrator)

**Role**: Temporal orchestration worker.

- **What it does**:
  - Hosts Temporal workflows and activities that coordinate source runs, retries, backoff, and replay/backfill tasks.
  - Talks to DB, workers, and events to drive the end-to-end extraction pipeline.
- **What it should not own**:
  - HTTP API surface (owned by `@kovi/api` / `@kovi/api-core`).
  - Low-level extraction logic (owned by workers and `@kovi/source-sdk`).
  - Destination delivery logic (owned by `@kovi/events`).
- **Who should depend on it**:
  - Deployment/runtime environments for the Temporal worker.
  - Tests that need to exercise real workflow behavior.
  - Other packages should depend on shared contracts/DB/events packages rather than importing this app directly.

