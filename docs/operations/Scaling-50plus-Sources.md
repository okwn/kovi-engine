# Scaling Guide: 50+ Sources

## Capacity Strategy

- Separate static and browser queues.
- Enforce per-tenant browser quotas.
- Use tenant-level pause controls for noisy neighbors.

## Recommended Controls

- ORCH_GLOBAL_PAGE_CONCURRENCY tuned by host CPU/network.
- ORCH_BROWSER_WORKER_CONCURRENCY capped below browser saturation threshold.
- Per-source concurrency low by default (2-4) with auto recommendations.

## Metrics to Watch

- run duration trend
- dead-letter growth
- browser minutes per tenant
- event backlog and replay lag
- storage growth by source and tenant

## Adaptive Polling

Lower frequency for stale or low-change sources.
Increase frequency for high-change, high-value sources only.
