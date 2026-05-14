# Query Plan Warning Triage Runbook

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

Use this runbook when `npm --prefix backend run check:query-plans` reports hot-table sequential scan warnings or unexpected query plans.

## Command

```bash
npm --prefix backend run check:query-plans
```

## First response

1. Record the command output in `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.
2. Identify the query label that produced the warning.
3. Identify the table and plan node involved.
4. Confirm the dataset tier used.
5. Confirm whether the school-scale index migration was deployed.

## Common causes

- Index migration was not deployed.
- Seeded dataset is too small for the planner to prefer an index.
- Query predicate does not match the intended index order.
- Missing composite index for filter + order pattern.
- Planner statistics are stale.
- Query uses an include/join pattern different from the checked SQL.

## Triage checklist

- [ ] Confirm `prisma:migrate:deploy` passed.
- [ ] Confirm the expected index exists in PostgreSQL.
- [ ] Confirm dataset tier and row counts.
- [ ] Rerun after database statistics are refreshed if needed.
- [ ] Compare active Prisma query to the SQL checked by the script.
- [ ] Add or adjust index only if the active query path justifies it.
- [ ] Update `docs/PERFORMANCE_ACCEPTANCE_GATE.md` with the decision.

## Risk acceptance format

If a warning is accepted, record:

```text
Warning:
Dataset tier:
Reason accepted:
Expected production impact:
Mitigation:
Owner:
Expiration/review date:
```

## Hard rule

Do not claim 20k-50k registered-user readiness with unexplained query-plan warnings on high-volume active paths.
