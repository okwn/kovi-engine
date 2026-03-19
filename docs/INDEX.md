# Kovi Documentation Index

## Getting Started

- [README](../README.md) - Project overview and quick start
- [Contributor Guide](./Contributor-Guide.md) - How to contribute to Kovi

## Architecture

- [Architecture Overview](./Kovi-Architecture.md) - System design and components
- [Change Delivery](./Kovi-Change-Delivery.md) - Event delivery mechanism
- [ADR: Tenant Isolation](./adr/ADR-0001-tenant-isolation.md) - Multi-tenant design decisions
- [ADR: Contract Versioning](./adr/ADR-0002-contract-versioning.md) - API versioning approach

## Operations

- [Incident Playbook](./operations/Incident-Playbook.md) - How to handle incidents
- [Source Debugging Guide](./operations/Source-Debugging-Guide.md) - Troubleshooting sources
- [Session Recovery Guide](./operations/Session-Recovery-Guide.md) - Auth session troubleshooting
- [Scaling 50+ Sources](./operations/Scaling-50plus-Sources.md) - Performance tuning
- [Backup & Restore](./operations/Backup-Restore-Notes.md) - Data backup procedures
- [Rolling Restart](./operations/Rolling-Restart-Notes.md) - Zero-downtime deployment

## Security

- [Security Checklist](../SECURITY_CHECKLIST.md) - Security review checklist
- [Security Findings](../SECURITY_FINDINGS.md) - Audit findings and recommendations
- [Phase 9 Security Checks](./Security-Checks-Phase9.md) - Security hardening details

## Features

### Phase 9: Multi-Tenant & Governance

- [Multi-Tenant Hardening](./Phase9-MultiTenant-Hardening.md) - Tenant isolation details
- [Admin API (Phase 9)](./Admin-API-Phase9.md) - Operator endpoints
- [Replay/Backfill/Reprocess](./Workflows-Replay-Backfill-Reprocess.md) - Data recovery workflows

### Phase 10: Operator Product Layer

- [Operator Product Layer](./Phase10-Operator-Product-Layer.md) - Admin UI features
- [Admin API (Phase 10)](./Admin-API-Phase10.md) - Enhanced admin endpoints

### Phase 11: Extensible Platform

- [Adapter SDK](../packages/source-sdk/src/sdk/) - SDK for building adapters
- [Destination Plugins](../packages/events/src/destinations/) - Integration framework
- [Template Library](../adapters/templates/) - Starter templates

### Phase 12: Audit & Release

- [Release Readiness](../RELEASE_READINESS.md) - Publication assessment
- [Failure Modes](../FAILURE_MODES.md) - Failure mode analysis
- [Test Gap Report](../TEST_GAP_REPORT.md) - Testing coverage analysis
- [Prioritized Fix Plan](../PRIORITIZED_FIX_PLAN.md) - Improvement roadmap

## Development

- [Testing Matrix](./Testing-Matrix.md) - Test coverage strategy
- [Examples](./examples/) - Usage examples
  - [One Tenant, Multi Source](./examples/One-Tenant-Multi-Source.md)

## API Reference

### Admin API Endpoints

- Source management (CRUD, status, runs)
- Session management (health, reauth, manual import)
- Destination management (CRUD, delivery, replay)
- Tenant management (overview, runs, changes, diagnostics)
- Replay/Backfill/Reprocess jobs
- Selector sandbox
- Onboarding wizard

See [Admin API Phase 10](./Admin-API-Phase10.md) for endpoint details.

## Scripts

- `scripts/scaffold-adapter.mjs` - Create new source adapter
- `scripts/scaffold-destination-plugin.mjs` - Create new destination plugin
- `scripts/adapter-preview.mjs` - Preview adapter extraction
- `scripts/validate-env.ts` - Validate environment configuration
- `scripts/generate-template-library.mjs` - Generate adapter templates
