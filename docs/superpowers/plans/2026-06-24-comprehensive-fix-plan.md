# Comprehensive Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 16 findings from the security and performance audits.

**Architecture:** Fixes span backend (NestJS + Prisma), frontend (React/Vite), and infrastructure (Docker). Simple fixes are done inline; complex ones (pagination, caching) use targeted subagents.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, Vite, Tailwind, Radix UI

## Global Constraints

- All changes must be real and verified
- No breaking existing tests (462 unit + 236 security + 85 frontend)
- Run `npm run build` in backend after TypeScript changes
- Run `npx vite build` in frontend after frontend changes
- Run `npm run test:unit && npm run test:security` in backend after backend changes
- All work committed with descriptive messages
- Evidence at every step — no blind fixes

---

## Task Group A: Simple, Safe Fixes (No Logic Changes)

### Task A1: Connection Pool Limits (S1)

**Files:**
- Modify: `backend/src/prisma/prisma.service.ts`

**Fix:** Pass `{ connectionLimit: 5, poolTimeout: 10000 }` to PrismaClient constructor.

### Task A2: Docker Secrets Parameterized (S2)

**Files:**
- Modify: `backend/docker-compose.storage.yml`
- Modify: `backend/docker-compose.postgres.yml`

**Fix:** Replace hardcoded passwords with `${VAR:-default}` env var references. Fix the MinIO init password mismatch.

### Task A3: Remove projtrack-frontend Dep (S4)

**Files:**
- Modify: `backend/package.json`

**Fix:** Remove `"projtrack-frontend": "file:.."` from dependencies.

### Task A4: Align Node Version + Enable Strict (S5)

**Files:**
- Modify: `Dockerfile.backend`
- Modify: `backend/tsconfig.json`

**Fix:** Update Dockerfile to node:22-alpine. Enable `strict: true` in backend tsconfig and fix any new errors.

### Task A5: Remove MUI Dead Dependencies (S7/P7)

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

**Fix:** `npm uninstall @mui/material @mui/icons-material @emotion/react @emotion/styled @popperjs/core react-popper`. Remove `mui-vendor` from manualChunks in vite.config.ts.

### Task A6: Add Submission Database Indexes (P2)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: Prisma migration

**Fix:** Add `@@index([subjectId])`, `@@index([studentId])`, `@@index([taskId])`, `@@index([status, subjectId])`, `@@index([submittedAt])` to Submission model. Run migration.

### Task A7: Rate Limiting Config (S3)

**Files:**
- No code change — this is a production env config issue.
- Add note to `.env.production.example`

### Task A8: Update Outdated Packages (S6)

**Files:**
- Modify: `package.json` (update resolutions selectively)
- Note: Only update Radix UI packages to avoid breaking changes.

---

## Task Group B: Medium Backend Changes

### Task B1: Add Cache-Control Headers (P4)

**Files:**
- Modify: `backend/src/main.ts`

**Fix:** Add a NestJS middleware/interceptor that sets `Cache-Control: private, max-age=60` on all GET endpoints except auth.

### Task B2: No Page Data Cache Layer (P3)

**Files:**
- Modify: `backend/src/common/` — new in-memory cache service
- Modify: `backend/src/app.module.ts` — register as global provider

**Fix:** A simple in-memory cache with TTL for frequently-accessed list data.

---

## Task Group C: Medium Frontend Changes

### Task C1: Defer Charts Loading (P6)

**Files:**
- Modify: `src/app/pages/admin/Dashboard.tsx`

**Fix:** Use IntersectionObserver to only load AdminDashboardCharts when the charts section scrolls into view.

### Task C2: Request Deduplication (P9)

**Files:**
- Modify: `src/app/lib/hooks/useAsyncData.ts`

**Fix:** Add in-flight request tracking using a keyed map. Add AbortController for cancellation on unmount.

---

## Task Group D: Complex Changes

### Task D1: Server-Side Pagination + Client-Side Sort Fix (P1 + P8)

**Files:**
- Modify: `backend/src/admin/admin-users.service.ts` — add `take`/`skip` to `teachers()`, `students()`
- Modify: `backend/src/admin/admin-submissions.service.ts` — add `take`/`skip` to `submissions()`
- Modify: `backend/src/admin/admin-subjects.service.ts` — add `take`/`skip` to `subjects()`
- Modify: `backend/src/admin/admin.controller.ts` — add `take`/`skip` params to 4 endpoints
- Modify: `src/app/lib/api/services.ts` — add pagination params to service calls
- Modify: `src/app/components/lists/teachers/TeachersPage.tsx` — add pagination UI
- Modify: `src/app/components/lists/students/StudentsPage.tsx` — add pagination UI
- Modify: `src/app/components/lists/submissions/SubmissionsPage.tsx` — add pagination UI
- Modify: `src/app/pages/admin/Subjects.tsx` — add pagination UI
- Modify: `src/app/pages/admin/Sections.tsx` — add pagination UI (if applicable)

---

## Execution Order

1. A1 → A3 → A5 (package.json changes, isolated)
2. A2 (docker-compose changes, isolated)
3. A4 (tsconfig change, may need type fixes)
4. A6 (schema + migration)
5. B1 (cache headers, small change)
6. C2 (request dedup, small hook change)
7. C1 (defer charts, small change)
8. B2 (in-memory cache service)
9. D1 (pagination — biggest change)
10. Verify all tests pass
11. Verify frontend builds
12. Final commit
