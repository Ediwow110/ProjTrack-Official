# Final Readiness Checklist for ProjTrack Production Deployment

This checklist summarizes the critical items that must be completed or verified before approving ProjTrack for production deployment. It is reconciled against actual CI state on `main`. An item is checked only when there is machine-verifiable evidence (a passing CI job at the head of `main`) or a committed file/code path that satisfies it. Items requiring a real staging run remain unchecked until that run is recorded.

Last reconciled: 2026-05-03 against `main` head SHA `5e16b4b9` (CI green).

## Repository Hygiene
- [X] `.gitignore` updated to prevent commits of generated artifacts, local files, and sensitive data.
- [X] Release hygiene script (`scripts/release-hygiene-check.mjs`) detects forbidden files and secrets.
- [X] `npm run check:release-hygiene` passes locally and in CI (`ci.yml` + `production-candidate.yml`).
- [X] `.dockerignore` (root and `backend/`) excludes secrets, build outputs, and local-only files from the container build context.

## CI Workflow for Linux
- [X] GitHub Actions workflow `production-candidate.yml` runs on `ubuntu-latest` with Node 20 and a Postgres service.
- [X] CI `npm ci` succeeds for root and backend on Linux.
- [X] CI completes all verification steps (frontend build, backend build, tests, Prisma commands) on Linux.

## Frontend Build and Validation
- [X] Frontend typecheck (`npm run typecheck`) passes in CI.
- [X] Frontend environment validation for production (`npm run check:frontend-env:production`) passes in CI.
- [X] Frontend production build (`npm run build:production-fixture`) completes successfully in CI.

## Backend Build, Prisma, and Tests
- [X] Prisma schema validated by `npx prisma validate` in CI.
- [X] Backend build (`npm --prefix backend run build`) succeeds locally and in CI.
- [X] Backend tests (`npm --prefix backend run test`) pass locally and in CI. The current backend `test` script is `production-hardening-checks.cjs`, which exercises `inspectRuntimeConfiguration` and the mail/template/seed regression checks against a synthetic production env.
- [X] Prisma `migrate deploy` runs successfully in CI against the Postgres service container.
- [ ] Dedicated jest unit tests for `runtime-safety.ts`, account-action token crypto, JWT guard role/inactive paths, and auth throttle window math (see `PRODUCTION_READINESS_AUDIT.md` Phase B item P2-1).

## Security Audits and Checks
- [X] Secret scans (`npm run security:secrets`, `npm --prefix backend run security:secrets`) pass with no detected secrets.
- [X] Frontend audit (`npm audit --audit-level=high`) clean (0 vulnerabilities) and runs in CI on every push.
- [X] Backend audit (`npm --prefix backend audit --audit-level=high`) clean (0 vulnerabilities) and runs in CI on every push.
- [X] `runtime-safety.ts` enforces fail-closed production config (HTTPS-only URLs, no localhost in DB/CORS/storage/mail, weak-secret denylist, mismatched `NODE_ENV`/`APP_ENV` blocked, `TRUST_PROXY` required, fail-closed malware scanning required, public S3 buckets blocked, in-memory rate limiting blocked).
- [X] Container image hardened: non-root user, HEALTHCHECK, tini PID 1, separate prod-deps stage. See `Dockerfile.backend`.

## Staging Smoke Readiness
- [X] Smoke test guide (`STAGING_SMOKE_TEST_GUIDE.md`) documents commands for backend, mail, storage, and E2E tests.
- [X] Required staging environment variables documented (`backend/.env.production.example`, `backend/.env.worker.production.example`, `.env.production.example`).
- [ ] Smoke tests executed in staging environment with real credentials (backend, mail, storage, E2E). _Requires a human staging run._
- [ ] Manual validation of auth, upload/submit/review workflows completed in staging. _Requires a human staging run._
- [ ] Backup and restore drill executed against staging using `BACKUP_RUNBOOK.md`. _Requires a human staging run._

## Documentation
- [X] Production deployment guide (`PRODUCTION_DEPLOYMENT_GUIDE.md`) with staging and production instructions.
- [X] Streamlined deployment instructions (`DEPLOYMENT.md`).
- [X] Backup and restore runbook (`BACKUP_RUNBOOK.md`).
- [X] Mailrelay setup and troubleshooting runbook (`MAILRELAY_RUNBOOK.md`).
- [X] Security notes (`SECURITY_NOTES.md`) reflect the current dependency posture (npm audit clean) and current container/runtime hardening.
- [X] Production readiness report (`PRODUCTION_READINESS.md`) documents completed hardening.
- [X] Production readiness audit (`PRODUCTION_READINESS_AUDIT.md`) documents the latest audit pass, Phase A changes, and Phase B backlog.

## Final Commits and Report
- [X] Structured commit messages prepared in `COMMIT_MESSAGES.md`.
- [X] Audit changes (Phase A) committed and CI-verified on `main`.
- [X] Final readiness audit (`PRODUCTION_READINESS_AUDIT.md`) ready for stakeholder review.

## Go/No-Go Criteria for Production
- [X] All CI checks pass on `main` branch (`ci.yml`, `production-candidate.yml`).
- [ ] Staging smoke tests pass with real credentials. _Pending staging run._
- [ ] Backup and restore drill completed successfully in staging with documented results. _Pending staging run._
- [ ] Monitoring setup active with alert thresholds for uptime, errors, and performance. _Pending hosting-provider configuration._
- [X] No unresolved high or critical security vulnerabilities; npm audit clean on both packages and enforced in CI.
- [ ] Stakeholder review and approval of readiness report and security posture. _Pending sign-off._

## Instructions

- **Checklist Completion**: An item is checked only when there is machine-verifiable evidence (CI job, committed file) or a committed code path that satisfies it. Items requiring a real staging run remain unchecked until that run is recorded.
- **Blocker Resolution**: The remaining unchecked items all require either a human staging run, hosting-provider configuration, or stakeholder sign-off. None require additional code changes to clear.
- **Final Review**: Review this checklist alongside `PRODUCTION_READINESS.md` and `PRODUCTION_READINESS_AUDIT.md` before production deployment.
