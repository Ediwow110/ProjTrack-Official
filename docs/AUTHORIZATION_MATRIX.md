# Authorization Matrix

Branch: `2nd-main`  
Last updated: 2026-05-14

## Verdict

`AUTHZ-GATE` is not passed.

Controller-level role gates now have broad mapping coverage, but service-level owner/scope enforcement still needs executable wrong-owner and wrong-scope tests.

## Authorization model

The backend uses `JwtAuthGuard` and `@Roles(...)`. `JwtAuthGuard` verifies bearer access tokens, token type, active database user status, and token-role/database-role consistency before assigning `request.user`. Role metadata proves role gating only. It does not prove object ownership or tenant/scope isolation.

## Public routes

| Route/group | Controller | Required control | Status |
|---|---|---|---|
| `/auth/login` | `backend/src/auth/auth.controller.ts` | Generic failure, throttle, no enumeration | Initial tests exist; rate-limit integration pending |
| `/auth/refresh` | `backend/src/auth/auth.controller.ts` | Refresh rotation/reuse protection | Initial tests exist; reuse integration pending |
| `/auth/logout` | `backend/src/auth/auth.controller.ts` | Safe invalid/missing refresh behavior | Needs integration test |
| `/auth/me` | `backend/src/auth/auth.controller.ts` | Invalid/expired token rejected | Initial guard tests exist |
| `/auth/activate/**` | `backend/src/auth/auth.controller.ts` | Expiry/single-use/no leakage | Needs lifecycle tests |
| `/auth/forgot-password` | `backend/src/auth/auth.controller.ts` | Generic response, throttle | Initial tests exist; rate-limit integration pending |
| `/auth/reset-password` | `backend/src/auth/auth.controller.ts` | Expiry/single-use; no premature token consume | Initial validation test exists |
| `/health`, `/health/live`, `/health/ready`, `/health/api-ready` | `backend/src/health/health.controller.ts` | No secrets/config values | Redaction tests partially exist |
| `/branding`, `/branding/favicon` | `backend/src/branding/branding.controller.ts` | Public-safe branding only | Needs response audit |
| `/unsubscribe` | `backend/src/mail/mail.controller.ts` | Opaque token validation; no enumeration | Needs abuse test |
| `/mail/webhooks/resend` | `backend/src/mail/mail.webhook.controller.ts` | Signature verification and replay resistance | Needs webhook tests |
| `POST /monitoring/client-errors` | `backend/src/monitoring/monitoring.controller.ts` | Payload size/rate/sanitization | Needs abuse test |

## Admin-only routes

| Route/group | Controller | Risk | Status |
|---|---|---:|---|
| `/admin/**` core users/departments/sections/academic-years/students/teachers/subjects/submissions/settings/system-tools/reports/groups/notifications/announcements/calendar/audit-logs | `backend/src/admin/admin.controller.ts` | Critical | Class-level `ADMIN`; runtime 401/403 tests pending |
| `/admin/students/template`, `/admin/students/import`, `/admin/students/import/confirm`, `/admin/students/:id/*` | `backend/src/students/admin-students.controller.ts` | Critical | Class-level `ADMIN`; import/invite tests pending |
| `/admin/mail-jobs/**` | `backend/src/mail/mail.controller.ts` | High | Class-level `ADMIN`; retry/cancel/archive runtime tests pending |
| `/admin/mail/test` | `backend/src/mail/mail.controller.ts` | High | Class-level `ADMIN`; test-email abuse tests pending |
| `/admin/branding/**` | `backend/src/branding/admin-branding.controller.ts` | High | Class-level `ADMIN`; asset upload validation tests pending |
| `/admin/backups/**` | `backend/src/backups/backups.controller.ts` | Critical | Class-level `ADMIN`; protect/restore/download/delete tests pending |
| `GET /monitoring/client-errors` | `backend/src/monitoring/monitoring.controller.ts` | High | Route-level `ADMIN`; runtime 401/403 tests pending |
| `/health/storage`, `/health/mail`, `/health/configuration`, `/health/database`, `/health/backups` | `backend/src/health/health.controller.ts` | High | Route-level `ADMIN`; redaction tests partially exist |

## Student-scoped routes

