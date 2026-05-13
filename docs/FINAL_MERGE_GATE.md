# Final Merge Gate

Branch under review: `2nd-main`  
Target branch after approval: `main`  
Last updated: 2026-05-14

## Merge rule

Do not merge `2nd-main` into `main` until every blocking gate below is checked and backed by reproducible evidence.

## CI-GATE

- [ ] `ci.yml` passing on `2nd-main`
- [ ] `production-checks.yml` passing or intentionally scoped with documented reason
- [ ] `production-candidate.yml` reviewed
- [ ] Failure visibility configured
- [ ] Verification commands recorded in `docs/CI_STATUS.md`

Evidence: `docs/CI_STATUS.md`

## SEC-GATE

- [ ] Threat model complete
- [ ] Security review complete
- [ ] Security regression tests passing
- [ ] Secret scan passing
- [ ] Dependency audit passing or exceptions documented
- [ ] No critical/high security risks open

Evidence:

- `docs/THREAT_MODEL.md`
- `docs/SECURITY_REVIEW.md`
- `docs/SECURITY_TEST_PLAN.md`
- `docs/SECURITY_ACCEPTANCE_GATE.md`
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

Evidence: `docs/AUTHORIZATION_MATRIX.md`

## TEST-GATE

- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Critical auth/authorization paths tested
- [ ] Coverage generated

Evidence: `docs/TESTING_STRATEGY.md`

## OPS-GATE

- [ ] `/health/live` verified
- [ ] `/health/ready` verified
- [ ] Sensitive health endpoints protected
- [ ] Migration checklist complete
- [ ] Rollback strategy complete
- [ ] Monitoring/alerts documented

Evidence:

- `docs/OPERATIONAL_READINESS.md`
- `docs/MIGRATION_SAFETY_CHECKLIST.md`
- `docs/ROLLBACK_STRATEGY.md`

## PERF-GATE

- [ ] No unbounded list queries
- [ ] No unreviewed database queries inside loops
- [ ] Indexes match common query patterns
- [ ] Heavy tasks moved to workers or explicitly accepted
- [ ] External calls have timeouts
- [ ] Expensive routes rate-limited

Evidence:

- `docs/CODE_AUDIT.md`
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`

## LOAD-GATE

- [ ] Load test plan exists
- [ ] Realistic flows tested
- [ ] 300-user test passes or blocker recorded
- [ ] 500-user test attempted and documented
- [ ] p95/error/memory targets documented

Evidence:

- `docs/LOAD_TEST_PLAN.md`
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `load-tests/**`

## DOC-GATE

- [ ] README claims match reality
- [ ] `docs/2ND_MAIN_IMPROVEMENTS.md` updated
- [ ] `docs/CODE_AUDIT.md` complete
- [ ] `docs/SECURITY_REVIEW.md` complete
- [ ] `docs/TESTING_STRATEGY.md` complete
- [ ] `docs/OPERATIONAL_READINESS.md` complete

Evidence: repository documentation on `2nd-main`

## Current verdict

Not mergeable. The control documents now exist, but security, authorization, operations, performance, and load evidence are not complete yet.
