# DEP-003+001: Enable Backup Worker + S3 Backup Storage

**Date:** 2026-06-04
**Status:** Design Approved

## Overview

Resolve two staging watchlist items:
- **DEP-003**: `BACKUP_WORKER_ENABLED=false` on staging — backup worker does not run
- **DEP-001**: Backup artifacts stored only on local ephemeral volume — missing after container restart

Replace local-only backup storage with a new S3-compatible storage provider while preserving the local provider as the default fallback.

## Non-Goals

The following are explicitly **out of scope** for this work:
- DEP-005 restore drill execution (separate work against a disposable DB)
- DEP-004 monitoring provider setup
- Production promotion
- Upload/file storage changes
- Destructive database restore
- Backup admin UI changes
- Data deletion workflow changes
- Mail worker changes

## Configuration

### New environment variables

| Variable | Purpose | Required when |
|----------|---------|---------------|
| `BACKUP_S3_ENDPOINT` | S3-compatible endpoint URL (e.g. DO Spaces region endpoint) | provider=`s3` |
| `BACKUP_S3_REGION` | Region slug (e.g. `sgp1`) | provider=`s3` |
| `BACKUP_S3_BUCKET` | Bucket name for backup artifacts | provider=`s3` |
| `BACKUP_S3_ACCESS_KEY_ID` | S3 access key | provider=`s3` |
| `BACKUP_S3_SECRET_ACCESS_KEY` | S3 secret key | provider=`s3` |
| `BACKUP_S3_FORCE_PATH_STYLE` | Force path-style addressing (needed for MinIO, some S3-compat providers) | — |
| `BACKUP_S3_PREFIX` | Optional key prefix for environment-scoped isolation (e.g. `staging/`) | — |

Storage provider selection uses the existing `BACKUP_STORAGE_PROVIDER` env var (not the dead `BACKUP_STORAGE` alias). When set to `s3`, all `BACKUP_S3_*` vars except `BACKUP_S3_PREFIX` and `BACKUP_S3_FORCE_PATH_STYLE` are validated at boot.

### Runtime safety

- `BACKUP_STORAGE_PROVIDER=s3` triggers S3 config validation
- Missing required S3 vars when provider=`s3` → boot-time error with clear message listing which vars are missing
- The dead `BACKUP_SCHEDULE_ENABLED` env var is kept in runtime safety requirements for backward compatibility (existing deployments and env files set it), but its requirement comment is updated to note it is unused by runtime code

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

`BackupStorageService` routes all I/O operations to the active provider based on `BACKUP_STORAGE_PROVIDER`. The public interface is unchanged — existing callers (`BackupsService`, health check, admin controller) require zero changes.

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

### Object key strategy

Keys follow the pattern: `backups/{prefix}{backupId}/{filename}`

- `prefix` = `BACKUP_S3_PREFIX` (default empty), e.g. `staging/`
- `backupId` = the `BackupRun.id` (CUID, e.g. `cm7...`)
- `filename` = the existing deterministic filename from `BackupsService`, e.g. `projtrack-backup-2026-06-04T12:00:00.000Z-cm7....json`

Example full key: `backups/staging/cm7abc123/projtrack-backup-2026-06-04T12:00:00.000Z-cm7abc123.json`

**Safety:**
- Path traversal prevented by AWS SDK (S3 keys are flat, `/` is a delimiter)
- Accidental overwrite prevented by unique `backupId` in key
- Cross-environment collisions prevented by `BACKUP_S3_PREFIX`

### Error handling

- S3 service errors caught and re-thrown as `InternalServerErrorException` with a safe correlation message (no credential/endpoint details leaked)
- Missing objects → `describe()` returns `{ available: false }` (matching local provider)
- Network timeouts → SDK default retry (3 attempts, exponential backoff)
- Credentials stripped from all error messages and log output

## Security

