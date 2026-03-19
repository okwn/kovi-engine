## @kovi/api-core (packages/api)

**Role**: Reusable API/business-logic and route layer for the HTTP API.

- **What it does**:
  - Defines Fastify route handlers and HTTP contracts for the API service.
  - Maps between `@kovi/db` rows / `@kovi/events` models and JSON responses.
  - Encapsulates business rules for destinations, deliveries, adapter catalog, etc.
- **What it should not own**:
  - Process bootstrapping (server start, logging, env wiring – owned by `@kovi/api`).
  - Low-level DB implementation details (owned by `@kovi/db`).
  - Event bus integrations (owned by `@kovi/events`).
- **Who should depend on it**:
  - `apps/api` and tests that want to exercise API logic without booting the full server.
  - Other backend code that needs to reuse core route logic.

