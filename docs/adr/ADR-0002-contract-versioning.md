# ADR-0002: Output Contract Versioning

Status: accepted
Date: 2026-03-19

## Decision

Adopt explicit contractType + contractVersion fields in event envelopes and validate payload shape before publish.

## Rationale

- Downstream consumers need stable data products.
- Validation prevents malformed emissions from reaching broker consumers.
- Versioning supports non-breaking evolution and controlled deprecations.

## Consequences

- Contract changes require schema updates in `@kovi/contracts`.
- New major versions require compatibility docs and migration guidance.
