# Synthetic Load Data Plan

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

ProjTrack now targets more than 1000 end users. Load testing must use synthetic data large enough to expose query, index, authorization, dashboard, export, and file-path behavior.

## Verdict

Partially implemented. A synthetic fixture generator and `seed:load` command now exist, but no seeded-run evidence or load-test result has been recorded yet.

## Minimum dataset for 1000+ end-user claim

| Entity | Minimum count | Notes |
|---|---:|---|
| Student users | 1000 | Synthetic accounts only |
| Teacher users | 50 | Enough to expose teacher dashboard/export behavior |
| Admin users | 5 | Smoke/admin read-only flows |
| Departments | 5 | Multiple academic divisions |
| Sections | 50 | Roughly 20 students per section |
| Subjects | 150 | Multiple teacher assignments |
| Activities/tasks | 750 | Enough for dashboard/submission list volume |
| Submissions | 10000 | Mix of individual/group/status values |
| Submission files | 10000 | Metadata enough for file list/download paths |
| Groups | 500 | Enough to expose group membership queries |
| Notifications | 10000 | Enough to expose user notification lists |

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

## Generator configuration

The generator supports count overrides:

```bash
LOAD_FIXTURE_STUDENTS=1000
LOAD_FIXTURE_TEACHERS=50
LOAD_FIXTURE_ADMINS=5
LOAD_FIXTURE_SECTIONS=50
LOAD_FIXTURE_SUBJECTS=150
LOAD_FIXTURE_TASKS_PER_SUBJECT=5
LOAD_FIXTURE_SUBMISSIONS=10000
LOAD_FIXTURE_NOTIFICATIONS=10000
npm --prefix backend run seed:load
```

## Required safety controls

- [x] Must not run against production unless explicitly allowed.
- [x] Must clearly tag fixture users/data as synthetic.
- [x] Must not use real user data.
- [x] Must not print secrets or tokens.
- [x] Must create enough data to expose unbounded-query behavior.
- [ ] Must be run and results recorded.

## Required output

The generator should print only counts and fixture identifiers, not credentials or sensitive tokens:

```text
Synthetic load fixture seed complete
students: 1000
teachers: 50
admins: 5
sections: 50
subjects: 150
activities: 750
submissions: 10000
notifications: 10000
```

## Load testing integration

Load test runs must record:

- Commit SHA
- Dataset counts
- Environment
- VU target
- Duration
- p95/p99 latency
- Error rate
- Memory trend
- Database connection trend
- Slow query findings

## Fail conditions

The 1000+ end-user claim fails if:

- Synthetic fixture data has fewer than 1000 students.
- Fixture generation cannot be reproduced.
- Production data is used.
- Submission list/export paths remain unbounded.
- 1000-user load evidence is missing but claimed.

## Current blockers

1. `npm --prefix backend run seed:load` has not been executed and recorded.
2. PERF-GATE issue #34 remains open.
3. CAPACITY-GATE issue #35 remains open.
4. No 300/500/1000-user load-test result has been recorded.
5. The seeder needs a real dry run against a disposable database to validate schema compatibility.
