# Load Test Plan

Branch: `2nd-main`  
Last updated: 2026-05-14

## Verdict

Not executed. No 300-500 concurrent-user claim is valid until this plan is implemented and results are recorded.

## Purpose

This plan defines the load tests required before ProjTrack can make realistic capacity claims. The goal is not to produce a vanity number. The goal is to prove that critical user flows remain correct, secure, and operationally observable under expected traffic.

## Scope

The load plan covers:

- Student login and dashboard summary
- Student subject/activity browsing
- Student submission list/detail
- Student file upload and submission create flow
- Teacher login and dashboard summary
- Teacher submission queue and review flow
- Teacher export flow
- Admin login and dashboard summary
- Admin reports/system settings read paths
- Health readiness/liveness checks

## Out of scope for first load milestone

- Destructive admin bulk operations
- Backup restore under load
- Mail-provider stress testing against real provider
- Production data testing
- Browser-based visual E2E at scale

## Test environments

### Local smoke load

Purpose: catch obvious unbounded queries, memory leaks, and slow endpoints before staging.

Minimum:

- Local PostgreSQL
- Local object storage or S3-compatible test bucket
- Stubbed mail provider
- Test-only accounts and fixtures

### Staging load

Purpose: prove deployment-like runtime behavior.

Minimum:

- Staging database
- S3-compatible object storage
- Production-like runtime configuration
- Mail provider stub or sandbox mode
- Monitoring/log capture enabled

## Required user profiles

| Profile | Share | Flows |
|---|---:|---|
| Student | 70% | login, dashboard, subjects, submissions, upload, submit |
| Teacher | 25% | login, dashboard, submissions, review, export |
| Admin | 5% | login, dashboard, reports/settings read-only |

## Load stages

| Stage | Virtual users | Duration | Purpose | Required result |
|---|---:|---:|---|---|
| Smoke | 10 | 5 min | Verify script correctness | No functional failures |
| Baseline | 50 | 10 min | Establish baseline latency/errors | Pass thresholds |
| Target | 300 | 20 min | Validate expected target load | Pass thresholds |
| Stretch | 500 | 20 min | Explore headroom, not a promise | Results documented |
| Soak | 100 | 60 min | Catch leaks and degradation | Stable memory/errors |

## Minimum thresholds

These thresholds are initial gates and may be tightened after baseline results.

| Metric | Target gate |
|---|---|
| HTTP error rate | < 1% excluding expected 401/403 negative tests |
| p95 API latency for read paths | < 800 ms |
| p95 API latency for write paths | < 1500 ms |
| p95 file upload latency | < 5000 ms for accepted test file size |
| p95 teacher export start/response | < 5000 ms for bounded fixture |
| Ready health endpoint | No false healthy during dependency failure tests |
| Process memory | No unbounded growth during soak |
| Database connections | Below configured pool limit with headroom |
| Background workers | No retry storm |

## Required scripts

Preferred location:

```text
load-tests/
  README.md
  k6.student.js
  k6.teacher.js
  k6.admin.js
  k6.mixed.js
  fixtures/
```

Preferred commands:

```bash
k6 run load-tests/k6.mixed.js
k6 run -e VUS=300 -e DURATION=20m load-tests/k6.mixed.js
k6 run -e VUS=500 -e DURATION=20m load-tests/k6.mixed.js
```

## Required test data

- At least 300 student accounts
- At least 30 teacher accounts
- At least 3 admin/smoke admin accounts
- Multiple departments, sections, subjects, activities, groups, submissions, and files
- Fixtures must be synthetic and non-production

## Security requirements during load

Load tests must not bypass authorization. They must verify:

- Student tokens only access that student's data.
- Teacher tokens only access assigned data.
- Admin flows are read-only unless explicitly isolated.
- File upload/download tests use test files only.
- Rate-limit expectations are documented.

## Evidence to collect

- Command used
- Environment
- Commit SHA
- Dataset size
- VU count and duration
- p50/p95/p99 latencies
- Error rate
- Top failing routes
- Memory trend
- CPU trend if available
- Database connection trend
- Slow query evidence if available
- Logs/request IDs for representative failures

## Results template

```text
Date:
Commit SHA:
Environment:
Command:
Dataset:
Virtual users:
Duration:
Passed thresholds? yes/no
p95 read latency:
p95 write latency:
Error rate:
Max memory:
DB connection peak:
Top failures:
Fixes required:
Owner:
```

## Fail conditions

`LOAD-GATE` fails if:

- No load scripts exist.
- 300-user target run is not executed.
- p95/error/memory thresholds fail without documented mitigation.
- Authorization is bypassed for convenience.
- Test data is production data.
- Results are not recorded.

## Current blockers

1. No `load-tests/` scripts exist yet.
2. No synthetic load dataset generator is documented.
3. No 300-user or 500-user run evidence exists.
4. No memory/DB connection trend evidence exists.
5. No slow-query evidence exists.
