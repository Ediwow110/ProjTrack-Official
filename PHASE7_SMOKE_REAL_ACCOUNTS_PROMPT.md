# Phase 7: Production-Safe Smoke Tests with Real Accounts

Use this checklist when you need to validate staging or production-like environments without seeding or mutating real user data.

## Goal

- Verify backend readiness, role-based authentication, token refresh, logout, and login throttling.
- Avoid password-reset generation, profile edits, avatar uploads, and file upload/delete roundtrips.

## Required environment variables

- `SMOKE_USE_REAL_ACCOUNTS=true`
- `SMOKE_ADMIN_EMAIL` or `SMOKE_ADMIN_IDENTIFIER`
- `SMOKE_ADMIN_PASSWORD`
- `SMOKE_TEACHER_EMAIL` or `SMOKE_TEACHER_IDENTIFIER`
- `SMOKE_TEACHER_PASSWORD`
- `SMOKE_STUDENT_EMAIL` or `SMOKE_STUDENT_IDENTIFIER`
- `SMOKE_STUDENT_PASSWORD`

## Commands

From the repo root:

```bash
npm --prefix backend run build
npm --prefix backend run smoke:real
```

Or with explicit environment overrides:

```bash
SMOKE_USE_REAL_ACCOUNTS=true \
SMOKE_ADMIN_EMAIL=admin@projtrack.codes \
SMOKE_ADMIN_PASSWORD=replace-me \
SMOKE_TEACHER_EMAIL=teacher@projtrack.codes \
SMOKE_TEACHER_PASSWORD=replace-me \
SMOKE_STUDENT_EMAIL=student@projtrack.codes \
SMOKE_STUDENT_PASSWORD=replace-me \
npm --prefix backend run smoke:real
```

## Expected behavior

- The smoke output reports `smokeMode: "real-accounts"`.
- Health endpoints, role logins, refresh, logout, and login throttling pass.
- The result includes a `skippedChecks` array listing destructive checks intentionally not executed against real accounts.

## Local mutation-safe mode

Use this mode only against local or disposable environments where mutation checks are acceptable:

```bash
npm --prefix backend run smoke:local
```

This mode continues to validate:

- forgot-password token persistence
- admin profile update and revert
- avatar upload
- object storage upload, download, and delete roundtrip
