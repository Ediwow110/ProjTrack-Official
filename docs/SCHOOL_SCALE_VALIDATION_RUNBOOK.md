# School Scale Validation Runbook

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

Run this before making any 20k-50k registered-user claim.

## Workflow

GitHub Actions workflow:

```text
School Scale Validation
.github/workflows/school-scale-validation.yml
```

## Required order

1. Tier `1k`
2. Tier `20k`
3. Tier `50k`

Do not run `50k` before `1k` and `20k` have passed or have documented blockers.

## Inputs

| Input | Value |
|---|---|
| `tier` | `1k`, `20k`, or `50k` |
| `fail_on_query_plan_warning` | `true` for gate evidence |

## What the workflow validates

- PostgreSQL starts.
- Backend dependencies install.
- Prisma validates/generates/deploys migrations.
- Backend builds.
- Synthetic dataset seeds for selected tier.
- Representative query plans are checked.
- GitHub step summary records dataset counts.

## After the run

Update `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` with:

- workflow run URL,
- commit SHA,
- tier,
- dataset counts,
- migration result,
- build result,
- seed result,
- query-plan warnings,
- verdict,
- required fixes.

Then update:

- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/SYNTHETIC_LOAD_DATA_PLAN.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`

## Pass criteria

A tier passes only if:

- workflow completes successfully,
- migration deploy succeeds,
- seed completes at expected counts,
- backend build succeeds,
- query-plan checker succeeds,
- warnings are zero or explicitly risk-accepted.

## Fail handling

If the workflow fails:

1. Record the failure in `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.
2. Capture the failing step.
3. Do not proceed to the next tier.
4. Open or update an issue with the blocker.
5. Fix the blocker and rerun the same tier.

## Claim rule

Passing this workflow proves only data-volume/query-plan validation for the selected tier. It does not prove runtime concurrency.
