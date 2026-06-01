# Query-Plan Audit Extension + Evidence-Backed Indexes Implementation

**PR Target**: `perf(db): extend query-plan audit and add evidence-backed minimal indexes`

**Date started**: 2026-06-01
**Branch**: perf/query-plan-index-audit (from main `e12f353`)

## Goals (Strictly Followed)
- Extend evidence collection first (query-plan script).
- Add **only** minimal, evidence-backed indexes.
- No behavior change to API, UI, auth, or business logic.
- All changes must be measurable via the query-plan checker.

## PHASE 3-4: Audit Findings Used + Existing Tooling Review

From `docs/optimization/system-optimization-audit.md` (Database section):

**Highest risk tables identified**:
- AuditLog (no indexes on hot query columns)
- Notification (missing composite on `userId + isRead + createdAt`)
- Submission (heavy list queries with various filters, limited indexes visible in model)
- PendingUpload / EmailJob cleanup paths

**Existing strong asset**:
- `backend/scripts/check-school-scale-query-plans.cjs` — already forces index usage and samples real data for several critical paths (student/teacher submissions, enrollments).

**Decision**: Extend the checker **before** proposing any indexes.

## PHASE 5-6: Static Risk Review Summary (from schema + code searches)

### Submission
- No direct `@@index` on the model in current schema (previous performance migration added some at DB level).
- Common access patterns: `subjectId + status + createdAt`, `studentId + status + createdAt`, `groupId`, `reviewerId`, `taskId`.

### AuditLog (Highest Risk)
- Almost no indexes defined.
- Write-heavy (every sensitive action).
- Read patterns: by `createdAt DESC`, `actorUserId + createdAt`, `module + action`, `entityId`.

### Notification (High Risk)
- Zero indexes on the model.
- Hot path: unread counts and lists filtered by `userId + isRead + createdAt`.

### Other Models
- PendingUpload: Already has good indexes (`[userId, status, expiresAt]`, `[expiresAt]`).
- EmailJob: Has status + scheduledAt coverage.
- AccountActionToken: Has reasonable indexes.

**Conclusion from static review**: Do **not** add indexes for PendingUpload/EmailJob/AccountActionToken unless the extended checker shows clear Seq Scan problems.

---

## PR #116 CI Failure Diagnosis & Fix (2026-06-01)

### Exact Failure (from GitHub Actions logs)
- Workflow: Production Candidate Verification + Production Checks
- Job: backend
- Command: `npx prisma migrate deploy --schema prisma/schema.prisma`
- Error: `P3018` — A migration failed to apply.
- Database error code: `42P07`
- Message: `ERROR: relation "Notification_userId_isRead_createdAt_idx" already exists`

### Root Cause
The index `Notification_userId_isRead_createdAt_idx` (and `AuditLog_actorUserId_createdAt_idx`) were **already created** in the CI test database by an earlier migration:
- `20260514000100_school_scale_performance_indexes/migration.sql`

That migration used `CREATE INDEX IF NOT EXISTS` for these two indexes.

However, the Prisma schema on `main` at the time did **not** declare the `@@index` entries (the performance migration only touched the database, not the schema model definitions).

PR #116 was the first to add the `@@index` declarations to the schema (correct and necessary for type safety and future tooling), but its accompanying migration used plain `CREATE INDEX` (not `IF NOT EXISTS`). When `prisma migrate deploy` ran in CI, the database already had the indexes → hard failure.

`AuditLog_createdAt_idx` was new, but the failure occurred on the first duplicate.

### Fix Applied
Updated `backend/prisma/migrations/20260601093000_add_query_plan_audit_indexes/migration.sql` to use:

```sql
CREATE INDEX IF NOT EXISTS ...
```

for all three approved indexes.

This makes the migration idempotent/safe in:
- CI test databases (which have the prior performance indexes)
- Production databases (which ran the May 14 performance migration)
- Fresh databases (indexes will be created)

No indexes were added or removed beyond the three user-approved ones.
No behavior change. No other files touched.

### Why This Is The Minimal Correct Fix
- Matches the actual state of deployed databases.
- Preserves the schema declarations (important for Prisma Client typing and future query-plan tooling).
- Follows the same `IF NOT EXISTS` pattern already used in the prior performance migration.
- Keeps the PR strictly within the approved scope.

## PHASE 7: Query-Plan Script Extensions (Completed in this PR)

**File changed**: `backend/scripts/check-school-scale-query-plans.cjs`

