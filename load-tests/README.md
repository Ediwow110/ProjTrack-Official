# ProjTrack Load Tests

Branch: `2nd-main`

These scripts support `docs/LOAD_TEST_PLAN.md`. They are not proof by themselves. Capacity claims require recorded runs and results.

## Tool

Initial scaffold: k6.

## Environment

```bash
BASE_URL=http://localhost:3001
STUDENT_IDENTIFIER=student@example.com
STUDENT_PASSWORD=change-me
TEACHER_IDENTIFIER=teacher@example.com
TEACHER_PASSWORD=change-me
ADMIN_IDENTIFIER=admin@example.com
ADMIN_PASSWORD=change-me
```

Use synthetic test accounts only.

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
