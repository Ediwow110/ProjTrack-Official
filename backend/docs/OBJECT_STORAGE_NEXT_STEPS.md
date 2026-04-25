# Object Storage Setup

PROJTRACK already supports S3-compatible object storage in the live backend.

## What is implemented
1. `OBJECT_STORAGE_MODE=local|s3` and `FILE_STORAGE_MODE=local|s3`
2. Database-backed file metadata and submission linkage
3. Signed download URLs for S3 mode
4. Read/write/delete health probes through `/health/storage`
5. Production runtime checks that reject local-disk storage in `NODE_ENV=production`

## Bundled local S3 stack
Use the included MinIO compose file for a production-like local setup:

1. Run `npm run storage:up` inside `backend`
2. Copy the values from `backend/.env.minio.example` into your real `backend/.env`
3. Restart the backend
4. Verify `/health/storage` reports `ok: true`

The included `minio-init` service creates the private `projtrack-files` bucket automatically.

## Required environment variables for S3 mode
- `FILE_STORAGE_MODE=s3`
- `OBJECT_STORAGE_MODE=s3`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ENDPOINT` for MinIO or other S3-compatible providers
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_FORCE_PATH_STYLE=true` for MinIO

## Production note
For real production deployments, replace the bundled MinIO values with your managed object storage provider credentials. The backend health checks and runtime guards will validate the configuration on boot and at `/health/storage`.
