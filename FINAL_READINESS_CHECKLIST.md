# Final Readiness Checklist for ProjTrack Production Deployment

This checklist tracks production-readiness items and explicitly distinguishes
**verified-in-CI** evidence from **manual / human-only** checks. Items in the
manual section are NOT marked complete unless a real run was performed.

## Repository Hygiene
- [X] `.gitignore` updated to prevent commits of generated artifacts and sensitive data.
- [X] Release hygiene script (`scripts/release-hygiene-check.mjs`) detects forbidden files and secrets.
- [X] `npm run check:release-hygiene` is green in CI on every push.

## CI Workflow on Linux
- [X] `.github/workflows/ci.yml` runs frontend, backend, and e2e jobs on Ubuntu with Node 20 and Postgres 16.
- [X] `.github/workflows/production-candidate.yml` runs the production-candidate verification on Linux.
- [X] Both workflows are green on `main` (commit `59b77997` and successors).

## Frontend Build and Validation (CI verified)
- [X] Frontend typecheck (`npm run typecheck`) passes in CI.
- [X] Frontend production env validation (`npm run check:frontend-env`) passes in CI.
- [X] Frontend build (`npm run build`) succeeds in CI.
- [X] Frontend `npm audit --audit-level=high` is clean in CI.

## Backend Build, Prisma, and Tests (CI verified)
- [X] `npx prisma validate` and `npx prisma generate` pass in CI.
- [X] `npx prisma migrate deploy` applies all 10 migrations against the CI Postgres service.
- [X] Backend build (`npm run build`) succeeds in CI.
- [X] `npm test` (production-hardening-checks.cjs) passes in CI.
- [X] **Phase B**: `npm run test:unit` (jest) — covers `runtime-safety.spec.ts` with 15+ negative production cases. *Evidence:* `backend/src/config/runtime-safety.spec.ts`.
- [X] **Phase B**: `npm run check:runtime:prod` — boots `dist/main.js` under `NODE_ENV=production`, asserts `/health` is 200, and asserts boot is rejected for 10 unsafe permutations. *Evidence:* `backend/scripts/production-runtime-check.cjs`, CI step "Production runtime boot check".
- [X] **Phase B**: `npm run smoke:worker` — boots `dist/worker.js`, asserts ready log + clean SIGTERM, and asserts fail-fast when `DATABASE_URL` is missing. *Evidence:* `backend/scripts/worker-boot-smoke.cjs`, CI step "Worker boot smoke".

## Security Audits and Checks (CI verified)
- [X] `npm run security:secrets` (root + backend) is clean in CI.
- [X] `npm audit --audit-level=high` (root + backend) is clean in CI.
- [X] Runtime safety enforces fail-closed production config (HTTPS-only URLs, no-localhost, weak-secret denylist, TRUST_PROXY required, malware scan enforced, public-S3 blocked, Mailrelay required). Static unit coverage in `runtime-safety.spec.ts`; live boot coverage in `production-runtime-check.cjs`.
- [X] Container hardening: `Dockerfile.backend` uses multi-stage build, non-root uid 10001, `tini` as PID 1, `HEALTHCHECK` against `/health`. Documented in `PRODUCTION_READINESS_AUDIT.md`.

## Phase B Automation Scripts (delivered, ready to run)
- [X] `backend/scripts/production-runtime-check.cjs` — exercised in CI on every push.
- [X] `backend/scripts/worker-boot-smoke.cjs` — exercised in CI on every push.
- [X] `backend/scripts/staging-smoke-summary.mjs` — wraps `smoke:real` with PASS/FAIL summary; refuses to run on prod-shaped `DATABASE_URL`. Requires staging credentials, not exercised in CI.
- [X] `backend/scripts/backup-restore-drill.mjs` — `pg_dump` + restore into a disposable target; refuses to run unless `BACKUP_DRILL_CONFIRM_DISPOSABLE=YES_I_UNDERSTAND` and the target URL contains a disposable hint and matches no production pattern. Requires real source/target databases; not exercised in CI.

## Documentation
- [X] `DEPLOYMENT.md` — deployment commands; updated with Phase B verification commands.
- [X] `PRODUCTION_READINESS_AUDIT.md` — Phase A + Phase B execution status and evidence map.
- [X] `SECURITY_NOTES.md` — current dependency/security posture (npm audit clean; no xlsx; Nest 11; exceljs).
- [X] `BACKUP_RUNBOOK.md` — backup and restore procedures.
- [X] `MAILRELAY_RUNBOOK.md` — Mailrelay setup and troubleshooting.

## Manual / Human-Required (NOT marked complete unless actually performed)
- [ ] **Real staging smoke run** with `npm run smoke:staging:summary` against the staging backend, with real staging accounts. *Status:* not yet performed.
- [ ] **Real backup-restore drill** with `npm run drill:backup-restore` from a recent staging backup into a disposable target. *Status:* not yet performed.
- [ ] **Hosting-provider monitoring active** with alert thresholds for: API unavailable, DB unavailable, queue backlog, mail/backup worker stopped, backup stale, disk high, 5xx rate, auth-failure rate. *Status:* runbook documented, alerts not yet wired.
- [ ] **Stakeholder review and sign-off** of this checklist and `PRODUCTION_READINESS_AUDIT.md`. *Status:* pending.

## Go / No-Go Criteria
- [X] All CI checks pass on `main`.
- [X] Frontend and backend `npm audit --audit-level=high` clean.
- [X] Runtime-safety unit + live boot coverage in CI.
- [X] Worker boot smoke in CI.
- [ ] Real staging smoke executed.
- [ ] Real backup/restore drill executed.
- [ ] Monitoring & alerts active in production.
- [ ] Stakeholder approval recorded.

## Verdict

**CONDITIONAL GO**, conditional on the four "Manual / Human-Required" items above.

The codebase, container, runtime configuration, and CI gates are production-ready and exercised on every push. Full GO requires a real human to run the staging smoke wrapper, run the backup-restore drill against a disposable database, wire alerts to the documented thresholds, and sign off.
