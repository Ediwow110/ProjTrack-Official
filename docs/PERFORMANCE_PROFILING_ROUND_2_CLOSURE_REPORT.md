# Performance Profiling Round 2 — Closure Report

## 1. Executive Summary

**Date:** 2026-06-04
**Latest main SHA:** `5ddd4651bacd08e0351c0cf6071427d3004e5c6c`
**Final Verdict:** **B. PERFORMANCE ROUND 2 COMPLETE WITH WATCHLIST**
**PRs merged:** 2 (#161, #162)
**Reports committed:** 2 (round 2 report, PERF2-003 investigation)
**Total tests passing:** 533 (287 backend unit + 214 backend security + 32 frontend)

---

## 2. Completion Table

| Item | Severity | Status | PR/Commit | Verification Summary |
|------|----------|--------|-----------|---------------------|
| **PERF2-001** — Student dashboard N+1 progress queries | MEDIUM | **FIXED** | PR #161, merge `c8f20d1` | Replaced per-subject 2N `count()` queries with batched `groupBy` + `Promise.all`. Tests verify 2 groupBy calls (not per-subject). Response shape preserved. |
| **PERF2-002** — Deep Prisma include projections in submission repository/service | LOW | **FIXED** | PR #162, merge `f211039` | Tightened `task: true` → `{ select: { id, title, submissionMode } }`, `files: true` → `{ select: { id, fileName, fileSize, relativePath } }`, group `include` → `select`. Response shape preserved. |
| **PERF2-003** — Backup/delete unbounded findMany review | LOW | **LOW WATCHLIST / NO CODE CHANGE** | Report `5ddd465` | `collectData()` full-table reads are intentional for backup completeness. Runs in background worker. Delete/data-deletion paths properly scoped/bounded. No code fix justified at current scale. |

---

## 3. Local Verification

| Command | Result |
|---------|--------|
| `backend npm run build` | PASS |
| `backend npm run test:unit` | 287 PASS |
| `backend npm run test:security` | 214 PASS |
| `prisma validate` | PASS |
| `npm run typecheck` | PASS |
| `npm test` (frontend) | 32 PASS |
| **Total** | **533 PASS** |

---

## 4. GitHub Verification

| Item | Status |
|------|--------|
| PR #161 state | **MERGED** — merge commit `c8f20d1` |
| PR #162 state | **MERGED** — merge commit `f211039` |
| PERF2-003 report commit | `5ddd465` — tracked on main |
| **Latest main CI** | CI: success ✅, Production Candidate Verification: success ✅ |

---

## 5. Fixed Findings Summary

### PERF2-001 — Student dashboard N+1 (MEDIUM → FIXED)
- **Before:** For each enrolled subject, 2 `count()` queries (total tasks + completed submissions). With N subjects = 2N queries.
- **After:** Single `groupBy` per metric with `where: { subjectId: { in: [...] } }` — constant queries regardless of subject count.
- **Risk after fix:** LOW — dashboard list endpoint bounded to constant queries.

### PERF2-002 — Submission projection overfetching (LOW → FIXED)
- **Before:** `task: true`, `files: true`, `group: { include: { members: { include: { student: ... } } } }` — all columns from joined tables loaded.
- **After:** Selective `{ select: { ... } }` projections for task, files, group, members, events.
- **Risk after fix:** LOW — reduced memory/network per submission row.

### PERF2-003 — Backup/delete unbounded findMany (LOW → WATCHLIST)
- **Before:** 17/18 tables in `collectData()` loaded with unbounded `findMany()`.
- **Finding:** Intentional — backup completeness requires all rows. Runs in background worker. `submissionFile` is metadata-only. `emailJob` already bounded `take: 5000`.
- **Risk:** LOW at expected school scale. No code change justified.

---

## 6. Watchlist

| Item | Threshold | Notes |
|------|-----------|-------|
| **Backup chunking** | >100k rows/table or >500 MB serialized | `collectData()` will need cursor-based chunking at very large scale. Not needed now. |
| **Admin list query bounding** | Optional future PERF2-004 | `auditList()` (no `take` bound on ever-growing audit table), `students()` (deep includes), `resolveAudience()` (all users for broadcast). Highest risk: `auditList()`. |
| **Runtime profiling** | After staging environment exists | No real production/staging profiling data available yet. All findings are static code review based. |
| **Frontend table virtualization** | If report cap increases | Not currently needed — report caps at 100 rows. |

---

## 7. Remaining Optional Work

**Required performance round 2 work:** None.

**Optional future tracks:**
- **PERF2-004:** Admin list query bounding — add `take` limits to `auditList()`, `students()`, `resolveAudience()`
- **Runtime profiling:** After staging environment is available, collect real query timing data
- **Frontend virtualization:** Only if report viewport caps increase significantly
- **Backup chunking:** Only after scale threshold reached

---

## 8. Artifact Status

| Artifact | Status |
|----------|--------|
| `.playwright-mcp/` | Untracked — preserved |
| `AGENTS.md` | Untracked — preserved |
| `login-page-snapshot.md` | Untracked — preserved |
| `docs/PERFORMANCE_PROFILING_ROUND_2_CLOSURE_REPORT.md` | This file — untracked |
| **No deletions performed** | ✅ |

---

## 9. Final Verdict

**B. PERFORMANCE ROUND 2 COMPLETE WITH WATCHLIST**

- 2 performance PRs merged and verified.
- 1 investigation report committed (low watchlist, no code change).
- All 533 tests passing.
- CI green across main.
- Watchlist items documented with explicit thresholds.
- No further required work in this round.

---

## 10. Next Recommendation

- **Commit this closure report** if user approves (`git add docs/PERFORMANCE_PROFILING_ROUND_2_CLOSURE_REPORT.md && git commit -m "docs(perf): add performance profiling round 2 closure report"`)
- Or **archive it** as local evidence without committing.
- Or **start PERF2-004** for optional admin list query bounding.

Do not proceed to new work automatically.
