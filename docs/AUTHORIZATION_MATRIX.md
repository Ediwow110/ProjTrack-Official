# Authorization Matrix

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

This document is the first authoritative authorization map for backend routes. It is based on controller inspection and must be completed with service-level ownership verification and abuse tests before `AUTHZ-GATE` can pass.

## Authorization model observed

The backend uses `JwtAuthGuard` plus `@Roles(...)` metadata for role enforcement. `JwtAuthGuard` requires a bearer access token, verifies token type, checks that the user exists and is `ACTIVE`, rejects sessions if the database role no longer matches the token role, and throws `ForbiddenException` when the authenticated user's role is not in the required route roles.

Controller-level decorators prove role gates only. They do not prove owner-only behavior. Owner-only behavior must be verified inside services and abuse tests.

## Status legend

- Verified by controller: route has explicit guard/role decorator at controller level.
- Needs service proof: route passes `req.user.sub` or equivalent to a service, but service ownership logic still needs audit/tests.
- High-risk: route exposes sensitive data, mutation, export, file access, system tooling, or administrative action.

## Public / unauthenticated routes

| Route | Controller | Classification | Required behavior | Status |
|---|---|---|---|---|
| `POST /auth/login` | `backend/src/auth/auth.controller.ts` | Public auth entry | Wrong password must fail safely; rate limit required; no account enumeration | Needs abuse tests |
| `POST /auth/refresh` | `backend/src/auth/auth.controller.ts` | Public token refresh | Expired/reused refresh token must fail; rotation/reuse behavior must be tested | Needs abuse tests |
| `POST /auth/logout` | `backend/src/auth/auth.controller.ts` | Public/session endpoint | Invalid/missing refresh token should fail safely or be idempotent by design | Needs abuse tests |
| `GET /auth/me` | `backend/src/auth/auth.controller.ts` | Token-derived identity | Must reject invalid/expired token; should not leak internals | Needs abuse tests |
| `POST /auth/activate` | `backend/src/auth/auth.controller.ts` | Public account action | Token expiry/single-use must be enforced | Needs abuse tests |
| `POST /auth/activate/validate` | `backend/src/auth/auth.controller.ts` | Public account action validation | Must not leak account state beyond intended UX | Needs abuse tests |
| `POST /auth/forgot-password` | `backend/src/auth/auth.controller.ts` | Public reset request | Must avoid enumeration and rate-limit | Needs abuse tests |
| `POST /auth/reset-password` | `backend/src/auth/auth.controller.ts` | Public reset completion | Reset token expiry/single-use must be enforced | Needs abuse tests |
| `GET /health` | `backend/src/health/health.controller.ts` | Public liveness | Must expose liveness only; no secrets/config | Needs response audit |
| `GET /health/live` | `backend/src/health/health.controller.ts` | Public liveness | Must expose liveness only | Needs response audit |
| `GET /health/ready` | `backend/src/health/health.controller.ts` | Public readiness | Must return 503 when dependencies fail; no secrets | Needs response audit |
| `GET /health/api-ready` | `backend/src/health/health.controller.ts` | Public readiness/API readiness | Must return 503 when dependencies fail; no secrets | Needs response audit |

## Admin-only routes

Controller: `backend/src/admin/admin.controller.ts`  
Gate: class-level `@UseGuards(JwtAuthGuard)` and `@Roles('ADMIN')`.

