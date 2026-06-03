# Performance Profiling Round 2 Report

| Field | Value |
|-------|-------|
| **Date** | 2026-06-03 |
| **Latest Main SHA** | `ed264fc85348d0d670d227a09dbbda8e7621e09f` |
| **Profiling Mode** | Static review only (no staging dataset available) |
| **Final Verdict** | **B — LOW/MEDIUM BOTTLENECKS FOUND — FIX PLAN NEEDED** |

---

## 1. Executive Summary

A comprehensive static performance review was conducted across 7 areas: backend Prisma queries, admin reports (post-PERF-001/REPORT-CAP), frontend render/bundle/routing, API contract/pagination safety, worker/background jobs, file storage, and Docker/runtime.

**Key findings:**
- **1 MEDIUM** — Student dashboard `studentCharts` exhibits an N+1 query pattern (2 DB queries per subject)
- **2 LOW** — Deep Prisma `include` patterns in submission repository may cause unnecessary JOIN fanout
- **2 LOW** — Unbounded `findMany()` in backup snapshot and admin deleteUser operations
- **0 HIGH** — No timeout/OOMable endpoint identified

**Watchlist items** (non-blocking):
- ~700 lines of dead code (`computeSummaryFromRows`)
- Mail worker fetches 4× the batch size for claim mechanism

---

## 2. Baseline Verification

| Check | Status |
|-------|--------|
| **Git status** | ✅ Clean at `ed264fc` |
| **Open PRs** | ✅ Only Dependabot dependency bumps (no performance overlap) |
| **npm run typecheck** (frontend) | ✅ PASS |
| **npm run build** (frontend) | ✅ PASS (6.55s, no warnings) |
| **npm test** (frontend) | ✅ 32 PASS |
| **npm run build** (backend) | ✅ PASS |
| **npm run test:unit** (backend) | ✅ 281 PASS |
| **npm run test:security** (backend) | ✅ 214 PASS |
| **Prisma validate** | ✅ Schema valid |
| **CI (Production Candidate Verification)** | ✅ PASS (at ed264fc) |
| **CI (CI workflow)** | 🔄 In progress (e2e smoke tests running; all setup/build steps passed) |
| **CI (Production Checks)** | ✅ PASS (at prior commit) |

---

## 3. Performance Findings Table

| ID | Title | Severity | Confidence | Area | Affected Files | Evidence | Fix Recommendation |
|----|-------|----------|------------|------|----------------|----------|-------------------|
| PERF2-001 | Student dashboard N+1 subject progress queries | **MEDIUM** | High | Backend Queries | `dashboard.service.ts:81` | `Promise.all(subjects.map(async (subject) => {...}))` fires 2 Prisma `count` queries per subject — ~17 DB queries for a student with 8 subjects | Batch with `groupBy` + `$transaction` |
| PERF2-002 | Deep Prisma `include` in submission lists | **LOW** | Medium | Backend Queries | `submission.repository.ts:44-99` | Nested includes (`group → members → student → studentProfile → section`) cause SQL JOIN fanout | Add `select` projection, flatten |
| PERF2-003 | Unbounded `findMany()` in backup/delete operations | **LOW** | Medium | Workers / Admin | `backups.service.ts:471-488`, `admin.service.ts:3040-3131` | Backup and deleteUser snapshot load ALL rows without pagination | Add `take:` bounds; operations are background/safe but O(n) in memory |

---

## 4. Detailed Findings

### PERF2-001 — Student Dashboard N+1 Subject Progress Queries (MEDIUM)

**Severity:** MEDIUM
**Confidence:** HIGH
**Affected files:** `backend/src/dashboard/dashboard.service.ts` (lines 73–102)
**Trigger:** Loading the student dashboard "Charts" section

**Evidence:**
```typescript
// dashboard.service.ts:73
const subjects = await this.prisma.subject.findMany({
  where: { enrollments: { some: { studentId: studentProfileId } } },
  select: { id: true, name: true },
});

// dashboard.service.ts:81
const subjectProgress = await Promise.all(
  subjects.map(async (subject) => {
    const [totalActivities, completed] = await Promise.all([
      this.prisma.submissionTask.count({ where: { subjectId: subject.id } }),
      this.prisma.submission.count({
        where: { ...ownerWhere, subjectId: subject.id, status: { in: studentSubmittedStatuses } },
      }),
    ]);
    return { subject: subject.name, totalActivities, completed };
  }),
);
```

**Why it matters:** For a student with 8 subjects, this fires:
- 1 query to fetch subject list
- 16 queries (8 × 2) for per-subject counts
**= 17 DB round-trips** for one `chart` endpoint

At school scale (~15 subjects per student), this becomes **31 DB queries** just for the progress chart.

**Scale trigger:** >6 subjects per student (typical high school/college load).

