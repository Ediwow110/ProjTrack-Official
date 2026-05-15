# Load Validation Runbook

Branch: `2nd-main`  
Last updated: 2026-05-15

## Purpose

Use this runbook to collect runtime concurrency evidence. Load validation is separate from registered-user data-volume validation.

## Workflow

GitHub Actions workflow:

```text
Load Validation
.github/workflows/load-validation.yml
```

## Required configuration

The workflow needs test credentials for student, teacher, and admin synthetic accounts. Use only synthetic or staging accounts.

Required secrets:

- `LOAD_STUDENT_TOKEN`
- `LOAD_TEACHER_TOKEN`
- `LOAD_ADMIN_TOKEN`

## Inputs

| Input | Meaning |
|---|---|
| `vus` | Virtual users |
| `duration` | Test duration |
| `dataset_tier` | Dataset tier already seeded in the target environment |
| `base_url` | Target API URL |

## Required order

1. Smoke: 10 VUs for 5 minutes.
2. Baseline: 50 VUs for 10 minutes.
3. Target: 300 VUs for 20 minutes.
4. Stretch: 500 VUs for 20 minutes.
5. Capacity exploration: 1000 VUs for 20 minutes.
6. Optional higher exploration: 2000 VUs for 20 minutes.
7. Soak: 100 VUs for 60 minutes.

Do not run high-VU tests before smoke passes.

## Current k6 script coverage

Script:

```text
load-tests/k6.mixed.js
```

Currently covered routes:

- `GET /student/dashboard/summary`
- `GET /student/dashboard/charts`
- `GET /student/submissions`
- `GET /student/subjects`
- `GET /teacher/dashboard/summary`
- `GET /teacher/submissions`
- `GET /teacher/subjects`
- `GET /admin/dashboard/summary`
- `GET /admin/users`
- `GET /admin/settings`

Current coverage gap:

- It does not hit `GET /teacher/students`.
- It does not hit `GET /teacher/sections`.
- It does not hit student calendar fanout.
- It does not hit student submit-catalog fanout.
- It does not cover write-heavy upload/submission flows.

This means a passing smoke run can close #40 only for baseline smoke/load workflow evidence. It does not close #44 and does not prove runtime behavior for the uncovered high-risk subject routes.

## After each run

Update `docs/LOAD_TEST_RESULTS.md` with:

- workflow run URL,
- workflow run ID,
- commit SHA,
- branch/ref,
- environment,
- dataset tier,
- VUs,
- duration,
- k6 script path,
- route coverage summary,
- uncovered route risks,
- error rate,
- p95/p99 latency,
- memory trend,
- database connection trend,
- top failing routes,
- top slow routes,
- whether authorization shortcuts were used,
- verdict,
- required fixes.

Then update:

- `docs/LOAD_TEST_PLAN.md`
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/2ND_MAIN_IMPROVEMENTS.md`
- issue #40
- issue #44 if subject-route runtime coverage changes

## Pass criteria

A run passes only if:

- workflow completes successfully,
- synthetic or staging accounts are used,
- error rate is within threshold,
- latency is within threshold or risk-accepted,
- memory and database connections do not show runaway growth,
- failed and slow routes are triaged,
- route coverage limitations are documented.

## Claim rule

A passing load test proves runtime behavior only for the tested VU count, duration, environment, dataset tier, and script coverage. It does not prove 20k-50k registered-user readiness by itself. It does not prove uncovered route behavior.
