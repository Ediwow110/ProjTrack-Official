# Backup Runbook

## Configuration

Local storage is active today. Future providers are reserved as `gdrive` and `s3`.

```bash
BACKUP_STORAGE=local
BACKUP_LOCAL_DIR=data/system-tools/backups
BACKUP_WORKER_ENABLED=false
BACKUP_SCHEDULE_ENABLED=false
BACKUP_DEFAULT_FREQUENCY=daily
BACKUP_DEFAULT_TIME=02:00
BACKUP_TIMEZONE=Asia/Manila
BACKUP_RETENTION_DAYS=30
BACKUP_RETENTION_COUNT=10
BACKUP_WORKER_POLL_MS=60000
```

Keep `BACKUP_WORKER_ENABLED=false` on the API process. Set it to `true` only on one dedicated worker process. Admin settings control whether the schedule is enabled; the worker env flag controls whether a process is allowed to execute scheduled backups.

## Manual Backup

Admins can run a backup from Admin -> Backups or call:

```http
POST /admin/backups/run
```

The backend creates a `BackupRun`, writes a JSON artifact, stores a manifest, records counts, computes `sha256`, and logs the admin action.

## Automatic Backup

Admins configure automatic backups from Admin -> Backups:

- frequency: daily, weekly, monthly, or custom interval
- backup time and timezone, defaulting to `Asia/Manila`
- weekly day or monthly day when applicable
- retention days and keep-last count

Run the API and backup worker as separate processes:

```bash
# API process
BACKUP_WORKER_ENABLED=false npm run start:prod

# Dedicated backup worker process
BACKUP_WORKER_ENABLED=true npm run start:worker
```

The worker uses the persisted admin schedule, creates the same artifact and `BackupRun` metadata as manual backups, records failures as failed runs, and uses a lock/guard to avoid duplicate automatic runs.

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
- Retention may delete old unprotected backups by age or by count, but it must never delete protected backups or the newest successful backup.
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
