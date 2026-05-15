# 2nd-Main Branch Improvement Tracker

Branch target: `2nd-main`  
Plan version: ProjTrack 2nd-Main Updated Full Master Improvement Plan v2.0  
Last updated: 2026-05-15

## Non-negotiable execution rule

All hardening work happens on `2nd-main`. Do not merge to `main` until `docs/FINAL_MERGE_GATE.md` is complete and every blocking gate is verified.

## Evidence rule

A task is not done because a file exists. A task is done only when code or documentation exists on `2nd-main`, the related test or verification command passes, and the evidence is recorded here or in the linked evidence document.

## School-scale capacity rule

The target is now school-scale: 20,000 to 50,000 registered users.

Do not confuse registered users with concurrent users:

- 20k-50k registered users requires synthetic fixture data, bounded database queries, index/slow-query evidence, and data-volume validation evidence.
- 1000+ concurrent active users requires passing load-test evidence, database connection headroom, memory stability, and slow-query review.
- 20k-50k concurrent active users is not claimed and would require a separate architecture program.

Tracking issues: #35 and #36. Blocking evidence issues: #37, #38, #39, #40, #41, #42, and #43.

## Gate summary

| Gate | Blocks merge? | Evidence document | Current status |
|---|---:|---|---|
| CI-GATE | Yes | `docs/CI_STATUS.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, `docs/BRANCH_PROTECTION_POLICY.md`, issue #37, issue #38, issue #41, issue #43 | Blocked |
| SEC-GATE | Yes | `docs/THREAT_MODEL.md`, `docs/SECURITY_TEST_PLAN.md`, `docs/SECURITY_REVIEW.md`, `docs/SECURITY_ACCEPTANCE_GATE.md`, `docs/SECURITY_HARDENING_BACKLOG.md`, issue #38 | Blocked |
| AUTHZ-GATE | Yes | `docs/AUTHORIZATION_MATRIX.md` | In Progress |
| TEST-GATE | Yes | `docs/TESTING_STRATEGY.md`, issue #38 | Blocked |
| OPS-GATE | Yes | `docs/OPERATIONAL_READINESS.md`, `docs/INCIDENT_RESPONSE.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, `docs/BRANCH_PROTECTION_POLICY.md`, issue #41, issue #43 | Blocked |
| PERF-GATE | Yes | `docs/CODE_AUDIT.md`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, issue #39, issue #42, migration `20260514000100_school_scale_performance_indexes` | Blocked |
| LOAD-GATE | Before production | `.github/workflows/load-validation.yml`, `docs/LOAD_TEST_PLAN.md`, `docs/LOAD_TEST_RESULTS.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, issue #40, `load-tests/README.md`, `load-tests/k6.mixed.js` | Blocked |
| CAPACITY-GATE | Before 20k-50k claim | issues #35/#36/#39/#40/#42, `.github/workflows/school-scale-validation.yml`, `.github/workflows/load-validation.yml`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`, `docs/LOAD_TEST_RESULTS.md`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | Blocked |
| DOC-GATE | Yes | This tracker, `docs/EVIDENCE_ISSUES_INDEX.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, `docs/BRANCH_PROTECTION_POLICY.md`, issue #37, issue #43 | Blocked |

## Blocking evidence issues

| Issue | Blocks | Required evidence |
|---:|---|---|
| #37 | CI-GATE, DOC-GATE, capacity/readiness claims | `Evidence Gates` artifact or `npm run evidence:local` report with capacity/release guard results recorded |
| #38 | SEC-GATE, TEST-GATE, CI-GATE | `Evidence Gates` artifact or `npm run evidence:local` report with backend build/security/unit/scan/audit evidence recorded |
| #39 | PERF-GATE, CAPACITY-GATE baseline | `School Scale Validation` tier `1k` result recorded |
| #40 | LOAD-GATE baseline | `Load Validation` smoke result recorded |
| #41 | OPS-GATE, CI-GATE | production-check failure issue creation live-verified |
| #42 | 20k/50k registered-user claims | `School Scale Validation` tier `20k` and `50k` results recorded |
| #43 | CI-GATE, DOC-GATE, production-readiness claims | branch protection and CODEOWNERS enforcement verified |

## Done this phase

| Task | Status | Evidence |
|---|---|---|
| CTRL-01 master tracker | Done | `docs/2ND_MAIN_IMPROVEMENTS.md` |
| CTRL-02 code audit | Done | `docs/CODE_AUDIT.md` |
| CTRL-03 final merge gate | Done | `docs/FINAL_MERGE_GATE.md` |
| CTRL-04 evidence issues index | Done | `docs/EVIDENCE_ISSUES_INDEX.md`, issues #37-#43 |
| CTRL-05 GitHub Actions evidence runbook | Done | `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md` |
| CTRL-06 branch protection policy | Done | `docs/BRANCH_PROTECTION_POLICY.md`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, issue #43 |
| CI-01 README badge/truth audit | Done | `README.md`, `docs/CI_STATUS.md` |
| CI-05 CI status document | Done | `docs/CI_STATUS.md` |
| CI-07 manual evidence gates workflow | In Progress | `.github/workflows/evidence-gates.yml`, `docs/CI_STATUS.md`, issues #37/#38 |
| SEC-01 threat model | Done | `docs/THREAT_MODEL.md` |
| SEC-02 authorization matrix | Done | `docs/AUTHORIZATION_MATRIX.md` |
| SEC-03 security test plan | Done | `docs/SECURITY_TEST_PLAN.md` |
| SEC-07 security review | Done | `docs/SECURITY_REVIEW.md` |
| SEC-08 security acceptance gate | Done | `docs/SECURITY_ACCEPTANCE_GATE.md` |
| SEC-11 supply-chain and secret lifecycle docs | Done | `docs/SUPPLY_CHAIN_SECURITY.md`, `docs/SECRETS_MANAGEMENT_CHECKLIST.md`, `docs/SECRET_LEAK_RESPONSE.md`, `docs/VULNERABILITY_MANAGEMENT.md`, `docs/INCIDENT_RESPONSE.md` |
| SEC-14 hardening backlog | In Progress | `docs/SECURITY_HARDENING_BACKLOG.md`, `docs/NEXT_20_TASKS_BATCH_3.md` |
| LOAD-01 load test plan | Done | `docs/LOAD_TEST_PLAN.md` |
| LOAD-02 load test scaffold | Done | `load-tests/README.md`, `load-tests/k6.mixed.js` |
| LOAD-04 synthetic load data plan | Done | `docs/SYNTHETIC_LOAD_DATA_PLAN.md` |
| LOAD-05 load test results ledger | Done | `docs/LOAD_TEST_RESULTS.md` |
| LOAD-06 manual load validation workflow | In Progress | `.github/workflows/load-validation.yml`, `docs/LOAD_TEST_RESULTS.md`, issue #40 |
| CAPACITY-02 synthetic fixture generator | In Progress | `backend/scripts/seed-load-fixtures.cjs`, `backend/package.json`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md` |
| CAPACITY-05 manual school-scale validation workflow | In Progress | `.github/workflows/school-scale-validation.yml`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md`, issues #39/#42 |
| CAPACITY-06 school-scale validation results ledger | Done | `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` |
| CAPACITY-07 validation/runbook evidence docs | In Progress | `docs/EVIDENCE_DOCS_INDEX.md`, `docs/EVIDENCE_ISSUES_INDEX.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, `docs/SCHOOL_SCALE_VALIDATION_RUNBOOK.md`, `docs/LOAD_VALIDATION_RUNBOOK.md`, `docs/PRODUCTION_CHECK_FAILURE_RUNBOOK.md`, `docs/QUERY_PLAN_WARNING_TRIAGE_RUNBOOK.md`, `docs/RELEASE_EVIDENCE_CHECKLIST.md`, `docs/SCHOOL_SCALE_CLAIM_REVIEW_CHECKLIST.md` |
| PERF-02 performance acceptance gate | Done | `docs/PERFORMANCE_ACCEPTANCE_GATE.md` |
| PERF-05 school-scale index migration | In Progress | `backend/prisma/migrations/20260514000100_school_scale_performance_indexes/migration.sql`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` |
| PERF-06 school-scale query-plan checker | In Progress | `backend/scripts/check-school-scale-query-plans.cjs`, `backend/package.json` |
| PERF-07 export strategy ADR | In Progress | `docs/ADR_EXPORT_STRATEGY.md` |
| CI-06 release guard wiring check | In Progress | `scripts/check-release-guard-wiring.mjs`, `scripts/release-hygiene-check.mjs`, `package.json`, issue #37 |
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
| SEC-14 hardening backlog | In Progress | `docs/SECURITY_HARDENING_BACKLOG.md`, `docs/SECURITY_ACCEPTANCE_GATE.md`, `docs/NEXT_20_TASKS_BATCH_3.md` | `npm --prefix backend run test:security` + scan/audit evidence |
| PERF-01 unbounded query audit | In Progress | `backend/test/security/performance-bounds.spec.ts`, `backend/test/security/submission-list-response-bounds.spec.ts`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | `npm --prefix backend run test:security` |
| PERF-04 bounded submission service DB paths | In Progress | `backend/src/submissions/submissions.service.ts`, `backend/test/security/teacher-export-scope.spec.ts`, `backend/test/security/submission-list-response-bounds.spec.ts` | `npm --prefix backend run test:security` |
| PERF-05 school-scale index migration | In Progress | `backend/prisma/migrations/20260514000100_school_scale_performance_indexes/migration.sql` | `npm --prefix backend run prisma:migrate:deploy` |
| PERF-06 school-scale query-plan checker | In Progress | `backend/scripts/check-school-scale-query-plans.cjs`, `backend/package.json` | `npm --prefix backend run check:query-plans` |
| PERF-08 static bounded submission service guard | In Progress | `backend/test/security/submission-service-static-bounds.spec.ts` | `npm --prefix backend run test:security` |
| CI-06 release guard wiring check | In Progress | `scripts/check-release-guard-wiring.mjs`, `scripts/release-hygiene-check.mjs`, `package.json` | `npm run check:release-hygiene` |
| CI-07 manual evidence gates workflow | In Progress | `.github/workflows/evidence-gates.yml`, `scripts/run-local-evidence-gates.mjs`, `package.json` | GitHub Actions `Evidence Gates` or `npm run evidence:local` |
| CTRL-06 branch protection policy | In Progress | `docs/BRANCH_PROTECTION_POLICY.md`, `.github/CODEOWNERS`, `.github/pull_request_template.md` | GitHub repository settings verification, issue #43 |
| CAPACITY-05 manual school-scale validation workflow | In Progress | `.github/workflows/school-scale-validation.yml` | GitHub Actions manual workflow dispatch |
| LOAD-06 manual load validation workflow | In Progress | `.github/workflows/load-validation.yml`, `load-tests/k6.mixed.js` | GitHub Actions manual workflow dispatch |
| CI-02 run security gate in CI | In Progress | `.github/workflows/ci.yml`, `.github/workflows/production-checks.yml`, `.github/workflows/production-candidate.yml`, `backend/package.json` | GitHub Actions + `npm --prefix backend run test:security` |

## Active blockers

### LIVE-EVIDENCE-01 Resolve release guard evidence
Status: Not Started  
Priority: Critical  
Evidence document: `docs/CI_STATUS.md`  
Tracking issue: #37  
Merge blocker: Yes  
Notes: Run GitHub Actions `Evidence Gates` or `npm run evidence:local`, then record the artifact/report.

### LIVE-EVIDENCE-02 Resolve backend build/security evidence
Status: Not Started  
Priority: Critical  
Evidence document: `docs/SECURITY_ACCEPTANCE_GATE.md`, `docs/CI_STATUS.md`  
Tracking issue: #38  
Merge blocker: Yes  
Notes: Run GitHub Actions `Evidence Gates` or `npm run evidence:local`, then record the artifact/report.

### LIVE-EVIDENCE-03 Resolve school-scale 1k baseline evidence
Status: Not Started  
Priority: Critical  
Evidence document: `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`  
Tracking issue: #39  
Merge blocker: Before any school-scale baseline claim

### LIVE-EVIDENCE-04 Resolve load smoke evidence
Status: Not Started  
Priority: Critical  
Evidence document: `docs/LOAD_TEST_RESULTS.md`  
Tracking issue: #40  
Merge blocker: Before any load-stage escalation

### LIVE-EVIDENCE-05 Verify production-check failure issue path
Status: Not Started  
Priority: High  
Evidence document: `docs/CI_STATUS.md`, `docs/OPERATIONAL_READINESS.md`  
Tracking issue: #41  
Merge blocker: Before production

### LIVE-EVIDENCE-06 Resolve 20k/50k school-scale evidence
Status: Not Started  
Priority: Critical  
Evidence document: `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`  
Tracking issue: #42  
Merge blocker: Before 20k/50k claim

### LIVE-EVIDENCE-07 Verify branch protection and CODEOWNERS enforcement
Status: Not Started  
Priority: Critical  
Evidence document: `docs/CI_STATUS.md`, `docs/BRANCH_PROTECTION_POLICY.md`  
Tracking issue: #43  
Merge blocker: Before merge to main or production-readiness claim  
Notes: Configure and verify GitHub repository settings for required PRs, Code Owner review, required checks, stale approval dismissal, branch up-to-date requirement, conversation resolution, and force-push/deletion restrictions.

### PERF-03 Finish bounded database list/export cleanup
Status: In Progress  
Priority: Critical  
Evidence document: `docs/PERFORMANCE_ACCEPTANCE_GATE.md`  
Merge blocker: Yes  
Notes: Issue #34 is substantially mitigated on active service paths: student list, teacher list, and teacher export now use bounded Prisma queries directly. Remaining work is cleanup: legacy repository list methods still contain unbounded behavior and should be bounded or removed to prevent future misuse.

### SEC-14 Complete remaining security hardening backlog
Status: In Progress  
Priority: High  
Evidence document: `docs/SECURITY_HARDENING_BACKLOG.md`, `docs/SECURITY_ACCEPTANCE_GATE.md`  
Merge blocker: Yes  
Notes: Rate-limit runtime, signed URL TTL, malware fail-closed, pagination/sort/filter, admin report/export bounds, notification scope, subject/group scope, webhook idempotency, secrets rotation, and incident drill evidence remain open.

## Immediate next move

Run GitHub Actions `Evidence Gates` or `npm run evidence:local` to resolve issues #37 and #38 first, verify branch protection/CODEOWNERS settings through issue #43, then run issue #39 baseline school-scale validation and issue #40 load smoke validation. Do not claim 20k-50k school-scale support until issue #42 is resolved with recorded evidence.
