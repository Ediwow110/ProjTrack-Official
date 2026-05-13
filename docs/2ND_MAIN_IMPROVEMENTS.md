# 2nd-Main Branch Improvement Tracker

Branch target: `2nd-main`  
Plan version: ProjTrack 2nd-Main Updated Full Master Improvement Plan v2.0  
Last updated: 2026-05-14

## Non-negotiable execution rule

All hardening work happens on `2nd-main`. Do not merge to `main` until `docs/FINAL_MERGE_GATE.md` is complete and every blocking gate is verified.

## Evidence rule

A task is not done because a file exists. A task is done only when code or documentation exists on `2nd-main`, the related test or verification command passes, and the evidence is recorded here or in the linked evidence document.

## Gate summary

| Gate | Blocks merge? | Evidence document | Current status |
|---|---:|---|---|
| CI-GATE | Yes | `docs/CI_STATUS.md` | In Progress |
| SEC-GATE | Yes | `docs/THREAT_MODEL.md`, `docs/SECURITY_TEST_PLAN.md`, `docs/SECURITY_REVIEW.md`, `docs/SECURITY_ACCEPTANCE_GATE.md` | In Progress |
| AUTHZ-GATE | Yes | `docs/AUTHORIZATION_MATRIX.md` | In Progress |
| TEST-GATE | Yes | `docs/TESTING_STRATEGY.md` | In Progress |
| OPS-GATE | Yes | `docs/OPERATIONAL_READINESS.md` | Not Started |
| PERF-GATE | Yes | `docs/CODE_AUDIT.md`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | In Progress |
| LOAD-GATE | Before production | `docs/LOAD_TEST_PLAN.md` | Not Started |
| DOC-GATE | Yes | This tracker and final docs | In Progress |

## Completed control/documentation tasks

### CTRL-01 Create master tracker
Status: Done  
Priority: Critical  
Files changed: `docs/2ND_MAIN_IMPROVEMENTS.md`  
Verification command: `test -f docs/2ND_MAIN_IMPROVEMENTS.md`  
Evidence document: `docs/2ND_MAIN_IMPROVEMENTS.md`  
Merge blocker: Yes  
Notes: Tracker now uses evidence-based statuses.

### CTRL-02 Create code audit
Status: Done  
Priority: Critical  
Files changed: `docs/CODE_AUDIT.md`  
Verification command: `test -f docs/CODE_AUDIT.md`  
Evidence document: `docs/CODE_AUDIT.md`  
Merge blocker: Yes  
Notes: Initial audit exists; deeper service/query audit remains open.

### CTRL-03 Create final gate checklist
Status: Done  
Priority: Critical  
Files changed: `docs/FINAL_MERGE_GATE.md`  
Verification command: `test -f docs/FINAL_MERGE_GATE.md`  
Evidence document: `docs/FINAL_MERGE_GATE.md`  
Merge blocker: Yes  
Notes: Final gate checklist exists and remains intentionally unchecked.

### CI-01 Verify README workflow badges
Status: Done  
Priority: Critical  
Files changed: `README.md`, `docs/CI_STATUS.md`  
Verification command: `grep -q 'branch=2nd-main' README.md`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes  
Notes: README badges point at `2nd-main`; README avoids production-ready claims.

### CI-05 Create CI status document
Status: Done  
Priority: Critical  
Files changed: `docs/CI_STATUS.md`  
Verification command: `test -f docs/CI_STATUS.md`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes  
Notes: CI status document exists and records the dedicated security test gate.

### SEC-01 Create threat model
Status: Done  
Priority: Critical  
Files inspected: backend controllers, auth guard, file/auth/submission/profile/dashboard/health/admin routes  
Files changed: `docs/THREAT_MODEL.md`  
Verification command: `test -f docs/THREAT_MODEL.md`  
Evidence document: `docs/THREAT_MODEL.md`  
Merge blocker: Yes  
Notes: Threat model exists. SEC-GATE still blocked until full security tests and acceptance evidence exist.

### SEC-02 Create authorization matrix
Status: Done  
Priority: Critical  
Files inspected: `backend/src/auth/auth.controller.ts`, `backend/src/admin/admin.controller.ts`, `backend/src/files/files.controller.ts`, `backend/src/submissions/submissions.controller.ts`, `backend/src/profile/profile.controller.ts`, `backend/src/dashboard/dashboard.controller.ts`, `backend/src/health/health.controller.ts`, `backend/src/auth/guards/jwt-auth.guard.ts`  
Files changed: `docs/AUTHORIZATION_MATRIX.md`  
Verification command: `test -f docs/AUTHORIZATION_MATRIX.md`  
Evidence document: `docs/AUTHORIZATION_MATRIX.md`  
Merge blocker: Yes  
Notes: Initial matrix exists. AUTHZ-GATE still blocked until service-level owner/scope proof and abuse tests pass.