**Recommended smallest safe fix:**
Replace per-subject `count` queries with batched `groupBy` operations in a single `$transaction`:
```typescript
const [totalActivitiesBySubject, completedBySubject] = await this.prisma.$transaction([
  this.prisma.submissionTask.groupBy({
    by: ['subjectId'],
    where: { subjectId: { in: subjectIds } },
    _count: { id: true },
  }),
  this.prisma.submission.groupBy({
    by: ['subjectId'],
    where: {
      ...ownerWhere,
      subjectId: { in: subjectIds },
      status: { in: studentSubmittedStatuses },
    },
    _count: { id: true },
  }),
]);
```
This reduces from **2N+1 queries → 3 queries total** (subject list + 2 groupBy).

**Test/benchmark needed:** Add a performance regression test in the security test suite that verifies the student dashboard `studentCharts` endpoint fires ≤5 Prisma queries.

**Suggested PR scope:** Single-file change to `dashboard.service.ts` only.

---

### PERF2-002 — Deep Prisma `include` in Submission Lists (LOW)

**Severity:** LOW
**Confidence:** MEDIUM
**Affected files:** `backend/src/repositories/submission.repository.ts` (lines 44–99, 143–147)

**Evidence:**
The `listSubmissions`, `findSubmissionById`, `listStudentSubmissions`, `listTeacherSubmissions`, and `findExistingSubmission` methods all use a deep include pattern:

```typescript
group: {
  include: {
    members: {
      include: {
        student: {
          select: { ...SAFE_USER_SELECT, studentProfile: { include: { section: true } } },
        },
      },
    },
  },
},
```

This creates a nested JOIN that fans out: for each submission → group → members → student → studentProfile → section. With the default `take: 100`, if each of 20 group submissions has 4 members, Prisma generates a JOIN with ~80+ rows just for the group/member data.

**Why it matters:** Low severity because:
- The `take` is bounded (default 100, max configurable)
- The JOIN is on indexed foreign keys
- At school scale (~100 submissions) this is acceptable

But at **large scale** (1000+ submissions), this pattern can cause SQL response bloat (specifically the group member expansion).

**Scale trigger:** >500 group submissions loaded at once.

**Recommended smallest safe fix:**
- For list endpoints (not detail), use `select` with flat projections instead of nested `include`
- Consider splitting group member data into a separate query only when needed
- For `listStudentSubmissions`, the group member data is rarely needed in the list view

**Test/benchmark needed:** Add a query-count assertion in the security tests for submission list endpoints.

**Suggested PR scope:** Refactor `submission.repository.ts` include definitions to use separate query patterns for list vs. detail endpoints.

---

### PERF2-003 — Unbounded `findMany()` in Backup and Delete Operations (LOW)

**Severity:** LOW
**Confidence:** MEDIUM
**Affected files:**
- `backend/src/backups/backups.service.ts` (lines 471–488)
- `backend/src/admin/admin.service.ts` (lines 3040–3131)

**Evidence:**

*Backup snapshot* — loads ALL rows from ALL tables:
```typescript
this.prisma.user.findMany(),                    // unbounded
this.prisma.studentProfile.findMany(),          // unbounded
this.prisma.subject.findMany(),                 // unbounded
this.prisma.submission.findMany(),              // unbounded
this.prisma.submissionFile.findMany(),          // unbounded (largest table)
// ... 14 more tables
this.prisma.emailJob.findMany({ orderBy: ..., take: 5000 }),  // bounded (inconsistent)
```

*Admin deleteUser preview* — loads ALL data to show deletion impact:
```typescript
this.prisma.user.findMany({ include: { studentProfile: true, teacherProfile: true } }),
this.prisma.subject.findMany({ include: { teacher: { include: { user: ... } }, tasks: true, groups: { include: { members: true } }, enrollments: { include: { student: { include: { user: ... } } } }, subjectSections: true } }),
// ... 15 more tables with deep includes
```

**Why it matters:** LOW severity because:
- Backup runs on a scheduled background worker (not user-facing)
- Delete preview is admin-only and expected to load full data for review
- Both are intentionally full snapshots

However, at large scale (10,000+ submissions), loading ALL submission files + events into memory simultaneously could OOM the worker or API process.

**Scale trigger:** >50,000 submissions or 100,000+ files in the database.

**Recommended smallest safe fix:**
- Add a batch/pagination loop for the backup snapshot (process 1000 records at a time)
- Add an explicit comment noting this is an intentional full load with expected memory implications
- Consider streaming or chunked processing for `submissionFile` which is typically the largest table

**Test/benchmark needed:** Not practical without realistic data; document the assumption.

**Suggested PR scope:** Backup chunking improvement in `backups.service.ts` only.

---

## 5. Cleared Areas

