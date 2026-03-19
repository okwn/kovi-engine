# Kovi Engine Security Checklist

**Audit Date:** Phase 12 Final Audit
**Auditor:** Automated Review
**Status:** Production Review

## 1. Authentication & Authorization

| Check | Status | Notes |
|-------|--------|-------|
| Session state encrypted at rest | ✅ Pass | AES-256-GCM encryption in `crypto.ts` |
| Tenant service tokens stored as hashes | ✅ Pass | SHA-256 hash storage in DB |
| Session expiry enforced | ✅ Pass | Renewal validation before crawl start |
| Audit logging for auth events | ✅ Pass | Session rotations, imports logged |
| Admin API authenticated | ✅ Pass | Service token middleware |

## 2. Data Protection

| Check | Status | Notes |
|-------|--------|-------|
| Encryption key externalized | ✅ Pass | `SESSION_ENCRYPTION_KEY` env var |
| No plaintext secrets in logs | ⚠️ Review | See Finding SEC-001 |
| TLS for external webhooks | ✅ Pass | HTTPS validation in webhook plugin |
| Canonical URL sanitization | ✅ Pass | URL parsing and normalization |

## 3. Input Validation

| Check | Status | Notes |
|-------|--------|-------|
| URL input validation | ✅ Pass | Domain allowlisting enforced |
| Selector injection protection | ✅ Pass | Cheerio DOM parsing only |
| SQL injection protection | ✅ Pass | Parameterized queries throughout |
| Configuration validation | ✅ Pass | Schema validation on source/adapter |

## 4. Rate Limiting & Resource Protection

| Check | Status | Notes |
|-------|--------|-------|
| API rate limiting | ✅ Pass | Fastify rate limit plugin |
| Admin rate limiting | ✅ Pass | Separate configurable limits |
| Page depth limits | ✅ Pass | Max depth enforcement |
| Page count limits | ✅ Pass | Max pages per run |
| Concurrency controls | ✅ Pass | Global, per-source, per-domain |

## 5. Network Security

| Check | Status | Notes |
|-------|--------|-------|
| Domain allowlisting | ✅ Pass | Required configuration field |
| Internal link pattern enforcement | ✅ Pass | Regex-based URL matching |
| SSRF protection | ⚠️ Review | See Finding SEC-002 |

## 6. Audit & Observability

| Check | Status | Notes |
|-------|--------|-------|
| Audit log persistence | ✅ Pass | PostgreSQL audit_logs table |
| Action coverage | ✅ Pass | Session, source, policy events |
| OpenTelemetry tracing | ✅ Pass | Configurable via env |

## 7. Secret Management

| Check | Status | Notes |
|-------|--------|-------|
| External secret provider support | ✅ Pass | `KOVI_SECRET_*` env pattern |
| No hardcoded credentials | ✅ Pass | All via env/config |
| Session key rotation guidance | ⚠️ Review | See Finding SEC-003 |
