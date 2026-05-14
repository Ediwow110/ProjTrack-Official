# Evidence Update Checklist

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

Use this checklist after every validation, CI, security, or load run. Evidence that is not recorded does not count.

## After `School Scale Validation`

Update `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` with:

- Date
- Commit SHA
- Workflow run URL
- Tier: `1k`, `20k`, or `50k`
- Dataset counts
- Migration deploy result
- Backend build result
- Seed result
- Query-plan result
- Hot-table sequential scan warnings
- Overall verdict
- Required fixes
- Owner

Then update:

- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/SYNTHETIC_LOAD_DATA_PLAN.md` if tier status changes
- `docs/2ND_MAIN_IMPROVEMENTS.md`

## After `Load Validation`

Update `docs/LOAD_TEST_RESULTS.md` with:

- Date
- Commit SHA
- Workflow run URL
- Target environment
- Dataset tier
- Registered synthetic users
- VUs
- Duration
- HTTP error rate
- p95/p99 latency
- Memory trend
- DB connection trend
- Top failing routes
- Top slow routes
- Whether authorization shortcuts were used
- Overall verdict
- Required fixes
- Owner

Then update:

- `docs/LOAD_TEST_PLAN.md` if thresholds or stages change
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`

## After `ci.yml`

Update `docs/CI_STATUS.md` with:

- Workflow run URL
- Commit SHA
- Frontend job result
- Backend job result
- E2E job result
- Secret scan result
- Release hygiene result
- Capacity claim check result
- Security test result
- Build result
- Dependency audit result
- Required fixes

Then update:

- `docs/FINAL_MERGE_GATE.md` if a gate changes
- `docs/2ND_MAIN_IMPROVEMENTS.md`

## After `production-checks.yml`

Update `docs/CI_STATUS.md` with:

- Workflow run URL
- Commit SHA
- Frontend gate result
- Backend gate result
- Smoke gate result
- Docker gate result
- Whether failure issue was created/updated if failed
- Required fixes

Then update:

- `docs/FINAL_MERGE_GATE.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`

## After local backend tests

Update the relevant evidence doc with:

```text
Command:
Commit SHA:
Environment:
Passed? yes/no
Output summary:
Required fixes:
```

Common commands:

```bash
npm --prefix backend run test:security
npm --prefix backend run build
npm --prefix backend run prisma:migrate:deploy
npm --prefix backend run check:query-plans
```

## After claim/check runs

For capacity wording checks, update `docs/CI_STATUS.md`:

```bash
npm run check:capacity-claims
npm run check:release-hygiene
```

Record:

- command
- commit SHA
- pass/fail
- unsupported claims found, if any
- fixes made

## Evidence quality rules

Good evidence includes:

- exact command or workflow
- exact commit SHA
- date
- environment
- pass/fail status
- key metrics
- link to workflow run when applicable

Bad evidence:

- “tested locally” with no command
- screenshots without commit SHA
- claims without logs or workflow URL
- capacity claims without dataset tier
- load claims without VU count and duration

## Current evidence gaps

- No `School Scale Validation` run recorded.
- No `Load Validation` run recorded.
- No latest CI run recorded.
- No production-check failure issue live verification recorded.
- No backend security/build command output recorded.
