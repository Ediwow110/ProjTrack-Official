# Final Merge Gate

Branch under review: `2nd-main`  
Target branch after approval: `main`  
Last updated: 2026-05-14

## Merge rule

Do not merge `2nd-main` into `main` until every blocking gate below is checked and backed by reproducible evidence.

## Claim rule

Do not claim school-scale support, 20k-50k registered-user support, 1000+ concurrent-user support, or production readiness unless the matching evidence documents contain passing results.

- Registered-user/data-volume evidence belongs in `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.
- Runtime concurrency/load evidence belongs in `docs/LOAD_TEST_RESULTS.md`.
- CI/security/build evidence belongs in `docs/CI_STATUS.md` and `docs/SECURITY_ACCEPTANCE_GATE.md`.
- Blocking evidence issues are tracked in `docs/EVIDENCE_ISSUES_INDEX.md`.
- Manual GitHub Actions execution steps are tracked in `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`.
- Unsupported capacity/readiness claims are blocked by `scripts/capacity-claim-check.mjs`, which runs through `npm run check:release-hygiene`.
- Release evidence and claim review checklists must be used before any public readiness/capacity wording changes.

## Blocking evidence issues

The following GitHub issues are merge/claim blockers until resolved with recorded evidence:

- #37: capacity claim, release guard wiring, and release hygiene evidence.
- #38: backend build, security test, unit test, secret scan, and dependency audit evidence.
- #39: `School Scale Validation` tier `1k` evidence.
- #40: `Load Validation` smoke evidence.
- #41: production-check failure issue creation live verification.
- #42: `School Scale Validation` tier `20k` and `50k` evidence.

Evidence: `docs/EVIDENCE_ISSUES_INDEX.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`

## CI-GATE

- [ ] `ci.yml` passing on `2nd-main`
- [ ] `Evidence Gates` workflow run recorded or equivalent local evidence report recorded
- [ ] `production-checks.yml` passing or intentionally scoped with documented reason
- [ ] `production-candidate.yml` reviewed
- [ ] Failure visibility configured and live-verified
- [ ] Verification commands recorded in `docs/CI_STATUS.md`
- [ ] Issue #37 resolved with recorded command evidence
- [ ] Issue #38 resolved with recorded CI/build/security evidence
- [ ] Issue #41 resolved with production-check failure visibility evidence
- [ ] `npm run check:release-hygiene` passing, including capacity-claim and guard-wiring checks

Evidence: `docs/CI_STATUS.md`, `docs/RELEASE_EVIDENCE_CHECKLIST.md`, `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`

## SEC-GATE

- [ ] Threat model complete
- [ ] Security review complete
- [ ] Security hardening backlog reviewed
- [ ] Security regression tests passing
- [ ] Secret scan passing
- [ ] Dependency audit passing or exceptions documented
- [ ] No critical/high security risks open without explicit risk acceptance

Evidence:

- `docs/THREAT_MODEL.md`
- `docs/SECURITY_REVIEW.md`
- `docs/SECURITY_TEST_PLAN.md`
- `docs/SECURITY_ACCEPTANCE_GATE.md`
- `docs/SECURITY_HARDENING_BACKLOG.md`
- `docs/BACKEND_BUILD_SECURITY_EVIDENCE_TEMPLATE.md`
- `docs/SECRETS_MANAGEMENT_CHECKLIST.md`
- `docs/SUPPLY_CHAIN_SECURITY.md`
- `docs/VULNERABILITY_MANAGEMENT.md`

## AUTHZ-GATE

- [ ] Authorization matrix complete
- [ ] Anonymous route behavior tested
- [ ] Wrong-role behavior tested
- [ ] Wrong-owner behavior tested
- [ ] Admin-only behavior tested
- [ ] File ownership/signed URL behavior tested
- [ ] Notification owner-scope behavior tested or risk-accepted
- [ ] Subject/group scope edge cases tested or risk-accepted

Evidence: `docs/AUTHORIZATION_MATRIX.md`, `docs/SECURITY_HARDENING_BACKLOG.md`

## TEST-GATE

- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Critical auth/authorization paths tested
- [ ] Coverage generated
- [ ] Static bounded-submission service guard test included in security test evidence
- [ ] Issue #38 resolved with backend test/build evidence

Evidence: `docs/TESTING_STRATEGY.md`, `backend/test/security/submission-service-static-bounds.spec.ts`

## OPS-GATE

- [ ] `/health/live` verified
- [ ] `/health/ready` verified
- [ ] Sensitive health endpoints protected
- [ ] Migration checklist complete
- [ ] Rollback strategy complete
- [ ] Monitoring/alerts documented
- [ ] Production-check failure issue path live-verified
- [ ] Issue #41 resolved with recorded failure-visibility evidence
- [ ] Incident tabletop/drill evidence recorded
- [ ] Backup/restore drill evidence recorded or explicitly deferred with owner/date
- [ ] Correlation/request ID logging verified end-to-end

Evidence:

- `docs/OPERATIONAL_READINESS.md`
- `docs/MIGRATION_SAFETY_CHECKLIST.md`
- `docs/MIGRATION_DEPLOYMENT_EVIDENCE_TEMPLATE.md`
- `docs/ROLLBACK_STRATEGY.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/PRODUCTION_CHECK_FAILURE_RUNBOOK.md`
- `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`

## PERF-GATE

- [x] Active student submission list path is database-bounded
- [x] Active teacher submission list path is database-bounded
- [x] Active teacher export path is database-bounded and capped
- [x] School-scale performance index migration exists
- [x] Query-plan checker exists
- [x] Static guard prevents active submission service paths from returning to legacy unbounded helpers
- [ ] School-scale index migration deployment result recorded
- [ ] Query-plan checker results recorded for seeded data
- [ ] Issue #39 resolved for baseline migration/seed/query-plan evidence
- [ ] Issue #42 resolved before any 20k/50k registered-user claim
- [ ] Legacy unbounded repository list helpers removed or bounded
- [ ] No unreviewed database queries inside loops
- [ ] Indexes verified against common query patterns
- [ ] Heavy tasks moved to workers or explicitly accepted
- [ ] External calls have timeouts
- [ ] Expensive routes rate-limited
- [ ] Export strategy accepted for any exports above the current 1000-row cap

Evidence:

- `docs/CODE_AUDIT.md`
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`
- `docs/ADR_EXPORT_STRATEGY.md`
- `docs/QUERY_PLAN_WARNING_TRIAGE_RUNBOOK.md`
- `backend/test/security/submission-service-static-bounds.spec.ts`
- `backend/prisma/migrations/20260514000100_school_scale_performance_indexes/migration.sql`

