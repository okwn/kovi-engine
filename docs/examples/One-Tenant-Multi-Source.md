# Example: One Tenant with Multiple Sources

Tenant: `acme-retail`

Sources:

1. `acme-catalog-static`
   - adapter: static-catalog
   - fetch mode: static
   - schedule: 15m
2. `acme-pricing-js`
   - adapter: js-listing-detail
   - fetch mode: js
   - schedule: 5m
3. `acme-partner-dashboard`
   - adapter: auth-dashboard
   - fetch mode: js
   - auth: playwright-form-login

Quota profile:

- max_sources: 20
- max_browser_concurrency: 8
- max_event_throughput_per_minute: 1500
- storage_quota_mb: 51200

Typical flow:

1. Tenant service token calls `/v1/sources`.
2. Operator reviews policy and status in admin UI.
3. Manual crawl is triggered for one source.
4. Change events are published with tenant-aware envelope.
5. Replay job is launched in dry-run mode for verification.
