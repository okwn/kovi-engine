## @kovi/db (packages/db)

**Role**: PostgreSQL access layer and schema mapping.

- **What it does**:
  - Provides a typed database client (`KoviDatabase`) with methods for working with tenants, sources, runs, snapshots, entities, deliveries, and destinations.
  - Encapsulates SQL queries and mappings from database rows to TypeScript types (e.g. `DestinationRow`, `AdapterCatalogRow`).
  - Owns schema-level concerns together with `infra/migrations`.
- **What it should not own**:
  - HTTP or business-logic routing (owned by `@kovi/api-core` and services).
  - Event/destination semantics (owned by `@kovi/events`).
- **Who should depend on it**:
  - Backend services (API, orchestrator, workers) that need to query or update PostgreSQL.
  - Tests that exercise persistence behaviors.

