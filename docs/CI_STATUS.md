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

### `.github/workflows/evidence-gates.yml`

Purpose: manual evidence collection workflow for issues #37 and #38.

Current structure:

- PostgreSQL service
- frontend dependency install
- backend dependency install
- Prisma generate/migrate
- `npm run evidence:local`
- upload generated `local-evidence-report` artifact
- GitHub step summary
- automatic comments on issues #37 and #38

Evidence targets:

- `docs/CI_STATUS.md`
- `docs/SECURITY_ACCEPTANCE_GATE.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`
- issue #37
- issue #38

Risk note: this workflow produces evidence artifacts and issue comments. It does not automatically mark gates passed. A human must review the artifact and update the evidence documents.

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
- production gate failure issue job

Risk note: this is a gate workflow, not a deployment workflow. It does not itself deploy production.

Failure visibility:

- The workflow has `issues: write` permission.
- If any production-check job fails, `notify-failure` creates or comments on a GitHub issue titled `Production Checks failed on <ref>`.
- The issue includes run URL, commit SHA, and frontend/backend/smoke/docker job results.

### `.github/workflows/production-candidate.yml`

Purpose: production-candidate verification for `main` pushes and PRs into `main`.

Current structure:

- frontend production build fixture
- backend boot/test/security/audit checks
- Docker backend image build

Risk note: because it runs on `main`, it should be treated as a pre-merge/merge-adjacent gate, not a substitute for protecting `main` from unverified `2nd-main` changes.

### `.github/workflows/school-scale-validation.yml`

Purpose: manual data-volume, migration, seed, and query-plan validation for 1k, 20k, and 50k registered-user tiers.

Evidence target: `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`

Traceability:

- tier `1k` comments on issue #39.
- tiers `20k` and `50k` comment on issue #42.

### `.github/workflows/load-validation.yml`

Purpose: manual k6 runtime concurrency validation for smoke, 300, 500, 1000, 2000 VU, and soak-style runs.

Evidence target: `docs/LOAD_TEST_RESULTS.md`

Traceability:

- every run comments on issue #40.

## Repository protection

Policy document: `docs/BRANCH_PROTECTION_POLICY.md`

Required before production-readiness or merge readiness:

- `main` requires pull requests before merge.
- Code Owner review is enforced.
- Required status checks are configured.
- Stale approvals are dismissed on new commits.
- Branches must be up to date before merge.
- Conversations must be resolved before merge.
- Force pushes and deletions are restricted.

Current status: policy documented, repository setting verification not yet recorded.

## Security test gate

A dedicated backend security test command exists:

```bash
npm --prefix backend run test:security
```

CI integration:

- `ci.yml` backend job runs `npm run test:security`.
- `production-checks.yml` backend job runs `npm run test:security`.
- `production-candidate.yml` backend job runs `npm run test:security`.
- `evidence-gates.yml` runs `npm --prefix backend run test:security` through `npm run evidence:local`.

Current security test files include auth abuse, session abuse, authorization guardrails, service-level authorization, file access, input hardening, health redaction, webhook abuse, admin runtime authorization, teacher export scope, static bounded-submission service guard, and performance-bound tests.

## Capacity claim gate

A dedicated capacity claim check exists:

```bash
npm run check:capacity-claims
```

It is also called by:

```bash
npm run check:release-hygiene
```

It is included in:

```bash
npm run evidence:local
```

Purpose: prevent unsupported README/product-facing claims such as 20k-50k support, 1000 concurrent-user support, school-scale readiness, or production readiness before evidence is recorded.

## Local/manual evidence workflow

For issues #37 and #38, use either:

```bash
npm run evidence:local
```

or manually run GitHub Actions workflow:

```text
Evidence Gates
```

The generated report or artifact must be reviewed and summarized into this document and `docs/SECURITY_ACCEPTANCE_GATE.md`. Do not mark #37 or #38 resolved just because the workflow exists or comments on the issues.

## Failure visibility

Implemented:

- `ci.yml` writes frontend, backend, and E2E job summaries to `GITHUB_STEP_SUMMARY`.
- `evidence-gates.yml` uploads a local-equivalent evidence report artifact and comments on issues #37/#38.
- `school-scale-validation.yml` comments on issue #39 or #42 depending on tier.
- `load-validation.yml` comments on issue #40.
- `production-checks.yml` creates or updates a GitHub issue when a production gate fails.
- Manual school-scale and load-validation workflows write GitHub step summaries.
- Backend summaries explicitly call out unresolved performance/capacity evidence gaps.

Still missing:

- Live verification that the production-check failure issue path works in GitHub Actions.
- Owner/escalation routing beyond the GitHub issue.
- Recorded latest workflow run URLs/results.
- Verification that branch protection and Code Owner review enforcement are enabled in repository settings.

## Current Status

Not fully verified in this document yet. Workflow files, package scripts, CODEOWNERS, PR template, and branch-protection policy have been updated, but current GitHub Actions run results and repository settings verification still need to be recorded.

## Verification Commands

Run these locally from repository root where supported:

```bash
npm ci
npm run typecheck
npm run build
npm run security:secrets
npm run check:release-hygiene
npm run check:capacity-claims
npm run check:release-guard-wiring
npm run evidence:local
npm run security:audit
npm --prefix backend run prisma:validate
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix backend run test
npm --prefix backend run test:unit
npm --prefix backend run test:security
npm --prefix backend run check:query-plans
npm run e2e:responsive
```

## Known Gaps

1. Current workflow run URLs and results are not yet recorded here.
2. Evidence Gates workflow exists, but no result/artifact is recorded here.
3. Production-gate failure issue path is implemented but not live-verified.
4. Production-gate owner/escalation routing beyond GitHub issues is not implemented.
5. Branch protection and Code Owner enforcement are documented but not verified.
6. `production-checks.yml` should be reviewed for whether `2nd-main` branch pushes should run production gate checks directly or only via PR to `main`.
7. Smoke tests depend on configured smoke account secrets.
8. README badge verification is static; live badge status still depends on Actions results.
9. Active submission list/export paths are bounded, but legacy repository list helpers still need cleanup or risk acceptance.
10. School-scale validation workflow exists, but no 1k/20k/50k result is recorded.
11. Load-validation workflow exists, but no smoke/300/500/1000/2000 result is recorded.

## Required Before Merge to Main

- [ ] Latest `ci.yml` run on `2nd-main` passes.
- [ ] Evidence Gates run or equivalent local report is recorded for issues #37 and #38.
- [ ] Latest production gate run passes or documented blocker exists.
- [ ] Production-gate failure issue path is live-verified or explicitly risk-accepted.
- [ ] Branch protection and Code Owner review enforcement are verified.
- [ ] Dependency audit passes or exceptions are documented.
- [ ] Secret scan passes.
- [ ] Capacity claim check passes.
- [ ] Security tests pass in CI.
- [ ] School-scale validation evidence is recorded for any claimed tier.
- [ ] Load-test evidence is recorded for any concurrency claim.
- [ ] This document contains current run links or summaries.

## Current verdict

CI now includes security, hygiene, capacity-claim guardrails, a manual evidence-gates workflow, manual validation workflows, issue-comment traceability, production-check failure issue creation, CODEOWNERS, PR template, and a branch-protection policy. It is still not final-gate complete until live passing runs, production failure notification verification, repository settings verification, school-scale evidence, and load evidence are recorded.
