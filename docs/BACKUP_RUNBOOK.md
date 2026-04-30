# Backup and Restore Runbook for ProjTrack

This runbook provides operational guidance for setting up, performing, and validating backups and restores for ProjTrack's critical data components, including the PostgreSQL database and S3-compatible object storage. Regular backups are essential for data integrity and disaster recovery in production.

## Backup Strategy

- **Components to Backup**:
  - **PostgreSQL Database**: Contains user data, academic structures, submissions, and application state.
  - **S3-Compatible Object Storage**: Stores uploaded files, submissions, and other user-generated content.
- **Frequency**: 
  - Database: Daily full backups with incremental backups every 6 hours.
  - Object Storage: Weekly full backups with daily incremental syncs for new or modified files.
- **Retention Policy**: 
  - Database: Retain daily backups for 7 days, weekly backups for 4 weeks, monthly backups for 3 months.
  - Object Storage: Retain weekly backups for 4 weeks, monthly backups for 6 months.
- **Storage Location**: Backups are stored in a separate, secure S3-compatible bucket or offsite location, distinct from primary storage, with restricted access.

## Setup Instructions

### Database Backup Setup (PostgreSQL)
- **Tool**: Use `pg_dump` for full backups and `pg_dump` with `--incremental` options or a tool like `pgBackRest` for incremental backups.
- **Environment Variables**: Ensure `DATABASE_URL` is set in the backup environment for connection details.
- **Script**: Create a backup script (e.g., `backup-db.sh`) to automate the process:
  ```bash
  #!/bin/bash
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="projtrack_db_$TIMESTAMP.sql"
  pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
  # Upload to secure backup storage
  aws s3 cp "$BACKUP_FILE" "s3://projtrack-backups/database/$BACKUP_FILE" --region your-backup-region
  # Clean up local file
  rm "$BACKUP_FILE"
  ```
- **Scheduling**: Use `cron` or a similar scheduler to run daily full backups at low-traffic times (e.g., 2 AM UTC):
  ```bash
  0 2 * * * /path/to/backup-db.sh
  ```
- **Incremental**: If using `pgBackRest`, configure for incremental backups every 6 hours:
  ```bash
  0 */6 * * * pgbackrest --stanza=projtrack backup --type=incr
  ```

### Object Storage Backup Setup (S3-Compatible)
- **Tool**: Use `aws-cli` or `rclone` for syncing S3 buckets to a backup location.
- **Environment Variables**: Set `S3_BACKUP_ACCESS_KEY_ID`, `S3_BACKUP_SECRET_ACCESS_KEY`, `S3_BACKUP_BUCKET`, and `S3_BACKUP_REGION` for the backup destination.
- **Script**: Create a backup script (e.g., `backup-s3.sh`) for full and incremental syncs:
  ```bash
  #!/bin/bash
  # Full backup (weekly)
  if [[ $(date +%A) == "Sunday" ]]; then
    aws s3 sync s3://projtrack-primary-bucket s3://projtrack-backups/storage/full-$(date +%Y%m%d) --region your-primary-region --source-region your-backup-region
  else
    # Incremental daily sync
    aws s3 sync s3://projtrack-primary-bucket s3://projtrack-backups/storage/daily-$(date +%Y%m%d) --region your-primary-region --source-region your-backup-region --delete
  fi
  ```
- **Scheduling**: Schedule weekly full and daily incremental backups:
  ```bash
  0 3 * * 0 /path/to/backup-s3.sh  # Full backup every Sunday at 3 AM
  0 3 * * 1-6 /path/to/backup-s3.sh  # Incremental backup daily at 3 AM
  ```

## Backup Execution

### Manual Backup Trigger
- **Database**: Run `pg_dump "$DATABASE_URL" > projtrack_db_manual.sql` and upload to `s3://projtrack-backups/database/manual/`.
- **Object Storage**: Run `aws s3 sync s3://projtrack-primary-bucket s3://projtrack-backups/storage/manual-$(date +%Y%m%d)/` for a manual full backup.

### Automated Backup Verification
- **Check Backup Completion**: After scheduled backups, verify the presence of backup files in `s3://projtrack-backups/` using `aws s3 ls`.
- **Alerting**: Set up monitoring to alert if backup files are not created within expected time windows (e.g., no new file in `s3://projtrack-backups/database/` within 25 hours).

## Restore Procedure

### Database Restore (PostgreSQL)
- **Preparation**:
  1. Stop the backend application to prevent data writes during restore (`systemctl stop projtrack-backend` or equivalent).
  2. Identify the latest backup file in `s3://projtrack-backups/database/` using `aws s3 ls s3://projtrack-backups/database/ --region your-backup-region`.
  3. Download the backup: `aws s3 cp s3://projtrack-backups/database/projtrack_db_YYYYMMDD_HHMMSS.sql ./restore.sql`.
