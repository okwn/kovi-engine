## @kovi/adapter-sdk (packages/adapter-sdk)

**Role**: Extension-facing SDK for building source adapters.

- **What it does**:
  - Builds on `@kovi/source-sdk` and `@kovi/contracts` to provide higher-level utilities for adapter authors.
  - Supplies helper types, test harnesses, and scaffolding support used by the adapter templates and tooling.
- **What it should not own**:
  - Core platform contracts (these live in `@kovi/source-sdk` and `@kovi/contracts`).
  - Worker/orchestrator runtime responsibilities.
- **Who should depend on it**:
  - External adapter authors building packaged adapters to run on the Kovi platform.
  - Internal adapter implementations that want the same authoring ergonomics as external adapters.
- **Main usage**:
  - Import from `@kovi/adapter-sdk` when implementing adapters, rather than depending directly on deeper platform internals.