| Route group | Classification | Risk | Required abuse tests | Status |
|---|---|---:|---|---|
| `GET/POST/DELETE /admin/users/**` | Admin-only | Critical | anonymous -> 401; student/teacher -> 403; admin -> success | Verified by controller, needs tests |
| `GET/POST/PATCH/DELETE /admin/departments/**` | Admin-only | High | anonymous -> 401; non-admin -> 403 | Verified by controller, needs tests |
| `GET/POST/DELETE /admin/sections/**` | Admin-only | High | anonymous -> 401; non-admin -> 403 | Verified by controller, needs tests |
| `GET/POST/DELETE /admin/academic-years/**` | Admin-only | High | anonymous -> 401; non-admin -> 403 | Verified by controller, needs tests |
| `GET/POST /admin/students/**` | Admin-only | Critical | non-admin cannot read/mutate student records | Verified by controller, needs tests |
| `GET/POST /admin/teachers/**` | Admin-only | Critical | non-admin cannot read/mutate teacher records | Verified by controller, needs tests |
| `GET/POST /admin/subjects/**` | Admin-only | High | non-admin cannot mutate academic structure | Verified by controller, needs tests |
| `GET/POST/PATCH/DELETE /admin/submissions/**` | Admin-only | Critical | non-admin cannot read/mutate submissions | Verified by controller, needs tests |
| `GET/POST /admin/requests/**` | Admin-only | High | non-admin cannot approve/reject requests | Verified by controller, needs tests |
| `GET/POST /admin/settings/**` | Admin-only | Critical | non-admin cannot change system/academic settings | Verified by controller, needs tests |
| `GET/POST /admin/system-tools/**` | Admin-only | Critical | non-admin cannot run tools, import backups, or download artifacts | Verified by controller, needs tests |
| `GET/POST /admin/bulk-move` | Admin-only | Critical | non-admin cannot bulk move students | Verified by controller, needs tests |
| `GET /admin/reports/**` | Admin-only | High | non-admin cannot generate exports/reports | Verified by controller, needs tests |
| `GET/POST /admin/groups/**` | Admin-only | High | non-admin cannot approve/lock/edit groups | Verified by controller, needs tests |
| `GET/POST /admin/notifications/**` | Admin-only | High | non-admin cannot broadcast/delete/admin-read notifications | Verified by controller, needs tests |
| `GET/POST /admin/announcements/**` | Admin-only | High | non-admin cannot create/delete announcements | Verified by controller, needs tests |
| `GET /admin/calendar/events/**` | Admin-only | High | non-admin cannot view admin calendar events | Verified by controller, needs tests |
| `GET /admin/audit-logs/**` | Admin-only | Critical | non-admin cannot read audit logs | Verified by controller, needs tests |

## Role-specific authenticated profile routes

Controller: `backend/src/profile/profile.controller.ts`

| Route | Classification | Required behavior | Status |
|---|---|---|---|
| `GET /student/profile` | Student self-only | Student can read only own profile from `req.user.sub`; teacher/admin blocked unless explicitly intended | Verified by controller, needs service ownership test |
| `PATCH /student/profile` | Student self-only mutation | Student can mutate only own profile; role/status fields must not be mass-assignable | Needs mass-assignment test |
| `POST /student/profile/change-password` | Student self-only sensitive mutation | Requires current password; invalid current password fails safely | Needs abuse test |
| `GET /teacher/profile` | Teacher self-only | Teacher can read only own profile | Verified by controller, needs service ownership test |
| `PATCH /teacher/profile` | Teacher self-only mutation | Teacher cannot mutate role/status/security fields | Needs mass-assignment test |
| `POST /teacher/profile/change-password` | Teacher self-only sensitive mutation | Requires current password | Needs abuse test |
| `GET /admin/profile` | Admin self-only | Admin can read only own profile | Verified by controller, needs service ownership test |
| `PATCH /admin/profile` | Admin self-only mutation | Admin cannot accidentally bypass audit/security constraints | Needs mass-assignment test |
| `POST /admin/profile/change-password` | Admin self-only sensitive mutation | Requires current password | Needs abuse test |

## Dashboard routes

Controller: `backend/src/dashboard/dashboard.controller.ts`

| Route | Classification | Required behavior | Status |
|---|---|---|---|
| `GET /student/dashboard/summary` | Student self-only | Uses `req.user.sub`; no cross-student data | Needs service ownership proof |
| `GET /student/dashboard/charts` | Student self-only | Uses `req.user.sub`; no cross-student data | Needs service ownership proof |
| `GET /student/dashboard/upcoming-deadlines` | Student self-only | Uses `req.user.sub`; no cross-student data | Needs service ownership proof |
| `GET /teacher/dashboard/summary` | Teacher scoped | Uses `req.user.sub`; only assigned classes/sections/subjects | Needs service scope proof |
| `GET /admin/dashboard/summary` | Admin-only | Admin-only aggregate | Verified by controller, needs tests |
| `GET /admin/dashboard/activity` | Admin-only | Admin-only activity data | Verified by controller, needs tests |