- **Restore Process**:
  1. Create a temporary database or drop existing tables if restoring to the same database (ensure no data loss risk):
     ```bash
     psql -h your-db-host -U your-db-user -d postgres -c "CREATE DATABASE projtrack_restore;"
     ```
  2. Restore the backup to the temporary database:
     ```bash
     psql -h your-db-host -U your-db-user -d projtrack_restore < ./restore.sql
     ```
  3. Verify data integrity by checking key tables (e.g., `users`, `submissions`) for expected row counts and recent data.
  4. If verified, rename or swap databases (or update `DATABASE_URL` to point to the restored database):
     ```bash
     psql -h your-db-host -U your-db-user -d postgres -c "ALTER DATABASE projtrack RENAME TO projtrack_old;"
     psql -h your-db-host -U your-db-user -d postgres -c "ALTER DATABASE projtrack_restore RENAME TO projtrack;"
     ```
- **Post-Restore**:
  1. Restart the backend application (`systemctl start projtrack-backend`).
  2. Perform smoke tests (e.g., login, data access) to confirm functionality as per `STAGING_SMOKE_TEST_GUIDE.md`.
  3. Clean up temporary files and old database if no issues are found.

### Object Storage Restore (S3-Compatible)
- **Preparation**:
  1. Identify the latest full backup or relevant incremental backup in `s3://projtrack-backups/storage/`.
  2. Decide whether to restore to a temporary bucket or overwrite the primary bucket (recommended to use temporary for validation).
- **Restore Process**:
  1. Sync the backup to a temporary bucket or directory:
     ```bash
     aws s3 sync s3://projtrack-backups/storage/full-YYYYMMDD/ s3://projtrack-restore-temp/ --region your-backup-region
     ```
  2. If incremental backups are needed, apply them in sequence:
     ```bash
     aws s3 sync s3://projtrack-backups/storage/daily-YYYYMMDD/ s3://projtrack-restore-temp/ --region your-backup-region
     ```
  3. Verify file counts and sample file integrity by comparing metadata or checksums with the primary bucket if available.
  4. If verified, sync the restored data to the primary bucket (ensure no data loss risk):
     ```bash
     aws s3 sync s3://projtrack-restore-temp/ s3://projtrack-primary-bucket/ --region your-primary-region --delete
     ```
- **Post-Restore**:
  1. Run object storage smoke test (`node backend/scripts/object-storage-smoke.js`) to confirm upload and retrieval functionality.
  2. Manually validate access to a sample of restored files via the application.
  3. Clean up temporary restore bucket if no issues are found.

## Validation Drill (Staging Environment)

- **Frequency**: Perform a full backup and restore drill in the staging environment at least once before production deployment and quarterly thereafter.
- **Process**:
  1. Trigger a manual backup of the staging database and object storage.
  2. Restore both to separate temporary instances (database and storage).
  3. Point a test instance of ProjTrack to the restored instances by updating `DATABASE_URL` and S3 configurations.
  4. Run smoke tests (`npm --prefix backend run smoke`, `node backend/scripts/object-storage-smoke.js`) to validate functionality.
  5. Document results, including restore time, data integrity checks, and any issues encountered.
- **Success Criteria**: Restore completes within acceptable downtime windows (e.g., under 2 hours for database, under 4 hours for storage), and all smoke tests pass with no data loss or corruption.

## Troubleshooting

- **Backup Failure**: 
  - Check logs for connection issues (`DATABASE_URL` for database, S3 credentials for storage).
  - Verify sufficient disk space or S3 bucket permissions.
  - Ensure scheduling scripts have executable permissions and correct paths.
- **Restore Failure**:
  - Database: Ensure the backup file is not corrupted (`pg_restore --verbose` for diagnostics). Check for version mismatches between backup and target PostgreSQL.
  - Storage: Verify S3 sync commands completed without errors (`aws s3 sync --dryrun` to preview). Check for network interruptions or permission issues.
- **Data Integrity Issues**: If restored data shows inconsistencies, compare backup timestamps with last known good state. Consider restoring from an earlier backup if corruption is suspected.
- **Alerts Not Triggering**: Confirm monitoring setup for backup completion. Check alert thresholds and notification channels (e.g., email, Slack).

## Security Considerations

- **Access Control**: Backup storage (S3 bucket) must have strict IAM policies limiting access to backup admin roles only. Enable MFA for backup storage access.
- **Encryption**: Ensure backups are encrypted at rest (S3 server-side encryption) and in transit (TLS for uploads/downloads). Database backups should be encrypted if containing sensitive data.
- **Audit Logging**: Enable logging for backup storage access to detect unauthorized access attempts.

## Documentation and Updates

- **Backup Logs**: Maintain logs of backup operations, including timestamps, sizes, and success/failure status, in a central location (e.g., `s3://projtrack-backups/logs/`).
- **Runbook Review**: Update this runbook after each restore drill or significant infrastructure change to reflect lessons learned or new configurations.

This runbook ensures ProjTrack's data resilience through systematic backup and restore processes, validated through regular drills, with clear steps for operational success and troubleshooting.
