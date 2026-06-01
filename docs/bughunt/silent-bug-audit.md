# ProjTrack Silent Bug Audit

**Date**: 2026-06-01  
**Branch**: bughunt/silent-bug-audit (from main `d57dd31`)  
**Auditor**: Grok (following bulletproof silent-bug audit program)  
**Status**: Audit complete — documentation and evidence gathering only. **No production code was changed at any point.**

---

## 1. Executive Summary

This is a formal silent-bug audit of ProjTrack following significant recent hardening work (PR #102 unified design, #104 password minimum 8, #105 token expiry tightening, #116 database indexes).

**Key Conclusion**: While the project has good explicit security test coverage in several areas and has made meaningful improvements to token lifetimes and database performance, there remain several high-risk *silent* failure modes, particularly around authentication/session handling, client-side role trust, data isolation, and observability of background processes.

The most concerning confirmed finding is the apparent production use of a `mockAuth` abstraction in real application routes and API layers. This represents a classic high-likelihood silent privilege escalation and session tampering risk.

The report recommends a test-first PR sequence, starting with regression coverage for auth/session and role-based data isolation.

---

## 2. Current Baseline

Verified on main at commit `d57dd31`:

- PR #102: Unified professional school UI/theme/login design.
- PR #104: Password minimum length changed to 8 characters.
- PR #105: Password reset links expire after 15 minutes; account activation links expire after 1 hour.
- PR #116: Evidence-backed indexes added for `Notification(userId, isRead, createdAt)`, `AuditLog(createdAt)`, and `AuditLog(actorUserId, createdAt)`.

Policy values confirmed on main:
- Password minimum: `value.length < 8` with message "at least 8 characters long".
- `ACCOUNT_ACTION_TOKEN_TTL_MS.PASSWORD_RESET = 15 * 60 * 1000`.
- `ACCOUNT_ACTION_TOKEN_TTL_MS.ACCOUNT_ACTIVATION = 60 * 60 * 1000`.
- PR #116 indexes present in both schema and migration history.

**Out of scope** (postponed / local hold):
- Restore Center
- TOTP / 2FA / authenticator app

---

## 3. Scope and Non-Goals

**In scope for this audit**:
- Silent bugs and dangerous patterns in auth, session management, role-based access control, token handling, submissions, files, mail worker, notifications, audit logs, state machines, frontend error handling, and related areas.
- Test coverage gaps for regression scenarios ("what happens when X fails silently").
- Evidence-based classification of risks.

**Explicitly out of scope** (no changes made):
- Any production source code (`backend/src/*`, `src/app/*`)
- Schema, migrations, or database structure
- UI/theme/design changes
- Password policy or token expiry duration changes
- Restore Center or TOTP work
- Env or deployment configuration
- Implementation of any fixes

---

## 4. Scan Methodology

- Static code analysis via targeted `git grep` and ripgrep searches for dangerous patterns.
- Review of existing security test suite (`backend/test/security/`).
- Inspection of auth/session handling, guards, policies, token services, mail worker, file services, and state machines.
- Cross-reference with previous project audits (security hardening, performance, mobile readiness).
- Honest documentation of what could not be executed due to missing dependencies in the audit environment.

---

## 5. Commands Run and Skipped

**Baseline verification commands executed**:
- `git fetch`, `git switch main`, `git pull`, policy greps for password minimum and token TTLs, PR #116 index verification → All passed.

**Full test/build commands skipped**:
- All `npm run typecheck`, `build`, `test*`, `check:*`, `security:*` commands were skipped because `node_modules` (frontend and backend) are not present in this worktree environment. This is a common limitation for source-only audit worktrees.

**Searches performed** (extensive):
- Dangerous patterns (`TODO/FIXME`, `console.*`, broad `catch` blocks, `as any`, raw status/role strings).
- Auth/session/token handling (`mockAuth`, `getAuthSession`, `ProtectedPortal`, token flows).
- Role guards and data isolation policies.
- Submission, group, file, mail worker, notification, and audit log logic.
- Cleanup, race condition, and state machine patterns.

All findings below are based on these static searches and file inspection. No runtime reproduction was possible due to environment constraints.

---

## 6. Classification Rules

Findings are classified as one of:
- **CONFIRMED BUG** — Strong static evidence of incorrect or dangerous behavior.
- **SUSPECTED BUG** — Strong evidence of risk, but full reproduction would require runtime or specific data.
- **TEST COVERAGE GAP** — Area with meaningful silent failure risk but inadequate regression tests.
- **ACCEPTABLE RISK / FALSE ALARM** — Investigated and found to be low risk or already adequately covered.
- **NEEDS MANUAL QA / DO VERIFICATION** — Requires production or controlled environment testing.

---

## 7. Silent Bug Risk Matrix

| ID            | Area                  | Classification                  | Severity   | Likelihood   | Priority | Evidence Summary                                      | Recommended PR |
|---------------|-----------------------|---------------------------------|------------|--------------|----------|-------------------------------------------------------|----------------|
| BUG-AUTH-001 | Auth / Session       | Confirmed bug / architecture risk | HIGH      | HIGH        | P0      | `mockAuth` module imported and used in real routes, API layer, and session handling | test(auth): add silent session and role-access regression coverage |
| BUG-AUTH-002 | Auth / Session       | Suspected bug / coverage gap     | HIGH      | MEDIUM-HIGH | P0      | Heavy client-side `getAuthSession()` role/session trust with localStorage | test(auth): add silent session and role-access regression coverage |
| BUG-ACCESS-001 | Access Control     | Test coverage gap                | HIGH      | MEDIUM      | P0/P1   | Cross-student/teacher direct API isolation scenarios lack dedicated regression tests | test(access): add student/teacher data-isolation regressions |
| BUG-TOKEN-001 | Tokens              | Test coverage gap                | MEDIUM-HIGH | MEDIUM    | P1      | Token expiry boundary and one-time-use behavior lacks explicit regression coverage | test(auth): harden reset/activation token expiry regressions |
| BUG-FILE-001 | Files / Storage     | Suspected bug                    | MEDIUM-HIGH | MEDIUM    | P1      | Multiple warning-only catch blocks around pending upload and file transactions | test(files): add pending upload and ownership transaction regressions |
| BUG-MAIL-001 | Mail Worker         | Coverage + observability gap     | MEDIUM-HIGH | MEDIUM    | P1      | Limited regression coverage and production visibility for stuck PROCESSING / retry / idempotency issues | test(mail): add worker stuck/retry/idempotency regressions |
| BUG-STATUS-001 | State Machines    | Acceptable risk + coverage gap   | MEDIUM    | LOW-MEDIUM  | P2      | Multiple models use raw string `status` fields instead of enums | test(status): reject invalid lifecycle status values |

---

## 8. Highest-Risk Findings

### BUG-AUTH-001: Production use of `mockAuth` module

**Classification**: CONFIRMED BUG (high severity silent risk)  
**Severity**: HIGH  
**Likelihood**: HIGH  
**Priority**: P0

**Evidence**:
- Real application paths import from `lib/mockAuth`:
  - `src/app/routes.tsx`
  - `src/app/layouts/PortalLayout.tsx`
  - `src/app/lib/api/services.ts`
  - `src/app/lib/api/http.ts`
  - `src/app/pages/auth/RoleLoginPage.tsx`
- Functions in active use include `getAuthSession`, `setAuthSession`, `getAccessToken`, `getRefreshToken`, `clearAuthSession`, and `updateAuthTokens`.

**Risk**:
Client-side session and role state is being used in what appears to be production authentication and authorization flows. This creates a high-likelihood vector for session tampering, stale role data, and false trust in the frontend.

**Recommended first PR**: `test(auth): add silent session and role-access regression coverage`

### BUG-AUTH-002: Client-side role/session trust without strong server re-validation

**Classification**: SUSPECTED BUG / TEST COVERAGE GAP  
**Severity**: HIGH  
**Likelihood**: MEDIUM-HIGH  
**Priority**: P0

**Evidence**:
- `getAuthSession()` returns role and user data directly from client storage.
- Protected routes and many UI decisions are driven by this client value.
- Limited visible evidence (in static scans) of robust per-request backend role re-validation combined with token refresh in all critical paths.

**Risk**:
LocalStorage tampering can allow role elevation, disabled/restricted users with old sessions, or inconsistent portal access during backend issues.

**Recommended PR**: Same as BUG-AUTH-001 (high overlap).

---

## 9–33. Domain-Specific Findings

### 9. Login / Rate Limit / Lockout
No confirmed critical silent bugs found in this pass. Rate limiting exists on auth actions. Test coverage for lockout edge cases and multi-tab behavior should be strengthened in future work.

### 10–13. Submission, Group, and File Lifecycle
Several warning-only catch blocks and transaction cleanup paths were identified (see BUG-FILE-001). These are suspected risks rather than proven runtime bugs without reproduction data.

### 14–18. Mail Worker, Notifications, Audit Log, Status Machines
- Mail worker has good schema support for stuck jobs but limited regression coverage for recovery paths (BUG-MAIL-001).
- Multiple models still use raw string `status` fields (BUG-STATUS-001).
- Audit log coverage for sensitive actions appears present but should be explicitly regression-tested.

### 19–33. Other Areas
No additional high-severity confirmed bugs were identified in this pass for timezone, pagination, cleanup, race conditions, runtime, security regressions, responsive issues, observability, backup/restore, import, or academic lifecycle beyond the coverage gaps already noted in the risk matrix.

---

## 34. Confirmed Bugs

- **BUG-AUTH-001**: Production use of `mockAuth` module in real authentication and session handling paths.

## 35. Suspected Bugs

- **BUG-AUTH-002**: Client-side role and session trust creating tampering and stale-state risks.
- **BUG-FILE-001**: Potential for orphaned storage objects after failed upload/submission transactions.

## 36. Test Coverage Gaps

- Cross-user and cross-role data isolation via direct API (BUG-ACCESS-001).
- Token expiry boundary and one-time-use behavior (BUG-TOKEN-001).
- Mail worker stuck job, retry, and idempotency recovery (BUG-MAIL-001).
- Invalid lifecycle status value injection and handling.
- Frontend silent error and mutation failure scenarios.

## 37. Acceptable Risks / False Alarms

- **BUG-STATUS-001**: Raw string status fields represent an acceptable risk in the current architecture provided UI and API layers are disciplined, but they should still receive regression test coverage.

## 38. Needs Manual QA / DO Verification

- Real production session behavior under load, multi-tab, and network failure conditions.
- Mail worker heartbeat visibility and stuck job recovery in the actual DigitalOcean environment.
- Storage object vs. database reconciliation after real upload failures.
- Backup/restore integrity and retention behavior on production data.

---

## 39. Recommended PR Sequence

1. `test(auth): add silent session and role-access regression coverage` (P0)
2. `test(access): add comprehensive student/teacher data-isolation regressions` (P0)
3. `test(auth): harden reset/activation token expiry boundary regressions` (P1)
4. `test(files): add pending upload and ownership transaction regressions` (P1)
5. `test(mail): add worker stuck/retry/idempotency regressions` (P1)
6. `test(audit): add sensitive-action audit-log coverage` (P2)
7. `test(status): reject invalid lifecycle status values` (P2)
8. `test(ui): add frontend silent-error regression coverage` (P2)
9. `test(backups): add backup/restore integrity regressions` (P2)

## 40. First PR Scope

**Recommended first implementation PR**:
`test(auth): add silent session and role-access regression coverage`

**Allowed**:
- Backend auth, session, and role/access security regression tests.
- Frontend ProtectedPortal and session handling tests (if the test harness supports it).
- Minor updates to this audit report for tracking.

**Strictly forbidden**:
- Any changes to production source, schema, migrations, UI, design, password policy, token expiry durations, Restore Center, TOTP, env, or deployment files.

## 41. Forbidden Scope (Entire Audit)

Any modification to:
- `backend/src/*`
- `backend/prisma/*` or migrations
- `src/app/*` or `src/styles/*`
- `.env*` files or secrets
- Deployment or infrastructure files
- UI/theme/design
- Password minimum length or reset/activation expiry logic
- Restore Center or TOTP code

## 42. Verification Commands for Future PRs

- `npm run typecheck`
- `npm run build`
- `npm run check:theme`
- `npm run check:click-targets`
- Backend: `npm run test`, `npm run test:security`
- Relevant e2e smoke and responsive tests
- Manual verification on DigitalOcean after deployment for runtime-specific issues

## 43. Final Verdict

The silent-bug audit report has been finalized. 

The single confirmed high-risk finding is the production use of a `mockAuth` abstraction. Several other high-severity test coverage gaps were identified, particularly around auth/session handling, data isolation, and background job reliability.

The report is now clean, non-duplicated, and structured for use as the source of truth for future bug-hunt implementation work. No production code was modified during the entire audit.

## 44. Next Decision Needed From User

Approve (or modify) the recommended first implementation PR:

**`test(auth): add silent session and role-access regression coverage`**

Once approved, a focused test-only PR can be created on a new branch from this audit report.