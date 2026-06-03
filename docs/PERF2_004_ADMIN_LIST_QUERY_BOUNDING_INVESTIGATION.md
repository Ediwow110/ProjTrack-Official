# PERF2-004 — Admin List Query Bounding Investigation

**Date:** 2026-06-04
**Latest main SHA:** `0526ca5dd7c2f5015f2d546920c499a309143ae0`
**Final Classification:** C — LOW FIX NEEDED

## Executive Summary

Investigated 8 admin list/broadcast methods in `admin.service.ts` for unbounded `findMany` queries. All 8 methods are unbounded (no `take`/`skip`/`cursor`/`limit`). The frontend does not send pagination params — all rows are fetched and then paginated client-side (if at all). Of the 8, **one (PERF2-004-AUDIT)** needs a focused low-risk fix: add date-range filtering and/or a bounded default. **One (PERF2-004-AUDIENCE)** is intentionally unbounded by design (broadcast-all semantics). The remaining 6 are unbounded but bounded by business domain scale (school-size user counts, semester-bounded activities) — watchlist only.

## Baseline Verification

| Check | Status |
|-------|--------|
| `git status --short` | Clean |
| HEAD SHA | `0526ca5` |
| Latest CI (code commits) | All green (PR #161, PR #162) |
| Production Candidate Verification (HEAD) | Passed |
| `npm run build` (backend) | Pass |
| `npm run typecheck` | Pass |
| `npm run test:unit` | 287/287 passed |
| `npm run test:security` | 214/214 passed |
| `npm test` (frontend) | 32/32 passed |

## Scope

**Files inspected:**
- `backend/src/admin/admin.service.ts` — all 8 target methods (`auditList`, `students`, `users`, `teachers`, `groups`, `notificationsList`, `calendarEvents`, `resolveAudience`/`broadcast`)
- `backend/src/admin/admin.controller.ts` — route mapping
- `backend/src/repositories/admin-ops.repository.ts` — other unbounded list methods (`listSections`, `listAcademicYears`, `listDepartments`, `listAnnouncements`, `listRequests`, `getStateSnapshot`)
- Frontend: all admin consumer pages in `src/app/pages/admin/` and `src/app/components/lists/`

**Methods inspected (beyond the 8):**
- `sections()` / `listSections()` — unbounded, loads all sections + all subjects
- `subjects()` — unbounded, loads all subjects with deep includes
- `submissions()` — unbounded, loads all submissions with deep includes
- `announcements()` — unbounded
- `requests()` / `listRequests()` — unbounded

**Frontend consumers inspected:**
- `AuditLogsPage` — client-side pagination (8/page) on full dataset
- `StudentsPage` — client-side pagination (8/page) on full dataset
- `TeachersPage` — client-side pagination (8/page) on full dataset
- `Groups.tsx` — no pagination, all groups displayed
- `Notifications.tsx` — no pagination, all notifications displayed
- `Calendar.tsx` — no pagination, no date range filter
- `Announcements.tsx` — no pagination
- `Sections.tsx` — loads all sections
- `Subjects.tsx` — loads all subjects

## Findings Table

| ID | Method | Severity | Classification | Bounded Today? | Expected Scale Trigger | Recommendation |
|----|--------|----------|----------------|----------------|------------------------|----------------|
| PERF2-004-AUDIT | `auditList()` | **Medium** | **C — LOW FIX NEEDED** | No | 10k+ audit log rows | Add default `take: 500` with `isTruncated` metadata; add optional date-range filter |
| PERF2-004-STUDENTS | `students()` | Low | B — LOW WATCHLIST | No | 5k+ students with deep includes | Monitor; add server-side take if frontend pagination refactored |
| PERF2-004-USERS | `users()` | Low | B — LOW WATCHLIST | No | 5k+ users total | Monitor; same as students |
| PERF2-004-TEACHERS | `teachers()` | Low | A — NOT A BUG | No | Pedagogical limit (teachers are few) | No action needed |
| PERF2-004-GROUPS | `groups()` | Low | A — NOT A BUG | No | Bounded by school size | No action needed |
| PERF2-004-NOTIFICATIONS | `notificationsList()` | Low | B — LOW WATCHLIST | No | 10k+ notification rows per school year | Monitor; add pagination if notification UX refactored |
| PERF2-004-CALENDAR | `calendarEvents()` | Low | B — LOW WATCHLIST | No | Semester-bounded tasks + announcements | Add optional date-range filter if performance degrades |
| PERF2-004-AUDIENCE | `resolveAudience()` | Low | A — NOT A BUG | No (intentional) | Rare admin broadcast action | No action needed; broadcast-all is a required behavior |

## Detailed Method Analysis

### PERF2-004-AUDIT — `auditList()` (C — LOW FIX NEEDED)

**Current query shape (admin.service.ts:1160-1169):**
```typescript
return this.prisma.auditLog.findMany({
  where: {
    ...(module && module !== 'All' ? { module } : {}),
    ...(role && role !== 'All' ? { actorRole: role.toUpperCase() } : {}),
  },
  include: { actor: { select: SAFE_USER_SELECT } },
  orderBy: { createdAt: 'desc' },
});
```

**Why it matters:** The `auditLog` table grows unbounded over time — every admin action, login attempt, data change etc. creates a row. No retention/purge policy is enforced outside the manual "Purge Records" system tool (6-month cutoff). At a school with 500+ users and daily admin actions, 10k+ rows accumulate rapidly.

**Frontend/API behavior:** `GET /admin/audit-logs?module=&role=`. Frontend fetches ALL rows, paginates client-side (8/page). Filtering by module/role is passed to backend, but NOT date range or pagination params.

**Would adding take/truncation metadata break anything?** Potentially — the frontend expects all rows for client-side pagination and search. Adding a default `take` without returning `total` and `isTruncated` metadata would silently truncate data the admin believes they are browsing. However, **the current behavior is already broken at scale** — the endpoint will eventually time out or OOM.

**Recommended fix strategy (do not implement now):**
1. Add optional query params: `take` (default 500, max 5000), `skip`, `startDate`, `endDate`
2. Change return shape to `{ rows, total, limit, isTruncated }` (or at minimum apply a safe cap)
3. Update frontend to pass `take` and `skip` to backend; use server-driven pagination instead of client-side.
4. Pair with "Purge Records" system tool to define a retention policy.

**Risk before fix:** MEDIUM — at expected scale (1 school, 2k users, 2 semesters), the `auditLog` table could hold 20k-50k rows. Unbounded `findMany` with `include` on `actor` will slow noticeably.

### PERF2-004-STUDENTS — `students()` (B — LOW WATCHLIST)

**Current query shape (admin.service.ts:1180-1264):**
```typescript
const rows = await this.prisma.user.findMany({
  where: { role: 'STUDENT' },
  include: {
    studentProfile: { include: { section: { include: { academicYear: true, academicYearLevel: true } }, academicYear: true, academicYearLevel: true } },
    authSessions: { where: { revokedAt: null }, orderBy: { lastUsedAt: 'desc' }, take: 1 },
    accountActionTokens: { where: { type: 'ACCOUNT_ACTIVATION' }, orderBy: { createdAt: 'desc' }, take: 1 },
  },
  orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'asc' }],
});
// + secondary emailJob query by userEmail
```

**Why it matters:** Deep includes (3+ levels) per row + secondary emailJob query. At 5k students, this query returns significant data.

**Frontend/API behavior:** `GET /admin/students?search=&status=`. All rows fetched, client-side pagination (8/page), client-side course/year/section/status filtering, client-side search.

**Would adding take break frontend?** Yes — the frontend expects all rows for client-side pagination and CSV export.

**Risk before fix:** LOW — even at 5k students with these includes, Prisma generates a single optimized query with joins. The emailJob query by email is the bigger concern (`IN` clause with 5k emails). However, for a single-school deployment, 5k+ students is the high end of expected scale.

### PERF2-004-USERS — `users()` (B — LOW WATCHLIST)

**Current query shape (admin.service.ts:77-140):**
```typescript
const rows = await this.prisma.user.findMany({
  include: {
    studentProfile: { include: { section: true } },
    teacherProfile: true,
  },
  orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
});
// In-memory filter by search, role, status
```

**Why it matters:** All users, including admins and teachers. Includes `studentProfile.section`. In-memory filtering means all rows are always fetched.

**Frontend/API behavior:** `GET /admin/users?search=&role=&status=`. Admin Users page with role/status dropdown and search.

**Risk before fix:** LOW — total users across all roles rarely exceeds 5-6k for a single school. The `users()` endpoint loads everything for the admin "all users" view.

### PERF2-004-TEACHERS — `teachers()` (A — NOT A BUG)

**Current query shape (admin.service.ts:407-456):**
```typescript
const [teachers, subjects] = await Promise.all([
  this.prisma.user.findMany({
    where: { role: 'TEACHER' },
    include: { teacherProfile: true },
    orderBy: { createdAt: 'desc' },
  }),
  this.prisma.subject.findMany({
    include: {
      teacher: { include: { user: { select: SAFE_USER_SELECT } } },
      enrollments: { include: { student: { include: { user: { select: SAFE_USER_SELECT }, section: true } } } },
    },
  }),
]);
```

**Why it matters:** Two full-table scans (teachers + subjects with deep joins). Subjects query includes all enrollments and all students.

**Frontend/API behavior:** `GET /admin/teachers?search=&status=`. All rows fetched, client-side pagination (8/page).

**Risk before fix:** VERY LOW — teachers are a small number even at large schools (50-200). Subjects per teacher is bounded. The deep includes on subjects (enrollments → student → user) are the main cost, but subject count is also bounded by school size.

### PERF2-004-GROUPS — `groups()` (A — NOT A BUG)

**Current query shape (admin.service.ts:698-742):**
```typescript
const groups = await this.prisma.group.findMany({
  include: {
    subject: { include: { enrollments: { include: { section: true } } } },
    section: true,
    members: { include: { student: { select: SAFE_USER_SELECT } } },
  },
  orderBy: { createdAt: 'desc' },
});
// In-memory filter by section, status
```

**Why it matters:** Deep includes (subject → enrollments → section, members → student). In-memory filtering.

**Frontend/API behavior:** `GET /admin/groups?section=&status=`. All groups displayed in a flat table, no pagination.

**Risk before fix:** VERY LOW — groups are bounded by number of subjects × max groups per subject. Even at scale, rarely exceeds a few hundred. The deep includes are modest.

### PERF2-004-NOTIFICATIONS — `notificationsList()` (B — LOW WATCHLIST)

**Current query shape (admin.service.ts:905-913):**
```typescript
return this.prisma.notification.findMany({
  where: {
    ...(type ? { type: { equals: type, mode: 'insensitive' } } : {}),
    ...(role ? { user: { role: String(role).toUpperCase() as any } } : {}),
  },
  include: { user: { select: SAFE_USER_SELECT } },
  orderBy: { createdAt: 'desc' },
});
```

**Why it matters:** The `notification` table grows over time as users receive system and broadcast notifications. No automatic purge — retained indefinitely. Includes a user join per row.

**Frontend/API behavior:** `GET /admin/notifications?role=&type=`. All notifications displayed in a grouped flat list, no pagination.

**Risk before fix:** LOW-MODERATE — notifications can accumulate. A retention policy (e.g., "delete notifications > 1 year old") or pagination would help at scale. But the admin notifications page is rarely high-traffic. The notification table has role/type filtering but no pagination.

### PERF2-004-CALENDAR — `calendarEvents()` (B — LOW WATCHLIST)

**Current query shape (admin.service.ts:1096-1151):**
```typescript
const [tasks, announcements] = await Promise.all([
  this.prisma.submissionTask.findMany({
    where: { deadline: { not: null }, ...(section ? { subject: { enrollments: { some: { section: { name: section } } } } } : {}) },
    include: { subject: { include: { enrollments: { include: { section: true } } } } },
    orderBy: { deadline: 'asc' },
  }),
  this.prisma.announcement.findMany({
    where: !audience || audience === 'ALL' ? undefined : { audience: { in: [audience, 'ALL'] } },
    orderBy: { publishAt: 'asc' },
  }),
]);
```

**Why it matters:** Two full table scans — all `submissionTask` with non-null deadlines and all `announcements`. The submission task query includes deep joins through `subject → enrollments → section`. No date-range filter.

**Frontend/API behavior:** `GET /admin/calendar/events?audience=&section=`. All events loaded, displayed on a fixed 30-day grid with cosmetic month navigation (no re-fetching). Month labels are hardcoded strings — no date range sent to backend.

**Risk before fix:** VERY LOW — activities are semester-bounded by domain. Even across multiple school years, submission tasks rarely exceed a few thousand. The real issue is the lack of date-range filtering on the frontend, but the dataset is small enough that this is not performance-critical.

### PERF2-004-AUDIENCE — `resolveAudience()` (A — NOT A BUG)

**Current query shape (admin.service.ts:4811-4822):**
```typescript
private async resolveAudience(audience: 'ALL' | 'STUDENTS' | 'TEACHERS' | 'ADMINS') {
  if (audience === 'ALL') return this.prisma.user.findMany();
  if (audience === 'STUDENTS') return this.prisma.user.findMany({ where: { role: 'STUDENT' } });
  if (audience === 'TEACHERS') return this.prisma.user.findMany({ where: { role: 'TEACHER' } });
  return this.prisma.user.findMany({ where: { role: 'ADMIN' } });
}
```

**Why it matters:** Called by `broadcast()` (line 997). Loads ALL matching users into memory, then processes them one-by-one (in-app notification + email). This is a rare admin action, but the sequential `for` loop (line 1004) means it could be slow for large audiences.

**Frontend/API behavior:** POST to `/admin/notifications/broadcast`. Admin fills in title, body, audience, channel. Rare action.

**Is bounding appropriate?** NO — the semantics of "broadcast" require delivering to ALL matching users. Adding a `take` cap would silently exclude users from the broadcast. The correct optimization is to **chunk/batch** the processing (e.g., `Promise.all` with concurrency control) and use the mail service's queueing mechanism rather than sequential `await`.

**Risk before fix:** LOW — rare admin action. Would only be slow for large audiences (>1k users) on both in-app and email channels. The sequential loop is the actual risk, not the `findMany`.

## Non-Issues / Safe By Design

| Method | Reason |
|--------|--------|
| `teachers()` | Pedagogical limit — teachers are always < 200 |
| `groups()` | Bounded by subjects × groups/subject |
| `calendarEvents()` | Semester-bounded data; tasks < 5k |
| `resolveAudience()` | Rare admin action; all-users intentionally required |
| `sections()` / `listSections()` | Bounded by academic years × courses |
| `subjects()` | Bounded by school curriculum |
| `announcements()` | Few announcements per school year |
| `requests()` | Few requests per school year |

## Proposed PR Plan (Do Not Implement Now)

Ranked by priority, considering both risk-to-scale ratio and ease of change:

### PR 1 (Recommended): Bound `auditList()` — PERF2-004-AUDIT

- **What:** Add optional `take` (default 500, max 5000), `skip`, `startDate`, `endDate` query params. Return `{ rows, total, limit, isTruncated }`.
- **Why:** Audit log grows unbounded; highest risk endpoint.
- **Frontend impact:** Requires refactoring `AuditLogsPage` to pass pagination params and use server-driven pagination. Client-side `DataTableCard` pagination would need to be swapped for server-side offset pagination.
- **Risk:** Low if done carefully (backward-compatible: if no `take` param, apply default cap but still truncate with `isTruncated: false` if below cap).
- **DO NOT implement now** — document for next round.

### PR 2 (Optional): Batch/chunk `broadcast()` — PERF2-004-AUDIENCE

- **What:** Replace sequential `for` loop with batched `Promise.all` (concurrency: 10-20) or use the mail queue's batch API. Keep `findMany` unbounded (required for broadcast semantics).
- **Why:** Prevent timeout on large broadcasts.
- **Risk:** Very low — behavior-preserving optimization.

### PR 3 (Optional): Add date-range filter to `calendarEvents()`

- **What:** Accept optional `startDate` / `endDate` query params. Default to current school year if not provided.
- **Why:** Defensive; reduces query scope.
- **Note:** Current dataset is small; low priority.

## Watchlist

| Item | Threshold | Action |
|------|-----------|--------|
| `auditLog` table size | 10k+ rows | Add pagination + retention policy |
| `notification` table size | 10k+ rows | Add pagination or retention purge |
| `student` count | 5k+ students | Monitor query performance; consider select projection optimization |
| `resolveAudience` broadcast | 1k+ users | Chunk processing (not currently needed but worth pre-planning) |
| Frontend admin contract | Any change to `auditList` or `students` return shape | Must coordinate with frontend data layer (`adminService`) |
| Audit log stale data | 6 months without purge | "Purge Records" system tool exists but is manual; consider scheduling |

## Final Verdict

**C — LOW FIX NEEDED**

Only `auditList()` justifies a focused fix. The remaining 7 methods are acceptable at expected school scale (500-5000 users). The audit log is the one endpoint where unbounded growth is guaranteed and known to slow at scale.

| Classification | Count |
|----------------|-------|
| A — NOT A BUG | 3 (teachers, groups, audience) |
| B — LOW WATCHLIST | 4 (students, users, notifications, calendar) |
| C — LOW FIX NEEDED | 1 (audit) |
| D — MEDIUM FIX NEEDED | 0 |
| E — BLOCKED | 0 |

**Report path:** `docs/PERF2_004_ADMIN_LIST_QUERY_BOUNDING_INVESTIGATION.md`
**Not committed** unless explicitly requested.
