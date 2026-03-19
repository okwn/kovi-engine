# ADR-0001: Tenant Isolation Model

Status: accepted
Date: 2026-03-19

## Decision

Use tenant_id as a mandatory partition key on all operational tables that contain tenant-owned data.

## Rationale

- Strong logical isolation across scheduling, crawling, storage, and delivery.
- Enables tenant-level quotas, emergency controls, and billing/usage accounting.
- Simplifies audit and compliance evidence.

## Consequences

- API and admin middleware must enforce tenant context on all tenant routes.
- All new tables must include tenant_id unless they are explicitly global metadata.
