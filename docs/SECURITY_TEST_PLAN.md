# Security Test Plan

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

This plan defines the concrete security regression tests required before `SEC-GATE` and `AUTHZ-GATE` can pass. It is derived from `docs/THREAT_MODEL.md` and `docs/AUTHORIZATION_MATRIX.md`.

## Test command target

Preferred command:

```bash
npm --prefix backend run test:security
```

If the script does not exist yet, add it to `backend/package.json` and wire it to Jest security specs under `backend/test/security/**`.

## Required test files

```text
backend/test/security/auth-abuse.spec.ts
backend/test/security/session-abuse.spec.ts
backend/test/security/authorization-abuse.spec.ts
backend/test/security/file-access-abuse.spec.ts
backend/test/security/input-hardening.spec.ts
backend/test/security/health-redaction.spec.ts
```

## Auth abuse tests

File: `backend/test/security/auth-abuse.spec.ts`

Required cases:

- Wrong password fails safely.
- Disabled/inactive user cannot log in.
- Login response does not expose password hash or internal auth state.
- Unknown account and wrong password responses do not enable easy account enumeration.
- Login is rate-limited.
- Forgot-password is rate-limited.
- Forgot-password does not disclose whether the account exists.
- Reset token expires.
- Reset token is single-use.
- Activation token expires.
- Activation token is single-use.

## Session abuse tests

File: `backend/test/security/session-abuse.spec.ts`

Required cases:

- Missing access token returns `401` on protected routes.
- Expired access token returns `401`.
- Malformed access token returns `401`.
- Token with wrong type returns `401`.
- Deactivated user token returns `401`.
- Token role mismatch with current database role returns `401`.
- Expired refresh token fails.
- Refresh token reuse is rejected or invalidates the session family by design.
- Logout invalidates refresh token where supported.
- Refresh token is not leaked in production-mode JSON response when cookie mode is used.

## Authorization abuse tests

File: `backend/test/security/authorization-abuse.spec.ts`

Required cases:

- Anonymous user cannot call `/admin/**` routes.
- Student cannot call `/admin/**` routes.
- Teacher cannot call `/admin/**` routes.
- Student A cannot read Student B submission.
- Student A cannot read Student B dashboard/profile-derived data.
- Teacher cannot read/review unrelated section/class submission.
- Teacher export is scoped to assigned data only.
- Admin access is allowed only where explicitly intended.
- Request body cannot assign `role=ADMIN`.
- Request body cannot override `userId`, `ownerId`, or actor fields.
- Deleted/archived records remain inaccessible to unauthorized users.

## File access abuse tests

File: `backend/test/security/file-access-abuse.spec.ts`

Required cases:

- Anonymous user cannot upload, list, inspect, download, or delete files.
- Student cannot download another student's file.
- Teacher cannot download unrelated student/section file.
- Teacher cannot delete unrelated file.
- File signing/metadata requires ownership or permitted role scope.
- Dangerous extension is rejected.
- Disallowed MIME type is rejected.
- Oversized multipart upload is rejected.
- Oversized base64 upload is rejected.
- Production mode rejects local storage configuration.

## Input hardening tests

File: `backend/test/security/input-hardening.spec.ts`

Required cases:

- Unknown DTO fields are rejected where strict validation is required.
- Pagination `limit` has a maximum.
- Sort fields are allowlisted.
- Filter fields are allowlisted.
- Body-supplied security fields are ignored or rejected.
- Query parameters cannot trigger unbounded exports unless route is explicitly accepted and documented.

## Health/config redaction tests

File: `backend/test/security/health-redaction.spec.ts`

Required cases:

- Public `/health`, `/health/live`, `/health/ready`, and `/health/api-ready` do not expose secrets.
- `/health/configuration` requires admin.
- `/health/database` requires admin.
- `/health/mail` requires admin.
- `/health/storage` requires admin.
- Admin health responses redact database URLs, JWT secrets, API keys, tokens, signed URL secrets, and provider credentials.

## Minimum acceptance for first security test milestone

The first milestone is not full coverage. It is a blocker-killer milestone:

- Auth/session abuse specs exist.
- Authorization abuse spec covers at least one admin-only route, one student owner-only route, one teacher-scoped route, and one file access route.
- Tests fail if role decorators or owner checks are removed.
- `npm --prefix backend run test:security` exists and runs these tests.

## Evidence to record

After implementing tests, update:

- `docs/2ND_MAIN_IMPROVEMENTS.md`
- `docs/SECURITY_REVIEW.md`
- `docs/SECURITY_ACCEPTANCE_GATE.md`
- `docs/AUTHORIZATION_MATRIX.md`

## Current verdict

Security tests are planned, not implemented. `SEC-GATE` and `AUTHZ-GATE` remain blocked until these tests exist and pass.
