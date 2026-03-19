# Incident Playbook

## Severity Levels

- P1: platform unavailable or data isolation risk.
- P2: partial extraction outage or delayed delivery.
- P3: degraded diagnostics or non-critical failures.

## Immediate Actions

1. Confirm blast radius by tenant and source.
2. Pause affected tenant or source set.
3. Capture current queue depth, run failure rates, and DB latency.
4. Open incident timeline and owner assignment.

## Common Failure Patterns

- Broker down: switch to pending-only delivery mode, continue durable DB writes.
- DB slow: pause browser-heavy tenants first, reduce global concurrency.
- Browser pool exhaustion: downgrade sources to static where possible and queue browser jobs.

## Recovery

1. Restore dependencies.
2. Resume paused tenants in batches.
3. Trigger replay jobs for missed downstream windows.
4. Verify tenant usage and delivery lag return to baseline.
