# PERF2-003: Backup/Delete Unbounded findMany Investigation

## 1. Executive Summary

**Date:** 2026-06-04
**Latest main SHA:** `f21103935375f480aeebbbe9d146f68227df045a`
**Classification:** **B. LOW WATCHLIST**

**Verdict:** The backup snapshot `collectData()` intentionally loads all tables into memory for backup completeness — this is not a bug at expected school scale. All deletion paths (`deleteUser`, data deletion execution) are properly scoped with targeted queries or bounded `take` limits. The backup path runs in a background worker, not an API request path, which mitigates OOM risk. No immediate fix is needed, but chunking should be documented as a future threshold.

Several admin list endpoints (`users()`, `students()`, `auditList()`, `resolveAudience()`, etc.) also use unbounded `findMany()` but these are outside the backup/delete scope of PERF2-003 and should be tracked separately if needed.

---

## 2. Baseline Verification

- **git status:** Clean tracked files (3 untracked artifacts: `.playwright-mcp/`, `AGENTS.md`, `login-page-snapshot.md`)
- **CI status (merge commit `f211039`):** CI: success ✅, Production Candidate Verification: success ✅
- **Local checks:** Backend build: PASS, unit tests: 287, security tests: 214, Prisma validate: ✅, frontend typecheck: PASS, frontend tests: 32

---

## 3. Scope

### Files inspected
- `backend/src/backups/backups.service.ts` (983 lines)
- `backend/src/backups/backup-retention.service.ts` (76 lines)
- `backend/src/backups/backup-worker.service.ts`
- `backend/src/admin/admin.service.ts` (4823 lines)
- `backend/src/data-deletion/data-deletion-execution.service.ts` (618 lines)
- `backend/src/data-deletion/data-deletion.service.ts`

### Methods inspected
- `collectData()` — backup snapshot
- `createBackup()` → `runManual()` / `createAutomaticBackupIfDue()` — backup triggers
- `listHistory()` — backup history list
- `cleanupExpired()` — backup retention
- `deleteUser()` — admin hard delete
- `deactivateUser()` — admin deactivation
- `getUserDeletionDependencySummary()` — pre-delete check
- `attemptExecution()` — data deletion destructive execution
- `buildExecutionPlan()` — deletion plan
- `findBackupVerifiedExecutions()` — worker execution fetch
- `getRolloutStatus()` — dashboard counts
- `users()`, `students()`, `teachers()`, `groups()`, `auditList()` — admin list queries (secondary)
- `resolveAudience()` → `broadcast()` — notification dispatch
- `notificationsList()` — admin notification feed
- `calendarEvents()` — admin calendar view

---

## 4. Backup Snapshot Analysis

| Method | Caller | Tables Loaded | Bounded? | Completeness Requirement | Memory Risk | Recommendation |
|--------|--------|---------------|----------|------------------------|-------------|----------------|
| `collectData()` | `createBackup()` → `runManual()` / `createAutomaticBackupIfDue()` | user, studentProfile, teacherProfile, academicYear, academicYearLevel, section, subject, subjectSection, enrollment, submissionTask, group, groupMember, submission, submissionFile, submissionEvent, notification, emailJob (take: 5000), systemSetting | 17/18 unbounded; emailJob bounded `take: 5000` | Yes — backup completeness requires ALL rows | Low at expected school scale (hundreds-thousands). Risk grows at >100k records/table. | LOW WATCHLIST — chunking should be documented for future scale |
| `listHistory()` | Controller → admin UI | backupRun | `take: 100` | No — UI pagination only | None | Already correctly bounded |
| `normalizeLocalArtifacts()` | `listHistory()` | backupRun | Selective `{ select: { fileName: true } }` | Metadata reconciliation | None | Already efficient |
| `cleanupExpired()` | BackupWorker tick | backupRun | `take: 500` | Retention policy evaluation | None | Already correctly bounded |

### Key findings:
- `submissionFile` stores **metadata only** (fileName, fileSize, relativePath) — no binary payloads
- Backup runs in **background worker** (separate from API request path), mitigating API timeout risk
- No `$transaction` wraps `collectData()` — data consistency across tables during concurrent writes is best-effort
- The entire snapshot is serialized to a JSON file via `storage.writeJson()`
- `emailJob` has `take: 5000` — acknowledging this table can grow large

---

## 5. Admin Delete Analysis