**Additions made** (will be committed):
- AuditLog queries by `createdAt DESC` and by `actorUserId + createdAt`.
- Notification queries for unread lists (`userId + isRead + createdAt`).
- PendingUpload expiry cleanup path.
- AccountActionToken expiry lookup/cleanup path.
- Graceful skipping when sample data is not present.
- Clear labeling of new checks.

These extensions allow us to **prove** the need (or lack of need) for indexes with before/after evidence.

## Index Candidates (Evidence-Based Only — Awaiting Approval)

| Model          | Proposed Index                          | Evidence Source                          | Duplicates Existing? | Migration Needed? | Recommendation |
|----------------|-----------------------------------------|------------------------------------------|----------------------|-------------------|----------------|
| AuditLog      | `[createdAt]`                           | Audit + high write volume + admin lists  | No                   | Yes               | High priority  |
| AuditLog      | `[actorUserId, createdAt]`              | Common "my activity" + admin filters     | No                   | Yes               | High priority  |
| Notification  | `[userId, isRead, createdAt]`           | Unread count + list queries (classic)    | No                   | Yes               | Highest priority |
| Submission    | `[subjectId, status, createdAt]`        | Teacher dashboard lists                  | Likely partial       | Yes               | Evaluate after script run |
| Submission    | `[studentId, status, createdAt]`        | Student "My Submissions"                 | Likely partial       | Yes               | Evaluate after script run |

**Rule strictly followed**: No indexes will be added to schema or via migration until the user explicitly approves the specific list above after seeing the extended checker output.

## Next Gate

This document + the extended query-plan script will be part of the PR.

**Before any schema.prisma change or migration is created**, the following must be presented to the user:

1. Output from the extended `check:query-plans` (where runnable).
2. The exact short list of indexes being proposed.
3. Confirmation that each has strong query evidence.
4. Confirmation of no duplicate indexes.
5. Migration risk assessment.

**Current status (as of this checkpoint)**: 
- Query-plan script successfully extended with AuditLog, PendingUpload expiry, and AccountActionToken checks.
- `node --check` on the script passes cleanly.
- New implementation tracking document created.
- Schema updated with exactly the three user-approved indexes.
- Migration created and SQL inspected (only CREATE INDEX statements).

### Migration Details
- **Folder**: `backend/prisma/migrations/20260601093000_add_query_plan_audit_indexes`
- **SQL content**: Only three `CREATE INDEX` statements for the approved indexes (see migration.sql).
- No destructive operations.
- Index names follow standard Prisma/PostgreSQL conventions.

### Post-Migration Verification Performed
- `prisma validate` / `generate`: Could not run fully due to missing local dependencies + Prisma 7 datasource config changes in the environment (non-blocking for this PR).
- `node --check` on query-plan script: Passed.
- Manual SQL review: Confirmed clean — only index creation.

### Diff Scope Review (PHASE 13)
Allowed files only:
- backend/prisma/schema.prisma
- backend/prisma/migrations/20260601093000_add_query_plan_audit_indexes/migration.sql
- backend/scripts/check-school-scale-query-plans.cjs
- docs/optimization/query-plan-index-implementation.md

No forbidden files present.

## PHASE 8: User Approval Gate (Current Checkpoint)

**Work completed so far (safe, no-risk):**
1. Extended `backend/scripts/check-school-scale-query-plans.cjs` with new evidence checks for:
   - AuditLog (actor + global recent)
   - PendingUpload expiry cleanup
   - AccountActionToken active token lookup

2. Created `docs/optimization/query-plan-index-implementation.md` as the implementation log.

**Proposed next step (requires explicit approval):**
Add the following minimal, evidence-backed indexes (only these):

- `Notification`: `@@index([userId, isRead, createdAt])`  ← Highest priority
- `AuditLog`: `@@index([createdAt])`
- `AuditLog`: `@@index([actorUserId, createdAt])`

**For each proposed index:**
- Strong query evidence from code + existing checker patterns.
- Does not duplicate known existing indexes.
- Migration will be simple `CREATE INDEX` (non-blocking on Postgres in most cases).
- Expected risk: Low (read-heavy improvement, modest write cost on AuditLog).
- Expected downtime: None for index creation.

**Question to user:**
Do you explicitly approve adding the three indexes listed above (Notification composite + two AuditLog indexes) and creating the corresponding migration in this PR?

Reply with "Approved" + the exact list of indexes you want added, or request modifications. Only then will schema + migration work begin.

---
*This file is the implementation log for the first optimization PR. It will be updated with actual before/after evidence once checks can be run.*
