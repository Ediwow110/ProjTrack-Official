# Next 20 Tasks

Branch: `2nd-main`  
Last updated: 2026-05-14

## Rule

A task is only `Done` when the repo contains the change or the evidence is recorded. Tasks that require GitHub Actions runs, secrets, deployed databases, or k6 target environments must be marked `Blocked` until evidence exists.

## Batch 1: School-scale evidence and release honesty

| # | Task | Status | Evidence / Notes |
|---:|---|---|---|
| 1 | Add 20-task execution tracker | Done | `docs/NEXT_20_TASKS.md` |
| 2 | Add school-scale validation workflow | Done | `.github/workflows/school-scale-validation.yml` |
| 3 | Add load-validation workflow | Done | `.github/workflows/load-validation.yml` |
| 4 | Add school-scale validation results ledger | Done | `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` |
| 5 | Add load-test results ledger | Done | `docs/LOAD_TEST_RESULTS.md` |
| 6 | Add unsupported capacity-claim checker | Done | `scripts/capacity-claim-check.mjs` |
| 7 | Wire capacity-claim checker into release hygiene | Done | `scripts/release-hygiene-check.mjs` |
| 8 | Expose capacity-claim checker as npm script | Done | `package.json`, `npm run check:capacity-claims` |
| 9 | Add production-check failure issue creation | Done | `.github/workflows/production-checks.yml` |
| 10 | Record production-check failure issue path in CI docs | Done | `docs/CI_STATUS.md` |
| 11 | Run capacity claim check locally/CI | Blocked | Requires command run evidence |
| 12 | Run release hygiene locally/CI | Blocked | Requires command run evidence |
| 13 | Run `School Scale Validation` tier `1k` | Blocked | Requires GitHub Actions run |
| 14 | Record tier `1k` validation result | Blocked | Requires workflow URL/result |
| 15 | Run `School Scale Validation` tier `20k` | Blocked | Requires tier `1k` result first |
| 16 | Record tier `20k` validation result | Blocked | Requires workflow URL/result |
| 17 | Run `Load Validation` smoke: 10 VU / 5m | Blocked | Requires load tokens and target API |
| 18 | Record smoke load result | Blocked | Requires workflow URL/result |
| 19 | Run backend security tests | Blocked | Requires CI/local command evidence |
| 20 | Record backend security/build evidence | Blocked | Requires command output or workflow URLs |

## Current verdict

This batch created the infrastructure needed to prove or reject school-scale claims. It did not prove 20k-50k support because the validation and load workflows have not been run and recorded.

## Immediate execution order

1. Run `npm run check:capacity-claims`.
2. Run `npm run check:release-hygiene`.
3. Run GitHub Actions `School Scale Validation` with `tier=1k`.
4. Record the result in `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.
5. Run GitHub Actions `Load Validation` with `vus=10`, `duration=5m`.
6. Record the result in `docs/LOAD_TEST_RESULTS.md`.

## Hard no

Do not claim school-scale, 20k-50k support, 1000+ concurrency, or production readiness until the appropriate evidence documents contain passing results.
