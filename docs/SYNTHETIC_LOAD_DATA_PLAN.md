# Synthetic Load Data Plan

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

ProjTrack now targets more than 1000 end users. Load testing must use synthetic data large enough to expose query, index, authorization, dashboard, export, and file-path behavior.

## Verdict

Not implemented. No 1000+ end-user capacity claim is valid until a synthetic dataset exists and load results are recorded.

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

## Distribution assumptions

- 70% student-heavy traffic.
- 25% teacher traffic.
- 5% admin read-only traffic.
- Teachers own multiple subjects and sections.
- Students have multiple submissions and notifications.
- Some subjects use group submissions.
- Export paths must be tested against large scoped datasets.

## Required generator

Preferred location:

```text
backend/scripts/seed-load-fixtures.ts
```

Required command:

```bash
npm --prefix backend run seed:load
```

The generator must be idempotent or safely reset only synthetic fixture data.

## Required safety controls

- Must not run against production unless explicitly blocked as impossible.
- Must clearly tag fixture users/data as synthetic.
- Must not use real user data.
- Must not print secrets or tokens.
- Must create enough data to expose unbounded-query behavior.

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
files: 10000
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

1. `backend/scripts/seed-load-fixtures.ts` does not exist.
2. `npm --prefix backend run seed:load` does not exist.
3. PERF-GATE issue #34 remains open.
4. CAPACITY-GATE issue #35 remains open.
5. No load-test result has been recorded.
