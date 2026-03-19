## @kovi/config (packages/config)

**Role**: Configuration loading and validation.

- **What it does**:
  - Loads environment variables and maps them into strongly-typed config objects for each service (API, workers, orchestrator, admin).
  - Uses schema validation to ensure required settings are present and well-formed.
  - Powers `scripts/validate-env.ts` used in CI and local checks.
- **What it should not own**:
  - Business logic related to how config is used (owned by each service).
  - Database or event contracts.
- **Who should depend on it**:
  - All runtime apps that need service-specific configuration (API, workers, orchestrator, admin).
  - Validation scripts and tests that require canonical service config.

