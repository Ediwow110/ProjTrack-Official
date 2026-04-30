# PostgreSQL / Prisma Cutover

The source runtime is now Prisma/PostgreSQL-backed, and migration history is checked in under `backend/prisma/migrations`.

## Current state

- `DATABASE_URL` is required at startup.
- Core backend flows read and write through Prisma repositories/services.
- The local migrated database is reachable and ready for role-based login once operator-managed accounts are provisioned.
- `/health/database` now checks connectivity plus migration-table state and currently reports `ok: true` locally.
- The checked-in migrations include:
  - `20260422013000_initial_schema`
  - `20260422014500_profile_fields`

## Deploy-safe flow

1. `npm ci`
2. `npm run prisma:generate`
3. `npm run prisma:migrate:deploy`
4. `npm run build`
5. `npm run smoke`

## Remaining operational validation

1. Validate `prisma migrate deploy` against a fresh PostgreSQL staging database, not only the existing local database.
2. Keep automatic demo/sample data seeding disabled in production.
3. Reconcile any schema drift discovered by staging or production-like environments.

## Still outside the cutover

- Production mail delivery and retry handling
- Browser E2E coverage