| Method | Caller | Tables Loaded | Bounded? | Target Scoped? | Risk | Recommendation |
|--------|--------|---------------|----------|---------------|------|----------------|
| `deleteUser()` | Controller → `DELETE users/:id` | user (findUnique + include), then `count()` queries for dependencies | Yes — `findUnique` (single row), `count()` aggregates | Yes — scoped to single userId | None | NOT A BUG |
| `deactivateUser()` | Controller → `POST users/:id/deactivate` | user (findUnique), authSession (updateMany), auditLog (create) | Yes — `findUnique` single row, `updateMany`/`create` scoped | Yes — scoped to single userId | None | NOT A BUG |
| `getUserDeletionDependencySummary()` | `deleteUser()` | `submission.count`, `groupMember.count`, `subject.count` | Yes — all `count()` aggregates | Yes — scoped to userId | None | NOT A BUG |
| `attemptExecution()` | Worker / manual trigger | dataDeletionExecution + request (findUnique), then `deleteMany`/`updateMany` per table | Yes — `findUnique` single execution, all deletes targeted by userId | Yes — scoped to single userId | None | NOT A BUG |
| `buildExecutionPlan()` | `startDryRun()` / `getOrCreateExecution` | emailJob.count, notification.count, pendingUpload.count, authSession.count, token.count, groupMember.count, enrollment.count, subject.count | Yes — all `count()` aggregate queries | Yes — scoped to single userId | None | NOT A BUG |
| `findBackupVerifiedExecutions()` | Worker tick | dataDeletionExecution | `take: 10` (parameterized, default 10) | Backlog of pending executions | None | Already correctly bounded |
| `getRolloutStatus()` | Controller → settings UI | dataDeletionExecution (2× findMany) + 4× count | `take: 10` for findMany, `count()` for aggregates | Dashboard overview | None | Already correctly bounded |

---

## 6. Admin List Endpoints (Secondary — Outside PERF2-003 Scope)

| Method | Tables Loaded | Bounded? | Risk | Notes |
|--------|---------------|----------|------|-------|
| `users()` | user + studentProfile.section + teacherProfile | No — unbounded all users, in-memory filter | LOW — user table expected small (<10k) | Filtering done in-memory |
| `students()` | user + studentProfile.section.academicYear + authSessions + accountActionTokens + emailJob | No — unbounded all students with deep includes | LOW-MEDIUM — grows with school size | Deepest includes in admin; `emailJob` lookup adds extra query |
| `teachers()` | user + teacherProfile; subject + enrollments.student.user.section | No — unbounded all teachers + all subjects | LOW — teacher table expected small | Deep includes for subject listing |
| `groups()` | group + subject.enrollments.section + section + members.student | No — unbounded all groups with deep includes | LOW — groups scale with subjects | In-memory filtering by section/status |
| `auditList()` | auditLog + actor | No — unbounded ALL audit logs | **LOW-MEDIUM** — audit logs grow unboundedly over time | **Worst long-term offender** — should add `take: 500` or pagination |
| `notificationsList()` | notification + user | No — unbounded with optional filters | LOW — admin-only, filtered by role/type | Could grow large if notifications accumulate |
| `calendarEvents()` | submissionTask + subject.enrollments.section; announcement | No — unbounded both | LOW — scales with subjects | In-memory sort/merge of two result sets |
| `resolveAudience()` → `broadcast()` | user (by role or all) | No — unbounded ALL users in audience | **LOW-MEDIUM** — iterates ALL active users creating notifications/emails sequentially | Broadcast is rare admin action |

---

## 7. Evidence

### Backup `collectData()` — 17 unbounded findMany (backups.service.ts:450-488)
```typescript
const [users, studentProfiles, ..., settings] = await Promise.all([
  this.prisma.user.findMany(),           // unbounded
  this.prisma.studentProfile.findMany(), // unbounded
  // ... 15 more unbounded findMany calls ...
  this.prisma.emailJob.findMany({ orderBy: { createdAt: 'desc' }, take: 5000 }), // only bounded one
  this.prisma.systemSetting.findMany(),  // unbounded
]);
```

### Admin `auditList()` — unbounded (admin.service.ts:1160-1168)
```typescript
return this.prisma.auditLog.findMany({
  where: { ...(module && module !== 'All' ? { module } : {}), ...(role ...) },
  include: { actor: { select: SAFE_USER_SELECT } },
  orderBy: { createdAt: 'desc' },
});
```

