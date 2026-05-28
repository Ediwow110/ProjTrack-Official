# School Scale Validation Results

Branch: `2nd-main`  
Last updated: 2026-05-14

## Verdict

Not validated yet.

This document records evidence from `.github/workflows/school-scale-validation.yml`. Do not claim 20k-50k registered-user support until the relevant tier has a passing recorded result here.

## Required workflow

Workflow: `School Scale Validation`  
File: `.github/workflows/school-scale-validation.yml`

Required run order:

1. Tier `1k`
2. Tier `20k`
3. Tier `50k`

Do not run the `50k` tier until the `1k` and `20k` tiers have passed or have documented blockers.

## Evidence rules

Each result must record:

- Date
- Commit SHA
- Workflow run URL
- Tier
- Dataset counts
- Migration result
- Seed result
- Query-plan result
- Query-plan warnings count
- Build result
- Overall verdict
- Required fixes

## Tier result template

```text
Date:
Commit SHA:
Workflow run URL:
Tier:
Students:
Teachers:
Admins:
Sections:
Subjects:
Submissions:
Notifications:
Migration deploy result:
Backend build result:
Seed result:
Query-plan result:
Hot-table sequential scan warnings:
Overall verdict:
Required fixes:
Owner:
```

## Tier 1: 1k baseline

Status: Passed.

```text
Date: 2026-05-29
Commit SHA: 9f470af
Workflow run URL: https://github.com/Ediwow110/ProjTrack-Official/actions/runs/26598211283
Tier: 1k
Students: 1000 expected (1000 actual)
Teachers: 50 expected (50 actual)
Admins: 5 expected (5 actual)
Sections: 50 expected (50 actual)
Subjects: 150 expected (150 actual)
Submissions: 10000 expected (10000 actual)
Notifications: 10000 expected (10000 actual)
Migration deploy result: Success
Backend build result: Success
Seed result: Success (took 72s)
Query-plan result: Success (all 10 probes resolved to index scans)
Hot-table sequential scan warnings: 0
Overall verdict: Passed
Required fixes: None
Owner: AI Release Operator
```

## Tier 2: 20k school-scale

Status: Not run.

```text
Date:
Commit SHA:
Workflow run URL:
Tier: 20k
Students: 20000 expected
Teachers: 800 expected
Admins: 20 expected
Sections: 800 expected
Subjects: 2400 expected
Submissions: 200000 expected
Notifications: 200000 expected
Migration deploy result:
Backend build result:
Seed result:
Query-plan result:
Hot-table sequential scan warnings:
Overall verdict:
Required fixes:
Owner:
```

## Tier 3: 50k upper school-scale

Status: Not run.

```text
Date:
Commit SHA:
Workflow run URL:
Tier: 50k
Students: 50000 expected
Teachers: 2000 expected
Admins: 50 expected
Sections: 2000 expected
Subjects: 6000 expected
Submissions: 500000 expected
Notifications: 500000 expected
Migration deploy result:
Backend build result:
Seed result:
Query-plan result:
Hot-table sequential scan warnings:
Overall verdict:
Required fixes:
Owner:
```

## Claim rules

### 1k baseline claim

Allowed only if Tier 1 passes migration, build, seed, and query-plan validation.

### 20k registered-user claim

Allowed only if:

- Tier 1 passes.
- Tier 2 passes.
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md` has no open blocker for active high-volume service paths.
- Query-plan warnings are either zero or explicitly accepted with mitigation.

### 50k registered-user claim

Allowed only if:

- Tier 1 passes.
- Tier 2 passes.
- Tier 3 passes.
- Seed duration/resource impact is acceptable.
- Query-plan warnings are zero or explicitly accepted with mitigation.
- Load-test evidence is recorded separately.

## Non-claims

Passing this workflow does not prove:

- 20k concurrent users.
- 50k concurrent users.
- Production readiness.
- File upload throughput.
- Real browser concurrency.
- External mail/provider scalability.

Those require separate load, storage, and operational evidence.

## Current blockers

1. No `School Scale Validation` workflow run has been recorded.
2. No 1k tier evidence exists.
3. No 20k tier evidence exists.
4. No 50k tier evidence exists.
5. No load-test evidence exists.
