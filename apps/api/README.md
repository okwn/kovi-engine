## @kovi/api (apps/api)

**Role**: Runtime Fastify HTTP service.

- **What it does**:
  - Boots the API process (Fastify instance, logging, config, DB, events, observability).
  - Wires in routes and handlers from `@kovi/api-core`.
  - Exposes tenant/operator/admin HTTP endpoints used by external clients and the admin UI.
- **What it should not own**:
  - Database schema or low-level queries (lives in `@kovi/db`).
  - Event contracts or destination logic (lives in `@kovi/contracts` / `@kovi/events`).
  - Business rules that can live in `@kovi/api-core`.
- **Who should depend on it**:
  - Deployment/runtime entrypoints, Docker images, integration tests that exercise the live HTTP surface.
  - Other packages should depend on `@kovi/api-core` instead of importing this app directly.
- **Main entrypoint**:
  - `src/index.ts` – creates and starts the Fastify server via `createKoviApiServer` from `@kovi/api-core`.

