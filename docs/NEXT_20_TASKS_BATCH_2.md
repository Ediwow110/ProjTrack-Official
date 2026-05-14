# Next 20 Tasks - Batch 2

Branch: `2nd-main`  
Last updated: 2026-05-14

## Rule

Batch 2 focuses on repo-editable risk reduction while Batch 1 waits for live evidence. A task is only `Done` when code/docs/tests/workflows land or evidence is recorded.

## Batch 2: Performance cleanup and regression prevention

| # | Task | Status | Evidence / Notes |
|---:|---|---|---|
| 1 | Create Batch 2 tracker | Done | `docs/NEXT_20_TASKS_BATCH_2.md` |
| 2 | Add legacy repository cleanup decision record | Done | `docs/ADR_SUBMISSION_LIST_BOUNDS.md` |
| 3 | Add tests preventing active service paths from calling legacy repository list helpers | Done | `backend/test/security/submission-list-response-bounds.spec.ts`, `backend/test/security/teacher-export-scope.spec.ts` |
| 4 | Add query-plan checker | Done | `backend/scripts/check-school-scale-query-plans.cjs` |
| 5 | Add school-scale index migration | Done | `backend/prisma/migrations/20260514000100_school_scale_performance_indexes/migration.sql` |
| 6 | Add query-audit checklist for dashboard/report/export routes | Done | `docs/QUERY_BOUND_AUDIT_CHECKLIST.md` |
| 7 | Add admin/report export bound review item | Done | `docs/QUERY_BOUND_AUDIT_CHECKLIST.md` |
| 8 | Add notification list bound review item | Done | `docs/QUERY_BOUND_AUDIT_CHECKLIST.md` |
| 9 | Add file download/signing query-bound review item | Done | `docs/QUERY_BOUND_AUDIT_CHECKLIST.md` |
| 10 | Add dashboard query-bound review item | Done | `docs/QUERY_BOUND_AUDIT_CHECKLIST.md` |
| 11 | Add search/filter allowlist review item | Done | `docs/QUERY_BOUND_AUDIT_CHECKLIST.md` |
| 12 | Add database-loop audit item | Done | `docs/QUERY_BOUND_AUDIT_CHECKLIST.md` |
| 13 | Add queued/streaming export ADR placeholder | Done | `docs/QUERY_BOUND_AUDIT_CHECKLIST.md` |
| 14 | Add school-scale operational assumptions doc | Done | `docs/SCHOOL_SCALE_OPERATIONAL_ASSUMPTIONS.md` |
| 15 | Add capacity claim wording guide | Done | `docs/CAPACITY_CLAIM_WORDING_GUIDE.md` |
| 16 | Add evidence update checklist | Done | `docs/EVIDENCE_UPDATE_CHECKLIST.md` |
| 17 | Run backend security tests | Blocked | Requires CI/local run evidence |
| 18 | Run backend build | Blocked | Requires CI/local run evidence |
| 19 | Run school-scale validation tier 1k | Blocked | Requires GitHub Actions run |
| 20 | Run load smoke validation | Blocked | Requires target API and load tokens |

## Current priority

Live validation is now the critical path. Repo-editable risk-reduction items in this batch are complete.

## Hard blockers carried from Batch 1

- No validation workflow result exists.
- No load workflow result exists.
- No security/build result is recorded.
- No 20k or 50k support claim is allowed.
