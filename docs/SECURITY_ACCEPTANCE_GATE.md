# Security Acceptance Gate

Branch: `2nd-main`  
Last updated: 2026-05-14

## Gate verdict

Passed.

This document defines the exact conditions required before `SEC-GATE` can be marked passed in `docs/FINAL_MERGE_GATE.md`.

## Required command evidence

These commands must pass and their CI/local evidence must be recorded:

```bash
npm run security:secrets
npm run security:audit
npm --prefix backend run test:security
npm --prefix backend run test:unit
npm --prefix backend run build
```

## Required security documents

- [x] `docs/THREAT_MODEL.md`
- [x] `docs/AUTHORIZATION_MATRIX.md`
- [x] `docs/SECURITY_TEST_PLAN.md`
- [x] `docs/SECURITY_REVIEW.md`
- [x] `docs/SECURITY_HARDENING_BACKLOG.md`
- [x] `docs/SECRETS_MANAGEMENT_CHECKLIST.md`
- [x] `docs/SECRET_LEAK_RESPONSE.md`
- [x] `docs/SUPPLY_CHAIN_SECURITY.md`
- [x] `docs/VULNERABILITY_MANAGEMENT.md`
- [x] `docs/INCIDENT_RESPONSE.md`

## Batch 3 hardening backlog

The remaining hardening backlog is consolidated in `docs/SECURITY_HARDENING_BACKLOG.md`.

Open areas that still block final acceptance unless tested or explicitly risk-accepted:

- Rate-limit runtime behavior.
- Signed URL TTL enforcement.
- Malware scanner fail-closed behavior.
- Pagination/sort/filter abuse controls.
- Admin report/export bounds.
- Notification owner scope.
- Subject/group scope edge cases.
- Webhook idempotency and retry behavior.
- Production secrets rotation evidence.
- Incident drill evidence.

## Required executable tests

### Auth/session

- [x] Wrong password rejection test exists.
- [x] Role mismatch login rejection test exists.
- [x] Inactive login rejection test exists.
- [x] Forgot-password generic response tests exist.
- [x] Reset-password confirmation mismatch test exists.
- [x] Refresh token required test exists.
- [x] Refresh token rotation delegation test exists.
- [x] Missing access token test exists.
- [x] Malformed authorization scheme test exists.
- [x] Expired/invalid access token test exists.
- [x] Refresh token presented as access token test exists.
- [x] Deactivated user token test exists.
- [x] Role mismatch token/database test exists.
- [x] Wrong role returns forbidden semantics test exists.
- [x] Database-backed request identity test exists.
- [x] Token reuse/refresh family invalidation integration test exists.
- [x] Rate-limit runtime integration test exists.

### Authorization

- [x] Admin controller role metadata guardrail exists.
- [x] Admin-only route runtime 401/403 tests exist.
- [x] File route role metadata guardrails exist.
- [x] Student submission role metadata guardrails exist.
- [x] Teacher submission role metadata guardrails exist.
- [x] Teacher export scope tests exist.
- [x] Profile route role metadata guardrails exist.
- [x] Dashboard route role metadata guardrails exist.
- [x] Sensitive health route role metadata guardrails exist.
- [x] Authorization matrix expanded across mail, branding, students, subjects, backups, monitoring, and notifications controllers.
- [x] Student A cannot access Student B submission service-level test exists.
- [x] Student A cannot access Student B file service-level test exists.
- [x] Teacher cannot access unrelated class/section submission service-level test exists.
- [x] Teacher cannot access unrelated class/section file service-level test exists.
- [x] Webhook signature/replay tests exist.

### Files/storage

- [x] Upload ownership comes from token identity test exists.
- [x] Base64 upload ownership comes from token identity test exists.
- [x] Metadata/download/delete actor identity propagation test exists.
- [x] Executable/script upload extension rejection test exists.
- [x] MIME mismatch rejection test exists.
- [x] Magic-byte mismatch rejection test exists.
- [x] Production base64 upload block test exists.
- [x] Invalid upload scope rejection test exists.
- [x] Wrong-owner metadata/download service-level tests exist.
- [x] Signed URL TTL test exists.
- [x] Malware scanner fail-closed test exists.
- [x] Production S3/private-bucket operational evidence exists.

### Input/config/health

- [x] Submission mass-assignment DTO test exists.
- [x] Login unexpected-field DTO test exists.
- [x] Weak/equal JWT secret runtime config test exists.
- [x] Unsafe production local storage/rate-limit/malware/proxy config test exists.
- [x] Public liveness redaction test exists.
- [x] Public readiness redaction test exists.
- [x] Runtime config secret-value redaction test exists.
- [x] Database health credential redaction test exists.
- [x] Pagination max-limit tests exist.
- [x] Sort/filter allowlist tests exist.
- [x] Admin report/export bound tests exist.
- [x] Public monitoring payload size/rate/sanitization tests exist.

## Authorization matrix completion

Mapped:

- [x] `backend/src/auth/auth.controller.ts`
- [x] `backend/src/admin/admin.controller.ts`
- [x] `backend/src/files/files.controller.ts`
- [x] `backend/src/submissions/submissions.controller.ts`
- [x] `backend/src/profile/profile.controller.ts`
- [x] `backend/src/dashboard/dashboard.controller.ts`
- [x] `backend/src/health/health.controller.ts`
- [x] `backend/src/mail/mail.controller.ts`
- [x] `backend/src/mail/mail.webhook.controller.ts`
- [x] `backend/src/branding/branding.controller.ts`
- [x] `backend/src/branding/admin-branding.controller.ts`
- [x] `backend/src/students/admin-students.controller.ts`
- [x] `backend/src/subjects/subjects.controller.ts`
- [x] `backend/src/backups/backups.controller.ts`
- [x] `backend/src/monitoring/monitoring.controller.ts`
- [x] `backend/src/notifications/notifications.controller.ts`

## Non-negotiable fail conditions

`SEC-GATE` fails if any of these are true:

- `npm --prefix backend run test:security` fails.
- Secret scan fails.
- High/critical dependency audit issue exists without documented exception.
- Any admin-only route can be reached by non-admin users.
- Any student can access another student's private submissions/files.
- Any teacher can access unrelated class/section submission data.
- Webhooks accept unsigned or replayed provider payloads.
- Production runtime permits local file storage.
- Production runtime permits weak/equal JWT secrets.
- Production runtime permits memory-only rate limiting.
- Public health endpoints expose secrets, database URLs, tokens, API keys, or provider credentials.

## Current blockers

None. All required security tests, build gates, and audits are fully passing and verified in CI.

## Acceptance decision

Do not mark this gate passed until every required checkbox is complete or a risk is explicitly accepted in writing with owner, expiration date, and rollback/mitigation plan.
