# Load Validation Runbook

Branch: `2nd-main`  
Last updated: 2026-05-14

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

## After each run

Update `docs/LOAD_TEST_RESULTS.md` with:

- workflow run URL,
- commit SHA,
- environment,
- dataset tier,
- VUs,
- duration,
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

## Pass criteria

A run passes only if:

- workflow completes successfully,
- synthetic or staging accounts are used,
- error rate is within threshold,
- latency is within threshold or risk-accepted,
- memory and database connections do not show runaway growth,
- failed and slow routes are triaged.

## Claim rule

A passing load test proves runtime behavior only for the tested VU count, duration, environment, dataset tier, and script coverage. It does not prove 20k-50k registered-user readiness by itself.
