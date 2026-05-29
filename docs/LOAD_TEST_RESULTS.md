# Load Test Results

Branch: `2nd-main`  
Last updated: 2026-05-29

## Verdict

Smoke run passed (10 VUs, 5m duration, 1k dataset, 0.00% error rate).

This document records concurrency/load evidence. It is separate from `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`, which records data-volume seed and query-plan validation.

## Critical distinction

- School-scale validation proves synthetic registered-user data volume and representative query plans.
- Load testing proves runtime behavior under concurrent traffic for the specific script coverage, target environment, duration, and VU count.
- 20k-50k registered users does not mean 20k-50k concurrent users.
- Passing current load validation does not prove DB-level query-plan safety.

## Manual load validation workflow

Workflow: `Load Validation`  
File: `.github/workflows/load-validation.yml`

Manual inputs:

- `vus`: virtual users for k6
- `duration`: k6 duration, for example `5m` or `20m`
- `dataset_tier`: dataset tier already seeded in the target environment
- `base_url`: target API base URL

Required secrets:

- `LOAD_STUDENT_TOKEN`
- `LOAD_TEACHER_TOKEN`
- `LOAD_ADMIN_TOKEN`

This workflow proves runtime concurrency for the supplied target URL only. It does not seed data and does not prove registered-user data-volume readiness.

## Current k6 route coverage

Script: `load-tests/k6.mixed.js`

Covered routes:

- `GET /student/dashboard/summary`
- `GET /student/dashboard/charts`
- `GET /student/submissions`
- `GET /student/subjects`
- `GET /student/submit-catalog`
- `GET /student/calendar/events`
- `GET /teacher/dashboard/summary`
- `GET /teacher/submissions`
- `GET /teacher/subjects`
- `GET /teacher/students?take=100&skip=0`
- `GET /teacher/sections?take=100&skip=0`
- `GET /admin/dashboard/summary`
- `GET /admin/users`
- `GET /admin/settings`

Uncovered route risks:

- write-heavy upload/submission flows
- DB-level query-plan safety for `teacherStudents` and `teacherSections`

A passing smoke run can establish baseline load workflow evidence for #40 and provide runtime coverage for the subject-route hot paths. It does not resolve #44 DB-level route-boundary/query-plan evidence by itself.

## Required load sequence

Run only after relevant synthetic data tier passes:

1. Smoke: 10 VUs, 5 minutes
2. Baseline: 50 VUs, 10 minutes
3. Target: 300 VUs, 20 minutes
4. Stretch: 500 VUs, 20 minutes
5. Capacity exploration: 1000 VUs, 20 minutes
6. Optional school-scale exploration: 2000 VUs, 20 minutes only after 1000 VUs passes
7. Soak: 100 VUs, 60 minutes

## Required commands

Local:

```bash
k6 run load-tests/k6.mixed.js
k6 run -e VUS=300 -e DURATION=20m load-tests/k6.mixed.js
k6 run -e VUS=500 -e DURATION=20m load-tests/k6.mixed.js
k6 run -e VUS=1000 -e DURATION=20m load-tests/k6.mixed.js
k6 run -e VUS=2000 -e DURATION=20m load-tests/k6.mixed.js
```

GitHub Actions:

```text
Workflow: Load Validation
vus: 10 | 50 | 300 | 500 | 1000 | 2000
duration: 5m | 10m | 20m | 60m
dataset_tier: 1k | 20k | 50k | manual
base_url: target API URL
```

## Result template

```text
Date:
Commit SHA:
Workflow run URL:
Workflow run ID:
Branch/ref:
Environment:
Dataset tier:
Registered synthetic users:
Command or workflow inputs:
Script path:
Route coverage summary:
Uncovered route risks:
Virtual users:
Duration:
Passed thresholds? yes/no
HTTP error rate:
p95 read latency:
p95 write latency:
p99 latency:
Max memory:
DB connection peak:
CPU peak:
Top failing routes:
Top slow routes:
Authorization shortcuts used? yes/no
Production data used? no required
Overall verdict:
Required fixes:
Owner:
```

## Smoke run

Status: Passed.

```text
Date: 2026-05-29
Commit SHA: 7b5dafc
Workflow run URL: https://github.com/Ediwow110/ProjTrack-Official/actions/runs/26598837103
Workflow run ID: 26598837103
Branch/ref: main
Environment: Local container (GitHub runner)
Dataset tier: 1k
Registered synthetic users: 1000 students, 50 teachers, 5 admins
Command or workflow inputs: Load Validation, vus=10, duration=5m
Script path: load-tests/k6.mixed.js
Route coverage summary: includes teacher/students, teacher/sections, student calendar, student submit-catalog
Uncovered route risks: write-heavy upload/submission flows; DB-level query-plan safety for teacherStudents/teacherSections
Virtual users: 10
Duration: 5m
Passed thresholds? yes
HTTP error rate: 0.00%
p95 read latency: 46.78ms
p95 write latency: N/A (read-only)
p99 latency: ~60ms
Max memory: N/A
DB connection peak: N/A
CPU peak: N/A
Top failing routes: None
Top slow routes: None
Authorization shortcuts used? no
Production data used? no
Overall verdict: Passed
Required fixes: None
Owner: AI Release Operator
```

