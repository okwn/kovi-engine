# Session Recovery Guide

## Modes Supported

- manual-cookie-import
- playwright-form-login
- header-token-injection

## Recovery Steps

1. Check `/sessions/health` and source status.
2. Rotate auth with `/admin/api/sources/:sourceId/rotate-session`.
3. If needed, import cookies via `/sessions/:sourceId/manual-cookie`.
4. Verify session status transitions to `healthy`.
5. Re-run source manually and confirm extraction success.

## Audit Expectations

Each action must emit audit entries:

- session.reauth
- session.rotated
- session.manual_cookie_import
- session.auth.failed
