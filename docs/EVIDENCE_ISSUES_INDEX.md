# Evidence Issues Index

Branch: `2nd-main`  
Last updated: 2026-05-15

## Purpose

This document links the evidence issues that must be resolved before merge, production-readiness, or school-scale claims.

## Blocking evidence issues

| Issue | Evidence area | Blocks | Status |
|---:|---|---|---|
| #37 | Capacity claim, release guard wiring, release hygiene checks | DOC-GATE, CI-GATE, capacity/readiness claims | Closed |
| #38 | Backend build, security tests, unit tests, secret scan, dependency audit | SEC-GATE, TEST-GATE, CI-GATE | Closed |
| #39 | `School Scale Validation` tier `1k` | CAPACITY-GATE baseline | Open |
| #40 | `Load Validation` smoke test | LOAD-GATE baseline | Open |
| #41 | Production-check failure issue creation live verification | OPS-GATE, CI-GATE | Open |
| #42 | `School Scale Validation` tier `20k` and `50k` | 20k/50k registered-user claims | Open |
| #43 | Branch protection and CODEOWNERS enforcement verification | CI-GATE, DOC-GATE, production-readiness claims | Closed |
| #44 | Subject/submission route pagination and query-plan safety | PERF-GATE, CAPACITY-GATE, 20k/50k registered-user claims | Open |
| #45 | Failing Vercel external status on current branch head | CI-GATE, DOC-GATE, merge-readiness claims | Reopened |

## Evidence helpers

### Local runner

```bash
npm run evidence:local
```

It runs the release/capacity/security/build checks for issues #37 and #38 and writes a Markdown report under:

```text
evidence/local-evidence-*.md
```

### Evidence Gates workflow

Manual workflow:

```text
Evidence Gates
.github/workflows/evidence-gates.yml
```

It runs the same local-equivalent evidence gate command in GitHub Actions, requires `evidence/local-evidence-*.md` to exist, uploads the generated report as the `local-evidence-report` artifact with missing-file behavior set to `error`, writes a GitHub step summary, and comments on issues #37 and #38 with the run URL, commit SHA, branch/ref, job status, and artifact name.

### School Scale Validation workflow

Manual workflow:

```text
School Scale Validation
.github/workflows/school-scale-validation.yml
```

It writes a GitHub step summary and comments on:

- issue #39 when tier `1k` runs,
- issue #42 when tier `20k` or `50k` runs.

The issue comment includes run URL, commit SHA, branch/ref, tier, and job status.

### Load Validation workflow

Manual workflow:

```text
Load Validation
.github/workflows/load-validation.yml
```

It writes a GitHub step summary and comments on issue #40 with run URL, commit SHA, branch/ref, dataset tier, VUs, duration, and job status.

### Branch protection verification

Issue #43 tracks manual GitHub repository setting verification for:

- required pull requests,
- required approvals,
- Code Owner review,
- stale approval dismissal,
- required status checks,
- branch up-to-date requirement,
- conversation resolution,
- force-push restriction,
- branch deletion restriction.

### Subject/submission route-boundary verification

Issue #44 tracks route-boundary pagination and query-plan safety evidence for high-volume subject/submission endpoints. It must not be closed until subject, submission, section, calendar, and teacher-student list paths have explicit bounded behavior, `test:security` evidence, and seeded-data query-plan evidence.

### External status verification

Issue #45 is reopened because current branch-head commit `f90a9d6b1a2f60c5f486142835baca88f6b262fd` reports `Vercel = failure` with a Vercel build-rate-limit target URL. It must not be closed again until the current merge-candidate commit passes Vercel or the failure is explicitly risk-classified as non-blocking with owner approval.

## Resolution rule

Do not close an evidence issue just because a workflow, command, runner, artifact, summary, automatic issue comment, policy, or template exists. Close only after:

1. The command/workflow/check has run or the repository setting has been verified.
2. The artifact/report/logs/settings have been reviewed.
3. The result has been recorded in the correct evidence document.
4. Any failure has been fixed or explicitly risk-accepted.
5. `docs/2ND_MAIN_IMPROVEMENTS.md` is updated if gate status changes.

## Evidence document mapping

| Issue | Primary evidence document | Secondary documents |
|---:|---|---|
| #37 | `docs/CI_STATUS.md` | `docs/FINAL_MERGE_GATE.md`, `docs/RELEASE_EVIDENCE_CHECKLIST.md`, `evidence/local-evidence-*.md`, Evidence Gates artifact/comment |
| #38 | `docs/SECURITY_ACCEPTANCE_GATE.md` | `docs/CI_STATUS.md`, `docs/2ND_MAIN_IMPROVEMENTS.md`, `evidence/local-evidence-*.md`, Evidence Gates artifact/comment |
| #39 | `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` | `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md`, School Scale Validation summary/comment |
| #40 | `docs/LOAD_TEST_RESULTS.md` | `docs/LOAD_TEST_PLAN.md`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, Load Validation summary/comment |
| #41 | `docs/CI_STATUS.md` | `docs/OPERATIONAL_READINESS.md`, `docs/FINAL_MERGE_GATE.md` |
| #42 | `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` | `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md`, School Scale Validation summary/comment |
| #43 | `docs/CI_STATUS.md` | `docs/BRANCH_PROTECTION_POLICY.md`, `docs/FINAL_MERGE_GATE.md`, `docs/2ND_MAIN_IMPROVEMENTS.md` |
| #44 | `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | `docs/2ND_MAIN_IMPROVEMENTS.md`, `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`, query-plan checker output, `npm --prefix backend run test:security` evidence |
| #45 | `docs/CI_STATUS.md` | `docs/2ND_MAIN_IMPROVEMENTS.md`, latest commit status output, Vercel status/risk classification |

## Current verdict

Issues #37-#45 remain open. The branch remains not mergeable and cannot honestly claim production readiness, green external checks, fully green GitHub Actions/evidence gates, 1000+ concurrency, or 20k-50k school-scale support until the relevant open issues are resolved with reviewed and recorded evidence.
