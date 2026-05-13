# CI Status

Branch: `2nd-main`  
Last updated: 2026-05-14

## Workflows

### `.github/workflows/ci.yml`

Purpose: main continuous integration gate for frontend, backend, and E2E verification.

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

- `backend` job
  - PostgreSQL service
  - `npm ci --prefer-offline`
  - root secret scan and release hygiene checks
  - Prisma validate/generate/migrate
  - `npm run build`
  - `npm run test`
  - `npm run test:unit`
  - production runtime boot check
  - worker boot smoke
  - optional real-account smoke
  - `npm audit --audit-level=high`

- `e2e` job
  - frontend/backend installs
  - secret scan and release hygiene checks
  - Playwright install
  - Prisma generate/migrate
  - backend build
  - smoke environment preflight
  - `npm run e2e:smoke`
  - audit

### `.github/workflows/production-checks.yml`

Purpose: production-oriented verification gate for PRs into `main`, manual runs, and selected hardening branches.

Current structure:

- frontend production gate
- backend production gate
- Playwright smoke gate
- Docker backend image gate

Risk note: this is a gate workflow, not a deployment workflow. It does not itself deploy production. It still needs failure summaries/notifications before production use.

### `.github/workflows/production-candidate.yml`

Purpose: production-candidate verification for `main` pushes and PRs into `main`.

Current structure:

- frontend production build fixture
- backend boot/test/audit checks
- Docker backend image build

Risk note: because it runs on `main`, it should be treated as a pre-merge/merge-adjacent gate, not a substitute for protecting `main` from unverified `2nd-main` changes.

## Current Status

Not fully verified in this document yet. The workflow files and package scripts have been inspected, but current GitHub Actions run results still need to be recorded after the branch runs.

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
npm run e2e:responsive
```

## Known Gaps

1. Current workflow run URLs and results are not yet recorded here.
2. CI failure visibility is incomplete: workflow summaries and notification handling should be added.
3. `production-checks.yml` should be reviewed for whether `2nd-main` branch pushes should run production gate checks directly or only via PR to `main`.
4. Smoke tests depend on configured `SMOKE_ADMIN_IDENTIFIER` and `SMOKE_ADMIN_PASSWORD` secrets.
5. README badge verification is static; live badge status still depends on Actions results.

## Required Before Merge to Main

- [ ] Latest `ci.yml` run on `2nd-main` passes.
- [ ] Latest production gate run passes or documented blocker exists.
- [ ] Failure visibility exists for production gate failure.
- [ ] Dependency audit passes or exceptions are documented.
- [ ] Secret scan passes.
- [ ] README badges point at the intended branch/workflows.
- [ ] This document contains current run links or summaries.

## Current verdict

CI is structurally stronger than the previous tracker implied, but it is not final-gate complete until live passing runs and failure visibility are recorded.
