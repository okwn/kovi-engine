## @kovi/contracts (packages/contracts)

**Role**: Event and API contract definitions.

- **What it does**:
  - Defines versioned event envelopes (`EventEnvelope`) and change detection contracts used between services and destinations.
  - Provides type-safe shapes for change scopes, field changes, and other shared domain concepts.
  - Serves as the single source of truth for event contract types consumed by `@kovi/events`, `@kovi/api-core`, and SDKs.
- **What it should not own**:
  - DB access code (owned by `@kovi/db`).
  - HTTP endpoints (owned by `@kovi/api-core`).
  - Adapter contracts (owned by `@kovi/source-sdk`).
- **Who should depend on it**:
  - Any service or SDK that needs to emit, consume, or validate events in the Kovi change-delivery format.

