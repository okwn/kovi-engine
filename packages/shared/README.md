## @kovi/shared (packages/shared)

**Role**: Shared utilities and common types.

- **What it does**:
  - Provides cross-cutting helpers (e.g. logging, health types, small utilities) used across services.
  - Hosts simple, low-level primitives that do not belong to a more specific domain package.
- **What it should not own**:
  - Domain-specific concepts that have a dedicated package (`@kovi/db`, `@kovi/events`, `@kovi/source-sdk`, etc.).
  - HTTP routing or DB access.
- **Who should depend on it**:
  - Any service or package that needs generic utilities or shared types without pulling in heavier dependencies.

