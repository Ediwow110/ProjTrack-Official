# PROJTRACK

[![CI](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/ci.yml/badge.svg?branch=2nd-main)](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/ci.yml?query=branch%3A2nd-main)
[![Production Checks](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/production-checks.yml/badge.svg?branch=2nd-main)](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/production-checks.yml?query=branch%3A2nd-main)

PROJTRACK uses a React frontend and a NestJS + Prisma backend backed by PostgreSQL.

## Current branch status

The `2nd-main` branch is the active hardening branch. It is not production-certified yet. Production readiness must be proven by the evidence docs under `docs/`, passing CI/security/test/operations/performance/load gates, and the final checklist in `docs/FINAL_MERGE_GATE.md`.

## Evidence documents

- `docs/2ND_MAIN_IMPROVEMENTS.md` — branch tracker and task evidence
- `docs/CODE_AUDIT.md` — code audit map for bootstrap, CI/CD, security, authorization, testing, storage, database, performance, operations, and documentation
- `docs/CI_STATUS.md` — CI workflow status and verification commands
- `docs/FINAL_MERGE_GATE.md` — required checklist before merge to `main`

## Local verification commands

```bash
npm ci
npm run typecheck
npm run build
npm run security:secrets
npm run security:audit
npm --prefix backend ci
npm --prefix backend run prisma:validate
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix backend run test
npm --prefix backend run test:unit
```

## Merge rule

Do not merge `2nd-main` into `main` until every blocking gate in `docs/FINAL_MERGE_GATE.md` is complete and backed by reproducible evidence.
