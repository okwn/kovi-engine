# Admin/API Phase 9 Additions

## Tenant Auth Headers

Required for all `/v1/*` and `/admin/api/*` endpoints:

- `x-kovi-tenant: <tenant-slug>`
- `x-kovi-service-token: <opaque-token>`

Tokens are validated by SHA-256 hash against `tenant_service_tokens`.

## New Admin Endpoints

- `PATCH /admin/api/sources/:sourceId/policy`
  - Update governance and source policy fields.
- `POST /admin/api/replay-jobs`
  - Create replay/backfill/reprocess jobs.
- `GET /admin/api/replay-jobs`
  - Inspect replay jobs for tenant.
- `GET /admin/api/sources/:sourceId/simulate`
  - Selector simulation against provided HTML payload.
- `POST /admin/api/emergency/tenant/pause-all`
  - Emergency tenant-wide source pause.

## Existing Endpoints Now Tenant Scoped

- `GET /v1/sources`
- `GET /v1/sources/:sourceId/status`
- `GET /v1/sources/:sourceId/entities/latest`
- `GET /v1/entities/:entityId/history`
- `GET /v1/changes/recent`
- `GET|POST|PATCH|DELETE /v1/webhooks`
