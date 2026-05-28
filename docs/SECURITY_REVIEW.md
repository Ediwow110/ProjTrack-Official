# Security Review

Branch: `2nd-main`  
Last updated: 2026-05-14

## Scope

This review covers the current backend security posture on `2nd-main` based on the threat model, authorization matrix, and first executable security tests.

Primary evidence:

- `docs/THREAT_MODEL.md`
- `docs/AUTHORIZATION_MATRIX.md`
- `docs/SECURITY_TEST_PLAN.md`
- `backend/jest.security.config.cjs`
- `backend/test/security/auth-abuse.spec.ts`
- `backend/test/security/session-abuse.spec.ts`
- `backend/test/security/authorization-abuse.spec.ts`
- `backend/test/security/file-access-abuse.spec.ts`
- `backend/test/security/input-hardening.spec.ts`
- `backend/test/security/health-redaction.spec.ts`

## Current verdict

`SEC-GATE` is not passed yet.

The branch now has a real security test gate and first regression tests, but this review is not complete until the tests are run successfully in CI and service-level owner/scope authorization is audited.

## Positive findings

### Authentication/session controls

- Protected routes use bearer access tokens through `JwtAuthGuard`.
- `JwtAuthGuard` rejects missing bearer tokens, invalid access token type, inactive users, and role mismatches against the database user record.
- `AuthService` records failed login attempts and uses auth throttling.
- Forgot-password uses a generic response for missing accounts and role mismatches.
- Reset-password validates confirmation mismatch before consuming reset tokens.
- Refresh token rotation is delegated to the session service.

Evidence:

- `backend/test/security/auth-abuse.spec.ts`
- `backend/test/security/session-abuse.spec.ts`

### Route role controls

- Admin controller is class-level `ADMIN` restricted.
- File upload/download routes are authenticated and role-limited.
- File listing/deletion excludes students.
- Student, teacher, profile, dashboard, and sensitive health routes have role metadata guardrails.

Evidence:

- `backend/test/security/authorization-abuse.spec.ts`
- `docs/AUTHORIZATION_MATRIX.md`

### File upload and download controls

- File controller uses token user identity for upload ownership, not body-supplied ownership fields.
- File service rejects script/executable extensions.
- File service rejects MIME/extension mismatches.
- File service validates basic magic bytes for supported binary file types.
- Base64 JSON uploads are blocked in production unless explicitly enabled.
- Invalid upload scopes are rejected.

Evidence:

- `backend/test/security/file-access-abuse.spec.ts`

### Runtime and input hardening

- DTO validation tests assert that unknown/mass-assignment fields are rejected under whitelist + forbidNonWhitelisted validation.
- Production runtime safety flags weak JWT secrets, equal access/refresh secrets, local production storage, memory rate limiting, disabled malware scanning, and missing `TRUST_PROXY`.

Evidence:

- `backend/test/security/input-hardening.spec.ts`
- `backend/src/config/runtime-safety.ts`

### Health/config redaction

- Public liveness/readiness responses are tested for absence of secret/config values.
- Runtime configuration inspection is tested to report key names without dumping secret values.
- Database health response is tested to avoid leaking database URLs or credentials.

Evidence:

- `backend/test/security/health-redaction.spec.ts`

## Blocking gaps

### 1. Live test evidence missing

The following command must be run and recorded:

```bash
npm --prefix backend run test:security
```

Until a passing run is recorded in CI or local evidence, the new tests are implementation progress, not final security evidence.

### 2. Service-level owner/scope authorization still incomplete

Controller decorators prove role gates. They do not prove owner/scope isolation.

Still required:

- Student A cannot read Student B submissions.
- Student A cannot download Student B files.
- Teacher cannot read/review unrelated section/class submissions.
- Teacher cannot export unrelated submissions.
- Teacher cannot delete unrelated files.
- Admin-only routes reject non-admin users at runtime.

### 3. Route matrix not exhaustive yet

The authorization matrix still needs expansion for:

- `backend/src/mail/mail.controller.ts`
- `backend/src/mail/mail.webhook.controller.ts`
- `backend/src/branding/branding.controller.ts`
- `backend/src/branding/admin-branding.controller.ts`
- `backend/src/students/admin-students.controller.ts`
- `backend/src/subjects/subjects.controller.ts`
- `backend/src/backups/backups.controller.ts`
- `backend/src/monitoring/monitoring.controller.ts`
- `backend/src/notifications/notifications.controller.ts`

### 4. Rate-limit proof still incomplete

The code has auth throttling and runtime config checks, but security acceptance still needs runtime tests proving rate limits on:

- login
- forgot-password
- reset-password
- upload
- report/export routes
- admin action bursts

### 5. File storage proof still incomplete

Current tests validate policy checks and identity propagation, but still need deeper service-level tests for:

- wrong-owner download rejection
- wrong-owner metadata rejection
- signed URL TTL behavior
- production S3/private bucket assumptions
- malware scanner fail-closed behavior

### 6. Supply-chain review missing

Still required:

- `docs/SUPPLY_CHAIN_SECURITY.md`
- dependency audit exception process
- GitHub Actions permission review
- lockfile integrity expectations

### 7. Secret lifecycle docs missing

Still required:

- `docs/SECRETS_MANAGEMENT_CHECKLIST.md`
- `docs/SECRET_LEAK_RESPONSE.md`
- key rotation plan for JWT and account action token encryption

## Required next work

1. Run `npm --prefix backend run test:security` and record result in `docs/CI_STATUS.md` or `docs/SECURITY_ACCEPTANCE_GATE.md`.
2. Add service-level owner/scope tests for submissions and files.
3. Expand `docs/AUTHORIZATION_MATRIX.md` to all remaining controllers.
4. Add `docs/SECURITY_ACCEPTANCE_GATE.md` with pass/fail checklist.
5. Add supply-chain and secret-management docs.
6. Add CI failure summaries so security test failures are easy to diagnose.

## Security review status

In progress. The branch has meaningful security controls and tests now, but the evidence is not complete enough for a main merge or production-readiness claim.
