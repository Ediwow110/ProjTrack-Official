# Google Drive Backup Plan

This document is a production plan. It does not enable backup code by itself. Keep the database provider's native backups as the primary recovery mechanism, and use Google Drive exports as a secondary copy.

## Requirements

- Google Cloud project.
- Google Drive API enabled.
- Service account dedicated to backup uploads.
- Shared Google Drive folder for backups.
- Folder shared with the service account as Editor.
- Backend host has `pg_dump` and `gzip` available.
- Backend host can reach both PostgreSQL and Google Drive.

## Backup Flow

1. Run a PostgreSQL dump with `pg_dump`.
2. Compress the dump with `gzip`.
3. Upload the compressed dump to the shared Google Drive folder.
4. Upload a metadata JSON file with database name alias, backup timestamp, application version, checksum, and file size.
5. Run retention cleanup after a successful upload.

## File Naming

```text
projtrack-db-backup-YYYY-MM-DD-HHmm.sql.gz
projtrack-db-backup-YYYY-MM-DD-HHmm.metadata.json
```

## Security

- Do not upload `backend/.env`.
- Do not upload service account JSON files.
- Do not log private keys.
- Do not log `DATABASE_URL`.
- Do not log database credentials or signed URLs.
- Store the service account private key in the backend host secret manager only.
- Limit Drive folder access to maintainers who are allowed to restore production data.
- Rotate the service account key immediately if it is exposed.

## Retention

- Keep daily backups for 14 days.
- Keep weekly backups for 8 weeks.
- Keep monthly backups for 12 months.
- Never delete the latest successful backup automatically.

## Restore Procedure

1. Download the selected `.sql.gz` backup and matching metadata JSON.
2. Verify checksum and file size.
3. Restore to staging first.
4. Verify app login, admin users, student data, submissions, files, notifications, and mail settings.
5. Prepare a fresh production backup before any production restore.
6. Restore production only after staging verification and approval.
7. Re-run `/health/ready`, duplicate scan, and core login/submission QA after restore.

## Recommended Setup

- Primary: managed database provider backups with point-in-time recovery where available.
- Secondary: scheduled Google Drive export using the service account and shared folder.
- Manual recovery: keep documented host access, database credentials, and restore commands in the operations runbook, not in the repository.