## Submission routes

Controller: `backend/src/submissions/submissions.controller.ts`

| Route | Classification | Required behavior | Status |
|---|---|---|---|
| `GET /student/submissions` | Student self-only | Student sees only own submissions | Needs service ownership proof |
| `GET /student/submissions/:id` | Student owner-only | Student A cannot read Student B submission | Needs abuse test |
| `POST /student/submissions` | Student self-only mutation | User ID must come from token, not body | Needs mass-assignment test |
| `GET /teacher/submissions` | Teacher scoped | Teacher sees only assigned/related submissions | Needs service scope proof |
| `GET /teacher/submissions/export` | Teacher scoped export | Export must be scoped and bounded | High-risk; needs abuse/perf tests |
| `GET /teacher/submissions/:id` | Teacher scoped detail | Teacher cannot read unrelated section/subject | Needs abuse test |
| `PATCH /teacher/submissions/:id/review` | Teacher scoped mutation | Teacher cannot review unrelated submission | Needs abuse test |

## File routes

Controller: `backend/src/files/files.controller.ts`

| Route | Classification | Required behavior | Status |
|---|---|---|---|
| `POST /files/upload` | Student/Teacher/Admin authenticated | MIME allowlist, size limit, scope validation, ownership recorded from token | Needs storage/security tests |
| `POST /files/upload-base64` | Student/Teacher/Admin authenticated | Size/MIME/scope validation; no body-supplied owner trust | Needs storage/security tests |
| `GET /files` | Teacher/Admin | Must not list files outside permitted scope | Needs service scope proof |
| `GET /files/submission/:submissionId` | Student/Teacher/Admin scoped | Student owner or assigned teacher/admin only | Needs abuse test |
| `GET /files/meta/:scope/:storedName` | Student/Teacher/Admin scoped | Ownership checked before metadata/signing | Needs abuse test |
| `GET /files/download/:scope/:storedName` | Student/Teacher/Admin scoped | Ownership checked before redirect/download; signed URL TTL short | Needs abuse test |
| `DELETE /files/:scope/:storedName` | Teacher/Admin scoped | Teacher cannot delete unrelated files | Needs abuse test |

## Health and operational routes

Controller: `backend/src/health/health.controller.ts`

| Route | Classification | Required behavior | Status |
|---|---|---|---|
| `GET /health/storage` | Admin-only | No secrets; admin only | Verified by controller, needs response audit |
| `GET /health/mail` | Admin-only | No provider secrets; admin only | Verified by controller, needs response audit |
| `GET /health/configuration` | Admin-only | Must redact secrets/config values | High-risk; needs response audit |
| `GET /health/database` | Admin-only | No database URL leaked | High-risk; needs response audit |
| `GET /health/backups` | Admin-only | No secret paths/credentials leaked | High-risk; needs response audit |

## Other controllers discovered but not fully expanded yet

The first scan found additional controller files that must be expanded before this matrix is final:

- `backend/src/mail/mail.controller.ts`
- `backend/src/mail/mail.webhook.controller.ts`
- `backend/src/branding/branding.controller.ts`
- `backend/src/branding/admin-branding.controller.ts`
- `backend/src/students/admin-students.controller.ts`
- `backend/src/subjects/subjects.controller.ts`
- `backend/src/backups/backups.controller.ts`
- `backend/src/monitoring/monitoring.controller.ts`
- `backend/src/notifications/notifications.controller.ts`

## Required authorization abuse test matrix

Every sensitive route above needs tests for:

1. Anonymous user -> `401`
2. Wrong role -> `403`
3. Wrong owner/scope -> `403` or safe `404`
4. Correct owner/scope -> success
5. Admin -> allowed only where explicitly intended
6. Body tries to set `role=ADMIN`, `userId`, `ownerId`, `uploadedByUserId`, or other ownership/security fields -> ignored/rejected
7. Deleted/archived records remain protected

## Current verdict

`AUTHZ-GATE` is not passed. Controller-level role gates exist for major high-risk areas, but service-level owner/scope enforcement and abuse tests are not yet complete.
