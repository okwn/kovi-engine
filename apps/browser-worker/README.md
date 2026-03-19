## @kovi/browser-worker (apps/browser-worker)

**Role**: JS-rendered extraction worker (Crawlee + Playwright).

- **What it does**:
  - Executes source runs that require a real browser environment.
  - Applies source adapter logic (via `@kovi/source-sdk`) against JS-rendered pages.
  - Enforces crawl policies and emits raw/normalized data into the pipeline.
- **What it should not own**:
  - API or orchestration responsibilities (those live in `@kovi/api`/`@kovi/api-core` and `@kovi/orchestrator`).
  - Destination/event delivery logic (owned by `@kovi/events`).
- **Who should depend on it**:
  - Runtime deployment for browser-based workers.
  - Tests that need to cover browser-based extraction behavior end-to-end.

