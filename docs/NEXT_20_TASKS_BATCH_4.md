# Next 20 Tasks - Batch 4

Branch: `2nd-main`  
Last updated: 2026-05-14

## Rule

Batch 4 focuses on executable regression guards and remaining repo-editable controls. A task is only `Done` when code/docs/tests/workflows land or evidence is recorded.

## Batch 4: Executable guardrails and remaining controls

| # | Task | Status | Evidence / Notes |
|---:|---|---|---|
| 1 | Create Batch 4 tracker | Done | `docs/NEXT_20_TASKS_BATCH_4.md` |
| 2 | Add static regression test preventing active service use of legacy unbounded submission helpers | Done | `backend/test/security/submission-service-static-bounds.spec.ts` |
| 3 | Add static regression test requiring teacher export truncation metadata | Done | `backend/test/security/submission-service-static-bounds.spec.ts` |
| 4 | Add static regression test requiring capacity-claim checker in release hygiene | Done | `scripts/check-release-guard-wiring.mjs`, `scripts/release-hygiene-check.mjs`, `package.json` |
| 5 | Add docs index for validation/evidence files | Done | `docs/EVIDENCE_DOCS_INDEX.md` |
| 6 | Add release evidence checklist to README or docs | Not Started | Avoid accidental claims |
| 7 | Add load workflow secret preflight doc | Done | `docs/LOAD_VALIDATION_RUNBOOK.md` |
| 8 | Add school-scale workflow runbook | Done | `docs/SCHOOL_SCALE_VALIDATION_RUNBOOK.md` |
| 9 | Add production-check failure issue runbook | Done | `docs/PRODUCTION_CHECK_FAILURE_RUNBOOK.md` |
| 10 | Add query-plan warning triage runbook | Done | `docs/QUERY_PLAN_WARNING_TRIAGE_RUNBOOK.md` |
| 11 | Add export strategy ADR placeholder | Not Started | Hard cap vs queued vs streaming |
| 12 | Add migration deployment evidence template | Not Started | Record deploy result consistently |
| 13 | Add backend build/security evidence template | Not Started | Record command output consistently |
| 14 | Add school-scale claim review checklist | Not Started | Pre-README/product review |
| 15 | Link Batch 4 into master tracker | Not Started | `docs/2ND_MAIN_IMPROVEMENTS.md` |
| 16 | Update final merge gate with static regression guard references | Not Started | `docs/FINAL_MERGE_GATE.md` |
| 17 | Run static/security test suite | Blocked | Requires CI/local run evidence |
| 18 | Run capacity/release hygiene checks | Blocked | Requires CI/local run evidence |
| 19 | Run school-scale validation tier 1k | Blocked | Requires GitHub Actions run |
| 20 | Run load smoke validation | Blocked | Requires target API and load tokens |

## Current priority

Turn documentation decisions into tests/checks where possible, then record live evidence.
