# 2nd-Main Branch Improvement Tracker

Branch target: `2nd-main`  
Plan version: ProjTrack 2nd-Main Updated Full Master Improvement Plan v2.0  
Last updated: 2026-05-14

## Non-negotiable execution rule

All hardening work happens on `2nd-main`. Do not merge to `main` until `docs/FINAL_MERGE_GATE.md` is complete and every blocking gate is verified.

## Evidence rule

A task is not done because a file exists. A task is done only when code or documentation exists on `2nd-main`, the related test or verification command passes, and the evidence is recorded here or in the linked evidence document.

## School-scale capacity rule

The target is now school-scale: 20,000 to 50,000 registered users.

Do not confuse registered users with concurrent users:

- 20k-50k registered users requires synthetic fixture data, bounded database queries, index/slow-query evidence, and data-volume load evidence.
- 1000+ concurrent active users requires passing load-test evidence, database connection headroom, memory stability, and slow-query review.
- 20k-50k concurrent active users is not claimed and would require a separate architecture program.

Tracking issues: #35 and #36.

## Gate summary

| Gate | Blocks merge? | Evidence document | Current status |
|---|---:|---|---|
| CI-GATE | Yes | `docs/CI_STATUS.md` | In Progress |
| SEC-GATE | Yes | `docs/THREAT_MODEL.md`, `docs/SECURITY_TEST_PLAN.md`, `docs/SECURITY_REVIEW.md`, `docs/SECURITY_ACCEPTANCE_GATE.md` | In Progress |
| AUTHZ-GATE | Yes | `docs/AUTHORIZATION_MATRIX.md` | In Progress |
| TEST-GATE | Yes | `docs/TESTING_STRATEGY.md` | In Progress |
| OPS-GATE | Yes | `docs/OPERATIONAL_READINESS.md`, `docs/INCIDENT_RESPONSE.md` | In Progress |
| PERF-GATE | Yes | `docs/CODE_AUDIT.md`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | In Progress |
| LOAD-GATE | Before production | `docs/LOAD_TEST_PLAN.md`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md`, `load-tests/README.md`, `load-tests/k6.mixed.js` | In Progress |
| CAPACITY-GATE | Before 20k-50k claim | issues #35/#36, `docs/LOAD_TEST_PLAN.md`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | Blocked |
| DOC-GATE | Yes | This tracker and final docs | In Progress |

## Done this phase

| Task | Status | Evidence |
|---|---|---|
| CTRL-01 master tracker | Done | `docs/2ND_MAIN_IMPROVEMENTS.md` |
| CTRL-02 code audit | Done | `docs/CODE_AUDIT.md` |
| CTRL-03 final merge gate | Done | `docs/FINAL_MERGE_GATE.md` |
| CI-01 README badge/truth audit | Done | `README.md`, `docs/CI_STATUS.md` |
| CI-05 CI status document | Done | `docs/CI_STATUS.md` |
| SEC-01 threat model | Done | `docs/THREAT_MODEL.md` |
| SEC-02 authorization matrix | Done | `docs/AUTHORIZATION_MATRIX.md` |
| SEC-03 security test plan | Done | `docs/SECURITY_TEST_PLAN.md` |
| SEC-07 security review | Done | `docs/SECURITY_REVIEW.md` |
| SEC-08 security acceptance gate | Done | `docs/SECURITY_ACCEPTANCE_GATE.md` |
| SEC-11 supply-chain and secret lifecycle docs | Done | `docs/SUPPLY_CHAIN_SECURITY.md`, `docs/SECRETS_MANAGEMENT_CHECKLIST.md`, `docs/SECRET_LEAK_RESPONSE.md`, `docs/VULNERABILITY_MANAGEMENT.md`, `docs/INCIDENT_RESPONSE.md` |
| LOAD-01 load test plan | Done | `docs/LOAD_TEST_PLAN.md` |
| LOAD-02 load test scaffold | Done | `load-tests/README.md`, `load-tests/k6.mixed.js` |
| LOAD-04 synthetic load data plan | Done | `docs/SYNTHETIC_LOAD_DATA_PLAN.md` |
| CAPACITY-02 synthetic fixture generator | In Progress | `backend/scripts/seed-load-fixtures.cjs`, `backend/package.json`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md` |
| PERF-02 performance acceptance gate | Done | `docs/PERFORMANCE_ACCEPTANCE_GATE.md` |
| CAPACITY-01 1000+ capacity gate issue | Done | issue #35 |
| CAPACITY-04 20k-50k school-scale capacity issue | Done | issue #36 |

## Executable security/test progress

