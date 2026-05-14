# Next 20 Tasks - Batch 3

Branch: `2nd-main`  
Last updated: 2026-05-14

## Rule

Batch 3 focuses on remaining security hardening and operational guardrails. A task is only `Done` when code/docs/tests/workflows land or evidence is recorded.

## Batch 3: Security hardening and operational readiness

| # | Task | Status | Evidence / Notes |
|---:|---|---|---|
| 1 | Create Batch 3 tracker | Done | `docs/NEXT_20_TASKS_BATCH_3.md` |
| 2 | Add remaining security hardening backlog | Not Started | Need consolidated doc |
| 3 | Add rate-limit hardening checklist | Not Started | Runtime abuse path |
| 4 | Add signed URL TTL hardening checklist | Not Started | File access path |
| 5 | Add malware-scan fail-closed checklist | Not Started | Upload path |
| 6 | Add pagination/sort/filter abuse checklist | Not Started | Query abuse path |
| 7 | Add notification scope checklist | Not Started | Cross-user notification path |
| 8 | Add subject/group scope checklist | Not Started | Enrollment/group ownership path |
| 9 | Add admin report/export checklist | Not Started | Privileged export path |
| 10 | Add webhook idempotency checklist | Not Started | External provider retry path |
| 11 | Add production secrets rotation checklist | Not Started | Secrets lifecycle path |
| 12 | Add incident drill checklist | Not Started | Operational readiness path |
| 13 | Link Batch 3 into master tracker | Not Started | `docs/2ND_MAIN_IMPROVEMENTS.md` |
| 14 | Update security acceptance gate with Batch 3 blockers | Not Started | `docs/SECURITY_ACCEPTANCE_GATE.md` |
| 15 | Update operational readiness with incident drill blockers | Not Started | `docs/OPERATIONAL_READINESS.md` |
| 16 | Update final merge gate with Batch 3 hardening evidence | Not Started | `docs/FINAL_MERGE_GATE.md` |
| 17 | Run backend security tests | Blocked | Requires CI/local run evidence |
| 18 | Run secret scan | Blocked | Requires CI/local run evidence |
| 19 | Run dependency audit | Blocked | Requires CI/local run evidence |
| 20 | Record security/build evidence | Blocked | Requires command output or workflow URLs |

## Current priority

Complete repo-editable hardening docs and gates first, then run live verification.

## Hard blockers carried forward

- No latest backend security test result recorded.
- No latest secret scan result recorded.
- No latest dependency audit result recorded.
- No school-scale validation result recorded.
- No load-validation result recorded.
