# School-Scale Operational Assumptions

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

This document states the assumptions behind any future 20k-50k registered-user school-scale claim. Without these assumptions, capacity language is meaningless.

## Claim boundary

The target is 20,000 to 50,000 **registered users**. This is not the same as 20,000 to 50,000 concurrent active users.

A valid school-scale claim must specify:

- registered-user tier validated: 1k, 20k, or 50k,
- dataset size used,
- environment used,
- database size/tier,
- application instance count,
- object storage mode,
- worker configuration,
- load-test concurrency reached,
- known exclusions.

## Minimum assumed architecture for 20k registered users

These are initial assumptions, not proven facts:

- Managed PostgreSQL or equivalent production-grade PostgreSQL.
- Connection pooling configured and monitored.
- Application runs behind a production reverse proxy/platform.
- File storage uses object storage, not local disk.
- Background workers run separately from web API processes where applicable.
- Health checks are cheap and dependency-aware.
- Logs and request IDs are available for incident triage.
- Backup and restore procedures are tested.

## Minimum assumed architecture for 50k registered users

The 50k tier likely requires all 20k assumptions plus:

- larger database instance or tuned managed database tier,
- explicit database connection pool limits,
- query-plan validation on seeded 50k data,
- memory/CPU trend collection during load tests,
- queue or streaming strategy for large exports,
- object-storage smoke evidence,
- rate limits on expensive endpoints,
- alerting on API errors, worker failures, DB saturation, and storage failures.

## Non-assumptions

Do not assume:

- local SQLite/local disk behavior represents production,
- 50k registered users means 50k concurrent users,
- passing unit tests proves capacity,
- response caps alone prove scalability,
- synthetic seed success proves real traffic performance,
- k6 read-only flows prove upload/export/write scalability,
- admin or teacher exports can safely return unlimited rows.

## Required evidence before claims

### 20k registered-user claim

- Tier `1k` school-scale validation result recorded.
- Tier `20k` school-scale validation result recorded.
- Query-plan warnings resolved or risk-accepted.
- Load smoke and at least 300 VU evidence recorded.
- Security/build evidence recorded.

### 50k registered-user claim

- Tier `1k`, `20k`, and `50k` validation results recorded.
- Query-plan warnings resolved or risk-accepted.
- Seed duration and database resource impact recorded.
- Load evidence recorded at the selected concurrency target.
- Memory/DB connection trends recorded.

### 1000+ concurrent-user claim

- 1000 VU load test passes thresholds.
- Dataset tier is recorded.
- Authorization shortcuts are not used.
- Memory and DB connection trends are stable.
- Top slow/failing routes are documented.

## Evidence files

- `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`
- `docs/LOAD_TEST_RESULTS.md`
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/CI_STATUS.md`
- `docs/SECURITY_ACCEPTANCE_GATE.md`

## Current verdict

Operational assumptions are documented, but they are not yet validated. Do not claim 20k-50k school-scale support until the evidence files contain passing results.
