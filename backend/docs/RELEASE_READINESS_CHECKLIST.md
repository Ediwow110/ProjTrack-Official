# Release Readiness Checklist

This checklist tracks the remaining work after the auth/controller fix, readiness probes, and build hygiene updates.

## Confirmed complete

- [x] Frontend typecheck passes
- [x] Frontend production build passes
- [x] Backend TypeScript build passes
- [x] Backend smoke suite verifies health, login, refresh/logout rotation, throttling, profile persistence, and file upload/download/delete
- [x] Login works for seeded admin, teacher, and student accounts
- [x] Backend liveness/readiness endpoints distinguish service reachability from dependency readiness
- [x] Frontend admin route `/admin/bootstrap-guide` resolves to a real page
- [x] Frontend/backend build validation is wired into CI
- [x] Backend source runtime is Prisma/PostgreSQL-oriented rather than in-memory/file-backed
- [x] Prisma migration history is checked in and the local database reports zero pending migrations
- [x] Refresh-token rotation/revocation storage is active
- [x] Auth rate limiting is active for login and password-reset flows
- [x] File storage supports S3-compatible object storage with signed downloads
- [x] Structured logging and request correlation IDs are active
- [x] Browser E2E smoke coverage for role login and protected-route redirect is checked in and wired into CI

## Release blockers still open

- [ ] Replace stub/default mail path with verified provider configuration plus retry/backoff handling
- [ ] Keep browser E2E smoke green in CI/staging and expand it from auth smoke into broader workflow coverage

## Hardening still recommended

- [ ] Run `prisma migrate deploy` in a fresh staging environment and confirm `/health/database` stays green after deploy
- [ ] Validate report aggregates against production-like data
- [ ] Add date-range filtering and heavier-query optimization for reports
- [ ] Review admin system tools and keep unsafe ones feature-flagged in production
- [ ] Run staging deployment smoke tests with migrations, storage, and mail enabled
