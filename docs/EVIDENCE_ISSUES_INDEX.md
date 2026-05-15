# Evidence Issues Index

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

This document links the blocking evidence issues that must be resolved before merge, production-readiness, or school-scale claims.

## Blocking evidence issues

| Issue | Evidence area | Blocks |
|---:|---|---|
| #37 | Capacity claim, release guard wiring, release hygiene checks | DOC-GATE, CI-GATE, capacity/readiness claims |
| #38 | Backend build, security tests, unit tests, secret scan, dependency audit | SEC-GATE, TEST-GATE, CI-GATE |
| #39 | `School Scale Validation` tier `1k` | CAPACITY-GATE baseline |
| #40 | `Load Validation` smoke test | LOAD-GATE baseline |
| #41 | Production-check failure issue creation live verification | OPS-GATE, CI-GATE |
| #42 | `School Scale Validation` tier `20k` and `50k` | 20k/50k registered-user claims |

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

It runs the same local-equivalent evidence gate command in GitHub Actions, uploads the generated report as the `local-evidence-report` artifact, writes a GitHub step summary, and comments on issues #37 and #38 with the run URL, commit SHA, branch/ref, job status, and artifact name.

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

## Resolution rule

Do not close an evidence issue just because a workflow, command, runner, artifact, summary, or automatic issue comment exists. Close only after:

1. The command/workflow has run.
2. The artifact/report/logs have been reviewed.
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

## Current verdict

All listed issues are open. The branch remains not mergeable and cannot honestly claim production readiness, 1000+ concurrency, or 20k-50k school-scale support until the relevant issues are resolved with reviewed and recorded evidence.