- `BACKUP_S3_ACCESS_KEY_ID` and `BACKUP_S3_SECRET_ACCESS_KEY` are distinct from upload S3 credentials (separate Spaces access key for backups)
- Error messages and logs redact access key ID and secret access key — never include credential values
- Bucket should be private with least-privilege policy: only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` on the dedicated backup bucket
- DO Spaces provides default server-side encryption (SSE-S3) — no additional config needed
- No backup download through unauthenticated routes — artifact access is admin-only via existing `/admin/backups/:id/download` endpoint
- Retention/delete follows existing `BackupRetentionService` flow — expired artifacts are deleted from S3

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Credential leakage | S3 credentials redacted from all error messages and logs; separate key from upload credentials |
| Wrong bucket/environment | `BACKUP_S3_PREFIX` scopes keys per environment; runtime safety validates config at boot |
| Local/S3 divergence | `BackupStorageService` abstraction ensures identical interface; both paths have dedicated tests |
| Partial upload failure | S3 PutObject is atomic — failed upload returns error, no partial artifact stored |
| Retention cleanup | `delete()` removes S3 object; `BackupRetentionService` calls delete on expiry |
| Duplicate metadata without artifact | `BackupRun` created before artifact write; write failure leaves status `RUNNING`; next tick detects no artifact and logs warning |
| Worker restart/retry | PostgreSQL advisory lock (`pg_try_advisory_lock`) prevents duplicate concurrent runs |
| Data loss | S3 provides 99.999999999% durability vs local ephemeral Docker volume |
| Artifact corruption | SHA-256 checksum stored in `BackupRun.sha256`; `/health/backups` endpoint reports artifact state; `validate()` can verify against stored checksum |
| No restore drill covered | Explicitly excluded as non-goal (DEP-005 separate) |

## Backward Compatibility

- Local provider behavior is completely unchanged — it remains the default
- Existing backup metadata contracts (`BackupRun`, health response shapes) unchanged
- Existing admin backup UI and API behavior unchanged
- Current staging deployment behavior unchanged until env is explicitly set to use S3
- E2E tests that test backup flow use local provider and continue to pass unchanged

## Testing

### Unit tests

| Test | Coverage |
|------|----------|
| `BackupS3StorageService.writeJson` | Writes with correct key, returns metadata with size and SHA-256 |
| `BackupS3StorageService.readJson` | Retrieves and parses stored JSON |
| `BackupS3StorageService.describe` | Returns metadata when object exists; `available: false` when missing |
| `BackupS3StorageService.delete` | Removes the S3 object |
| `BackupS3StorageService.listJsonArtifacts` | Returns filtered JSON keys under prefix |
| `BackupS3StorageService.checksum` | Computes correct SHA-256 |
| `BackupStorageService` provider routing | Local vs S3 routing based on `BACKUP_STORAGE_PROVIDER` |
| Missing S3 env vars | `runtime-safety.ts` fails closed with clear configuration error |
| No credential leakage | Error messages and logs contain no credential values |
| Backup worker initializes with provider=s3 | Worker starts; `status()` returns `enabled: true` |
| Health: artifact exists vs missing | `/health/backups` correctly reports artifact availability |
| Retention/delete with S3 | Expired artifacts removed from S3 via `delete()` |

### E2E tests

Existing backup E2E tests (`tests/e2e/admin-backups.spec.ts`) are unchanged — they use the local provider and test the complete admin flow.

## Verification Plan

### Local verification commands

```bash
cd backend
npm run build
npm run test:unit
npm run test:security
$env:DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
npm exec --package=prisma@6.19.3 -- prisma validate
cd ..
npm run typecheck
npm test
```

### PR process

1. Focused branch off `main`
2. PR opened against `main`
3. CI must be green before merge
4. User authorization required before merge
5. Merge commit (no squash, no rebase)

### Staging deployment

1. Create DO Spaces bucket `projtrack-staging-backups` with separate access key
2. Set `BACKUP_STORAGE_PROVIDER=s3` + all `BACKUP_S3_*` vars in staging env file
3. Set `BACKUP_WORKER_ENABLED=true`
4. Rebuild: `VCS_REF=$(git rev-parse HEAD) docker compose build --no-cache backend backup-worker`
5. Restart: `docker compose up -d`
6. Trigger manual backup via admin UI or API
7. Verify S3 artifact exists (Spaces dashboard or `aws s3 ls`)
8. Verify `/health/backups` reports artifact with size and SHA-256, `worker.enabled: true`
9. Restart worker container, confirm artifact still available in `/health/backups`
10. Update `docs/STAGING_DEPLOYMENT_EXECUTION_REPORT.md`

## Acceptance Criteria

### DEP-003 closed only when

- `BACKUP_WORKER_ENABLED=true` is set in staging environment
- Backup worker container is running and healthy
- Worker logs show no fatal errors at startup
- `/health/backups` reports `worker.enabled: true`

### DEP-001 closed only when

- A real backup artifact exists in the S3/Spaces bucket
- `BackupRun` metadata references the S3 key as `artifactPath`
- `sizeBytes` and `sha256` are populated in the `BackupRun` record
- Artifact survives worker container restart (stop → start → verify)
- Artifact can be described and listed via `/health/backups` without downloading sensitive contents
- Local-only missing artifact is no longer the only backup evidence on staging

### Not closed by this work

- DEP-005 restore drill (separate execution against disposable DB)
- DEP-004 monitoring provider (separate track)

## Files Changed

| File | Change |
|------|--------|
| `backend/src/backups/backup-s3-storage.service.ts` | **New** — S3 storage provider |
| `backend/src/backups/backup-s3-storage.service.spec.ts` | **New** — S3 storage tests |
| `backend/src/backups/backup-storage.service.ts` | Add `s3` provider routing |
| `backend/src/backups/backups.module.ts` | Register `BackupS3StorageService` |
| `backend/src/config/runtime-safety.ts` | Add S3 env validation when provider=`s3`; update `BACKUP_SCHEDULE_ENABLED` comment to note it is unused by runtime |
| `docs/env/staging.env.example` | Add S3 backup vars; set `BACKUP_WORKER_ENABLED=true` |
| `docs/env/production.env.example` | Add `BACKUP_S3_*` vars; remove dead `BACKUP_STORAGE` alias |
| `docs/STAGING_DEPLOYMENT_EXECUTION_REPORT.md` | Update DEP-001/DEP-003 status after live verification |
