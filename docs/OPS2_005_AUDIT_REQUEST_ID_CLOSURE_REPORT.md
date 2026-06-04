# OPS2-005 Closure Report — Audit Logs RequestId Correlation

## 1. Executive Summary

- **Date:** 2026-06-04
- **Latest main SHA:** `1460ce9736850413beb2a58e33c9295e49f29f77`
- **Final Verdict:** OPS2-005 COMPLETE

Audit log records now carry a `requestId` field correlated from the HTTP request context, enabling operators to trace audit events back to the originating request. The fix uses the existing `AsyncLocalStorage` request context infrastructure, requires no frontend changes, and preserves all existing audit behavior.

## 2. Fix Summary

- **PR:** [#168](https://github.com/Ediwow110/ProjTrack-Official/pull/168)
- **Merge commit:** `1460ce9736850413beb2a58e33c9295e49f29f77`
- **Merge method:** Merge commit
- **Changed files:**
  - `backend/prisma/schema.prisma` — added `requestId String?` to AuditLog model
  - `backend/prisma/migrations/20260604073345_add_audit_log_request_id/migration.sql` — migration (ALTER TABLE ADD COLUMN, nullable)
  - `backend/src/audit-logs/audit-logs.service.ts` — wired `getRequestId()` from AsyncLocalStorage context
  - `backend/src/repositories/audit-log.repository.ts` — added `requestId` to `AuditRecordCreateInput` and Prisma create call
  - `backend/src/admin/admin.service.ts` — added `requestId` to two transaction-bound `tx.auditLog.create` call sites
  - `backend/test/security/audit-log-regressions.spec.ts` — 4 new tests

**Propagation strategy:**
- **Central path (~50+ call sites):** `AuditLogsService.record()` automatically reads `getRequestId()` from the `AsyncLocalStorage` context and passes it to the repository. No individual call site changes needed.
- **Transaction-bound path (2 sites):** `admin.service.ts` user DEACTIVATE and DELETE — `getRequestId()` called directly inside each `tx.auditLog.create`.

**Storage strategy:**
- Top-level nullable `requestId` field on the `AuditLog` model. Backward-compatible — existing records have `NULL`.

**Schema/migration:** ✅ Yes. Single ALTER TABLE ADD COLUMN, nullable, no default, no backfill. Fully backward-compatible.

## 3. Verification

| Check | Result |
|-------|--------|
| Backend build | PASS |
| Unit tests | 287/287 PASS |
| Security tests | 233/233 PASS (4 new requestId tests) |
| Prisma validate | PASS |
| Root typecheck | PASS |
| Frontend tests | 32/32 PASS |
| GitHub CI (PR) | PASS (backend, frontend, e2e, production gates) |
| GitHub CI (main post-merge) | PASS |
| Secrets scan | No secrets/raw bodies/auth headers stored |

**Tests added:**
1. `includes requestId from context when calling repository.create` — verifies propagation
2. `works without requestId when no request context exists` — verifies background/worker safety
3. `allows explicit requestId passed in input to override context value` — verifies override
4. `does not include requestId in sensitive key leak checks` — verifies `requestId` is not miscategorized

## 4. Boundaries

- **OPS2-005 only** — no OPS2-006 (monitoring wiring), no OPS2-007–013 touched
- No Docker compose changes
- No backup runbook changes
- No unrelated audit semantics changes
- OPS2-004 `auditList` bounds preserved (default take: 100, max take: 500, skip/from/to filters, deterministic ordering)
- System/background audit records without HTTP request safely get `NULL` requestId
- Transaction-bound audit entries remain inside their transactions (DEACTIVATE, DELETE)
- No frontend changes required

## 5. Remaining Ops Watchlist

| OPS | Title | Severity |
|-----|-------|----------|
| OPS2-006 | Monitoring not wired | Medium |
| OPS2-007 | _reserved_ | Low |
| OPS2-008 | _reserved_ | Low |
| OPS2-009 | _reserved_ | Low |
| OPS2-010 | _reserved_ | Low |
| OPS2-011 | _reserved_ | Low |
| OPS2-012 | _reserved_ | Low |
| OPS2-013 | _reserved_ | Low |

## 6. Final Verdict

**A. OPS2-005 COMPLETE**