| Task | Status | Files | Verification |
|---|---|---|---|
| SEC-03 auth/session abuse tests | In Progress | `backend/jest.security.config.cjs`, `backend/package.json`, `backend/test/security/auth-abuse.spec.ts`, `backend/test/security/session-abuse.spec.ts` | `npm --prefix backend run test:security` |
| SEC-04 authorization abuse tests | In Progress | `backend/test/security/authorization-abuse.spec.ts`, `backend/test/security/service-authorization-abuse.spec.ts`, `backend/test/security/admin-runtime-authorization.spec.ts`, `backend/test/security/teacher-export-scope.spec.ts` | `npm --prefix backend run test:security` |
| SEC-05 input hardening tests | In Progress | `backend/test/security/input-hardening.spec.ts` | `npm --prefix backend run test:security` |
| SEC-06 file/storage tests | In Progress | `backend/test/security/file-access-abuse.spec.ts` | `npm --prefix backend run test:security` |
| SEC-09 health/config redaction tests | In Progress | `backend/test/security/health-redaction.spec.ts` | `npm --prefix backend run test:security` |
| SEC-10 service-level owner/scope authorization | In Progress | `backend/test/security/service-authorization-abuse.spec.ts`, `backend/test/security/teacher-export-scope.spec.ts` | `npm --prefix backend run test:security` |
| SEC-12 webhook abuse tests | In Progress | `backend/test/security/webhook-abuse.spec.ts` | `npm --prefix backend run test:security` |
| PERF-01 unbounded query audit | In Progress | `backend/test/security/performance-bounds.spec.ts`, `backend/test/security/submission-list-response-bounds.spec.ts`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | `npm --prefix backend run test:security` |
| PERF-04 service-layer submission response caps | In Progress | `backend/src/submissions/submissions.service.ts`, `backend/test/security/teacher-export-scope.spec.ts`, `backend/test/security/submission-list-response-bounds.spec.ts` | `npm --prefix backend run test:security` |
| CI-02 run security gate in CI | In Progress | `.github/workflows/ci.yml`, `.github/workflows/production-checks.yml`, `.github/workflows/production-candidate.yml`, `backend/package.json` | GitHub Actions + `npm --prefix backend run test:security` |

## Active blockers

### PERF-03 Fix bounded database list/export blockers
Status: In Progress  
Priority: Critical  
Evidence document: `docs/PERFORMANCE_ACCEPTANCE_GATE.md`  
Merge blocker: Yes  
Notes: Issue #34. Service-layer response caps are implemented for student lists, teacher lists, and teacher exports. This does not close the issue: `SubmissionRepository.listStudentSubmissions`, `listTeacherSubmissions`, and the teacher export repository path still need database-level pagination or bounded query strategy.

### CAPACITY-02 Validate synthetic fixture generator
Status: In Progress  
Priority: Critical  
Evidence document: `docs/SYNTHETIC_LOAD_DATA_PLAN.md`  
Merge blocker: Before 20k-50k claim  
Notes: `backend/scripts/seed-load-fixtures.cjs` and `npm --prefix backend run seed:load` exist. Need disposable DB dry runs for 1k, 20k, and 50k tiers.

### CAPACITY-03 Execute staged capacity evidence runs
Status: Not Started  
Priority: Critical  
Verification command: `k6 run -e VUS=1000 -e DURATION=20m load-tests/k6.mixed.js` after #34 and synthetic fixtures are validated  
Evidence document: `docs/LOAD_TEST_PLAN.md`, issues #35/#36  
Merge blocker: Before 20k-50k claim

### LIVE-EVIDENCE-01 Record live command/CI results
Status: Not Started  
Priority: Critical  
Verification command: `npm --prefix backend run test:security`, `npm run security:secrets`, `npm run security:audit`, `npm --prefix backend run build`  
Evidence document: `docs/CI_STATUS.md`, `docs/SECURITY_ACCEPTANCE_GATE.md`  
Merge blocker: Yes  
Notes: Tests and gates exist, but passing run evidence is not recorded.

### CI-04 Add production-gate notification routing
Status: In Progress  
Priority: High  
Evidence document: `docs/CI_STATUS.md`  
Merge blocker: Before production  
Notes: Basic GitHub workflow summaries exist. Production notification routing/owner escalation still missing.

### SEC-13 Remaining security hardening tests
Status: Not Started  
Priority: High  
Verification command: `npm --prefix backend run test:security`  
Evidence document: `docs/SECURITY_ACCEPTANCE_GATE.md`  
Merge blocker: Yes  
Notes: Rate-limit runtime, signed URL TTL, malware fail-closed, pagination/sort/filter, admin report/export bounds, notification scope, and subject/group scope tests remain open.

## Immediate next move

Finish issue #34 at the repository/database layer. Service-layer caps are only a defensive stopgap; they do not prove 20k-50k readiness. After DB-level bounds land, validate the synthetic dataset generator with disposable 1k/20k/50k database runs and run staged load tests.
