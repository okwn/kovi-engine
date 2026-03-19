# Testing Matrix

## Matrix Axes

- source adapters: static-catalog, js-listing-detail, auth-dashboard
- auth modes: none, manual-cookie-import, playwright-form-login, header-token-injection
- delivery modes: nats-jetstream, redis-streams
- replay modes: replay, backfill, reprocess

## Required Levels

- unit: selector parsing, policy engine, contract validation
- integration: auth bootstrap, event publish, DB integration paths
- e2e: tenant-scoped API flows and policy-gated execution

## Fixture Library

Use `packages/source-sdk/tests/fixtures/websites/*` for repeatable parser and auth-flow tests.
