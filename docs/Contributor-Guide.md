# Contributor Guide

## Module Ownership Boundaries

- `packages/source-sdk`: adapter contracts, normalization, policy checks.
- `apps/orchestrator`: workflow and runtime scheduling.
- `packages/events` + `packages/contracts`: delivery and contract enforcement.
- `packages/db`: storage/query and tenant isolation guarantees.

## Coding Rules

- Keep selector-first extraction model.
- Do not add bypass/evasion capabilities.
- Add migration + docs for any schema change.
- Add tests for adapter/auth/delivery/replay impacted areas.

## Deprecation Policy

- Contract versions remain supported for at least one minor release.
- Adapter or field deprecations require docs and migration path.
- Mark deprecated APIs in docs before removal.
