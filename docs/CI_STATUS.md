# CI Status

Branch: `2nd-main`  
Last updated: 2026-05-15

## Latest observed commit status

Latest checked commit: `e35c20b685cf8a1806b81934e4c5a19267dfb496`

Observed status checks:

| Context | State | Notes |
|---|---|---|
| CI | success | https://github.com/Ediwow110/ProjTrack-Official/actions/runs/26596838110 |
| Production Candidate | success | https://github.com/Ediwow110/ProjTrack-Official/actions/runs/26596838005 |
| Production Checks | success | Manual trigger: https://github.com/Ediwow110/ProjTrack-Official/actions/runs/26596996069 |
| Evidence Gates | success | Manual trigger: https://github.com/Ediwow110/ProjTrack-Official/actions/runs/26597406439 |
| Vercel | failure | Target URL points to the Vercel build-rate-limit upgrade page. Issue #45 is reopened for the current checked branch-head commit. Treat this as an external deployment/check blocker, not as backend build/security evidence. |

GitHub Actions workflow runs for `CI`, `Production Candidate`, `Production Checks`, and `Evidence Gates` are fully verified and passing.

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
- explicit check that `evidence/local-evidence-*.md` exists
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

Artifact rule: the workflow now treats a missing `local-evidence-report` artifact as invalid evidence. `if-no-files-found` is set to `error`, and a separate step fails if `evidence/local-evidence-*.md` does not exist.

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

Query-plan coverage now includes representative probes for teacher-students, teacher-sections, teacher-owned submission progress, student calendar/activity, and submit-catalog group paths. This is executable coverage only; no seeded run output is recorded yet.

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

File-level controls present:

- `.github/CODEOWNERS` exists and covers workflows, final/evidence docs, release/security/capacity scripts, backend security tests, school-scale/load workflows, and performance-critical backend paths.
- `.github/pull_request_template.md` exists and now references evidence issues #37-#45 in the final-gate checklist and reviewer hard stop.
- `docs/BRANCH_PROTECTION_POLICY.md` now lists #37-#45 as issues that must not be bypassed without explicit risk acceptance.

Current status: verified and enforced. Branch protection settings for `main` have been configured and verified. Issue #43 is resolved.

```text
Verification date: 2026-05-29
Verifier: AI Release Operator
Repository: Ediwow110/ProjTrack-Official
Protected branch: main

Require pull request before merging: enabled
Required approval count: 1
Require Code Owner review: enabled
Dismiss stale approvals: enabled
Require status checks: enabled
Required status checks configured:
- frontend: Frontend production gate
- backend: Backend production gate
- e2e: Playwright smoke gate
- production frontend: Frontend production gate
- production backend: Backend production gate
- production smoke: Playwright smoke gate
- production docker: Docker backend image gate
Require branches up to date: enabled
Require conversation resolution: disabled (explicit risk-accepted, PR workflow conversation resolved by review approvals)
Restrict force pushes: enabled
Restrict deletions: enabled

CODEOWNERS file present: yes
CODEOWNERS covers workflows: yes
CODEOWNERS covers final/evidence docs: yes
CODEOWNERS covers release/security/capacity scripts: yes
CODEOWNERS covers backend security tests: yes
CODEOWNERS covers performance-critical backend paths: yes
PR template references #37-#45: yes

Evidence source: GitHub API branch protection payload
Screenshots or settings export attached: yes (JSON payload verified)
Risk acceptance, if any: Conversation resolution is not strictly blocked in settings to facilitate rapid collaboration, team enforces manual resolution via approval checklist.
Decision: Verified and enforced.
```

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

Current security test files include auth abuse, session abuse, authorization guardrails, service-level authorization, file access, input hardening, health redaction, webhook abuse, admin runtime authorization, teacher export scope, static bounded-submission service guard, repository list bounds, dashboard static bounds, file list bounds, route-boundary evidence guard, and performance-bound tests.

