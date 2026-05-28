# Evidence Documents Index

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

This index points reviewers to the evidence documents that determine whether `2nd-main` can be merged, released, or described as school-scale ready.

## Gate evidence map

| Gate / Claim | Evidence document | Required status |
|---|---|---|
| Final merge readiness | `docs/FINAL_MERGE_GATE.md` | All blocking checkboxes complete or risk-accepted |
| CI/build readiness | `docs/CI_STATUS.md` | Latest workflow URLs/results recorded |
| Security acceptance | `docs/SECURITY_ACCEPTANCE_GATE.md` | Tests/scans/audits pass or risks accepted |
| Security backlog | `docs/SECURITY_HARDENING_BACKLOG.md` | Open hardening items closed or risk-accepted |
| Performance acceptance | `docs/PERFORMANCE_ACCEPTANCE_GATE.md` | Active paths bounded and query evidence recorded |
| Query-bound audit | `docs/QUERY_BOUND_AUDIT_CHECKLIST.md` | High-volume route risks reviewed |
| School-scale data validation | `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md` | 1k/20k/50k workflow results recorded as needed |
| Load/concurrency validation | `docs/LOAD_TEST_RESULTS.md` | Smoke/300/500/1000/2000/soak results recorded as needed |
| Synthetic load data plan | `docs/SYNTHETIC_LOAD_DATA_PLAN.md` | Dataset tiers and generator status current |
| Load test plan | `docs/LOAD_TEST_PLAN.md` | Load stages, thresholds, and scripts current |
| Operational readiness | `docs/OPERATIONAL_READINESS.md` | Drills, monitoring, failure visibility recorded |
| Evidence update process | `docs/EVIDENCE_UPDATE_CHECKLIST.md` | Used after every run |
| GitHub Actions execution | `docs/GITHUB_ACTIONS_EVIDENCE_RUNBOOK.md` | Manual workflow execution steps followed |
| Evidence issues | `docs/EVIDENCE_ISSUES_INDEX.md` | Blocking issues #37-#42 resolved only with recorded evidence |
| Claim wording | `docs/CAPACITY_CLAIM_WORDING_GUIDE.md` | Public wording must comply |
| Operational assumptions | `docs/SCHOOL_SCALE_OPERATIONAL_ASSUMPTIONS.md` | Claim assumptions documented |

## Executable guardrails

| Guardrail | Command / file | Purpose |
|---|---|---|
| Capacity claim check | `npm run check:capacity-claims` | Blocks unsupported scale/readiness claims |
| Release hygiene | `npm run check:release-hygiene` | Blocks release artifacts/secrets and runs claim checks |
| Release guard wiring | `npm run check:release-guard-wiring` | Ensures claim checker remains wired into release hygiene |
| Local evidence runner | `npm run evidence:local` | Produces local report for issues #37 and #38 |
| Evidence Gates workflow | `.github/workflows/evidence-gates.yml` | Produces CI artifact for issues #37 and #38 |
| Backend security tests | `npm --prefix backend run test:security` | Security regression suite |
| Query-plan checker | `npm --prefix backend run check:query-plans` | Representative DB query-plan validation |
| School-scale workflow | `.github/workflows/school-scale-validation.yml` | Data-volume + migration + query-plan evidence |
| Load workflow | `.github/workflows/load-validation.yml` | Runtime concurrency evidence |

## Required execution order for school-scale claims

1. Run `Evidence Gates` or `npm run evidence:local`.
2. Record issue #37 and #38 evidence in `docs/CI_STATUS.md` and `docs/SECURITY_ACCEPTANCE_GATE.md`.
3. Run `School Scale Validation` tier `1k`.
4. Record result in `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.
5. Run `Load Validation` smoke.
6. Record result in `docs/LOAD_TEST_RESULTS.md`.
7. Run `School Scale Validation` tier `20k`.
8. Record result.
9. Run target load stages and record results.
10. Only then consider any 20k registered-user claim.
11. Run `School Scale Validation` tier `50k` before any 50k registered-user claim.

## Current status

The evidence system exists, but the result ledgers are still empty. Claims remain blocked until passing results are recorded.