| Area | Verdict | Rationale |
|------|---------|-----------|
| **Admin Reports (post-PERF-001/REPORT-CAP)** | ✅ CLEAR | `REPORTING_LIST_TAKE=5000` firm, summary totals use DB aggregates, truncation metadata correct, no filter mismatch, chart data from capped rows is documented. |
| **Frontend Render/Bundle/Routing** | ✅ CLEAR | Build completes in 6.55s, bundle sizes reasonable (largest chunk 285KB vendor), code splitting via `lazy()` used, no expensive render patterns detected. |
| **API Contract / Pagination Safety** | ✅ CLEAR | All list endpoints use `clampListTake`/`clampListSkip` with explicit limits, export endpoints have caps and truncation warnings. |
| **File Storage / Upload / Download** | ✅ CLEAR | Bounded pending upload cleanup (`take: 100-500`), file list paginated, no synchronous file ops in request path, base64 used only for branding uploads (small). |
| **Docker / Runtime / Startup** | ✅ CLEAR | Multi-stage build, production-only deps, non-root user, proper healthcheck, tini signal handling, Prisma engine compat handled. |
| **Mail Worker** | ✅ CLEAR | Batch processing per queue type, stale job recovery, heartbeat mechanism, optimistic locking via `updateMany` with version fields, retry backoff. |

---

## 6. Blocked Measurements

The following performance characteristics **cannot be assessed** without a realistic staging dataset and environment:

| Measurement | Why Blocked |
|-------------|-------------|
| Query execution timings (p95 latency) | No staging DB with realistic data |
| Memory usage under realistic load | No staging deployment |
| Docker resource usage (CPU/mem) | No staging deployment |
| Report rendering at 5000-row scale | No staging deployment |
| API endpoint response times | No staging deployment |
| Bundle load/parse time on slow connections | Requires production-like network conditions |
| Prisma query plan analysis | Requires real DB EXPLAIN with data |
| Mail/batch worker throughput | Requires real mail provider + queue size |

**Recommendation:** After a staging environment is provisioned, run:
1. Load test with 10,000+ submissions, 500+ users, 50+ subjects
2. Profile the student dashboard `studentCharts` endpoint specifically
3. Verify submission list queries with JOIN fanout on group data

---

## 7. Watchlist

The following items are tracked for future investigation but are **not actionable blockers**:

| Item | Reason | Trigger |
|------|--------|---------|
| `computeSummaryFromRows` dead code (~700 methods) | Unused but harmless | Code cleanup opportunity |
| Mail worker fetches 4× batch size (`take * 4`) | Designed for claim-optimistic locking; minor overhead | Optimization opportunity at scale |
| Unbounded `findMany()` in backup snapshot noted above | LOW severity, scheduled background job | OOM risk only at extreme scale |
| Frontend table rendering up to 5000 rows without virtualization | Acceptable at 5000-row cap | Consider virtualization if cap is ever increased |

---

## 8. Recommended Next PR Plan

### PR 1: Fix Student Dashboard N+1 (PERF2-001)

- **Branch:** `perf/dashboard-subject-progress-batched`
- **Scope:** One file — `backend/src/dashboard/dashboard.service.ts`
- **Change:** Replace per-subject `count` queries with `groupBy` in `$transaction`
- **Risk:** LOW (dead code path for chart data)
- **Test:** Add query-count assertion in security test suite

### PR 2: Clean up Deep Include Patterns (PERF2-002)

- **Branch:** `perf/submission-repository-select-projection`
- **Scope:** `backend/src/repositories/submission.repository.ts`
- **Change:** Add `select` projections to list-oriented includes, flatten nested includes
- **Risk:** LOW (cosmetic refactor with same data shape)
- **Test:** Verify existing tests still pass (all submission endpoints covered)

### PR 3: Add Backup Chunking (PERF2-003 — optional, deferred)

- **Branch:** `perf/backup-snapshot-chunked`
- **Scope:** `backend/src/backups/backups.service.ts`
- **Change:** Process large tables in batches of 1000
- **Risk:** LOW (background worker only)
- **Test:** Manual smoke test; existing unit tests

---

## 9. Final Verdict

```
B — LOW/MEDIUM BOTTLENECKS FOUND — FIX PLAN NEEDED
```

**Summary:**
- **1 MEDIUM finding** (PERF2-001: student dashboard N+1 — 2N+1 DB queries per load)
- **2 LOW findings** (PERF2-002: deep include fanout; PERF2-003: unbounded backup snapshot)
- **0 HIGH findings** (no timeout/OOMable endpoint in normal school-scale operation)
- **0 cleared areas with regressions**

The most impactful fix is **PERF2-001** (dashboard N+1), which reduces the student dashboard chart endpoint from **~17 DB round-trips to ~3** for a typical student with 8 subjects.

**Recommended next prompt:** `FIX PERF2-001` — proceed with a focused PR to batch the subject progress queries using `groupBy` + `$transaction`.

**Do NOT patch, commit, or open PR until explicitly authorized.**
