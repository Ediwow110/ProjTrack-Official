# Backup and Restore Runbook (Canonical)

This runbook is the single source of truth for backup and restore operations in ProjTrack production. It links to detailed sub-runbooks for each area and describes how the pieces fit together.

In-app restore is intentionally not implemented. All production restores are operator-driven via `pg_dump`/`psql` using a disposable target first. See [Restore](#restore) below.

## Quick reference

| Area | Document | Purpose |
|------|----------|---------|
| In-app backup operations | [`BACKUP_RUNBOOK.md`](../BACKUP_RUNBOOK.md) | Manual/automatic backup via `BackupRun`, download, validate, delete, retention |
| Pre-deployment backup | [`PRODUCTION_CUTOVER_RUNBOOK.md`](./PRODUCTION_CUTOVER_RUNBOOK.md#6-pre-deploy-db-backup) | pg_dump before each deploy, shipped to S3 with SHA-256 |
| Restore from pre-deploy backup | [`PRODUCTION_ROLLBACK_RUNBOOK.md`](./PRODUCTION_ROLLBACK_RUNBOOK.md#5-db-restore-strategy-when-forward-fix-is-not-safe) | pg_dump/psql restore via disposable target |
| Forward-fix (preferred) | [`PRODUCTION_ROLLBACK_RUNBOOK.md`](./PRODUCTION_ROLLBACK_RUNBOOK.md#4-db-forward-fix-strategy-preferred) | Corrective Prisma migration instead of restore |

## Architecture summary

The backup system has two layers:

**Layer 1 — In-app backup (artifact management).**
The backend creates `BackupRun` records via `POST /admin/backups/run` (manual) or the backup worker (automatic). Each backup produces a JSON artifact stored locally under `BACKUP_LOCAL_DIR`, along with a manifest and `sha256` checksum. Retention is governed by `BACKUP_RETENTION_DAYS` and `BACKUP_RETENTION_COUNT`. PostgreSQL advisory locks prevent duplicate automatic runs.

This layer handles creation, validation, download, protect/unprotect, and soft-delete of backup artifacts. It does **not** perform database-level dumps or S3 uploads. See [`BACKUP_RUNBOOK.md`](../BACKUP_RUNBOOK.md) for full detail.

**Layer 2 — Operator-driven DB dump and restore.**
Before every production deployment, the operator runs `pg_dump` (see cutover runbook §6) and ships the compressed dump to `s3://${PROD_BACKUP_BUCKET}/pre-deploy/` with a SHA-256 sidecar. If restore is needed, the operator pulls the verified dump into a disposable database, validates it, and promotes only after dual sign-off (see rollback runbook §5).

This layer handles point-in-time recovery. It does **not** interact with the in-app backup artifacts.

## Backup workflow (production)

1. In-app backups run on the backup worker process according to the admin schedule (or on demand). These produce JSON artifacts for record-keeping and point-in-time reference.
2. Before each deployment, the operator takes a full `pg_dump`, compresses it, computes `sha256`, ships off-host to S3 with SSE-AES256, and verifies the object exists.

Both layers are independent. The in-app artifact is not used for DB restore; the pre-deploy dump is not managed by the in-app retention system.

## Restore workflow (production)

See [`PRODUCTION_ROLLBACK_RUNBOOK.md`](./PRODUCTION_ROLLBACK_RUNBOOK.md):

- **§4 — DB forward-fix strategy (preferred).** Author a corrective Prisma migration instead of restoring.
- **§5 — DB restore strategy (when forward-fix is not safe).** Pull the verified pre-deploy dump, restore to a disposable target, boot a validation container, promote only after SRE+DBA dual sign-off.

All restore steps are operator-driven. The in-app restore endpoint is intentionally not implemented.

## Environment variables

Only placeholder names are listed here. Actual values are managed in the production secret manager.

| Variable | Purpose |
|----------|---------|
| `BACKUP_STORAGE` | Storage provider (`local` for now; `gdrive` and `s3` reserved) |
| `BACKUP_LOCAL_DIR` | Local directory for in-app backup artifacts |
| `BACKUP_WORKER_ENABLED` | Whether this process runs the backup worker |
| `BACKUP_SCHEDULE_ENABLED` | Whether the admin schedule is active |
| `BACKUP_DEFAULT_FREQUENCY` | Default schedule frequency |
| `BACKUP_DEFAULT_TIME` | Default backup time |
| `BACKUP_TIMEZONE` | Timezone for backup schedule |
| `BACKUP_RETENTION_DAYS` | Max age before automatic deletion |
| `BACKUP_RETENTION_COUNT` | Max backup count before automatic deletion |
| `BACKUP_WORKER_POLL_MS` | Worker poll interval |
| `PROD_BACKUP_BUCKET` | S3 bucket for pre-deploy dumps |
| `DATABASE_URL` | Production database connection string (read-only for dump) |

## Current status

- **In-app backup:** Active. Worker runs on a dedicated process. Retention and validation are operational.
- **Pre-deploy backup:** Active. Executed by the operator before every production deployment per the cutover runbook.
- **Restore drill (staging):** Staging environment is not provisioned at this time. No automated restore drill exists. See `docs/` for historical manual drills if available.
- **Restore drill (production):** Not yet executed. The procedure is defined and documented in the rollback runbook.

## Related documents

- [`BACKUP_RUNBOOK.md`](../BACKUP_RUNBOOK.md) — In-app backup operations
- [`PRODUCTION_CUTOVER_RUNBOOK.md`](./PRODUCTION_CUTOVER_RUNBOOK.md) — Pre-deploy backup and deployment sequence
- [`PRODUCTION_ROLLBACK_RUNBOOK.md`](./PRODUCTION_ROLLBACK_RUNBOOK.md) — Rollback, forward-fix, and DB restore
- [`PRODUCTION_LAUNCH_SIGNOFF.md`](./PRODUCTION_LAUNCH_SIGNOFF.md) — Signoff checklist (references backup/restore readiness)
