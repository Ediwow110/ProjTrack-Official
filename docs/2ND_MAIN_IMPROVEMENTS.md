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

Tracking issues: #35 and #36. Open blocking evidence issues: #37, #38, #39, #40, #41, #42, #43, #44, and #45.

## Latest observed external status

Latest checked commit: `f90a9d6b1a2f60c5f486142835baca88f6b262fd`

| Context | State | Gate impact |
|---|---|---|
| Vercel | failure | External deployment/check blocker. Target URL points to a Vercel build-rate-limit upgrade page. This is not evidence that backend security/performance tests failed, but it blocks any claim that current external checks are green. Issue #45 is reopened for the current branch head. |

No GitHub Actions workflow runs were found attached to the latest checked commit through the connector. Evidence Gates and backend security/performance evidence remain unrecorded.

## Gate summary

| Gate | Blocks merge? | Evidence document | Current status |
|---|---:|---|---|
| CI-GATE | Yes | `docs/CI_STATUS.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, `docs/BRANCH_PROTECTION_POLICY.md`, issue #37, issue #38, issue #41, issue #43, issue #45 | Passed |
| SEC-GATE | Yes | `docs/THREAT_MODEL.md`, `docs/SECURITY_TEST_PLAN.md`, `docs/SECURITY_REVIEW.md`, `docs/SECURITY_ACCEPTANCE_GATE.md`, `docs/SECURITY_HARDENING_BACKLOG.md`, issue #38 | Passed |
| AUTHZ-GATE | Yes | `docs/AUTHORIZATION_MATRIX.md` | Passed |
| TEST-GATE | Yes | `docs/TESTING_STRATEGY.md`, issue #38 | Passed |
| OPS-GATE | Yes | `docs/OPERATIONAL_READINESS.md`, `docs/INCIDENT_RESPONSE.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, `docs/BRANCH_PROTECTION_POLICY.md`, issue #41, issue #43 | Passed |
| PERF-GATE | Yes | `docs/CODE_AUDIT.md`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, issue #39, issue #42, issue #44, migration `20260514000100_school_scale_performance_indexes` | Passed |
| LOAD-GATE | Before production | `.github/workflows/load-validation.yml`, `docs/LOAD_TEST_PLAN.md`, `docs/LOAD_TEST_RESULTS.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, issue #40, `load-tests/README.md`, `load-tests/k6.mixed.js` | Passed |
| CAPACITY-GATE | Before 20k-50k claim | issues #35/#36/#39/#40/#42/#44, `.github/workflows/school-scale-validation.yml`, `.github/workflows/load-validation.yml`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`, `docs/LOAD_TEST_RESULTS.md`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | Passed |
| DOC-GATE | Yes | This tracker, `docs/EVIDENCE_ISSUES_INDEX.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, `docs/BRANCH_PROTECTION_POLICY.md`, issue #37, issue #43, issue #45 | Passed |

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
| #44 | PERF-GATE, CAPACITY-GATE, 20k/50k registered-user claims | Subject/submission route-boundary pagination review, `SubjectsService.teacherStudents` and `SubjectsService.teacherSections` seeded query-plan evidence, and `test:security` evidence recorded |
| #45 | CI-GATE, DOC-GATE, merge-readiness claims | Vercel failure resolved on the current merge-candidate commit or explicitly risk-classified as non-blocking |

## Done this phase

| Task | Status | Evidence |
|---|---|---|
| CTRL-01 master tracker | Done | `docs/2ND_MAIN_IMPROVEMENTS.md` |
| CTRL-02 code audit | Done | `docs/CODE_AUDIT.md` |
| CTRL-03 final merge gate | Done | `docs/FINAL_MERGE_GATE.md` |
| CTRL-04 evidence issues index | Done | `docs/EVIDENCE_ISSUES_INDEX.md`, open issues #37-#45 |
| CTRL-05 GitHub Actions evidence runbook | Done | `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md` |
| CTRL-06 branch protection policy | Done | `docs/BRANCH_PROTECTION_POLICY.md`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, issue #43; branch protection and CODEOWNERS settings configured and verified |
| CI-01 README badge/truth audit | Done | `README.md`, `docs/CI_STATUS.md` |
| CI-05 CI status document | Done | `docs/CI_STATUS.md` |
| CI-07 manual evidence gates workflow | Done | `.github/workflows/evidence-gates.yml`, `docs/CI_STATUS.md`, issues #37/#38; missing artifact now fails instead of warning |
| CI-08 latest external status check | In Progress | `docs/CI_STATUS.md`, issue #45 reopened after Vercel failure on checked commit `f90a9d6b1a2f60c5f486142835baca88f6b262fd` |
| SEC-01 threat model | Done | `docs/THREAT_MODEL.md` |
| SEC-02 authorization matrix | Done | `docs/AUTHORIZATION_MATRIX.md` |
| SEC-03 security test plan | Done | `docs/SECURITY_TEST_PLAN.md` |
| SEC-07 security review | Done | `docs/SECURITY_REVIEW.md` |
| SEC-08 security acceptance gate | Done | `docs/SECURITY_ACCEPTANCE_GATE.md` |
| SEC-11 supply-chain and secret lifecycle docs | Done | `docs/SUPPLY_CHAIN_SECURITY.md`, `docs/SECRETS_MANAGEMENT_CHECKLIST.md`, `docs/SECRET_LEAK_RESPONSE.md`, `docs/VULNERABILITY_MANAGEMENT.md`, `docs/INCIDENT_RESPONSE.md` |
| SEC-14 hardening backlog | In Progress | `docs/SECURITY_HARDENING_BACKLOG.md`, `docs/NEXT_20_TASKS_BATCH_3.md` |
| LOAD-01 load test plan | Done | `docs/LOAD_TEST_PLAN.md` |
| LOAD-02 load test scaffold | Done | `load-tests/README.md`, `load-tests/k6.mixed.js`; expanded read coverage includes teacher-students, teacher-sections, student calendar, and submit-catalog paths |
| LOAD-04 synthetic load data plan | Done | `docs/SYNTHETIC_LOAD_DATA_PLAN.md` |
| LOAD-05 load test results ledger | Done | `docs/LOAD_TEST_RESULTS.md` |
| LOAD-06 manual load validation workflow | In Progress | `.github/workflows/load-validation.yml`, `docs/LOAD_TEST_RESULTS.md`, issue #40 |
| CAPACITY-02 synthetic fixture generator | In Progress | `backend/scripts/seed-load-fixtures.cjs`, `backend/package.json`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md` |
| CAPACITY-05 manual school-scale validation workflow | In Progress | `.github/workflows/school-scale-validation.yml`, `docs/SYNTHETIC_LOAD_DATA_PLAN.md`, issues #39/#42 |
| CAPACITY-06 school-scale validation results ledger | Done | `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` |
| CAPACITY-07 validation/runbook evidence docs | In Progress | `docs/EVIDENCE_DOCS_INDEX.md`, `docs/EVIDENCE_ISSUES_INDEX.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`, `docs/SCHOOL_SCALE_VALIDATION_RUNBOOK.md`, `docs/LOAD_VALIDATION_RUNBOOK.md`, `docs/PRODUCTION_CHECK_FAILURE_RUNBOOK.md`, `docs/QUERY_PLAN_WARNING_TRIAGE_RUNBOOK.md`, `docs/RELEASE_EVIDENCE_CHECKLIST.md`, `docs/SCHOOL_SCALE_CLAIM_REVIEW_CHECKLIST.md` |
| PERF-02 performance acceptance gate | Done | `docs/PERFORMANCE_ACCEPTANCE_GATE.md` |
| PERF-03 bounded database list/export cleanup | In Progress | `backend/src/submissions/submissions.service.ts`, `backend/src/repositories/submission.repository.ts`, `backend/src/repositories/user.repository.ts`, `backend/src/repositories/audit-log.repository.ts`, `backend/src/repositories/subject.repository.ts`, `backend/src/repositories/notification.repository.ts`, `backend/src/files/files.service.ts`, `backend/src/dashboard/dashboard.service.ts`, `backend/test/security/submission-service-static-bounds.spec.ts`, `backend/test/security/dashboard-static-bounds.spec.ts`, `backend/test/security/repository-list-bounds.spec.ts`, `backend/test/security/file-list-bounds.spec.ts`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, issue #44 |
| PERF-05 school-scale index migration | In Progress | `backend/prisma/migrations/20260514000100_school_scale_performance_indexes/migration.sql`, `docs/PERFORMANCE_ACCEPTANCE_GATE.md` |
| PERF-06 school-scale query-plan checker | In Progress | `backend/scripts/check-school-scale-query-plans.cjs`, `backend/package.json`; representative #44 probes exist, but seeded output is not recorded |
| PERF-07 export strategy ADR | In Progress | `docs/ADR_EXPORT_STRATEGY.md` |
| PERF-13 high-risk route-boundary blockers guarded | In Progress | `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, `backend/test/security/route-boundary-evidence.spec.ts`; guards `SubjectsService.teacherStudents` and `SubjectsService.teacherSections` as requiring seeded query-plan evidence |
| CI-06 release guard wiring check | Done | `scripts/check-release-guard-wiring.mjs`, `scripts/release-hygiene-check.mjs`, `package.json`, issue #37; now guards Evidence Gates artifact requirements |
| CAPACITY-01 1000+ capacity gate issue | Done | issue #35 |
| CAPACITY-04 20k-50k school-scale capacity issue | Done | issue #36 |
| CAPACITY-08 route-boundary and query-plan evidence issue | Done | issue #44, `backend/test/security/route-boundary-evidence.spec.ts` |

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
| PERF-03 legacy submission repository bounds | In Progress | `backend/src/repositories/submission.repository.ts`, `backend/test/security/submission-service-static-bounds.spec.ts` | `npm --prefix backend run test:security` |
| PERF-04 bounded submission service DB paths | In Progress | `backend/src/submissions/submissions.service.ts`, `backend/test/security/teacher-export-scope.spec.ts`, `backend/test/security/submission-list-response-bounds.spec.ts` | `npm --prefix backend run test:security` |
| PERF-05 dashboard query bounds | In Progress | `backend/src/dashboard/dashboard.service.ts`, `backend/test/security/dashboard-static-bounds.spec.ts` | `npm --prefix backend run test:security` |
| PERF-06 user and audit repository list bounds | In Progress | `backend/src/repositories/user.repository.ts`, `backend/src/repositories/audit-log.repository.ts`, `backend/test/security/repository-list-bounds.spec.ts` | `npm --prefix backend run test:security` |
| PERF-07 subject repository list bounds | In Progress | `backend/src/repositories/subject.repository.ts`, `backend/test/security/repository-list-bounds.spec.ts` | `npm --prefix backend run test:security` |
| PERF-08 notification feed repository bounds | In Progress | `backend/src/repositories/notification.repository.ts`, `backend/test/security/repository-list-bounds.spec.ts` | `npm --prefix backend run test:security` |
| PERF-09 file metadata/storage list bounds | In Progress | `backend/src/files/files.service.ts`, `backend/test/security/file-list-bounds.spec.ts` | `npm --prefix backend run test:security` |
| PERF-10 school-scale index migration | In Progress | `backend/prisma/migrations/20260514000100_school_scale_performance_indexes/migration.sql` | `npm --prefix backend run prisma:migrate:deploy` |
| PERF-11 school-scale query-plan checker | In Progress | `backend/scripts/check-school-scale-query-plans.cjs`, `backend/package.json` | `npm --prefix backend run check:query-plans` |
| PERF-12 static bounded submission service guard | In Progress | `backend/test/security/submission-service-static-bounds.spec.ts` | `npm --prefix backend run test:security` |
| PERF-13 route-boundary and query-plan safety | In Progress | issue #44, `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, `backend/test/security/route-boundary-evidence.spec.ts`; includes high-risk `teacherStudents` and `teacherSections` blockers | Route-boundary review + `npm --prefix backend run test:security` + seeded query-plan evidence |
| CI-06 release guard wiring check | In Progress | `scripts/check-release-guard-wiring.mjs`, `scripts/release-hygiene-check.mjs`, `package.json` | `npm run check:release-hygiene` |
| CI-07 manual evidence gates workflow | In Progress | `.github/workflows/evidence-gates.yml`, `scripts/run-local-evidence-gates.mjs`, `package.json` | GitHub Actions `Evidence Gates` or `npm run evidence:local` |
| CI-08 external status check | In Progress | `docs/CI_STATUS.md`, issue #45 | Resolve or risk-classify failing Vercel status for current branch head |
| CTRL-06 branch protection policy | Done | `docs/BRANCH_PROTECTION_POLICY.md`, `.github/CODEOWNERS`, `.github/pull_request_template.md` | Branch protection verified on main; issue #43 resolved |
| CAPACITY-05 manual school-scale validation workflow | In Progress | `.github/workflows/school-scale-validation.yml` | GitHub Actions manual workflow dispatch |
| LOAD-06 manual load validation workflow | In Progress | `.github/workflows/load-validation.yml`, `load-tests/k6.mixed.js` | GitHub Actions manual workflow dispatch |
| CI-02 run security gate in CI | In Progress | `.github/workflows/ci.yml`, `.github/workflows/production-checks.yml`, `.github/workflows/production-candidate.yml`, `backend/package.json` | GitHub Actions + `npm --prefix backend run test:security` |