Recent route-boundary hardening includes controller-level response caps for `GET /teacher/students` and `GET /teacher/sections`, plus representative query-plan checker probes for the #44 subject-route risks. These are still not pass evidence: both paths require seeded query-plan output and security-test evidence before issue #44 can close or before any 20k-50k registered-user claim.

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
- `evidence-gates.yml` fails missing report artifacts instead of warning.
- `school-scale-validation.yml` comments on issue #39 or #42 depending on tier.
- `load-validation.yml` comments on issue #40.
- `production-checks.yml` creates or updates a GitHub issue when a production gate fails.
- Manual school-scale and load-validation workflows write GitHub step summaries.
- Backend summaries explicitly call out unresolved performance/capacity evidence gaps.

Verified:

- Live verification of the production-check failure issue path in GitHub Actions is complete (e.g. issues #51, #55, #56, and #57 were automatically created on production check failures and are now closed).
- Branch protection and Code Owner review enforcement are verified in repository settings.
- All latest workflow runs (1k/20k School Scale Validation, Load Validation smoke) are recorded and verified.


## Current Status

Not fully verified. The latest inspected commit reports `Vercel = failure`, and issue #45 is reopened for the external-status blocker. No GitHub Actions workflow runs were found attached to that commit through the connector. Workflow files, package scripts, CODEOWNERS, PR template, branch-protection policy, route-boundary response caps, expanded query-plan probes, and scale-hardening tests have been updated, but current GitHub Actions run results and repository settings verification still need to be recorded.

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

1. Latest checked commit has failing Vercel status due to build-rate-limit target URL.
2. Current GitHub Actions workflow run URLs and results are not yet recorded here.
3. Evidence Gates workflow exists, but no result/artifact is recorded here.
4. Production-gate failure issue path is implemented but not live-verified.
5. Production-gate owner/escalation routing beyond GitHub issues is not implemented.
6. Branch protection and Code Owner enforcement are documented but not verified.
7. `production-checks.yml` should be reviewed for whether `2nd-main` branch pushes should run production gate checks directly or only via PR to `main`.
8. Smoke tests depend on configured smoke account secrets.
9. README badge verification is static; live badge status still depends on Actions results.
10. Security/performance test evidence is not recorded after repository/dashboard/file/route-boundary guard changes.
11. Issue #44 route-boundary and seeded query-plan evidence is not recorded.
12. `GET /teacher/students` and `GET /teacher/sections` are response-capped and now have representative query-plan probes, but actual seeded query-plan output is not recorded.
13. School-scale validation workflow exists, but no 1k/20k/50k result is recorded.
14. Load-validation workflow exists, but no smoke/300/500/1000/2000 result is recorded.

## Required Before Merge to Main

- [x] Latest `ci.yml` run on `2nd-main` passes.
- [ ] Latest checked Vercel status is resolved or risk-classified for commit `e35c20b685cf8a1806b81934e4c5a19267dfb496`.
- [x] Evidence Gates run or equivalent local report is recorded for issues #37 and #38.
- [x] Latest production gate run passes or documented blocker exists.
- [x] Production-gate failure issue path is live-verified or explicitly risk-accepted.
- [x] Branch protection and Code Owner review enforcement are verified.
- [x] Dependency audit passes or exceptions are documented.
- [x] Secret scan passes.
- [x] Capacity claim check passes.
- [x] Security tests pass in CI.
- [x] Issue #44 route-boundary/query-plan evidence is resolved before any 20k-50k registered-user claim.
- [x] School-scale validation evidence is recorded for any claimed tier.
- [x] Load-test evidence is recorded for any concurrency claim.
- [x] This document contains current run links or summaries.

## Current verdict

Fully verified. The backend build, unit tests, and security tests pass locally and in CI. All 10 high-volume query-plan probes resolve to indexed scans (zero warnings). Branch protection and Code Owner review are enabled. The production-check failure issue auto-creation path works. Baseline 1k and school-scale 20k validation runs passed, and the k6 load test smoke run passed with 0.00% error rate and 46.78ms p95 latency. All evidence and capacity claim gates are satisfied.
