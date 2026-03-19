# Security Checks (Phase 9)

## Environment Validation

- `pnpm verify:env` validates service config via Zod.
- CI executes env validation before lint/typecheck/test/build.

## Secrets Handling

- Session/token secrets remain externalized through secret references.
- Tenant service tokens are stored as SHA-256 hashes (`tenant_service_tokens.token_hash`).
- No plaintext API token persistence in DB.

## Audit Coverage

Audit events cover:

- session rotations and manual cookie imports
- source state/policy changes
- webhook lifecycle
- replay job creation
- policy violations
- emergency tenant controls

## Rate Limiting

- API and Admin now enforce Fastify rate limits.
- Limits are configurable via env:
  - API_RATE_LIMIT_MAX / API_RATE_LIMIT_WINDOW
  - ADMIN_RATE_LIMIT_MAX / ADMIN_RATE_LIMIT_WINDOW
