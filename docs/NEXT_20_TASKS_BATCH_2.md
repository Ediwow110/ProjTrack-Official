# Next 20 Tasks - Batch 2

Branch: `2nd-main`  
Last updated: 2026-05-14

## Rule

Batch 2 focuses on repo-editable risk reduction while Batch 1 waits for live evidence. A task is only `Done` when code/docs/tests/workflows land or evidence is recorded.

## Batch 2: Performance cleanup and regression prevention

| # | Task | Status | Evidence / Notes |
|---:|---|---|---|
| 1 | Create Batch 2 tracker | Done | `docs/NEXT_20_TASKS_BATCH_2.md` |
| 2 | Add legacy repository cleanup decision record | Not Started | Needed because repository replacement was blocked before |
| 3 | Add tests preventing active service paths from calling legacy repository list helpers | Done | `backend/test/security/submission-list-response-bounds.spec.ts`, `backend/test/security/teacher-export-scope.spec.ts` |
| 4 | Add query-plan checker | Done | `backend/scripts/check-school-scale-query-plans.cjs` |
| 5 | Add school-scale index migration | Done | `backend/prisma/migrations/20260514000100_school_scale_performance_indexes/migration.sql` |
| 6 | Add query-audit checklist for dashboard/report/export routes | Not Started | Needs repo doc |
| 7 | Add admin/report export bound review item | Not Started | Needs tracker/doc |
| 8 | Add notification list bound review item | Not Started | Needs tracker/doc |
| 9 | Add file download/signing query-bound review item | Not Started | Needs tracker/doc |
| 10 | Add dashboard query-bound review item | Not Started | Needs tracker/doc |
| 11 | Add search/filter allowlist review item | Not Started | Needs tracker/doc |
| 12 | Add database-loop audit item | Not Started | Needs tracker/doc |
| 13 | Add queued/streaming export ADR placeholder | Not Started | Needed if exports above 1000 rows are required |
| 14 | Add school-scale operational assumptions doc | Not Started | Clarify hosting/database assumptions |
| 15 | Add capacity claim wording guide | Not Started | Prevent accidental unsupported marketing copy |
| 16 | Add evidence update checklist | Not Started | Make post-run updates mechanical |
| 17 | Run backend security tests | Blocked | Requires CI/local run evidence |
| 18 | Run backend build | Blocked | Requires CI/local run evidence |
| 19 | Run school-scale validation tier 1k | Blocked | Requires GitHub Actions run |
| 20 | Run load smoke validation | Blocked | Requires target API and load tokens |

## Current priority

Reduce future regression risk while live validation remains pending.

## Hard blockers carried from Batch 1

- No validation workflow result exists.
- No load workflow result exists.
- No security/build result is recorded.
- No 20k or 50k support claim is allowed.