### Admin `students()` — unbounded with deep includes (admin.service.ts:1182-1212)
```typescript
const rows = await this.prisma.user.findMany({
  where: { role: 'STUDENT' },
  include: {
    studentProfile: { include: { section: { include: { academicYear: true, academicYearLevel: true } }, ... } },
    authSessions: { where: { revokedAt: null }, take: 1 },
    accountActionTokens: { where: { type: 'ACCOUNT_ACTIVATION' }, take: 1 },
  },
  // no take limit
});
```

### Admin `deleteUser()` — properly scoped (admin.service.ts:329-336)
```typescript
const user = await this.prisma.user.findUnique({
  where: { id },
  include: { studentProfile: true, teacherProfile: true, groupMemberships: true },
});
```

### Data deletion execution — all bounded (data-deletion-execution.service.ts:41-50, 85-96)
```typescript
// findBackupVerifiedExecutions
return this.prisma.dataDeletionExecution.findMany({
  where: { status: 'BACKUP_VERIFIED', backupRunId: { not: null } },
  take: limit,  // default 10
});

// getRolloutStatus
this.prisma.dataDeletionExecution.findMany({ ..., take: 10 }),
this.prisma.dataDeletionExecution.findMany({ ..., take: 10 }),
```

---

## 8. Risk Classification

### Current severity: **LOW**
- Backup `collectData()` runs in background worker, not API path
- All delete paths are properly scoped to individual user IDs
- Expected school scale: hundreds to low thousands of users
- `submissionFile` contains metadata only, no binary payloads

### Expected scale trigger for upgrade to MEDIUM:
- Any single table exceeding ~100,000 rows in `collectData()`
- Or total `collectData()` serialized output exceeding ~500 MB
- At this threshold, JSON.stringify would risk OOM even in background worker

### Why not higher:
- Backup completeness requires all rows — chunking changes semantics
- Delete paths are all single-user-scoped — cannot cause unbounded queries
- Admin list queries are admin-only — not user-facing performance concerns

---

## 9. Fix Recommendation

**Recommendation: WATCHLIST ONLY — NO CODE CHANGE**

The primary PERF2-003 finding (backup/delete unbounded findMany) is intentional and safe at expected scale. The admin list queries (`auditList`, `students`, etc.) are separate concerns that could be tracked as PERF2-004 if needed.

### Specific recommendations by candidate:

**Candidate A — Backup snapshot chunking:** RECOMMEND AS FUTURE WATCHLIST
- Chunk largest tables (notification, emailJob, submissionEvent, auditLog) with cursor/take loop
- Would require writing/serializing incrementally
- Preserves full snapshot completeness
- Adds complexity — not justified at current scale
- Document threshold: implement when any single table exceeds 100k rows

**Candidate B — Delete preview targeted queries:** NOT APPLICABLE
- Delete previews already use `count()` aggregates, not unbounded findMany

**Candidate C — Explicit cap/warning:** RECOMMEND
- Add a scale warning comment to `collectData()` documenting chunking threshold
- Consider adding a monitor/alert if backup artifact exceeds 500 MB

**Candidate D — No fix:** BASE POSITION — correct for current scale
- All backup/delete operations are safe at expected school scale

---

## 10. Proposed Next PR (If Needed)

**Not needed at this time.** If the user wants to proceed, the recommendation is a documentation-only change or a separate PERF2-004 ticket for admin list query bounding:

| If desired | Branch | Title | Files | Scope |
|-----------|--------|-------|-------|-------|
| Doc threshold | `docs/perf-backup-chunking-threshold` | docs(perf): document backup snapshot scale threshold | `backups.service.ts` (comment), `docs/` | Comment + runbook note |
| Bounded audit log | `perf/admin-audit-list-limit` | perf(admin): bound audit list query with take limit | `admin.service.ts` | Add `take: 500` to `auditList()` |
| Bounded student list | `perf/admin-student-list-limit` | perf(admin): bound student list query | `admin.service.ts` | Add `take: 1000` to `students()` |
| Bounded audience load | `perf/admin-broadcast-bounds` | perf(admin): bound broadcast audience query | `admin.service.ts` | Add `take: 10000` to `resolveAudience()` |

---

## 11. Final Verdict

**B. LOW WATCHLIST** — The backup snapshot full-table scan in `collectData()` is intentional and necessary for backup completeness. All deletion paths are properly scoped. Admin list query unbounded patterns are outside PERF2-003 scope. No immediate fix is needed. Document a scale threshold (100k rows per table or 500 MB serialized output) for future chunking consideration.
