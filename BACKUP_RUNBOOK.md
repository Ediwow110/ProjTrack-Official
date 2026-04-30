# Backup Runbook

## Configuration

Local storage is active today. Future providers are reserved as `gdrive` and `s3`.

```bash
BACKUP_STORAGE=local
BACKUP_LOCAL_DIR=backend/data/system-tools/backups
BACKUP_WORKER_ENABLED=false
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=30
```

Set `BACKUP_WORKER_ENABLED=true` only on the dedicated worker process.

## Manual Backup

Admins can run a backup from Admin -> Backups or call:

```http
POST /admin/backups/run
```

The backend creates a `BackupRun`, writes a JSON artifact, stores a manifest, records counts, computes `sha256`, and logs the admin action.

## Download and Manifest

Use Admin -> Backups -> Download or:

```http
GET /admin/backups/{id}/download
GET /admin/backups/{id}/manifest
```

Treat every backup artifact as sensitive. It contains production records needed for restore and must be stored encrypted with operator-only access.

## Validation

Use Admin -> Backups -> Validate or:

```http
POST /admin/backups/{id}/validate
```

Validation recomputes the artifact checksum and compares it with `BackupRun.sha256`.

## Delete Rules

Deletion is blocked when the backup is:

- the latest successful backup
- protected
- running

Use protect/unprotect for retention exceptions. Deletion soft-deletes the `BackupRun` row and removes the local artifact.

## Retention and Failure Handling

- Automatic cleanup is controlled by `BACKUP_WORKER_ENABLED` and retention env values.
- Protected, running, and latest successful backups are skipped by retention.
- If validation fails, protect the last known-good artifact, run a fresh manual backup, and inspect storage errors before deleting anything.
- If artifact deletion fails, keep the `BackupRun` row visible and investigate storage permissions.

## Restore

In-app restore is intentionally not implemented. Restore is destructive and must be performed by an operator:

1. Put the site in maintenance mode.
2. Download and validate the backup artifact.
3. Create a fresh database snapshot before restore.
4. Restore records from the artifact using a reviewed one-off script or database import process.
5. Run `npx prisma migrate deploy`.
6. Run backend smoke checks and health checks.
7. Re-enable the site after confirming auth, mail, submissions, and files.

Never restore over production without a current pre-restore snapshot.
