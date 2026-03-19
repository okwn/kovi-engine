## @kovi/source-sdk (packages/source-sdk)

**Role**: Platform-level source adapter contract and core SDK helpers.

- **What it does**:
  - Defines the canonical source adapter interfaces and types: `SourceDefinition`, `SourceAdapter`, `PageType`, `NormalizedEntity`, `ExtractionContext`, etc.
  - Provides helper utilities for normalization, extraction, pagination, identity, and test harnesses for adapters.
  - Validates and loads packaged adapter manifests (`PackagedAdapterManifest`) for use by workers.
- **What it should not own**:
  - HTTP routes or API concerns (owned by `@kovi/api-core`).
  - Destination/event delivery logic (owned by `@kovi/events`).
  - UI or orchestration responsibilities.
- **Who should depend on it**:
  - Workers (`@kovi/browser-worker`, `@kovi/extractor-worker`), orchestrator, and other platform services.
  - Internal adapters and platform components that need direct access to the core adapter contract.
  - External adapter authors may depend on this, but should generally prefer `@kovi/adapter-sdk` for higher-level APIs.

