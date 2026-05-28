# Load Test Plan

Branch: `2nd-main`  
Last updated: 2026-05-14

## Verdict

Not executed. No 20k-50k registered-user school-scale support claim is valid until this plan is implemented and results are recorded.

## Evidence documents

- Data-volume/query-plan validation: `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`
- Runtime concurrency/load validation: `docs/LOAD_TEST_RESULTS.md`

Passing one does not replace the other.

## Capacity target

The product requirement is now **20,000 to 50,000 registered users** for a school-based website project.

This must be measured precisely:

- Registered users: 20k first gate, 50k upper gate.
- Daily active users: target still needs confirmation.
- Peak concurrent users: target still needs confirmation.
- Sustained concurrent users: target still needs confirmation.
- Upload concurrency: target still needs confirmation.
- Teacher/admin export concurrency: target still needs confirmation.

Do not confuse registered users with concurrent active users. 50,000 registered users is a data-volume requirement. 50,000 concurrent active users is a separate architecture-scale problem and is not currently proven.

Tracking issues:

- #35: 1000+ capacity evidence gate
- #36: 20k-50k registered-user school-scale gate

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
| Target | 300 | 20 min | Validate expected target load from earlier plan | Pass thresholds |
| Stretch | 500 | 20 min | Explore headroom | Results documented |
| Capacity exploration | 1000 | 20 min | Explore 1000 concurrent-user behavior only after query bounds are fixed | Results documented; not a promise unless thresholds pass |
| School-scale exploration | 2000 | 20 min | Optional next step after 1000 VU passes | Results documented; not a promise unless thresholds pass |
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

Current scaffold:

- `load-tests/README.md`
- `load-tests/k6.mixed.js`

Preferred commands:

```bash
k6 run load-tests/k6.mixed.js
k6 run -e VUS=300 -e DURATION=20m load-tests/k6.mixed.js
k6 run -e VUS=500 -e DURATION=20m load-tests/k6.mixed.js
k6 run -e VUS=1000 -e DURATION=20m load-tests/k6.mixed.js
k6 run -e VUS=2000 -e DURATION=20m load-tests/k6.mixed.js
```

## Required test data

For school-scale readiness, the synthetic dataset must include at minimum:

- Tier 2: at least 20,000 student accounts, 800 teacher accounts, 20 admins, and matching academic/submission/file/notification volume.
- Tier 3: at least 50,000 student accounts, 2,000 teacher accounts, 50 admins, and matching academic/submission/file/notification volume.
- Multiple departments, sections, subjects, activities, groups, submissions, and files.
- Enough submissions/files to expose list/export query behavior.
- Fixtures must be synthetic and non-production.

## Security requirements during load

Load tests must not bypass authorization. They must verify:

- Student tokens only access that student's data.
- Teacher tokens only access assigned data.
- Admin flows are read-only unless explicitly isolated.
- File upload/download tests use test files only.
- Rate-limit expectations are documented.

## Evidence to collect

Record load outcomes in `docs/LOAD_TEST_RESULTS.md`.

- Command used
- Environment
- Commit SHA
- Dataset tier and counts
- Registered synthetic users
- VU count and duration
- p50/p95/p99 latencies
- Error rate
- Top failing routes
- Memory trend
- CPU trend if available
- Database connection trend
- Slow query evidence if available
- Logs/request IDs for representative failures

## Fail conditions

`LOAD-GATE` fails if:

- No load scripts exist.
- Synthetic dataset has fewer registered users than the claimed tier.
- 300-user target run is not executed and recorded in `docs/LOAD_TEST_RESULTS.md`.
- 1000-user capacity exploration is claimed as supported without passing thresholds and recorded evidence.
- 20k or 50k registered-user support is claimed without matching seeded dataset evidence in `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.
- p95/error/memory thresholds fail without documented mitigation.
- Authorization is bypassed for convenience.
- Test data is production data.
- Results are not recorded.

## Current blockers

1. School-scale validation results are not recorded.
2. No 20k or 50k synthetic dataset evidence exists.
3. No 300-user, 500-user, 1000-user, or 2000-user run evidence exists in `docs/LOAD_TEST_RESULTS.md`.
4. No memory/DB connection trend evidence exists.
5. Current load script is read-only and token-based; write-flow load scripts still need implementation.
