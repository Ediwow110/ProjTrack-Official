# Load Test Results

Branch: `2nd-main`  
Last updated: 2026-05-14

## Verdict

No load-test evidence recorded yet.

This document records concurrency/load evidence. It is separate from `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`, which records data-volume seed and query-plan validation.

## Critical distinction

- School-scale validation proves synthetic registered-user data volume and representative query plans.
- Load testing proves runtime behavior under concurrent traffic.
- 20k-50k registered users does not mean 20k-50k concurrent users.

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

```bash
k6 run load-tests/k6.mixed.js
k6 run -e VUS=300 -e DURATION=20m load-tests/k6.mixed.js
k6 run -e VUS=500 -e DURATION=20m load-tests/k6.mixed.js
k6 run -e VUS=1000 -e DURATION=20m load-tests/k6.mixed.js
k6 run -e VUS=2000 -e DURATION=20m load-tests/k6.mixed.js
```

## Result template

```text
Date:
Commit SHA:
Environment:
Dataset tier:
Registered synthetic users:
Command:
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

Status: Not run.

```text
Date:
Commit SHA:
Environment:
Dataset tier:
Registered synthetic users:
Command: k6 run load-tests/k6.mixed.js
Virtual users: 10 expected
Duration: 5m expected
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

## 300 VU target run

Status: Not run.

```text
Date:
Commit SHA:
Environment:
Dataset tier:
Registered synthetic users:
Command: k6 run -e VUS=300 -e DURATION=20m load-tests/k6.mixed.js
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
Environment:
Dataset tier:
Registered synthetic users:
Command: k6 run -e VUS=500 -e DURATION=20m load-tests/k6.mixed.js
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
Environment:
Dataset tier:
Registered synthetic users:
Command: k6 run -e VUS=1000 -e DURATION=20m load-tests/k6.mixed.js
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
Environment:
Dataset tier:
Registered synthetic users:
Command: k6 run -e VUS=2000 -e DURATION=20m load-tests/k6.mixed.js
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
Environment:
Dataset tier:
Registered synthetic users:
Command:
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

Allowed only if 300 and 500 VU runs pass thresholds and are recorded.

### 1000 concurrent-user claim

Allowed only if 1000 VU run passes thresholds, DB/memory trends are stable, and authorization shortcuts were not used.

### 20k-50k registered-user school-scale claim

Requires school-scale validation results plus load-test evidence. Passing load tests alone does not prove registered-user data volume; passing seed/query-plan validation alone does not prove concurrency.

## Current blockers

1. No smoke load result recorded.
2. No 300 VU result recorded.
3. No 500 VU result recorded.
4. No 1000 VU result recorded.
5. No 2000 VU result recorded.
6. No soak result recorded.
