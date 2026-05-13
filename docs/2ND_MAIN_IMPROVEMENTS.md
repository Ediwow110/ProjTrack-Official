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

### CTRL-02 Create code audit
Status: Done  
Priority: Critical  
Files changed: `docs/CODE_AUDIT.md`  
Verification command: `test -f docs/CODE_AUDIT.md`  
Evidence document: `docs/CODE_AUDIT.md`  
Merge blocker: Yes

### CTRL-03 Create final gate checklist
Status: Done  
Priority: Critical  
Files changed: `docs/FINAL_MERGE_GATE.md`  
Verification command: `test -f docs/FINAL_MERGE_GATE.md`  
Evidence document: `docs/FINAL_MERGE_GATE.md`  
Merge blocker: Yes

### CI-01 Verify README workflow badges
Status: Done  
Priority: Critical  
Files changed: `README.md`, `docs/CI_STATUS.md`  
Verification command: `grep -q 'branch=2nd-main' README.md`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes

### CI-05 Create CI status document
Status: Done  
Priority: Critical  
Files changed: `docs/CI_STATUS.md`  
Verification command: `test -f docs/CI_STATUS.md`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes  
Notes: CI status records the dedicated security test gate.

### SEC-01 Create threat model
Status: Done  
Priority: Critical  
Files changed: `docs/THREAT_MODEL.md`  
Verification command: `test -f docs/THREAT_MODEL.md`  
Evidence document: `docs/THREAT_MODEL.md`  
Merge blocker: Yes

### SEC-02 Create authorization matrix
Status: Done  
Priority: Critical  
Files inspected: auth, admin, files, submissions, profile, dashboard, health, mail, branding, admin students, subjects, backups, monitoring, notifications controllers  
Files changed: `docs/AUTHORIZATION_MATRIX.md`  
Verification command: `test -f docs/AUTHORIZATION_MATRIX.md`  
Evidence document: `docs/AUTHORIZATION_MATRIX.md`  
Merge blocker: Yes  
Notes: Matrix is broadly mapped. AUTHZ-GATE still blocked by service-level wrong-owner/wrong-scope tests.

### SEC-03 Security test plan
Status: Done  
Priority: Critical  
Files changed: `docs/SECURITY_TEST_PLAN.md`  
Verification command: `test -f docs/SECURITY_TEST_PLAN.md`  
Evidence document: `docs/SECURITY_TEST_PLAN.md`  
Merge blocker: Yes

### SEC-07 Security review
Status: Done  
Priority: Critical  
Files changed: `docs/SECURITY_REVIEW.md`  
Verification command: `test -f docs/SECURITY_REVIEW.md`  
Evidence document: `docs/SECURITY_REVIEW.md`  
Merge blocker: Yes  
Notes: Review is evidence-based and explicitly says SEC-GATE is not passed.

### SEC-08 Security acceptance gate
Status: Done  
Priority: Critical  
Files changed: `docs/SECURITY_ACCEPTANCE_GATE.md`  
Verification command: `test -f docs/SECURITY_ACCEPTANCE_GATE.md`  
Evidence document: `docs/SECURITY_ACCEPTANCE_GATE.md`  
Merge blocker: Yes  
Notes: Acceptance gate has pass/fail criteria and current blockers.

### DOC-01 README truth audit
Status: Done  
Priority: Critical  
Files changed: `README.md`  
Verification command: `grep -Ei "production-ready|fully secure|fully tested|complete|deployment-ready" README.md || true`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes

## Executable security/test progress

### SEC-03 Add auth/session abuse tests
Status: In Progress  
Priority: Critical  
Files changed: `backend/jest.security.config.cjs`, `backend/package.json`, `backend/test/security/auth-abuse.spec.ts`, `backend/test/security/session-abuse.spec.ts`  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/SECURITY_TEST_PLAN.md`  
Merge blocker: Yes  
Notes: Initial auth/session tests exist. Live passing evidence still required.

### SEC-04 Add authorization abuse tests
Status: In Progress  
Priority: Critical  
Files changed: `backend/test/security/authorization-abuse.spec.ts`  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/AUTHORIZATION_MATRIX.md`  
Merge blocker: Yes  
Notes: Role-metadata guardrail tests exist. Service-level wrong-owner/wrong-scope tests remain open.