## 300 VU target run

Status: Not run.

```text
Date:
Commit SHA:
Workflow run URL:
Workflow run ID:
Branch/ref:
Environment:
Dataset tier:
Registered synthetic users:
Command or workflow inputs: Load Validation, vus=300, duration=20m
Script path: load-tests/k6.mixed.js
Route coverage summary:
Uncovered route risks:
Virtual users: 300 expected
Duration: 20m expected
Passed thresholds? yes/no
HTTP error rate:
p95 read latency:
p95 write latency:
p99 latency:
Max memory:
DB connection peak:
CPU peak:
Top failing routes:
Top slow routes:
Authorization shortcuts used? yes/no
Production data used? no required
Overall verdict:
Required fixes:
Owner:
```

## 500 VU stretch run

Status: Not run.

```text
Date:
Commit SHA:
Workflow run URL:
Workflow run ID:
Branch/ref:
Environment:
Dataset tier:
Registered synthetic users:
Command or workflow inputs: Load Validation, vus=500, duration=20m
Script path: load-tests/k6.mixed.js
Route coverage summary:
Uncovered route risks:
Virtual users: 500 expected
Duration: 20m expected
Passed thresholds? yes/no
HTTP error rate:
p95 read latency:
p95 write latency:
p99 latency:
Max memory:
DB connection peak:
CPU peak:
Top failing routes:
Top slow routes:
Authorization shortcuts used? yes/no
Production data used? no required
Overall verdict:
Required fixes:
Owner:
```

## 1000 VU capacity exploration

Status: Not run.

```text
Date:
Commit SHA:
Workflow run URL:
Workflow run ID:
Branch/ref:
Environment:
Dataset tier:
Registered synthetic users:
Command or workflow inputs: Load Validation, vus=1000, duration=20m
Script path: load-tests/k6.mixed.js
Route coverage summary:
Uncovered route risks:
Virtual users: 1000 expected
Duration: 20m expected
Passed thresholds? yes/no
HTTP error rate:
p95 read latency:
p95 write latency:
p99 latency:
Max memory:
DB connection peak:
CPU peak:
Top failing routes:
Top slow routes:
Authorization shortcuts used? yes/no
Production data used? no required
Overall verdict:
Required fixes:
Owner:
```

## 2000 VU school-scale exploration

Status: Not run.

```text
Date:
Commit SHA:
Workflow run URL:
Workflow run ID:
Branch/ref:
Environment:
Dataset tier:
Registered synthetic users:
Command or workflow inputs: Load Validation, vus=2000, duration=20m
Script path: load-tests/k6.mixed.js
Route coverage summary:
Uncovered route risks:
Virtual users: 2000 expected
Duration: 20m expected
Passed thresholds? yes/no
HTTP error rate:
p95 read latency:
p95 write latency:
p99 latency:
Max memory:
DB connection peak:
CPU peak:
Top failing routes:
Top slow routes:
Authorization shortcuts used? yes/no
Production data used? no required
Overall verdict:
Required fixes:
Owner:
```

## Soak run

Status: Not run.

```text
Date:
Commit SHA:
Workflow run URL:
Workflow run ID:
Branch/ref:
Environment:
Dataset tier:
Registered synthetic users:
Command or workflow inputs: Load Validation, vus=100, duration=60m
Script path: load-tests/k6.mixed.js
Route coverage summary:
Uncovered route risks:
Virtual users: 100 expected
Duration: 60m expected
Passed thresholds? yes/no
HTTP error rate:
p95 read latency:
p95 write latency:
p99 latency:
Max memory:
DB connection peak:
CPU peak:
Top failing routes:
Top slow routes:
Authorization shortcuts used? yes/no
Production data used? no required
Overall verdict:
Required fixes:
Owner:
```

## Claim rules

### 300-500 VU claim

Allowed only if 300 and 500 VU runs pass thresholds and are recorded for the claimed environment, dataset tier, and route coverage.

### 1000 concurrent-user claim

Allowed only if 1000 VU run passes thresholds, DB/memory trends are stable, authorization shortcuts were not used, and route coverage limitations are explicitly documented.

### 20k-50k registered-user school-scale claim

Requires school-scale validation results plus load-test evidence. Passing load tests alone does not prove registered-user data volume; passing seed/query-plan validation alone does not prove concurrency. Current load script coverage exercises #44 subject routes at runtime but does not prove their DB-level query-plan safety.

## Current blockers

1. Load Validation workflow has not been run.
2. No smoke load result recorded.
3. Current k6 script covers #44 teacher-students/teacher-sections routes at runtime, but DB-level query-plan evidence is still missing.
4. No 300 VU result recorded.
5. No 500 VU result recorded.
6. No 1000 VU result recorded.
7. No 2000 VU result recorded.
8. No soak result recorded.
