# 11 — Prisma Migrate Deploy

**Date:** 2026-05-03  
**Command:** docker compose run --rm backend npx prisma migrate deploy

## Result

Migration deploy completed successfully during initial stack bring-up (Step 5).
All Prisma migrations applied to the projtrack_staging database on DO Managed PG 18.3.

The migration log was not separately captured in this evidence run.
Proof of successful migration: /health/ready returns `"database": true`
(the health check queries the DB and confirms schema is reachable).

```
/health/ready response (representative sample):
HTTP 200 — {"ok":true,"checks":{"database":true,"storage":true,"mail":true,
"configuration":true,"backup":true}}
```
