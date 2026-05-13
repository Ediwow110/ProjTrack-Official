# 2nd-Main Branch Improvement Tracker

Branch target: `2nd-main`  
Plan version: ProjTrack 2nd-Main Updated Full Master Improvement Plan v2.0  
Last updated: 2026-05-14

## Non-negotiable execution rule

All hardening work happens on `2nd-main`. Do not merge to `main` until `docs/FINAL_MERGE_GATE.md` is complete and every blocking gate is verified.

## Evidence rule

A task is not done because a file exists. A task is done only when code or documentation exists on `2nd-main`, the related test or verification command passes, and the evidence is recorded here or in the linked evidence document.

## Capacity rule

The target is now more than 1000 end users. Do not confuse registered users with concurrent users:

- 1000+ registered users requires synthetic fixture data and bounded queries.
- 1000+ concurrent active users requires passing load-test evidence, database connection headroom, memory stability, and slow-query review.

Tracking issue: #35.

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
| CAPACITY-GATE | Before 1000+ claim | issue #35, `docs/LOAD_TEST_PLAN.md`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | Blocked |
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
| PERF-01 unbounded query audit | In Progress | `backend/test/security/performance-bounds.spec.ts`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | `npm --prefix backend run test:security` |
| CI-02 run security gate in CI | In Progress | `.github/workflows/ci.yml`, `.github/workflows/production-checks.yml`, `.github/workflows/production-candidate.yml`, `backend/package.json` | GitHub Actions + `npm --prefix backend run test:security` |

## Active blockers

### PERF-03 Fix bounded list/export blockers
Status: Not Started  
Priority: Critical  
Evidence document: `docs/PERFORMANCE_ACCEPTANCE_GATE.md`  
Merge blocker: Yes  
Notes: Issue #34. `SubmissionRepository.listStudentSubmissions`, `listTeacherSubmissions`, and teacher export path are scoped but unbounded. Add pagination, export caps/queue/streaming strategy, and tests requiring bounds.

### CAPACITY-02 Validate 1000-user synthetic fixture generator
Status: In Progress  
Priority: Critical  
Evidence document: `docs/SYNTHETIC_LOAD_DATA_PLAN.md`  
Merge blocker: Before 1000+ claim  
Notes: `backend/scripts/seed-load-fixtures.cjs` and `npm --prefix backend run seed:load` exist. They still need a real dry run against a disposable database and result evidence.

### CAPACITY-03 Execute 1000+ capacity evidence runs
Status: Not Started  
Priority: Critical  
Verification command: `k6 run -e VUS=1000 -e DURATION=20m load-tests/k6.mixed.js` after #34 and synthetic fixtures are ready  
Evidence document: `docs/LOAD_TEST_PLAN.md`, issue #35  
Merge blocker: Before 1000+ claim

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

Do not scale-test unbounded code. Fix issue #34 first, then validate the synthetic dataset generator with a disposable database and run staged load tests.
