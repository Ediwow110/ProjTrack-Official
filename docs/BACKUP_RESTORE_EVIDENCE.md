# Backup And Restore Evidence

Record one completed restore drill before production launch and at least once per release cycle after launch.

## Status

**BLOCKED** — Drill not yet executed. No production or staging environment is provisioned. The drill requires a running backend with a local/staging PostgreSQL instance, an existing backup artifact, and a disposable restore target database.

## Blocker Details

- No DigitalOcean Droplet or staging database is provisioned yet.
- `node backend/scripts/backup-restore-drill.mjs` is the correct command to run once a disposable restore target is available.
- The script contains a production-URL refusal guard and a disposable-target guard. It will refuse to run against a production-shaped `DATABASE_URL`.

## Next Actions (in order)

1. Provision a staging or local PostgreSQL instance (see `backend/docker-compose.postgres.yml` for a local option).
2. Run a manual backup via Admin → Backups → Run, or `POST /admin/backups/run`.
3. Download the backup artifact and note the backup ID and SHA-256.
4. Create a disposable restore target database (separate schema or fresh instance).
5. Run: `node backend/scripts/backup-restore-drill.mjs` with `DATABASE_URL` pointing to the disposable target.
6. Fill in the evidence below with real results.
7. Update `docs/PRODUCTION_READINESS_SCORECARD.md` category 10 from `Blocked` to `Partial` or `Pass`.

## Backup Capture

- Environment: _not yet run_
- Backup ID: _not yet run_
- Backup started at: _not yet run_
- Backup completed at: _not yet run_
- Backup size: _not yet run_
- Storage location: _not yet run_
- SHA-256 or provider checksum: _not yet run_
- Operator: _not yet run_

## Restore Drill

- Restore target environment: _not yet run_
- Restore command or runbook step used: `node backend/scripts/backup-restore-drill.mjs`
- Restore started at: _not yet run_
- Restore completed at: _not yet run_
- Validation query or health check: _not yet run_
- Application smoke test result: _not yet run_
- Data sampled: _not yet run_
- Data integrity notes: _not yet run_

## Decision

- Restore successful: _not yet run_
- RPO observed: _not yet run_
- RTO observed: _not yet run_
- Gaps found: _not yet run_
- Follow-up owner: _TBD_
- Next scheduled drill: _after staging environment is provisioned_
