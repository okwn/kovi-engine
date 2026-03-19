# Rolling Restart Notes

## Safe Order

1. API and Admin
2. Extractor and browser workers
3. Orchestrator

## Strategy

- Drain one instance at a time.
- Keep at least one orchestrator worker healthy.
- Pause tenant traffic for high-risk migrations.

## Verification

- health/ready endpoints healthy
- source runs resume
- delivery lag returns to normal
- no tenant auth failures spike
