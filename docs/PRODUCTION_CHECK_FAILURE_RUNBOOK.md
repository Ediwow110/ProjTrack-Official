# Production Check Failure Runbook

Branch: `2nd-main`  
Last updated: 2026-05-15

## Purpose

Use this runbook when `.github/workflows/production-checks.yml` fails and to verify issue #41.

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

## Implementation summary

`.github/workflows/production-checks.yml` currently includes:

- `permissions: issues: write`,
- `notify-failure` job,
- `if: always() && contains(toJson(needs), 'failure')`,
- `gh issue list` lookup for an existing open failure issue,
- `gh issue comment` when an issue already exists,
- `gh issue create` when no open failure issue exists,
- fallback issue creation without labels if labeled creation fails.

This proves the failure-notification path is implemented in workflow code. It does not prove the path has run successfully in GitHub Actions.

## Verification procedure for #41

Use a controlled failure only on a non-production branch or manual workflow run. Do not intentionally break `main`.

Recommended verification options:

1. Dispatch `Production Checks` manually on a test branch where one gate is expected to fail safely.
2. Use a dedicated temporary verification branch with an intentionally failing non-production check.
3. Observe a real production-check failure if one occurs naturally.

After the run:

1. Open the workflow run.
2. Confirm at least one of `frontend`, `backend`, `smoke`, or `docker` failed.
3. Confirm `notify-failure` ran.
4. Confirm a GitHub issue titled `Production Checks failed on <ref>` was created or updated.
5. Confirm the issue includes run URL, commit SHA, and frontend/backend/smoke/docker job results.
6. Record the verification in `docs/CI_STATUS.md` and issue #41.

## Evidence to record

Update `docs/CI_STATUS.md` and issue #41 with:

```text
Verification date:
Verifier:
Workflow run URL:
Workflow run ID:
Commit SHA:
Branch/ref:
Failed job:
Failed step:
notify-failure job status:
Failure issue URL:
Failure issue title:
Issue contains run URL: yes/no
Issue contains commit SHA: yes/no
Issue contains job results: yes/no
Root cause:
Fix, mitigation, or risk acceptance:
Owner:
Current status:
Decision:
```

## Search evidence checked in Batch 18

No open or closed issue titled `Production Checks failed on <ref>` was found through the connector search at the time of Batch 18.

## Pass criteria for failure visibility

The failure visibility path is considered verified only when:

- a production-check workflow has failed in a controlled or real run,
- the `notify-failure` job ran,
- the GitHub issue was created or updated,
- the issue contains run URL and job results,
- `docs/CI_STATUS.md` records the verification,
- issue #41 records the verification.

## Do not close #41 if

- only workflow code exists,
- no failed run exists,
- `notify-failure` did not run,
- no failure issue was created or updated,
- the created issue lacks run URL, commit SHA, or job results,
- verification is asserted without run URL and issue URL.

## Current status

Implemented but not live-verified. Issue #41 remains open.
