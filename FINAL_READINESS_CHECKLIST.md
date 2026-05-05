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
- [X] Both workflows are green on `main` (commit `4144b25d` and successors).
- [ ] **CI workflow patch applied** — `docs/phase-b/ci-workflow.patch` adds three Phase B steps (`runtime-safety` jest, `check:runtime:prod`, `smoke:worker`). The PAT used by build automation lacks `workflow` scope and cannot push to `.github/workflows/*.yml`. *Action:* a maintainer must apply the patch via PR or edit `ci.yml` in the GitHub web UI.

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
- [X] **Phase B**: `npm run test:unit` jest specs landed (`backend/src/config/runtime-safety.spec.ts`, 16 cases).
- [X] **Phase B**: `npm run check:runtime:prod` script landed (`backend/scripts/production-runtime-check.cjs`).
- [X] **Phase B**: `npm run smoke:worker` script landed (`backend/scripts/worker-boot-smoke.cjs`).
- [ ] **Phase B**: the three scripts above wired into CI as required steps. Blocked on the workflow patch above.

## Security Audits and Checks (CI verified)
- [X] `npm run security:secrets` (root + backend) is clean in CI.
- [X] `npm audit --audit-level=high` (root + backend) is clean in CI.
- [X] Runtime safety enforces fail-closed production config. Static unit coverage in `runtime-safety.spec.ts`; live boot coverage in `production-runtime-check.cjs`.
- [X] Container hardening: `Dockerfile.backend` uses multi-stage build, non-root uid 10001, `tini` as PID 1, `HEALTHCHECK` against `/health`.

## DigitalOcean Deployment Preparation (Phase C)
- [X] `DEPLOY_DIGITALOCEAN.md` — full Droplet + Caddy guide with App Platform variant.
- [X] `MONITORING_RUNBOOK.md` — probe targets, alert policies, dashboards, DO setup steps.
- [X] `VERCEL_CUTOVER_PLAN.md` — three-stage cutover with rollback, 7-day watch, 14-day Vercel grace period.
- [X] `infra/digitalocean-bootstrap.sh` — idempotent Droplet bootstrap (Docker, Caddy, ufw, repo clone).
- [X] `infra/Caddyfile.example` — reverse proxy for all 5 hostnames with HSTS.
- [X] `infra/docker-compose.production.yml` — backend + mail-worker + backup-worker + clamav, healthchecked.
- [X] `docs/env/production.env.example` — full prod env template.
- [X] `docs/env/staging.env.example` — full staging env template (`APP_ENV=staging`, all hardening active).
- [X] Name.com DNS records documented (5 A records); existing MX/SPF/DKIM/DMARC explicitly preserved.

## Phase B Operator Scripts (delivered, ready to run)
- [X] `backend/scripts/staging-smoke-summary.mjs` — wraps `smoke:real`; refuses prod-shaped `DATABASE_URL`.
- [X] `backend/scripts/backup-restore-drill.mjs` — disposable-target guard + multi-layer prod-URL refusal.

## Manual / Human-Required (NOT marked complete unless actually performed)
- [ ] **Apply `docs/phase-b/ci-workflow.patch`** via PR (PAT with `workflow` scope or a manual edit on github.com).
- [ ] **DigitalOcean Droplet provisioned** and bootstrap script run successfully.
- [ ] **DO Managed Postgres** created (production + staging clusters) and reachable from the Droplet.
- [ ] **DO Spaces** buckets created (uploads-prod, uploads-staging, backups-prod) and access keys minted.
- [ ] **Name.com DNS records** added (`api`, `staging`, `api-staging` first; `@` and `www` only after Stage 3 of the cutover plan).
- [ ] **Caddy certs** issued by Let's Encrypt for all 5 hostnames.
- [ ] **`docker compose up -d`** successful with all four services healthy.
- [ ] **Real staging smoke run** with `npm run smoke:staging:summary` against `api-staging.projtrack.codes`. *Status:* not yet performed.
- [ ] **Real backup-restore drill** with `node backend/scripts/backup-restore-drill.mjs` from a recent staging backup into a disposable target. *Status:* not yet performed.
- [ ] **Hosting-provider monitoring active** with every alert in `MONITORING_RUNBOOK.md` configured AND test-fired at least once. *Status:* runbook documented, alerts not yet wired.
- [ ] **Stage 2 cutover** (api → DO) completed with 24-hour healthy watch. *Status:* not yet performed.
- [ ] **Stage 3 cutover** (frontend → DO) completed with 7-day healthy watch. *Status:* not yet performed.
- [ ] **Vercel grace period** (14 days post-7-day-healthy) elapsed before deletion. *Status:* not yet started.
- [ ] **Stakeholder review and sign-off** of this checklist and `PRODUCTION_READINESS_AUDIT.md`. *Status:* pending.

## Go / No-Go Criteria
- [X] All CI checks pass on `main`.
- [X] Frontend and backend `npm audit --audit-level=high` clean.
- [X] Runtime-safety unit + live boot coverage scripts landed (CI wiring blocked on workflow patch).
- [X] Worker boot smoke script landed (CI wiring blocked on workflow patch).
- [X] DigitalOcean deployment package complete (docs, infra files, env templates, cutover plan).
- [ ] CI workflow patch applied.
- [ ] DigitalOcean services provisioned and healthy.
- [ ] Real staging smoke executed.
- [ ] Real backup/restore drill executed.
- [ ] Monitoring & alerts active and test-fired.
- [ ] Stakeholder approval recorded.

## Verdict

**CONDITIONAL GO**, conditional on every "Manual / Human-Required" item above.

The codebase, container, runtime configuration, automation scripts, and the
full DigitalOcean deployment package are production-ready. Full GO requires a
real human to:

1. Apply the staged CI workflow patch.
2. Provision DigitalOcean (Droplet + Postgres + Spaces).
3. Run the bootstrap script and `docker compose up -d`.
4. Wire DNS and watch certs issue.
5. Run the staging smoke script against the live staging.
6. Run the backup-restore drill against a real disposable database.
7. Configure every monitoring alert in the runbook and test-fire each one.
8. Execute Stages 2 and 3 of the Vercel cutover plan with the documented watch periods.
9. Sign off.
