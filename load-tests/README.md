# ProjTrack Load Tests

Branch: `2nd-main`

These scripts support `docs/LOAD_TEST_PLAN.md`. They are not proof by themselves. Capacity claims require recorded runs and results.

## Tool

Initial scaffold: k6.

## Authentication model

`k6.mixed.js` is a read-only scaffold. It expects pre-provisioned synthetic bearer tokens from the environment. Token generation is intentionally outside the load script so the script does not contain credential-login handling.

## Environment

```bash
BASE_URL=http://localhost:3001
LOAD_STUDENT_TOKEN=<synthetic student token>
LOAD_TEACHER_TOKEN=<synthetic teacher token>
LOAD_ADMIN_TOKEN=<synthetic admin token>
```

Use synthetic test accounts only. Do not paste real production tokens into shared terminals, docs, screenshots, or CI logs.

## Commands

Smoke:

```bash
k6 run load-tests/k6.mixed.js
```

300-user target:

```bash
k6 run -e VUS=300 -e DURATION=20m load-tests/k6.mixed.js
```

500-user stretch:

```bash
k6 run -e VUS=500 -e DURATION=20m load-tests/k6.mixed.js
```

## Evidence required

Record commit SHA, environment, dataset size, command, VUs, duration, p95 latency, error rate, memory trend, database connection trend, and top failures.

## Guardrails

- Do not run against production data.
- Do not bypass authorization.
- Do not claim 300-500 user support until target and stretch runs are recorded.
- Treat this scaffold as a starting point; write-flow scripts for upload/submit/review must be added before full load acceptance.
