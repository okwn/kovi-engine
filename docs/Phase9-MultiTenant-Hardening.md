# Phase 9: Multi-Tenant Hardening

This phase extends Kovi into a private, multi-tenant extraction infrastructure platform while preserving existing architecture.

## Delivered Architecture Extensions

- Tenant isolation model at persistence, API, and event layers.
- Governance policy fields and runtime policy evaluation hook.
- Versioned output contracts with validation and contract negotiation support.
- Replay/backfill/reprocess job model and tenant-scoped replay job APIs.
- Cost/usage accounting primitives for tenant and source levels.
- Operator maturity updates for policy control, simulation, and emergency controls.
- DR and continuity artifacts for backup/restore and service recovery.
- Contributor and ADR documentation for long-term maintainability.

## Multi-Tenant Scope

Primary tenantized models:

- sources
- sessions
- entities
- source_runs
- source_pages
- delivery_events
- change_events
- webhooks
- audit_logs
- dead_letter_pages

Tenant control models:

- tenants
- tenant_memberships
- tenant_service_tokens
- tenant_quotas
- tenant_usage_daily

## Governance and Policy

Source policy fields now include:

- governance_status
- policy_allowed_domains
- policy_crawl_depth_limit
- policy_max_pages_per_run
- policy_auth_required
- policy_export_restrictions
- policy_retention_days

Policy enforcement checkpoints:

- pre-run extraction execution
- orchestrator source scheduling boundary
- delivery publish validation
- replay job creation and audit

## Run Classifications

`source_runs.run_classification` now supports:

- scheduled
- manual
- replay
- backfill
- reprocess

## Contracts

Shared contracts package: `@kovi/contracts`

Current contract types:

- entity.snapshot
- entity.change
- source.run.summary
- source.health

Envelope validation is applied before publish.
