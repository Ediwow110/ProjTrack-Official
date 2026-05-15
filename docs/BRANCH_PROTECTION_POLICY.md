# Branch Protection Policy

Branch: `2nd-main`  
Target protected branch: `main`  
Last updated: 2026-05-14

## Purpose

This policy defines the required GitHub branch protection settings before `2nd-main` can be merged into `main` or before production/school-scale readiness is claimed.

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

## Evidence issue requirement

Do not merge if these issues are open without explicit risk acceptance:

- #37 release guard / capacity claim / release hygiene evidence
- #38 backend build / security / unit / scan / audit evidence
- #39 school-scale validation tier `1k`
- #40 load validation smoke
- #41 production-check failure visibility
- #42 school-scale validation tiers `20k` / `50k` before matching claims

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

If branch protection is not configured, do not describe the project as production-ready. Code and docs may be strong, but the repository process would still allow unsafe merges.

## Verification

Record branch protection verification in:

- `docs/CI_STATUS.md`
- `docs/FINAL_MERGE_GATE.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`

## Current verdict

Policy documented. Actual GitHub branch protection settings still need to be configured and verified in the repository UI/settings.
