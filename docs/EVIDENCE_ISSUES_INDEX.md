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

## Local evidence helper

A local evidence runner exists:

```bash
npm run evidence:local
```

It runs the release/capacity/security/build checks for issues #37 and #38 and writes a Markdown report under:

```text
evidence/local-evidence-*.md
```

The generated report should be used to update:

- `docs/CI_STATUS.md`
- `docs/SECURITY_ACCEPTANCE_GATE.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`
- issue #37
- issue #38

## Resolution rule

Do not close an evidence issue just because a workflow, command, or runner exists. Close only after:

1. The command/workflow has run.
2. The result has been recorded in the correct evidence document.
3. Any failure has been fixed or explicitly risk-accepted.
4. `docs/2ND_MAIN_IMPROVEMENTS.md` is updated if gate status changes.

## Evidence document mapping

| Issue | Primary evidence document | Secondary documents |
|---:|---|---|
| #37 | `docs/CI_STATUS.md` | `docs/FINAL_MERGE_GATE.md`, `docs/RELEASE_EVIDENCE_CHECKLIST.md`, `evidence/local-evidence-*.md` |
| #38 | `docs/SECURITY_ACCEPTANCE_GATE.md` | `docs/CI_STATUS.md`, `docs/2ND_MAIN_IMPROVEMENTS.md`, `evidence/local-evidence-*.md` |
| #39 | `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` | `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md` |
| #40 | `docs/LOAD_TEST_RESULTS.md` | `docs/LOAD_TEST_PLAN.md`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` |
| #41 | `docs/CI_STATUS.md` | `docs/OPERATIONAL_READINESS.md`, `docs/FINAL_MERGE_GATE.md` |
| #42 | `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` | `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md` |

## Current verdict

All listed issues are open. The branch remains not mergeable and cannot honestly claim production readiness, 1000+ concurrency, or 20k-50k school-scale support until the relevant issues are resolved with recorded evidence.