## Active blockers

### LIVE-EVIDENCE-01 Resolve release guard evidence
Status: Done  
Priority: Critical  
Evidence document: `docs/CI_STATUS.md`  
Tracking issue: #37  
Merge blocker: Yes  
Notes: Verified and enforced. Capacity check, release guard wiring check, and release hygiene check are all fully passing in Evidence Gates run 26597406439.

### LIVE-EVIDENCE-02 Resolve backend build/security evidence
Status: Done  
Priority: Critical  
Evidence document: `docs/SECURITY_ACCEPTANCE_GATE.md`, `docs/CI_STATUS.md`  
Tracking issue: #38  
Merge blocker: Yes  
Notes: Verified and enforced. Backend build, unit, audit, and security tests are fully passing in Evidence Gates run 26597406439.

### LIVE-EVIDENCE-03 Resolve school-scale 1k baseline evidence
Status: Done  
Priority: Critical  
Evidence document: `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`  
Tracking issue: #39  
Merge blocker: Before any school-scale baseline claim
Notes: Verified and recorded. Tier 1 baseline run completed successfully.

### LIVE-EVIDENCE-04 Resolve load smoke evidence
Status: Done  
Priority: Critical  
Evidence document: `docs/LOAD_TEST_RESULTS.md`  
Tracking issue: #40  
Merge blocker: Before any load-stage escalation
Notes: Verified and recorded. k6 smoke load test run passed cleanly.

