## @kovi/admin (apps/admin)

**Role**: Operator/admin control-plane application.

- **What it does**:
  - Provides UI and supporting API surface for operators to manage tenants, sources, sessions, runs, and destinations.
  - Consumes APIs from `@kovi/api` and exposes additional admin-only routes where appropriate.
- **What it should not own**:
  - Core business/domain logic that belongs in `@kovi/api-core` or shared packages.
  - Low-level DB/event integration (use `@kovi/db`, `@kovi/events`, `@kovi/shared` instead).
- **Who should depend on it**:
  - Deployment/runtime for the admin console.
  - Frontend or end-to-end tests that exercise operator workflows.

