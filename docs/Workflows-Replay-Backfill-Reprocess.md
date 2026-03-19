# Replay, Backfill, and Reprocess Workflows

## Job Model

`replay_jobs` tracks jobs independent of normal crawl runs.

Fields include:

- tenant_id
- source_id
- job_type (replay|backfill|reprocess)
- dry_run
- status
- idempotency_key
- params
- result_summary

## Flow

1. Operator submits job via admin API.
2. Job is recorded with idempotency key.
3. Workflow runner (Temporal) picks up job.
4. Job updates status queued -> running -> completed|failed.
5. Results and audit entries are persisted.

## Dry Run

Use `dryRun=true` to compute affected records/events without side effects.

## Idempotency

- Replay job requests use unique idempotency keys.
- Delivery idempotency remains enforced on downstream event records.
- Replay consumers should still dedupe by event `idempotencyKey`.
