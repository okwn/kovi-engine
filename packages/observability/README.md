## @kovi/observability (packages/observability)

**Role**: OpenTelemetry and observability wiring.

- **What it does**:
  - Configures OpenTelemetry tracing and metrics for Kovi services.
  - Provides helpers to bootstrap and shut down OTEL exporters consistently across apps.
  - Encapsulates service naming/versioning conventions used in telemetry.
- **What it should not own**:
  - Business logic, DB access, or routing.
  - Any domain-specific behavior beyond observability concerns.
- **Who should depend on it**:
  - Runtime apps (API, orchestrator, workers, admin) that need consistent tracing/metrics wiring.
  - Tests or tooling that need to verify or work with service telemetry behavior.

