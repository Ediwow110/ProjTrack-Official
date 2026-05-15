# GitHub Actions Evidence Runbook

Branch: `2nd-main`  
Last updated: 2026-05-15

## Purpose

Use this runbook to execute, inspect, and record the manual evidence workflows that unblock the final merge gate, security gate, school-scale gate, and load gate.

## Current connector limitation

The ChatGPT GitHub connector can inspect existing workflow runs, jobs, logs, steps, and artifacts when a run ID exists. It can rerun existing failed jobs/runs when a run ID exists. It does not expose a workflow-dispatch tool here for starting the manual `Evidence Gates` workflow.

Therefore, a human must manually dispatch the workflow from GitHub Actions, or run the local evidence command, before issues #37 and #38 can be closed.

## General rule

A workflow run does not count as evidence until:

1. The workflow or local command actually runs.
2. The result, artifact, or report is reviewed.
3. The result is recorded in the relevant evidence document.
4. The related issue is updated with run/report details.
5. Any failure is fixed or explicitly risk-accepted.

A workflow file, package script, checklist, issue comment, or runbook is not evidence by itself.

## Workflow 1: Evidence Gates

Use this first to resolve or update issues #37 and #38.

### UI steps

1. Open the GitHub repository.
2. Go to **Actions**.
3. Select **Evidence Gates**.
4. Click **Run workflow**.
5. Select branch `2nd-main`.
6. Start the workflow.
7. Open the completed run.
8. Confirm the run is attached to the intended `2nd-main` commit SHA.
9. Confirm the job status is `success` or capture the exact failure.
10. Download artifact `local-evidence-report`.
11. Review the report contents.
12. Copy the workflow run URL, commit SHA, job status, and artifact name.

### Local fallback

If GitHub Actions cannot be dispatched, run locally from repository root:

```bash
npm run evidence:local
```

The local command must produce:

```text
evidence/local-evidence-*.md
```

If no report is produced, the local run is invalid evidence.

### Artifact validity rules

The workflow is now hardened so missing report artifacts fail instead of warning. Treat a run as invalid evidence if:

- `local-evidence-report` is missing,
- `evidence/local-evidence-*.md` is missing,
- the artifact cannot be opened,
- the artifact is from the wrong branch,
- the artifact is from the wrong commit,
- the report omits any required #37/#38 command.

A failed Evidence Gates run is still useful evidence, but it keeps the affected gate blocked until fixed or risk-accepted.

### Required #37 evidence

Issue #37 can close only after the report proves these passed or were explicitly risk-accepted:

- `npm run check:capacity-claims`
- `npm run check:release-guard-wiring`
- `npm run check:release-hygiene`

Record in `docs/CI_STATUS.md`:

```text
Evidence Gates run URL:
Commit SHA:
Artifact name: local-evidence-report
Artifact reviewed: yes/no
Capacity claim check: pass/fail/risk-accepted
Release guard wiring: pass/fail/risk-accepted
Release hygiene: pass/fail/risk-accepted
Reviewer:
Decision:
```

### Required #38 evidence

Issue #38 can close only after the report proves these passed or were explicitly risk-accepted:

- `npm --prefix backend run build`
- `npm --prefix backend run test:unit`
- `npm --prefix backend run test:security`
- `npm run security:secrets`
- `npm run security:audit`

Record in `docs/SECURITY_ACCEPTANCE_GATE.md` and `docs/CI_STATUS.md`:

```text
Evidence Gates run URL:
Commit SHA:
Artifact name: local-evidence-report
Artifact reviewed: yes/no
Backend build: pass/fail/risk-accepted
Backend unit tests: pass/fail/risk-accepted
Backend security tests: pass/fail/risk-accepted
Secret scan: pass/fail/risk-accepted
Dependency audit: pass/fail/risk-accepted
Reviewer:
Decision:
```

### Update targets

- `docs/CI_STATUS.md`
- `docs/SECURITY_ACCEPTANCE_GATE.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`
- issue #37
- issue #38

### Close criteria

Close #37 only if capacity claim, release guard wiring, and release hygiene checks pass or are explicitly risk-accepted and recorded.

Close #38 only if backend build, backend security tests, backend unit tests, secret scan, and dependency audit pass or failures are explicitly fixed/risk-accepted and recorded.

## Workflow 2: School Scale Validation tier 1k

Use this after Evidence Gates has been run or explicitly deferred.

### UI steps

1. Open GitHub repository.
2. Go to **Actions**.
3. Select **School Scale Validation**.
4. Click **Run workflow**.
5. Select branch `2nd-main`.
6. Set `tier` to `1k`.
7. Set `fail_on_query_plan_warning` to `true`.
8. Start the workflow.
9. Open the completed run.
10. Copy the workflow run URL and summary.

### Update targets

- `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/SYNTHETIC_LOAD_DATA_PLAN.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`
- issue #39

### Close criteria

Close #39 only if tier `1k` passes and the result is recorded.

## Workflow 3: Load Validation smoke

Use this after the target environment and synthetic/staging credentials are configured.

### UI steps

1. Open GitHub repository.
2. Go to **Actions**.
3. Select **Load Validation**.
4. Click **Run workflow**.
5. Select branch `2nd-main`.
6. Set `vus` to `10`.
7. Set `duration` to `5m`.
8. Set `dataset_tier` to the actual seeded tier, usually `1k` or `manual`.
9. Set `base_url` to the target API URL.
10. Start the workflow.
11. Open the completed run.
12. Copy the workflow run URL and summary.

### Update targets

- `docs/LOAD_TEST_RESULTS.md`
- `docs/LOAD_TEST_PLAN.md`
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`
- issue #40

### Close criteria

Close #40 only if the smoke run passes, uses non-production test accounts, and the result is recorded.

## Workflow 4: School Scale Validation 20k and 50k

Use only after tier `1k` passes or its blocker is documented.

### Required order

1. Run tier `20k`.
2. Record the result.
3. Fix any blockers.
4. Run tier `50k`.
5. Record the result.

### Update targets

- `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/SYNTHETIC_LOAD_DATA_PLAN.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`
- issue #42

### Close criteria

Close #42 only if both `20k` and `50k` results are recorded, or if the issue is intentionally split after a documented blocker.

## Workflow 5: Production Checks failure visibility

Use this to verify issue #41.

### UI steps

1. Trigger or observe a controlled `Production Checks` failure.
2. Confirm the workflow creates or updates a GitHub issue titled `Production Checks failed on <ref>`.
3. Confirm the issue includes run URL, commit SHA, and job results.
4. Record the verification.

### Update targets

- `docs/CI_STATUS.md`
- `docs/OPERATIONAL_READINESS.md`
- `docs/FINAL_MERGE_GATE.md`
- issue #41

### Close criteria

Close #41 only after production-check failure issue creation is live-verified or explicitly risk-accepted.

## Hard rule

Do not close #37, #38, #39, #40, #41, #42, #43, #44, or #45 merely because workflows, runbooks, scripts, policies, templates, or comments exist. Close only after recorded evidence exists.
