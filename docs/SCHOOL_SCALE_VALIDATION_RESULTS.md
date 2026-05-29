# School Scale Validation Results

Branch: `2nd-main`  
Last updated: 2026-05-29

## Verdict

Validated up to 50k registered users (1k, 20k, and 50k runs completed successfully, with 0 sequential scan warnings).

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

Status: Passed.

```text
Date: 2026-05-29
Commit SHA: 9f470af
Workflow run URL: https://github.com/Ediwow110/ProjTrack-Official/actions/runs/26598324413
Tier: 20k
Students: 20000 expected (20000 actual)
Teachers: 800 expected (800 actual)
Admins: 20 expected (20 actual)
Sections: 800 expected (800 actual)
Subjects: 2400 expected (2400 actual)
Submissions: 200000 expected (200000 actual)
Notifications: 200000 expected (200000 actual)
Migration deploy result: Success
Backend build result: Success
Seed result: Success (took 21m 56s)
Query-plan result: Success (all 10 probes resolved to index scans)
Hot-table sequential scan warnings: 0
Overall verdict: Passed
Required fixes: None
Owner: AI Release Operator
```

## Tier 3: 50k upper school-scale

Status: Passed.

```text
Date: 2026-05-29
Commit SHA: 7b5dafc
Workflow run URL: https://github.com/Ediwow110/ProjTrack-Official/actions/runs/26616586205
Tier: 50k
Students: 50000 expected (50000 actual)
Teachers: 2000 expected (2000 actual)
Admins: 50 expected (50 actual)
Sections: 2000 expected (2000 actual)
Subjects: 6000 expected (6000 actual)
Submissions: 500000 expected (500000 actual)
Notifications: 500000 expected (500000 actual)
Migration deploy result: Success
Backend build result: Success
Seed result: Success (took 54m 35s)
Query-plan result: Success (all 10 probes resolved to index scans)
Hot-table sequential scan warnings: 0
Overall verdict: Passed
Required fixes: None
Owner: AI Release Operator
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

None. All validation checks pass.
