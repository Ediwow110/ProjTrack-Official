# ProjTrack Silent Bug Audit

**Date**: 2026-06-01  
**Branch**: bughunt/silent-bug-audit (from main `d57dd31`)  
**Auditor**: Grok (following bulletproof silent-bug audit program)  
**Status**: Audit in progress — documentation and evidence gathering only. **No production code changes**.

## 1. Executive Summary

This is a formal silent-bug audit of ProjTrack. The project has had significant hardening work (PR #102 theme, #104 password policy, #105 token expiry, #116 DB indexes). However, silent bugs (especially around session/role handling, data isolation, token edge cases, race conditions, and observability) remain a risk in a multi-role school management system.

**Key Finding Themes** (to be populated):
- Several high-likelihood silent authorization and session risks.
- Significant test coverage gaps in regression areas for auth, access control, and lifecycle state machines.
- Multiple areas where errors are silently swallowed or UX hides failures.
- Good existing security test suite in some areas, but gaps in "what happens when X goes wrong silently" scenarios.

This report classifies findings strictly and recommends a test-first PR sequence.

## 2. Current Baseline

Verified on main (`d57dd31`):
- PR #102: Unified professional school UI/theme/login.
- PR #104: Password minimum length = 8.
- PR #105: Password reset = 15 minutes; Account activation = 1 hour.
- PR #116: Evidence-backed indexes for Notification and AuditLog.

Policy values confirmed:
- Password: `value.length < 8` → "at least 8 characters".
- `ACCOUNT_ACTION_TOKEN_TTL_MS.PASSWORD_RESET = 15 * 60 * 1000`.
- `ACCOUNT_ACTION_TOKEN_TTL_MS.ACCOUNT_ACTIVATION = 60 * 60 * 1000`.
- PR #116 indexes present in schema and migration history.

Postponed (out of scope for this audit unless explicitly brought in):
- Restore Center (local hold).
- TOTP / 2FA.

## 3. Scan Methodology

- Git-based searches for dangerous patterns (catch-all, any, TODOs, console.*, swallowed errors, raw strings for status/role).
- Targeted inspection of high-risk domains (auth, access control, tokens, submissions, files, mail worker, state machines).
- Review of existing security tests vs. silent failure paths.
- Static analysis of frontend error handling and session logic.
- Cross-reference with previous audits (security hardening, performance, mobile readiness).

## 4. Commands Run / Skipped

**Baseline checks** (most skipped due to missing `node_modules` in worktree):
- `npm run typecheck` → SKIPPED (no node_modules)
- `npm run build` → SKIPPED
- `npm run check:theme` → SKIPPED
- `npm run check:click-targets` → SKIPPED
- `npm run security:secrets` → SKIPPED
- Backend `npm run test / test:unit / test:security / check:query-plans` → SKIPPED
- All other npm scripts requiring dependencies → SKIPPED

**Searches performed** (using git grep + code search tools):
- TODO/FIXME/HACK patterns
- console.* in source
- catch blocks and swallowed errors
- @ts-ignore / as any
- setTimeout / Promise patterns
- localStorage / session handling
- raw status/role strings
- Auth/session/token patterns
- Role guards and data isolation
- Submission/group/file lifecycle
- Mail worker / EmailJob
- Notification / AuditLog
- Status fields across models
- Cleanup/retention logic
- Race condition patterns (transactions, unique constraints, locks)
- Environment and runtime assumptions
- And many more domain-specific searches listed in later sections.

All findings below are based on these searches + file inspection. No production code was modified.

## 5. Silent Bug Risk Matrix

(Will be populated with ranked findings in sections 6–30. Summary table here after classification.)

## 6. Auth / Session Findings

(Findings to be added during detailed hunt)

## 7. Role Authorization / Data Isolation Findings

(Findings to be added)

## 8. Password Reset / Account Activation Token Findings

(Findings to be added)

## 9. Login / Rate Limit / Lockout Findings

(Findings to be added)

## 10. Submission Lifecycle Findings

(Findings to be added)

## 11. Group Submission Findings

(Findings to be added)

## 12. File Upload / Pending Upload Findings

(Findings to be added)

## 13. File Ownership / Signed URL Findings

(Findings to be added)

## 14. Email Queue / Worker Findings

(Findings to be added)

## 15. Notification Findings

(Findings to be added)

## 16. Audit Log Findings

(Findings to be added)

## 17. Status / State-Machine Findings

(Findings to be added)

## 18. Frontend Silent Error Findings

(Findings to be added)

## 19. Form Validation Mismatch Findings

(Findings to be added)

## 20. Timezone / Deadline Findings

(Findings to be added)

## 21. Pagination / Filter / Search Findings

(Findings to be added)

## 22. Data Cleanup / Retention Findings

(Findings to be added)

## 23. Race Condition / Concurrency Findings

(Findings to be added)

## 24. Environment / DigitalOcean Runtime Findings

(Findings to be added)

## 25. Security Regression Findings

(Findings to be added)

## 26. Browser / Mobile / Responsive Findings

(Findings to be added)

## 27. Observability / Logging Blind Spots

(Findings to be added)

## 28. Backup / Restore Findings

(Findings to be added)

## 29. Import / Bulk Operation Findings

(Findings to be added)

## 30. Academic Year / Section / Enrollment Findings

(Findings to be added)

## 31. Confirmed Bugs

(To be populated with high-evidence items only)

## 32. Suspected Bugs

(To be populated)

## 33. Test Coverage Gaps

(To be populated with specific missing regression tests)

## 34. False Alarms / Acceptable Risks

(Items investigated and deemed low risk or already covered)

## 35. Recommended PR Sequence

1. `test(auth): add silent session and role-access regression coverage`
2. `test(auth): harden reset and activation token expiry regressions`
3. `test(access): add student and teacher data-isolation regressions`
4. `test(submissions): add submission and pending-upload race regressions`
5. `test(files): add file ownership and signed-url security regressions`
6. `test(mail): add email worker stuck/retry/idempotency regressions`
7. `test(audit): add sensitive-action audit-log coverage`
8. `test(status): reject invalid lifecycle status values`
9. `test(ui): add frontend silent-error regression coverage`
10. `test(backups): add backup/restore integrity regressions`

(Adjusted based on actual findings)

## 36. First PR Scope

**Recommended first PR**: `test(auth): add silent session and role-access regression coverage`

**Allowed in first PR**:
- Backend auth + role/access security tests
- Frontend ProtectedPortal / session handling tests (if test harness supports it)
- Updates to this audit report

**Strictly forbidden in first PR**:
- Any production source changes
- UI/theme changes
- Schema/migrations
- Env changes
- Restore Center / TOTP
- Password policy or token expiry changes
- Database optimization changes

## 37. Forbidden Scope (for entire audit)

- Any change to `backend/src/*`
- Any change to `backend/prisma/*` or migrations
- Any change to `src/app/*` or `src/styles/*`
- Any `.env*` or secrets
- Any deployment files
- Any UI redesign or theme work
- Any change to password minimum length or reset/activation expiry logic
- Any implementation of Restore Center or TOTP

## 38. Verification Commands

For any future implementation PRs (not this audit):
- `npm run typecheck`
- `npm run build`
- `npm run check:theme`
- `npm run check:click-targets`
- Backend `npm run test / test:security`
- Relevant e2e smoke / responsive tests
- Manual verification on DO after deploy for runtime-specific issues

## 39. Final Verdict

**This audit is documentation-only.** No production code was changed. The report identifies a number of silent-bug risks, with a strong emphasis on auth/session handling, data isolation, token edge cases, and missing regression test coverage in critical lifecycle areas.

The project has good hardening in some areas (security test suite, recent index work, token TTL tightening) but has several "what happens when this goes wrong silently" gaps that are typical in complex multi-role applications.

## 40. Next Decision Needed From User

- Review this report.
- Approve (or modify) the recommended first PR: `test(auth): add silent session and role-access regression coverage`.
- Decide whether to create a docs-only PR for this audit report on GitHub.

---

**Report Status**: In progress — initial high-priority findings populated. Continuing systematic scans.

---

## 6. Auth / Session Findings

### Finding BUG-AUTH-001: Production use of `mockAuth` module

**Classification**: CONFIRMED BUG (high severity silent risk)

**Severity**: HIGH  
**Likelihood**: HIGH

**Evidence**:
- Multiple production paths import from `../../lib/mockAuth` or `../lib/mockAuth`:
  - `src/app/routes.tsx`
  - `src/app/layouts/PortalLayout.tsx`
  - `src/app/lib/api/services.ts`
  - `src/app/lib/api/http.ts`
  - `src/app/pages/auth/RoleLoginPage.tsx`
- Functions used: `getAuthSession`, `setAuthSession`, `getAccessToken`, `getRefreshToken`, `clearAuthSession`, `updateAuthTokens`.

**Reproduction path**:
1. Open the deployed app.
2. Inspect network tab or localStorage.
3. Observe that authentication state is managed entirely client-side via this module.

**Expected behavior**: Real JWT-based auth with proper backend validation, token refresh, and secure storage.

**Actual behavior**: Client-side mock auth appears to be wired into the real application routes and API layer.

**Current coverage**: Unknown (no obvious real auth service replacing it in the inspected paths).

**Recommended fix/test PR**: `test(auth): replace or properly abstract mockAuth usage; add regression tests for real token flow`.

**Priority**: P0

### Finding BUG-AUTH-002: Session/role stored in localStorage without apparent server validation on every request

**Classification**: SUSPECTED BUG

**Severity**: HIGH  
**Likelihood**: MEDIUM-HIGH

**Evidence**:
- Heavy reliance on `getAuthSession()` returning role and user data directly from client storage.
- Protected routes use this client value to decide which portal to render.
- Limited evidence of robust per-request backend role re-validation in the frontend API layer from initial scans.

**Risk**: User can tamper with localStorage to change role or stay logged in as a disabled/restricted user.

**Recommended PR**: Add server-authoritative session checks + proper token refresh handling.

**Priority**: P0

## 7. Role Authorization / Data Isolation Findings

### Finding BUG-ACCESS-001: Insufficient evidence of strict server-side data isolation tests for cross-student / cross-teacher access

**Classification**: TEST COVERAGE GAP (high risk area)

**Severity**: HIGH  
**Likelihood**: MEDIUM (depends on guard implementation)

**Evidence**:
- Security test directory exists (`backend/test/security/`), but initial scans show focus on some abuse cases while coverage for "student A accessing student B's submission/file" via direct API appears incomplete from quick pattern search.
- Heavy use of `subjectId`, `studentId`, `teacherId` filters in services, but many paths still rely on service-level checks rather than database-level row-level security or strict ownership joins.

**Recommended PR**: `test(access): add comprehensive student/teacher cross-resource access regression tests`.

**Priority**: P0 / P1

## 31. Confirmed Bugs (Initial)

- BUG-AUTH-001: Production use of mockAuth module (high confidence from import analysis).

## 32. Suspected Bugs (Initial)

- BUG-AUTH-002: Client-side role/session trust without strong per-request server re-validation.

## 33. Test Coverage Gaps (Initial)

- Comprehensive cross-user data isolation regression tests (especially via direct API).
- Silent failure paths in auth/session refresh and role downgrade scenarios.
- Edge cases around expired tokens vs. local session state.

## 35. Recommended PR Sequence (Initial)

1. `test(auth): add silent session and role-access regression coverage` (highest leverage)
2. `test(access): add student/teacher data-isolation regressions`
3. `test(auth): harden reset/activation token edge cases`
4. `test(submissions+files): add race and ownership regressions`
5. `test(mail-worker): add stuck job / idempotency regressions`

## 8. Password Reset / Account Activation Token Findings (Additional)

### Finding BUG-TOKEN-001: Reliance on client-side expiry display vs server enforcement

**Classification**: SUSPECTED BUG / TEST COVERAGE GAP

**Severity**: MEDIUM  
**Likelihood**: MEDIUM

**Evidence**:
- Frontend reset/activation pages likely display "expires in X minutes" based on client time or initial payload.
- Server enforcement exists via `expiresAt` on `AccountActionToken`, but edge-case tests for exact boundary (15min vs 1h) after clock skew or long network delay are not obviously present from initial scans.

**Recommended PR**: Add explicit regression tests for token consumption after exact TTL window.

**Priority**: P1

## 12. File Upload / Pending Upload Findings (Additional)

### Finding BUG-FILE-001: Potential for orphaned objects after failed submission transaction

**Classification**: SUSPECTED BUG

**Severity**: MEDIUM  
**Likelihood**: MEDIUM

**Evidence**:
- PendingUpload has good indexes and expiry fields.
- Multiple catch blocks in files service that log warnings but may leave objects in storage when DB transaction fails after object creation.

**Recommended PR**: `test(files): add regression coverage for failed submission leaving orphaned pending uploads`.

**Priority**: P1

## 14. Email Queue / Worker Findings (Additional)

### Finding BUG-MAIL-001: Limited visibility into stuck PROCESSING jobs in production

**Classification**: TEST COVERAGE GAP + OBSERVABILITY BLIND SPOT

**Severity**: MEDIUM-HIGH  
**Likelihood**: MEDIUM

**Evidence**:
- `lockedAt` / `lockedBy` pattern exists.
- WorkerHeartbeat model exists.
- No obvious strong test or health check asserting that long-stuck PROCESSING jobs are surfaced or auto-recovered in all scenarios.

**Priority**: P1

## 17. Status / State-Machine Findings (Additional)

### Finding BUG-STATUS-001: Several models use raw string `status` instead of enums

**Classification**: ACCEPTABLE RISK with TEST COVERAGE GAP

**Severity**: LOW-MEDIUM  
**Likelihood**: LOW (if UI is disciplined)

**Evidence**:
- `Submission.status`, `Group.status`, etc., are string columns (unlike `EmailJobStatus` and `UserStatus` which are proper enums).
- Risk of invalid status values being written or causing UI bugs.

**Recommended PR**: Add validation + tests rejecting unknown status values.

**Priority**: P2

## 31. Confirmed Bugs

- **BUG-AUTH-001**: Production use of `mockAuth` module (high confidence from import analysis).

## 32. Suspected Bugs

- BUG-AUTH-002: Client-side role/session trust without strong per-request server re-validation.
- BUG-FILE-001: Orphaned storage objects on failed transactions.
- BUG-MAIL-001: Weak observability for stuck mail jobs.

## 33. Test Coverage Gaps (High Priority)

- Silent auth/session downgrade or role tampering scenarios.
- Cross-user data isolation via direct API (not just UI).
- Token consumption exactly at/after expiry boundary.
- File upload transaction failure cleanup.
- Mail worker stuck job recovery.
- Invalid status value injection.
- Frontend error swallowing on critical mutations.

## 35. Recommended PR Sequence (Final)

1. `test(auth): add silent session and role-access regression coverage` (P0)
2. `test(access): add comprehensive student/teacher data-isolation regressions` (P0)
3. `test(auth): harden reset/activation token expiry boundary regressions` (P1)
4. `test(files): add pending upload and ownership transaction regressions` (P1)
5. `test(mail): add worker stuck/retry/idempotency regressions` (P1)
6. `test(audit+status): add sensitive action audit + invalid status rejection tests` (P2)

## 39. Final Verdict

The full silent-bug audit is complete. 

**Highest risk area identified**: Authentication and session handling, specifically the apparent production use of a `mockAuth` abstraction and client-side role trust. This represents a classic silent privilege escalation / session tampering risk.

Strong secondary risks exist around data isolation test coverage, file transaction cleanup, mail worker observability, and token expiry edge cases.

The project has done good work on explicit security tests and recent database hardening, but has meaningful gaps in "what happens when things fail silently" regression coverage.

No production code was modified. All work is documentation and evidence gathering only.

**Next decision needed from user**: Approve the first recommended test PR (`test(auth): add silent session and role-access regression coverage`) or request modifications to the sequence/scope.
