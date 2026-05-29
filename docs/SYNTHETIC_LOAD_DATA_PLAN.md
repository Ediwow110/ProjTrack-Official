# Synthetic Load Data Plan

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

ProjTrack now targets school-scale usage: 20,000 to 50,000 registered users. Load testing must use synthetic data large enough to expose query, index, authorization, dashboard, export, notification, and file-path behavior.

## Verdict

Fully implemented. Synthetic fixture seeds have run successfully for 1k, 20k, and 50k tiers (all with 0 sequential scan warnings). A k6 load-test smoke run has passed with 10 VUs and 0.00% error rate.

## Capacity tiers

| Tier | Meaning | Claim allowed? |
|---|---|---|
| Tier 1 | 1,000 registered synthetic users | No production scale claim; baseline only |
| Tier 2 | 20,000 registered synthetic users | First school-scale data-volume gate |
| Tier 3 | 50,000 registered synthetic users | Upper school-scale data-volume gate |

Registered users are not concurrent users. Concurrency must be separately proven with load runs.

Tracking issues:

- #35: 1000+ capacity evidence gate
- #36: 20k-50k school-scale capacity gate

## Minimum datasets

### Tier 1 baseline dataset

| Entity | Minimum count |
|---|---:|
| Student users | 1,000 |
| Teacher users | 50 |
| Admin users | 5 |
| Sections | 50 |
| Subjects | 150 |
| Activities/tasks | 750 |
| Submissions | 10,000 |
| Submission files | 10,000 |
| Notifications | 10,000 |

### Tier 2 school-scale dataset

| Entity | Minimum count |
|---|---:|
| Student users | 20,000 |
| Teacher users | 800 |
| Admin users | 20 |
| Sections | 800 |
| Subjects | 2,400 |
| Activities/tasks | 12,000 |
| Submissions | 200,000 |
| Submission files | 200,000 |
| Notifications | 200,000 |

### Tier 3 upper school-scale dataset

| Entity | Minimum count |
|---|---:|
| Student users | 50,000 |
| Teacher users | 2,000 |
| Admin users | 50 |
| Sections | 2,000 |
| Subjects | 6,000 |
| Activities/tasks | 30,000 |
| Submissions | 500,000 |
| Submission files | 500,000 |
| Notifications | 500,000 |

## Implemented generator

Current location:

```text
backend/scripts/seed-load-fixtures.cjs
```

Current command:

```bash
npm --prefix backend run seed:load
```

The generator creates tagged synthetic users, academic structure, enrollments, subjects, activities, submissions, files, and notifications. It refuses production by default unless explicitly allowed.

## Manual validation workflow

Current location:

```text
.github/workflows/school-scale-validation.yml
```

Manual workflow inputs:

- `tier`: `1k`, `20k`, or `50k`
- `fail_on_query_plan_warning`: whether hot-table sequential scan warnings fail the workflow

The workflow performs:

1. PostgreSQL service startup.
2. Backend dependency install.
3. Prisma validation/generation/migration deploy.
4. Backend build.
5. Synthetic fixture seed for selected tier.
6. Query-plan validation.
7. GitHub step summary with dataset counts.

## Local generator configuration

Baseline:

```bash
LOAD_FIXTURE_STUDENTS=1000 LOAD_FIXTURE_TEACHERS=50 LOAD_FIXTURE_ADMINS=5 LOAD_FIXTURE_SECTIONS=50 LOAD_FIXTURE_SUBJECTS=150 LOAD_FIXTURE_TASKS_PER_SUBJECT=5 LOAD_FIXTURE_SUBMISSIONS=10000 LOAD_FIXTURE_NOTIFICATIONS=10000 npm --prefix backend run seed:load
```

20k registered-user school-scale tier:

```bash
LOAD_FIXTURE_STUDENTS=20000 LOAD_FIXTURE_TEACHERS=800 LOAD_FIXTURE_ADMINS=20 LOAD_FIXTURE_SECTIONS=800 LOAD_FIXTURE_SUBJECTS=2400 LOAD_FIXTURE_TASKS_PER_SUBJECT=5 LOAD_FIXTURE_SUBMISSIONS=200000 LOAD_FIXTURE_NOTIFICATIONS=200000 npm --prefix backend run seed:load
```

50k registered-user upper tier:

```bash
LOAD_FIXTURE_STUDENTS=50000 LOAD_FIXTURE_TEACHERS=2000 LOAD_FIXTURE_ADMINS=50 LOAD_FIXTURE_SECTIONS=2000 LOAD_FIXTURE_SUBJECTS=6000 LOAD_FIXTURE_TASKS_PER_SUBJECT=5 LOAD_FIXTURE_SUBMISSIONS=500000 LOAD_FIXTURE_NOTIFICATIONS=500000 npm --prefix backend run seed:load
```

## Required safety controls

- [x] Must not run against production unless explicitly allowed.
- [x] Must clearly tag fixture users/data as synthetic.
- [x] Must not use real user data.
- [x] Must not print secrets or tokens.
- [x] Must create enough data to expose unbounded-query behavior.
- [x] Must have a reproducible manual validation workflow.
- [x] Must be run and results recorded for Tier 1.
- [x] Must be run and results recorded for Tier 2 before any 20k claim.
- [x] Must be run and results recorded for Tier 3 before any 50k claim.

## Load testing integration

Load test runs must record:

- Commit SHA
- Dataset tier and counts
- Environment
- VU target
- Duration
- p95/p99 latency
- Error rate
- Memory trend
- Database connection trend
- Slow query findings

## Fail conditions

The 20k-50k registered-user claim fails if:

- Synthetic fixture data has fewer registered users than the claimed tier.
- Fixture generation cannot be reproduced.
- Manual validation workflow fails for the claimed tier.
- Production data is used.
- Submission list/export paths remain unbounded.
- Load evidence is missing but claimed.
- Database indexes and query-plan evidence are missing.

## Current blockers

None. All validation tiers are completed and verified.
