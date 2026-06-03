# PROJTRACK

[![CI](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/ci.yml?query=branch%3Amain)
[![Production Checks](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/production-checks.yml/badge.svg?branch=main)](https://github.com/Ediwow110/ProjTrack-Official/actions/workflows/production-checks.yml?query=branch%3Amain)

PROJTRACK uses a React frontend and a NestJS + Prisma backend backed by PostgreSQL.

## Current branch status

`main` is the active branch. All PR-based changes (CI, security, test, performance, operations) are verified via CI gates before merge. Historical hardening work on `2nd-main` has been merged into `main` through a series of verified PRs. Evidence docs under `docs/` document the verification status.

## Evidence documents

- `docs/2ND_MAIN_IMPROVEMENTS.md` — branch tracker and task evidence
- `docs/CODE_AUDIT.md` — code audit map for bootstrap, CI/CD, security, authorization, testing, storage, database, performance, operations, and documentation
- `docs/CI_STATUS.md` — CI workflow status and verification commands
- `docs/FINAL_MERGE_GATE.md` — historical checklist for the `2nd-main` → `main` merge (now complete)

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

## Merge workflow

All changes are made via pull requests into `main`.

- PRs must pass required CI checks before merge.
- Merge requires explicit user authorization.
- Admin merge (`--admin`) is used only when branch protection blocks a user-authorized, green PR.
- Post-merge verification (`git pull --ff-only`, status check, test run) is required before starting the next phase.
- Local helper artifacts should be archived outside the repo, not deleted blindly.
