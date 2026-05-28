# Threat Model

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

This threat model turns the 2nd-main hardening plan into security work that can be tested. It identifies assets, actors, trust boundaries, entry points, abuse cases, STRIDE risks, mitigations, and open risks.

## Current verdict

Security is not complete. This document is the starting model for `SEC-GATE`; it must be paired with abuse tests, authorization tests, secrets handling, storage hardening, and CI evidence.

## Assets

| Asset | Sensitivity | Security requirement |
|---|---:|---|
| User accounts | Critical | Protect credentials, sessions, reset/activation flows, role integrity |
| Student data | Critical | Student self-access only except authorized teachers/admins |
| Teacher data | High | Teacher self/admin access only |
| Admin data/actions | Critical | Strict admin-only access; audit all destructive/system actions |
| Projects/tasks/submissions | Critical | Owner/scope isolation; prevent cross-user/class access |
| Files/uploads | Critical | Ownership checks, safe storage, signed URL control, MIME/size validation |
| Refresh tokens | Critical | Rotation, expiry, reuse detection, logout invalidation |
| JWT access secrets | Critical | Never commit/log/expose; fail fast if weak/missing |
| Database | Critical | Least privilege, migration safety, no leaked URLs/secrets |
| Object storage | Critical | Private bucket, short signed URL TTL, no local prod storage |
| Mail/invite/reset tokens | Critical | Single-use, short expiry, no enumeration |
| Backups | Critical | Access-controlled, encrypted or provider-protected, restore-tested |
| CI/CD secrets | Critical | Minimal permissions, protected environments, secret scanning |
| Audit logs | High | Tamper-resistant enough for incident response; no secrets logged |

## Actors

| Actor | Description | Risk |
|---|---|---:|
| Anonymous user | No valid authentication | Brute force, enumeration, public endpoint abuse |
| Student | Authenticated student | Cross-student data access, submission/file tampering |
| Teacher | Authenticated teacher | Access to unrelated class/section/submission data |
| Admin | Authenticated admin | Powerful legitimate actor; accidental/destructive misuse |
| Compromised account | Valid token or credentials stolen | Lateral movement, data theft, destructive operations |
| Leaked-token attacker | Access/refresh/reset/activation token leaked | Session takeover, password reset abuse |
| Bot/abusive client | Automated traffic source | Credential stuffing, upload abuse, search/report load abuse |
| Malicious insider | Authorized user abusing privileges | Data export, settings changes, audit log gaps |
| CI secret attacker | Pull request or workflow compromise | Secret exfiltration, supply-chain compromise |
| Storage attacker | Attempts direct object access or signed URL replay | File disclosure |

## Trust boundaries

| Boundary | Crosses from | Crosses to | Primary risks |
|---|---|---|---|
| Browser to API | User-controlled client | NestJS backend | Tampering, auth bypass, CSRF-like assumptions, input abuse |
| API to database | Backend service | PostgreSQL | Injection via unsafe query construction, overbroad data access |
| API to object storage | Backend service | S3-compatible storage/local storage | File disclosure, unsafe upload/download, signed URL replay |
| API to mail provider | Backend service | External mail provider | Token leakage, provider failure, no timeout |
| API to workers | Request path | Background worker | Unbounded heavy work, retry storms, missing job audit |
| GitHub Actions to secrets | CI workflow | GitHub secrets/environment | Secret exposure, broad permissions, unsafe triggers |
| Public health endpoints | Internet | operational readiness data | Config/secrets leakage, dependency fingerprinting |
| Admin tooling | Admin UI/API | system tools/backups/import/export | destructive action abuse, artifact path exposure |