## SCHOOL-SCALE DATA GATE

- [ ] Manual `School Scale Validation` workflow exists
- [ ] Tier `1k` workflow result recorded and passing
- [ ] Issue #39 resolved before any school-scale baseline claim
- [ ] Tier `20k` workflow result recorded and passing before any 20k registered-user claim
- [ ] Tier `50k` workflow result recorded and passing before any 50k registered-user claim
- [ ] Issue #42 resolved before any 20k/50k registered-user claim
- [ ] Query-plan warnings are zero or explicitly risk-accepted with mitigation
- [ ] Seed duration/resource impact is acceptable for the claimed tier
- [ ] Claim wording reviewed with `docs/SCHOOL_SCALE_CLAIM_REVIEW_CHECKLIST.md`

Evidence:

- `.github/workflows/school-scale-validation.yml`
- `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`
- `docs/SYNTHETIC_LOAD_DATA_PLAN.md`
- `docs/SCHOOL_SCALE_VALIDATION_RUNBOOK.md`
- `docs/SCHOOL_SCALE_CLAIM_REVIEW_CHECKLIST.md`
- `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`

## LOAD-GATE

- [ ] Load test plan exists
- [ ] Manual `Load Validation` workflow exists
- [ ] Realistic flows tested
- [ ] Smoke run recorded
- [ ] Issue #40 resolved before any load-stage escalation
- [ ] 300-user test passes or blocker recorded
- [ ] 500-user test attempted and documented
- [ ] 1000-user test passes before any 1000 concurrent-user claim
- [ ] 2000-user exploration documented before any higher school-scale concurrency discussion
- [ ] p95/error/memory/database-connection targets documented
- [ ] No authorization shortcuts used in accepted load evidence

Evidence:

- `.github/workflows/load-validation.yml`
- `docs/LOAD_TEST_PLAN.md`
- `docs/LOAD_TEST_RESULTS.md`
- `docs/LOAD_VALIDATION_RUNBOOK.md`
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`
- `load-tests/**`

## DOC-GATE

- [ ] README claims match reality
- [ ] Automated capacity claim check passes
- [ ] Release guard wiring check passes
- [ ] Issue #37 resolved with release guard evidence
- [ ] Release evidence checklist reviewed
- [ ] No README/product claim says 20k-50k support until school-scale evidence passes
- [ ] No README/product claim says 1000+ concurrent users until load evidence passes
- [ ] `docs/EVIDENCE_DOCS_INDEX.md` is current
- [ ] `docs/EVIDENCE_ISSUES_INDEX.md` is current
- [ ] `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md` is current
- [ ] `docs/2ND_MAIN_IMPROVEMENTS.md` updated
- [ ] `docs/CODE_AUDIT.md` complete
- [ ] `docs/SECURITY_REVIEW.md` complete
- [ ] `docs/TESTING_STRATEGY.md` complete
- [ ] `docs/OPERATIONAL_READINESS.md` complete
- [ ] `docs/SECURITY_HARDENING_BACKLOG.md` complete or explicitly risk-accepted
- [ ] `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` updated after each school-scale workflow run
- [ ] `docs/LOAD_TEST_RESULTS.md` updated after each load workflow run

Evidence:

- repository documentation on `2nd-main`
- `scripts/capacity-claim-check.mjs`
- `scripts/check-release-guard-wiring.mjs`
- `scripts/release-hygiene-check.mjs`
- `docs/EVIDENCE_DOCS_INDEX.md`
- `docs/EVIDENCE_ISSUES_INDEX.md`
- `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md`
- `docs/RELEASE_EVIDENCE_CHECKLIST.md`

## Current verdict

Not mergeable. The branch now has stronger security, performance, school-scale validation, load-validation infrastructure, operational-readiness blockers, executable guardrails, runbooks, automated claim checks, issue-level evidence tracking, and a manual GitHub Actions execution runbook, but the required passing evidence is not recorded yet.
