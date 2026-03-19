# Admin API: Phase 10 Operator Surface

All Phase 10 endpoints are scoped under `/admin/api/*` and require tenant service headers:

- `x-kovi-tenant: <tenant-slug>`
- `x-kovi-service-token: <token>`

## Bootstrap and Dashboard

- `GET /admin/api/bootstrap`
  - Returns tenant identity, role, and route permissions.
- `GET /admin/api/dashboard`
  - Returns tenant overview metrics, diagnostics summary, recent runs/changes, replay jobs, and session health.

## Tenant Views

- `GET /admin/api/tenants`
  - Platform admin: all tenants.
  - Tenant admin: current tenant only.
- `GET /admin/api/tenants/:tenantId/overview`
  - Tenant usage, diagnostics, and source inventory.

## Sources and Operations

- `GET /admin/api/sources`
- `GET /admin/api/sources/:sourceId/overview`
- `GET /admin/api/sources/:sourceId/jobs`
- `PATCH /admin/api/sources/:sourceId/config`
- `POST /admin/api/sources/:sourceId/clone`
- `POST /admin/api/sources/:sourceId/pause`
- `POST /admin/api/sources/:sourceId/resume`
- `POST /admin/api/sources/:sourceId/manual-crawl`
- `POST /admin/api/sources/:sourceId/dry-run`
- `POST /admin/api/sources/:sourceId/rotate-session`
- `PATCH /admin/api/sources/:sourceId/operator-state`
- `PATCH /admin/api/sources/:sourceId/selectors`
- `PATCH /admin/api/sources/:sourceId/policy`

## Runs and Changes

- `GET /admin/api/runs`
  - Filters: `sourceId`, `classification`, `status`, `limit`
- `GET /admin/api/changes`
  - Filters: `sourceId`, `limit`

## Diagnostics

- `GET /admin/api/diagnostics`
  - Includes degraded sources, failure concentration, policy blocks, auth/publish failure counts, and browser bottleneck indicators.

## Sessions

- `GET /admin/api/sessions`
- `GET /admin/api/sessions/health`
- `GET /admin/api/sessions/:sourceId`
  - Includes current session state and renewal history.
- `POST /admin/api/sessions/:sourceId/reauth`
- `POST /admin/api/sessions/:sourceId/manual-cookie`
- `POST /admin/api/sessions/:sourceId/header-token`

## Onboarding Wizard

- `GET /admin/api/onboarding/drafts`
- `POST /admin/api/onboarding/drafts`
- `GET /admin/api/onboarding/drafts/:draftId`
- `PATCH /admin/api/onboarding/drafts/:draftId`
- `POST /admin/api/onboarding/drafts/:draftId/validate`
- `POST /admin/api/onboarding/drafts/:draftId/create-source`

Behavior:

- Drafts persist step progress and validation output.
- Validation includes structural checks and policy preflight.
- Source creation is blocked if policy checks fail.

## Selector Sandbox

- `POST /admin/api/sources/:sourceId/selector-sandbox/test`

Inputs:

- optional URL
- optional raw HTML
- option to use latest stored page snapshot
- selector overrides
- required fields list
- compare-with-current option

Response includes:

- page type match
- preview entities
- normalized output preview
- missing required fields
- baseline comparison payload
- canonical URL and entity-key preview

## Replay / Backfill / Reprocess

- `POST /admin/api/replay-jobs`
- `GET /admin/api/replay-jobs`

## Emergency Controls

- `POST /admin/api/emergency/tenant/pause-all`
