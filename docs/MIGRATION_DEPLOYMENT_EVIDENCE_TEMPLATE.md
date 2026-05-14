# Migration Deployment Evidence Template

Branch: `2nd-main`  
Last updated: 2026-05-14

## Purpose

Use this template after running migration deployment commands or the school-scale validation workflow.

## Command

```bash
npm --prefix backend run prisma:migrate:deploy
```

## Evidence template

```text
Date:
Commit SHA:
Environment:
Command or workflow:
Workflow run URL:
Database target:
Migration status: passed/failed
Applied migrations:
School-scale index migration applied: yes/no
Duration:
Error output if failed:
Rollback needed: yes/no
Owner:
Follow-up:
```

## Required checks

- [ ] Command executed against intended environment.
- [ ] Migration output captured.
- [ ] School-scale performance index migration status confirmed.
- [ ] Failure, if any, recorded in `docs/CI_STATUS.md` or `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`.
- [ ] Production migration failures follow incident/rollback process.

## Related files

- `backend/prisma/migrations/20260514000100_school_scale_performance_indexes/migration.sql`
- `docs/PERFORMANCE_ACCEPTANCE_GATE.md`
- `docs/SCHOOL_SCALE_VALIDATION_RESULTS.md`
- `docs/MIGRATION_SAFETY_CHECKLIST.md`
