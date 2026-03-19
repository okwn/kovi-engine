# Source Debugging Guide

## Triage Checklist

1. Check source governance status and policy limits.
2. Inspect latest failed runs and dead-letter pages.
3. Validate session health and auth mode.
4. Run source simulation endpoint with fixture HTML.
5. Compare selector output with prior successful extraction.

## Failure Classification

- fetch_failed
- auth_failed
- parse_failed
- policy_blocked
- publish_failed

## One-Click Retry Guidance

Retry only after root cause is resolved:

- selectors fixed
- policy adjusted
- auth refreshed
- broker/database stable
