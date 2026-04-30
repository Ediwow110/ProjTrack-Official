# Local PostgreSQL Setup

This batch adds a ready-to-run local Postgres setup for the backend.

## Files added
- `docker-compose.postgres.yml`
- package scripts:
  - `npm run db:up`
  - `npm run db:down`
  - `npm run prisma:generate`
  - `npm run prisma:migrate:dev`
  - `npm run prisma:migrate:deploy`

## Suggested local workflow
1. Copy `.env.example` to `.env`
2. Start Postgres:
   - `npm run db:up`
3. Generate Prisma client:
   - `npm run prisma:generate`
4. Apply local migrations:
   - `npm run prisma:migrate:dev`

## Notes
- This is the bridge toward the real Prisma/PostgreSQL cutover.
- The project still supports prototype/file-backed mode, but this setup makes DB-backed testing easier.
