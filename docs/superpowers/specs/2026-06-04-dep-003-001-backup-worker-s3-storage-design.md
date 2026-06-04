# DEP-003+001: Enable Backup Worker + S3 Backup Storage

**Date:** 2026-06-04
**Status:** Design Approved

## Overview

Resolve two staging watchlist items:
- **DEP-003**: Enable backup worker on staging
- **DEP-001**: Replace ephemeral local-only backup storage with durable S3-compatible storage

## Configuration

### New environment variables

| Variable | Purpose | Required when |
|----------|---------|---------------|
| `BACKUP_S3_ENDPOINT` | S3-compatible endpoint URL (e.g. DO Spaces region endpoint) | provider=`s3` |
| `BACKUP_S3_REGION` | Region slug (e.g. `sgp1`) | provider=`s3` |
| `BACKUP_S3_BUCKET` | Bucket name for backup artifacts | provider=`s3` |
| `BACKUP_S3_ACCESS_KEY_ID` | S3 access key | provider=`s3` |
| `BACKUP_S3_SECRET_ACCESS_KEY` | S3 secret key | provider=`s3` |
| `BACKUP_S3_PREFIX` | Optional key prefix for multi-environment isolation | — |

### Runtime safety

When `BACKUP_STORAGE_PROVIDER=s3`, all `BACKUP_S3_*` vars except `BACKUP_S3_PREFIX` are required. The dead `BACKUP_SCHEDULE_ENABLED` requirement is removed from runtime safety checks.

## Architecture

### Current

```
BackupsService → BackupStorageService (local provider)
                    ↳ readJson / writeJson / describe / delete via fs
```

### New

```
BackupsService → BackupStorageService (provider router)
                    ├── local → fs operations (unchanged)
                    └── s3    → BackupS3StorageService
                                  ↳ S3Client from @aws-sdk/client-s3
```

`BackupStorageService` (`backup-storage.service.ts`) routes all I/O operations to the active provider based on `BACKUP_STORAGE_PROVIDER`. The public interface is unchanged.

### BackupS3StorageService

New injectable service at `backend/src/backups/backup-s3-storage.service.ts`:

| Method | S3 operation | Returns |
|--------|-------------|---------|
| `writeJson(key, data)` | `PutObjectCommand` | `{ path, sizeBytes, sha256 }` |
| `readJson(key)` | `GetObjectCommand` | parsed JSON |
| `describe(key)` | `HeadObjectCommand` | `{ provider, path, sizeBytes, available, warning }` |
| `delete(key)` | `DeleteObjectCommand` | void |
| `listJsonArtifacts(prefix)` | `ListObjectsV2Command` | filtered key list |
| `checksum(key)` | `GetObjectCommand` + SHA-256 | hex string |

Key format: `backups/{prefix}{filename}` where `prefix` is `BACKUP_S3_PREFIX` (default empty).

### Error handling

- S3 errors are caught and re-thrown as `InternalServerErrorException` with correlation context
- Missing objects return `available: false` in `describe()` (matching local provider behavior)
- Network timeouts use SDK default retries (3 retries, exponential backoff)

## Files Changed

| File | Change |
|------|--------|
| `backend/src/backups/backup-s3-storage.service.ts` | **New** |
| `backend/src/backups/backup-s3-storage.service.spec.ts` | **New** |
| `backend/src/backups/backup-storage.service.ts` | Add `s3` provider routing |
| `backend/src/backups/backups.module.ts` | Register new service |
| `backend/src/config/runtime-safety.ts` | Add S3 env validation; remove dead `BACKUP_SCHEDULE_ENABLED` requirement |
| `docs/env/staging.env.example` | Add S3 backup vars; set `BACKUP_WORKER_ENABLED=true` |
| `docs/env/production.env.example` | Add `BACKUP_S3_*` vars; remove dead `BACKUP_STORAGE` |
| `docs/STAGING_DEPLOYMENT_EXECUTION_REPORT.md` | Update DEP-001/DEP-003 status |

## Testing

- Unit tests for `BackupS3StorageService`: write, read, describe (exists/missing), delete, list, checksum
- Unit tests for `BackupStorageService` provider routing (local vs s3)
- Existing backup E2E tests remain unchanged (they test the full flow)

## Deployment (Staging)

1. Create DO Spaces bucket `projtrack-staging-backups` with access key
2. Set `BACKUP_STORAGE_PROVIDER=s3` + all `BACKUP_S3_*` vars in staging env
3. Set `BACKUP_WORKER_ENABLED=true`
4. Rebuild and restart staging stack
5. Verify: manual backup creates artifact in S3; `/health/backups` shows available artifact