### SEC-05 Validate input hardening
Status: In Progress  
Priority: Critical  
Files changed: `backend/test/security/input-hardening.spec.ts`  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/SECURITY_TEST_PLAN.md`  
Merge blocker: Yes  
Notes: Mass-assignment and production runtime config tests exist. Pagination/sort/filter/report bounds remain open.

### SEC-06 Harden S3-compatible storage/file upload
Status: In Progress  
Priority: Critical  
Files changed: `backend/test/security/file-access-abuse.spec.ts`  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/SECURITY_TEST_PLAN.md`  
Merge blocker: Yes  
Notes: Identity propagation and upload policy tests exist. Wrong-owner download and signed URL TTL tests remain open.

### SEC-09 Health/config redaction tests
Status: In Progress  
Priority: Critical  
Files changed: `backend/test/security/health-redaction.spec.ts`  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/SECURITY_TEST_PLAN.md`  
Merge blocker: Yes  
Notes: Liveness/readiness/config/database redaction tests exist. Live passing evidence still required.

### CI-02 Harden ci.yml
Status: In Progress  
Priority: Critical  
Files changed: `.github/workflows/ci.yml`, `.github/workflows/production-checks.yml`, `.github/workflows/production-candidate.yml`, `backend/package.json`  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Yes  
Notes: CI and production gate workflows run backend security tests. Live run evidence still required.

## Active blockers

### CI-04 Add CI failure visibility
Status: Not Started  
Priority: High  
Files to inspect: `.github/workflows/*.yml`  
Verification command: `grep -R "GITHUB_STEP_SUMMARY\|actions/github-script\|slack\|discord\|mail" .github/workflows`  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Before production

### SEC-10 Prove service-level owner/scope authorization
Status: Not Started  
Priority: Critical  
Files to inspect: `backend/src/submissions/**`, `backend/src/files/**`, `backend/src/subjects/**`, `backend/src/notifications/**`  
Files to change: additional `backend/test/security/*` specs and service code if tests expose gaps  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/AUTHORIZATION_MATRIX.md`  
Merge blocker: Yes  
Notes: This is the highest-risk remaining security blocker.

### SEC-11 Supply-chain and secret lifecycle docs
Status: Not Started  
Priority: Critical  
Files to change: `docs/SUPPLY_CHAIN_SECURITY.md`, `docs/SECRETS_MANAGEMENT_CHECKLIST.md`, `docs/SECRET_LEAK_RESPONSE.md`, `docs/VULNERABILITY_MANAGEMENT.md`, `docs/INCIDENT_RESPONSE.md`  
Verification command: `test -f docs/SUPPLY_CHAIN_SECURITY.md && test -f docs/SECRETS_MANAGEMENT_CHECKLIST.md`  
Evidence document: `docs/SECURITY_ACCEPTANCE_GATE.md`  
Merge blocker: Yes

### PERF-01 Audit unbounded queries
Status: Not Started  
Priority: Critical  
Files to inspect: `backend/src/**/*.service.ts`, `backend/src/**/*.controller.ts`  
Verification command: `grep -R "findMany({\|findMany()" backend/src`  
Evidence document: `docs/CODE_AUDIT.md`  
Merge blocker: Yes

### LOAD-01 Create load test plan
Status: Not Started  
Priority: High  
Files to change: `docs/LOAD_TEST_PLAN.md`  
Verification command: `test -f docs/LOAD_TEST_PLAN.md`  
Evidence document: `docs/LOAD_TEST_PLAN.md`  
Merge blocker: Before production

## Immediate next move

Create supply-chain and secret lifecycle documents, then implement service-level wrong-owner/wrong-scope authorization tests.