## Entry points

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/activate`
- `POST /auth/activate/validate`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- Student routes under `/student/**`
- Teacher routes under `/teacher/**`
- Admin routes under `/admin/**`
- File routes under `/files/**`
- Health routes under `/health/**`
- Mail/webhook routes
- Monitoring routes
- Backup/system-tool routes
- CI workflows and dependency installation

## Abuse cases

| Abuse case | Target | Expected control | Required test/evidence |
|---|---|---|---|
| Cross-user student data access | Student routes/submissions/files | Owner checks using token user ID | Student A cannot read/edit Student B data |
| Teacher accesses unrelated section/class | Teacher routes/submissions/files | Teacher scope checks | Teacher cannot access unrelated class/section |
| Normal user calls admin route | `/admin/**` | `JwtAuthGuard` + `@Roles('ADMIN')` | student/teacher -> 403 |
| Request body sets `role=ADMIN` | Profile/admin/user mutations | DTO allowlist + service ignore/reject | Mass-assignment tests |
| Stolen refresh token reused | `/auth/refresh` | Rotation/reuse detection/logout invalidation | Refresh reuse test |
| Expired reset/activation token used | Auth action endpoints | Short expiry, single-use | Expiry/single-use tests |
| Account enumeration | Login/forgot/reset | Generic responses/timing-safe behavior where practical | Enumeration tests |
| Brute force login/reset | Auth endpoints | Rate limits and logs | Rate-limit tests |
| Malware/dangerous file upload | File upload endpoints | MIME/ext allowlist, size limits, malware policy | Upload security tests |
| Oversized file upload | File upload endpoints | File size cap | Upload limit tests |
| Signed URL replay/guessing | File download/meta | Ownership check before signing; short TTL | Wrong owner file access test |
| Unbounded dashboard/report query | Dashboard/admin reports | Pagination/bounded queries/indexes | Performance audit |
| CI secret leak via workflow | GitHub Actions | minimal permissions, protected envs, secret scan | Supply-chain review |
| Unsafe migration destroys data | Prisma migrations | migration safety checklist/rollback | Migration checklist |
| Health/config leaks secrets | `/health/**` | redaction/admin-only sensitive endpoints | Health response audit |
| Admin downloads arbitrary artifact path | admin system tools/artifacts | path allowlist/sandboxing | Path traversal test |

## STRIDE analysis

### Spoofing

Risks:

- Forged/expired access tokens accepted.
- Refresh token replay after logout/rotation.
- Role in token diverges from current database role.

Existing/observed controls:

- `JwtAuthGuard` verifies access token type, active user status, and role consistency with database user before assigning `request.user`.

Required controls:

- Auth/session abuse tests.
- Refresh token reuse detection test.
- Disabled/deactivated user token rejection test.

### Tampering

Risks:

- User changes `userId`, `ownerId`, `role`, `status`, `uploadedByUserId`, or scope fields in request body.
- Admin/system tool artifact path tampering.
- File scope/storedName path tampering.

Required controls:

- DTO allowlists and ValidationPipe unknown-field rejection.
- Service-level ownership based only on token identity.
- Path normalization and allowlisting for file/system artifacts.
- Mass-assignment tests.

### Repudiation

Risks:

- Admin destructive changes lack actor, IP, user-agent, or request ID.
- File uploads/downloads and failed auth actions not logged.

Existing/observed controls:

- Several admin controller methods pass actor context containing user ID/email/role/IP/user agent into services.

Required controls:

- Security logging for login, logout, refresh reuse, reset actions, role changes, admin actions, uploads/downloads, unauthorized access, rate limits, and runtime config failures.
- Request ID included in logs and safe error responses.

### Information disclosure

Risks:

- Cross-user data access.
- Health/config/database endpoint leaking secrets.
- Signed URL leakage.
- Error responses exposing stack traces/provider errors.
- Logs containing passwords/tokens/API keys.

Required controls:

- Authorization matrix tests.
- Health response redaction audit.
- Stable error format with request ID and no raw internals.
- Log redaction.

### Denial of service

Risks:

- Login brute force.
- Upload floods.
- Large base64 uploads.
- Unbounded admin reports/exports/dashboard queries.
- External service calls without timeouts.
- Worker retry storms.

Required controls:

- Rate limits for login, refresh, reset, upload, search, report generation, email resend, invite creation, admin actions.
- Pagination maximums and bounded includes.
- External service timeouts.
- Load test plan and scripts.

### Elevation of privilege

Risks:

- User sets role/status fields in request body.
- Missing `@Roles` on sensitive routes.
- Service trusts client-supplied IDs instead of token identity.
- Teacher accesses unrelated classes/sections.
- Student accesses another student's submissions/files.

Required controls:

- Complete authorization matrix.
- Route coverage tests for anonymous/wrong-role/wrong-owner/correct-owner/admin cases.
- Service-level ownership and scope proof.

## High-risk flows

### Auth/session flow

Endpoints:

- `/auth/login`
- `/auth/refresh`
- `/auth/logout`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/activate`

Required evidence:

- Wrong password test
- Disabled user test
- Expired access token test
- Expired refresh token test
- Refresh reuse test
- Logout invalidation test
- Reset token expiry/single-use test
- Account enumeration test
- Login rate-limit test

### Student/teacher submission flow

Endpoints:

- `/student/submissions/**`
- `/teacher/submissions/**`

Required evidence:

- Student A cannot read Student B submission.
- Teacher cannot read/review unrelated submission.
- User ID for submit comes from token, not body.
- Export is scoped and bounded.

### File upload/download flow

Endpoints:

- `/files/upload`
- `/files/upload-base64`
- `/files/submission/:submissionId`
- `/files/meta/:scope/:storedName`
- `/files/download/:scope/:storedName`
- `/files/:scope/:storedName`

Required evidence:

- MIME allowlist test
- Size limit test
- Dangerous extension test
- Wrong-owner metadata/download test
- Signed URL TTL documented/testable
- Local storage rejected in production

### Admin/system tools flow

Endpoints:

- `/admin/system-tools/**`
- `/admin/settings/**`
- `/admin/users/**`
- `/admin/audit-logs/**`
- `/admin/reports/**`

Required evidence:

- Non-admin receives 403.
- Admin actions logged with actor context.
- Artifact download cannot path traverse.
- Report/export routes bounded or explicitly accepted with load/perf evidence.

### CI/CD supply-chain flow

Entry points:

- GitHub Actions workflows
- npm install/audit
- secret scanning
- production gate workflows

Required evidence:

- Workflow permissions minimized.
- Lockfiles committed.
- Dependency audit passes or documented exceptions exist.
- Secret scan runs in CI.
- Production deployment uses protected environment if/when deployment workflow exists.

## Security acceptance gates

`SEC-GATE` cannot pass until:

- `docs/AUTHORIZATION_MATRIX.md` is complete.
- Auth/session abuse tests exist and pass.
- Authorization abuse tests exist and pass.
- File upload/storage abuse tests exist and pass.
- Secret handling checklist exists.
- Security logging evidence exists.
- Supply-chain security document exists.
- No critical/high-risk blocker remains open.

## Open risks

1. Authorization matrix is initial, not exhaustive.
2. Service-level owner/scope checks have not been fully audited.
3. Abuse tests are not yet added.
4. File upload/storage hardening has not been proven.
5. Health/config endpoint redaction has not been audited.
6. CI failure visibility is incomplete.
7. Performance/load testing does not yet prove resilience under realistic user load.
8. Admin system-tool artifact path handling needs targeted path traversal review.

## Next required implementation work

1. Add `backend/test/security/auth-abuse.spec.ts`.
2. Add `backend/test/security/session-abuse.spec.ts`.
3. Add route authorization abuse tests for high-risk admin, submission, profile, and file routes.
4. Audit services named in `docs/AUTHORIZATION_MATRIX.md` for owner/scope enforcement.
5. Add `docs/SECURITY_TEST_PLAN.md` and `docs/SECURITY_ACCEPTANCE_GATE.md`.
