# CI Status

Branch: `2nd-main`  
Last updated: 2026-05-14

## Workflows

### `.github/workflows/ci.yml`

Purpose: main continuous integration gate for frontend, backend, security, and E2E verification.

Current structure:

- `frontend` job
  - `npm ci --prefer-offline`
  - `npm run security:secrets`
  - `npm run check:release-hygiene`
  - `npm run check:click-targets`
  - `npm run check:frontend-env`
  - `npm run typecheck`
  - `npm run build`
  - Playwright browser install
  - `npm run e2e:responsive`
  - `npm run security:audit`
  - `GITHUB_STEP_SUMMARY` frontend summary

- `backend` job
  - PostgreSQL service
  - `npm ci --prefer-offline`
  - root secret scan and release hygiene checks
  - Prisma validate/generate/migrate
  - `npm run build`
  - `npm run test`
  - `npm run test:unit`
  - `npm run test:security`
  - production runtime boot check
  - worker boot smoke
  - optional real-account smoke
  - `npm audit --audit-level=high`
  - `GITHUB_STEP_SUMMARY` backend summary

- `e2e` job
  - frontend/backend installs
  - secret scan and release hygiene checks
  - Playwright install
  - Prisma generate/migrate
  - backend build
  - smoke environment preflight
  - `npm run e2e:smoke`
  - audit
  - `GITHUB_STEP_SUMMARY` E2E summary

### `.github/workflows/production-checks.yml`

Purpose: production-oriented verification gate for PRs into `main`, manual runs, and selected hardening branches.

Current structure:

- frontend production gate
- backend production gate
  - production boot checks
  - worker boot checks
  - production hardening checks
  - `npm run test:security`
- Playwright smoke gate
- Docker backend image gate

Risk note: this is a gate workflow, not a deployment workflow. It does not itself deploy production. It still needs production-gate notification routing before production use.

### `.github/workflows/production-candidate.yml`

Purpose: production-candidate verification for `main` pushes and PRs into `main`.

Current structure:

- frontend production build fixture
- backend boot/test/security/audit checks
- Docker backend image build

Risk note: because it runs on `main`, it should be treated as a pre-merge/merge-adjacent gate, not a substitute for protecting `main` from unverified `2nd-main` changes.

## Security test gate

A dedicated backend security test command exists:

```bash
npm --prefix backend run test:security
```

CI integration:

- `ci.yml` backend job runs `npm run test:security`.
- `production-checks.yml` backend job runs `npm run test:security`.
- `production-candidate.yml` backend job runs `npm run test:security`.

Current security test files include auth abuse, session abuse, authorization guardrails, service-level authorization, file access, input hardening, health redaction, webhook abuse, admin runtime authorization, teacher export scope, and performance-bound blocker tests.

## Failure visibility

Implemented:

- `ci.yml` now writes frontend, backend, and E2E job summaries to `GITHUB_STEP_SUMMARY`.
- The backend summary explicitly calls out unresolved `PERF-GATE` blocker #34.

Still missing:

- Production-check failure notification destination.
- Owner/escalation routing for failed production gates.
- Recorded latest workflow run URLs/results.

## Current Status

Not fully verified in this document yet. Workflow files and package scripts have been updated, but current GitHub Actions run results still need to be recorded after the branch runs.

## Verification Commands

Run these locally from repository root where supported:

```bash
npm ci
npm run typecheck
npm run build
npm run security:secrets
npm run security:audit
npm --prefix backend ci
npm --prefix backend run prisma:validate
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix backend run test
npm --prefix backend run test:unit
npm --prefix backend run test:security
npm run e2e:responsive
```

## Known Gaps

1. Current workflow run URLs and results are not yet recorded here.
2. Production-gate notification routing is not implemented.
3. `production-checks.yml` should be reviewed for whether `2nd-main` branch pushes should run production gate checks directly or only via PR to `main`.
4. Smoke tests depend on configured smoke account secrets.
5. README badge verification is static; live badge status still depends on Actions results.
6. `PERF-GATE` blocker #34 remains open: submission list/export paths are scoped but unbounded.
7. Load-test scaffold exists, but no target run evidence exists.

## Required Before Merge to Main

- [ ] Latest `ci.yml` run on `2nd-main` passes.
- [ ] Latest production gate run passes or documented blocker exists.
- [ ] Production-gate failure notification routing exists.
- [ ] Dependency audit passes or exceptions are documented.
- [ ] Secret scan passes.
- [ ] Security tests pass in CI.
- [ ] `PERF-GATE` blocker #34 is fixed or explicitly risk-accepted.
- [ ] This document contains current run links or summaries.

## Current verdict

CI now includes an executable security gate and basic workflow summaries. It is still not final-gate complete until live passing runs, production notification routing, and the performance blocker are resolved.
