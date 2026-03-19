# Phase 10: Operator Product Layer

Date: 2026-03-19

## Objective

Phase 10 turns Kovi from a hardening-focused infrastructure core into a daily operator control plane. The implementation extends Phase 1-9 without redesigning architecture or stack.

## Delivered

- Admin console foundation with authenticated tenant-aware route model.
- Operator-focused dark UI with responsive layout and dense operational views.
- Onboarding wizard draft model with save/resume/validate/create-source flow.
- Selector sandbox with snapshot-backed extraction testing and normalized output preview.
- Session bootstrap and maintenance UX:
  - Manual cookie import
  - Header token injection config
  - Re-auth actions and renewal history visibility
- Source detail operations integrated into UI and APIs:
  - pause/resume
  - run now
  - dry run
  - replay/backfill/reprocess launch
  - relogin
  - clone source
  - config edit endpoint
- Tenant-aware diagnostics and dashboards.
- Tenant-role aware behavior for platform admin versus tenant admin context.

## Schema Additions

Migration: `infra/migrations/008_phase10_operator_product_layer.sql`

New tables:

- `source_onboarding_drafts`
  - Stores wizard draft payload, current step index, and last validation result.
  - Supports resume-later workflows and auditable source creation path.
- `session_renewal_history`
  - Tracks session bootstrap and renewal actions with success/failure outcomes.

## Data Layer Additions

`packages/db/src/index.ts` now includes methods for:

- onboarding draft CRUD and validation state persistence
- tenant overview and diagnostics query helpers
- tenant-scoped runs and changes queries for operator screens
- source create/clone/config update primitives
- latest source snapshot retrieval for selector sandbox
- session renewal history persistence and retrieval

## Admin API Additions (Phase 10)

See: `docs/Admin-API-Phase10.md`

## UX Notes

The UI remains intentionally operator-centric:

- No marketing/landing style components.
- Fast section navigation from a stable route map.
- Explicit loading/error/empty state handling.
- Dense data-first tables and status cards for triage and debugging.

## Compliance and Guardrails

Phase 10 does not add any unsafe extraction behavior:

- No CAPTCHA solving.
- No stealth or anti-bot evasion.
- No unauthorized access logic.
- Policy checks remain mandatory in onboarding validation and runtime flow.

## Validation Snapshot

Local validation after implementation:

- `pnpm -w typecheck`: pass
- `pnpm -w lint`: pass
- `pnpm -w test`: pass
- `pnpm -w build`: pass
