# Production Check Failure Runbook

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

Use this runbook when `.github/workflows/production-checks.yml` fails.

## Expected automation

When a production-check job fails, the workflow should create or update a GitHub issue titled:

```text
Production Checks failed on <ref>
```

The issue should include:

- workflow run URL,
- commit SHA,
- frontend job result,
- backend job result,
- smoke job result,
- docker job result.

## Triage steps

1. Open the workflow run.
2. Identify failed job and failed step.
3. Confirm whether the failure issue was created or updated.
4. Add the failure issue URL to `docs/CI_STATUS.md`.
5. Decide whether the failure blocks merge, requires fix, or is a documented infrastructure incident.
6. Do not merge or deploy while unresolved production-check failures exist.

## Evidence to record

Update `docs/CI_STATUS.md` with:

```text
Date:
Workflow run URL:
Commit SHA:
Failed job:
Failed step:
Failure issue URL:
Root cause:
Fix or mitigation:
Owner:
Current status:
```

## Pass criteria for failure visibility

The failure visibility path is considered verified only when:

- a production-check workflow has failed in a controlled or real run,
- the GitHub issue was created or updated,
- the issue contains run URL and job results,
- `docs/CI_STATUS.md` records the verification.

## Current status

Implemented but not live-verified.
