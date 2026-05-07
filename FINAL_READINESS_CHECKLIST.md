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
- [X] `ci.yml` backend job uses `SMOKE_ADMIN_IDENTIFIER` (fixed from `SMOKE_ADMIN_EMAIL` — committed to branch).
- [X] Both workflows use admin-only smoke secrets; teacher/student credentials are generated during `seed:smoke`.
- [ ] **GitHub Actions admin smoke secrets configured** — `SMOKE_ADMIN_IDENTIFIER`, `SMOKE_ADMIN_PASSWORD` must be added as repository secrets. This is the **only blocker** for CI green. Go to: `Settings → Secrets and variables → Actions → New repository secret`.
- [ ] **CI workflow green** — re-run after adding secrets above.
- [ ] **Production Checks workflow green** — re-run after adding secrets above.

## Frontend Build and Validation (CI verified — frontend job green)
- [X] Frontend typecheck (`npm run typecheck`) passes.
- [X] Frontend production env validation (`npm run check:frontend-env`) passes.
- [X] Frontend build (`npm run build`) succeeds.
- [X] Frontend `npm audit --audit-level=high` is clean.

## Backend Build, Prisma, and Tests (CI verified — backend job green)
- [X] `npx prisma validate` and `npx prisma generate` pass.
- [X] `npx prisma migrate deploy` applies all migrations against the CI Postgres service.
- [X] Backend build (`npm run build`) succeeds.
- [X] `npm test` (production-hardening-checks.cjs) passes.
- [X] `npm run test:unit` jest specs pass — 16 suites, 265 tests.
- [X] `npm run check:runtime:prod` script passes.
- [X] `npm run smoke:worker` script passes.
- [X] `npm run check:boot:production` and `npm run check:boot:worker` pass.

## Security Audits and Checks (CI verified — backend job green)
- [X] `npm run security:secrets` (root + backend) is clean.
- [X] `npm audit --audit-level=high` (root + backend) is clean — 0 vulnerabilities.
- [X] Runtime safety enforces fail-closed production config.
- [X] Container hardening: `Dockerfile.backend` uses multi-stage build, non-root uid 10001, `tini` as PID 1, `HEALTHCHECK`.

## E2E Smoke (local green; CI blocked on missing repo secrets)
- [X] `npm run check:smoke-env` fails loudly when admin secrets are missing (no skip-green possible).
- [X] `npm run seed:smoke` generates teacher/student credentials idempotently.
- [X] `npm run e2e:smoke` passed locally: auth-smoke 5/5, portal-navigation 4/4, workflow-smoke 4/4.
- [X] `npm run e2e:responsive` passed locally: 24/24.
- [X] `npm run e2e:responsive:auth` passed locally: 9/9.
- [ ] **Same smoke must pass in GitHub Actions** (blocked on missing repo secrets — see above).

## DigitalOcean Deployment Preparation
- [X] `DEPLOY_DIGITALOCEAN.md` — full Droplet + Caddy guide.
- [X] `MONITORING_RUNBOOK.md` — probe targets, alert policies, dashboards, DO setup steps.
- [X] `VERCEL_CUTOVER_PLAN.md` — three-stage cutover with rollback.
- [X] `infra/digitalocean-bootstrap.sh` — idempotent Droplet bootstrap.
- [X] `infra/Caddyfile.example` — reverse proxy for all 5 hostnames.
- [X] `infra/docker-compose.production.yml` — backend + mail-worker + backup-worker + clamav.
- [X] `docs/env/production.env.example` — full prod env template.
- [X] `docs/env/staging.env.example` — full staging env template.

## Manual / Human-Required (NOT marked complete unless actually performed)
- [ ] **Add GitHub Actions secrets** — `SMOKE_ADMIN_IDENTIFIER` and `SMOKE_ADMIN_PASSWORD`. See `docs/GITHUB_ACTIONS_SMOKE_SECRETS.md` for step-by-step instructions. This is the single action that unblocks CI green.
- [ ] **Re-run CI and Production Checks** after adding secrets above.
- [ ] **DigitalOcean Droplet provisioned** and bootstrap script run successfully.
- [ ] **DO Managed Postgres** created (production + staging clusters) and reachable from the Droplet.
- [ ] **DO Spaces** buckets created (uploads-prod, uploads-staging, backups-prod) and access keys minted.
- [ ] **Name.com DNS records** added.
- [ ] **Caddy certs** issued by Let's Encrypt for all 5 hostnames.
- [ ] **`docker compose up -d`** successful with all four services healthy.
- [ ] **Real staging smoke run** with `npm run smoke:staging:summary` against `api-staging.projtrack.codes`.
- [ ] **Real backup-restore drill** with `node backend/scripts/backup-restore-drill.mjs`. See `docs/BACKUP_RESTORE_EVIDENCE.md` for next actions.
- [ ] **Hosting-provider monitoring active** with every alert in `MONITORING_RUNBOOK.md` configured AND test-fired at least once. See `docs/MONITORING_EVIDENCE.md` for next actions.
- [ ] **Stage 2 cutover** (api → DO) completed with 24-hour healthy watch.
- [ ] **Stage 3 cutover** (frontend → DO) completed with 7-day healthy watch.
- [ ] **Stakeholder review and sign-off** of this checklist and `docs/PRODUCTION_LAUNCH_SIGNOFF.md`.

## Go / No-Go Criteria
- [X] Frontend and backend `npm audit --audit-level=high` clean.
- [X] All local validation passes (typecheck, build, backend tests, prisma, boot checks, secret scan, local smoke 13/13).
- [X] DigitalOcean deployment package complete (docs, infra files, env templates, cutover plan).
- [X] Two smoke-discovered defects patched and covered by tests.
- [ ] **GitHub Actions secrets added** → CI and Production Checks green.
- [ ] DigitalOcean services provisioned and healthy.
- [ ] Real staging smoke executed.
- [ ] Real backup/restore drill executed.
- [ ] Monitoring and alerts active and test-fired.
- [ ] Stakeholder approval recorded.

## Verdict

**NO-GO / CONDITIONAL STAGING-READY — NOT PRODUCTION-READY**.

Code and local validation are strong. The single remaining automated blocker is two missing GitHub Actions repository secrets:
- `SMOKE_ADMIN_IDENTIFIER`
- `SMOKE_ADMIN_PASSWORD`

Once those are added and CI goes green, the remaining blockers are all operational (staging provisioning, backup drill, monitoring, signoff) — none are code defects.

**Exact next human action:** Go to GitHub → Settings → Secrets and variables → Actions → New repository secret. Add the two secrets above with test/staging-only credentials. Then re-run the failed CI and Production Checks workflows.
