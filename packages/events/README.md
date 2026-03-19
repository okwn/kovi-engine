## @kovi/events (packages/events)

**Role**: Event/destination management and delivery layer.

- **What it does**:
  - Defines destination plugin interfaces and the `DestinationRegistry`.
  - Implements `DestinationManager` logic to fan-out change events to configured destinations.
  - Integrates with `@kovi/db` to persist destination configurations and delivery records.
  - Validates event envelopes from `@kovi/contracts` before dispatch.
- **What it should not own**:
  - HTTP routing (owned by `@kovi/api-core`).
  - Core adapter logic (owned by `@kovi/source-sdk` / `@kovi/adapter-sdk`).
- **Who should depend on it**:
  - API/core services that need to manage destinations or trigger deliveries.
  - Workers and orchestration components that need to inspect or update destination delivery state.