### SEC-03 Security test plan
Status: Done  
Priority: Critical  
Files changed: `docs/SECURITY_TEST_PLAN.md`  
Verification command: `test -f docs/SECURITY_TEST_PLAN.md`  
Evidence document: `docs/SECURITY_TEST_PLAN.md`  
Merge blocker: Yes  
Notes: Test plan exists and first executable specs are implemented.

### DOC-01 README truth audit
Status: Done  
Priority: Critical  
Files changed: `README.md`  
Verification command: `grep -Ei "production-ready|fully secure|fully tested|complete|deployment-ready" README.md || true`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes  
Notes: README states branch-hardening status instead of pretending completion.

## Executable security/test progress

### SEC-03 Add auth/session abuse tests
Status: In Progress  
Priority: Critical  
Files changed: `backend/jest.security.config.cjs`, `backend/package.json`, `backend/test/security/auth-abuse.spec.ts`, `backend/test/security/session-abuse.spec.ts`  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/SECURITY_TEST_PLAN.md`  
Merge blocker: Yes  
Notes: Initial auth/session tests exist. They need live passing evidence from CI/local run.

### SEC-04 Add authorization abuse tests
Status: In Progress  
Priority: Critical  
Files changed: `backend/test/security/authorization-abuse.spec.ts`  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/AUTHORIZATION_MATRIX.md`  
Merge blocker: Yes  
Notes: Initial role-metadata guardrail tests exist. Service-level wrong-owner/wrong-scope tests remain open.

### CI-02 Harden ci.yml
Status: In Progress  
Priority: Critical  
Files changed: `.github/workflows/ci.yml`, `.github/workflows/production-checks.yml`, `.github/workflows/production-candidate.yml`, `backend/package.json`  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes  
Notes: CI and production gate workflows now run the backend security test command. Live run evidence still required.

## Active blockers

### CI-04 Add CI failure visibility
Status: Not Started  
Priority: High  
Files to inspect: `.github/workflows/*.yml`  
Verification command: `grep -R "GITHUB_STEP_SUMMARY\|actions/github-script\|slack\|discord\|mail" .github/workflows`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Before production  
Notes: Must add workflow summaries and production-check failure notification.

### SEC-05 Validate input hardening
Status: Not Started  
Priority: Critical  
Files to inspect: DTOs, validation pipe/bootstrap, query handling  
Files to change: `backend/test/security/input-hardening.spec.ts` and affected DTO/services if tests expose gaps  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/SECURITY_TEST_PLAN.md`  
Merge blocker: Yes  
Notes: Unknown fields, pagination limits, sort/filter allowlists, and mass assignment still need tests.

### SEC-06 Harden S3-compatible storage/file upload
Status: Not Started  
Priority: Critical  
Files to inspect: `backend/src/files/**`, storage providers/config  
Files to change: `backend/test/security/file-access-abuse.spec.ts` and file/storage implementation if tests expose gaps  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/SECURITY_TEST_PLAN.md`  
Merge blocker: Yes  
Notes: File ownership, dangerous extension, MIME, size, signed URL, and local-prod behavior need proof.

### PERF-01 Audit unbounded queries
Status: Not Started  
Priority: Critical  
Files to inspect: `backend/src/**/*.service.ts`, `backend/src/**/*.controller.ts`  
Verification command: `grep -R "findMany({\|findMany()" backend/src`  
Evidence document: `docs/CODE_AUDIT.md`  
Merge blocker: Yes  
Notes: No load/scale claim is valid until complete.

### LOAD-01 Create load test plan
Status: Not Started  
Priority: High  
Files to change: `docs/LOAD_TEST_PLAN.md`  
Verification command: `test -f docs/LOAD_TEST_PLAN.md`  
Evidence document: `docs/LOAD_TEST_PLAN.md`  
Merge blocker: Before production  
Notes: Do not claim 300-500 online users until realistic load tests exist.

## Immediate next move

Add `backend/test/security/file-access-abuse.spec.ts`, `backend/test/security/input-hardening.spec.ts`, and `backend/test/security/health-redaction.spec.ts`, then record live `test:security` results.
