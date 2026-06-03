# Branch Protection Policy

Branch: `main` (policy applies to current active branch)  
Target protected branch: `main`  
Last updated: 2026-06-03

## Purpose

This policy defines the required GitHub branch protection settings for `main` to prevent unsafe merges and support production/school-scale readiness claims.

## Required `main` branch protection

Enable these settings for `main`:

- [ ] Require a pull request before merging.
- [ ] Require approvals.
- [ ] Require review from Code Owners.
- [ ] Dismiss stale pull request approvals when new commits are pushed.
- [ ] Require status checks to pass before merging.
- [ ] Require branches to be up to date before merging.
- [ ] Require conversation resolution before merging.
- [ ] Restrict force pushes.
- [ ] Restrict deletions.

## Required status checks

At minimum, require these checks before merge to `main`:

- `ci.yml` frontend job
- `ci.yml` backend job
- `ci.yml` e2e job
- `production-checks.yml` frontend production gate
- `production-checks.yml` backend production gate
- `production-checks.yml` smoke gate
- `production-checks.yml` docker image gate

Recommended manual evidence before approval:

- `Evidence Gates`
- `School Scale Validation` tier required for the claim
- `Load Validation` tier required for the claim

## CODEOWNERS requirement

`.github/CODEOWNERS` must remain active and cover:

- GitHub workflows,
- final gate docs,
- evidence docs,
- release/security/capacity scripts,
- backend security tests,
- school-scale/load workflows,
- performance-critical submission and export paths.

## Pull request template requirement

`.github/pull_request_template.md` must require reviewers to account for evidence issues #37-#45 and must hard-stop unsupported production, capacity, and school-scale claims.

## Evidence issue requirement

Do not merge if these issues are open without explicit risk acceptance:

- #37 release guard / capacity claim / release hygiene evidence
- #38 backend build / security / unit / scan / audit evidence
- #39 school-scale validation tier `1k`
- #40 load validation smoke
- #41 production-check failure visibility
- #42 school-scale validation tiers `20k` / `50k` before matching claims
- #43 branch protection and CODEOWNERS enforcement verification
- #44 subject/submission route-boundary and query-plan evidence before 20k-50k registered-user claims
- #45 failing Vercel external status resolution or non-blocking risk classification

## Verification procedure for #43

A repository admin must verify the GitHub settings for `main` directly in repository settings.

Record this exact evidence block in issue #43 and in `docs/CI_STATUS.md` before closing #43:

```text
Verification date:
Verifier:
Repository:
Protected branch:

Require pull request before merging: enabled/disabled
Required approval count:
Require Code Owner review: enabled/disabled
Dismiss stale approvals: enabled/disabled
Require status checks: enabled/disabled
Required status checks configured:
- frontend:
- backend:
- e2e:
- production frontend:
- production backend:
- production smoke:
- production docker:
Require branches up to date: enabled/disabled
Require conversation resolution: enabled/disabled
Restrict force pushes: enabled/disabled
Restrict deletions: enabled/disabled

CODEOWNERS file present: yes/no
CODEOWNERS covers workflows: yes/no
CODEOWNERS covers final/evidence docs: yes/no
CODEOWNERS covers release/security/capacity scripts: yes/no
CODEOWNERS covers backend security tests: yes/no
CODEOWNERS covers performance-critical backend paths: yes/no
PR template references #37-#45: yes/no

Evidence source:
Screenshots or settings export attached: yes/no
Risk acceptance, if any:
Decision:
```

## Do not close #43 if

- Required pull requests are not enforced for `main`.
- Code Owner review is not enforced.
- Required checks are not configured.
- Stale approvals are not dismissed.
- Branch up-to-date requirement is missing without explicit risk acceptance.
- Conversation resolution is disabled without explicit risk acceptance.
- Force pushes or branch deletion are allowed without explicit risk acceptance.
- CODEOWNERS or PR template coverage is missing.
- Verification is asserted without verifier/date/settings evidence.

## Bypass policy

Bypassing branch protection is allowed only for emergency hotfixes and must be documented after the fact with:

```text
Date:
Commit SHA:
Reason for bypass:
Who approved:
What checks were skipped:
Risk introduced:
Follow-up validation run URL:
Rollback plan:
```

## Claim impact

If branch protection is not configured and verified, do not describe the project as production-ready. Code and docs may be strong, but the repository process would still allow unsafe merges.

## Verification records

Record branch protection verification in:

- `docs/CI_STATUS.md`
- `docs/FINAL_MERGE_GATE.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`
- issue #43

## Current verdict

Policy documented. CODEOWNERS and PR template exist. Actual GitHub branch protection settings still need to be configured and verified in the repository UI/settings before #43 can close.
