# Next 20 Tasks - Batch 3

Branch: `2nd-main`  
Last updated: 2026-05-14

## Rule

Batch 3 focuses on remaining security hardening and operational guardrails. A task is only `Done` when code/docs/tests/workflows land or evidence is recorded.

## Batch 3: Security hardening and operational readiness

| # | Task | Status | Evidence / Notes |
|---:|---|---|---|
| 1 | Create Batch 3 tracker | Done | `docs/NEXT_20_TASKS_BATCH_3.md` |
| 2 | Add remaining security hardening backlog | Done | `docs/SECURITY_HARDENING_BACKLOG.md` |
| 3 | Add rate-limit hardening checklist | Done | `docs/SECURITY_HARDENING_BACKLOG.md` |
| 4 | Add signed URL TTL hardening checklist | Done | `docs/SECURITY_HARDENING_BACKLOG.md` |
| 5 | Add malware-scan fail-closed checklist | Done | `docs/SECURITY_HARDENING_BACKLOG.md` |
| 6 | Add pagination/sort/filter abuse checklist | Done | `docs/SECURITY_HARDENING_BACKLOG.md` |
| 7 | Add notification scope checklist | Done | `docs/SECURITY_HARDENING_BACKLOG.md` |
| 8 | Add subject/group scope checklist | Done | `docs/SECURITY_HARDENING_BACKLOG.md` |
| 9 | Add admin report/export checklist | Done | `docs/SECURITY_HARDENING_BACKLOG.md` |
| 10 | Add webhook idempotency checklist | Done | `docs/SECURITY_HARDENING_BACKLOG.md` |
| 11 | Add production secrets rotation checklist | Done | `docs/SECURITY_HARDENING_BACKLOG.md`, existing secrets docs |
| 12 | Add incident drill checklist | Done | `docs/SECURITY_HARDENING_BACKLOG.md`, existing incident docs |
| 13 | Link Batch 3 into master tracker | Done | `docs/2ND_MAIN_IMPROVEMENTS.md` |
| 14 | Update security acceptance gate with Batch 3 blockers | Done | `docs/SECURITY_ACCEPTANCE_GATE.md` |
| 15 | Update operational readiness with incident drill blockers | Done | `docs/OPERATIONAL_READINESS.md` |
| 16 | Update final merge gate with Batch 3 hardening evidence | Done | `docs/FINAL_MERGE_GATE.md` |
| 17 | Run backend security tests | Blocked | Requires CI/local run evidence |
| 18 | Run secret scan | Blocked | Requires CI/local run evidence |
| 19 | Run dependency audit | Blocked | Requires CI/local run evidence |
| 20 | Record security/build evidence | Blocked | Requires command output or workflow URLs |

## Current priority

Repo-editable Batch 3 hardening docs and gates are complete. Live verification is now the critical path.

## Hard blockers carried forward

- No latest backend security test result recorded.
- No latest secret scan result recorded.
- No latest dependency audit result recorded.
- No school-scale validation result recorded.
- No load-validation result recorded.
