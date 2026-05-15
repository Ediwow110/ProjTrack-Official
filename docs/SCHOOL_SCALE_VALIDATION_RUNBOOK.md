# School Scale Validation Runbook

Branch: `2nd-main`  
Last updated: 2026-05-15

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

## Tier dataset sizes

| Tier | Students | Teachers | Admins | Sections | Subjects | Tasks per subject | Submissions | Notifications |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `1k` | 1,000 | 50 | 5 | 50 | 150 | 5 | 10,000 | 10,000 |
| `20k` | 20,000 | 800 | 20 | 800 | 2,400 | 5 | 200,000 | 200,000 |
| `50k` | 50,000 | 2,000 | 50 | 2,000 | 6,000 | 5 | 500,000 | 500,000 |

## What the workflow validates

- PostgreSQL starts.
- Backend dependencies install.
- Prisma validates/generates/deploys migrations.
- Backend builds.
- Synthetic dataset seeds for selected tier.
- Representative query plans are checked.
- GitHub step summary records dataset counts.
- The workflow comments on issue #39 for tier `1k` and issue #42 for tiers `20k` / `50k`.

## Current query-plan checker coverage

`backend/scripts/check-school-scale-query-plans.cjs` currently checks representative plans for:

- student submission list by owner,
- teacher submission list by teacher-owned subject,
- subject submissions by status and time,
- notification list by user read state.

Current coverage gap:

- It does not yet check the `GET /teacher/students` path.
- It does not yet check the `GET /teacher/sections` path.
- It does not yet check student calendar fanout.
- It does not yet check student submit-catalog fanout.

This means a passing School Scale Validation run is not enough to close issue #44 unless additional query-plan evidence is added or separately recorded for those paths.

## After the run

Update `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` with:

- workflow run URL,
- workflow run ID,
- commit SHA,
- branch/ref,
- tier,
- dataset counts,
- migration result,
- build result,
- seed result,
- query-plan checker result,
- query-plan warning count,
- whether teacher-students query-plan evidence exists,
- whether teacher-sections query-plan evidence exists,
- verdict,
- required fixes.

Then update:

- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/SYNTHETIC_LOAD_DATA_PLAN.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`
- issue #39 for tier `1k`
- issue #42 for tiers `20k` and `50k`
- issue #44 if route-boundary/query-plan evidence changes

## Pass criteria

A tier passes only if:

- workflow completes successfully,
- migration deploy succeeds,
- seed completes at expected counts,
- backend build succeeds,
- query-plan checker succeeds,
- warnings are zero or explicitly risk-accepted,
- any claim dependent on #44 also has teacher-students/teacher-sections route-boundary/query-plan evidence.

## Fail handling

If the workflow fails:

1. Record the failure in `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.
2. Capture the failing step.
3. Do not proceed to the next tier.
4. Open or update an issue with the blocker.
5. Fix the blocker and rerun the same tier.

## Claim rule

Passing this workflow proves only data-volume/query-plan validation for the selected tier and only for the paths actually covered by the query-plan checker. It does not prove runtime concurrency, and it does not close issue #44 unless missing teacher-students, teacher-sections, calendar, and submit-catalog query-plan evidence is also recorded.