| Route/group | Controller | Required control | Status |
|---|---|---|---|
| `/student/profile/**` | `backend/src/profile/profile.controller.ts` | Self-only profile read/update/password | Controller verified; service tests pending |
| `/student/dashboard/**` | `backend/src/dashboard/dashboard.controller.ts` | Self-only dashboard data | Controller verified; service tests pending |
| `/student/submissions/**` | `backend/src/submissions/submissions.controller.ts` | Self-only list/detail/create | Controller verified; wrong-owner tests pending |
| `/student/subjects/**`, `/student/submit-catalog`, `/student/activities/:id/submission-context` | `backend/src/subjects/subjects.controller.ts` | Enrolled/owned subject scope only | Controller verified; service tests pending |
| `/student/groups`, `/student/groups/join-by-code` | `backend/src/subjects/subjects.controller.ts` | Token user identity controls membership | Controller verified; body override tests pending |
| `/student/calendar/events` | `backend/src/subjects/subjects.controller.ts` | Student calendar scope only | Controller verified; service tests pending |
| `/student/notifications/**` | `backend/src/notifications/notifications.controller.ts` | User-owned notifications only | Controller verified; wrong-owner tests pending |

## Teacher-scoped routes

| Route/group | Controller | Required control | Status |
|---|---|---|---|
| `/teacher/profile/**` | `backend/src/profile/profile.controller.ts` | Self-only profile read/update/password | Controller verified; service tests pending |
| `/teacher/dashboard/summary` | `backend/src/dashboard/dashboard.controller.ts` | Assigned teacher scope only | Controller verified; service tests pending |
| `/teacher/submissions/**` | `backend/src/submissions/submissions.controller.ts` | Assigned class/subject scope only | Controller verified; wrong-scope tests pending |
| `/teacher/subjects/**` | `backend/src/subjects/subjects.controller.ts` | Assigned subject scope only | Controller verified; service tests pending |
| `/teacher/students`, `/teacher/sections/**` | `backend/src/subjects/subjects.controller.ts` | Assigned sections only; bounded exports | Controller verified; service/perf tests pending |
| `/teacher/subjects/:subjectId/groups/**` | `backend/src/subjects/subjects.controller.ts` | Teacher owns subject/group scope | Controller verified; wrong-scope tests pending |
| `/teacher/notifications/**` | `backend/src/notifications/notifications.controller.ts` | User-owned notifications only | Controller verified; wrong-owner tests pending |

## Shared authenticated file routes

| Route/group | Controller | Required control | Status |
|---|---|---|---|
| `POST /files/upload`, `POST /files/upload-base64` | `backend/src/files/files.controller.ts` | Token identity ownership; MIME/ext/size/magic-byte policy | Initial tests exist |
| `GET /files` | `backend/src/files/files.controller.ts` | Teacher/admin only; teacher scope only | Controller verified; service tests pending |
| `GET /files/submission/:submissionId` | `backend/src/files/files.controller.ts` | Student owner or assigned teacher/admin only | Service tests pending |
| `GET /files/meta/:scope/:storedName` | `backend/src/files/files.controller.ts` | Ownership check before metadata/signing | Actor propagation tested; wrong-owner pending |
| `GET /files/download/:scope/:storedName` | `backend/src/files/files.controller.ts` | Ownership check before redirect/download; short signed URL TTL | Actor propagation tested; wrong-owner/TTL pending |
| `DELETE /files/:scope/:storedName` | `backend/src/files/files.controller.ts` | Teacher/admin only; teacher cannot delete unrelated files | Actor propagation tested; wrong-scope pending |

## Security tests now covering matrix

- `backend/test/security/authorization-abuse.spec.ts` checks role metadata guardrails.
- `backend/test/security/session-abuse.spec.ts` checks `JwtAuthGuard` semantics.
- `backend/test/security/auth-abuse.spec.ts` checks auth failure and token-refresh basics.
- `backend/test/security/file-access-abuse.spec.ts` checks token identity propagation and upload policy basics.
- `backend/test/security/input-hardening.spec.ts` checks DTO mass-assignment and runtime config hardening.
- `backend/test/security/health-redaction.spec.ts` checks health/config redaction basics.

## Required before AUTHZ-GATE can pass

1. Runtime 401/403 tests for admin-only routes.
2. Student wrong-owner tests for submissions, files, dashboard/profile-derived data, and notifications.
3. Teacher wrong-scope tests for submissions, subjects, groups, sections, reports/exports, files, and notifications.
4. Webhook signature/replay tests.
5. Public monitoring payload size/rate/sanitization tests.
6. Backup restore/download/delete abuse tests.
7. Admin system-tool artifact path traversal tests.
8. Live passing evidence for `npm --prefix backend run test:security`.

## Current blocker

The matrix is mapped broadly enough to guide implementation, but it is not proof. The next valuable work is service-level wrong-owner/wrong-scope tests, not more optimistic documentation.