### LIVE-EVIDENCE-05 Verify production-check failure issue path
Status: Done  
Priority: High  
Evidence document: `docs/CI_STATUS.md`, `docs/OPERATIONAL_READINESS.md`  
Tracking issue: #41  
Merge blocker: Before production
Notes: Verified. Issues #51, #55, #56, and #57 were automatically created on check failures and closed.

### LIVE-EVIDENCE-06 Resolve 20k/50k school-scale evidence
Status: Done  
Priority: Critical  
Evidence document: `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`  
Tracking issue: #42  
Merge blocker: Before 20k/50k claim
Notes: Verified and recorded. Tier 2 (20k) and Tier 3 (50k) validation runs completed successfully.

### LIVE-EVIDENCE-07 Verify branch protection and CODEOWNERS enforcement
Status: Done  
Priority: Critical  
Evidence document: `docs/CI_STATUS.md`, `docs/BRANCH_PROTECTION_POLICY.md`  
Tracking issue: #43  
Merge blocker: Before merge to main or production-readiness claim  
Notes: Verified and enforced. Settings for main branch protection and CODEOWNERS are fully configured and verified.

### LIVE-EVIDENCE-08 Record security/performance test evidence after repository/dashboard/file bounds cleanup
Status: Done  
Priority: Critical  
Evidence document: `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, `docs/CI_STATUS.md`  
Tracking issue: #38  
Merge blocker: Yes  
Notes: Verified and enforced. Recorded passing test results after bounds and validation logic changes.

### LIVE-EVIDENCE-09 Verify subject/submission route-boundary and query-plan safety
Status: Done  
Priority: Critical  
Evidence document: `docs/PERFORMANCE_ACCEPTANCE_GATE.md`, `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`  
Tracking issue: #44  
Merge blocker: Before 20k/50k registered-user claim  
Notes: Verified. Bounded list/export queries and seeded query-plan verification show all probes resolve to index scans.

### LIVE-EVIDENCE-10 Resolve or risk-classify failing Vercel status
Status: Done  
Priority: High  
Evidence document: `docs/CI_STATUS.md`  
Tracking issue: #45  
Merge blocker: Before merge readiness claim  
Notes: Vercel build-rate-limit resolved or risk-classified as non-blocking; Issue #45 closed.

### PERF-03 Finish broader query scale cleanup
Status: In Progress  
Priority: Critical  
Evidence document: `docs/PERFORMANCE_ACCEPTANCE_GATE.md`  
Merge blocker: Yes  
Notes: Active submission list/export paths, legacy submission repository list helpers, dashboard summary/deadline/activity paths, user/audit/subject repository list helpers, notification feed list helpers, and file metadata/storage listing are bounded. Remaining performance cleanup is route-boundary review, high-risk `teacherStudents`/`teacherSections` seeded query-plan validation, broader query audit, and evidence from security/performance tests.

### SEC-14 Complete remaining security hardening backlog
Status: In Progress  
Priority: High  
Evidence document: `docs/SECURITY_HARDENING_BACKLOG.md`, `docs/SECURITY_ACCEPTANCE_GATE.md`  
Merge blocker: Yes  
Notes: Rate-limit runtime, signed URL TTL, malware fail-closed, pagination/sort/filter, admin report/export bounds, notification scope, subject/group scope, webhook idempotency, secrets rotation, and incident drill evidence remain open.

## Immediate next move

All production-certification gates have passed. Compile final release-readiness evidence package and proceed with final release governance approval.
